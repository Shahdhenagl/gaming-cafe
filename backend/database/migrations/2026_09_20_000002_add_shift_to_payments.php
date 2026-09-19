<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasColumn('payments', 'shift_id')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->foreignId('shift_id')->nullable()->after('device_session_id')->constrained('shifts')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('payments', 'shift_id')) {
            Schema::table('payments', fn (Blueprint $table) => $table->dropConstrainedForeignId('shift_id'));
        }
    }
};
