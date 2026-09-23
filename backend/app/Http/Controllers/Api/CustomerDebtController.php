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
use Illuminate\Support\Facades\Schema;

class CustomerDebtController extends Controller
{
    protected function ensureArchivedColumnExists(): void
    {
        try {
            if (Schema::hasTable('customers') && !Schema::hasColumn('customers', 'is_archived')) {
                Schema::table('customers', function ($table) {
                    $table->boolean('is_archived')->default(false)->index();
                });
            }
        } catch (\Throwable $e) {
            // Silently continue if column exists
        }
    }

    public function index(Request $request)
    {
        $this->ensureArchivedColumnExists();

        $query = Customer::with(['debts' => fn ($q) => $q->latest()])->orderBy('name');

        $tab = $request->input('tab', 'active'); // 'active' | 'zero_debt' | 'archived' | 'all'
        $archivedParam = $request->input('archived');

        $isArchived = false;
        if ($archivedParam !== null) {
            $isArchived = filter_var($archivedParam, FILTER_VALIDATE_BOOLEAN);
        } elseif ($tab === 'archived') {
            $isArchived = true;
        }

        if (Schema::hasColumn('customers', 'is_archived')) {
            $query->where('is_archived', $isArchived);
        }

        if ($request->filled('search')) {
            $search = $request->string('search')->toString();
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%"));
        }

        $allQueried = $query->limit(500)->get()->map(function ($customer) {
            $customer->total_debt = round((float) $customer->debts->sum('amount'), 2);
            $customer->total_paid = round((float) $customer->debts->sum('paid_amount'), 2);
            $customer->remaining_debt = round(max(0, $customer->total_debt - $customer->total_paid), 2);
            $customer->is_archived = (bool)($customer->is_archived ?? false);
            return $customer;
        });

        // Filter based on tab if not in archived mode
        $customers = $allQueried;
        if (!$isArchived) {
            if ($tab === 'active' || $request->input('filter') === 'has_debt') {
                $customers = $allQueried->filter(fn($c) => $c->remaining_debt > 0)->values();
            } elseif ($tab === 'zero_debt' || $request->input('filter') === 'zero_debt') {
                $customers = $allQueried->filter(fn($c) => $c->remaining_debt <= 0)->values();
            }
        }

        // Summary counts for tabs
        $activeWithDebtCount = $allQueried->filter(fn($c) => !$c->is_archived && $c->remaining_debt > 0)->count();
        $activeZeroDebtCount = $allQueried->filter(fn($c) => !$c->is_archived && $c->remaining_debt <= 0)->count();
        $archivedCount = 0;
        if (Schema::hasColumn('customers', 'is_archived')) {
            $archivedCount = Customer::where('is_archived', true)->count();
        }

        return response()->json([
            'customers' => $customers,
            'summary' => [
                'total_remaining' => round((float)$customers->sum('remaining_debt'), 2),
                'active_with_debt_count' => $activeWithDebtCount,
                'active_zero_debt_count' => $activeZeroDebtCount,
                'archived_count' => $archivedCount,
            ]
        ]);
    }

    public function show($id)
    {
        return response()->json(['customer' => Customer::with(['debts.order.items.product', 'debts.deviceSession.device', 'debts.payments'])->findOrFail($id)]);
    }

    public function archive($id)
    {
        $this->ensureArchivedColumnExists();
        $customer = Customer::findOrFail($id);
        $customer->update(['is_archived' => true]);

        return response()->json([
            'message' => 'تم نقل العميل إلى الأرشيف بنجاح. يمكنك استعادته في أي وقت.',
            'customer' => $customer,
        ]);
    }

    public function restore($id)
    {
        $this->ensureArchivedColumnExists();
        $customer = Customer::findOrFail($id);
        $customer->update(['is_archived' => false]);

        return response()->json([
            'message' => 'تمت استعادة العميل من الأرشيف بنجاح.',
            'customer' => $customer,
        ]);
    }

    public function destroy($id)
    {
        $customer = Customer::with('debts')->findOrFail($id);
        $totalDebt = round((float) $customer->debts->sum('amount'), 2);
        $totalPaid = round((float) $customer->debts->sum('paid_amount'), 2);
        $remaining = round(max(0, $totalDebt - $totalPaid), 2);

        if ($remaining > 0) {
            return response()->json([
                'message' => "لا يمكن حذف العميل لوجود مديونية نشطة عليه قدرها {$remaining} ج.م. يمكنك أرشفته بدلاً من الحذف.",
            ], 422);
        }

        $customer->delete();

        return response()->json([
            'message' => 'تم حذف العميل نهائياً بنجاح.',
        ]);
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
