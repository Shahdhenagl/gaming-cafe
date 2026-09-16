<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\ExpenseController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\TableController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

$apiRoutes = function () {
    Route::get('/', function () {
        return response()->json(['system' => 'AL5AL Gaming, Billiards & Lounge Management System', 'status' => 'online', 'version' => '1.0.0']);
    });
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/user', [AuthController::class, 'user']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/shifts/current', [ShiftController::class, 'current']);
        Route::post('/shifts/start', [ShiftController::class, 'start']);
        Route::post('/shifts/{id}/close', [ShiftController::class, 'close']);
        Route::patch('/shifts/{id}/close', [ShiftController::class, 'close']);
        Route::get('/shifts/history', [ShiftController::class, 'history']);
        Route::get('/shifts/{id}/report', [ShiftController::class, 'report']);
        Route::get('/devices', [DeviceController::class, 'index']);
        Route::post('/devices', [DeviceController::class, 'store']);
        Route::get('/devices/active', [DeviceController::class, 'index']);
        Route::patch('/devices/{id}', [DeviceController::class, 'update']);
        Route::delete('/devices/{id}', [DeviceController::class, 'destroy']);
        Route::post('/devices/{id}/session/start', [SessionController::class, 'start']);
        Route::post('/devices/{id}/start-session', [SessionController::class, 'start']);
        Route::post('/devices/{id}/start', [SessionController::class, 'start']);
        Route::patch('/sessions/{id}/extend', [SessionController::class, 'extend']);
        Route::patch('/sessions/{id}/extend-time', [SessionController::class, 'extend']);
        Route::patch('/sessions/{id}/add-beverage', [SessionController::class, 'addBeverage']);
        Route::post('/sessions/{id}/add-beverage', [SessionController::class, 'addBeverage']);
        Route::post('/sessions/{id}/end', [SessionController::class, 'end']);
        Route::patch('/sessions/{id}/end-session', [SessionController::class, 'end']);
        Route::get('/orders', [OrderController::class, 'index']);
        Route::post('/orders', [OrderController::class, 'store']);
        Route::post('/orders/create', [OrderController::class, 'store']);
        Route::post('/orders/{id}/payment', [OrderController::class, 'processPayment']);
        Route::post('/orders/{id}/process-payment', [OrderController::class, 'processPayment']);
        Route::get('/orders/{id}/receipt', [OrderController::class, 'receipt']);
        Route::get('/tables', [TableController::class, 'index']);
        Route::get('/tables/{id}', [TableController::class, 'show']);
        Route::patch('/tables/{id}/occupy', [TableController::class, 'occupy']);
        Route::post('/tables/{id}/move-to-gaming', [TableController::class, 'moveToGaming']);
        Route::post('/tables/{id}/release', [TableController::class, 'release']);
        Route::patch('/tables/{id}/release', [TableController::class, 'release']);
        Route::get('/products', [ProductController::class, 'index']);
        Route::post('/products', [ProductController::class, 'store']);
        Route::patch('/products/{id}', [ProductController::class, 'update']);
        Route::delete('/products/{id}', [ProductController::class, 'destroy']);
        Route::patch('/products/{id}/stock', [ProductController::class, 'updateStock']);
        Route::get('/inventory/report', [ProductController::class, 'inventoryReport']);
        Route::get('/expenses', [ExpenseController::class, 'index']);
        Route::post('/expenses', [ExpenseController::class, 'store']);
        Route::delete('/expenses/{id}', [ExpenseController::class, 'destroy']);
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::patch('/users/{id}', [UserController::class, 'update']);
        Route::delete('/users/{id}', [UserController::class, 'destroy']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::patch('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
        Route::get('/reports/dashboard', [ReportController::class, 'dashboard']);
        Route::get('/reports/analytics', [ReportController::class, 'analytics']);
    });
};

$apiRoutes();
Route::prefix('v1')->group($apiRoutes);
