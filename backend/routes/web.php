<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return redirect('http://localhost:5173');
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});
