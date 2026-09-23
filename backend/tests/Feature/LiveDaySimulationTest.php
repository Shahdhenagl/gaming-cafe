<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerDebt;
use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\Expense;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Shift;
use App\Models\User;
use Carbon\Carbon;
use Tests\TestCase;

class LiveDaySimulationTest extends TestCase
{
    protected User $superAdmin;
    protected User $cashier;
    protected Device $ps5;
    protected Device $billiards;
    protected Product $redBull;
    protected Product $coffee;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Setup Users
        $this->superAdmin = User::firstOrCreate(
            ['email' => 'super_simulation@al5al.com'],
            [
                'name' => 'Super Admin Manager',
                'password' => bcrypt('sim_pass_123'),
                'pin_code' => '1111',
                'role' => 'super_admin',
            ]
        );

        $this->cashier = User::firstOrCreate(
            ['email' => 'cashier_simulation@al5al.com'],
            [
                'name' => 'كاشير الصالة',
                'password' => bcrypt('sim_pass_123'),
                'pin_code' => '2222',
                'role' => 'staff',
            ]
        );

        // 2. Setup Devices
        $this->ps5 = Device::firstOrCreate(
            ['device_name' => 'PS5 VIP Simulation #1'],
            [
                'room_name' => 'VIP Room',
                'device_type' => 'ps5',
                'hourly_rate' => 50.00,
                'status' => 'available',
            ]
        );

        $this->billiards = Device::firstOrCreate(
            ['device_name' => 'Billiards Pro Table #1'],
            [
                'room_name' => 'Billiards Hall',
                'device_type' => 'billiards',
                'hourly_rate' => 45.00,
                'status' => 'available',
            ]
        );

        // 3. Setup Cafe Inventory
        $this->redBull = Product::firstOrCreate(
            ['name' => 'Red Bull Sim Energy'],
            [
                'name_ar' => 'ريد بول طاقة محاكاة',
                'category' => 'cold_drinks',
                'price' => 40.00,
                'cost_price' => 28.00,
                'stock_quantity' => 100,
                'reorder_level' => 10,
            ]
        );

