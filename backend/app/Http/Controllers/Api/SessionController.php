<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\Customer;
use App\Models\CustomerDebt;
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
            return response()->json(['message' => 'Could not start session.'], 500);
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
            $sessionData = [
                'device_id' => $device->id,
                'shift_id' => $shift ? $shift->id : null,
                'staff_id' => $request->user() ? $request->user()->id : ($shift ? $shift->staff_id : 3),
                'customer_name' => $request->customer_name ?? 'Guest Gamer',
                'customer_phone' => $request->customer_phone,
                'start_time' => $now,
                'end_time' => $endTime,
                'duration_minutes' => $duration,
                'status' => 'active',
                'hourly_rate' => $hourlyRate,
                'session_cost' => $sessionCost,
                'beverage_cost' => 0.00,
                'discount' => $discount,
                'total_amount' => $totalAmount,
                'paid_amount' => 0.00,
                'payment_status' => 'unpaid',
            ];
            // Fixed sessions use the database default FALSE. PDO/pgsql
            // needs a PostgreSQL expression for the open-session TRUE value.
            if ($isOpenEnded) {
                $sessionData['is_open_ended'] = DB::raw('TRUE');
            }
            $session = DeviceSession::create($sessionData);

            $device->update(['status' => 'active']);

                return $session;
            });
        } catch (\Throwable $exception) {
            report($exception);
            return response()->json(['message' => 'Could not start session.'], 500);
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
        try {
            $session = DeviceSession::with(['device', 'orders.items.product'])->findOrFail($id);

            $request->validate([
                'payment_method' => 'required|in:cash,visa,wallet,instapay,installment,credit,other',
                'discount' => 'nullable|numeric|min:0',
                'amount_paid' => 'nullable|numeric|min:0',
                'customer_name' => 'required_if:payment_method,credit|string|max:255',
                'customer_phone' => 'required_if:payment_method,credit|string|max:40',
            ]);

            $paymentMethod = $request->payment_method;
            $discount = $request->filled('discount') ? (float)$request->discount : (float)$session->discount;
            $elapsedMinutes = $session->is_open_ended
                ? max(1, (int)ceil(Carbon::parse($session->start_time)->diffInSeconds(Carbon::now()) / 60))
                : ($session->duration_minutes ?: 60);
            $sessionCost = $session->is_open_ended
                ? round(($elapsedMinutes / 60) * (float)$session->hourly_rate, 2)
                : (float)$session->session_cost;
            $finalTotal = max(0, $sessionCost + (float)$session->beverage_cost - $discount);
            $amountPaid = $request->filled('amount_paid') ? (float)$request->amount_paid : $finalTotal;

            DB::transaction(function () use ($session, $paymentMethod, $discount, $finalTotal, $amountPaid, $elapsedMinutes, $sessionCost, $request) {
                $customer = null;
                if ($paymentMethod === 'credit') {
                    $phone = trim((string)$request->customer_phone);
                    $name = trim((string)$request->customer_name) ?: 'عميل آجل';
                    if (empty($phone)) {
                        $phone = '010' . str_pad((string)$session->id, 8, '0', STR_PAD_LEFT);
                    }
                    $customer = Customer::updateOrCreate(['phone' => $phone], ['name' => $name]);
                }

                $session->update([
                    'status' => 'ended',
                    'end_time' => Carbon::now(),
                    'duration_minutes' => $elapsedMinutes,
                    'session_cost' => $sessionCost,
                    'discount' => $discount,
                    'total_amount' => $finalTotal,
                    'paid_amount' => $paymentMethod === 'credit' ? 0 : $amountPaid,
                    'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                    'payment_method' => $paymentMethod,
                ]);

                // Release Device
                if ($session->device) {
                    $session->device->update(['status' => 'available']);
                }

                // Update associated orders to paid
                $session->orders()->update([
                    'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                    'payment_method' => $paymentMethod,
                    ...($customer ? ['customer_id' => $customer->id] : []),
                ]);

                if ($paymentMethod === 'credit' && $customer) {
                    CustomerDebt::create([
                        'customer_id' => $customer->id,
                        'device_session_id' => $session->id,
                        'shift_id' => $session->shift_id,
                        'amount' => $finalTotal,
                        'description' => 'جلسة ألعاب ' . ($session->device?->device_name ?? ('جهاز #' . $session->device_id)),
                    ]);
                } else {
                    Payment::create([
                        'device_session_id' => $session->id,
                        'shift_id' => $session->shift_id,
                        'amount' => $amountPaid,
                        'payment_method' => $paymentMethod,
                        'status' => 'confirmed'
                    ]);
                }
            });

            $receiptItems = $session->orders
                ->flatMap(fn ($order) => $order->items ?? collect())
                ->map(fn ($item) => [
                    'name' => $item->product?->name ?? 'Item',
                    'name_ar' => $item->product?->name_ar ?? $item->product?->name ?? 'صنف',
                    'quantity' => (int) $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'subtotal' => (float) $item->subtotal,
                ])->values()->all();
            $firstOrder = $session->orders->first();

            return response()->json([
                'message' => 'Gaming session ended and settled successfully',
                'receipt' => [
                    'business_name' => 'AL5AL Gaming & Billiards Lounge',
                    'business_name_ar' => 'صالة الخال للألعاب والبلياردو والكافيه',
                    'slogan' => 'Enjoy The Game - استمتع بأفضل تجربة لعب وتحدي',
                    'phones' => '01032890430 (Karim) / 01289535503 (Al-Ghareeb) / 0502943796',
                    'session_id' => $session->id,
                    'order_number' => $firstOrder?->order_number ?? ('SESSION-' . $session->id),
                    'date_time' => Carbon::now()->format('Y-m-d H:i'),
                    'staff_name' => $request->user()?->name ?? 'كاشير الصالة',
                    'order_type' => 'gaming_room',
                    'device_name' => $session->device?->device_name ?? 'جهاز ألعاب',
                    'room_name' => $session->device?->room_name ?? 'صالة الألعاب',
                    'customer_name' => $session->customer_name,
                    'duration_minutes' => $session->duration_minutes,
                    'start_time' => $session->start_time ? $session->start_time->format('Y-m-d H:i') : Carbon::now()->format('Y-m-d H:i'),
                    'end_time' => Carbon::now()->format('Y-m-d H:i'),
                    'session_cost' => (float)$session->session_cost,
                    'beverage_cost' => (float)$session->beverage_cost,
                    'discount' => (float)$discount,
                    'total_amount' => (float)$finalTotal,
                    'payment_method' => $paymentMethod,
                    'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                    'subtotal' => (float) ($sessionCost + (float)$session->beverage_cost),
                    'tax' => 0,
                    'items' => $receiptItems,
                    'footer_note' => 'Thank you for visiting AL5AL! Enjoy The Game',
                    'footer_note_ar' => 'شكراً لزيارتكم صالة الخال! استمتعوا باللعب',
                    'orders' => $session->orders,
                ]
            ]);
        } catch (\Illuminate\Validation\ValidationException $ve) {
            throw $ve;
        } catch (\Throwable $e) {
            \Log::error('Error ending gaming session: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'تعذر إنهاء الجلسة بسبب خطأ في البيانات أو اتصال الخادم: ' . $e->getMessage(),
                'error_detail' => $e->getMessage()
            ], 422);
        }
    }

    /**
     * Create a manual / offline session (e.g. recorded on paper when internet was down).
     */
    public function addManualSession(Request $request)
    {
        $request->validate([
            'device_id' => 'required|exists:devices,id',
            'customer_name' => 'nullable|string|max:100',
            'customer_phone' => 'nullable|string|max:40',
            'duration_minutes' => 'nullable|integer|min:1|max:1440',
            'start_time' => 'nullable|date',
            'end_time' => 'nullable|date',
            'hourly_rate' => 'nullable|numeric|min:0',
            'session_cost' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0',
            'payment_method' => 'required|in:cash,visa,wallet,instapay,installment,credit,other',
            'amount_paid' => 'nullable|numeric|min:0',
            'items' => 'nullable|array',
            'items.*.product_id' => 'required_with:items|exists:products,id',
            'items.*.quantity' => 'required_with:items|integer|min:1',
            'items.*.notes' => 'nullable|string',
        ]);

        try {
            $device = Device::findOrFail($request->device_id);
            $shift = Shift::where('status', 'active')->latest()->first();

            $startTime = $request->filled('start_time') ? Carbon::parse($request->start_time) : Carbon::now()->subMinutes($request->duration_minutes ?? 60);
            $endTime = $request->filled('end_time') ? Carbon::parse($request->end_time) : (clone $startTime)->addMinutes($request->duration_minutes ?? 60);
            $durationMinutes = $request->filled('duration_minutes') ? (int)$request->duration_minutes : max(1, (int)ceil($startTime->diffInSeconds($endTime) / 60));

            $hourlyRate = $request->filled('hourly_rate') ? (float)$request->hourly_rate : (float)$device->hourly_rate;
            $sessionCost = $request->filled('session_cost') ? (float)$request->session_cost : round(($durationMinutes / 60) * $hourlyRate, 2);
            $discount = (float)($request->discount ?? 0.00);
            $paymentMethod = $request->payment_method;

            $staffId = $request->user()?->id ?? $shift?->staff_id;
            if (!$staffId) {
                $staffId = \App\Models\User::query()->value('id');
            }

            $result = DB::transaction(function () use ($device, $shift, $startTime, $endTime, $durationMinutes, $hourlyRate, $sessionCost, $discount, $paymentMethod, $staffId, $request) {
                $totalBeveragePrice = 0.0;
                $itemsData = [];

                if ($request->filled('items') && is_array($request->items)) {
                    foreach ($request->items as $it) {
                        $prod = Product::findOrFail($it['product_id']);
                        $qty = (int)$it['quantity'];
                        $subtotal = round($prod->price * $qty, 2);
                        $totalBeveragePrice += $subtotal;
                        $itemsData[] = [
                            'product' => $prod,
                            'quantity' => $qty,
                            'unit_price' => $prod->price,
                            'cost_price' => $prod->cost_price ?? 0,
                            'subtotal' => $subtotal,
                            'notes' => $it['notes'] ?? null,
                        ];
                        // Decrement stock & log
                        $prod->decrement('stock_quantity', $qty);
                        InventoryLog::create([
                            'product_id' => $prod->id,
                            'quantity_change' => -$qty,
                            'reason' => 'sale',
                            'staff_id' => $staffId,
                        ]);
                    }
                }

                $finalTotal = max(0, $sessionCost + $totalBeveragePrice - $discount);
                $amountPaid = $request->filled('amount_paid') ? (float)$request->amount_paid : $finalTotal;

                $customer = null;
                $custName = trim((string)($request->customer_name ?: 'عميل يدوي / أوفلاين'));
                $custPhone = trim((string)($request->customer_phone ?: ''));

                if ($paymentMethod === 'credit') {
                    if ($custName === '') {
                        $custName = 'عميل آجل';
                    }
                    if ($custPhone === '') {
                        $custPhone = '01' . mt_rand(100000000, 999999999);
                    }
                    if (\Illuminate\Support\Facades\Schema::hasTable('customers')) {
                        try {
                            $customer = Customer::updateOrCreate(
                                ['phone' => $custPhone],
                                ['name' => $custName, 'is_archived' => false]
                            );
                        } catch (\Throwable $e) {
                            \Log::warning('Could not auto-create customer for manual session credit: ' . $e->getMessage());
                            $customer = Customer::where('phone', $custPhone)->first();
                        }
                    }
                }

                $session = DeviceSession::create([
                    'device_id' => $device->id,
                    'shift_id' => $shift?->id,
                    'staff_id' => $staffId,
                    'customer_name' => $custName,
                    'customer_phone' => $custPhone ?: null,
                    'start_time' => $startTime,
                    'end_time' => $endTime,
                    'duration_minutes' => $durationMinutes,
                    'is_open_ended' => false,
                    'status' => 'ended', // Ended immediately! Device stays available!
                    'hourly_rate' => $hourlyRate,
                    'session_cost' => $sessionCost,
                    'beverage_cost' => $totalBeveragePrice,
                    'discount' => $discount,
                    'total_amount' => $finalTotal,
                    'paid_amount' => $paymentMethod === 'credit' ? 0 : $amountPaid,
                    'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                    'payment_method' => $paymentMethod,
                ]);

                $order = null;
                if (count($itemsData) > 0) {
                    $order = Order::create([
                        'order_number' => 'ORD-M' . strtoupper(bin2hex(random_bytes(2))),
                        'shift_id' => $shift?->id,
                        'staff_id' => $staffId,
                        'customer_id' => $customer?->id,
                        'status' => 'completed',
                        'order_type' => 'gaming_room',
                        'device_session_id' => $session->id,
                        'subtotal' => $totalBeveragePrice,
                        'discount' => 0,
                        'tax' => 0,
                        'total_amount' => $totalBeveragePrice,
                        'payment_method' => $paymentMethod,
                        'payment_status' => $paymentMethod === 'credit' ? 'unpaid' : 'paid',
                    ]);

                    foreach ($itemsData as $itData) {
                        OrderItem::create([
                            'order_id' => $order->id,
                            'product_id' => $itData['product']->id,
                            'quantity' => $itData['quantity'],
                            'unit_price' => $itData['unit_price'],
                            'cost_price' => $itData['cost_price'],
                            'subtotal' => $itData['subtotal'],
                            'notes' => $itData['notes'],
                        ]);
                    }
                }

                if ($paymentMethod === 'credit') {
                    if ($customer && \Illuminate\Support\Facades\Schema::hasTable('customer_debts')) {
                        try {
                            CustomerDebt::create([
                                'customer_id' => $customer->id,
                                'device_session_id' => $session->id,
                                'shift_id' => $shift?->id,
                                'amount' => $finalTotal,
                                'paid_amount' => 0,
                                'description' => 'جلسة يدوية سابقة - ' . ($device->device_name_ar ?: $device->device_name),
                                'status' => 'open',
                            ]);
                        } catch (\Throwable $e) {
                            \Log::error('Could not create CustomerDebt for manual session: ' . $e->getMessage());
                        }
                    }
                } else {
                    Payment::create([
                        'device_session_id' => $session->id,
                        'shift_id' => $shift?->id,
                        'amount' => $amountPaid,
                        'payment_method' => $paymentMethod,
                        'status' => 'confirmed',
                    ]);
                }

                return ['session' => $session->fresh(['device', 'orders.items.product']), 'order' => $order];
            });

            $session = $result['session'];
            $receiptItems = $session->orders
                ? $session->orders
                    ->flatMap(fn ($order) => $order->items ?? collect())
                    ->map(fn ($item) => [
                        'name' => $item->product?->name ?? 'صنف',
                        'name_ar' => $item->product?->name_ar ?? $item->product?->name ?? 'صنف',
                        'quantity' => (int) $item->quantity,
                        'unit_price' => (float) $item->unit_price,
                        'subtotal' => (float) $item->subtotal,
                    ])->values()->all()
                : [];

            $devName = $session->device?->device_name_ar ?: ($session->device?->device_name ?? 'جهاز ألعاب');
            $roomName = $session->device?->room_name ?? 'صالة الألعاب';
            $startTimeFormatted = $session->start_time ? Carbon::parse($session->start_time)->format('Y-m-d H:i') : Carbon::now()->format('Y-m-d H:i');
            $endTimeFormatted = $session->end_time ? Carbon::parse($session->end_time)->format('Y-m-d H:i') : Carbon::now()->format('Y-m-d H:i');

            return response()->json([
                'message' => 'تم تسجيل الجلسة اليدوية وإدخال الإيراد في الخزنة والشيفت بنجاح',
                'session' => $session,
                'receipt' => [
                    'business_name' => 'AL5AL Gaming & Billiards Lounge',
                    'business_name_ar' => 'صالة الخال للألعاب والبلياردو والكافيه',
                    'slogan' => 'Enjoy The Game - استمتع بأفضل تجربة لعب وتحدي',
                    'phones' => '01032890430 (Karim) / 01289535503 (Al-Ghareeb) / 0502943796',
                    'session_id' => $session->id,
                    'order_number' => 'MANUAL-' . $session->id,
                    'date_time' => Carbon::now()->format('Y-m-d H:i'),
                    'staff_name' => $request->user()?->name ?? 'كاشير الصالة',
                    'order_type' => 'gaming_room',
                    'device_name' => $devName,
                    'room_name' => $roomName,
                    'customer_name' => $session->customer_name,
                    'duration_minutes' => $session->duration_minutes,
                    'start_time' => $startTimeFormatted,
                    'end_time' => $endTimeFormatted,
                    'session_cost' => (float)$session->session_cost,
                    'beverage_cost' => (float)$session->beverage_cost,
                    'discount' => (float)$session->discount,
                    'total_amount' => (float)$session->total_amount,
                    'payment_method' => $session->payment_method,
                    'payment_status' => $session->payment_status,
                    'subtotal' => (float) ($session->session_cost + $session->beverage_cost),
                    'tax' => 0,
                    'items' => $receiptItems,
                    'footer_note' => 'Thank you for visiting AL5AL! Enjoy The Game',
                    'footer_note_ar' => 'شكراً لزيارتكم صالة الخال! استمتعوا باللعب',
                ]
            ], 201);
        } catch (\Throwable $e) {
            \Log::error('addManualSession failure: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'message' => 'تعذر تسجيل الجلسة اليدوية: ' . $e->getMessage()
            ], 422);
        }
    }
}
