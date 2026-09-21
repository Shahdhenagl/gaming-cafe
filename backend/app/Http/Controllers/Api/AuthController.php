<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class AuthController extends Controller
{
    /** Login via Email + Password OR via 4-Digit PIN. */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'nullable|email',
            'password' => 'nullable|string',
            'pin' => 'nullable|string|min:4|max:10',
        ]);

        try {
            // Self-healing: if SQLite database or users table is missing or empty, auto-migrate and seed
            if (config('database.default') === 'sqlite') {
                $dbPath = config('database.connections.sqlite.database');
                if ($dbPath && !file_exists($dbPath)) {
                    @touch($dbPath);
                }
                if (!Schema::hasTable('users')) {
                    Artisan::call('migrate', ['--force' => true]);
                }
                if (Schema::hasTable('users') && User::count() === 0) {
                    Artisan::call('db:seed', ['--force' => true]);
                }
            }

            $user = null;

            if ($request->filled('pin')) {
                $user = User::where('pin_code', $request->pin)->first();
                if (!$user) {
                    return response()->json(['message' => 'رمز PIN غير صحيح. يرجى المحاولة مرة أخرى.'], 401);
                }
            } elseif ($request->filled('email') && $request->filled('password')) {
                $user = User::where('email', $request->email)->first();
                if (!$user || !Hash::check($request->password, $user->password)) {
                    return response()->json(['message' => 'بيانات الدخول غير صحيحة. يرجى التحقق من البريد وكلمة المرور.'], 401);
                }
            } else {
                return response()->json(['message' => 'يرجى إدخال رمز PIN أو البريد الإلكتروني وكلمة المرور.'], 422);
            }

            // Create Sanctum token safely
            try {
                $token = $user->createToken('auth-token')->plainTextToken;
            } catch (\Throwable $tokenErr) {
                Log::warning('Sanctum token generation warning: ' . $tokenErr->getMessage());
                if (!Schema::hasTable('personal_access_tokens')) {
                    Artisan::call('migrate', ['--force' => true]);
                    $token = $user->createToken('auth-token')->plainTextToken;
                } else {
                    throw $tokenErr;
                }
            }

            try {
                $user->load('currentShift');
            } catch (\Throwable $shiftErr) {
                Log::warning('Could not load current shift: ' . $shiftErr->getMessage());
            }

            return response()->json([
                'message' => 'تم تسجيل الدخول بنجاح',
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'phone' => $user->phone,
                    'avatar' => $user->avatar,
                    'shift_id' => $user->shift_id,
                    'current_shift' => $user->currentShift,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Login error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'تعذر الاتصال بقاعدة البيانات أو الخادم. يرجى المحاولة مرة أخرى.',
                'error' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
        }
    }

    /** Get Current Authenticated User & Shift. */
    public function user(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->load('currentShift');

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'shift_id' => $user->shift_id,
                'current_shift' => $user->currentShift,
            ],
        ]);
    }

    /** Logout and revoke tokens. */
    public function logout(Request $request)
    {
        if ($request->user()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json(['message' => 'Logged out successfully']);
    }
}