        $this->coffee = Product::firstOrCreate(
            ['name' => 'Double Espresso Sim'],
            [
                'name_ar' => 'اسبريسو دبل محاكاة',
                'category' => 'hot_drinks',
                'price' => 25.00,
                'cost_price' => 8.00,
                'stock_quantity' => 150,
                'reorder_level' => 15,
            ]
        );
    }

    public function test_full_day_live_lifecycle_simulation()
    {
        // ---------------------------------------------------------------------
        // STEP 1: فتح الوردية (Start Cashier Shift)
        // ---------------------------------------------------------------------
        $startShiftRes = $this->actingAs($this->cashier)->postJson('/api/shifts/start', [
            'notes' => 'بداية وردية العمل الصباحية',
        ]);
        $startShiftRes->assertStatus(201);
        $shiftId = $startShiftRes->json('shift.id');
        $this->assertNotNull($shiftId);

        // ---------------------------------------------------------------------
        // STEP 2: جلسة بلايستيشن كاش مع إضافة مشاريب وتمديد وقت
        // (PS5 Session: 60 min (50 EGP) + 2x Red Bull (80 EGP) = 130 EGP Paid CASH)
        // ---------------------------------------------------------------------
        $this->ps5->update(['status' => 'available']);
        $psStartRes = $this->actingAs($this->cashier)->postJson("/api/devices/{$this->ps5->id}/session/start", [
            'duration_minutes' => 60,
            'customer_name' => 'كريم الألفي',
            'customer_phone' => '01011112222',
        ]);
        $psStartRes->assertStatus(201);
        $psSessionId = $psStartRes->json('session.id');

        // Add 2 Red Bulls
        $bevRes = $this->actingAs($this->cashier)->postJson("/api/sessions/{$psSessionId}/add-beverage", [
            'items' => [
                ['product_id' => $this->redBull->id, 'quantity' => 2]
            ]
        ]);
        $bevRes->assertStatus(200);

        // End PS5 Session with CASH
        $psEndRes = $this->actingAs($this->cashier)->postJson("/api/sessions/{$psSessionId}/end", [
            'payment_method' => 'cash',
        ]);
        $psEndRes->assertStatus(200)
            ->assertJsonPath('receipt.total_amount', 130)
            ->assertJsonPath('receipt.payment_method', 'cash')
            ->assertJsonPath('receipt.payment_status', 'paid');

        // ---------------------------------------------------------------------
        // STEP 3: جلسة بلياردو على الآجل (Billiards Session: 60 min (45 EGP) Paid CREDIT)
        // ---------------------------------------------------------------------
        $this->billiards->update(['status' => 'available']);
        $bilStartRes = $this->actingAs($this->cashier)->postJson("/api/devices/{$this->billiards->id}/session/start", [
            'duration_minutes' => 60,
            'customer_name' => 'محمود عزت',
            'customer_phone' => '01098765432',
        ]);
        $bilStartRes->assertStatus(201);
        $bilSessionId = $bilStartRes->json('session.id');

        // End Billiards Session with CREDIT (آجل)
        $bilEndRes = $this->actingAs($this->cashier)->postJson("/api/sessions/{$bilSessionId}/end", [
            'payment_method' => 'credit',
            'customer_name' => 'محمود عزت',
            'customer_phone' => '01098765432',
        ]);
        $bilEndRes->assertStatus(200)
            ->assertJsonPath('receipt.total_amount', 45)
            ->assertJsonPath('receipt.payment_method', 'credit')
            ->assertJsonPath('receipt.payment_status', 'unpaid');

        // Verify debt was created for Mahmoud
        $mahmoudDebt = CustomerDebt::where('device_session_id', $bilSessionId)->first();
        $this->assertNotNull($mahmoudDebt);
        $this->assertEquals(45.00, (float)$mahmoudDebt->amount);

        // ---------------------------------------------------------------------
        // STEP 4: تسجيل جلسة أوفلاين سابقة كاش (Manual / Offline Session: 60 EGP CASH)
        // ---------------------------------------------------------------------
        $manualRes = $this->actingAs($this->cashier)->postJson('/api/sessions/manual', [
            'device_id' => $this->ps5->id,
            'customer_name' => 'طارق زيدان',
            'customer_phone' => '01055556666',
            'duration_minutes' => 60,
            'hourly_rate' => 60,
            'session_cost' => 60,
            'discount' => 0,
            'payment_method' => 'cash',
        ]);
        $manualRes->assertStatus(201)
            ->assertJsonPath('session.total_amount', 60)
            ->assertJsonPath('session.payment_status', 'paid');

        // ---------------------------------------------------------------------
        // STEP 5: طلب كافيه تيك أواي كاش (Cafe POS: 1x Red Bull (40) + 2x Coffee (50) = 90 EGP CASH)
        // ---------------------------------------------------------------------
        $cafeRes = $this->actingAs($this->cashier)->postJson('/api/orders', [
            'order_type' => 'take_away',
            'items' => [
                ['product_id' => $this->redBull->id, 'quantity' => 1],
                ['product_id' => $this->coffee->id, 'quantity' => 2],
            ],
            'payment_method' => 'cash',
        ]);
        $cafeRes->assertStatus(201)
            ->assertJsonPath('order.total_amount', 90)
            ->assertJsonPath('order.payment_status', 'paid');

        // ---------------------------------------------------------------------
        // STEP 6: سحب مصروف من الدرج (Cash Expense: 35 EGP CASH)
        // ---------------------------------------------------------------------
        $expRes = $this->actingAs($this->cashier)->postJson('/api/expenses', [
            'category' => 'hospitality',
            'description' => 'شراء نعناع وسكر وأكواب ورقية',
            'amount' => 35.00,
            'payment_method' => 'cash',
            'expense_date' => Carbon::now()->toDateString(),
        ]);
        $expRes->assertStatus(201);

        // ---------------------------------------------------------------------
        // STEP 7: تحصيل دفعة من دين آجل في الدرج (Debt Collection: 25 EGP CASH)
        // ---------------------------------------------------------------------
        $payDebtRes = $this->actingAs($this->cashier)->postJson("/api/customer-debts/{$mahmoudDebt->id}/pay", [
            'amount' => 25.00,
            'payment_method' => 'cash',
            'notes' => 'سداد جزء من حساب البلياردو نقداً',
        ]);
        $payDebtRes->assertStatus(200);
        $this->assertEquals(25.00, (float)$mahmoudDebt->fresh()->paid_amount);
        $this->assertEquals('partial', $mahmoudDebt->fresh()->status);

        // ---------------------------------------------------------------------
        // STEP 8: فحص الميزان المالي للدرج بدقة مليمترية (Shift Metrics Audit)
        // Expected Cash In = 130 (PS5) + 60 (Manual) + 90 (Cafe) + 25 (Debt collection) = 305 EGP
        // Expected Cash Out = 35 (Expense)
        // Expected Net Cash in Drawer = 305 - 35 = 270 EGP
        // ---------------------------------------------------------------------
        $shiftMetricsRes = $this->actingAs($this->cashier)->getJson('/api/shifts/current');
        $shiftMetricsRes->assertStatus(200);

        $metrics = $shiftMetricsRes->json('metrics');
        $this->assertNotNull($metrics);

        // Cash revenue should be exactly 305 EGP
        $this->assertEquals(305.00, (float)$metrics['cash_revenue'], 'Cash revenue in shift must exactly sum all cash inputs');

        // Cash expenses should be exactly 35 EGP
        $this->assertEquals(35.00, (float)$metrics['cash_expenses'], 'Cash expenses must exactly match expenses taken from drawer');

        // Total cash in drawer right now must be exactly 270 EGP
        $this->assertEquals(270.00, (float)$metrics['cash_collected'], 'Cash collected in drawer must be exactly 270 EGP');

        // ---------------------------------------------------------------------
        // STEP 9: فحص كشف الحساب وسجل العمليات التفصيلي (Operations Statement Audit)
        // ---------------------------------------------------------------------
        $stmtRes = $this->actingAs($this->superAdmin)->getJson('/api/reports/statement?type=all&payment_method=all');
        $stmtRes->assertStatus(200);

        $summary = $stmtRes->json('summary');
        $this->assertNotNull($summary);
        $this->assertGreaterThanOrEqual(305.00, (float)$summary['cash_in']);
        $this->assertGreaterThanOrEqual(35.00, (float)$summary['cash_out']);

        // Transactions list must contain all recorded operational actions
        $transactions = collect($stmtRes->json('transactions'));
        $this->assertTrue($transactions->contains(fn($t) => str_contains($t['title'] ?? '', 'كريم الألفي') || str_contains($t['id'] ?? '', 'session-')));
        $this->assertTrue($transactions->contains(fn($t) => str_contains($t['title'] ?? '', 'طارق زيدان') || $t['type'] === 'gaming'));
        $this->assertTrue($transactions->contains(fn($t) => $t['type'] === 'cafe'));
        $this->assertTrue($transactions->contains(fn($t) => $t['type'] === 'expense'));
        $this->assertTrue($transactions->contains(fn($t) => $t['type'] === 'debt_payment'));

        // ---------------------------------------------------------------------
        // STEP 10: تقفيل الشيفت ومطابقة الخزينة (Shift Closing & Treasury Settlement)
        // ---------------------------------------------------------------------
        $closeRes = $this->actingAs($this->cashier)->postJson("/api/shifts/{$shiftId}/close", [
            'cash_counted' => 270.00,
            'notes' => 'تقفيل الوردية ومطابقة تامة للدرج بدون أي عجز',
        ]);
        $closeRes->assertStatus(200)
            ->assertJsonPath('shift.status', 'closed')
            ->assertJsonPath('shift.cash_collected', 270);

        // Verify shift is closed
        $this->assertEquals('closed', Shift::find($shiftId)->status);
    }
}
