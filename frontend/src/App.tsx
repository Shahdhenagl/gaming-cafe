import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Gamepad2, 
  Coffee, 
  Users, 
  Clock, 
  Package, 
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { Device, NotificationItem, Order, Product, Shift, ShiftMetrics, Table, ThermalReceipt, User } from './types';
import { Language, translations } from './i18n/translations';
import { api } from './services/api';
import { Header } from './components/Header';
import { GamingRoom } from './components/GamingRoom';
import { PosBar } from './components/PosBar';
import { TableManagement } from './components/TableManagement';
import { ShiftDashboard } from './components/ShiftDashboard';
import { InventoryView } from './components/InventoryView';
import { AdminDashboard } from './components/AdminDashboard';
import { ManagementDashboard } from './components/ManagementDashboard';
import { StartShiftModal } from './components/StartShiftModal';
import { EndShiftModal } from './components/EndShiftModal';
import { LoginModal } from './components/LoginModal';
import { ThermalReceiptModal } from './components/ThermalReceiptModal';

export function App() {
  // Localization: 'en' (LTR) vs 'ar' (RTL)
  const [lang, setLang] = useState<Language>(() => {
    return (localStorage.getItem('nexus_lang') as Language) || 'en';
  });
  const [isLightMode, setIsLightMode] = useState<boolean>(() => localStorage.getItem('nexus_theme') === 'light');

  const t = translations[lang];

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'gaming' | 'pos' | 'tables' | 'shift' | 'inventory' | 'analytics' | 'management'>('gaming');

  // Core system data
  const [user, setUser] = useState<User | null>(null);
  const [shift, setShift] = useState<Shift | null>(null);
  const [metrics, setMetrics] = useState<ShiftMetrics | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const notifiedIds = useRef<Set<number>>(new Set());

  // Modals
  const [showStartShiftModal, setShowStartShiftModal] = useState<boolean>(false);
  const [showEndShiftModal, setShowEndShiftModal] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [receiptModalData, setReceiptModalData] = useState<ThermalReceipt | null>(null);

  // Update HTML dir and lang attributes
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    localStorage.setItem('nexus_lang', lang);
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLightMode);
    document.documentElement.style.colorScheme = isLightMode ? 'light' : 'dark';
    localStorage.setItem('nexus_theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  // Fetch all primary operational data
  const loadInitialData = useCallback(async () => {
    try {
      const [userRes, shiftRes, devRes, prodRes, tableRes, notifRes] = await Promise.all([
        api.getCurrentUser().catch(() => ({ user: null })),
        api.getCurrentShift().catch(() => ({ active: false, shift: null, metrics: null as any })),
        api.getDevices().catch(() => ({ devices: [] })),
        api.getProducts().catch(() => ({ products: [] })),
        api.getTables().catch(() => ({ tables: [] })),
        api.getNotifications().catch(() => ({ notifications: [], unread_count: 0 })),
      ]);

      if (userRes && userRes.user) setUser(userRes.user);
      if (shiftRes) {
        setShift(shiftRes.shift);
        setMetrics(shiftRes.metrics);
      }
      if (devRes && devRes.devices) setDevices(devRes.devices);
      if (prodRes && prodRes.products) setProducts(prodRes.products);
      if (tableRes && tableRes.tables) setTables(tableRes.tables);
      if (notifRes) {
        const nextNotifications = notifRes.notifications || [];
        setNotifications(nextNotifications);
        setUnreadCount(notifRes.unread_count || 0);
        nextNotifications.filter((n) => !n.is_read && !notifiedIds.current.has(n.id)).forEach((n) => {
          notifiedIds.current.add(n.id);
          if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker?.ready.then((registration) => registration.showNotification(n.title, { body: n.message, icon: '/controller-icon.svg', tag: `notification-${n.id}` })).catch(() => undefined);
          }
        });
      }
    } catch (e) {
      console.error('Error loading initial data:', e);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  const refreshOperationalData = useCallback(async () => {
    try {
      const [devRes, tableRes] = await Promise.all([api.getDevices(), api.getTables()]);
      if (devRes?.devices) setDevices(devRes.devices);
      if (tableRes?.tables) setTables(tableRes.tables);
    } catch {
      // Keep the last known state; an action should not be blocked by a refresh.
    }
  }, []);

  useEffect(() => {
    loadInitialData();

    // Keep operational cards fresh without repeatedly loading heavy reports/notifications.
    const interval = setInterval(async () => {
      try {
        const [devRes, tableRes] = await Promise.all([
          api.getDevices(),
          api.getTables(),
        ]);

        if (devRes && devRes.devices) setDevices(devRes.devices);
        if (tableRes && tableRes.tables) setTables(tableRes.tables);
      } catch (e) {
        // quiet polling error
      }
    }, 30000);

    const secondaryInterval = setInterval(async () => {
      try {
        const [notifRes, shiftRes] = await Promise.all([api.getNotifications(), api.getCurrentShift()]);
        if (notifRes) { setNotifications(notifRes.notifications || []); setUnreadCount(notifRes.unread_count || 0); }
        if (shiftRes) { setShift(shiftRes.shift); setMetrics(shiftRes.metrics); }
      } catch { /* keep last known state */ }
    }, 30000);

    return () => { clearInterval(interval); clearInterval(secondaryInterval); };
  }, [loadInitialData]);

  // Actions
  const handleStartShift = async (notes: string) => {
    const res = await api.startShift({ notes });
    setShift(res.shift);
    await loadInitialData();
  };

  const handleEndShift = async (data: { cash_counted: number; deductions: number; notes: string }) => {
    if (!shift) return;
    const res = await api.closeShift(shift.id, data);
    setShift(res.shift);
    await loadInitialData();
  };

  const handleLogin = async (credentials: { email?: string; password?: string; pin?: string }) => {
    const res = await api.login(credentials);
    setUser(res.user);
    await loadInitialData();
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
  };

  const handleStartGamingSession = async (
    deviceId: number,
    data: { duration_minutes?: number; is_open_ended?: boolean; customer_name?: string; customer_phone?: string; discount?: number }
  ) => {
    await api.startSession(deviceId, data);
    void refreshOperationalData();
  };

  const handleExtendGamingSession = async (sessionId: number, addedMinutes: number) => {
    await api.extendSession(sessionId, addedMinutes);
    void refreshOperationalData();
  };

  const handleAddBeverageToSession = async (
    sessionId: number,
    items: { product_id: number; quantity: number }[]
  ) => {
    await api.addBeverageToSession(sessionId, items);
    void refreshOperationalData();
  };

  const handleEndGamingSession = async (
    sessionId: number,
    data: { payment_method: string; discount?: number; amount_paid?: number }
  ) => {
    const res = await api.endSession(sessionId, data);
    void refreshOperationalData();
    if (res && res.receipt) {
      const rawReceipt = res.receipt as ThermalReceipt & { orders?: Order[] };
      const items = Array.isArray(rawReceipt.items)
        ? rawReceipt.items
        : (rawReceipt.orders || []).flatMap((order) => (order.items || []).map((item) => ({
            name: item.product?.name || 'Item',
            name_ar: item.product?.name_ar || item.product?.name || 'صنف',
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.subtotal,
          })));
      setReceiptModalData({ ...rawReceipt, items });
    }
  };

  const handlePosCheckout = async (data: any) => {
    const res = await api.createOrder(data);
    void refreshOperationalData();

    // Fetch thermal receipt for order
    let receipt: ThermalReceipt | undefined;
    try {
      const recRes = await api.getOrderReceipt(res.order.id);
      receipt = recRes.receipt;
    } catch {
      // ignore
    }

    return { order: res.order, receipt };
  };

  const handleOccupyTable = async (tableId: number) => {
    await api.occupyTable(tableId);
    void refreshOperationalData();
  };

  const handleMoveTableToGaming = async (tableId: number, deviceSessionId: number) => {
    await api.moveTableToGaming(tableId, deviceSessionId);
    void refreshOperationalData();
  };

  const handleReleaseTable = async (tableId: number, paymentMethod: string) => {
    await api.releaseTable(tableId, paymentMethod);
    void refreshOperationalData();
  };

  const handleMarkNotifRead = async (id: number) => {
    await api.markNotificationAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const handleMarkAllNotifsRead = async () => {
    await api.markAllNotificationsAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const navItems = [
    { id: 'gaming', label: t.navGaming, icon: Gamepad2 },
    { id: 'pos', label: t.navPos, icon: Coffee },
    { id: 'tables', label: t.navTables, icon: Users },
    { id: 'shift', label: t.navShift, icon: Clock },
    { id: 'inventory', label: t.navInventory, icon: Package },
    { id: 'analytics', label: t.navAnalytics, icon: BarChart3 },
    { id: 'management', label: lang === 'ar' ? 'لوحة التحكم' : 'Management', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#0a0c16] text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      {/* Top Header */}
      <Header
        lang={lang}
        onToggleLang={toggleLanguage}
        isLightMode={isLightMode}
        onToggleTheme={() => setIsLightMode((previous) => !previous)}
        user={user}
        shift={shift}
        metrics={metrics}
        notifications={notifications}
        unreadNotificationsCount={unreadCount}
        onMarkNotificationRead={handleMarkNotifRead}
        onMarkAllNotificationsRead={handleMarkAllNotifsRead}
        onOpenStartShift={() => setShowStartShiftModal(true)}
        onOpenEndShift={() => setShowEndShiftModal(true)}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
        onEnableNotifications={async () => {
          if ('Notification' in window) await Notification.requestPermission();
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center gap-1.5 bg-surface/80 border border-border p-1.5 rounded-2xl overflow-x-auto shadow-sm snap-x">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-bold text-xs lg:text-sm transition-all whitespace-nowrap snap-start ${
                  isActive
                    ? 'bg-primary text-white shadow-neon-purple scale-[1.02]'
                    : 'text-slate-400 hover:text-white hover:bg-card'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Views */}
        {loadingInitial ? (
          <div className="py-24 text-center text-slate-400 space-y-3">
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-semibold">Initializing Nexus Gaming & Cafe System...</p>
          </div>
        ) : (
          <div>
            {activeTab === 'gaming' && (
              <GamingRoom
                lang={lang}
                devices={devices}
                products={products}
                onStartSession={handleStartGamingSession}
                onExtendSession={handleExtendGamingSession}
                onAddBeverageToSession={handleAddBeverageToSession}
                onEndSession={handleEndGamingSession}
                onRefresh={loadInitialData}
              />
            )}

            {activeTab === 'pos' && (
              <PosBar
                lang={lang}
                products={products}
                tables={tables}
                devices={devices}
                onCheckout={handlePosCheckout}
                onShowReceipt={(receipt) => setReceiptModalData(receipt)}
              />
            )}

            {activeTab === 'tables' && (
              <TableManagement
                lang={lang}
                tables={tables}
                devices={devices}
                onOccupyTable={handleOccupyTable}
                onMoveTableToGaming={handleMoveTableToGaming}
                onReleaseTable={handleReleaseTable}
                onRefresh={loadInitialData}
              />
            )}

            {activeTab === 'shift' && (
              <ShiftDashboard
                lang={lang}
                shift={shift}
                metrics={metrics}
                user={user}
                onOpenStartShift={() => setShowStartShiftModal(true)}
                onOpenEndShift={() => setShowEndShiftModal(true)}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryView
                lang={lang}
                products={products}
                onRefreshProducts={loadInitialData}
              />
            )}

            {activeTab === 'analytics' && (
              <AdminDashboard lang={lang} />
            )}
            {activeTab === 'management' && (
              <ManagementDashboard lang={lang} products={products} devices={devices} user={user} onRefresh={loadInitialData} />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/80 bg-[#080a14] py-4 text-center text-xs text-slate-500">
        <p>
          Nexus Gaming Cafe & Coffee Lounge Management System • {new Date().getFullYear()} • Powered by Laravel 11 & React
        </p>
      </footer>

      {/* --- MODALS --- */}
      <StartShiftModal
        lang={lang}
        isOpen={showStartShiftModal}
        onClose={() => setShowStartShiftModal(false)}
        onStartShift={handleStartShift}
      />

      <EndShiftModal
        lang={lang}
        isOpen={showEndShiftModal}
        shift={shift}
        metrics={metrics}
        onClose={() => setShowEndShiftModal(false)}
        onEndShift={handleEndShift}
      />

      <LoginModal
        lang={lang}
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />

      <ThermalReceiptModal
        lang={lang}
        receipt={receiptModalData}
        onClose={() => setReceiptModalData(null)}
      />
    </div>
  );
}

export default App;
