<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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

        $user = null;

        if ($request->filled('pin')) {
            $user = User::where('pin_code', $request->pin)->first();
            if (!$user) {
                return response()->json(['message' => 'Invalid PIN code. Please try again.'], 401);
            }
        } elseif ($request->filled('email') && $request->filled('password')) {
            $user = User::where('email', $request->email)->first();
            if (!$user || !Hash::check($request->password, $user->password)) {
                return response()->json(['message' => 'Invalid email or password.'], 401);
            }
        } else {
            return response()->json(['message' => 'Please provide email and password, or your quick PIN.'], 422);
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load('currentShift');

        return response()->json([
            'message' => 'Login successful',
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
