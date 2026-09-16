#!/bin/sh
set -eu

# Keep the production schema synchronized before serving API requests.
php artisan migrate --force --no-interaction
exec frankenphp run --config /etc/frankenphp/Caddyfile
