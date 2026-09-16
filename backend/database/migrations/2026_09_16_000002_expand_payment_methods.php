<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE orders MODIFY payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'");
            DB::statement("ALTER TABLE payments MODIFY payment_method VARCHAR(20) NOT NULL DEFAULT 'cash'");
        } elseif (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE orders ALTER COLUMN payment_method TYPE VARCHAR(20)');
            DB::statement("ALTER TABLE orders ALTER COLUMN payment_method SET DEFAULT 'cash'");
            DB::statement('ALTER TABLE payments ALTER COLUMN payment_method TYPE VARCHAR(20)');
            DB::statement("ALTER TABLE payments ALTER COLUMN payment_method SET DEFAULT 'cash'");
        }
    }

    public function down(): void
    {
        // Keep the expanded payment history intact when rolling back application code.
    }
};
