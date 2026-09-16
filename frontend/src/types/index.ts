export type Role = 'admin' | 'manager' | 'staff';

export interface User {
  id: number;
  name: string;
  email: string;
  pin_code?: string;
  phone?: string;
  role: Role;
  shift_id?: number | null;
  avatar?: string;
  current_shift?: Shift | null;
}

export interface Shift {
  id: number;
  staff_id: number;
  start_time: string;
  end_time?: string | null;
  status: 'active' | 'closed';
  total_before_deductions: number;
  total_after_deductions: number;
  deductions: number;
  cash_collected: number;
  card_collected: number;
  notes?: string | null;
  staff?: User;
}

export interface ShiftMetrics {
  elapsed_time_formatted: string;
  elapsed_minutes: number;
  total_orders: number;
  total_sessions: number;
  active_sessions_count: number;
  total_beverages_sold: number;
  total_revenue: number;
  cash_collected: number;
  card_collected: number;
  average_order_value: number;
}

export type DeviceType = 'ps5' | 'ps4' | 'billiards' | 'pingpong' | 'pc' | 'xbox' | 'sim' | 'other';
export type DeviceStatus = 'available' | 'active' | 'maintenance';

export interface Device {
  id: number;
  room_name: string;
  room_name_ar?: string;
  device_name: string;
  device_name_ar?: string;
  device_type: DeviceType;
  status: DeviceStatus;
  location?: string;
  hourly_rate: number;
  specs?: string;
  active_session?: ActiveSessionData | null;
}

export interface ActiveSessionData {
  id: number;
  customer_name: string;
  customer_phone?: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  is_open_ended?: boolean;
  remaining_seconds: number;
  is_ending_soon: boolean;
  is_ended: boolean;
  session_cost: number;
  beverage_cost: number;
  discount: number;
  total_amount: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'partially_paid' | 'paid';
  orders?: Order[];
  extensions?: SessionExtension[];
}

export interface SessionExtension {
  id: number;
  session_id: number;
  added_minutes: number;
  price: number;
  requested_at: string;
}

export type ProductCategory = 'hot_drinks' | 'cold_drinks' | 'soft_drinks' | 'snacks' | 'food';

export interface Product {
  id: number;
  name: string;
  name_ar: string;
  category: ProductCategory;
  price: number;
  cost_price: number;
  stock_quantity: number;
  reorder_level: number;
  image_url?: string;
}

export interface OrderItem {
  id?: number;
  order_id?: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

export type OrderType = 'take_away' | 'dine_in' | 'gaming_room';
export type OrderStatus = 'pending' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'visa' | 'wallet' | 'instapay' | 'installment' | 'other';

export interface Order {
  id: number;
  order_number: string;
  shift_id?: number;
  staff_id?: number;
  status: OrderStatus;
  order_type: OrderType;
  table_id?: number | null;
  device_session_id?: number | null;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: 'unpaid' | 'paid';
  notes?: string;
  created_at?: string;
  items?: OrderItem[];
  table?: Table;
  device_session?: ActiveSessionData;
  staff?: User;
}

export interface Table {
  id: number;
  table_number: string;
  capacity: number;
  status: 'available' | 'occupied';
  current_order_id?: number | null;
  total_spent: number;
  elapsed_minutes?: number;
  order?: {
    id: number;
    order_number: string;
    created_at: string;
    subtotal: number;
    discount: number;
    total_amount: number;
    items_count: number;
    items: {
      id: number;
      name: string;
      name_ar: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }[];
  } | null;
}

export interface NotificationItem {
  id: number;
  type: 'session_ending' | 'session_ended' | 'order_ready' | 'payment_reminder' | 'low_stock';
  title: string;
  message: string;
  related_to?: string;
  is_read: boolean;
  created_at: string;
}

export interface ThermalReceipt {
  business_name: string;
  business_name_ar: string;
  order_number: string;
  date_time: string;
  staff_name: string;
  order_type: OrderType;
  table_number?: string | null;
  device_name?: string | null;
  items: {
    name: string;
    name_ar?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  notes?: string;
  footer_note: string;
  footer_note_ar: string;
}
