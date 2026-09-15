import {
  Device,
  NotificationItem,
  Order,
  Product,
  Shift,
  ShiftMetrics,
  Table,
  ThermalReceipt,
  User,
} from '../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

class ApiService {
  private token: string | null = localStorage.getItem('nexus_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nexus_token', token);
    } else {
      localStorage.removeItem('nexus_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorMsg = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.message || JSON.stringify(errorData);
      } catch {
        // use default
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  // --- Auth ---
  async login(credentials: { email?: string; password?: string; pin?: string }): Promise<{ token: string; user: User }> {
    const data = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    return this.request<{ user: User }>('/auth/user');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- Shifts ---
  async getCurrentShift(): Promise<{ active: boolean; shift: Shift | null; metrics: ShiftMetrics }> {
    return this.request<{ active: boolean; shift: Shift | null; metrics: ShiftMetrics }>('/shifts/current');
  }

  async startShift(data: { notes?: string }): Promise<{ message: string; shift: Shift }> {
    return this.request<{ message: string; shift: Shift }>('/shifts/start', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async closeShift(id: number, data: { cash_counted?: number; deductions?: number; notes?: string }): Promise<{ message: string; shift: Shift }> {
    return this.request<{ message: string; shift: Shift }>(`/shifts/${id}/close`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getShiftHistory(): Promise<{ shifts: Shift[] }> {
    return this.request<{ shifts: Shift[] }>('/shifts/history');
  }

  // --- Devices & Gaming Sessions ---
  async getDevices(): Promise<{ devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } }> {
    return this.request<{ devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } }>('/devices');
  }

  async startSession(deviceId: number, data: { duration_minutes: number; customer_name?: string; customer_phone?: string; discount?: number }) {
    return this.request(`/devices/${deviceId}/session/start`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async extendSession(sessionId: number, added_minutes: number) {
    return this.request(`/sessions/${sessionId}/extend`, {
      method: 'PATCH',
      body: JSON.stringify({ added_minutes }),
    });
  }

  async addBeverageToSession(sessionId: number, items: { product_id: number; quantity: number; notes?: string }[]) {
    return this.request(`/sessions/${sessionId}/add-beverage`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  }

  async endSession(sessionId: number, data: { payment_method: string; discount?: number; amount_paid?: number }) {
    return this.request<{ message: string; receipt: ThermalReceipt }>(`/sessions/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // --- POS Orders ---
  async getOrders(params: { order_type?: string; status?: string } = {}): Promise<{ data: Order[] }> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ data: Order[] }>(`/orders?${query}`);
  }

  async createOrder(data: {
    order_type: 'take_away' | 'dine_in' | 'gaming_room';
    table_id?: number | null;
    device_session_id?: number | null;
    items: { product_id: number; quantity: number; notes?: string }[];
    discount?: number;
    tax?: number;
    payment_method?: string;
    payment_status?: string;
    notes?: string;
  }): Promise<{ message: string; order: Order }> {
    return this.request<{ message: string; order: Order }>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async processOrderPayment(orderId: number, data: { payment_method: string; amount?: number }) {
    return this.request(`/orders/${orderId}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOrderReceipt(orderId: number): Promise<{ receipt: ThermalReceipt }> {
    return this.request<{ receipt: ThermalReceipt }>(`/orders/${orderId}/receipt`);
  }

  // --- Tables ---
  async getTables(): Promise<{ tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } }> {
    return this.request<{ tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } }>('/tables');
  }

  async occupyTable(tableId: number) {
    return this.request(`/tables/${tableId}/occupy`, { method: 'PATCH' });
  }

  async moveTableToGaming(tableId: number, device_session_id: number) {
    return this.request(`/tables/${tableId}/move-to-gaming`, {
      method: 'POST',
      body: JSON.stringify({ device_session_id }),
    });
  }

  async releaseTable(tableId: number, payment_method: string = 'cash') {
    return this.request(`/tables/${tableId}/release`, {
      method: 'POST',
      body: JSON.stringify({ payment_method }),
    });
  }

  // --- Products & Inventory ---
  async getProducts(params: { category?: string; search?: string } = {}): Promise<{ products: Product[]; categories: Record<string, string>; summary: { total_products: number; low_stock_count: number } }> {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request(`/products?${query}`);
  }

  async updateStock(productId: number, data: { quantity_change: number; reason: 'restock' | 'adjustment' | 'sale' }) {
    return this.request(`/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getInventoryReport(): Promise<{ logs: any[]; low_stock_products: Product[] }> {
    return this.request('/inventory/report');
  }

  // --- Notifications ---
  async getNotifications(): Promise<{ notifications: NotificationItem[]; unread_count: number }> {
    return this.request<{ notifications: NotificationItem[]; unread_count: number }>('/notifications');
  }

  async markNotificationAsRead(id: number) {
    return this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', { method: 'POST' });
  }

  // --- Reports ---
  async getDashboardReport(): Promise<{
    metrics: {
      total_revenue_today: number;
      cafe_revenue_today: number;
      gaming_revenue_today: number;
      cash_total: number;
      card_total: number;
      orders_count: number;
      sessions_count: number;
      active_devices_count: number;
      total_devices_count: number;
      device_occupancy_rate: number;
      occupied_tables_count: number;
      total_tables_count: number;
      table_occupancy_rate: number;
      low_stock_count: number;
    };
    current_shift: Shift | null;
    top_products: any[];
    recent_orders: Order[];
  }> {
    return this.request('/reports/dashboard');
  }

  async getAnalytics(days: number = 7): Promise<{
    daily_stats: {
      date: string;
      day: string;
      cafe_revenue: number;
      gaming_revenue: number;
      total_revenue: number;
      orders_count: number;
      sessions_count: number;
    }[];
    category_breakdown: any[];
  }> {
    return this.request(`/reports/analytics?days=${days}`);
  }
}

export const api = new ApiService();
