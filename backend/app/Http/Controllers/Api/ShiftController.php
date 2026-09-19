<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceSession;
use App\Models\Expense;
use App\Models\Order;
use App\Models\Shift;
use App\Models\ShiftReport;
use App\Models\Payment;
use App\Models\TreasuryEntry;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
    /**
     * Get active shift or latest shift details.
     */
    public function current(Request $request)
    {
        $user = $request->user();
        $staffId = $user ? $user->id : null;

        try {
            $query = Shift::with('staff');
            if ($staffId) {
                $shift = $query->where('staff_id', $staffId)->where('status', 'active')->first();
            } else {
                $shift = $query->where('status', 'active')->latest()->first();
            }
        } catch (\Throwable $e) {
            report($e);
            return response()->json(['active' => false, 'shift' => null, 'metrics' => null, 'degraded' => true]);
        }

        if (!$shift) {
            return response()->json([
                'active' => false,
                'shift' => null,
                'metrics' => [
                    'elapsed_time_formatted' => '00:00:00',
                    'elapsed_minutes' => 0,
                    'total_orders' => 0,
                    'total_sessions' => 0,
                    'active_sessions_count' => 0,
                    'total_beverages_sold' => 0,
                    'total_revenue' => 0,
                    'cash_collected' => 0,
                    'cash_revenue' => 0,
                    'cash_expenses' => 0,
                    'expenses_total' => 0,
                    'gaming_revenue' => 0,
                    'gaming_profit' => 0,
                    'beverage_revenue' => 0,
                    'beverage_cost' => 0,
                    'beverage_profit' => 0,
                    'net_profit' => 0,
                    'card_collected' => 0,
                    'average_order_value' => 0,
                ],
            ]);
        }

        try {
        // Aggregate shift metrics dynamically
        $orders = Order::with('items')->where('shift_id', $shift->id)->where('status', '!=', 'cancelled')->get();
        $sessions = DeviceSession::where('shift_id', $shift->id)->get();
        $expenses = Expense::where('shift_id', $shift->id)->get();

        $totalOrderRevenue = $orders->sum('total_amount');
        $totalSessionRevenue = $sessions->sum(fn ($session) => $this->sessionRevenue($session));
        $totalRevenue = $totalOrderRevenue + $totalSessionRevenue;
        $beverageCost = (float) $orders->sum(fn ($order) => $order->items->sum(fn ($item) => $item->quantity * (float) $item->cost_price));
        $beverageProfit = (float) $totalOrderRevenue - $beverageCost;
        $gamingProfit = (float) $totalSessionRevenue;

        $cashRevenue = $orders->where('payment_method', 'cash')->sum('total_amount')
            + $sessions->where('payment_method', 'cash')->sum(fn ($session) => $this->sessionRevenue($session));
        $cashExpenses = $expenses->where('payment_method', 'cash')->sum('amount');
        $cashTotal = max(0, $cashRevenue - $cashExpenses);

        $cardTotal = $orders->where('payment_method', 'visa')->sum('total_amount')
            + $sessions->where('payment_method', 'visa')->sum(fn ($session) => $this->sessionRevenue($session));

        $totalBeveragesCount = $orders->sum(fn ($order) => $order->items->sum('quantity'));

        $now = Carbon::now();
        $startTime = Carbon::parse($shift->start_time);
        $elapsedSeconds = max(0, (int) $startTime->diffInSeconds($now));
        $elapsedMinutes = (int) floor($elapsedSeconds / 60);
        $elapsedHours = floor($elapsedSeconds / 3600);
        $elapsedRemMinutes = floor(($elapsedSeconds % 3600) / 60);
        $elapsedRemSeconds = $elapsedSeconds % 60;

        return response()->json([
            'active' => $shift->status === 'active',
            'shift' => $shift,
            'metrics' => [
                'elapsed_time_formatted' => sprintf('%02d:%02d:%02d', $elapsedHours, $elapsedRemMinutes, $elapsedRemSeconds),
                'elapsed_minutes' => $elapsedMinutes,
                'total_orders' => $orders->count(),
                'total_sessions' => $sessions->count(),
                'active_sessions_count' => $sessions->where('status', 'active')->count(),
                'total_beverages_sold' => $totalBeveragesCount,
                'total_revenue' => round($totalRevenue, 2),
                'cash_collected' => round($cashTotal, 2),
                'cash_revenue' => round($cashRevenue, 2),
                'cash_expenses' => round($cashExpenses, 2),
                'expenses_total' => round($expenses->sum('amount'), 2),
                'gaming_revenue' => round($totalSessionRevenue, 2),
                'gaming_profit' => round($gamingProfit, 2),
                'beverage_revenue' => round($totalOrderRevenue, 2),
                'beverage_cost' => round($beverageCost, 2),
                'beverage_profit' => round($beverageProfit, 2),
                'net_profit' => round($gamingProfit + $beverageProfit - $expenses->sum('amount'), 2),
                'card_collected' => round($cardTotal, 2),
                'average_order_value' => $orders->count() > 0 ? round($totalOrderRevenue / $orders->count(), 2) : 0.00,
            ]
        ]);
        } catch (\Throwable $e) {
            report($e);
            $elapsedSeconds = max(0, (int) Carbon::parse($shift->start_time)->diffInSeconds(Carbon::now()));
            return response()->json([
                'active' => $shift->status === 'active',
                'shift' => $shift,
                'metrics' => [
                    'elapsed_time_formatted' => sprintf('%02d:%02d:%02d', floor($elapsedSeconds / 3600), floor(($elapsedSeconds % 3600) / 60), $elapsedSeconds % 60),
                    'elapsed_minutes' => (int) floor($elapsedSeconds / 60),
                    'total_orders' => 0, 'total_sessions' => 0, 'active_sessions_count' => 0,
                    'total_beverages_sold' => 0, 'total_revenue' => 0, 'cash_collected' => 0,
                    'card_collected' => 0, 'average_order_value' => 0,
                ],
                'degraded' => true,
            ]);
        }
    }

    /**
     * Start a new shift.
     */
    public function start(Request $request)
    {
        $request->validate([
            'staff_id' => 'nullable|exists:users,id',
            'notes' => 'nullable|string',
        ]);

        $user = $request->user();
        $staffId = $request->staff_id ?? ($user ? $user->id : 3);

        // Close any active shifts for this staff
        Shift::where('staff_id', $staffId)->where('status', 'active')->update([
            'status' => 'closed',
            'end_time' => Carbon::now(),
        ]);

        $shift = Shift::create([
            'staff_id' => $staffId,
            'start_time' => Carbon::now(),
            'status' => 'active',
            'notes' => $request->notes ?? 'Shift opened at ' . Carbon::now()->format('H:i'),
        ]);

        User::where('id', $staffId)->update(['shift_id' => $shift->id]);

        return response()->json([
            'message' => 'Shift started successfully',
            'shift' => $shift->load('staff'),
        ], 201);
    }

    /**
     * Close an active shift.
     */
    public function close(Request $request, $id)
    {
        $shift = Shift::findOrFail($id);

        $request->validate([
            'cash_counted' => 'nullable|numeric|min:0',
            'deductions' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        // Load items once: calling items()->sum() inside a collection callback
        // creates an invalid/expensive query and can leave the close request hanging.
        $orders = Order::with('items')->where('shift_id', $shift->id)->where('status', '!=', 'cancelled')->get();
        $sessions = DeviceSession::where('shift_id', $shift->id)->get();
        $expenses = Expense::where('shift_id', $shift->id)->get();

        $totalGamingRevenue = $sessions->sum(fn ($session) => $this->sessionRevenue($session));
        $totalRevenue = $orders->sum('total_amount') + $totalGamingRevenue;
        $beverageCost = (float) $orders->sum(fn ($order) => $order->items->sum(fn ($item) => $item->quantity * (float) $item->cost_price));
        $netProfit = (float) $totalRevenue - $beverageCost - (float) $expenses->sum('amount');
        $cashRevenue = $orders->where('payment_method', 'cash')->sum('total_amount')
            + $sessions->where('payment_method', 'cash')->sum(fn ($session) => $this->sessionRevenue($session));
        $cashExpenses = $expenses->where('payment_method', 'cash')->sum('amount');
        $cashTotal = max(0, $cashRevenue - $cashExpenses);
        $cardTotal = $orders->where('payment_method', 'visa')->sum('total_amount')
            + $sessions->where('payment_method', 'visa')->sum(fn ($session) => $this->sessionRevenue($session));

        $deductions = $request->deductions ?? 0.00;
        $totalAfterDeductions = max(0, $totalRevenue - $deductions);

        $shift->update([
            'end_time' => Carbon::now(),
            'status' => 'closed',
            'total_before_deductions' => $totalRevenue,
            'total_after_deductions' => $totalAfterDeductions,
            'deductions' => $deductions,
            'cash_collected' => $request->cash_counted ?? $cashTotal,
            'card_collected' => $cardTotal,
            'notes' => $request->notes ?? $shift->notes,
        ]);

        User::where('shift_id', $shift->id)->update(['shift_id' => null]);

        // Generate Shift Report
        $totalBeveragesCount = 0;
        foreach ($orders as $order) {
            $totalBeveragesCount += $order->items->sum('quantity');
        }

        $report = ShiftReport::create([
            'shift_id' => $shift->id,
            'total_orders' => $orders->count(),
            'total_beverages_sold' => $totalBeveragesCount,
            'total_sessions' => $sessions->count(),
            'total_revenue' => $totalRevenue,
            'cash_transactions' => $cashTotal,
            'card_transactions' => $cardTotal,
        ]);

        // Post one dated closing entry per payment method into the main treasury.
        TreasuryEntry::where('shift_id', $shift->id)->where('entry_type', 'shift_closing')->delete();
        foreach (['cash', 'visa', 'wallet', 'instapay', 'installment', 'other'] as $method) {
            $income = Payment::where('status', 'confirmed')->where('payment_method', $method)
                ->where(function ($query) use ($shift) {
                    $query->whereHas('order', fn ($order) => $order->where('shift_id', $shift->id))
                        ->orWhereHas('deviceSession', fn ($session) => $session->where('shift_id', $shift->id));
                })->sum('amount');
            $outgoing = $expenses->where('payment_method', $method)->sum('amount');
            $amount = round((float) $income - (float) $outgoing, 2);
            if ($amount == 0.0) continue;
            TreasuryEntry::create([
                'shift_id' => $shift->id,
                'staff_id' => $shift->staff_id,
                'entry_type' => 'shift_closing',
                'payment_method' => $method,
                'amount' => $amount,
                'transaction_date' => $shift->end_time,
                'reference' => 'SHIFT-' . $shift->id,
                'notes' => 'ترحيل تقفيلة الشيفت إلى الخزنة الرئيسية',
            ]);
        }

        return response()->json([
            'message' => 'Shift closed successfully',
            'shift' => $shift->load('staff'),
            'report' => $report,
            'accounting' => [
                'revenue' => round($totalRevenue, 2),
                'gaming_profit' => round((float) $totalGamingRevenue, 2),
                'beverage_cost' => round($beverageCost, 2),
                'beverage_profit' => round((float) $orders->sum('total_amount') - $beverageCost, 2),
                'expenses_withdrawn' => round((float) $expenses->sum('amount'), 2),
                'net_profit' => round($netProfit, 2),
                'drawer_balance_after_close' => 0,
            ],
        ]);
    }

    /**
     * Shift History List.
     */
    public function history()
    {
        $shifts = Shift::with(['staff', 'report'])
            ->latest()
            ->take(30)
            ->get();

        return response()->json([
            'shifts' => $shifts,
        ]);
    }

    /**
     * Get detailed shift report for receipt/printing.
     */
    public function report($id)
    {
        $shift = Shift::with(['staff', 'report', 'orders.items.product', 'sessions.device'])->findOrFail($id);

        return response()->json([
            'shift' => $shift,
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
