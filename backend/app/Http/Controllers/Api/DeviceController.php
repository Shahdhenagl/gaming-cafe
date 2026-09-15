<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Device;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DeviceController extends Controller
{
    /**
     * List all devices with active sessions & live countdown info.
     */
    public function index()
    {
        $devices = Device::with(['activeSession.orders.items.product', 'activeSession.extensions'])->get();

        $now = Carbon::now();

        $formatted = $devices->map(function ($device) use ($now) {
            $session = $device->activeSession;
            $remainingSeconds = 0;
            $isEndingSoon = false;
            $isEnded = false;

            if ($session) {
                $endTime = Carbon::parse($session->end_time);
                $diffSec = $now->diffInSeconds($endTime, false);

                if ($diffSec <= 0) {
                    $isEnded = true;
                    $remainingSeconds = 0;
                } else {
                    $remainingSeconds = (int)round($diffSec);
                    if ($remainingSeconds <= 600) { // 10 minutes or less
                        $isEndingSoon = true;
                    }
                }
            }

            return [
                'id' => $device->id,
                'room_name' => $device->room_name,
                'room_name_ar' => $device->room_name_ar,
                'device_name' => $device->device_name,
                'device_name_ar' => $device->device_name_ar,
                'device_type' => $device->device_type,
                'status' => $device->status,
                'hourly_rate' => (float)$device->hourly_rate,
                'specs' => $device->specs,
                'active_session' => $session ? [
                    'id' => $session->id,
                    'customer_name' => $session->customer_name,
                    'customer_phone' => $session->customer_phone,
                    'start_time' => $session->start_time->toISOString(),
                    'end_time' => $session->end_time->toISOString(),
                    'duration_minutes' => $session->duration_minutes,
                    'remaining_seconds' => $remainingSeconds,
                    'is_ending_soon' => $isEndingSoon,
                    'is_ended' => $isEnded,
                    'session_cost' => (float)$session->session_cost,
                    'beverage_cost' => (float)$session->beverage_cost,
                    'discount' => (float)$session->discount,
                    'total_amount' => (float)$session->total_amount,
                    'paid_amount' => (float)$session->paid_amount,
                    'payment_status' => $session->payment_status,
                    'orders' => $session->orders,
                    'extensions' => $session->extensions,
                ] : null,
            ];
        });

        return response()->json([
            'devices' => $formatted,
            'summary' => [
                'total_devices' => $devices->count(),
                'active_devices' => $devices->where('status', 'active')->count(),
                'available_devices' => $devices->where('status', 'available')->count(),
                'maintenance_devices' => $devices->where('status', 'maintenance')->count(),
            ]
        ]);
    }

    /**
     * Store a new device (Admin).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'room_name' => 'required|string',
            'room_name_ar' => 'nullable|string',
            'device_name' => 'required|string',
            'device_name_ar' => 'nullable|string',
            'device_type' => 'required|in:ps5,pc,xbox,sim,other',
            'hourly_rate' => 'required|numeric|min:0',
            'specs' => 'nullable|string',
        ]);

        $device = Device::create($validated);

        return response()->json([
            'message' => 'Device created successfully',
            'device' => $device,
        ], 201);
    }

    /**
     * Update device rate, room, or status.
     */
    public function update(Request $request, $id)
    {
        $device = Device::findOrFail($id);

        $validated = $request->validate([
            'room_name' => 'sometimes|string',
            'device_name' => 'sometimes|string',
            'device_type' => 'sometimes|in:ps5,pc,xbox,sim,other',
            'status' => 'sometimes|in:available,active,maintenance',
            'hourly_rate' => 'sometimes|numeric|min:0',
            'specs' => 'nullable|string',
        ]);

        $device->update($validated);

        return response()->json([
            'message' => 'Device updated successfully',
            'device' => $device,
        ]);
    }

    /**
     * Delete device.
     */
    public function destroy($id)
    {
        $device = Device::findOrFail($id);
        $device->delete();

        return response()->json([
            'message' => 'Device deleted successfully',
        ]);
    }
}
