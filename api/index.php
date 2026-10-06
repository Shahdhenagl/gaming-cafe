<?php

use Illuminate\Http\Request;

// Vercel's PHP runtime invokes this file from the repository root.
// Laravel itself remains in backend/ and continues to use the same Supabase
// environment variables and routes.
$root = dirname(__DIR__);
$backend = $root . '/backend';
chdir($backend);

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = $backend . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

try {
    $autoload = $backend . '/vendor/autoload.php';
    if (!is_file($autoload)) {
        $autoload = $root . '/vendor/autoload.php';
    }
    if (!is_file($autoload)) {
        throw new RuntimeException('Composer autoload file not found');
    }
    require $autoload;

    $app = require_once $backend . '/bootstrap/app.php';
    $app->handleRequest(Request::capture());
} catch (Throwable $e) {
    // Keep the client response generic, but expose the bootstrap failure in
    // Vercel runtime logs instead of returning a silent exit(1).
    error_log(sprintf(
        "Laravel bootstrap failure: %s in %s:%d\n%s",
        $e->getMessage(),
        $e->getFile(),
        $e->getLine(),
        $e->getTraceAsString()
    ));
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['message' => 'Server error'], JSON_UNESCAPED_UNICODE);
}
