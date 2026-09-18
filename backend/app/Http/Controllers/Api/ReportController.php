<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\Expense;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Table;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    /**
     * Executive Overview Dashboard KPIs.
     */
    public function dashboard()
    {
        $today = Carbon::today();

        // Orders & Sessions today
        $ordersToday = Order::whereDate('created_at', $today)->where('status', '!=', 'cancelled')->get();
        $sessionsToday = DeviceSession::whereDate('created_at', $today)->get();

        $cafeRevenue = (float)$ordersToday->sum('total_amount');
        $gamingRevenue = (float)$sessionsToday->sum(fn ($session) => $this->sessionRevenue($session));
        $totalRevenue = $cafeRevenue + $gamingRevenue;
        $expensesToday = (float)Expense::whereDate('expense_date', $today)->sum('amount');
        $cogsToday = (float)OrderItem::whereHas('order', fn ($q) => $q->whereDate('created_at', $today)->where('status', '!=', 'cancelled'))
            ->selectRaw('COALESCE(SUM(quantity * cost_price), 0) as total')->value('total');

        // Occupancy rates
        $totalDevices = Device::count();
        $activeDevices = Device::where('status', 'active')->count();
        $deviceOccupancyRate = $totalDevices > 0 ? round(($activeDevices / $totalDevices) * 100, 1) : 0;

        $totalTables = Table::count();
        $occupiedTables = Table::where('status', 'occupied')->count();
        $tableOccupancyRate = $totalTables > 0 ? round(($occupiedTables / $totalTables) * 100, 1) : 0;

        // Payment breakdown
        $cashPayments = Payment::whereDate('created_at', $today)->where('payment_method', 'cash')->sum('amount');
        $cardPayments = Payment::whereDate('created_at', $today)->where('payment_method', 'visa')->sum('amount');

        // Top Selling Products
        $topProducts = OrderItem::select('product_id', DB::raw('SUM(quantity) as total_quantity'), DB::raw('SUM(subtotal) as total_sales'))
            ->groupBy('product_id')
            ->orderByDesc('total_quantity')
            ->with('product')
            ->take(5)
            ->get();

        // Low stock items count
        $lowStockCount = Product::whereColumn('stock_quantity', '<=', 'reorder_level')->count();

        // Active shift info
        $currentShift = Shift::with('staff')->where('status', 'active')->latest()->first();

        // Recent orders
        $recentOrders = Order::with(['items.product', 'table', 'deviceSession.device'])
            ->latest()
            ->take(6)
            ->get();

        return response()->json([
            'metrics' => [
                'total_revenue_today' => $totalRevenue,
                'cafe_revenue_today' => $cafeRevenue,
                'gaming_revenue_today' => $gamingRevenue,
                'expenses_today' => $expensesToday,
                'cost_of_goods_today' => $cogsToday,
                'net_profit_today' => $totalRevenue - $expensesToday - $cogsToday,
                'cash_total' => (float)$cashPayments,
                'card_total' => (float)$cardPayments,
                'orders_count' => $ordersToday->count(),
                'sessions_count' => $sessionsToday->count(),
                'active_devices_count' => $activeDevices,
                'total_devices_count' => $totalDevices,
                'device_occupancy_rate' => $deviceOccupancyRate,
                'occupied_tables_count' => $occupiedTables,
                'total_tables_count' => $totalTables,
                'table_occupancy_rate' => $tableOccupancyRate,
                'low_stock_count' => $lowStockCount,
            ],
            'current_shift' => $currentShift,
            'top_products' => $topProducts,
            'recent_orders' => $recentOrders,
        ]);
    }

    /**
     * Financial & Operational Analytics.
     */
    public function analytics(Request $request)
    {
        $period = $request->input('period', 'week');
        if ($period === 'day') {
            $days = 1;
            $fromDate = Carbon::today();
        } elseif ($period === 'month') {
            $fromDate = Carbon::now()->startOfMonth();
            $days = $fromDate->daysInMonth;
        } else {
            $days = max(1, min((int)$request->input('days', 7), 31));
            $fromDate = Carbon::now()->subDays($days - 1)->startOfDay();
        }

        // Daily revenue trend
        $orders = Order::where('created_at', '>=', $fromDate)
            ->where('status', '!=', 'cancelled')
            ->get();

        $sessions = DeviceSession::where('created_at', '>=', $fromDate)->get();
        $expenses = Expense::where('expense_date', '>=', $fromDate->toDateString())->get();

        $dailyStats = [];
        for ($i = 0; $i < $days; $i++) {
            $periodDate = (clone $fromDate)->addDays($i);
            $date = $periodDate->format('Y-m-d');
            $dayName = $periodDate->format('D');

            $dayOrders = $orders->filter(fn($o) => $o->created_at->format('Y-m-d') === $date);
            $daySessions = $sessions->filter(fn($s) => $s->created_at->format('Y-m-d') === $date);

            $dayCafe = (float)$dayOrders->sum('total_amount');
            $dayGaming = (float)$daySessions->sum(fn ($session) => $this->sessionRevenue($session));
            $dayExpenses = (float)$expenses->filter(fn($e) => $e->expense_date->format('Y-m-d') === $date)->sum('amount');
            $dayCogs = (float)OrderItem::whereHas('order', fn ($q) => $q->whereDate('created_at', $date)->where('status', '!=', 'cancelled'))
                ->selectRaw('COALESCE(SUM(quantity * cost_price), 0) as total')->value('total');

            $dailyStats[] = [
                'date' => $date,
                'day' => $dayName,
                'cafe_revenue' => $dayCafe,
                'gaming_revenue' => $dayGaming,
                'total_revenue' => $dayCafe + $dayGaming,
                'expenses' => $dayExpenses,
                'cost_of_goods' => $dayCogs,
                'net_profit' => $dayCafe + $dayGaming - $dayExpenses - $dayCogs,
                'orders_count' => $dayOrders->count(),
                'sessions_count' => $daySessions->count(),
            ];
        }

        // Category breakdown
        $categoryBreakdown = OrderItem::join('products', 'order_items.product_id', '=', 'products.id')
            ->select('products.category', DB::raw('SUM(order_items.subtotal) as total_amount'), DB::raw('SUM(order_items.quantity) as total_qty'))
            ->groupBy('products.category')
            ->get();

        return response()->json([
            'daily_stats' => $dailyStats,
            'category_breakdown' => $categoryBreakdown,
            'summary' => [
                'revenue' => (float)$orders->sum('total_amount') + (float)$sessions->sum(fn ($session) => $this->sessionRevenue($session)),
                'expenses' => (float)$expenses->sum('amount'),
                'cost_of_goods' => (float)OrderItem::whereHas('order', fn ($q) => $q->where('created_at', '>=', $fromDate)->where('status', '!=', 'cancelled'))
                    ->selectRaw('COALESCE(SUM(quantity * cost_price), 0) as total')->value('total'),
                'net_profit' => (float)$sessions->sum(fn ($session) => $this->sessionRevenue($session)) + (float)$orders->sum('total_amount')
                    - (float)OrderItem::whereHas('order', fn ($q) => $q->where('created_at', '>=', $fromDate)->where('status', '!=', 'cancelled'))
                        ->selectRaw('COALESCE(SUM(quantity * cost_price), 0) as total')->value('total')
                    - (float)$expenses->sum('amount'),
            ],
        ]);
    }

    private function sessionRevenue(DeviceSession $session): float
    {
        if (!$session->is_open_ended) {
            return (float) $session->session_cost;
        }

        $minutes = max(1, (int) ceil(Carbon::parse($session->start_time)->diffInSeconds(Carbon::now()) / 60));
        return round(($minutes / 60) * (float) $session->hourly_rate, 2);
    }
}
