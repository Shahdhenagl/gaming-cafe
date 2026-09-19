<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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

class OrderController extends Controller
{
    /**
     * List orders.
     */
    public function index(Request $request)
    {
        $query = Order::with(['items.product', 'table', 'deviceSession.device', 'staff'])
            ->latest();

        if ($request->filled('shift_id')) {
            $query->where('shift_id', $request->shift_id);
        }

        if ($request->filled('order_type')) {
            $query->where('order_type', $request->order_type);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $orders = $query->paginate($request->input('per_page', 25));

        return response()->json($orders);
    }

    /**
     * Create a new POS order (Takeaway, Dine-in Table, or Gaming Room).
     */
    public function store(Request $request)
    {
        $request->validate([
            'order_type' => 'required|in:take_away,dine_in,gaming_room',
            'table_id' => 'nullable|required_if:order_type,dine_in|exists:tables,id',
            'device_session_id' => 'nullable|required_if:order_type,gaming_room|exists:device_sessions,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string',
            'discount' => 'nullable|numeric|min:0',
            'tax' => 'nullable|numeric|min:0',
            'payment_method' => 'nullable|in:cash,visa,wallet,instapay,installment,other',
            'payment_status' => 'nullable|in:unpaid,paid',
            'notes' => 'nullable|string',
        ]);

        $shift = Shift::where('status', 'active')->latest()->first();

        $order = DB::transaction(function () use ($request, $shift) {
            $subtotal = 0.00;
            $itemsData = [];

            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (int)$item['quantity'];
                $itemSubtotal = round($product->price * $qty, 2);
                $subtotal += $itemSubtotal;

                $itemsData[] = [
                    'product' => $product,
                    'quantity' => $qty,
                    'unit_price' => $product->price,
                    'subtotal' => $itemSubtotal,
                    'notes' => $item['notes'] ?? null,
                ];

                // Decrement stock & create log
                $product->decrement('stock_quantity', $qty);
                InventoryLog::create([
                    'product_id' => $product->id,
                    'quantity_change' => -$qty,
                    'reason' => 'sale',
                    'staff_id' => $request->user() ? $request->user()->id : null,
                ]);
            }

            $discount = (float)($request->discount ?? 0.00);
            // Tax is disabled for AL5AL pricing; product prices are final.
            $tax = 0.00;
            $totalAmount = max(0, $subtotal - $discount);

            $paymentStatus = $request->order_type === 'take_away' ? 'paid' : ($request->payment_status ?? 'unpaid');
            $paymentMethod = $request->payment_method ?? 'cash';

            $order = Order::create([
                'order_number' => 'ORD-' . strtoupper(bin2hex(random_bytes(3))),
                'shift_id' => $shift ? $shift->id : null,
                'staff_id' => $request->user() ? $request->user()->id : null,
                'status' => 'completed',
                'order_type' => $request->order_type,
                'table_id' => $request->table_id,
                'device_session_id' => $request->device_session_id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'total_amount' => $totalAmount,
                'payment_method' => $paymentMethod,
                'payment_status' => $paymentStatus,
                'notes' => $request->notes,
            ]);

            foreach ($itemsData as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product']['id'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'cost_price' => $item['product']['cost_price'] ?? 0,
                    'subtotal' => $item['subtotal'],
                    'notes' => $item['notes'],
                ]);
            }

            // If dine-in table, mark table occupied and update total
            if ($request->order_type === 'dine_in' && $request->table_id) {
                $table = Table::find($request->table_id);
                if ($table) {
                    $table->update([
                        'status' => 'occupied',
                        'current_order_id' => $order->id,
                        'total_spent' => $table->total_spent + $totalAmount,
                    ]);
                }
            }

            // If gaming room, update session beverage cost
            if ($request->order_type === 'gaming_room' && $request->device_session_id) {
                $session = DeviceSession::find($request->device_session_id);
                if ($session) {
                    $newBeverageCost = $session->beverage_cost + $totalAmount;
                    $newTotal = $session->session_cost + $newBeverageCost - $session->discount;
                    $session->update([
                        'beverage_cost' => $newBeverageCost,
                        'total_amount' => $newTotal,
                    ]);
                }
            }

            // Record payment if marked paid
            if ($paymentStatus === 'paid') {
                Payment::create([
                    'order_id' => $order->id,
                    'amount' => $totalAmount,
                    'payment_method' => $paymentMethod,
                    'status' => 'confirmed',
                ]);
            }

            return $order;
        });

        return response()->json([
            'message' => 'Order created successfully',
            'order' => $order->load(['items.product', 'table', 'deviceSession.device']),
        ], 201);
    }

    /**
     * Process order payment.
     */
    public function processPayment(Request $request, $id)
    {
        $order = Order::with('table')->findOrFail($id);

        $request->validate([
            'payment_method' => 'required|in:cash,visa,wallet,instapay,installment,other',
            'amount' => 'nullable|numeric|min:0',
        ]);

        $amount = $request->amount ?? $order->total_amount;

        DB::transaction(function () use ($order, $request, $amount) {
            $order->update([
                'payment_status' => 'paid',
                'payment_method' => $request->payment_method,
            ]);

            Payment::create([
                'order_id' => $order->id,
                'amount' => $amount,
                'payment_method' => $request->payment_method,
                'status' => 'confirmed',
            ]);

            // If dine-in, free table
            if ($order->table) {
                $order->table->update([
                    'status' => 'available',
                    'current_order_id' => null,
                    'total_spent' => 0.00,
                ]);
            }
        });

        return response()->json([
            'message' => 'Payment processed successfully',
            'order' => $order->fresh(['items.product', 'table']),
        ]);
    }

    /**
     * Get thermal receipt printable data.
     */
    public function receipt($id)
    {
        $order = Order::with(['items.product', 'table', 'deviceSession.device', 'staff'])->findOrFail($id);

        return response()->json([
            'receipt' => [
                'business_name' => 'AL5AL Gaming & Billiards Lounge',
                'business_name_ar' => 'صالة الخال للألعاب والبلياردو والكافيه',
                'tagline' => 'Billiards • PlayStation • Ping Pong • Cafe',
                'slogan' => 'Enjoy The Game - استمتع بأفضل تجربة لعب وتحدي',
                'phones' => '01032890430 (Karim) / 01289535503 (Al-Ghareeb) / 0502943796',
                'order_number' => $order->order_number,
                'date_time' => $order->created_at->format('Y-m-d H:i:s'),
                'staff_name' => $order->staff ? $order->staff->name : 'Cashier',
                'order_type' => $order->order_type,
                'table_number' => $order->table ? $order->table->table_number : null,
                'device_name' => $order->deviceSession && $order->deviceSession->device ? $order->deviceSession->device->device_name : null,
                'items' => $order->items->map(function ($item) {
                    return [
                        'name' => $item->product->name,
                        'name_ar' => $item->product->name_ar,
                        'quantity' => $item->quantity,
                        'unit_price' => (float)$item->unit_price,
                        'subtotal' => (float)$item->subtotal,
                    ];
                }),
                'subtotal' => (float)$order->subtotal,
                'discount' => (float)$order->discount,
                'tax' => (float)$order->tax,
                'total_amount' => (float)$order->total_amount,
                'payment_method' => $order->payment_method,
                'payment_status' => $order->payment_status,
                'notes' => $order->notes,
                'footer_note' => 'Thank you for playing and drinking with us! Game On!',
                'footer_note_ar' => 'شكراً لزيارتكم ونتمنى لكم وقتاً ممتعاً!',
            ]
        ]);
    }
}
