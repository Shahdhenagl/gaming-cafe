<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerDebt;
use App\Models\CustomerDebtPayment;
use App\Models\Payment;
use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerDebtController extends Controller
{
    public function index(Request $request)
    {
        $query = Customer::with(['debts' => fn ($q) => $q->latest()])->orderBy('name');
        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(fn ($q) => $q->where('name', 'ilike', "%{$search}%")->orWhere('phone', 'ilike', "%{$search}%"));
        }
        $customers = $query->limit(500)->get()->map(function ($customer) {
            $customer->total_debt = round((float) $customer->debts->sum('amount'), 2);
            $customer->total_paid = round((float) $customer->debts->sum('paid_amount'), 2);
            $customer->remaining_debt = round(max(0, $customer->total_debt - $customer->total_paid), 2);
            return $customer;
        });
        return response()->json(['customers' => $customers]);
    }

    public function show($id)
    {
        return response()->json(['customer' => Customer::with(['debts.order.items.product', 'debts.deviceSession.device', 'debts.payments'])->findOrFail($id)]);
    }

    public function pay(Request $request, $debtId)
    {
        $validated = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'payment_method' => 'required|in:cash,visa,wallet,instapay,bank_transfer,other',
            'notes' => 'nullable|string',
        ]);
        $debt = CustomerDebt::findOrFail($debtId);
        $remaining = max(0, (float) $debt->amount - (float) $debt->paid_amount);
        if ((float) $validated['amount'] > $remaining) {
            return response()->json(['message' => 'مبلغ السداد أكبر من المتبقي'], 422);
        }
        DB::transaction(function () use ($debt, $validated, $request) {
            $activeShift = Shift::where('status', 'active')->latest()->first();
            CustomerDebtPayment::create([
                'customer_debt_id' => $debt->id,
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'staff_id' => $request->user()?->id,
                'notes' => $validated['notes'] ?? null,
            ]);
            Payment::create([
                'order_id' => $debt->order_id,
                'device_session_id' => $debt->device_session_id,
                'shift_id' => $activeShift?->id,
                'amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'status' => 'confirmed',
            ]);
            $paid = (float) $debt->paid_amount + (float) $validated['amount'];
            $debt->update(['paid_amount' => $paid, 'status' => $paid >= (float) $debt->amount ? 'paid' : 'partial']);
        });
        return response()->json(['message' => 'تم تسجيل سداد الدين', 'debt' => $debt->fresh('customer')]);
    }
}
