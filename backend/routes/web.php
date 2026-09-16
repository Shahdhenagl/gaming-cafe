<?php

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/', static function (): JsonResponse {
    return response()->json([
        'framework' => 'Laravel',
        'service' => 'AL5AL Gaming Cafe API',
        'status' => 'online',
    ]);
});

Route::get('/health', static function (): JsonResponse {
    return response()->json(['status' => 'ok']);
});
