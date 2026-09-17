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

export interface Al5alStorage {
  currentUser: User | null;
  currentShift: Shift | null;
  shiftHistory: Shift[];
  devices: Device[];
  tables: Table[];
  products: Product[];
  orders: Order[];
  notifications: NotificationItem[];
}

const INITIAL_USERS: User[] = [
  {
    id: 1,
    name: 'Karim - كريم',
    email: 'admin@al5al.com',
    pin_code: '1234',
    phone: '01032890430',
    role: 'admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 2,
    name: 'Al-Ghareeb - الغريب',
    email: 'ghareeb@al5al.com',
    pin_code: '5678',
    phone: '01289535503',
    role: 'manager',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  },
  {
    id: 3,
    name: 'Cashier - كاشير الصالة',
    email: 'staff@al5al.com',
    pin_code: '0000',
    phone: '0502943796',
    role: 'staff',
    shift_id: 1,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  },
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 1, name: 'Turkish Coffee Double', name_ar: 'قهوة تركي دبل (سادة / مظبوط)', category: 'hot_drinks', price: 20.00, cost_price: 6.00, stock_quantity: 150, reorder_level: 20 },
  { id: 2, name: 'Egyptian Tea Special', name_ar: 'شاي ميزة بالنعناع', category: 'hot_drinks', price: 12.00, cost_price: 3.00, stock_quantity: 200, reorder_level: 30 },
  { id: 3, name: 'Espresso Double', name_ar: 'دبل إسبريسو إيطالي', category: 'hot_drinks', price: 25.00, cost_price: 7.00, stock_quantity: 120, reorder_level: 15 },
  { id: 4, name: 'Hot Spanish Latte', name_ar: 'سبانش لاتيه حار', category: 'hot_drinks', price: 35.00, cost_price: 12.00, stock_quantity: 80, reorder_level: 15 },
  { id: 5, name: 'Hot Chocolate Marshmallow', name_ar: 'هوت شوكليت مارشميلو', category: 'hot_drinks', price: 35.00, cost_price: 12.00, stock_quantity: 70, reorder_level: 10 },
  { id: 6, name: 'Iced Spanish Latte', name_ar: 'آيس سبانش لاتيه', category: 'cold_drinks', price: 40.00, cost_price: 14.00, stock_quantity: 90, reorder_level: 15 },
  { id: 7, name: 'Iced Caramel Macchiato', name_ar: 'آيس كراميل ماكياتو', category: 'cold_drinks', price: 40.00, cost_price: 14.00, stock_quantity: 75, reorder_level: 15 },
  { id: 8, name: 'Mojito Blueberry Energy', name_ar: 'موهيتو توت أزرق منعش', category: 'cold_drinks', price: 35.00, cost_price: 10.00, stock_quantity: 60, reorder_level: 10 },
  { id: 9, name: 'Iced Peach Tea', name_ar: 'آيس تي خوخ منعش', category: 'cold_drinks', price: 25.00, cost_price: 8.00, stock_quantity: 80, reorder_level: 15 },
  { id: 10, name: 'Red Bull Energy Can', name_ar: 'ريد بول كلاسيك 250 مل', category: 'soft_drinks', price: 45.00, cost_price: 30.00, stock_quantity: 6, reorder_level: 10 },
  { id: 11, name: 'Pepsi Can 330ml', name_ar: 'بيبسي كانز 330 مل', category: 'soft_drinks', price: 15.00, cost_price: 9.00, stock_quantity: 140, reorder_level: 20 },
  { id: 12, name: '7Up Lemon Can', name_ar: 'سفن أب كانز 330 مل', category: 'soft_drinks', price: 15.00, cost_price: 9.00, stock_quantity: 100, reorder_level: 20 },
  { id: 13, name: 'Mineral Water 600ml', name_ar: 'مياه معدنية 600 مل', category: 'soft_drinks', price: 8.00, cost_price: 4.00, stock_quantity: 180, reorder_level: 30 },
  { id: 14, name: 'Cheesy Gaming Nachos', name_ar: 'ناتشوز بالجبنة الشيدر والهلابينو', category: 'snacks', price: 45.00, cost_price: 18.00, stock_quantity: 40, reorder_level: 10 },
  { id: 15, name: 'Nutella Waffle', name_ar: 'وافل بالنوتيلا والمكسرات', category: 'food', price: 45.00, cost_price: 18.00, stock_quantity: 30, reorder_level: 8 },
  { id: 16, name: 'French Fries Cheesy', name_ar: 'بطاطس مقلية بالجبنة', category: 'snacks', price: 30.00, cost_price: 10.00, stock_quantity: 50, reorder_level: 10 },
  { id: 17, name: 'Double Chocolate Cookie', name_ar: 'كوكيز شوكولاتة طازج', category: 'snacks', price: 20.00, cost_price: 7.00, stock_quantity: 60, reorder_level: 15 },
];

