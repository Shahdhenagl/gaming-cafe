<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tables', function (Blueprint $table) {
            $table->timestamp('occupied_at')->nullable()->after('status');
        });
        Schema::table('expenses', function (Blueprint $table) {
            $table->string('payment_method')->default('cash')->after('amount');
        });
    }

    public function down(): void
    {
        Schema::table('expenses', fn (Blueprint $table) => $table->dropColumn('payment_method'));
        Schema::table('tables', fn (Blueprint $table) => $table->dropColumn('occupied_at'));
    }
};
