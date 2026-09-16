<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Shift;
use Illuminate\Http\Request;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $days = max(1, min((int)$request->input('days', 30), 365));
        $expenses = Expense::with('staff')->where('expense_date', '>=', now()->subDays($days - 1)->toDateString())->latest('expense_date')->latest()->get();
        return response()->json(['expenses' => $expenses, 'total' => (float)$expenses->sum('amount')]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category' => 'required|string|max:100',
            'description' => 'required|string|max:255',
            'amount' => 'required|numeric|min:0',
            'payment_method' => 'required|in:cash,visa,wallet,instapay,bank_transfer,other',
            'expense_date' => 'required|date',
            'notes' => 'nullable|string',
        ]);
        $shift = Shift::where('status', 'active')->latest()->first();
        $expense = Expense::create($validated + [
            'shift_id' => $shift?->id,
            'staff_id' => $request->user()?->id ?? $shift?->staff_id,
        ]);
        return response()->json(['message' => 'Expense saved successfully', 'expense' => $expense->load('staff')], 201);
    }

    public function destroy($id)
    {
        Expense::findOrFail($id)->delete();
        return response()->json(['message' => 'Expense deleted successfully']);
    }
}