function getInitialDevices(): Device[] {
  const now = Date.now();
  return [
    {
      id: 1,
      room_name: 'PlayStation Arena',
      room_name_ar: 'صالة البلايستيشن',
      device_name: 'PS5 Station 01',
      device_name_ar: 'بلايستيشن 1 (PS5)',
      device_type: 'ps5',
      status: 'active',
      hourly_rate: 45.00,
      specs: 'Sony PS5 + 65" 4K 120Hz + 2 Controllers',
      active_session: {
        id: 1,
        customer_name: 'زياد والأصدقاء',
        customer_phone: '01011223344',
        start_time: new Date(now - 45 * 60000).toISOString(),
        end_time: new Date(now + 15 * 60000).toISOString(),
        duration_minutes: 60,
        remaining_seconds: 15 * 60,
        is_ending_soon: false,
        is_ended: false,
        session_cost: 45.00,
        beverage_cost: 47.00,
        discount: 0,
        total_amount: 92.00,
        paid_amount: 0,
        payment_status: 'unpaid',
      },
    },
    {
      id: 2,
      room_name: 'PlayStation Arena',
      room_name_ar: 'صالة البلايستيشن',
      device_name: 'PS5 Station 02',
      device_name_ar: 'بلايستيشن 2 (PS5)',
      device_type: 'ps5',
      status: 'active',
      hourly_rate: 45.00,
      specs: 'Sony PS5 + 65" 4K 120Hz + 4 Controllers',
      active_session: {
        id: 2,
        customer_name: 'أحمد طارق',
        customer_phone: '01222334455',
        start_time: new Date(now - 53 * 60000).toISOString(),
        end_time: new Date(now + 7 * 60000).toISOString(),
        duration_minutes: 60,
        remaining_seconds: 7 * 60,
        is_ending_soon: true,
        is_ended: false,
        session_cost: 45.00,
        beverage_cost: 18.00,
        discount: 0,
        total_amount: 63.00,
        paid_amount: 0,
        payment_status: 'unpaid',
      },
    },
    {
      id: 3,
      room_name: 'PlayStation Arena',
      room_name_ar: 'صالة البلايستيشن',
      device_name: 'PS4 Station 03',
      device_name_ar: 'بلايستيشن 3 (PS4 Pro)',
      device_type: 'ps4',
      status: 'available',
      hourly_rate: 30.00,
      specs: 'Sony PS4 Pro + 55" 4K HDR + 2 Controllers',
      active_session: null,
    },
    {
      id: 4,
      room_name: 'VIP Cyber Suite',
      room_name_ar: 'غرفة كبار الزوار VIP',
      device_name: 'VIP PlayStation Room',
      device_name_ar: 'غرفة VIP بلايستيشن',
      device_type: 'ps5',
      status: 'available',
      hourly_rate: 75.00,
      specs: 'غرفة خاصة مكيفة + شاشة 85 بوصة + ساوند سيستم 5.1',
      active_session: null,
    },
    {
      id: 5,
      room_name: 'Billiards Arena',
      room_name_ar: 'صالة البلياردو الاحترافية',
      device_name: 'Billiard Table 01',
      device_name_ar: 'طاولة بلياردو 1 (رئيسية)',
      device_type: 'billiards',
      status: 'active',
      hourly_rate: 50.00,
      specs: 'طاولة بلياردو احترافية 9 قدم + طقم كرات آراميث + إضاءة LED مركزة',
      active_session: {
        id: 3,
        customer_name: 'محمد وتامر (بلياردو)',
        customer_phone: '01011223344',
        start_time: new Date(now - 25 * 60000).toISOString(),
        end_time: new Date(now + 35 * 60000).toISOString(),
        duration_minutes: 60,
        remaining_seconds: 35 * 60,
        is_ending_soon: false,
        is_ended: false,
        session_cost: 50.00,
        beverage_cost: 35.00,
        discount: 0,
        total_amount: 85.00,
        paid_amount: 0,
        payment_status: 'unpaid',
      },
    },
    {
      id: 6,
      room_name: 'Billiards Arena',
      room_name_ar: 'صالة البلياردو الاحترافية',
      device_name: 'Billiard Table 02',
      device_name_ar: 'طاولة بلياردو 2',
      device_type: 'billiards',
      status: 'available',
      hourly_rate: 50.00,
      specs: 'طاولة بلياردو احترافية 9 قدم + عصايات كربون',
      active_session: null,
    },
    {
      id: 7,
      room_name: 'Billiards Arena',
      room_name_ar: 'صالة البلياردو الاحترافية',
      device_name: 'Billiard Table 03',
      device_name_ar: 'طاولة بلياردو 3',
      device_type: 'billiards',
      status: 'available',
      hourly_rate: 50.00,
      specs: 'طاولة بلياردو احترافية 9 قدم',
      active_session: null,
    },
    {
      id: 8,
      room_name: 'Ping Pong Bay',
      room_name_ar: 'منطقة البينج بونج',
      device_name: 'Ping Pong Table 01',
      device_name_ar: 'طاولة بينج بونج 1',
      device_type: 'pingpong',
      status: 'active',
      hourly_rate: 35.00,
      specs: 'طاولة تنس طاولة دولية + مضارب Donic احترافية',
      active_session: {
        id: 4,
        customer_name: 'حازم وعمر (بينج)',
        customer_phone: '01122334455',
        start_time: new Date(now - 15 * 60000).toISOString(),
        end_time: new Date(now + 30 * 60000).toISOString(),
        duration_minutes: 45,
        remaining_seconds: 30 * 60,
        is_ending_soon: false,
        is_ended: false,
        session_cost: 26.25,
        beverage_cost: 30.00,
        discount: 0,
        total_amount: 56.25,
        paid_amount: 0,
        payment_status: 'unpaid',
      },
    },
    {
      id: 9,
      room_name: 'Ping Pong Bay',
      room_name_ar: 'منطقة البينج بونج',
      device_name: 'Ping Pong Table 02',
      device_name_ar: 'طاولة بينج بونج 2',
      device_type: 'pingpong',
      status: 'available',
      hourly_rate: 35.00,
      specs: 'طاولة تنس طاولة دولية + شبكة احترافية',
      active_session: null,
    },
  ];
}

