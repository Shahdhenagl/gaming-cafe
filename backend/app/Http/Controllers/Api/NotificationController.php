<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeviceSession;
use App\Models\Notification;
use App\Models\Product;
use Carbon\Carbon;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get active notifications & scan for dynamic session / inventory alerts.
     */
    public function index()
    {
        $now = Carbon::now();

        // 1. Scan active sessions expiring within 10 minutes or ended
        $activeSessions = DeviceSession::with('device')->where('status', 'active')->get();
        foreach ($activeSessions as $session) {
            if ($session->is_open_ended || !$session->end_time) {
                continue;
            }
            $endTime = Carbon::parse($session->end_time);
            $diffSeconds = $now->diffInSeconds($endTime, false);

            if ($diffSeconds <= 0) {
                // Session Ended Alert
                $exists = Notification::where('type', 'session_ended')
                    ->where('related_to', (string)$session->id)
                    ->exists();

                if (!$exists) {
                    Notification::create([
                        'type' => 'session_ended',
                        'title' => "Session Ended: {$session->device->device_name}",
                        'message' => "Session for {$session->customer_name} has ended. Please settle payment or extend time.",
                        'related_to' => (string)$session->id,
                        'is_read' => false,
                    ]);
                }
            } elseif ($diffSeconds <= 600) { // 10 mins or less
                $minutesLeft = max(1, round($diffSeconds / 60));
                $exists = Notification::where('type', 'session_ending')
                    ->where('related_to', (string)$session->id)
                    ->where('created_at', '>=', Carbon::now()->subMinutes(8))
                    ->exists();

                if (!$exists) {
                    Notification::create([
                        'type' => 'session_ending',
                        'title' => "Session Expiring in {$minutesLeft} min: {$session->device->device_name}",
                        'message' => "Gamer {$session->customer_name} has {$minutesLeft} minutes left.",
                        'related_to' => (string)$session->id,
                        'is_read' => false,
                    ]);
                }
            }
        }

        // 2. Scan low stock
        $lowStock = Product::whereColumn('stock_quantity', '<=', 'reorder_level')->get();
        foreach ($lowStock as $prod) {
            $exists = Notification::where('type', 'low_stock')
                ->where('related_to', (string)$prod->id)
                ->where('created_at', '>=', Carbon::now()->subHours(4))
                ->exists();

            if (!$exists) {
                Notification::create([
                    'type' => 'low_stock',
                    'title' => "Low Stock Alert: {$prod->name}",
                    'message' => "Only {$prod->stock_quantity} left in stock (Reorder level is {$prod->reorder_level}).",
                    'related_to' => (string)$prod->id,
                    'is_read' => false,
                ]);
            }
        }

        $notifications = Notification::latest()->take(30)->get();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $notifications->where('is_read', false)->count(),
        ]);
    }

    /**
     * Mark single notification as read.
     */
    public function markAsRead($id)
    {
        $notification = Notification::findOrFail($id);
        $notification->update(['is_read' => true]);

        return response()->json([
            'message' => 'Notification marked as read',
            'notification' => $notification,
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead()
    {
        Notification::where('is_read', false)->update(['is_read' => true]);

        return response()->json([
            'message' => 'All notifications marked as read',
        ]);
    }
}
