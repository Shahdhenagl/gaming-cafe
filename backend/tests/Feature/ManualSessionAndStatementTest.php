<?php

namespace Tests\Feature;

use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\Customer;
use App\Models\CustomerDebt;
use App\Models\Shift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ManualSessionAndStatementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Ensure we have an admin user and a device
        $this->user = User::firstOrCreate(
            ['email' => 'admin_test@al5al.com'],
            [
                'name' => 'Super Admin Tester',
                'password' => bcrypt('password123'),
                'pin_code' => '9999',
                'role' => 'super_admin',
            ]
        );

        $this->device = Device::firstOrCreate(
            ['device_name' => 'Billiards VIP 01'],
            [
                'room_name' => 'Billiards Hall',
                'device_type' => 'billiards',
                'hourly_rate' => 45.00,
                'status' => 'active',
            ]
        );
    }

    public function test_can_create_manual_session_with_credit()
    {
        $response = $this->actingAs($this->user)->postJson('/api/sessions/manual', [
            'device_id' => $this->device->id,
            'customer_name' => 'عميل اختبار آجل',
            'customer_phone' => '01099998888',
            'duration_minutes' => 60,
            'hourly_rate' => 45,
            'session_cost' => 45,
            'discount' => 0,
            'payment_method' => 'credit',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('session.customer_name', 'عميل اختبار آجل')
            ->assertJsonPath('session.payment_status', 'unpaid')
            ->assertJsonPath('session.status', 'ended');

        $this->assertDatabaseHas('customers', [
            'phone' => '01099998888',
        ]);

        $this->assertDatabaseHas('customer_debts', [
            'amount' => 45.00,
            'status' => 'open',
        ]);
    }

    public function test_super_admin_role_helpers()
    {
        $superAdmin = new User(['role' => 'super_admin']);
        $this->assertTrue($superAdmin->isSuperAdmin());
        $this->assertTrue($superAdmin->isAdmin());
        $this->assertTrue($superAdmin->isManager());

        $manager = new User(['role' => 'manager']);
        $this->assertFalse($manager->isSuperAdmin());
        $this->assertFalse($manager->isAdmin());
        $this->assertTrue($manager->isManager());

        $staff = new User(['role' => 'staff']);
        $this->assertFalse($staff->isSuperAdmin());
        $this->assertFalse($staff->isAdmin());
        $this->assertFalse($staff->isManager());
    }

    public function test_statement_handles_undefined_params_gracefully()
    {
        $response = $this->actingAs($this->user)->getJson('/api/reports/statement?date=' . date('Y-m-d') . '&type=undefined&payment_method=undefined');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'period' => ['type', 'label', 'start_date', 'end_date'],
                'summary' => ['total_income', 'total_expenses', 'net_income', 'transactions_count'],
                'transactions',
            ]);
    }
}
