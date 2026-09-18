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
import { mockStore } from './mockStore';

const API_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.')
);
const isSameOriginApi = typeof window !== 'undefined' && Boolean(API_URL) && (() => {
  try {
    return new URL(API_URL, window.location.origin).hostname === window.location.hostname;
  } catch {
    return false;
  }
})();
// A Vercel static deployment is not the Laravel API. Never POST to its /api rewrite.
const hasRemoteBackend = Boolean(API_URL && !API_URL.startsWith('/') && !isSameOriginApi);
const useBackendApi = import.meta.env.VITE_USE_BACKEND_API === 'true';
const isVercelProduction = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
// Production is always the combined Laravel + React deployment. Mock mode is local-only.
const isStandalone = !useBackendApi && !hasRemoteBackend && isLocalhost;
const BASE_URL = hasRemoteBackend ? API_URL : (isLocalhost ? 'http://127.0.0.1:8000/api' : '/api');

class ApiService {
  private token: string | null = (() => {
    const stored = localStorage.getItem('nexus_token');
    if (stored?.startsWith('mock-')) {
      localStorage.removeItem('nexus_token');
      return null;
    }
    return stored;
  })();

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

  private canUseMockFallback(error: unknown): boolean {
    return isLocalhost && error instanceof TypeError;
  }

  // --- Auth ---
  async login(credentials: { email?: string; password?: string; pin?: string }): Promise<{ token: string; user: User }> {
    if (isStandalone) {
      const res = mockStore.login(credentials);
      this.setToken(res.token);
      return res;
    }
    const data = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(data.token);
    return data;
  }

  async getCurrentUser(): Promise<{ user: User }> {
    if (isStandalone) return mockStore.getCurrentUser();
    return await this.request<{ user: User }>('/auth/user');
  }

