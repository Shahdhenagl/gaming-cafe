<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('treasury_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('entry_type', 30)->default('shift_closing');
            $table->string('payment_method', 30);
            $table->decimal('amount', 12, 2)->default(0);
            $table->timestampTz('transaction_date')->useCurrent();
            $table->string('reference', 120)->nullable();
            $table->text('notes')->nullable();
            $table->timestampsTz();
            $table->index('transaction_date');
            $table->index('payment_method');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('treasury_entries');
    }
};