const INITIAL_TABLES: Table[] = [
  { id: 1, table_number: 'T-01', capacity: 2, status: 'available', total_spent: 0, order: null },
  {
    id: 2,
    table_number: 'T-02',
    capacity: 4,
    status: 'occupied',
    total_spent: 115.00,
    order: {
      id: 1,
      order_number: 'ORD-A101',
      created_at: new Date(Date.now() - 40 * 60000).toISOString(),
      subtotal: 75.00,
      discount: 0,
      total_amount: 75.00,
      items_count: 3,
      items: [
        { id: 1, name: 'Iced Spanish Latte', name_ar: 'آيس سبانش لاتيه', quantity: 2, unit_price: 40.00, subtotal: 80.00 },
        { id: 2, name: 'Hot Spanish Latte', name_ar: 'سبانش لاتيه حار', quantity: 1, unit_price: 35.00, subtotal: 35.00 },
      ],
    },
  },
  {
    id: 3,
    table_number: 'T-03',
    capacity: 4,
    status: 'occupied',
    total_spent: 90.00,
    order: {
      id: 2,
      order_number: 'ORD-A102',
      created_at: new Date(Date.now() - 20 * 60000).toISOString(),
      subtotal: 90.00,
      discount: 0,
      total_amount: 90.00,
      items_count: 2,
      items: [
        { id: 3, name: 'Cheesy Gaming Nachos', name_ar: 'ناتشوز بالجبنة الشيدر والهلابينو', quantity: 1, unit_price: 45.00, subtotal: 45.00 },
        { id: 4, name: 'Nutella Waffle', name_ar: 'وافل بالنوتيلا والمكسرات', quantity: 1, unit_price: 45.00, subtotal: 45.00 },
      ],
    },
  },
  { id: 4, table_number: 'T-04', capacity: 6, status: 'available', total_spent: 0, order: null },
  { id: 5, table_number: 'T-05', capacity: 2, status: 'available', total_spent: 0, order: null },
  { id: 6, table_number: 'T-06', capacity: 4, status: 'available', total_spent: 0, order: null },
  {
    id: 7,
    table_number: 'T-07',
    capacity: 6,
    status: 'occupied',
    total_spent: 135.00,
    order: {
      id: 3,
      order_number: 'ORD-A103',
      created_at: new Date(Date.now() - 15 * 60000).toISOString(),
      subtotal: 145.00,
      discount: 10.00,
      total_amount: 135.00,
      items_count: 5,
      items: [
        { id: 5, name: 'Mojito Blueberry Energy', name_ar: 'موهيتو توت أزرق منعش', quantity: 3, unit_price: 35.00, subtotal: 105.00 },
        { id: 6, name: 'Double Chocolate Cookie', name_ar: 'كوكيز شوكولاتة طازج', quantity: 2, unit_price: 20.00, subtotal: 40.00 },
      ],
    },
  },
  { id: 8, table_number: 'T-08', capacity: 8, status: 'available', total_spent: 0, order: null },
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 1,
    type: 'session_ending',
    title: 'بلايستيشن 2 ينتهي قريباً (PS5 Station 02)',
    message: 'باقي أقل من 7 دقائق على انتهاء وقت العميل أحمد طارق. اسأله عن التمديد.',
    related_to: '2',
    is_read: false,
    created_at: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: 2,
    type: 'low_stock',
    title: 'تنبيه مخزون: ريد بول كلاسيك',
    message: 'المتبقي في الثلاجة 6 علب فقط (حد إعادة الطلب 10).',
    related_to: '10',
    is_read: false,
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
  },
];

