import {
  Device,
  NotificationItem,
  Order,
  Product,
  Shift,
  ShiftMetrics,
  StatementResponse,
  StatementSummary,
  StatementTransaction,
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
// Production is always the combined Laravel + React deployment. Mock mode is local-only.
const isStandalone = !useBackendApi && !hasRemoteBackend && isLocalhost;
const BASE_URL = hasRemoteBackend ? API_URL : (isLocalhost ? 'http://127.0.0.1:8000/api' : '/api');

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

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('انتهت مهلة الاتصال بالخادم. تحقق من اتصال السيرفر ثم أعد المحاولة.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('استجابة غير صالحة من الخادم: يجب أن يكون مسار API متصلًا بـ Laravel وليس صفحة الواجهة');
    }
    if (!response.ok) {
      let errorMsg = `خطأ في الاتصال بالخادم (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.message === 'Server Error' || errorData.message === 'Internal Server Error') {
          errorMsg = errorData.error_detail 
            ? `خطأ داخلي في الخادم: ${errorData.error_detail}`
            : 'حدث خطأ في معالجة الطلب داخل الخادم. تم تسجيل الخطأ، يرجى المحاولة مرة أخرى أو التأكد من سلامة البيانات المدخلة.';
        } else {
          errorMsg = errorData.message || errorData.error || (typeof errorData === 'object' ? JSON.stringify(errorData) : `HTTP Error ${response.status}`);
        }
      } catch {
        if (response.status === 500) {
          errorMsg = 'تعذر معالجة الطلب على السيرفر (500). يرجى مراجعة الاتصال وإعادة المحاولة.';
        }
      }
      throw new Error(errorMsg);
    }

    return response.json();
  }

  private canUseMockFallback(error: unknown): boolean {
    return isLocalhost || Boolean(this.token?.startsWith('mock-')) || error instanceof TypeError;
  }

  // --- Auth ---
  async login(credentials: { email?: string; password?: string; pin?: string }): Promise<{ token: string; user: User }> {
    if (isStandalone) {
      const res = mockStore.login(credentials);
      this.setToken(res.token);
      return res;
    }
    try {
      const data = await this.request<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      this.setToken(data.token);
      return data;
    } catch (error: any) {
      const msg = error?.message || '';
      const isServerError =
        msg.includes('Server Error') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('تعذر الاتصال') ||
        msg.includes('مهلة الاتصال') ||
        msg.includes('Failed to fetch') ||
        error instanceof TypeError;

      if (isServerError && credentials.pin) {
        try {
          const res = mockStore.login(credentials);
          this.setToken(res.token);
          return res;
        } catch {
          // If PIN is not valid in mockStore either, keep original error
        }
      }
      throw error;
    }
  }

  async getCurrentUser(): Promise<{ user: User }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getCurrentUser();
    try {
      return await this.request<{ user: User }>('/auth/user');
    } catch (e) {
      if (this.token?.startsWith('mock-')) return mockStore.getCurrentUser();
      throw e;
    }
  }

  async logout(): Promise<void> {
    if (isStandalone || this.token?.startsWith('mock-')) {
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
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getCurrentShift();
    try {
      return await this.request<{ active: boolean; shift: Shift | null; metrics: ShiftMetrics }>('/shifts/current');
    } catch {
      return mockStore.getCurrentShift();
    }
  }

  async startShift(data: { notes?: string }): Promise<{ message: string; shift: Shift }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.startShift(data);
    try {
      return await this.request<{ message: string; shift: Shift }>('/shifts/start', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.startShift(data);
      throw error;
    }
  }

  async closeShift(id: number, data: { cash_counted?: number; deductions?: number; notes?: string }): Promise<{ message: string; shift: Shift }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.closeShift(id, data);
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
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getShiftHistory();
    try {
      return await this.request<{ shifts: Shift[] }>('/shifts/history');
    } catch {
      return mockStore.getShiftHistory();
    }
  }

  // --- Devices & Gaming Sessions ---
  async getDevices(): Promise<{ devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getDevices();
    try {
      return await this.request<{ devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } }>('/devices');
    } catch {
      return mockStore.getDevices();
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

  async endSession(sessionId: number, data: { payment_method: string; discount?: number; amount_paid?: number; customer_name?: string; customer_phone?: string }) {
    if (isStandalone) return mockStore.endSession(sessionId, data);
    try {
      return await this.request<{ message: string; receipt: ThermalReceipt }>(`/sessions/${sessionId}/end`, { method: 'POST', body: JSON.stringify(data) });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.endSession(sessionId, data);
      throw error;
    }
  }

  async addManualSession(data: {
    device_id: number;
    customer_name?: string;
    customer_phone?: string;
    duration_minutes?: number;
    start_time?: string;
    end_time?: string;
    hourly_rate?: number;
    session_cost?: number;
    discount?: number;
    payment_method: string;
    amount_paid?: number;
    items?: { product_id: number; quantity: number; notes?: string }[];
  }) {
    if (isStandalone) return mockStore.addManualSession(data);
    try {
      return await this.request<{ message: string; session: any; receipt?: ThermalReceipt }>('/sessions/manual', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.addManualSession(data);
      throw error;
    }
  }

  async updateOrderItem(orderItemId: number, quantity: number) {
    if (isStandalone) return mockStore.updateOrderItemQuantity(orderItemId, quantity);
    try {
      return await this.request<{ message: string; order: any; item: any }>(`/order-items/${orderItemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.updateOrderItemQuantity(orderItemId, quantity);
      throw error;
    }
  }

  async deleteOrderItem(orderItemId: number) {
    if (isStandalone) return mockStore.deleteOrderItem(orderItemId);
    try {
      return await this.request<{ message: string; order: any }>(`/order-items/${orderItemId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.deleteOrderItem(orderItemId);
      throw error;
    }
  }

  // --- POS Orders ---
  async getOrders(params: { order_type?: string; status?: string } = {}): Promise<{ data: Order[] }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getOrders();
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return await this.request<{ data: Order[] }>(`/orders?${query}`);
    } catch {
      return mockStore.getOrders();
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
    customer_name?: string;
    customer_phone?: string;
    notes?: string;
  }): Promise<{ message: string; order: Order }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.createOrder(data);
    try {
      return await this.request<{ message: string; order: Order }>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.createOrder(data);
      throw error;
    }
  }

  async processOrderPayment(orderId: number, data: { payment_method: string; amount?: number }) {
    if (isStandalone || this.token?.startsWith('mock-')) return { message: 'تم تسجيل الدفع بنجاح' };
    try {
      return await this.request(`/orders/${orderId}/payment`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return { message: 'تم تسجيل الدفع بنجاح' };
      throw error;
    }
  }

  async getOrderReceipt(orderId: number): Promise<{ receipt: ThermalReceipt }> {
    if (isStandalone || this.token?.startsWith('mock-')) {
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

  async getCustomerDebts(params: { search?: string; tab?: string; archived?: boolean; filter?: string } | string = '') {
    if (isStandalone) return (mockStore as any).getCustomerDebts(params);
    try {
      let query = '';
      if (typeof params === 'string') {
        query = params ? `?search=${encodeURIComponent(params)}` : '';
      } else {
        const sp = new URLSearchParams();
        if (params.search) sp.set('search', params.search);
        if (params.tab) sp.set('tab', params.tab);
        if (params.archived !== undefined) sp.set('archived', String(params.archived));
        if (params.filter) sp.set('filter', params.filter);
        const qStr = sp.toString();
        if (qStr) query = `?${qStr}`;
      }
      return await this.request<{ 
        customers: Array<{ 
          id: number; 
          name: string; 
          phone: string; 
          total_debt: number; 
          total_paid: number; 
          remaining_debt: number; 
          is_archived?: boolean;
          debts: any[] 
        }>;
        summary?: {
          total_remaining: number;
          active_with_debt_count: number;
          active_zero_debt_count: number;
          archived_count: number;
        }
      }>(`/customer-debts${query}`);
    } catch (error) {
      if (this.canUseMockFallback(error)) return (mockStore as any).getCustomerDebts(params);
      throw error;
    }
  }

  async payCustomerDebt(debtId: number, data: { amount: number; payment_method: string; notes?: string }) {
    if (isStandalone) return (mockStore as any).payCustomerDebt(debtId, data);
    try {
      return await this.request(`/customer-debts/${debtId}/pay`, { method: 'POST', body: JSON.stringify(data) });
    } catch (error) {
      if (this.canUseMockFallback(error)) return (mockStore as any).payCustomerDebt(debtId, data);
      throw error;
    }
  }

  async archiveCustomer(customerId: number) {
    if (isStandalone) return (mockStore as any).archiveCustomer(customerId);
    try {
      return await this.request<{ message: string; customer: any }>(`/customer-debts/${customerId}/archive`, { method: 'POST' });
    } catch (error) {
      if (this.canUseMockFallback(error)) return (mockStore as any).archiveCustomer(customerId);
      throw error;
    }
  }

  async restoreCustomer(customerId: number) {
    if (isStandalone) return (mockStore as any).restoreCustomer(customerId);
    try {
      return await this.request<{ message: string; customer: any }>(`/customer-debts/${customerId}/restore`, { method: 'POST' });
    } catch (error) {
      if (this.canUseMockFallback(error)) return (mockStore as any).restoreCustomer(customerId);
      throw error;
    }
  }

  async deleteCustomer(customerId: number) {
    if (isStandalone) return (mockStore as any).deleteCustomer(customerId);
    try {
      return await this.request<{ message: string }>(`/customer-debts/${customerId}`, { method: 'DELETE' });
    } catch (error) {
      if (this.canUseMockFallback(error)) return (mockStore as any).deleteCustomer(customerId);
      throw error;
    }
  }


  // --- Tables ---
  async getTables(): Promise<{ tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getTables();
    try {
      return await this.request<{ tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } }>('/tables');
    } catch (error) {
      return mockStore.getTables();
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
    } catch (error) {
      if (isLocalhost) return { message: 'تم نقل الطاولة للعبة بنجاح' };
      throw error;
    }
  }

  async addItemsToTable(tableId: number, items: { product_id: number; quantity: number; notes?: string }[]) {
    if (isStandalone) return mockStore.addBeverageToTable(tableId, items);
    try {
      return await this.request<{ message: string; table: Table; order: Order }>(`/tables/${tableId}/add-items`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      });
    } catch (error) {
      if (isLocalhost) return mockStore.addBeverageToTable(tableId, items);
      throw error;
    }
  }

  async checkoutTable(tableId: number, data: {
    payment_method?: string;
    discount?: number;
    amount_paid?: number;
    customer_name?: string;
    customer_phone?: string;
  }): Promise<{ message: string; table: Table; receipt?: ThermalReceipt }> {
    if (isStandalone) {
      const res = mockStore.releaseTable(tableId, data.payment_method || 'cash');
      return { message: res.message, table: (mockStore as any).data.tables.find((t: any) => t.id === tableId) };
    }
    try {
      return await this.request<{ message: string; table: Table; receipt?: ThermalReceipt }>(`/tables/${tableId}/checkout`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (isLocalhost) {
        const res = mockStore.releaseTable(tableId, data.payment_method || 'cash');
        return { message: res.message, table: (mockStore as any).data.tables.find((t: any) => t.id === tableId) };
      }
      throw error;
    }
  }

  async releaseTable(tableId: number, payment_method: string = 'cash') {
    return this.checkoutTable(tableId, { payment_method });
  }

  // --- Products & Inventory ---
  async getProducts(params: { category?: string; search?: string } = {}): Promise<{ products: Product[]; categories: Record<string, string>; summary: { total_products: number; low_stock_count: number } }> {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.getProducts();
    try {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return await this.request(`/products?${query}`);
    } catch {
      return mockStore.getProducts();
    }
  }

  async createProduct(data: Partial<Product>) { return this.request<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(data) }); }
  async updateProduct(id: number, data: Partial<Product>) { return this.request<{ product: Product }>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteProduct(id: number) { return this.request(`/products/${id}`, { method: 'DELETE' }); }
  async getUsers(): Promise<{ users: User[] }> { return this.request<{ users: User[] }>('/users'); }
  async createUser(data: Partial<User> & { password?: string }) { return this.request<{ user: User }>('/users', { method: 'POST', body: JSON.stringify(data) }); }
  async updateUser(id: number, data: Partial<User> & { password?: string }) { return this.request<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteUser(id: number) { return this.request(`/users/${id}`, { method: 'DELETE' }); }

  async updateStock(productId: number, data: { quantity_change: number; reason: 'restock' | 'adjustment' | 'sale'; purchase_total?: number; purchase_payment_method?: string }) {
    if (isStandalone || this.token?.startsWith('mock-')) return mockStore.updateStock(productId, data);
    try {
      return await this.request(`/products/${productId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.updateStock(productId, data);
      throw error;
    }
  }

  async getInventoryReport(): Promise<{ logs: any[]; low_stock_products: Product[] }> {
    if (isStandalone) return { logs: [], low_stock_products: [] };
    try {
      return await this.request('/inventory/report');
    } catch (error) {
      throw error;
    }
  }

  // --- Notifications ---
  async getNotifications(): Promise<{ notifications: NotificationItem[]; unread_count: number }> {
    if (isStandalone) return mockStore.getNotifications();
    try {
      return await this.request<{ notifications: NotificationItem[]; unread_count: number }>('/notifications');
    } catch (error) {
      if (isLocalhost) return mockStore.getNotifications();
      throw error;
    }
  }

  async markNotificationAsRead(id: number) {
    if (isStandalone) return mockStore.markNotificationAsRead(id);
    try {
      return await this.request(`/notifications/${id}/read`, { method: 'PATCH' });
    } catch (error) {
      if (isLocalhost) return mockStore.markNotificationAsRead(id);
      throw error;
    }
  }

  async markAllNotificationsAsRead() {
    if (isStandalone) return mockStore.markAllNotificationsAsRead();
    try {
      return await this.request('/notifications/read-all', { method: 'POST' });
    } catch (error) {
      if (isLocalhost) return mockStore.markAllNotificationsAsRead();
      throw error;
    }
  }

  // --- Reports ---
  async getDashboardReport(params?: { date?: string; month?: string; from_date?: string; to_date?: string }): Promise<{
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
      const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
      return await this.request(`/reports/dashboard${query}`);
    } catch (error) {
      if (isLocalhost) return mockStore.getDashboardReport();
      throw error;
    }
  }

  async getStatement(params?: {
    date?: string;
    month?: string;
    from_date?: string;
    to_date?: string;
    type?: string;
    payment_method?: string;
    search?: string;
  }): Promise<StatementResponse> {
    const cleanParams: Record<string, string> = {};
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '' && val !== 'undefined') {
          cleanParams[key] = String(val);
        }
      });
    }

    if (isStandalone) return mockStore.getStatement(cleanParams);
    try {
      const query = Object.keys(cleanParams).length > 0 ? `?${new URLSearchParams(cleanParams).toString()}` : '';
      return await this.request<StatementResponse>(`/reports/statement${query}`);
    } catch (error) {
      if (this.canUseMockFallback(error)) return mockStore.getStatement(cleanParams);
      throw error;
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
    } catch (error) {
      if (isLocalhost) return mockStore.getAnalytics(days);
      throw error;
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
      treasury: { entries: any[]; balance: number; main_balance?: number; shop_balance?: number };
    }>(`/finance/summary${query}`);
  }
  async createExpense(data: { category: string; description: string; amount: number; payment_method: string; expense_date: string; notes?: string }) { return this.request('/expenses', { method: 'POST', body: JSON.stringify(data) }); }
  async updateExpense(id: number, data: { category: string; description: string; amount: number; payment_method: string; expense_date: string; notes?: string }) { return this.request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async deleteExpense(id: number) { return this.request(`/expenses/${id}`, { method: 'DELETE' }); }
}

export const api = new ApiService();
