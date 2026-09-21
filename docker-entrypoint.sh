#!/bin/sh
set -eu

# Ensure storage and database folders exist with proper permissions
mkdir -p /app/storage/framework/cache /app/storage/framework/sessions /app/storage/framework/views /app/bootstrap/cache /app/database

# If using sqlite, ensure the database exists, migrations have run, and seed data exists
if [ "${DB_CONNECTION:-sqlite}" = "sqlite" ]; then
    if [ ! -f /app/database/database.sqlite ] || [ ! -s /app/database/database.sqlite ]; then
        touch /app/database/database.sqlite
    fi
    php /app/artisan migrate --force || true
    php /app/artisan tinker --execute="if (App\Models\User::count() === 0) { Artisan::call('db:seed', ['--force' => true]); }" || true
fi

exec frankenphp run --config /etc/frankenphp/Caddyfile

