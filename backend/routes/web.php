<?php

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/', static function () {
    return response()->file(public_path('index.html'));
});

Route::get('/health', static function (): JsonResponse {
    return response()->json(['status' => 'ok']);
});

Route::get('/{path}', static function () {
    return response()->file(public_path('index.html'));
})->where('path', '(?!api|health).*$');
