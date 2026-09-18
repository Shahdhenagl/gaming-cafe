<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('device_sessions') && Schema::hasColumn('device_sessions', 'duration_minutes')) {
            Schema::table('device_sessions', function (Blueprint $table) {
                $table->integer('duration_minutes')->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('device_sessions') && Schema::hasColumn('device_sessions', 'duration_minutes')) {
            Schema::table('device_sessions', function (Blueprint $table) {
                $table->integer('duration_minutes')->nullable(false)->change();
            });
        }
    }
};
