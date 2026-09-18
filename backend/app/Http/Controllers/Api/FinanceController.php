<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\TreasuryEntry;
use Illuminate\Http\Request;

class FinanceController extends Controller
{
    private array $methods = ['cash', 'visa', 'wallet', 'instapay', 'installment', 'other'];

    public function summary(Request $request)
    {
        $shiftId = $request->integer('shift_id') ?: null;
        $payments = $this->payments($shiftId)->get();
        $expensesQuery = Expense::query();
        if ($shiftId) $expensesQuery->where('shift_id', $shiftId);
        $expenses = $expensesQuery->latest()->limit(500)->get();

        $breakdown = [];
        foreach ($this->methods as $method) {
            $income = (float) $payments->where('payment_method', $method)->sum('amount');
            $outgoing = (float) $expenses->where('payment_method', $method)->sum('amount');
            $breakdown[$method] = [
                'income' => round($income, 2),
                'expenses' => round($outgoing, 2),
                'net' => round($income - $outgoing, 2),
                'count' => $payments->where('payment_method', $method)->count(),
            ];
        }

        $treasuryQuery = TreasuryEntry::query();
        if ($shiftId) $treasuryQuery->where('shift_id', $shiftId);
        $treasuryEntries = $treasuryQuery->latest('transaction_date')->limit(100)->get();

        return response()->json([
            'shift_id' => $shiftId,
            'payment_breakdown' => $breakdown,
            'total_income' => round((float) $payments->sum('amount'), 2),
            'total_expenses' => round((float) $expenses->sum('amount'), 2),
            'net_income' => round((float) $payments->sum('amount') - (float) $expenses->sum('amount'), 2),
            'transactions' => $this->formatTransactions($payments, $expenses),
            'treasury' => [
                'entries' => $treasuryEntries,
                'balance' => round((float) $treasuryEntries->sum('amount'), 2),
            ],
        ]);
    }

    public function transactions(Request $request)
    {
        $shiftId = $request->integer('shift_id') ?: null;
        return response()->json([
            'transactions' => $this->formatTransactions($this->payments($shiftId)->limit(500)->get(), collect()),
        ]);
    }

    private function payments(?int $shiftId)
    {
        $query = Payment::with(['order:id,order_number,shift_id', 'deviceSession:id,customer_name,shift_id'])
            ->where('status', 'confirmed')
            ->latest();
        if ($shiftId) {
            $query->where(function ($q) use ($shiftId) {
                $q->whereHas('order', fn ($order) => $order->where('shift_id', $shiftId))
                    ->orWhereHas('deviceSession', fn ($session) => $session->where('shift_id', $shiftId));
            });
        }
        return $query;
    }

    private function formatTransactions($payments, $expenses)
    {
        $income = $payments->map(fn ($payment) => [
            'id' => 'payment-' . $payment->id,
            'type' => 'income',
            'amount' => (float) $payment->amount,
            'payment_method' => $payment->payment_method,
            'date' => optional($payment->created_at)->toISOString(),
            'reference' => $payment->order?->order_number ?: ('SESSION-' . ($payment->device_session_id ?? '')),
            'status' => $payment->status,
        ]);
        $outgoing = $expenses->map(fn ($expense) => [
            'id' => 'expense-' . $expense->id,
            'type' => 'expense',
            'amount' => (float) $expense->amount,
            'payment_method' => $expense->payment_method,
            'date' => optional($expense->created_at)->toISOString(),
            'reference' => $expense->description,
            'status' => 'confirmed',
        ]);
        return $income->concat($outgoing)->sortByDesc('date')->values()->take(500)->all();
    }
}
