<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\CustomerDebt;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Table;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TableController extends Controller
{
    /**
     * List all tables with active orders & status.
     */
    public function index()
    {
        $tables = Table::with(['currentOrder.items.product'])->get();

        $formatted = $tables->map(function ($t) {
            $order = $t->currentOrder;
            $elapsedSeconds = 0;
            if ($order) {
                $elapsedSeconds = Carbon::parse($t->occupied_at ?: $order->created_at)->diffInSeconds(Carbon::now());
            } elseif ($t->occupied_at) {
                $elapsedSeconds = Carbon::parse($t->occupied_at)->diffInSeconds(Carbon::now());
            }

            return [
                'id' => $t->id,
                'table_number' => $t->table_number,
                'capacity' => $t->capacity,
                'status' => $t->status,
                'current_order_id' => $t->current_order_id,
                'total_spent' => (float)$t->total_spent,
                'occupied_at' => $t->occupied_at?->toISOString(),
                'elapsed_seconds' => max(0, $elapsedSeconds),
                'elapsed_minutes' => (int)floor(max(0, $elapsedSeconds) / 60),
                'order' => $order ? [
                    'id' => $order->id,
                    'order_number' => $order->order_number,
                    'created_at' => $order->created_at->format('H:i'),
                    'subtotal' => (float)$order->subtotal,
                    'discount' => (float)$order->discount,
                    'total_amount' => (float)$order->total_amount,
                    'items_count' => $order->items->count(),
                    'items' => $order->items->map(function ($it) {
                        return [
                            'id' => $it->id,
                            'name' => $it->product->name,
                            'name_ar' => $it->product->name_ar,
                            'quantity' => $it->quantity,
                            'unit_price' => (float)$it->unit_price,
                            'subtotal' => (float)$it->subtotal,
                        ];
                    }),
                ] : null,
            ];
        });

        return response()->json([
            'tables' => $formatted,
            'summary' => [
                'total_tables' => $tables->count(),
                'occupied_tables' => $tables->where('status', 'occupied')->count(),
                'available_tables' => $tables->where('status', 'available')->count(),
            ]
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate(['table_number' => 'required|string|max:50|unique:tables,table_number', 'capacity' => 'nullable|integer|min:1|max:50']);
        $table = Table::create(['table_number' => $data['table_number'], 'capacity' => $data['capacity'] ?? 4, 'status' => 'available', 'total_spent' => 0]);
        return response()->json(['table' => $table], 201);
    }

    public function update(Request $request, $id)
    {
        $table = Table::findOrFail($id);
        $data = $request->validate(['table_number' => 'sometimes|required|string|max:50|unique:tables,table_number,' . $table->id, 'capacity' => 'sometimes|required|integer|min:1|max:50']);
        $table->update($data);
        return response()->json(['table' => $table->fresh()]);
    }

    public function destroy($id)
    {
        $table = Table::findOrFail($id);
        if ($table->status === 'occupied' || $table->current_order_id) return response()->json(['message' => 'لا يمكن حذف طاولة مشغولة'], 422);
        $table->delete();
        return response()->json(['message' => 'تم حذف الطاولة']);
    }

    /**
     * Show single table details.
     */
    public function show($id)
    {
        $table = Table::with(['currentOrder.items.product', 'orders.items.product'])->findOrFail($id);
        return response()->json(['table' => $table]);
    }

    /**
     * Mark table as occupied.
     */
    public function occupy(Request $request, $id)
    {
        $table = Table::findOrFail($id);
        $table->update(['status' => 'occupied', 'occupied_at' => Carbon::now()]);

        return response()->json([
            'message' => 'Table marked as occupied',
            'table' => $table,
        ]);
    }

    /**
     * Move table bill and customer to an active gaming room session!
     * Releases the table back to "available" immediately.
     */
    public function moveToGaming(Request $request, $id)
    {
        $table = Table::with('currentOrder')->findOrFail($id);

        if (!$table->currentOrder) {
            return response()->json([
                'message' => 'This table has no active order to move.',
            ], 422);
        }

        $request->validate([
            'device_session_id' => 'required|exists:device_sessions,id',
        ]);

        $session = DeviceSession::with('device')->findOrFail($request->device_session_id);

        if ($session->status !== 'active') {
            return response()->json([
                'message' => 'Selected gaming session is not active.',
            ], 422);
        }

        DB::transaction(function () use ($table, $session) {
            $order = $table->currentOrder;

            // Re-link order to the gaming session
            $order->update([
                'order_type' => 'gaming_room',
                'device_session_id' => $session->id,
                'table_id' => null,
            ]);

            // Add order amount to the session's beverage total
            $newBeverageCost = $session->beverage_cost + $order->total_amount;
            $newTotal = $session->session_cost + $newBeverageCost - $session->discount;

            $session->update([
                'beverage_cost' => $newBeverageCost,
                'total_amount' => $newTotal,
            ]);

            // Release table!
            $table->update([
                'status' => 'available',
                'occupied_at' => null,
                'current_order_id' => null,
                'total_spent' => 0.00,
            ]);
        });

        return response()->json([
            'message' => "Table order transferred successfully to {$session->device->device_name}. Table is now available.",
            'table' => $table->fresh(),
            'session' => $session->fresh(['orders.items.product', 'device']),
        ]);
    }

    /**
     * Add beverage / snack items directly to the table's open tab.
     */
    public function addItems(Request $request, $id)
    {
        $table = Table::with('currentOrder.items')->findOrFail($id);

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string',
        ]);

        $shift = Shift::where('status', 'active')->latest()->first();

        $result = DB::transaction(function () use ($table, $shift, $request) {
            $totalAddedPrice = 0.0;

            // Check if table currently has an unpaid open order
            $order = $table->currentOrder;
            if (!$order || $order->payment_status === 'paid' || $order->status === 'cancelled') {
                $order = Order::create([
                    'order_number' => 'ORD-T' . strtoupper(bin2hex(random_bytes(2))),
                    'shift_id' => $shift ? $shift->id : null,
                    'staff_id' => $request->user() ? $request->user()->id : null,
                    'status' => 'completed',
                    'order_type' => 'dine_in',
                    'table_id' => $table->id,
                    'subtotal' => 0,
                    'total_amount' => 0,
                    'payment_status' => 'unpaid',
                    'payment_method' => 'cash',
                ]);
            }

            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (int)$item['quantity'];
                $subtotal = round($product->price * $qty, 2);
                $totalAddedPrice += $subtotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'unit_price' => $product->price,
                    'cost_price' => $product->cost_price ?? 0,
                    'subtotal' => $subtotal,
                    'notes' => $item['notes'] ?? null,
                ]);

                // Deduct stock & log
                $product->decrement('stock_quantity', $qty);
                InventoryLog::create([
                    'product_id' => $product->id,
                    'quantity_change' => -$qty,
                    'reason' => 'sale',
                    'staff_id' => $request->user() ? $request->user()->id : null,
                ]);
            }

            $newSubtotal = (float)$order->subtotal + $totalAddedPrice;
            $newTotal = max(0, $newSubtotal - (float)$order->discount);

            $order->update([
                'subtotal' => $newSubtotal,
                'total_amount' => $newTotal,
            ]);

            $table->update([
                'status' => 'occupied',
                'occupied_at' => $table->occupied_at ?: Carbon::now(),
                'current_order_id' => $order->id,
                'total_spent' => $newTotal,
            ]);

            return ['order' => $order, 'table' => $table];
        });

        return response()->json([
            'message' => 'تمت إضافة الأصناف إلى حساب الطاولة بنجاح',
            'table' => $table->fresh(['currentOrder.items.product']),
            'order' => $result['order']->load('items.product'),
        ]);
    }

    /**
     * Release table / Settle payment and print thermal receipt.
     */
    public function release(Request $request, $id)
    {
        $table = Table::with(['currentOrder.items.product'])->findOrFail($id);

        $request->validate([
            'payment_method' => 'nullable|in:cash,visa,wallet,instapay,installment,credit,other',
            'discount' => 'nullable|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
            'customer_name' => 'required_if:payment_method,credit|string|max:255',
            'customer_phone' => 'required_if:payment_method,credit|string|max:40',
        ]);

        $paymentMethod = $request->input('payment_method', 'cash');
        $shift = Shift::where('status', 'active')->latest()->first();

        $order = $table->currentOrder;
        $subtotal = $order ? (float)$order->subtotal : (float)$table->total_spent;
        $discount = $request->filled('discount') ? (float)$request->discount : ($order ? (float)$order->discount : 0);
        $finalTotal = max(0, $subtotal - $discount);
        $amountPaid = $request->filled('amount_paid') ? (float)$request->amount_paid : $finalTotal;

        DB::transaction(function () use ($table, $order, $shift, $paymentMethod, $discount, $finalTotal, $amountPaid, $request) {
            $customer = $paymentMethod === 'credit'
                ? Customer::updateOrCreate(['phone' => $request->customer_phone], ['name' => $request->customer_name, 'is_archived' => false])
                : null;

            if ($order) {
                $order->update([
                    'discount' => $discount,
                    'total_amount' => $finalTotal,
                    'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                    'payment_method' => $paymentMethod,
                    'status' => 'completed',
                    ...($customer ? ['customer_id' => $customer->id] : []),
                ]);

                if ($paymentMethod === 'credit' && $customer) {
                    CustomerDebt::create([
                        'customer_id' => $customer->id,
                        'order_id' => $order->id,
                        'shift_id' => $shift?->id,
                        'amount' => $finalTotal,
                        'paid_amount' => 0,
                        'status' => 'open',
                        'description' => 'حساب طاولة ' . $table->table_number,
                    ]);
                } else if ($finalTotal > 0) {
                    Payment::create([
                        'order_id' => $order->id,
                        'shift_id' => $shift?->id,
                        'amount' => $amountPaid,
                        'payment_method' => $paymentMethod,
                        'status' => 'confirmed',
                    ]);
                }
            }

            $table->update([
                'status' => 'available',
                'occupied_at' => null,
                'current_order_id' => null,
                'total_spent' => 0.00,
            ]);
        });

        $receiptItems = $order?->items?->map(fn ($item) => [
            'name' => $item->product?->name ?? 'صنف',
            'name_ar' => $item->product?->name_ar ?? $item->product?->name ?? 'صنف',
            'quantity' => (int)$item->quantity,
            'unit_price' => (float)$item->unit_price,
            'subtotal' => (float)$item->subtotal,
        ])->values()->all() ?? [];

        return response()->json([
            'message' => 'تم تسوية حساب الطاولة وإتاحتها بنجاح',
            'table' => $table->fresh(),
            'receipt' => [
                'business_name' => 'AL5AL Gaming & Billiards Lounge',
                'business_name_ar' => 'صالة الخال للألعاب والبلياردو والكافيه',
                'slogan' => 'Enjoy The Game - استمتع بأفضل تجربة لعب وتحدي',
                'phones' => '01032890430 (Karim) / 01289535503 (Al-Ghareeb) / 0502943796',
                'order_number' => $order?->order_number ?? ('TBL-' . $table->id),
                'date_time' => Carbon::now()->format('Y-m-d H:i'),
                'staff_name' => $request->user()?->name ?? 'كاشير الصالة',
                'order_type' => 'dine_in',
                'table_number' => $table->table_number,
                'subtotal' => (float)$subtotal,
                'discount' => (float)$discount,
                'tax' => 0,
                'total_amount' => (float)$finalTotal,
                'payment_method' => $paymentMethod,
                'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                'items' => $receiptItems,
                'footer_note' => 'Thank you for visiting AL5AL! Enjoy The Game',
                'footer_note_ar' => 'شكراً لزيارتكم صالة الخال! نتمنى لكم وقتاً ممتعاً',
            ],
        ]);
    }
}
