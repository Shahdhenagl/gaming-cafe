<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\InventoryLog;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\SessionExtension;
use App\Models\Shift;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SessionController extends Controller
{
    /**
     * Start a new gaming session on a device.
     */
    public function start(Request $request, $deviceId)
    {
        try {
            return $this->startInternal($request, $deviceId);
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['message' => 'Could not start session: ' . $exception->getMessage()], 500);
        }
    }

    private function startInternal(Request $request, $deviceId)
    {
        $device = Device::findOrFail($deviceId);

        if ($device->status === 'active') {
            return response()->json([
                'message' => 'Device already has an active session.',
            ], 422);
        }

        $request->validate([
            'duration_minutes' => 'nullable|integer|min:15|max:720',
            'is_open_ended' => 'nullable|boolean',
            'customer_name' => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:20',
            'discount' => 'nullable|numeric|min:0',
        ]);

        $isOpenEnded = (bool)$request->boolean('is_open_ended');
        if (!$isOpenEnded && !$request->filled('duration_minutes')) {
            return response()->json(['message' => 'Choose a duration or select Open-ended mode.'], 422);
        }
        $duration = $isOpenEnded ? null : (int)$request->duration_minutes;
        $hourlyRate = (float)$device->hourly_rate;
        $sessionCost = $isOpenEnded ? 0 : round(($duration / 60) * $hourlyRate, 2);
        $discount = (float)($request->discount ?? 0.00);
        $totalAmount = max(0, $sessionCost - $discount);

        $now = Carbon::now();
        $endTime = $isOpenEnded ? null : (clone $now)->addMinutes($duration);

        // Fetch active shift
        $shift = Shift::where('status', 'active')->latest()->first();

        try {
            $session = DB::transaction(function () use ($device, $shift, $request, $now, $endTime, $duration, $isOpenEnded, $hourlyRate, $sessionCost, $discount, $totalAmount) {
            $session = DeviceSession::create([
                'device_id' => $device->id,
                'shift_id' => $shift ? $shift->id : null,
                'staff_id' => $request->user() ? $request->user()->id : ($shift ? $shift->staff_id : 3),
                'customer_name' => $request->customer_name ?? 'Guest Gamer',
                'customer_phone' => $request->customer_phone,
                'start_time' => $now,
                'end_time' => $endTime,
                'duration_minutes' => $duration,
                'is_open_ended' => $isOpenEnded,
                'status' => 'active',
                'hourly_rate' => $hourlyRate,
                'session_cost' => $sessionCost,
                'beverage_cost' => 0.00,
                'discount' => $discount,
                'total_amount' => $totalAmount,
                'paid_amount' => 0.00,
                'payment_status' => 'unpaid',
            ]);

            $device->update(['status' => 'active']);

                return $session;
            });
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['message' => 'Could not start session: ' . $exception->getMessage()], 500);
        }

        return response()->json([
            'message' => 'Gaming session started successfully',
            'session' => $session->load('device'),
        ], 201);
    }

    /**
     * Extend gaming session time.
     */
    public function extend(Request $request, $id)
    {
        $session = DeviceSession::with('device')->findOrFail($id);

        if ($session->status !== 'active') {
            return response()->json([
                'message' => 'Cannot extend an inactive session.',
            ], 422);
        }

        $request->validate([
            'added_minutes' => 'required|integer|min:5|max:360',
        ]);

        $addedMinutes = (int)$request->added_minutes;
        $hourlyRate = (float)$session->hourly_rate;
        $addedCost = round(($addedMinutes / 60) * $hourlyRate, 2);

        $currentEndTime = Carbon::parse($session->end_time);
        $baseTime = $currentEndTime->isPast() ? Carbon::now() : $currentEndTime;
        $newEndTime = (clone $baseTime)->addMinutes($addedMinutes);

        DB::transaction(function () use ($session, $addedMinutes, $addedCost, $newEndTime, $request) {
            $newDuration = $session->duration_minutes + $addedMinutes;
            $newSessionCost = $session->session_cost + $addedCost;
            $newTotal = $newSessionCost + $session->beverage_cost - $session->discount;

            $session->update([
                'duration_minutes' => $newDuration,
                'end_time' => $newEndTime,
                'session_cost' => $newSessionCost,
                'total_amount' => $newTotal,
            ]);

            SessionExtension::create([
                'session_id' => $session->id,
                'added_minutes' => $addedMinutes,
                'price' => $addedCost,
                'requested_at' => Carbon::now(),
                'applied_at' => Carbon::now(),
                'staff_id' => $request->user() ? $request->user()->id : null,
            ]);
        });

        return response()->json([
            'message' => "Session extended by {$addedMinutes} minutes",
            'session' => $session->fresh(['device', 'extensions']),
        ]);
    }

    /**
     * Add beverages / snacks directly to active session.
     */
    public function addBeverage(Request $request, $id)
    {
        $session = DeviceSession::with('device')->findOrFail($id);

        $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.notes' => 'nullable|string',
        ]);

        $shift = Shift::where('status', 'active')->latest()->first();

        $order = DB::transaction(function () use ($session, $shift, $request) {
            $totalBeveragePrice = 0;

            // Create Order linked to session
            $order = Order::create([
                'order_number' => 'ORD-G' . strtoupper(bin2hex(random_bytes(2))),
                'shift_id' => $shift ? $shift->id : null,
                'staff_id' => $request->user() ? $request->user()->id : null,
                'status' => 'completed',
                'order_type' => 'gaming_room',
                'device_session_id' => $session->id,
                'subtotal' => 0,
                'total_amount' => 0,
                'payment_status' => 'unpaid',
            ]);

            foreach ($request->items as $item) {
                $product = Product::findOrFail($item['product_id']);
                $qty = (int)$item['quantity'];
                $subtotal = round($product->price * $qty, 2);
                $totalBeveragePrice += $subtotal;

                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'quantity' => $qty,
                    'unit_price' => $product->price,
                    'cost_price' => $product->cost_price,
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

            $order->update([
                'subtotal' => $totalBeveragePrice,
                'total_amount' => $totalBeveragePrice,
            ]);

            // Update session beverage total
            $newBeverageCost = $session->beverage_cost + $totalBeveragePrice;
            $newTotal = $session->session_cost + $newBeverageCost - $session->discount;

            $session->update([
                'beverage_cost' => $newBeverageCost,
                'total_amount' => $newTotal,
            ]);

            return $order;
        });

        return response()->json([
            'message' => 'Items added to gaming session tab successfully',
            'session' => $session->fresh(['device', 'orders.items.product']),
            'order' => $order->load('items.product'),
        ]);
    }

    /**
     * End gaming session and settle payment.
     */
    public function end(Request $request, $id)
    {
        $session = DeviceSession::with(['device', 'orders.items.product'])->findOrFail($id);

        $request->validate([
            'payment_method' => 'required|in:cash,visa,wallet,instapay,installment,other',
            'discount' => 'nullable|numeric|min:0',
            'amount_paid' => 'nullable|numeric|min:0',
        ]);

        $paymentMethod = $request->payment_method;
        $discount = $request->filled('discount') ? (float)$request->discount : (float)$session->discount;
        $elapsedMinutes = $session->is_open_ended
            ? max(1, (int)ceil(Carbon::parse($session->start_time)->diffInSeconds(Carbon::now()) / 60))
            : $session->duration_minutes;
        $sessionCost = $session->is_open_ended
            ? round(($elapsedMinutes / 60) * (float)$session->hourly_rate, 2)
            : (float)$session->session_cost;
        $finalTotal = max(0, $sessionCost + $session->beverage_cost - $discount);
        $amountPaid = $request->filled('amount_paid') ? (float)$request->amount_paid : $finalTotal;

        DB::transaction(function () use ($session, $paymentMethod, $discount, $finalTotal, $amountPaid, $elapsedMinutes, $sessionCost) {
            $session->update([
                'status' => 'ended',
                'end_time' => Carbon::now(),
                'duration_minutes' => $elapsedMinutes,
                'session_cost' => $sessionCost,
                'discount' => $discount,
                'total_amount' => $finalTotal,
                'paid_amount' => $amountPaid,
                'payment_status' => 'paid',
                'payment_method' => $paymentMethod,
            ]);

            // Release Device
            $session->device->update(['status' => 'available']);

            // Update associated orders to paid
            $session->orders()->update([
                'payment_status' => 'paid',
                'payment_method' => $paymentMethod,
            ]);

            // Record Payment
            Payment::create([
                'device_session_id' => $session->id,
                'amount' => $amountPaid,
                'payment_method' => $paymentMethod,
                'status' => 'confirmed',
            ]);
        });

        return response()->json([
            'message' => 'Gaming session ended and settled successfully',
            'receipt' => [
                'business_name' => 'AL5AL Gaming & Billiards Lounge',
                'business_name_ar' => 'صالة الخال للألعاب والبلياردو والكافيه',
                'slogan' => 'Enjoy The Game - استمتع بأفضل تجربة لعب وتحدي',
                'phones' => '01032890430 (Karim) / 01289535503 (Al-Ghareeb) / 0502943796',
                'session_id' => $session->id,
                'device_name' => $session->device->device_name,
                'room_name' => $session->device->room_name,
                'customer_name' => $session->customer_name,
                'duration_minutes' => $session->duration_minutes,
                'start_time' => $session->start_time->format('Y-m-d H:i'),
                'end_time' => Carbon::now()->format('Y-m-d H:i'),
                'session_cost' => (float)$session->session_cost,
                'beverage_cost' => (float)$session->beverage_cost,
                'discount' => (float)$discount,
                'total_amount' => (float)$finalTotal,
                'payment_method' => $paymentMethod,
                'orders' => $session->orders,
            ]
        ]);
    }
}
