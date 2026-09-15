<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\Order;
use App\Models\Payment;
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
            $elapsedMinutes = 0;
            if ($order) {
                $elapsedMinutes = Carbon::parse($order->created_at)->diffInMinutes(Carbon::now());
            }

            return [
                'id' => $t->id,
                'table_number' => $t->table_number,
                'capacity' => $t->capacity,
                'status' => $t->status,
                'current_order_id' => $t->current_order_id,
                'total_spent' => (float)$t->total_spent,
                'elapsed_minutes' => $elapsedMinutes,
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
        $table->update(['status' => 'occupied']);

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
     * Release table / Settle payment.
     */
    public function release(Request $request, $id)
    {
        $table = Table::with('currentOrder')->findOrFail($id);

        $paymentMethod = $request->input('payment_method', 'cash');

        DB::transaction(function () use ($table, $paymentMethod) {
            if ($table->currentOrder) {
                $table->currentOrder->update([
                    'payment_status' => 'paid',
                    'payment_method' => $paymentMethod,
                ]);

                Payment::create([
                    'order_id' => $table->currentOrder->id,
                    'amount' => $table->currentOrder->total_amount,
                    'payment_method' => $paymentMethod,
                    'status' => 'confirmed',
                ]);
            }

            $table->update([
                'status' => 'available',
                'current_order_id' => null,
                'total_spent' => 0.00,
            ]);
        });

        return response()->json([
            'message' => 'Table order paid and table released successfully',
            'table' => $table->fresh(),
        ]);
    }
}
