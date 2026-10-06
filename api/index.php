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

require $root . '/vendor/autoload.php';

$app = require_once $backend . '/bootstrap/app.php';
$app->handleRequest(Request::capture());
