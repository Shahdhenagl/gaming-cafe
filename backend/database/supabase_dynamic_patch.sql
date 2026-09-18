-- AL5AL Gaming & Lounge - LIVE DATABASE PATCH
-- Run this in Supabase SQL Editor against the existing database.
-- It preserves existing data and can safely be run more than once.

BEGIN;

-- Products: sale price, cost price, and quantity are separate values.
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(8,2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_level INTEGER NOT NULL DEFAULT 5;

-- Every sold line stores the cost at the time of sale, so historical profit remains correct.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(8,2) NOT NULL DEFAULT 0;

-- Open-ended gaming sessions.
ALTER TABLE device_sessions ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE device_sessions ALTER COLUMN duration_minutes DROP NOT NULL;
ALTER TABLE device_sessions ADD COLUMN IF NOT EXISTS is_open_ended BOOLEAN NOT NULL DEFAULT FALSE;

-- Table timer starts when the table is occupied, not when the first order is created.
ALTER TABLE tables ADD COLUMN IF NOT EXISTS occupied_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS treasury_entries (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT NULL REFERENCES shifts(id) ON DELETE SET NULL,
    staff_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    entry_type VARCHAR(30) NOT NULL DEFAULT 'shift_closing',
    payment_method VARCHAR(30) NOT NULL,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reference VARCHAR(120) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_treasury_date ON treasury_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_treasury_shift ON treasury_entries(shift_id);
CREATE INDEX IF NOT EXISTS idx_treasury_method ON treasury_entries(payment_method);

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'session_ending',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_to VARCHAR(100) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- Expenses / money leaving the drawer.
CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    shift_id BIGINT NULL REFERENCES shifts(id) ON DELETE SET NULL,
    staff_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    description VARCHAR(255) NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    payment_method VARCHAR(30) NOT NULL DEFAULT 'cash'
        CHECK (payment_method IN ('cash','visa','wallet','instapay','bank_transfer','other')),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_shift ON expenses(shift_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method);

-- The API supports cash, card, wallet and InstaPay. Replace old restrictive checks.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_method_check
    CHECK (payment_method IN ('cash','visa','wallet','instapay','installment','other'));
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
    CHECK (payment_method IN ('cash','visa','wallet','instapay','installment','other'));

-- Helpful indexes for reports and live API reads.
CREATE INDEX IF NOT EXISTS idx_orders_created_status ON orders(created_at, status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_status ON device_sessions(created_at, status);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Daily report: revenue, expenses, cost of goods, and net profit.
CREATE OR REPLACE VIEW v_daily_financial_report AS
WITH days AS (
    SELECT d::date AS report_date
    FROM generate_series(
        COALESCE((SELECT MIN(created_at::date) FROM orders), CURRENT_DATE),
        CURRENT_DATE,
        INTERVAL '1 day'
    ) AS d
), cafe AS (
    SELECT created_at::date AS report_date, COALESCE(SUM(total_amount),0) AS cafe_revenue
    FROM orders WHERE status <> 'cancelled' GROUP BY created_at::date
), gaming AS (
    SELECT created_at::date AS report_date, COALESCE(SUM(session_cost),0) AS gaming_revenue
    FROM device_sessions WHERE status <> 'paused' GROUP BY created_at::date
), costs AS (
    SELECT o.created_at::date AS report_date, COALESCE(SUM(oi.quantity * oi.cost_price),0) AS cost_of_goods
    FROM orders o JOIN order_items oi ON oi.order_id = o.id
    WHERE o.status <> 'cancelled' GROUP BY o.created_at::date
), spending AS (
    SELECT expense_date AS report_date, COALESCE(SUM(amount),0) AS expenses
    FROM expenses GROUP BY expense_date
)
SELECT d.report_date,
       COALESCE(c.cafe_revenue,0) AS cafe_revenue,
       COALESCE(g.gaming_revenue,0) AS gaming_revenue,
       COALESCE(c.cafe_revenue,0) + COALESCE(g.gaming_revenue,0) AS total_revenue,
       COALESCE(s.expenses,0) AS expenses,
       COALESCE(k.cost_of_goods,0) AS cost_of_goods,
       COALESCE(c.cafe_revenue,0) + COALESCE(g.gaming_revenue,0)
         - COALESCE(s.expenses,0) - COALESCE(k.cost_of_goods,0) AS net_profit
FROM days d
LEFT JOIN cafe c USING (report_date)
LEFT JOIN gaming g USING (report_date)
LEFT JOIN costs k USING (report_date)
LEFT JOIN spending s USING (report_date)
ORDER BY d.report_date;

-- Monthly report is generated from the daily report and is ready for dashboards.
CREATE OR REPLACE VIEW v_monthly_financial_report AS
SELECT date_trunc('month', report_date)::date AS report_month,
       SUM(cafe_revenue) AS cafe_revenue,
       SUM(gaming_revenue) AS gaming_revenue,
       SUM(total_revenue) AS total_revenue,
       SUM(expenses) AS expenses,
       SUM(cost_of_goods) AS cost_of_goods,
       SUM(net_profit) AS net_profit
FROM v_daily_financial_report
GROUP BY date_trunc('month', report_date)::date
ORDER BY report_month;

COMMIT;

-- Verification queries (run separately if desired):
-- SELECT * FROM v_daily_financial_report ORDER BY report_date DESC LIMIT 31;
-- SELECT * FROM v_monthly_financial_report ORDER BY report_month DESC;
-- SELECT id, description, amount, payment_method, expense_date FROM expenses ORDER BY id DESC LIMIT 50;
-- SELECT id, name, price AS sale_price, cost_price, stock_quantity FROM products ORDER BY id;