class MockStore {
  private key = 'al5al_gaming_store_v1';
  private data: Al5alStorage;

  constructor() {
    this.data = this.load();
  }

  private load(): Al5alStorage {
    try {
      const stored = localStorage.getItem(this.key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore
    }
    const staffUser = INITIAL_USERS[2];
    return {
      currentUser: null,
      currentShift: {
        id: 1,
        staff_id: 3,
        start_time: new Date(Date.now() - 3 * 3600000).toISOString(),
        status: 'active',
        total_before_deductions: 640.00,
        total_after_deductions: 640.00,
        deductions: 0,
        cash_collected: 380.00,
        card_collected: 260.00,
        notes: 'وردية الصباح - صالة الخال',
        staff: staffUser,
      },
      shiftHistory: [],
      devices: getInitialDevices(),
      tables: INITIAL_TABLES,
      products: INITIAL_PRODUCTS,
      orders: [],
      notifications: INITIAL_NOTIFICATIONS,
    };
  }

  private save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch {
      // ignore
    }
  }

  login(credentials: { email?: string; password?: string; pin?: string }): { token: string; user: User } {
    let found: User | undefined;
    if (credentials.pin) {
      let managedUsers: User[] = [];
      try {
        managedUsers = JSON.parse(localStorage.getItem('al5al_admin_users') || '[]') as User[];
      } catch {
        managedUsers = [];
      }
      found = [...managedUsers, ...INITIAL_USERS].find((u) => u.pin_code === credentials.pin);
    } else if (credentials.email && credentials.password) {
      // Standalone mode has no password database; never authenticate by email alone.
      found = undefined;
    }

    if (!found) {
      throw new Error('بيانات الدخول غير صحيحة. استخدم حسابًا مسجلًا أو اطلب PIN صحيحًا من المدير.');
    }

    this.data.currentUser = found;
    this.save();
    return { token: 'mock-al5al-token-' + found.id, user: found };
  }

  getCurrentUser(): { user: User } {
    if (!this.data.currentUser) throw new Error('لا توجد جلسة دخول نشطة');
    return { user: this.data.currentUser };
  }

  logout(): void {
    this.data.currentUser = null;
    this.save();
  }

