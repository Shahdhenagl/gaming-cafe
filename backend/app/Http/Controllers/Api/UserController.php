<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(['users' => User::query()->select('id', 'name', 'email', 'phone', 'pin_code', 'role', 'avatar')->orderBy('id')->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255', 'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:30', 'pin_code' => 'required|string|size:4|unique:users,pin_code',
            'role' => 'required|in:super_admin,admin,manager,staff', 'password' => 'nullable|string|min:4',
        ]);
        $data['password'] = $data['password'] ?? $data['pin_code'];
        return response()->json(['user' => User::create($data)], 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'name' => 'sometimes|string|max:255', 'email' => 'sometimes|email|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:30', 'pin_code' => 'sometimes|string|size:4|unique:users,pin_code,' . $id,
            'role' => 'sometimes|in:super_admin,admin,manager,staff', 'password' => 'nullable|string|min:4',
        ]);
        if (empty($data['password'])) unset($data['password']);
        $user->update($data);
        return response()->json(['user' => $user]);
    }

    public function destroy($id)
    {
        User::findOrFail($id)->delete();
        return response()->json(['message' => 'User deleted successfully']);
    }
}
