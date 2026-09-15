<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Shifts Table
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('start_time')->useCurrent();
            $table->timestamp('end_time')->nullable();
            $table->enum('status', ['active', 'closed'])->default('active');
            $table->decimal('total_before_deductions', 10, 2)->default(0.00);
            $table->decimal('total_after_deductions', 10, 2)->default(0.00);
            $table->decimal('deductions', 10, 2)->default(0.00);
            $table->decimal('cash_collected', 10, 2)->default(0.00);
            $table->decimal('card_collected', 10, 2)->default(0.00);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 2. Devices Table
        Schema::create('devices', function (Blueprint $table) {
            $table->id();
            $table->string('room_name');
            $table->string('room_name_ar')->nullable();
            $table->string('device_name');
            $table->string('device_name_ar')->nullable();
            $table->enum('device_type', ['ps5', 'ps4', 'billiards', 'pingpong', 'pc', 'xbox', 'sim', 'other'])->default('ps5');
            $table->enum('status', ['available', 'active', 'maintenance'])->default('available');
            $table->string('location')->nullable();
            $table->decimal('hourly_rate', 8, 2)->default(50.00);
            $table->text('specs')->nullable();
            $table->timestamps();
        });

        // 3. Device Sessions Table
        Schema::create('device_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name')->default('Guest');
            $table->string('customer_phone')->nullable();
            $table->timestamp('start_time')->useCurrent();
            $table->timestamp('end_time');
            $table->integer('duration_minutes');
            $table->enum('status', ['active', 'ended', 'paused'])->default('active');
            $table->decimal('hourly_rate', 8, 2)->default(50.00);
            $table->decimal('session_cost', 10, 2)->default(0.00);
            $table->decimal('beverage_cost', 10, 2)->default(0.00);
            $table->decimal('discount', 10, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2)->default(0.00);
            $table->decimal('paid_amount', 10, 2)->default(0.00);
            $table->enum('payment_status', ['unpaid', 'partially_paid', 'paid'])->default('unpaid');
            $table->string('payment_method')->nullable();
            $table->timestamps();
        });

        // 4. Session Extensions Table
        Schema::create('session_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('device_sessions')->cascadeOnDelete();
            $table->integer('added_minutes');
            $table->decimal('price', 8, 2)->default(0.00);
            $table->timestamp('requested_at')->useCurrent();
            $table->timestamp('applied_at')->nullable();
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 5. Products / Beverages Table
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('name_ar');
            $table->enum('category', ['hot_drinks', 'cold_drinks', 'soft_drinks', 'snacks', 'food'])->default('hot_drinks');
            $table->decimal('price', 8, 2);
            $table->decimal('cost_price', 8, 2)->default(0.00);
            $table->integer('stock_quantity')->default(0);
            $table->integer('reorder_level')->default(5);
            $table->string('image_url')->nullable();
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->timestamps();
        });

        // 6. Tables Table
        Schema::create('tables', function (Blueprint $table) {
            $table->id();
            $table->string('table_number');
            $table->integer('capacity')->default(4);
            $table->enum('status', ['available', 'occupied'])->default('available');
            $table->unsignedBigInteger('current_order_id')->nullable();
            $table->decimal('total_spent', 10, 2)->default(0.00);
            $table->timestamps();
        });

        // 7. Orders Table
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['pending', 'completed', 'cancelled'])->default('completed');
            $table->enum('order_type', ['take_away', 'dine_in', 'gaming_room'])->default('take_away');
            $table->foreignId('table_id')->nullable()->constrained('tables')->nullOnDelete();
            $table->foreignId('device_session_id')->nullable()->constrained('device_sessions')->nullOnDelete();
            $table->decimal('subtotal', 10, 2)->default(0.00);
            $table->decimal('discount', 10, 2)->default(0.00);
            $table->decimal('tax', 10, 2)->default(0.00);
            $table->decimal('total_amount', 10, 2)->default(0.00);
            $table->enum('payment_method', ['cash', 'visa', 'installment', 'other'])->default('cash');
            $table->enum('payment_status', ['unpaid', 'paid'])->default('paid');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        // 8. Order Items Table
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('quantity')->default(1);
            $table->decimal('unit_price', 8, 2);
            $table->decimal('subtotal', 10, 2);
            $table->string('notes')->nullable();
            $table->timestamps();
        });

        // 9. Payments Table
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->nullable()->constrained('orders')->nullOnDelete();
            $table->foreignId('device_session_id')->nullable()->constrained('device_sessions')->nullOnDelete();
            $table->decimal('amount', 10, 2);
            $table->enum('payment_method', ['cash', 'visa', 'installment', 'other'])->default('cash');
            $table->string('reference_id')->nullable();
            $table->enum('status', ['pending', 'confirmed', 'failed'])->default('confirmed');
            $table->timestamps();
        });

        // 10. Inventory Logs Table
        Schema::create('inventory_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->integer('quantity_change');
            $table->enum('reason', ['sale', 'restock', 'adjustment'])->default('sale');
            $table->foreignId('staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        // 11. Notifications Table
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('type', ['session_ending', 'session_ended', 'order_ready', 'payment_reminder', 'low_stock'])->default('session_ending');
            $table->string('title');
            $table->text('message');
            $table->string('related_to')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });

        // 12. Shift Reports Table
        Schema::create('shift_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->integer('total_orders')->default(0);
            $table->integer('total_beverages_sold')->default(0);
            $table->integer('total_sessions')->default(0);
            $table->decimal('total_revenue', 10, 2)->default(0.00);
            $table->decimal('cash_transactions', 10, 2)->default(0.00);
            $table->decimal('card_transactions', 10, 2)->default(0.00);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shift_reports');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('inventory_logs');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
        Schema::dropIfExists('tables');
        Schema::dropIfExists('products');
        Schema::dropIfExists('session_extensions');
        Schema::dropIfExists('device_sessions');
        Schema::dropIfExists('devices');
        Schema::dropIfExists('shifts');
    }
};