  getCurrentShift(): { active: boolean; shift: Shift | null; metrics: ShiftMetrics } {
    const shift = this.data.currentShift;
    const elapsedMinutes = shift ? Math.floor((Date.now() - new Date(shift.start_time).getTime()) / 60000) : 0;
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    const metrics: ShiftMetrics = {
      elapsed_time_formatted: hours + 'h ' + mins + 'm',
      elapsed_minutes: elapsedMinutes,
      total_orders: 8,
      total_sessions: 4,
      active_sessions_count: this.data.devices.filter((d) => d.status === 'active').length,
      total_beverages_sold: 14,
      total_revenue: shift ? shift.total_after_deductions : 0,
      cash_collected: shift ? shift.cash_collected : 0,
      card_collected: shift ? shift.card_collected : 0,
      average_order_value: 48.50,
    };
    return { active: !!shift && shift.status === 'active', shift, metrics };
  }

  startShift(data: { notes?: string }): { message: string; shift: Shift } {
    const user = this.data.currentUser || INITIAL_USERS[2];
    const newShift: Shift = {
      id: Date.now(),
      staff_id: user.id,
      start_time: new Date().toISOString(),
      status: 'active',
      total_before_deductions: 0,
      total_after_deductions: 0,
      deductions: 0,
      cash_collected: 0,
      card_collected: 0,
      notes: data.notes || 'وردية صالة الخال للألعاب والبلياردو',
      staff: user,
    };
    this.data.currentShift = newShift;
    this.save();
    return { message: 'تم فتح الوردية بنجاح', shift: newShift };
  }

  closeShift(id: number, data: { cash_counted?: number; deductions?: number; notes?: string }): { message: string; shift: Shift } {
    if (this.data.currentShift) {
      const closed = {
        ...this.data.currentShift,
        end_time: new Date().toISOString(),
        status: 'closed' as const,
        cash_collected: data.cash_counted ?? this.data.currentShift.cash_collected,
        deductions: data.deductions ?? 0,
        notes: data.notes ?? this.data.currentShift.notes,
      };
      this.data.shiftHistory.unshift(closed);
      this.data.currentShift = null;
      this.save();
      return { message: 'تم إغلاق الوردية وطباعة التقرير بنجاح', shift: closed };
    }
    throw new Error('لا توجد وردية نشطة حالياً لإغلاقها');
  }

  getShiftHistory(): { shifts: Shift[] } {
    return { shifts: this.data.shiftHistory };
  }

  getDevices(): { devices: Device[]; summary: { total_devices: number; active_devices: number; available_devices: number; maintenance_devices: number } } {
    const now = Date.now();
    const updated = this.data.devices.map((dev) => {
      if (dev.active_session && dev.status === 'active') {
        const isOpenEnded = Boolean(dev.active_session.is_open_ended);
        const remSec = isOpenEnded
          ? Math.max(1, Math.floor((now - new Date(dev.active_session.start_time).getTime()) / 1000))
          : Math.max(0, Math.floor((new Date(dev.active_session.end_time).getTime() - now) / 1000));
        return {
          ...dev,
          active_session: {
            ...dev.active_session,
            remaining_seconds: remSec,
            is_ending_soon: !isOpenEnded && remSec > 0 && remSec <= 600,
            is_ended: !isOpenEnded && remSec === 0,
          },
        };
      }
      return dev;
    });

    return {
      devices: updated,
      summary: {
        total_devices: updated.length,
        active_devices: updated.filter((d) => d.status === 'active').length,
        available_devices: updated.filter((d) => d.status === 'available').length,
        maintenance_devices: updated.filter((d) => d.status === 'maintenance').length,
      },
    };
  }

  startSession(deviceId: number, data: { duration_minutes?: number; is_open_ended?: boolean; customer_name?: string; customer_phone?: string; discount?: number }) {
    const dev = this.data.devices.find((d) => d.id === deviceId);
    if (!dev) throw new Error('الجهاز غير موجود');

    const isOpenEnded = Boolean(data.is_open_ended);
    const duration = isOpenEnded ? 0 : data.duration_minutes || 60;
    const startMs = Date.now();
    const endMs = isOpenEnded ? startMs : startMs + duration * 60000;
    const cost = isOpenEnded ? 0 : (duration / 60) * dev.hourly_rate;

    dev.status = 'active';
    dev.active_session = {
      id: Date.now(),
      customer_name: data.customer_name || 'عميل محترم',
      customer_phone: data.customer_phone,
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(endMs).toISOString(),
      duration_minutes: duration,
      is_open_ended: isOpenEnded,
      remaining_seconds: isOpenEnded ? 1 : duration * 60,
      is_ending_soon: false,
      is_ended: false,
      session_cost: cost,
      beverage_cost: 0,
      discount: data.discount || 0,
      total_amount: Math.max(0, cost - (data.discount || 0)),
      paid_amount: 0,
      payment_status: 'unpaid',
    };

    this.save();
    return { message: 'تم بدء الجلسة وتشغيل العداد بنجاح', session: dev.active_session };
  }

