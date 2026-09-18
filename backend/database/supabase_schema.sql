-- ==============================================================================
-- AL5AL Gaming & Lounge (صالة الخال للألعاب والبلياردو والكافيه)
-- COMPLETE SUPABASE / POSTGRESQL DATABASE SCHEMA & SEED DATA
-- Currency: EGP (جنيه مصري)
-- Generated for Supabase SQL Editor & PostgreSQL Database
-- ==============================================================================

-- 1. CLEANUP OLD TABLES (IF RE-RUNNING)
DROP TABLE IF EXISTS shift_reports CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS inventory_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS tables CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS session_extensions CASCADE;
DROP TABLE IF EXISTS device_sessions CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS personal_access_tokens CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. USERS TABLE
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    pin_code VARCHAR(10),
    phone VARCHAR(50),
    role VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
    shift_id BIGINT,
    avatar TEXT,
    email_verified_at TIMESTAMPTZ,
    password VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_pin ON users(pin_code);

-- 3. PERSONAL ACCESS TOKENS (LARAVEL SANCTUM)
CREATE TABLE personal_access_tokens (
    id BIGSERIAL PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    abilities TEXT,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_pat_tokenable ON personal_access_tokens(tokenable_type, tokenable_id);

-- 4. SHIFTS TABLE
CREATE TABLE shifts (
    id BIGSERIAL PRIMARY KEY,
    staff_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    total_before_deductions NUMERIC(10, 2) DEFAULT 0.00,
    total_after_deductions NUMERIC(10, 2) DEFAULT 0.00,
    deductions NUMERIC(10, 2) DEFAULT 0.00,
    cash_collected NUMERIC(10, 2) DEFAULT 0.00,
    card_collected NUMERIC(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DEVICES TABLE (PLAYSTATION, BILLIARDS, PING PONG)
CREATE TABLE devices (
    id BIGSERIAL PRIMARY KEY,
    room_name VARCHAR(255) NOT NULL,
    room_name_ar VARCHAR(255),
    device_name VARCHAR(255) NOT NULL,
    device_name_ar VARCHAR(255),
    device_type VARCHAR(20) DEFAULT 'ps5' CHECK (device_type IN ('ps5', 'ps4', 'billiards', 'pingpong', 'pc', 'xbox', 'sim', 'other')),
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'active', 'maintenance')),
    location VARCHAR(255),
    hourly_rate NUMERIC(8, 2) DEFAULT 50.00,
    specs TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. DEVICE SESSIONS TABLE
CREATE TABLE device_sessions (
    id BIGSERIAL PRIMARY KEY,
    device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL,
    staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) DEFAULT 'Guest',
    customer_phone VARCHAR(50),
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    duration_minutes INTEGER NULL,
    is_open_ended BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'paused')),
    hourly_rate NUMERIC(8, 2) DEFAULT 50.00,
    session_cost NUMERIC(10, 2) DEFAULT 0.00,
    beverage_cost NUMERIC(10, 2) DEFAULT 0.00,
    discount NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    paid_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partially_paid', 'paid')),
    payment_method VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. SESSION EXTENSIONS TABLE
CREATE TABLE session_extensions (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
    added_minutes INTEGER NOT NULL,
    price NUMERIC(8, 2) DEFAULT 0.00,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PRODUCTS / CAFE BEVERAGES & SNACKS TABLE
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    category VARCHAR(20) DEFAULT 'hot_drinks' CHECK (category IN ('hot_drinks', 'cold_drinks', 'soft_drinks', 'snacks', 'food')),
    price NUMERIC(8, 2) NOT NULL,
    cost_price NUMERIC(8, 2) DEFAULT 0.00,
    stock_quantity INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 5,
    image_url TEXT,
    supplier_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CAFE TABLES TABLE
CREATE TABLE tables (
    id BIGSERIAL PRIMARY KEY,
    table_number VARCHAR(50) NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied')),
    current_order_id BIGINT,
    total_spent NUMERIC(10, 2) DEFAULT 0.00,
    occupied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ORDERS TABLE
CREATE TABLE orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    shift_id BIGINT REFERENCES shifts(id) ON DELETE SET NULL,
    staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
    order_type VARCHAR(20) DEFAULT 'take_away' CHECK (order_type IN ('take_away', 'dine_in', 'gaming_room')),
    table_id BIGINT REFERENCES tables(id) ON DELETE SET NULL,
    device_session_id BIGINT REFERENCES device_sessions(id) ON DELETE SET NULL,
    subtotal NUMERIC(10, 2) DEFAULT 0.00,
    discount NUMERIC(10, 2) DEFAULT 0.00,
    tax NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'visa', 'installment', 'other')),
    payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('unpaid', 'paid')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ORDER ITEMS TABLE
CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(8, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. PAYMENTS TABLE
CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    device_session_id BIGINT REFERENCES device_sessions(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(20) DEFAULT 'cash' CHECK (payment_method IN ('cash', 'visa', 'installment', 'other')),
    reference_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. INVENTORY LOGS TABLE
CREATE TABLE inventory_logs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_change INTEGER NOT NULL,
    reason VARCHAR(20) DEFAULT 'sale' CHECK (reason IN ('sale', 'restock', 'adjustment')),
    staff_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. NOTIFICATIONS TABLE
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(30) DEFAULT 'session_ending' CHECK (type IN ('session_ending', 'session_ended', 'order_ready', 'payment_reminder', 'low_stock')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_to VARCHAR(100),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. SHIFT REPORTS TABLE
CREATE TABLE shift_reports (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    total_orders INTEGER DEFAULT 0,
    total_beverages_sold INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    total_revenue NUMERIC(10, 2) DEFAULT 0.00,
    cash_transactions NUMERIC(10, 2) DEFAULT 0.00,
    card_transactions NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 16. SEED DATA - AL5AL GAMING & LOUNGE (صالة الخال)
-- ==============================================================================

-- USERS (Passwords are bcrypt hashes of 'password123')
INSERT INTO users (id, name, email, pin_code, phone, role, password, avatar, created_at, updated_at) VALUES
(1, 'Karim - كريم', 'admin@al5al.com', '1234', '01032890430', 'admin', '$2y$12$R.9M9pT76dJbO4s5Y71Njeq.f4Y64DkJbQ09oW9q7M3Q6w9d4GZ3K', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80', NOW(), NOW()),
(2, 'Al-Ghareeb - الغريب', 'ghareeb@al5al.com', '5678', '01289535503', 'manager', '$2y$12$R.9M9pT76dJbO4s5Y71Njeq.f4Y64DkJbQ09oW9q7M3Q6w9d4GZ3K', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', NOW(), NOW()),
(3, 'Cashier - كاشير الصالة', 'staff@al5al.com', '0000', '0502943796', 'staff', '$2y$12$R.9M9pT76dJbO4s5Y71Njeq.f4Y64DkJbQ09oW9q7M3Q6w9d4GZ3K', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80', NOW(), NOW());

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ACTIVE MORNING SHIFT
INSERT INTO shifts (id, staff_id, start_time, status, total_before_deductions, total_after_deductions, cash_collected, card_collected, notes, created_at, updated_at) VALUES
(1, 3, NOW() - INTERVAL '3 hours', 'active', 640.00, 640.00, 380.00, 260.00, 'وردية الصباح - صالة الخال للألعاب والبلياردو', NOW(), NOW());

UPDATE users SET shift_id = 1 WHERE id = 3;
SELECT setval('shifts_id_seq', (SELECT MAX(id) FROM shifts));

-- PRODUCTS / CAFE MENU (Prices in EGP)
INSERT INTO products (id, name, name_ar, category, price, cost_price, stock_quantity, reorder_level, created_at, updated_at) VALUES
(1, 'Turkish Coffee Double', 'قهوة تركي دبل (سادة / مظبوط)', 'hot_drinks', 20.00, 6.00, 150, 20, NOW(), NOW()),
(2, 'Egyptian Tea Special', 'شاي ميزة بالنعناع', 'hot_drinks', 12.00, 3.00, 200, 30, NOW(), NOW()),
(3, 'Espresso Double', 'دبل إسبريسو إيطالي', 'hot_drinks', 25.00, 7.00, 120, 15, NOW(), NOW()),
(4, 'Hot Spanish Latte', 'سبانش لاتيه حار', 'hot_drinks', 35.00, 12.00, 80, 15, NOW(), NOW()),
(5, 'Hot Chocolate Marshmallow', 'هوت شوكليت مارشميلو', 'hot_drinks', 35.00, 12.00, 70, 10, NOW(), NOW()),
(6, 'Iced Spanish Latte', 'آيس سبانش لاتيه', 'cold_drinks', 40.00, 14.00, 90, 15, NOW(), NOW()),
(7, 'Iced Caramel Macchiato', 'آيس كراميل ماكياتو', 'cold_drinks', 40.00, 14.00, 75, 15, NOW(), NOW()),
(8, 'Mojito Blueberry Energy', 'موهيتو توت أزرق منعش', 'cold_drinks', 35.00, 10.00, 60, 10, NOW(), NOW()),
(9, 'Iced Peach Tea', 'آيس تي خوخ منعش', 'cold_drinks', 25.00, 8.00, 80, 15, NOW(), NOW()),
(10, 'Red Bull Energy Can', 'ريد بول كلاسيك 250 مل', 'soft_drinks', 45.00, 30.00, 6, 10, NOW(), NOW()),
(11, 'Pepsi Can 330ml', 'بيبسي كانز 330 مل', 'soft_drinks', 15.00, 9.00, 140, 20, NOW(), NOW()),
(12, '7Up Lemon Can', 'سفن أب كانز 330 مل', 'soft_drinks', 15.00, 9.00, 100, 20, NOW(), NOW()),
(13, 'Mineral Water 600ml', 'مياه معدنية 600 مل', 'soft_drinks', 8.00, 4.00, 180, 30, NOW(), NOW()),
(14, 'Cheesy Gaming Nachos', 'ناتشوز بالجبنة الشيدر والهلابينو', 'snacks', 45.00, 18.00, 40, 10, NOW(), NOW()),
(15, 'Nutella Waffle', 'وافل بالنوتيلا والمكسرات', 'food', 45.00, 18.00, 30, 8, NOW(), NOW()),
(16, 'French Fries Cheesy', 'بطاطس مقلية بالجبنة', 'snacks', 30.00, 10.00, 50, 10, NOW(), NOW()),
(17, 'Double Chocolate Cookie', 'كوكيز شوكولاتة طازج', 'snacks', 20.00, 7.00, 60, 15, NOW(), NOW());

SELECT setval('products_id_seq', (SELECT MAX(id) FROM products));

-- DEVICES (PLAYSTATION, BILLIARDS, PING PONG)
INSERT INTO devices (id, room_name, room_name_ar, device_name, device_name_ar, device_type, hourly_rate, status, specs, created_at, updated_at) VALUES
(1, 'PlayStation Arena', 'صالة البلايستيشن', 'PS5 Station 01', 'بلايستيشن 1 (PS5)', 'ps5', 45.00, 'active', 'Sony PS5 + 65" 4K 120Hz + 2 Controllers', NOW(), NOW()),
(2, 'PlayStation Arena', 'صالة البلايستيشن', 'PS5 Station 02', 'بلايستيشن 2 (PS5)', 'ps5', 45.00, 'active', 'Sony PS5 + 65" 4K 120Hz + 4 Controllers', NOW(), NOW()),
(3, 'PlayStation Arena', 'صالة البلايستيشن', 'PS4 Station 03', 'بلايستيشن 3 (PS4 Pro)', 'ps4', 30.00, 'available', 'Sony PS4 Pro + 55" 4K HDR + 2 Controllers', NOW(), NOW()),
(4, 'VIP Cyber Suite', 'غرفة كبار الزوار VIP', 'VIP PlayStation Room', 'غرفة VIP بلايستيشن', 'ps5', 75.00, 'available', 'غرفة خاصة مكيفة + شاشة 85 بوصة + ساوند سيستم 5.1', NOW(), NOW()),
(5, 'Billiards Arena', 'صالة البلياردو الاحترافية', 'Billiard Table 01', 'طاولة بلياردو 1 (رئيسية)', 'billiards', 50.00, 'active', 'طاولة بلياردو احترافية 9 قدم + طقم كرات آراميث + إضاءة LED مركزة', NOW(), NOW()),
(6, 'Billiards Arena', 'صالة البلياردو الاحترافية', 'Billiard Table 02', 'طاولة بلياردو 2', 'billiards', 50.00, 'available', 'طاولة بلياردو احترافية 9 قدم + عصايات كربون', NOW(), NOW()),
(7, 'Billiards Arena', 'صالة البلياردو الاحترافية', 'Billiard Table 03', 'طاولة بلياردو 3', 'billiards', 50.00, 'available', 'طاولة بلياردو احترافية 9 قدم', NOW(), NOW()),
(8, 'Ping Pong Bay', 'منطقة البينج بونج', 'Ping Pong Table 01', 'طاولة بينج بونج 1', 'pingpong', 35.00, 'active', 'طاولة تنس طاولة دولية + مضارب Donic احترافية', NOW(), NOW()),
(9, 'Ping Pong Bay', 'منطقة البينج بونج', 'Ping Pong Table 02', 'طاولة بينج بونج 2', 'pingpong', 35.00, 'available', 'طاولة تنس طاولة دولية + شبكة احترافية', NOW(), NOW());

SELECT setval('devices_id_seq', (SELECT MAX(id) FROM devices));

-- ACTIVE SESSIONS
INSERT INTO device_sessions (id, device_id, shift_id, staff_id, customer_name, customer_phone, start_time, end_time, duration_minutes, status, hourly_rate, session_cost, beverage_cost, total_amount, paid_amount, payment_status, created_at, updated_at) VALUES
(1, 1, 1, 3, 'Ziyad & Friends', '01011223344', NOW() - INTERVAL '45 minutes', NOW() + INTERVAL '15 minutes', 60, 'active', 45.00, 45.00, 47.00, 92.00, 0.00, 'unpaid', NOW(), NOW()),
(2, 2, 1, 3, 'Ahmed Tariq', '01222334455', NOW() - INTERVAL '53 minutes', NOW() + INTERVAL '7 minutes', 60, 'active', 45.00, 45.00, 18.00, 63.00, 0.00, 'unpaid', NOW(), NOW()),
(3, 5, 1, 3, 'Mohamed & Tamer (Billiards)', '01011223344', NOW() - INTERVAL '25 minutes', NOW() + INTERVAL '35 minutes', 60, 'active', 50.00, 50.00, 35.00, 85.00, 0.00, 'unpaid', NOW(), NOW()),
(4, 8, 1, 3, 'Hazem & Omar (Ping Pong)', '01122334455', NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '30 minutes', 45, 'active', 35.00, 26.25, 30.00, 56.25, 0.00, 'unpaid', NOW(), NOW());

SELECT setval('device_sessions_id_seq', (SELECT MAX(id) FROM device_sessions));

-- TABLES
INSERT INTO tables (id, table_number, capacity, status, total_spent, created_at, updated_at) VALUES
(1, 'T-01', 2, 'available', 0.00, NOW(), NOW()),
(2, 'T-02', 4, 'occupied', 115.00, NOW(), NOW()),
(3, 'T-03', 4, 'occupied', 90.00, NOW(), NOW()),
(4, 'T-04', 6, 'available', 0.00, NOW(), NOW()),
(5, 'T-05', 2, 'available', 0.00, NOW(), NOW()),
(6, 'T-06', 4, 'available', 0.00, NOW(), NOW()),
(7, 'T-07', 6, 'occupied', 135.00, NOW(), NOW()),
(8, 'T-08', 8, 'available', 0.00, NOW(), NOW());

SELECT setval('tables_id_seq', (SELECT MAX(id) FROM tables));

-- ORDERS
INSERT INTO orders (id, order_number, shift_id, staff_id, status, order_type, table_id, device_session_id, subtotal, discount, tax, total_amount, payment_status, notes, created_at, updated_at) VALUES
(1, 'ORD-A101', 1, 3, 'completed', 'dine_in', 2, NULL, 75.00, 0.00, 0.00, 75.00, 'unpaid', 'Extra ice for Spanish Latte', NOW(), NOW()),
(2, 'ORD-A102', 1, 3, 'completed', 'dine_in', 3, NULL, 90.00, 0.00, 0.00, 90.00, 'unpaid', 'Table by the window', NOW(), NOW()),
(3, 'ORD-A103', 1, 3, 'completed', 'dine_in', 7, NULL, 145.00, 10.00, 0.00, 135.00, 'unpaid', 'Family corner', NOW(), NOW()),
(4, 'ORD-A104', 1, 3, 'completed', 'gaming_room', NULL, 1, 75.00, 0.00, 0.00, 75.00, 'unpaid', 'Deliver to PS5 Station 01', NOW(), NOW());

UPDATE tables SET current_order_id = 1 WHERE id = 2;
UPDATE tables SET current_order_id = 2 WHERE id = 3;
UPDATE tables SET current_order_id = 3 WHERE id = 7;
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));

-- ORDER ITEMS
INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, created_at, updated_at) VALUES
(1, 6, 2, 40.00, 80.00, NOW(), NOW()),
(1, 4, 1, 35.00, 35.00, NOW(), NOW()),
(2, 14, 1, 45.00, 45.00, NOW(), NOW()),
(2, 15, 1, 45.00, 45.00, NOW(), NOW()),
(3, 8, 3, 35.00, 105.00, NOW(), NOW()),
(3, 17, 2, 20.00, 40.00, NOW(), NOW()),
(4, 6, 1, 40.00, 40.00, NOW(), NOW()),
(4, 4, 1, 35.00, 35.00, NOW(), NOW());

-- NOTIFICATIONS
INSERT INTO notifications (user_id, type, title, message, related_to, is_read, created_at, updated_at) VALUES
(3, 'session_ending', 'PS5 Station 02 Ending in 7 Minutes', 'Customer Ahmed Tariq session is nearing its 60 min end time. Check for extension.', '2', FALSE, NOW(), NOW()),
(3, 'low_stock', 'Low Stock Alert: Red Bull Energy', 'Only 6 cans remaining in inventory (Reorder level is 10).', '10', FALSE, NOW(), NOW());

-- INVENTORY INITIAL LOGS
INSERT INTO inventory_logs (product_id, quantity_change, reason, staff_id, created_at, updated_at)
SELECT id, stock_quantity, 'restock', 3, NOW(), NOW() FROM products;

-- GRANT PERMISSIONS FOR SUPABASE
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
