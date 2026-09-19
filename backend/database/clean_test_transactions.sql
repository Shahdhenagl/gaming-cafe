-- AL5AL Gaming & Lounge
-- TEST RESET ONLY: removes operational/test transactions.
-- PRESERVES: users, products, devices, tables, and their configuration.
-- Run in Supabase SQL Editor after taking a backup if this is production data.

BEGIN;

-- Remove dependent financial and operational records first.
DELETE FROM treasury_entries;
DELETE FROM shift_reports;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM orders;
DELETE FROM session_extensions;
DELETE FROM device_sessions;
DELETE FROM expenses;
DELETE FROM inventory_logs;
DELETE FROM shifts;

-- These are test/runtime records, not master data.
DELETE FROM notifications;
DELETE FROM personal_access_tokens;

-- Clear pointers and runtime statuses while preserving the master records.
UPDATE users
SET shift_id = NULL,
    updated_at = NOW();

UPDATE devices
SET status = 'available',
    updated_at = NOW();

UPDATE tables
SET status = 'available',
    current_order_id = NULL,
    total_spent = 0,
    occupied_at = NULL,
    updated_at = NOW();

-- Start generated IDs from 1 for the next clean test run.
SELECT setval(pg_get_serial_sequence('treasury_entries', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('shift_reports', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('payments', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('order_items', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('orders', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('session_extensions', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('device_sessions', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('expenses', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('inventory_logs', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('notifications', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('personal_access_tokens', 'id'), 1, false);
SELECT setval(pg_get_serial_sequence('shifts', 'id'), 1, false);

COMMIT;

-- Verification: these counts should all be zero after a successful reset.
SELECT
  (SELECT COUNT(*) FROM shifts) AS shifts,
  (SELECT COUNT(*) FROM orders) AS orders,
  (SELECT COUNT(*) FROM order_items) AS order_items,
  (SELECT COUNT(*) FROM payments) AS payments,
  (SELECT COUNT(*) FROM expenses) AS expenses,
  (SELECT COUNT(*) FROM device_sessions) AS device_sessions,
  (SELECT COUNT(*) FROM session_extensions) AS session_extensions,
  (SELECT COUNT(*) FROM shift_reports) AS shift_reports,
  (SELECT COUNT(*) FROM treasury_entries) AS treasury_entries,
  (SELECT COUNT(*) FROM inventory_logs) AS inventory_logs,
  (SELECT COUNT(*) FROM notifications) AS notifications;

-- Master-data checks: these must remain greater than or equal to their
-- pre-cleanup counts: users, products, devices, and tables.
SELECT
  (SELECT COUNT(*) FROM users) AS users_kept,
  (SELECT COUNT(*) FROM products) AS products_kept,
  (SELECT COUNT(*) FROM devices) AS devices_kept,
  (SELECT COUNT(*) FROM tables) AS tables_kept;