  extendSession(sessionId: number, added_minutes: number) {
    const dev = this.data.devices.find((d) => d.active_session?.id === sessionId);
    if (!dev || !dev.active_session) throw new Error('الجلسة غير موجودة');

    const addedMs = added_minutes * 60000;
    const currentEndMs = new Date(dev.active_session.end_time).getTime();
    const newEndMs = Math.max(Date.now(), currentEndMs) + addedMs;
    const addedCost = (added_minutes / 60) * dev.hourly_rate;

    dev.active_session.end_time = new Date(newEndMs).toISOString();
    dev.active_session.duration_minutes += added_minutes;
    dev.active_session.session_cost += addedCost;
    dev.active_session.total_amount += addedCost;
    dev.active_session.remaining_seconds = Math.max(0, Math.floor((newEndMs - Date.now()) / 1000));
    dev.active_session.is_ended = false;

    this.save();
    return { message: 'تم تمديد الوقت بمقدار ' + added_minutes + ' دقيقة بنجاح', session: dev.active_session };
  }

  addBeverageToSession(sessionId: number, items: { product_id: number; quantity: number; notes?: string }[]) {
    const dev = this.data.devices.find((d) => d.active_session?.id === sessionId);
    if (!dev || !dev.active_session) throw new Error('الجلسة غير موجودة');

    let addedBev = 0;
    items.forEach((it) => {
      const prod = this.data.products.find((p) => p.id === it.product_id);
      if (prod) {
        addedBev += prod.price * it.quantity;
        prod.stock_quantity = Math.max(0, prod.stock_quantity - it.quantity);
      }
    });

    dev.active_session.beverage_cost += addedBev;
    dev.active_session.total_amount += addedBev;
    this.save();
    return { message: 'تمت إضافة المشروبات للجلسة بنجاح', session: dev.active_session };
  }

  endSession(sessionId: number, data: { payment_method: string; discount?: number; amount_paid?: number }) {
    const dev = this.data.devices.find((d) => d.active_session?.id === sessionId);
    if (!dev || !dev.active_session) throw new Error('الجلسة غير موجودة');

    const session = dev.active_session;
    const elapsedMinutes = session.is_open_ended
      ? Math.max(1, Math.ceil((Date.now() - new Date(session.start_time).getTime()) / 60000))
      : session.duration_minutes;
    const sessionCost = session.is_open_ended
      ? (elapsedMinutes / 60) * dev.hourly_rate
      : session.session_cost;
    const finalAmount = Math.max(0, sessionCost + session.beverage_cost - (data.discount || 0));

    if (this.data.currentShift) {
      this.data.currentShift.total_before_deductions += sessionCost + session.beverage_cost;
      this.data.currentShift.total_after_deductions += finalAmount;
      if (data.payment_method === 'cash') {
        this.data.currentShift.cash_collected += finalAmount;
      } else {
        this.data.currentShift.card_collected += finalAmount;
      }
    }

    const receipt: ThermalReceipt = {
      business_name: 'AL5AL Gaming & Lounge',
      business_name_ar: 'صالة الخال للألعاب والبلياردو والكافيه',
      order_number: 'REC-' + Math.floor(1000 + Math.random() * 9000),
      date_time: new Date().toLocaleString('ar-EG'),
      staff_name: this.data.currentUser?.name || 'كاشير الصالة',
      order_type: 'gaming_room',
      device_name: dev.device_name_ar || dev.device_name,
      items: [
        {
          name: 'وقت اللعب (' + elapsedMinutes + ' دقيقة)',
          name_ar: 'وقت اللعب (' + elapsedMinutes + ' دقيقة)',
          quantity: 1,
          unit_price: sessionCost,
          subtotal: sessionCost,
        },
        ...(session.beverage_cost > 0
          ? [
              {
                name: 'مشروبات وضيافة الكافيه',
                name_ar: 'مشروبات وضيافة الكافيه',
                quantity: 1,
                unit_price: session.beverage_cost,
                subtotal: session.beverage_cost,
              },
            ]
          : []),
      ],
      subtotal: sessionCost + session.beverage_cost,
      discount: data.discount || 0,
      tax: 0,
      total_amount: finalAmount,
      payment_method: data.payment_method,
      payment_status: 'paid',
      footer_note: 'Thank you for playing at AL5AL! ★ Enjoy The Game ★',
      footer_note_ar: 'شكراً لزيارتكم صالة الخال! ★ استمتع بأفضل تجربة وتحدي ★',
    };

    dev.status = 'available';
    dev.active_session = null;
    this.save();

    return { message: 'تم إنهاء الجلسة وتسجيل الدفع بنجاح', receipt };
  }

