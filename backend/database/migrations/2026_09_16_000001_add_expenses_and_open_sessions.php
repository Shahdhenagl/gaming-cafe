<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('device_sessions', function (Blueprint $table) {
            $table->boolean('is_open_ended')->default(false)->after('duration_minutes');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('cost_price', 8, 2)->default(0.00)->after('unit_price');
        });

        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('category')->default('general');
            $table->string('description');
            $table->decimal('amount', 10, 2);
            $table->date('expense_date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
        Schema::table('order_items', fn (Blueprint $table) => $table->dropColumn('cost_price'));
        Schema::table('device_sessions', fn (Blueprint $table) => $table->dropColumn('is_open_ended'));
    }
};
