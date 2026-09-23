<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerDebtPayment;
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
use Illuminate\Support\Facades\Schema;

class ReportController extends Controller
{
    /**
     * Executive Overview Dashboard KPIs (supports date, month, or custom range).
     */
    public function dashboard(Request $request)
    {
        if ($request->filled('date')) {
            $startDate = Carbon::parse($request->date)->startOfDay();
            $endDate = Carbon::parse($request->date)->endOfDay();
            $periodLabel = 'يوم ' . $startDate->format('Y-m-d');
        } elseif ($request->filled('month')) {
            $startDate = Carbon::parse($request->month . '-01')->startOfMonth();
            $endDate = (clone $startDate)->endOfMonth();
            $periodLabel = 'شهر ' . $startDate->format('Y-m');
        } elseif ($request->filled('from_date') && $request->filled('to_date')) {
            $startDate = Carbon::parse($request->from_date)->startOfDay();
            $endDate = Carbon::parse($request->to_date)->endOfDay();
            $periodLabel = $startDate->format('Y-m-d') . ' إلى ' . $endDate->format('Y-m-d');
        } else {
            $startDate = Carbon::today()->startOfDay();
            $endDate = Carbon::today()->endOfDay();
            $periodLabel = 'اليوم ' . $startDate->format('Y-m-d');
        }

        // Orders & Sessions for the selected period
        $orders = Order::whereBetween('created_at', [$startDate, $endDate])->where('status', '!=', 'cancelled')->get();
        $sessions = DeviceSession::whereBetween('created_at', [$startDate, $endDate])->get();

        $cafeRevenue = (float)$orders->sum('total_amount');
        $gamingRevenue = (float)$sessions->sum(fn ($session) => $this->sessionRevenue($session));
        $totalRevenue = $cafeRevenue + $gamingRevenue;
        $expenses = (float)Expense::where(function ($q) use ($startDate, $endDate) {
            $q->whereBetween('created_at', [$startDate, $endDate])
              ->orWhereBetween('expense_date', [$startDate->toDateString(), $endDate->toDateString()]);
        })->sum('amount');
        $cogs = (float)OrderItem::whereHas('order', fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate])->where('status', '!=', 'cancelled'))
            ->selectRaw('COALESCE(SUM(quantity * cost_price), 0) as total')->value('total');

        // Occupancy rates
        $totalDevices = Device::count();
        $activeDevices = Device::where('status', 'active')->count();
        $deviceOccupancyRate = $totalDevices > 0 ? round(($activeDevices / $totalDevices) * 100, 1) : 0;

        $totalTables = Table::count();
        $occupiedTables = Table::where('status', 'occupied')->count();
        $tableOccupancyRate = $totalTables > 0 ? round(($occupiedTables / $totalTables) * 100, 1) : 0;

        // Payment breakdown for period
        $cashPayments = Payment::whereBetween('created_at', [$startDate, $endDate])->where('payment_method', 'cash')->sum('amount');
        $cardPayments = Payment::whereBetween('created_at', [$startDate, $endDate])->where('payment_method', 'visa')->sum('amount');

        // Top Selling Products
        $topProducts = OrderItem::whereHas('order', fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate])->where('status', '!=', 'cancelled'))
            ->select('product_id', DB::raw('SUM(quantity) as total_quantity'), DB::raw('SUM(subtotal) as total_sales'))
            ->groupBy('product_id')
            ->orderByDesc('total_quantity')
            ->with('product')
            ->take(5)
            ->get();

        if ($topProducts->isEmpty()) {
            $topProducts = OrderItem::select('product_id', DB::raw('SUM(quantity) as total_quantity'), DB::raw('SUM(subtotal) as total_sales'))
                ->groupBy('product_id')
                ->orderByDesc('total_quantity')
                ->with('product')
                ->take(5)
                ->get();
        }

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
            'period' => [
                'label' => $periodLabel,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'metrics' => [
                'total_revenue_today' => $totalRevenue,
                'cafe_revenue_today' => $cafeRevenue,
                'gaming_revenue_today' => $gamingRevenue,
                'expenses_today' => $expenses,
                'cost_of_goods_today' => $cogs,
                'net_profit_today' => $totalRevenue - $expenses - $cogs,
                'cash_total' => (float)$cashPayments,
                'card_total' => (float)$cardPayments,
                'orders_count' => $orders->count(),
                'sessions_count' => $sessions->count(),
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

    /**
     * Detailed Operations & Drawer Cash Statement Ledger.
     */
    public function statement(Request $request)
    {
        try {
            $businessTimezone = (string) env('BUSINESS_TIMEZONE', 'Africa/Cairo');
            if ($request->filled('date')) {
                $startDate = Carbon::parse($request->date, $businessTimezone)->startOfDay();
                $endDate = Carbon::parse($request->date, $businessTimezone)->endOfDay();
                $periodLabel = 'يوم ' . $startDate->format('Y-m-d');
                $periodType = 'day';
            } elseif ($request->filled('month')) {
                $startDate = Carbon::parse($request->month . '-01', $businessTimezone)->startOfMonth();
                $endDate = (clone $startDate)->endOfMonth();
                $periodLabel = 'شهر ' . $startDate->format('Y-m');
                $periodType = 'month';
            } elseif ($request->filled('from_date') && $request->filled('to_date')) {
                $startDate = Carbon::parse($request->from_date, $businessTimezone)->startOfDay();
                $endDate = Carbon::parse($request->to_date, $businessTimezone)->endOfDay();
                $periodLabel = 'الفترة من ' . $startDate->format('Y-m-d') . ' إلى ' . $endDate->format('Y-m-d');
                $periodType = 'range';
            } else {
                $startDate = Carbon::now($businessTimezone)->startOfDay();
                $endDate = Carbon::now($businessTimezone)->endOfDay();
                $periodLabel = 'اليوم ' . $startDate->format('Y-m-d');
                $periodType = 'today';
            }

            $search = trim((string)$request->input('search', ''));
            if ($search === 'undefined' || $search === 'null') {
                $search = '';
            }

            $typeFilter = $request->input('type');
            if (!$typeFilter || in_array($typeFilter, ['undefined', 'null', 'all'])) {
                $typeFilter = 'all';
            }

            $paymentFilter = $request->input('payment_method');
            if (!$paymentFilter || in_array($paymentFilter, ['undefined', 'null', 'all'])) {
                $paymentFilter = 'all';
            }

            // Window covering both local and UTC boundaries (±4 hours)
            $queryStartDate = $startDate->copy()->subHours(4);
            $queryEndDate = $endDate->copy()->addHours(4);

            $paymentLabels = [
                'cash' => 'نقدي (الدرج)',
                'visa' => 'فيزا / بطاقة بنكية',
                'wallet' => 'محفظة إلكترونية',
                'instapay' => 'إنستا باي',
                'installment' => 'تقسيط',
                'credit' => 'آجل',
                'other' => 'أخرى',
            ];

            $transactions = collect();

            // 1. Gaming Sessions
            if (in_array($typeFilter, ['all', 'gaming', 'cash'])) {
                try {
                    $sessionsQuery = DeviceSession::with(['device', 'staff', 'orders.items.product'])
                        ->whereBetween('created_at', [$queryStartDate, $queryEndDate])
                        ->where('status', '!=', 'cancelled');

                    if ($paymentFilter !== 'all') {
                        $sessionsQuery->where('payment_method', $paymentFilter);
                    }

                    $sessions = $sessionsQuery->get();

                    foreach ($sessions as $session) {
                        $devName = $session->device?->device_name ?? 'جهاز ألعاب';
                        $devNameAr = $session->device?->device_name_ar ?? $devName;
                        $custName = $session->customer_name ?: 'عميل';
                        $durationStr = $session->is_open_ended ? 'جلسة مفتوحة' : (($session->duration_minutes ?: 0) . ' دقيقة');
                        if ($session->duration_minutes >= 60) {
                            $hrs = floor($session->duration_minutes / 60);
                            $remM = $session->duration_minutes % 60;
                            $durationStr = $hrs . ' ساعة' . ($remM > 0 ? (' و ' . $remM . ' دقيقة') : '');
                        }

                        $beverageItems = [];
                        if ($session->orders) {
                            foreach ($session->orders as $ord) {
                                if ($ord->items) {
                                    foreach ($ord->items as $it) {
                                        $beverageItems[] = $it->quantity . 'x ' . ($it->product?->name_ar ?? $it->product?->name ?? 'صنف');
                                    }
                                }
                            }
                        }
                        $beverageSummary = count($beverageItems) > 0 ? implode(', ', $beverageItems) : '';

                        $cost = (float)$session->session_cost;
                        $bevCost = (float)$session->beverage_cost;
                        $discount = (float)$session->discount;
                        $total = (float)$session->total_amount;
                        $isPaid = $session->payment_status === 'paid' || ($session->status === 'ended' && $session->payment_method !== 'credit');
                        $isCash = ($session->payment_method ?? 'cash') === 'cash' && $isPaid;

                        $detailParts = ["مدة: " . $durationStr, "لعب: " . number_format($cost, 2) . " ج"];
                        if ($bevCost > 0) $detailParts[] = "مشاريب: " . number_format($bevCost, 2) . " ج" . ($beverageSummary ? " (" . $beverageSummary . ")" : "");
                        if ($discount > 0) $detailParts[] = "خصم: " . number_format($discount, 2) . " ج";

                        $sessionCreatedAt = $session->created_at ? Carbon::parse($session->created_at) : ($session->start_time ? Carbon::parse($session->start_time) : Carbon::now());

                        $transactions->push([
                            'id' => 'session-' . $session->id,
                            'raw_date' => $sessionCreatedAt->toISOString(),
                            'date' => $sessionCreatedAt->format('Y-m-d'),
                            'time' => $sessionCreatedAt->format('h:i A'),
                            'date_time' => $sessionCreatedAt->format('Y-m-d h:i A'),
                            'type' => 'gaming',
                            'type_label' => 'جلسة ألعاب',
                            'title' => $devNameAr . ' • ' . $custName,
                            'customer_name' => $custName,
                            'customer_phone' => $session->customer_phone,
                            'device_name' => $devNameAr,
                            'device_or_table' => $devNameAr,
                            'duration' => $durationStr,
                            'duration_minutes' => $session->duration_minutes,
                            'details' => implode(' • ', $detailParts),
                            'items_summary' => $beverageSummary,
                            'payment_method' => $session->payment_method ?? 'cash',
                            'payment_method_label' => $paymentLabels[$session->payment_method ?? 'cash'] ?? 'أخرى',
                            'payment_status' => $session->payment_status,
                            'is_cash' => $isCash,
                            'total_amount' => $total,
                            'amount_in' => $isPaid ? $total : 0.0,
                            'amount_out' => 0.0,
                            'net_amount' => $isPaid ? $total : 0.0,
                            'staff_name' => $session->staff?->name ?? 'كاشير الصالة',
                            'receipt_id' => 'SESSION-' . $session->id,
                        ]);
                    }
                } catch (\Throwable $e) {
                    \Log::warning('Error loading gaming sessions in statement: ' . $e->getMessage());
                }
            }

            // 2. Standalone Cafe Orders (not tied to device session)
            if (in_array($typeFilter, ['all', 'cafe', 'cash'])) {
                try {
                    $ordersQuery = Order::with(['items.product', 'table', 'customer', 'staff'])
                        ->whereNull('device_session_id')
                        ->whereBetween('created_at', [$queryStartDate, $queryEndDate])
                        ->where('status', '!=', 'cancelled');

                    if ($paymentFilter !== 'all') {
                        $ordersQuery->where('payment_method', $paymentFilter);
                    }

                    $orders = $ordersQuery->get();

                    foreach ($orders as $ord) {
                        $itemsText = [];
                        if ($ord->items) {
                            foreach ($ord->items as $it) {
                                $itemsText[] = $it->quantity . 'x ' . ($it->product?->name_ar ?? $it->product?->name ?? 'صنف');
                            }
                        }
                        $itemsSummary = implode(', ', $itemsText);

                        $tableName = $ord->table ? ('طاولة ' . $ord->table->table_number) : 'تيك أواي / كافيه';
                        $custName = $ord->customer?->name ?? ($ord->customer_name ?: 'عميل');
                        $total = (float)$ord->total_amount;
                        $isPaid = $ord->payment_status === 'paid' || ($ord->status === 'completed' && $ord->payment_method !== 'credit');
                        $isCash = ($ord->payment_method ?? 'cash') === 'cash' && $isPaid;

                        $ordCreatedAt = $ord->created_at ? Carbon::parse($ord->created_at) : Carbon::now();

                        $transactions->push([
                            'id' => 'order-' . $ord->id,
                            'raw_date' => $ordCreatedAt->toISOString(),
                            'date' => $ordCreatedAt->format('Y-m-d'),
                            'time' => $ordCreatedAt->format('h:i A'),
                            'date_time' => $ordCreatedAt->format('Y-m-d h:i A'),
                            'type' => 'cafe',
                            'type_label' => 'مبيعات كافيه',
                            'title' => 'طلب #' . $ord->order_number . ' • ' . $tableName,
                            'customer_name' => $custName,
                            'customer_phone' => $ord->customer?->phone,
                            'device_name' => null,
                            'device_or_table' => $tableName,
                            'duration' => null,
                            'duration_minutes' => null,
                            'details' => $itemsSummary ?: 'مشروبات / طلب كافيه',
                            'items_summary' => $itemsSummary,
                            'payment_method' => $ord->payment_method ?? 'cash',
                            'payment_method_label' => $paymentLabels[$ord->payment_method ?? 'cash'] ?? 'أخرى',
                            'payment_status' => $ord->payment_status,
                            'is_cash' => $isCash,
                            'total_amount' => $total,
                            'amount_in' => $isPaid ? $total : 0.0,
                            'amount_out' => 0.0,
                            'net_amount' => $isPaid ? $total : 0.0,
                            'staff_name' => $ord->staff?->name ?? 'كاشير الكافيه',
                            'receipt_id' => $ord->order_number,
                        ]);
                    }
                } catch (\Throwable $e) {
                    \Log::warning('Error loading orders in statement: ' . $e->getMessage());
                }
            }

            // 3. Expenses (مسحوبات ومصروفات الخزنة والدرج)
            if (in_array($typeFilter, ['all', 'expense', 'cash'])) {
                try {
                    if (Schema::hasTable('expenses')) {
                        $expensesQuery = Expense::with('staff')
                            ->where(function ($q) use ($startDate, $endDate, $queryStartDate, $queryEndDate) {
                                $q->whereBetween('created_at', [$queryStartDate, $queryEndDate])
                                  ->orWhereBetween('expense_date', [$startDate->toDateString(), $endDate->toDateString()]);
                            });

                        if ($paymentFilter !== 'all') {
                            $expensesQuery->where('payment_method', $paymentFilter);
                        }

                        $expenses = $expensesQuery->get();

                        foreach ($expenses as $exp) {
                            $amount = (float)$exp->amount;
                            $isCash = ($exp->payment_method ?? 'cash') === 'cash';
                            $expDate = $exp->created_at ? Carbon::parse($exp->created_at) : ($exp->expense_date ? Carbon::parse($exp->expense_date) : Carbon::now());

                            $transactions->push([
                                'id' => 'expense-' . $exp->id,
                                'raw_date' => $expDate->toISOString(),
                                'date' => $expDate->format('Y-m-d'),
                                'time' => $expDate->format('h:i A'),
                                'date_time' => $expDate->format('Y-m-d h:i A'),
                                'type' => 'expense',
                                'type_label' => 'مصروف درج',
                                'title' => 'مصروف: ' . $exp->description,
                                'customer_name' => null,
                                'customer_phone' => null,
                                'device_name' => null,
                                'device_or_table' => null,
                                'duration' => null,
                                'duration_minutes' => null,
                                'details' => 'بند: ' . $exp->category . ($exp->notes ? (' • ' . $exp->notes) : ''),
                                'items_summary' => null,
                                'payment_method' => $exp->payment_method ?? 'cash',
                                'payment_method_label' => $paymentLabels[$exp->payment_method ?? 'cash'] ?? 'أخرى',
                                'payment_status' => 'paid',
                                'is_cash' => $isCash,
                                'total_amount' => $amount,
                                'amount_in' => 0.0,
                                'amount_out' => $amount,
                                'net_amount' => -$amount,
                                'staff_name' => $exp->staff?->name ?? 'مسؤول الصالة',
                                'receipt_id' => 'EXP-' . $exp->id,
                            ]);
                        }
                    }
                } catch (\Throwable $e) {
                    \Log::warning('Error loading expenses in statement: ' . $e->getMessage());
                }
            }

            // 4. Debt Collections (سداد حسابات الآجل)
            if (in_array($typeFilter, ['all', 'debt_payment', 'cash'])) {
                try {
                    if (Schema::hasTable('customer_debt_payments')) {
                        $debtPaymentsQuery = CustomerDebtPayment::with(['debt.customer', 'staff'])
                            ->whereBetween('created_at', [$queryStartDate, $queryEndDate]);

                        if ($paymentFilter !== 'all') {
                            $debtPaymentsQuery->where('payment_method', $paymentFilter);
                        }

                        $debtPayments = $debtPaymentsQuery->get();

                        foreach ($debtPayments as $dp) {
                            $amount = (float)$dp->amount;
                            $isCash = ($dp->payment_method ?? 'cash') === 'cash';
                            $cust = $dp->debt?->customer;
                            $dpDate = $dp->created_at ? Carbon::parse($dp->created_at) : Carbon::now();

                            $transactions->push([
                                'id' => 'debt-' . $dp->id,
                                'raw_date' => $dpDate->toISOString(),
                                'date' => $dpDate->format('Y-m-d'),
                                'time' => $dpDate->format('h:i A'),
                                'date_time' => $dpDate->format('Y-m-d h:i A'),
                                'type' => 'debt_payment',
                                'type_label' => 'تحصيل دين',
                                'title' => 'تحصيل آجل • ' . ($cust?->name ?: 'عميل'),
                                'customer_name' => $cust?->name,
                                'customer_phone' => $cust?->phone,
                                'device_name' => null,
                                'device_or_table' => null,
                                'duration' => null,
                                'duration_minutes' => null,
                                'details' => 'سداد جزء/كامل مديونية سابقة' . ($dp->notes ? (' • ' . $dp->notes) : ''),
                                'items_summary' => null,
                                'payment_method' => $dp->payment_method ?? 'cash',
                                'payment_method_label' => $paymentLabels[$dp->payment_method ?? 'cash'] ?? 'أخرى',
                                'payment_status' => 'paid',
                                'is_cash' => $isCash,
                                'total_amount' => $amount,
                                'amount_in' => $amount,
                                'amount_out' => 0.0,
                                'net_amount' => $amount,
                                'staff_name' => $dp->staff?->name ?? 'كاشير الصالة',
                                'receipt_id' => 'DEBT-' . $dp->id,
                            ]);
                        }
                    }
                } catch (\Throwable $e) {
                    \Log::warning('Error loading debt collections in statement: ' . $e->getMessage());
                }
            }

            // Filter by cash only if requested
            if ($typeFilter === 'cash') {
                $transactions = $transactions->filter(fn($t) => $t['is_cash']);
            }

            // Filter by search query if provided
            if ($search !== '') {
                $sLower = mb_strtolower($search);
                $transactions = $transactions->filter(function ($t) use ($sLower) {
                    return str_contains(mb_strtolower($t['title'] ?? ''), $sLower) ||
                           str_contains(mb_strtolower($t['customer_name'] ?? ''), $sLower) ||
                           str_contains(mb_strtolower($t['device_name'] ?? ''), $sLower) ||
                           str_contains(mb_strtolower($t['details'] ?? ''), $sLower) ||
                           str_contains(mb_strtolower($t['receipt_id'] ?? ''), $sLower);
                });
            }

            // Sort chronologically descending
            $transactions = $transactions->sortByDesc('raw_date')->values();

            // Calculate summary
            $totalIn = (float)$transactions->sum('amount_in');
            $totalOut = (float)$transactions->sum('amount_out');
            $cashIn = (float)$transactions->where('is_cash', true)->sum('amount_in');
            $cashOut = (float)$transactions->where('is_cash', true)->sum('amount_out');
            $cashDrawerNet = max(0, $cashIn - $cashOut);

            $gamingRevenue = (float)$transactions->where('type', 'gaming')->sum('amount_in');
            $cafeRevenue = (float)$transactions->where('type', 'cafe')->sum('amount_in');
            $debtCollected = (float)$transactions->where('type', 'debt_payment')->sum('amount_in');

            return response()->json([
                'period' => [
                    'type' => $periodType,
                    'label' => $periodLabel,
                    'start_date' => $startDate->toDateString(),
                    'end_date' => $endDate->toDateString(),
                ],
                'summary' => [
                    'total_income' => round($totalIn, 2),
                    'total_expenses' => round($totalOut, 2),
                    'net_income' => round($totalIn - $totalOut, 2),
                    'net_flow' => round($totalIn - $totalOut, 2),
                    'net_cash' => round($cashIn - $cashOut, 2),
                    'cash_drawer_net' => round($cashIn - $cashOut, 2),
                    'cash_in' => round($cashIn, 2),
                    'cash_out' => round($cashOut, 2),
                    'gaming_income' => round($gamingRevenue, 2),
                    'gaming_revenue' => round($gamingRevenue, 2),
                    'cafe_income' => round($cafeRevenue, 2),
                    'cafe_revenue' => round($cafeRevenue, 2),
                    'debt_collected' => round($debtCollected, 2),
                    'transactions_count' => $transactions->count(),
                ],
                'transactions' => $transactions,
            ]);
        } catch (\Throwable $e) {
            \Log::error('ReportController statement fatal error: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'period' => [
                    'type' => 'day',
                    'label' => 'اليوم ' . date('Y-m-d'),
                    'start_date' => date('Y-m-d'),
                    'end_date' => date('Y-m-d'),
                ],
                'summary' => [
                    'total_income' => 0,
                    'total_expenses' => 0,
                    'net_income' => 0,
                    'net_flow' => 0,
                    'net_cash' => 0,
                    'cash_drawer_net' => 0,
                    'cash_in' => 0,
                    'cash_out' => 0,
                    'gaming_income' => 0,
                    'gaming_revenue' => 0,
                    'cafe_income' => 0,
                    'cafe_revenue' => 0,
                    'debt_collected' => 0,
                    'transactions_count' => 0,
                ],
                'transactions' => [],
            ], 200);
        }
    }
}