  getOrders(): { data: Order[] } {
    return { data: this.data.orders };
  }

  createOrder(data: {
    order_type: 'take_away' | 'dine_in' | 'gaming_room';
    table_id?: number | null;
    device_session_id?: number | null;
    items: { product_id: number; quantity: number; notes?: string }[];
    discount?: number;
    tax?: number;
    payment_method?: string;
    payment_status?: string;
    notes?: string;
  }): { message: string; order: Order } {
    let subtotal = 0;
    const orderItems = data.items.map((it) => {
      const prod = this.data.products.find((p) => p.id === it.product_id);
      const price = prod?.price || 20;
      subtotal += price * it.quantity;
      if (prod) prod.stock_quantity = Math.max(0, prod.stock_quantity - it.quantity);
      return {
        product_id: it.product_id,
        product: prod,
        quantity: it.quantity,
        unit_price: price,
        subtotal: price * it.quantity,
        notes: it.notes,
      };
    });

    const total = Math.max(0, subtotal - (data.discount || 0) + (data.tax || 0));
    const newOrder: Order = {
      id: Date.now(),
      order_number: 'ORD-A' + Math.floor(100 + Math.random() * 900),
      status: 'completed',
      order_type: data.order_type,
      table_id: data.table_id,
      device_session_id: data.device_session_id,
      subtotal,
      discount: data.discount || 0,
      tax: data.tax || 0,
      total_amount: total,
      payment_method: (data.payment_method as any) || 'cash',
      payment_status: (data.payment_status as any) || 'paid',
      notes: data.notes,
      created_at: new Date().toISOString(),
      items: orderItems,
    };

    this.data.orders.unshift(newOrder);

    if (data.table_id) {
      const tbl = this.data.tables.find((t) => t.id === data.table_id);
      if (tbl) {
        tbl.status = 'occupied';
        tbl.total_spent += total;
      }
    }

    if (this.data.currentShift && data.payment_status === 'paid') {
      this.data.currentShift.total_before_deductions += subtotal;
      this.data.currentShift.total_after_deductions += total;
      if (data.payment_method === 'card' || data.payment_method === 'visa') {
        this.data.currentShift.card_collected += total;
      } else {
        this.data.currentShift.cash_collected += total;
      }
    }

    this.save();
    return { message: 'تم إنشاء الطلب بنجاح', order: newOrder };
  }

  getTables(): { tables: Table[]; summary: { total_tables: number; occupied_tables: number; available_tables: number } } {
    return {
      tables: this.data.tables,
      summary: {
        total_tables: this.data.tables.length,
        occupied_tables: this.data.tables.filter((t) => t.status === 'occupied').length,
        available_tables: this.data.tables.filter((t) => t.status === 'available').length,
      },
    };
  }

  occupyTable(tableId: number) {
    const tbl = this.data.tables.find((t) => t.id === tableId);
    if (tbl) {
      tbl.status = 'occupied';
      this.save();
    }
    return { message: 'تم شغل الطاولة بنجاح' };
  }

  releaseTable(tableId: number, payment_method: string = 'cash') {
    const tbl = this.data.tables.find((t) => t.id === tableId);
    if (tbl) {
      tbl.status = 'available';
      tbl.order = null;
      tbl.total_spent = 0;
      this.save();
    }
    return { message: 'تم إخلاء الطاولة وتسجيل الحساب بنجاح' };
  }

  getProducts(): { products: Product[]; categories: Record<string, string>; summary: { total_products: number; low_stock_count: number } } {
    return {
      products: this.data.products,
      categories: {
        hot_drinks: 'مشروبات ساخنة',
        cold_drinks: 'مشروبات باردة',
        soft_drinks: 'مشروبات غازية وطاقة',
        snacks: 'سناكس وتسالي',
        food: 'وجبات ومخبوزات',
      },
      summary: {
        total_products: this.data.products.length,
        low_stock_count: this.data.products.filter((p) => p.stock_quantity <= p.reorder_level).length,
      },
    };
  }

