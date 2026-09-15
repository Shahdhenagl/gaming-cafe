<?php

namespace Database\Seeders;

use App\Models\Device;
use App\Models\DeviceSession;
use App\Models\InventoryLog;
use App\Models\Notification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Shift;
use App\Models\Table;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create Users (Karim, Al-Ghareeb, Staff)
        $admin = User::create([
            'name' => 'Karim - كريم',
            'email' => 'admin@al5al.com',
            'password' => Hash::make('password123'),
            'pin_code' => '1234',
            'phone' => '01032890430',
            'role' => 'admin',
            'avatar' => 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        ]);

        $manager = User::create([
            'name' => 'Al-Ghareeb - الغريب',
            'email' => 'ghareeb@al5al.com',
            'password' => Hash::make('password123'),
            'pin_code' => '5678',
            'phone' => '01289535503',
            'role' => 'manager',
            'avatar' => 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        ]);

        $staff = User::create([
            'name' => 'Cashier - كاشير الصالة',
            'email' => 'staff@al5al.com',
            'password' => Hash::make('password123'),
            'pin_code' => '0000',
            'phone' => '0502943796',
            'role' => 'staff',
            'avatar' => 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        ]);

        // 2. Create Active Shift for Karim
        $shift = Shift::create([
            'staff_id' => $staff->id,
            'start_time' => Carbon::now()->subHours(3),
            'status' => 'active',
            'total_before_deductions' => 640.00,
            'total_after_deductions' => 640.00,
            'cash_collected' => 380.00,
            'card_collected' => 260.00,
            'notes' => 'وردية الصباح - صالة الخال',
        ]);

        $staff->update(['shift_id' => $shift->id]);

        // 3. Create Products / Cafe Items (Egyptian Pound EGP)
        $productsData = [
            // Hot Drinks
            ['name' => 'Turkish Coffee Double', 'name_ar' => 'قهوة تركي دبل (سادة / مظبوط)', 'category' => 'hot_drinks', 'price' => 20.00, 'cost_price' => 6.00, 'stock_quantity' => 150, 'reorder_level' => 20],
            ['name' => 'Egyptian Tea Special', 'name_ar' => 'شاي ميزة بالنعناع', 'category' => 'hot_drinks', 'price' => 12.00, 'cost_price' => 3.00, 'stock_quantity' => 200, 'reorder_level' => 30],
            ['name' => 'Espresso Double', 'name_ar' => 'دبل إسبريسو إيطالي', 'category' => 'hot_drinks', 'price' => 25.00, 'cost_price' => 7.00, 'stock_quantity' => 120, 'reorder_level' => 15],
            ['name' => 'Hot Spanish Latte', 'name_ar' => 'سبانش لاتيه حار', 'category' => 'hot_drinks', 'price' => 35.00, 'cost_price' => 12.00, 'stock_quantity' => 80, 'reorder_level' => 15],
            ['name' => 'Hot Chocolate Marshmallow', 'name_ar' => 'هوت شوكليت مارشميلو', 'category' => 'hot_drinks', 'price' => 35.00, 'cost_price' => 12.00, 'stock_quantity' => 70, 'reorder_level' => 10],

            // Cold Drinks
            ['name' => 'Iced Spanish Latte', 'name_ar' => 'آيس سبانش لاتيه', 'category' => 'cold_drinks', 'price' => 40.00, 'cost_price' => 14.00, 'stock_quantity' => 90, 'reorder_level' => 15],
            ['name' => 'Iced Caramel Macchiato', 'name_ar' => 'آيس كراميل ماكياتو', 'category' => 'cold_drinks', 'price' => 40.00, 'cost_price' => 14.00, 'stock_quantity' => 75, 'reorder_level' => 15],
            ['name' => 'Mojito Blueberry Energy', 'name_ar' => 'موهيتو توت أزرق منعش', 'category' => 'cold_drinks', 'price' => 35.00, 'cost_price' => 10.00, 'stock_quantity' => 60, 'reorder_level' => 10],
            ['name' => 'Iced Peach Tea', 'name_ar' => 'آيس تي خوخ منعش', 'category' => 'cold_drinks', 'price' => 25.00, 'cost_price' => 8.00, 'stock_quantity' => 80, 'reorder_level' => 15],

            // Soft Drinks & Energy
            ['name' => 'Red Bull Energy Can', 'name_ar' => 'ريد بول كلاسيك 250 مل', 'category' => 'soft_drinks', 'price' => 45.00, 'cost_price' => 30.00, 'stock_quantity' => 6, 'reorder_level' => 10],
            ['name' => 'Pepsi Can 330ml', 'name_ar' => 'بيبسي كانز 330 مل', 'category' => 'soft_drinks', 'price' => 15.00, 'cost_price' => 9.00, 'stock_quantity' => 140, 'reorder_level' => 20],
            ['name' => '7Up Lemon Can', 'name_ar' => 'سفن أب كانز 330 مل', 'category' => 'soft_drinks', 'price' => 15.00, 'cost_price' => 9.00, 'stock_quantity' => 100, 'reorder_level' => 20],
            ['name' => 'Mineral Water 600ml', 'name_ar' => 'مياه معدنية 600 مل', 'category' => 'soft_drinks', 'price' => 8.00, 'cost_price' => 4.00, 'stock_quantity' => 180, 'reorder_level' => 30],

            // Snacks & Food
            ['name' => 'Cheesy Gaming Nachos', 'name_ar' => 'ناتشوز بالجبنة الشيدر والهلابينو', 'category' => 'snacks', 'price' => 45.00, 'cost_price' => 18.00, 'stock_quantity' => 40, 'reorder_level' => 10],
            ['name' => 'Nutella Waffle', 'name_ar' => 'وافل بالنوتيلا والمكسرات', 'category' => 'food', 'price' => 45.00, 'cost_price' => 18.00, 'stock_quantity' => 30, 'reorder_level' => 8],
            ['name' => 'French Fries Cheesy', 'name_ar' => 'بطاطس مقلية بالجبنة', 'category' => 'snacks', 'price' => 30.00, 'cost_price' => 10.00, 'stock_quantity' => 50, 'reorder_level' => 10],
            ['name' => 'Double Chocolate Cookie', 'name_ar' => 'كوكيز شوكولاتة طازج', 'category' => 'snacks', 'price' => 20.00, 'cost_price' => 7.00, 'stock_quantity' => 60, 'reorder_level' => 15],
        ];

        $products = [];
        foreach ($productsData as $item) {
            $p = Product::create($item);
            $products[$item['name']] = $p;
            InventoryLog::create([
                'product_id' => $p->id,
                'quantity_change' => $p->stock_quantity,
                'reason' => 'restock',
                'staff_id' => $staff->id,
            ]);
        }

        // 4. Create Gaming & Sports Devices / Stations (Billiards, PlayStation, Ping Pong)
        $devices = [
            // PlayStation Arena
            ['room_name' => 'PlayStation Arena', 'device_name' => 'PS5 Station 01', 'device_name_ar' => 'بلايستيشن 1 (PS5)', 'device_type' => 'ps5', 'hourly_rate' => 45.00, 'status' => 'active', 'specs' => 'Sony PS5 + 65" 4K 120Hz + 2 Controllers'],
            ['room_name' => 'PlayStation Arena', 'device_name' => 'PS5 Station 02', 'device_name_ar' => 'بلايستيشن 2 (PS5)', 'device_type' => 'ps5', 'hourly_rate' => 45.00, 'status' => 'active', 'specs' => 'Sony PS5 + 65" 4K 120Hz + 4 Controllers'],
            ['room_name' => 'PlayStation Arena', 'device_name' => 'PS4 Station 03', 'device_name_ar' => 'بلايستيشن 3 (PS4 Pro)', 'device_type' => 'ps4', 'hourly_rate' => 30.00, 'status' => 'available', 'specs' => 'Sony PS4 Pro + 55" 4K HDR + 2 Controllers'],
            ['room_name' => 'VIP Cyber Suite', 'device_name' => 'VIP PlayStation Room', 'device_name_ar' => 'غرفة VIP بلايستيشن', 'device_type' => 'ps5', 'hourly_rate' => 75.00, 'status' => 'available', 'specs' => 'غرفة خاصة مكيفة + شاشة 85 بوصة + ساوند سيستم 5.1'],

            // Billiards Arena
            ['room_name' => 'Billiards Arena', 'device_name' => 'Billiard Table 01', 'device_name_ar' => 'طاولة بلياردو 1 (رئيسية)', 'device_type' => 'billiards', 'hourly_rate' => 50.00, 'status' => 'active', 'specs' => 'طاولة بلياردو احترافية 9 قدم + طقم كرات آراميث + إضاءة LED مركزة'],
            ['room_name' => 'Billiards Arena', 'device_name' => 'Billiard Table 02', 'device_name_ar' => 'طاولة بلياردو 2', 'device_type' => 'billiards', 'hourly_rate' => 50.00, 'status' => 'available', 'specs' => 'طاولة بلياردو احترافية 9 قدم + عصايات كربون'],
            ['room_name' => 'Billiards Arena', 'device_name' => 'Billiard Table 03', 'device_name_ar' => 'طاولة بلياردو 3', 'device_type' => 'billiards', 'hourly_rate' => 50.00, 'status' => 'available', 'specs' => 'طاولة بلياردو احترافية 9 قدم'],

            // Ping Pong Bay
            ['room_name' => 'Ping Pong Bay', 'device_name' => 'Ping Pong Table 01', 'device_name_ar' => 'طاولة بينج بونج 1', 'device_type' => 'pingpong', 'hourly_rate' => 35.00, 'status' => 'active', 'specs' => 'طاولة تنس طاولة دولية + مضارب Donic احترافية'],
            ['room_name' => 'Ping Pong Bay', 'device_name' => 'Ping Pong Table 02', 'device_name_ar' => 'طاولة بينج بونج 2', 'device_type' => 'pingpong', 'hourly_rate' => 35.00, 'status' => 'available', 'specs' => 'طاولة تنس طاولة دولية + شبكة احترافية'],
        ];

        $devModels = [];
        foreach ($devices as $d) {
            $devModels[$d['device_name']] = Device::create($d);
        }

        // 5. Create Active Sessions with Timers
        // Session 1: PS5 Station 01 (Started 45 mins ago, 60 mins duration -> 15 mins remaining)
        $s1Start = Carbon::now()->subMinutes(45);
        $s1End = (clone $s1Start)->addMinutes(60);
        $session1 = DeviceSession::create([
            'device_id' => $devModels['PS5 Station 01']->id,
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'customer_name' => 'Ziyad & Friends',
            'customer_phone' => '+966551234567',
            'start_time' => $s1Start,
            'end_time' => $s1End,
            'duration_minutes' => 60,
            'status' => 'active',
            'hourly_rate' => 40.00,
            'session_cost' => 40.00,
            'beverage_cost' => 47.00,
            'total_amount' => 87.00,
            'paid_amount' => 0.00,
            'payment_status' => 'unpaid',
        ]);

        // Session 2: PS5 Station 02 (Ending in 7 minutes! -> Yellow Warning)
        $s2Start = Carbon::now()->subMinutes(53);
        $s2End = (clone $s2Start)->addMinutes(60);
        $session2 = DeviceSession::create([
            'device_id' => $devModels['PS5 Station 02']->id,
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'customer_name' => 'Ahmed Tariq',
            'customer_phone' => '+966567890123',
            'start_time' => $s2Start,
            'end_time' => $s2End,
            'duration_minutes' => 60,
            'status' => 'active',
            'hourly_rate' => 40.00,
            'session_cost' => 40.00,
            'beverage_cost' => 18.00,
            'total_amount' => 58.00,
            'paid_amount' => 0.00,
            'payment_status' => 'unpaid',
        ]);

        // Session 3: Billiard Table 01 (Started 25 mins ago, 60 mins duration)
        $s3Start = Carbon::now()->subMinutes(25);
        $s3End = (clone $s3Start)->addMinutes(60);
        $session3 = DeviceSession::create([
            'device_id' => $devModels['Billiard Table 01']->id,
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'customer_name' => 'Mohamed & Tamer (Billiards)',
            'customer_phone' => '01011223344',
            'start_time' => $s3Start,
            'end_time' => $s3End,
            'duration_minutes' => 60,
            'status' => 'active',
            'hourly_rate' => 50.00,
            'session_cost' => 50.00,
            'beverage_cost' => 35.00,
            'total_amount' => 85.00,
            'paid_amount' => 0.00,
            'payment_status' => 'unpaid',
        ]);

        // Session 4: Ping Pong Table 01 (Match started 15 mins ago, 45 mins)
        $s4Start = Carbon::now()->subMinutes(15);
        $s4End = (clone $s4Start)->addMinutes(45);
        $session4 = DeviceSession::create([
            'device_id' => $devModels['Ping Pong Table 01']->id,
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'customer_name' => 'Hazem & Omar (Ping Pong)',
            'customer_phone' => '01122334455',
            'start_time' => $s4Start,
            'end_time' => $s4End,
            'duration_minutes' => 45,
            'status' => 'active',
            'hourly_rate' => 35.00,
            'session_cost' => 26.25,
            'beverage_cost' => 30.00,
            'total_amount' => 56.25,
            'paid_amount' => 0.00,
            'payment_status' => 'unpaid',
        ]);

        // 6. Create Tables
        $tablesData = [
            ['table_number' => 'T-01', 'capacity' => 2, 'status' => 'available'],
            ['table_number' => 'T-02', 'capacity' => 4, 'status' => 'occupied'],
            ['table_number' => 'T-03', 'capacity' => 4, 'status' => 'occupied'],
            ['table_number' => 'T-04', 'capacity' => 6, 'status' => 'available'],
            ['table_number' => 'T-05', 'capacity' => 2, 'status' => 'available'],
            ['table_number' => 'T-06', 'capacity' => 4, 'status' => 'available'],
            ['table_number' => 'T-07', 'capacity' => 6, 'status' => 'occupied'],
            ['table_number' => 'T-08', 'capacity' => 8, 'status' => 'available'],
        ];

        $tables = [];
        foreach ($tablesData as $t) {
            $tables[$t['table_number']] = Table::create($t);
        }

        // Table 2 Order
        $orderT2 = Order::create([
            'order_number' => 'ORD-' . strtoupper(bin2hex(random_bytes(3))),
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'status' => 'completed',
            'order_type' => 'dine_in',
            'table_id' => $tables['T-02']->id,
            'subtotal' => 72.00,
            'discount' => 0.00,
            'tax' => 0.00,
            'total_amount' => 72.00,
            'payment_status' => 'unpaid',
            'notes' => 'Extra ice for Spanish Latte',
        ]);
        OrderItem::create(['order_id' => $orderT2->id, 'product_id' => $products['Iced Spanish Latte']->id, 'quantity' => 2, 'unit_price' => 40.00, 'subtotal' => 80.00]);
        OrderItem::create(['order_id' => $orderT2->id, 'product_id' => $products['Hot Spanish Latte']->id, 'quantity' => 1, 'unit_price' => 35.00, 'subtotal' => 35.00]);
        $tables['T-02']->update(['current_order_id' => $orderT2->id, 'total_spent' => 115.00]);

        // Table 3 Order
        $orderT3 = Order::create([
            'order_number' => 'ORD-' . strtoupper(bin2hex(random_bytes(3))),
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'status' => 'completed',
            'order_type' => 'dine_in',
            'table_id' => $tables['T-03']->id,
            'subtotal' => 90.00,
            'discount' => 0.00,
            'tax' => 0.00,
            'total_amount' => 90.00,
            'payment_status' => 'unpaid',
            'notes' => 'Table by the window',
        ]);
        OrderItem::create(['order_id' => $orderT3->id, 'product_id' => $products['Cheesy Gaming Nachos']->id, 'quantity' => 1, 'unit_price' => 45.00, 'subtotal' => 45.00]);
        OrderItem::create(['order_id' => $orderT3->id, 'product_id' => $products['Nutella Waffle']->id, 'quantity' => 1, 'unit_price' => 45.00, 'subtotal' => 45.00]);
        $tables['T-03']->update(['current_order_id' => $orderT3->id, 'total_spent' => 90.00]);

        // Table 7 Order
        $orderT7 = Order::create([
            'order_number' => 'ORD-' . strtoupper(bin2hex(random_bytes(3))),
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'status' => 'completed',
            'order_type' => 'dine_in',
            'table_id' => $tables['T-07']->id,
            'subtotal' => 145.00,
            'discount' => 10.00,
            'tax' => 0.00,
            'total_amount' => 135.00,
            'payment_status' => 'unpaid',
        ]);
        OrderItem::create(['order_id' => $orderT7->id, 'product_id' => $products['Mojito Blueberry Energy']->id, 'quantity' => 3, 'unit_price' => 35.00, 'subtotal' => 105.00]);
        OrderItem::create(['order_id' => $orderT7->id, 'product_id' => $products['Double Chocolate Cookie']->id, 'quantity' => 2, 'unit_price' => 20.00, 'subtotal' => 40.00]);
        $tables['T-07']->update(['current_order_id' => $orderT7->id, 'total_spent' => 135.00]);

        // Orders linked to gaming sessions
        $orderS1 = Order::create([
            'order_number' => 'ORD-' . strtoupper(bin2hex(random_bytes(3))),
            'shift_id' => $shift->id,
            'staff_id' => $staff->id,
            'status' => 'completed',
            'order_type' => 'gaming_room',
            'device_session_id' => $session1->id,
            'subtotal' => 75.00,
            'total_amount' => 75.00,
            'payment_status' => 'unpaid',
        ]);
        OrderItem::create(['order_id' => $orderS1->id, 'product_id' => $products['Iced Spanish Latte']->id, 'quantity' => 1, 'unit_price' => 40.00, 'subtotal' => 40.00]);
        OrderItem::create(['order_id' => $orderS1->id, 'product_id' => $products['Hot Spanish Latte']->id, 'quantity' => 1, 'unit_price' => 35.00, 'subtotal' => 35.00]);

        // Notifications
        Notification::create([
            'user_id' => $staff->id,
            'type' => 'session_ending',
            'title' => 'PS5 Station 02 Ending in 7 Minutes',
            'message' => 'Customer Ahmed Tariq session is nearing its 60 min end time. Check for extension.',
            'related_to' => (string)$session2->id,
            'is_read' => false,
        ]);

        Notification::create([
            'user_id' => $staff->id,
            'type' => 'low_stock',
            'title' => 'Low Stock Alert: Red Bull Energy',
            'message' => 'Only 6 cans remaining in inventory (Reorder level is 10).',
            'related_to' => (string)$products['Red Bull Energy Can']->id,
            'is_read' => false,
        ]);
    }
}