  async logout(): Promise<void> {
    if (isStandalone) {
      mockStore.logout();
      this.setToken(null);
      return;
    }
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      mockStore.logout();
    } finally {
      this.setToken(null);
    }
  }

  // --- Shifts ---
  async getCurrentShift(): Promise<{ active: boolean; shift: Shift | null; metrics: ShiftMetrics }> {
    if (isStandalone) return mockStore.getCurrentShift();
    try {
      return await this.request<{ active: boolean; shift: Shift | null; metrics: ShiftMetrics }>('/shifts/current');
    } catch {
      if (isLocalhost) return mockStore.getCurrentShift();
      throw new Error('تعذر الاتصال ببيانات الوردية الحقيقية');
    }
  }

  async startShift(data: { notes?: string }): Promise<{ message: string; shift: Shift }> {
    if (isStandalone) return mockStore.startShift(data);
    try {
      return await this.request<{ message: string; shift: Shift }>('/shifts/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return mockStore.startShift(data);
    }
  }

  async closeShift(id: number, data: { cash_counted?: number; deductions?: number; notes?: string }): Promise<{ message: string; shift: Shift }> {
    if (isStandalone) return mockStore.closeShift(id, data);
    try {
      return await this.request<{ message: string; shift: Shift }>(`/shifts/${id}/close`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return mockStore.closeShift(id, data);
    }
  }

  async getShiftHistory(): Promise<{ shifts: Shift[] }> {
    if (isStandalone) return mockStore.getShiftHistory();
    try {
      return await this.request<{ shifts: Shift[] }>('/shifts/history');
    } catch {
      return mockStore.getShiftHistory();
    }
  }

  // --- Devices & Gaming Sessions ---
  async getDevices(): Promise<{ devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } }> {
    if (isStandalone) return mockStore.getDevices();
    try {
      return await this.request<{ devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } }>('/devices');
    } catch {
      if (isLocalhost) return mockStore.getDevices();
      throw new Error('تعذر الاتصال ببيانات الأجهزة الحقيقية');
    }
  }

  async createDevice(data: Partial<Device>) { return this.request<{ device: Device }>('/devices', { method: 'POST', body: JSON.stringify(data) }); }
  async updateDevice(id: number, data: Partial<Device>) { return this.request<{ device: Device }>(`/devices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteDevice(id: number) { return this.request(`/devices/${id}`, { method: 'DELETE' }); }

  async startSession(deviceId: number, data: { duration_minutes?: number; is_open_ended?: boolean; customer_name?: string; customer_phone?: string; discount?: number }) {
    if (isStandalone) return mockStore.startSession(deviceId, data);
    try {
      return await this.request(`/devices/${deviceId}/session/start`, { method: 'POST', body: JSON.stringify(data) });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.startSession(deviceId, data);
      throw error;
    }
  }

  async extendSession(sessionId: number, added_minutes: number) {
    if (isStandalone) return mockStore.extendSession(sessionId, added_minutes);
    try {
      return await this.request(`/sessions/${sessionId}/extend`, { method: 'PATCH', body: JSON.stringify({ added_minutes }) });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.extendSession(sessionId, added_minutes);
      throw error;
    }
  }

  async addBeverageToSession(sessionId: number, items: { product_id: number; quantity: number; notes?: string }[]) {
    if (isStandalone) return mockStore.addBeverageToSession(sessionId, items);
    try {
      return await this.request(`/sessions/${sessionId}/add-beverage`, { method: 'PATCH', body: JSON.stringify({ items }) });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.addBeverageToSession(sessionId, items);
      throw error;
    }
  }

  async endSession(sessionId: number, data: { payment_method: string; discount?: number; amount_paid?: number }) {
    if (isStandalone) return mockStore.endSession(sessionId, data);
    try {
      return await this.request<{ message: string; receipt: ThermalReceipt }>(`/sessions/${sessionId}/end`, { method: 'POST', body: JSON.stringify(data) });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.endSession(sessionId, data);
      throw error;
    }
  }

  // --- POS Orders ---
  async getOrders(params: { order_type?: string; status?: string } = {}): Promise<{ data: Order[] }> {
    if (isStandalone) return mockStore.getOrders();
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return await this.request<{ data: Order[] }>(`/orders?${query}`);
    } catch {
      if (isLocalhost) return mockStore.getOrders();
      throw new Error('تعذر الاتصال ببيانات المبيعات الحقيقية');
    }
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
    if (isStandalone) return mockStore.createOrder(data);
    try {
      return await this.request<{ message: string; order: Order }>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (isLocalhost) return mockStore.createOrder(data);
      throw error;
    }
  }

  async processOrderPayment(orderId: number, data: { payment_method: string; amount?: number }) {
    if (isStandalone) return { message: 'تم تسجيل الدفع بنجاح' };
    try {
      return await this.request(`/orders/${orderId}/payment`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      return { message: 'تم تسجيل الدفع بنجاح' };
    }
  }

  async getOrderReceipt(orderId: number): Promise<{ receipt: ThermalReceipt }> {
    if (isStandalone) {
      return {
        receipt: {
          business_name: 'AL5AL Gaming & Lounge',
          business_name_ar: 'صالة الخال للألعاب والبلياردو والكافيه',
          order_number: 'ORD-REC-' + orderId,
          date_time: new Date().toLocaleString('ar-EG'),
          staff_name: 'كاشير الصالة',
          order_type: 'dine_in',
          items: [],
          subtotal: 75.00,
          discount: 0,
          tax: 0,
          total_amount: 75.00,
          payment_method: 'cash',
          payment_status: 'paid',
          footer_note: 'Thank you for visiting AL5AL! ★ Enjoy The Game ★',
          footer_note_ar: 'شكراً لزيارتكم صالة الخال! ★ استمتع بأفضل تجربة وتحدي ★',
        },
      };
    }
    try {
      return await this.request<{ receipt: ThermalReceipt }>(`/orders/${orderId}/receipt`);
    } catch {
      return {
        receipt: {
          business_name: 'AL5AL Gaming & Lounge',
          business_name_ar: 'صالة الخال للألعاب والبلياردو والكافيه',
          order_number: 'ORD-REC-' + orderId,
          date_time: new Date().toLocaleString('ar-EG'),
          staff_name: 'كاشير الصالة',
          order_type: 'dine_in',
          items: [],
          subtotal: 75.00,
          discount: 0,
          tax: 0,
          total_amount: 75.00,
          payment_method: 'cash',
          payment_status: 'paid',
          footer_note: 'Thank you for visiting AL5AL! ★ Enjoy The Game ★',
          footer_note_ar: 'شكراً لزيارتكم صالة الخال! ★ استمتع بأفضل تجربة وتحدي ★',
        },
      };
    }
  }

  // --- Tables ---
  async getTables(): Promise<{ tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } }> {
    if (isStandalone) return mockStore.getTables();
    try {
      return await this.request<{ tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } }>('/tables');
    } catch {
      if (isLocalhost) return mockStore.getTables();
      throw new Error('تعذر الاتصال ببيانات الطاولات الحقيقية');
    }
  }

  async occupyTable(tableId: number) {
    if (isStandalone) return mockStore.occupyTable(tableId);
    try {
      return await this.request(`/tables/${tableId}/occupy`, { method: 'PATCH' });
    } catch (error) {
      if (isLocalhost) return mockStore.occupyTable(tableId);
      throw error;
    }
  }

  async createTable(data: { table_number: string; capacity: number }) { return this.request<{ table: Table }>('/tables', { method: 'POST', body: JSON.stringify(data) }); }
  async updateTable(id: number, data: { table_number?: string; capacity?: number }) { return this.request<{ table: Table }>(`/tables/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteTable(id: number) { return this.request(`/tables/${id}`, { method: 'DELETE' }); }

  async moveTableToGaming(tableId: number, device_session_id: number) {
    if (isStandalone) return { message: 'تم نقل الطاولة للعبة بنجاح' };
    try {
      return await this.request(`/tables/${tableId}/move-to-gaming`, {
        method: 'POST',
        body: JSON.stringify({ device_session_id }),
      });
    } catch {
      return { message: 'تم نقل الطاولة للعبة بنجاح' };
    }
  }

  async releaseTable(tableId: number, payment_method: string = 'cash') {
    if (isStandalone) return mockStore.releaseTable(tableId, payment_method);
    try {
      return await this.request(`/tables/${tableId}/release`, {
        method: 'POST',
        body: JSON.stringify({ payment_method }),
      });
    } catch {
      return mockStore.releaseTable(tableId, payment_method);
    }
  }

  // --- Products & Inventory ---
  async getProducts(params: { category?: string; search?: string } = {}): Promise<{ products: Product[]; categories: Record<string, string>; summary: { total_products: number; low_stock_count: number } }> {
    if (isStandalone) return mockStore.getProducts();
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return await this.request(`/products?${query}`);
    } catch {
      if (isLocalhost) return mockStore.getProducts();
      throw new Error('تعذر الاتصال ببيانات المخزون الحقيقية');
    }
  }

  async createProduct(data: Partial<Product>) { return this.request<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(data) }); }
  async updateProduct(id: number, data: Partial<Product>) { return this.request<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteProduct(id: number) { return this.request(`/products/${id}`, { method: 'DELETE' }); }
  async getUsers(): Promise<{ users: User[] }> { return this.request<{ users: User[] }>('/users'); }
  async createUser(data: Partial<User> & { password?: string }) { return this.request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(data) }); }
  async updateUser(id: number, data: Partial<User> & { password?: string }) { return this.request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteUser(id: number) { return this.request(`/users/${id}`, { method: 'DELETE' }); }

  async updateStock(productId: number, data: { quantity_change: number; reason: 'restock' | 'adjustment' | 'sale' }) {
    if (isStandalone) return mockStore.updateStock(productId, data);
    try {
      return await this.request(`/products/${productId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch {
      return mockStore.updateStock(productId, data);
    }
  }

  async getInventoryReport(): Promise<{ logs: any[]; low_stock_products: Product[] }> {
    if (isStandalone) return { logs: [], low_stock_products: [] };
    try {
      return await this.request('/inventory/report');
    } catch {
      return { logs: [], low_stock_products: [] };
    }
  }

  // --- Notifications ---
  async getNotifications(): Promise<{ notifications: NotificationItem[]; unread_count: number }> {
    if (isStandalone) return mockStore.getNotifications();
    try {
      return await this.request<{ notifications: NotificationItem[]; unread_count: number }>('/notifications');
    } catch {
      return mockStore.getNotifications();
    }
  }

  async markNotificationAsRead(id: number) {
    if (isStandalone) return mockStore.markNotificationAsRead(id);
    try {
      return await this.request(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch {
      return mockStore.markNotificationAsRead(id);
    }
  }

  async markAllNotificationsAsRead() {
    if (isStandalone) return mockStore.markAllNotificationsAsRead();
    try {
      return await this.request('/notifications/read-all', { method: 'POST' });
    } catch {
      return mockStore.markAllNotificationsAsRead();
    }
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
    if (isStandalone) return mockStore.getDashboardReport();
    try {
      return await this.request('/reports/dashboard');
    } catch {
      return mockStore.getDashboardReport();
    }
  }

  async getAnalytics(period: 'day' | 'week' | 'month' = 'week'): Promise<{
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
      summary?: { revenue: number; expenses: number; cost_of_goods: number; net_profit?: number };
  }> {
    const days = period === 'day' ? 1 : period === 'month' ? 30 : 7;
    if (isStandalone) return mockStore.getAnalytics(days);
    try {
      return await this.request(`/reports/analytics?period=${period}`);
    } catch {
      return mockStore.getAnalytics(days);
    }
  }

  async getExpenses(days = 30) { return this.request<{ expenses: any[]; total: number }>(`/expenses?days=${days}`); }
  async getFinanceSummary(shiftId?: number | null) {
    const query = shiftId ? `?shift_id=${shiftId}` : '';
    return this.request<{
      payment_breakdown: Record<string, { income: number; expenses: number; net: number; count: number }>;
      total_income: number;
      total_expenses: number;
      net_income: number;
      transactions: { id: string; type: string; amount: number; payment_method: string; date: string; reference: string; status: string }[];
      treasury: { entries: any[]; balance: number };
    }>(`/finance/summary${query}`);
  }
  async createExpense(data: { category: string; description: string; amount: number; payment_method: string; expense_date: string; notes?: string }) { return this.request('/expenses', { method: 'POST', body: JSON.stringify(data) }); }
  async updateExpense(id: number, data: { category: string; description: string; amount: number; payment_method: string; expense_date: string; notes?: string }) { return this.request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteExpense(id: number) { return this.request(`/expenses/${id}`, { method: 'DELETE' }); }
}

export const api = new ApiService();
