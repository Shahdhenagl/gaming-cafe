<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('customers') && !Schema::hasColumn('customers', 'is_archived')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->boolean('is_archived')->default(false)->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('customers') && Schema::hasColumn('customers', 'is_archived')) {
            Schema::table('customers', function (Blueprint $table) {
                $table->dropColumn('is_archived');
            });
        }
    }
};
