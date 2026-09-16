<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceSession;
use App\Models\Expense;
use App\Models\Order;
use App\Models\Shift;
use App\Models\ShiftReport;
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

        $query = Shift::with('staff');
        if ($staffId) {
            $shift = $query->where('staff_id', $staffId)->where('status', 'active')->first();
        } else {
            $shift = $query->where('status', 'active')->latest()->first();
        }

        if (!$shift) {
            $shift = Shift::with('staff')->latest()->first();
        }

        if (!$shift) {
            return response()->json([
                'active' => false,
                'shift' => null,
            ]);
        }

        // Aggregate shift metrics dynamically
        $orders = Order::where('shift_id', $shift->id)->where('status', '!=', 'cancelled')->get();
        $sessions = DeviceSession::where('shift_id', $shift->id)->get();
        $expenses = Expense::where('shift_id', $shift->id)->get();

        $totalOrderRevenue = $orders->sum('total_amount');
        $totalSessionRevenue = $sessions->sum('session_cost');
        $totalRevenue = $totalOrderRevenue + $totalSessionRevenue;

        $cashRevenue = $orders->where('payment_method', 'cash')->sum('total_amount')
            + $sessions->where('payment_method', 'cash')->sum('session_cost');
        $cashExpenses = $expenses->where('payment_method', 'cash')->sum('amount');
        $cashTotal = max(0, $cashRevenue - $cashExpenses);

        $cardTotal = $orders->where('payment_method', 'visa')->sum('total_amount')
            + $sessions->where('payment_method', 'visa')->sum('session_cost');

        $totalBeveragesCount = 0;
        foreach ($orders as $order) {
            $totalBeveragesCount += $order->items()->sum('quantity');
        }

        $now = Carbon::now();
        $startTime = Carbon::parse($shift->start_time);
        $elapsedMinutes = $startTime->diffInMinutes($now);
        $elapsedHours = floor($elapsedMinutes / 60);
        $elapsedRemMinutes = $elapsedMinutes % 60;

        return response()->json([
            'active' => $shift->status === 'active',
            'shift' => $shift,
            'metrics' => [
                'elapsed_time_formatted' => sprintf('%02d:%02d:00', $elapsedHours, $elapsedRemMinutes),
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
                'card_collected' => round($cardTotal, 2),
                'average_order_value' => $orders->count() > 0 ? round($totalOrderRevenue / $orders->count(), 2) : 0.00,
            ]
        ]);
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

        $orders = Order::where('shift_id', $shift->id)->where('status', '!=', 'cancelled')->get();
        $sessions = DeviceSession::where('shift_id', $shift->id)->get();
        $expenses = Expense::where('shift_id', $shift->id)->get();

        $totalRevenue = $orders->sum('total_amount') + $sessions->sum('session_cost');
        $cashRevenue = $orders->where('payment_method', 'cash')->sum('total_amount')
            + $sessions->where('payment_method', 'cash')->sum('session_cost');
        $cashExpenses = $expenses->where('payment_method', 'cash')->sum('amount');
        $cashTotal = max(0, $cashRevenue - $cashExpenses);
        $cardTotal = $orders->where('payment_method', 'visa')->sum('total_amount')
            + $sessions->where('payment_method', 'visa')->sum('session_cost');

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
            $totalBeveragesCount += $order->items()->sum('quantity');
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

        return response()->json([
            'message' => 'Shift closed successfully',
            'shift' => $shift->load('staff'),
            'report' => $report,
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
}