  updateStock(productId: number, data: { quantity_change: number }) {
    const prod = this.data.products.find((p) => p.id === productId);
    if (prod) {
      prod.stock_quantity = Math.max(0, prod.stock_quantity + data.quantity_change);
      this.save();
    }
    return { message: 'تم تحديث المخزون بنجاح' };
  }

  getNotifications(): { notifications: NotificationItem[]; unread_count: number } {
    return {
      notifications: this.data.notifications,
      unread_count: this.data.notifications.filter((n) => !n.is_read).length,
    };
  }

  markNotificationAsRead(id: number) {
    const n = this.data.notifications.find((notif) => notif.id === id);
    if (n) {
      n.is_read = true;
      this.save();
    }
    return { message: 'تم تحديد الإشعار كمقروء' };
  }

  markAllNotificationsAsRead() {
    this.data.notifications.forEach((n) => (n.is_read = true));
    this.save();
    return { message: 'تم تحديد جميع الإشعارات كمقروءة' };
  }

  getDashboardReport() {
    return {
      metrics: {
        total_revenue_today: 1240.00,
        cafe_revenue_today: 520.00,
        gaming_revenue_today: 720.00,
        cash_total: 820.00,
        card_total: 420.00,
        orders_count: 14,
        sessions_count: 8,
        active_devices_count: this.data.devices.filter((d) => d.status === 'active').length,
        total_devices_count: this.data.devices.length,
        device_occupancy_rate: 44,
        occupied_tables_count: this.data.tables.filter((t) => t.status === 'occupied').length,
        total_tables_count: this.data.tables.length,
        table_occupancy_rate: 37.5,
        low_stock_count: 1,
      },
      current_shift: this.data.currentShift,
      top_products: [
        { name_ar: 'آيس سبانش لاتيه', sales_count: 18, revenue: 720.00 },
        { name_ar: 'شاي ميزة بالنعناع', sales_count: 24, revenue: 288.00 },
        { name_ar: 'قهوة تركي دبل', sales_count: 14, revenue: 280.00 },
        { name_ar: 'موهيتو توت أزرق منعش', sales_count: 8, revenue: 280.00 },
      ],
      recent_orders: this.data.orders.slice(0, 5),
    };
  }

  getAnalytics(days: number = 7) {
    return {
      daily_stats: [
        { date: '2026-09-09', day: 'السبت', cafe_revenue: 650, gaming_revenue: 890, total_revenue: 1540, orders_count: 19, sessions_count: 12 },
        { date: '2026-09-10', day: 'الأحد', cafe_revenue: 480, gaming_revenue: 720, total_revenue: 1200, orders_count: 14, sessions_count: 9 },
        { date: '2026-09-11', day: 'الاثنين', cafe_revenue: 520, gaming_revenue: 780, total_revenue: 1300, orders_count: 15, sessions_count: 10 },
        { date: '2026-09-12', day: 'الثلاثاء', cafe_revenue: 610, gaming_revenue: 840, total_revenue: 1450, orders_count: 17, sessions_count: 11 },
        { date: '2026-09-13', day: 'الأربعاء', cafe_revenue: 700, gaming_revenue: 950, total_revenue: 1650, orders_count: 21, sessions_count: 13 },
        { date: '2026-09-14', day: 'الخميس', cafe_revenue: 980, gaming_revenue: 1420, total_revenue: 2400, orders_count: 28, sessions_count: 18 },
        { date: '2026-09-15', day: 'الجمعة', cafe_revenue: 1150, gaming_revenue: 1680, total_revenue: 2830, orders_count: 34, sessions_count: 22 },
      ],
      category_breakdown: [
        { category: 'hot_drinks', label: 'مشروبات ساخنة', amount: 980, percentage: 35 },
        { category: 'cold_drinks', label: 'مشروبات باردة', amount: 1120, percentage: 40 },
        { category: 'soft_drinks', label: 'مشروبات طاقة وغازية', amount: 420, percentage: 15 },
        { category: 'snacks', label: 'سناكس وتسالي', amount: 280, percentage: 10 },
      ],
    };
  }
}

export const mockStore = new MockStore();
