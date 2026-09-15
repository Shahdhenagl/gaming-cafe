<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceSession;
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
        $gamingRevenue = (float)$sessionsToday->sum('session_cost');
        $totalRevenue = $cafeRevenue + $gamingRevenue;

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
        $days = (int)$request->input('days', 7);
        $fromDate = Carbon::now()->subDays($days);

        // Daily revenue trend
        $orders = Order::where('created_at', '>=', $fromDate)
            ->where('status', '!=', 'cancelled')
            ->get();

        $sessions = DeviceSession::where('created_at', '>=', $fromDate)->get();

        $dailyStats = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i)->format('Y-m-d');
            $dayName = Carbon::now()->subDays($i)->format('D');

            $dayOrders = $orders->filter(fn($o) => $o->created_at->format('Y-m-d') === $date);
            $daySessions = $sessions->filter(fn($s) => $s->created_at->format('Y-m-d') === $date);

            $dayCafe = (float)$dayOrders->sum('total_amount');
            $dayGaming = (float)$daySessions->sum('session_cost');

            $dailyStats[] = [
                'date' => $date,
                'day' => $dayName,
                'cafe_revenue' => $dayCafe,
                'gaming_revenue' => $dayGaming,
                'total_revenue' => $dayCafe + $dayGaming,
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
        ]);
    }
}
