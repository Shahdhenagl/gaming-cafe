#!/bin/sh
set -eu

# The production Supabase schema is managed explicitly and already exists.
# Running the complete Laravel migration history on every Vercel container boot
# would try to recreate tables because this database does not use Laravel's
# migration ledger. Start the application directly.
exec frankenphp run --config /etc/frankenphp/Caddyfile
