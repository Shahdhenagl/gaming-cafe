<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('device_sessions')) {
            return;
        }

        if (Schema::hasColumn('device_sessions', 'duration_minutes')) {
            DB::statement('ALTER TABLE device_sessions ALTER COLUMN duration_minutes DROP NOT NULL');
        }

        if (Schema::hasColumn('device_sessions', 'end_time')) {
            DB::statement('ALTER TABLE device_sessions ALTER COLUMN end_time DROP NOT NULL');
        }
    }

    public function down(): void
    {
        // Keep production data safe when rolling back application code.
    }
};
