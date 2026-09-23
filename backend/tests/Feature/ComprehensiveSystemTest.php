<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerDebt;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\Expense;
use App\Models\Order;
use App\Models\Product;
use App\Models\Shift;
use App\Models\User;
use Carbon\Carbon;
use Tests\TestCase;

class ComprehensiveSystemTest extends TestCase
{
    protected User $user;
    protected Device $device;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::firstOrCreate(
            ['email' => 'full_tester@al5al.com'],
            [
                'name' => 'Full System Tester',
                'password' => bcrypt('password123'),
                'pin_code' => '8888',
                'role' => 'super_admin',
            ]
        );

        $this->device = Device::firstOrCreate(
            ['device_name' => 'PS5 Test Console 01'],
            [
                'room_name' => 'Main Gaming Area',
                'device_type' => 'ps5',
                'hourly_rate' => 50.00,
                'status' => 'available',
            ]
        );

        $this->product = Product::firstOrCreate(
            ['name' => 'Red Bull Energy Test'],
            [
                'name_ar' => 'ريد بول طاقة تيست',
                'category' => 'cold_drinks',
                'price' => 40.00,
                'cost_price' => 28.00,
                'stock_quantity' => 50,
                'reorder_level' => 10,
            ]
        );
    }

    public function test_device_session_lifecycle_start_and_end_with_credit()
    {
        $this->device->update(['status' => 'available']);

        // 1. Start a fixed 60-minute session
        $startRes = $this->actingAs($this->user)->postJson("/api/devices/{$this->device->id}/session/start", [
            'duration_minutes' => 60,
            'customer_name' => 'أحمد حسام',
            'customer_phone' => '01012345678',
        ]);
        $startRes->assertStatus(201);
        $sessionId = $startRes->json('session.id');
        $this->assertNotNull($sessionId);
        $this->assertEquals('active', $this->device->fresh()->status);

        // 2. Add beverage to session
        $bevRes = $this->actingAs($this->user)->postJson("/api/sessions/{$sessionId}/add-beverage", [
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 2]
            ]
        ]);
        $bevRes->assertStatus(200);

        // 3. End session on credit (آجل)
        $endRes = $this->actingAs($this->user)->postJson("/api/sessions/{$sessionId}/end", [
            'payment_method' => 'credit',
            'customer_name' => 'أحمد حسام',
            'customer_phone' => '01012345678',
        ]);
        $endRes->assertStatus(200)
            ->assertJsonPath('receipt.payment_status', 'unpaid')
            ->assertJsonPath('receipt.payment_method', 'credit');

        // Check device freed
        $this->assertEquals('available', $this->device->fresh()->status);

        // Check debt created
        $this->assertDatabaseHas('customer_debts', [
            'device_session_id' => $sessionId,
        ]);
    }

    public function test_cafe_pos_order_and_inventory_deduction()
    {
        $initialStock = $this->product->fresh()->stock_quantity;

        $orderRes = $this->actingAs($this->user)->postJson('/api/orders', [
            'order_type' => 'take_away',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 3]
            ],
            'payment_method' => 'cash',
        ]);

        $orderRes->assertStatus(201);
        $this->assertEquals($initialStock - 3, $this->product->fresh()->stock_quantity);

        $this->assertDatabaseHas('inventory_logs', [
            'product_id' => $this->product->id,
            'quantity_change' => -3,
            'reason' => 'sale',
        ]);
    }

    public function test_customer_debt_archive_and_restore_cycle()
    {
        $uniquePhone = '010' . rand(10000000, 99999999);
        $customer = Customer::create([
            'name' => 'عميل تجربة الأرشفة',
            'phone' => $uniquePhone,
            'is_archived' => false,
        ]);

        $debt = CustomerDebt::create([
            'customer_id' => $customer->id,
            'amount' => 120.00,
            'paid_amount' => 0.00,
            'description' => 'حساب قديم',
            'status' => 'open',
        ]);

        // Attempt delete while debt is open -> should fail with 422
        $delRes = $this->actingAs($this->user)->deleteJson("/api/customer-debts/{$customer->id}");
        $delRes->assertStatus(422);

        // Archive customer
        $archiveRes = $this->actingAs($this->user)->postJson("/api/customer-debts/{$customer->id}/archive");
        $archiveRes->assertStatus(200);
        $this->assertTrue((bool)$customer->fresh()->is_archived);

        // Pay debt partially
        $payRes = $this->actingAs($this->user)->postJson("/api/customer-debts/{$debt->id}/pay", [
            'amount' => 50.00,
            'payment_method' => 'cash',
        ]);
        $payRes->assertStatus(200);
        $this->assertEquals(50.00, (float)$debt->fresh()->paid_amount);

        // Settle remaining debt
        $payRemainingRes = $this->actingAs($this->user)->postJson("/api/customer-debts/{$debt->id}/pay", [
            'amount' => 70.00,
            'payment_method' => 'cash',
        ]);
        $payRemainingRes->assertStatus(200);
        $this->assertEquals('paid', $debt->fresh()->status);

        // Restore customer from archive
        $restoreRes = $this->actingAs($this->user)->postJson("/api/customer-debts/{$customer->id}/restore");
        $restoreRes->assertStatus(200);
        $this->assertFalse((bool)$customer->fresh()->is_archived);
    }

    public function test_shift_and_drawer_cash_calculation()
    {
        // 1. Start shift
        $startShiftRes = $this->actingAs($this->user)->postJson('/api/shifts/start', [
            'notes' => 'شيفت اختبار شامل',
        ]);
        $startShiftRes->assertStatus(201);
        $shiftId = $startShiftRes->json('shift.id');

        // 2. Add an expense
        $expRes = $this->actingAs($this->user)->postJson('/api/expenses', [
            'category' => 'hospitality',
            'description' => 'شراء نعناع ومستلزمات شاي',
            'amount' => 25.00,
            'payment_method' => 'cash',
            'expense_date' => Carbon::now()->toDateString(),
        ]);
        $expRes->assertStatus(201);

        // 3. Current shift metrics check
        $currentRes = $this->actingAs($this->user)->getJson('/api/shifts/current');
        $currentRes->assertStatus(200)
            ->assertJsonPath('active', true)
            ->assertJsonPath('shift.id', $shiftId);

        // 4. Close shift
        $closeRes = $this->actingAs($this->user)->postJson("/api/shifts/{$shiftId}/close", [
            'cash_counted' => 100.00,
            'notes' => 'تقفيل شيفت الاختبار',
        ]);
        $closeRes->assertStatus(200)
            ->assertJsonPath('shift.status', 'closed');
    }

    public function test_statement_report_ledger()
    {
        $todayRes = $this->actingAs($this->user)->getJson('/api/reports/statement?type=all&payment_method=all');
        $todayRes->assertStatus(200)
            ->assertJsonStructure([
                'period',
                'summary' => [
                    'total_income',
                    'total_expenses',
                    'cash_in',
                    'cash_out',
                ],
                'transactions',
            ]);
    }
}
