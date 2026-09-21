import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Monitor, 
  Clock, 
  Plus, 
  Coffee, 
  CheckCircle, 
  AlertCircle, 
  Zap, 
  Users, 
  Tv, 
  DollarSign, 
  Check, 
  Flame, 
  Sparkles,
  Search,
  X,
  Trash2,
  Minus,
  History
} from 'lucide-react';
import { Device, Product, ThermalReceipt } from '../types';
import { Language, translations } from '../i18n/translations';
import { sounds } from '../utils/audio';
import { formatSeconds, safeNum, formatMoney } from '../utils/format';
import { api } from '../services/api';

interface GamingRoomProps {
  lang: Language;
  devices: Device[];
  products: Product[];
  onStartSession: (deviceId: number, data: { duration_minutes?: number; is_open_ended?: boolean; customer_name?: string; customer_phone?: string; discount?: number }) => Promise<void>;
  onExtendSession: (sessionId: number, addedMinutes: number) => Promise<void>;
  onAddBeverageToSession: (sessionId: number, items: { product_id: number; quantity: number }[]) => Promise<void>;
  onEndSession: (sessionId: number, data: { payment_method: string; discount?: number; amount_paid?: number; customer_name?: string; customer_phone?: string }) => Promise<ThermalReceipt | void>;
  onShowReceipt?: (receipt: ThermalReceipt) => void;
  onRefresh: () => void;
}

export const GamingRoom: React.FC<GamingRoomProps> = ({
  lang,
  devices,
  products,
  onStartSession,
  onExtendSession,
  onAddBeverageToSession,
  onEndSession,
  onShowReceipt,
  onRefresh,
}) => {
  const t = translations[lang];

  // Room filter
  const [selectedRoom, setSelectedRoom] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [startModalDevice, setStartModalDevice] = useState<Device | null>(null);
  const [extendModalDevice, setExtendModalDevice] = useState<Device | null>(null);
  const [drinkModalDevice, setDrinkModalDevice] = useState<Device | null>(null);
  const [endModalDevice, setEndModalDevice] = useState<Device | null>(null);

  // Form states
  const [startDuration, setStartDuration] = useState<number>(60);
  const [startCustomDuration, setStartCustomDuration] = useState<string>('');
  const [openEnded, setOpenEnded] = useState(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  const [extendMinutes, setExtendMinutes] = useState<number>(30);
  const [extendCustomMinutes, setExtendCustomMinutes] = useState<string>('');

  const [selectedDrinks, setSelectedDrinks] = useState<{ [productId: number]: number }>({});
  const [endPaymentMethod, setEndPaymentMethod] = useState<string>('cash');
  const [endCustomerName, setEndCustomerName] = useState('');
  const [endCustomerPhone, setEndCustomerPhone] = useState('');
  const [endDiscount, setEndDiscount] = useState<string>('0');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string>('');

  // Item update state inside session
  const [updatingSessionItemId, setUpdatingSessionItemId] = useState<number | null>(null);

  // Manual / Offline Session Modal state
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualDeviceId, setManualDeviceId] = useState<number>(devices[0]?.id || 0);
  const [manualCustomerName, setManualCustomerName] = useState('');
  const [manualCustomerPhone, setManualCustomerPhone] = useState('');
  const [manualDuration, setManualDuration] = useState<number>(60);
  const [manualCustomDuration, setManualCustomDuration] = useState<string>('');
  const [manualHourlyRate, setManualHourlyRate] = useState<string>('');
  const [manualDrinks, setManualDrinks] = useState<{ [productId: number]: number }>({});
  const [manualPaymentMethod, setManualPaymentMethod] = useState<string>('cash');
  const [manualDiscount, setManualDiscount] = useState<string>('0');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');

  const getOpenEndedElapsedSeconds = (startTime: string) =>
    Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000));

  const getSelectedStartDuration = () => {
    const customDuration = parseInt(startCustomDuration, 10);
    return Number.isFinite(customDuration) && customDuration > 0 ? customDuration : startDuration;
  };

  // Unique rooms list
  const rooms = ['all', ...Array.from(new Set(devices.map((d) => d.room_name)))];

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    const matchesRoom = selectedRoom === 'all' || device.room_name === selectedRoom;
    const matchesSearch =
      device.device_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (device.device_name_ar && device.device_name_ar.includes(searchQuery)) ||
      (device.active_session?.customer_name &&
        device.active_session.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRoom && matchesSearch;
  });

  // Track triggered alerts so sound only plays once per session threshold
  const alertedRef = React.useRef<{ [alertKey: string]: boolean }>({});

  // Local seconds ticking for active devices
  const [countdowns, setCountdowns] = useState<{ [deviceId: number]: number }>({});

  useEffect(() => {
    const initialCounts: { [deviceId: number]: number } = {};
    devices.forEach((d) => {
      if (d.active_session) {
        initialCounts[d.id] = d.active_session.is_open_ended
          ? getOpenEndedElapsedSeconds(d.active_session.start_time)
          : Math.max(0, Math.floor(safeNum(d.active_session.remaining_seconds)));
      }
    });
    setCountdowns(initialCounts);

    const timer = setInterval(() => {
      setCountdowns((prev) => {
        const next: { [deviceId: number]: number } = { ...prev };

        devices.forEach((d) => {
          if (d.active_session) {
            const current = next[d.id] !== undefined ? next[d.id] : d.active_session.is_open_ended
              ? getOpenEndedElapsedSeconds(d.active_session.start_time)
              : Math.max(0, Math.floor(safeNum(d.active_session.remaining_seconds)));
            if (d.active_session.is_open_ended) {
              // Recalculate from the server start timestamp so refreshes,
              // polling, and delayed renders never add an extra hour/minute.
              next[d.id] = getOpenEndedElapsedSeconds(d.active_session.start_time);
            } else if (current > 0) {
              const updated = current - 1;
              next[d.id] = updated;

              const sId = d.active_session.id;
              // Check audio warnings (only once per threshold)
              if (updated <= 600 && updated > 595 && !alertedRef.current[`10m-${sId}`]) {
                alertedRef.current[`10m-${sId}`] = true;
                sounds.playWarning10Min();
              } else if (updated <= 300 && updated > 295 && !alertedRef.current[`5m-${sId}`]) {
                alertedRef.current[`5m-${sId}`] = true;
                sounds.playWarning5Min();
              } else if (updated <= 0 && !alertedRef.current[`0m-${sId}`]) {
                alertedRef.current[`0m-${sId}`] = true;
                sounds.playSessionEnded();
              }
            } else {
              next[d.id] = 0;
            }
          }
        });

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [devices]);

  const formatTime = (totalSeconds: number) => {
    return formatSeconds(totalSeconds);
  };

  const settlementSessionCost = endModalDevice?.active_session
    ? endModalDevice.active_session.is_open_ended
      ? Math.round(((countdowns[endModalDevice.id] || 0) / 60) * (endModalDevice.hourly_rate / 60) * 100) / 100
      : safeNum(endModalDevice.active_session.session_cost)
    : 0;

  // Handlers
  const handleStartSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startModalDevice) return;
    setActionLoading(true);
    setActionError('');
    try {
      const durationMinutes = getSelectedStartDuration();
      await onStartSession(startModalDevice.id, {
        ...(openEnded ? { is_open_ended: true } : { duration_minutes: durationMinutes }),
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
      });
      setStartModalDevice(null);
      setCustomerName('');
      setCustomerPhone('');
      setStartCustomDuration('');
      setOpenEnded(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not start session');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendModalDevice || !extendModalDevice.active_session) return;
    setActionLoading(true);
    try {
      const finalMinutes = extendCustomMinutes ? parseInt(extendCustomMinutes) : extendMinutes;
      await onExtendSession(extendModalDevice.active_session.id, finalMinutes);
      setExtendModalDevice(null);
      setExtendCustomMinutes('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDrinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drinkModalDevice || !drinkModalDevice.active_session) return;
    const items = Object.entries(selectedDrinks)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        product_id: parseInt(productId),
        quantity,
      }));

    if (items.length === 0) return;

    setActionLoading(true);
    try {
      await onAddBeverageToSession(drinkModalDevice.active_session.id, items);
      setDrinkModalDevice(null);
      setSelectedDrinks({});
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endModalDevice || !endModalDevice.active_session) return;
    setActionLoading(true);
    try {
      await onEndSession(endModalDevice.active_session.id, {
        payment_method: endPaymentMethod,
        discount: parseFloat(endDiscount) || 0,
        customer_name: endPaymentMethod === 'credit' ? endCustomerName.trim() : undefined,
        customer_phone: endPaymentMethod === 'credit' ? endCustomerPhone.trim() : undefined,
      });
      sounds.playCashRegister();
      setEndModalDevice(null);
      setEndDiscount('0');
      setEndCustomerName('');
      setEndCustomerPhone('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSessionItem = async (itemId: number, newQty: number) => {
    setUpdatingSessionItemId(itemId);
    try {
      if (newQty <= 0) {
        await api.deleteOrderItem(itemId);
      } else {
        await api.updateOrderItem(itemId, newQty);
      }
      sounds.playClick();
      onRefresh();

      if (drinkModalDevice?.active_session?.orders) {
        const updatedOrders = drinkModalDevice.active_session.orders.map((ord) => {
          const updatedItems = (ord.items || [])
            .map((it) => (it.id === itemId ? (newQty > 0 ? { ...it, quantity: newQty, subtotal: it.unit_price * newQty } : null) : it))
            .filter(Boolean) as any[];
          const newSub = updatedItems.reduce((s, i) => s + i.subtotal, 0);
          return { ...ord, items: updatedItems, subtotal: newSub, total_amount: newSub };
        });
        const newBevCost = updatedOrders.reduce((s, o) => s + o.total_amount, 0);
        const newTotal = (drinkModalDevice.active_session.session_cost || 0) + newBevCost - (drinkModalDevice.active_session.discount || 0);
        setDrinkModalDevice({
          ...drinkModalDevice,
          active_session: {
            ...drinkModalDevice.active_session,
            beverage_cost: newBevCost,
            total_amount: newTotal,
            orders: updatedOrders,
          },
        });
      }
    } catch (err) {
      console.error('Failed to update session item:', err);
    } finally {
      setUpdatingSessionItemId(null);
    }
  };

  const handleManualSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dev = devices.find((d) => d.id === manualDeviceId);
    if (!dev) {
      setManualError('يرجى اختيار الجهاز');
      return;
    }

    if (manualPaymentMethod === 'credit' && (!manualCustomerName.trim() || !manualCustomerPhone.trim())) {
      setManualError('يرجى كتابة اسم العميل ورقم الهاتف للآجل');
      return;
    }

    const duration = manualCustomDuration ? parseInt(manualCustomDuration, 10) : manualDuration;
    if (!duration || duration <= 0) {
      setManualError('يرجى تحديد مدة اللعب');
      return;
    }

    const drinks = Object.entries(manualDrinks)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => ({ product_id: Number(id), quantity: qty }));

    setManualLoading(true);
    setManualError('');
    try {
      const res = await api.addManualSession({
        device_id: manualDeviceId,
        customer_name: manualCustomerName.trim() || undefined,
        customer_phone: manualCustomerPhone.trim() || undefined,
        duration_minutes: duration,
        hourly_rate: manualHourlyRate ? parseFloat(manualHourlyRate) : dev.hourly_rate,
        discount: parseFloat(manualDiscount) || 0,
        payment_method: manualPaymentMethod,
        items: drinks.length > 0 ? drinks : undefined,
      });

      sounds.playCashRegister();
      setManualModalOpen(false);
      setManualDrinks({});
      setManualCustomerName('');
      setManualCustomerPhone('');
      setManualDiscount('0');
      onRefresh();

      if (res.receipt && onShowReceipt) {
        onShowReceipt(res.receipt);
      }
    } catch (err: any) {
      setManualError(err?.message || 'تعذر تسجيل الجلسة اليدوية');
    } finally {
      setManualLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {actionError && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">{actionError}</div>}
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2.5">
            <Gamepad2 className="w-7 h-7 text-primary-light" />
            <span>{t.gamingTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.gamingSubtitle}
          </p>
        </div>

        {/* Room Filter Pills & Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-card border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary w-36 lg:w-48"
            />
          </div>

          <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border overflow-x-auto">
            {rooms.map((rm) => (
              <button
                key={rm}
                onClick={() => setSelectedRoom(rm)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                  selectedRoom === rm
                    ? 'bg-primary text-white shadow-neon-purple'
                    : 'text-slate-400 hover:text-white hover:bg-surface'
                }`}
              >
                {rm === 'all'
                  ? t.filterAll
                  : lang === 'ar'
                  ? rm === 'PlayStation Arena'
                    ? 'صالة البلايستيشن 🎮'
                    : rm === 'Billiards Arena'
                    ? 'صالة البلياردو 🎱'
                    : rm === 'Ping Pong Bay'
                    ? 'منطقة البينج بونج 🏓'
                    : rm === 'VIP Cyber Suite'
                    ? 'غرفة VIP بلايستيشن ⭐'
                    : rm
                  : rm}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setManualModalOpen(true);
              setManualDeviceId(devices[0]?.id || 0);
              setManualDuration(60);
              setManualCustomDuration('');
              setManualHourlyRate('');
              setManualDrinks({});
              setManualCustomerName('');
              setManualCustomerPhone('');
              setManualDiscount('0');
              setManualPaymentMethod('cash');
              setManualError('');
            }}
            className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-neon-purple flex items-center gap-1.5 transition whitespace-nowrap"
            title="تسجيل جلسة سابقة كانت بالورقة عند انقطاع النت لإدخالها في إيراد الخزنة"
          >
            <History className="w-3.5 h-3.5 text-purple-200" />
            <span>+ إضافة جلسة سابقة (يدوية)</span>
          </button>
        </div>
      </div>

      {/* Devices Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
        {filteredDevices.map((device) => {
          const session = device.active_session;
          const remainingSec = countdowns[device.id] ?? (session?.remaining_seconds || 0);
          const isEndingSoon = !session?.is_open_ended && remainingSec > 0 && remainingSec <= 600;
          const isEnded = session && !session.is_open_ended && remainingSec <= 0;
          const liveSessionCost = session?.is_open_ended
            ? Math.round((remainingSec / 3600) * safeNum(device.hourly_rate) * 100) / 100
            : safeNum(session?.session_cost);
          const liveTotal = Math.max(0, liveSessionCost + safeNum(session?.beverage_cost) - safeNum(session?.discount));

          // Status colors
          let statusBorder = 'border-border/80';
          let statusGlow = '';
          let badgeBg = 'bg-surface text-slate-400 border-border';
          let badgeText = t.statusAvailable;

          if (device.status === 'maintenance') {
            statusBorder = 'border-amber-500/40';
            badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
            badgeText = t.statusMaintenance;
          } else if (session) {
            if (isEnded) {
              statusBorder = 'border-rose-500 animate-pulse';
              statusGlow = 'shadow-neon-rose';
              badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
              badgeText = 'Session Expired';
            } else if (isEndingSoon) {
              statusBorder = 'border-amber-500 animate-pulse';
              statusGlow = 'shadow-neon-amber';
              badgeBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
              badgeText = t.statusEndingSoon;
            } else {
              statusBorder = 'border-purple-500/60';
              statusGlow = 'shadow-neon-purple';
              badgeBg = 'bg-primary/20 text-primary-light border-primary/40';
              badgeText = t.statusActive;
            }
          }

          return (
            <div
              key={device.id}
              className={`relative bg-card/90 border ${statusBorder} ${statusGlow} rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-primary/80 group`}
            >
              {/* Card Header: Device Name & Type */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-surface border border-border text-primary-light">
                      {device.device_type === 'billiards' ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-400/60 flex items-center justify-center text-xs font-black text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.5)]">
                          8
                        </div>
                      ) : device.device_type === 'pingpong' ? (
                        <div className="w-5 h-5 rounded-full bg-rose-950 border border-rose-400/60 flex items-center justify-center text-xs font-black text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.5)]">
                          🏓
                        </div>
                      ) : device.device_type === 'pc' ? (
                        <Monitor className="w-5 h-5 text-cyan-400" />
                      ) : (
                        <Gamepad2 className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight group-hover:text-primary-light transition">
                        {lang === 'ar' && device.device_name_ar ? device.device_name_ar : device.device_name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {device.room_name}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeBg}`}>
                    {badgeText}
                  </span>
                </div>

                {/* Device Specs / Hourly Rate */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1 pb-3 border-b border-border/60">
                  <span className="truncate max-w-[160px]" title={device.specs || ''}>
                    {device.specs || 'Gaming Station'}
                  </span>
                  <span className="font-bold text-slate-200 font-mono">
                    {device.hourly_rate} {t.currency}/hr
                  </span>
                </div>

                {/* Active Session Info OR Available State */}
                {session ? (
                  <div className="py-3 space-y-2.5">
                    {/* Live Countdown Timer Banner */}
                    <div
                      className={`p-3 rounded-xl border text-center transition ${
                        isEnded
                          ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                          : isEndingSoon
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-surface border-border text-white'
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                        {session.is_open_ended ? 'Elapsed time / وقت التشغيل' : t.remainingTime}
                      </span>
                      <span className="font-mono text-2xl font-black tracking-widest block" dir="ltr">
                        {formatTime(remainingSec)}
                      </span>
                    </div>

                    {/* Customer & Bill Details */}
                    <div className="bg-surface/60 rounded-xl p-2.5 border border-border/60 text-xs space-y-1">
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-400">{t.gamerName}:</span>
                        <span className="font-semibold text-white">{session.customer_name}</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span className="text-slate-400">{t.sessionCost}:</span>
                        <span className="font-mono" dir="ltr">{formatMoney(liveSessionCost)} {t.currency}</span>
                      </div>
                      {safeNum(session.beverage_cost) > 0 && (
                        <div className="flex justify-between text-slate-300">
                          <span className="text-slate-400">{t.drinksCost}:</span>
                          <span className="font-mono text-amber-400" dir="ltr">+{formatMoney(session.beverage_cost)} {t.currency}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-white font-bold pt-1 border-t border-border/60">
                        <span>{t.totalDue}:</span>
                        <span className="font-mono text-emerald-400 text-sm" dir="ltr">{formatMoney(session.is_open_ended ? liveTotal : session.total_amount)} {t.currency}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-400">
                      Ready for next gamer
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border/80">
                {session ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => setExtendModalDevice(device)}
                      className="px-2 py-2 text-[11px] font-bold rounded-xl bg-surface border border-border hover:border-purple-500 hover:text-purple-300 transition text-slate-300 flex flex-col items-center justify-center gap-0.5"
                    >
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      <span>{t.extendTimeBtn}</span>
                    </button>
                    <button
                      onClick={() => setDrinkModalDevice(device)}
                      className="px-2 py-2 text-[11px] font-bold rounded-xl bg-surface border border-border hover:border-amber-500 hover:text-amber-300 transition text-slate-300 flex flex-col items-center justify-center gap-0.5"
                    >
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t.addDrinksBtn}</span>
                    </button>
                    <button
                      onClick={() => setEndModalDevice(device)}
                      className="px-2 py-2 text-[11px] font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition flex flex-col items-center justify-center gap-0.5 shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{t.endSessionBtn}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setStartModalDevice(device);
                      setStartDuration(60);
                      setStartCustomDuration('');
                      setOpenEnded(false);
                    }}
                    disabled={device.status === 'maintenance'}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-neon-purple transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.startSessionBtn}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- START SESSION MODAL --- */}
      {startModalDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Gamepad2 className="w-5 h-5 text-primary-light" />
                <h3 className="text-base font-bold text-white">
                  {t.startSessionBtn}: {startModalDevice.device_name}
                </h3>
              </div>
              <button
                onClick={() => setStartModalDevice(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartSubmit} className="p-6 space-y-4">
              {/* Duration Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  {t.selectDuration}
                </label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {[30, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setStartDuration(mins);
                        setStartCustomDuration('');
                        setOpenEnded(false);
                      }}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        !openEnded && startDuration === mins && !startCustomDuration
                          ? 'bg-primary text-white border-primary shadow-neon-purple'
                          : 'bg-surface text-slate-300 border-border hover:border-slate-500'
                      }`}
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                  <button type="button" onClick={() => { setOpenEnded(true); setStartCustomDuration(''); }} className={`py-2 rounded-xl text-xs font-bold border ${openEnded ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-surface text-slate-300 border-border'}`}>Open</button>
                </div>
                <input
                  type="number"
                  min="15"
                  max="720"
                  placeholder={t.customMinutes}
                  value={openEnded ? '' : startCustomDuration}
                  disabled={openEnded}
                  onChange={(e) => {
                    setOpenEnded(false);
                    setStartCustomDuration(e.target.value);
                  }}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Customer info */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.gamerName}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Sultan & Friends"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.gamerPhone}
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Price Calculation Preview */}
              <div className="p-3 rounded-xl bg-surface border border-border flex justify-between items-center text-xs">
                <span className="text-slate-400">Calculated Session Cost:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm" dir="ltr">
                  {openEnded ? 'Per minute until close' : `${formatMoney((getSelectedStartDuration() / 60) * startModalDevice.hourly_rate)} ${t.currency}`}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setStartModalDevice(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300 hover:bg-card"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-neon-purple transition disabled:opacity-50"
                >
                  {actionLoading ? 'Starting...' : t.confirmStart}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EXTEND TIME MODAL --- */}
      {extendModalDevice && extendModalDevice.active_session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {t.extendTimeBtn}: {extendModalDevice.device_name}
                </h3>
              </div>
              <button
                onClick={() => setExtendModalDevice(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExtendSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Additional Time
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[15, 30, 60, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setExtendMinutes(mins);
                        setExtendCustomMinutes('');
                      }}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        extendMinutes === mins && !extendCustomMinutes
                          ? 'bg-purple-600 text-white border-purple-500 shadow-neon-purple'
                          : 'bg-surface text-slate-300 border-border hover:border-slate-500'
                      }`}
                    >
                      +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  placeholder={t.customMinutes}
                  value={extendCustomMinutes}
                  onChange={(e) => setExtendCustomMinutes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Price Calculation Preview */}
              <div className="p-3 rounded-xl bg-surface border border-border flex justify-between items-center text-xs">
                <span className="text-slate-400">Additional Fee:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm" dir="ltr">
                  +
                  {formatMoney(
                    ((extendCustomMinutes ? parseInt(extendCustomMinutes) : extendMinutes) / 60) *
                    extendModalDevice.hourly_rate
                  )}{' '}
                  {t.currency}
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setExtendModalDevice(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300 hover:bg-card"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-neon-purple transition disabled:opacity-50"
                >
                  {actionLoading ? 'Extending...' : t.confirmExtend}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD BEVERAGE TO SESSION MODAL --- */}
      {drinkModalDevice && drinkModalDevice.active_session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  {t.addDrinksBtn}: {drinkModalDevice.device_name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setDrinkModalDevice(null);
                  setSelectedDrinks({});
                }}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Active Session Items */}
            {(() => {
              const currentItems = (drinkModalDevice.active_session.orders || []).flatMap((o: any) => o.items || []);
              if (currentItems.length === 0) return null;
              return (
                <div className="mx-6 mt-4 p-3 bg-surface/80 border border-border/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-amber-400" />
                      <span>الأصناف المسجلة بالجلسة حالياً:</span>
                    </h4>
                    <span className="text-xs font-mono font-bold text-amber-400" dir="ltr">
                      +{formatMoney(drinkModalDevice.active_session.beverage_cost)} {t.currency}
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-border/40">
                    {currentItems.map((it: any, idx: number) => (
                      <div key={it.id || idx} className="pt-1.5 flex items-center justify-between text-xs">
                        <div className="flex-1">
                          <span className="text-white font-bold">{it.quantity}x </span>
                          <span className="text-slate-200">{lang === 'ar' ? it.name_ar || it.product?.name_ar || it.name : it.name}</span>
                          <span className="text-[10px] text-slate-400 block">
                            {formatMoney(it.unit_price)} {t.currency} للواحد
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 font-bold" dir="ltr">
                            {formatMoney(it.subtotal)} {t.currency}
                          </span>
                          <div className="flex items-center gap-1 bg-card p-0.5 rounded-lg border border-border/80">
                            <button
                              type="button"
                              title="إنقاص الكمية"
                              disabled={updatingSessionItemId === it.id}
                              onClick={() => handleUpdateSessionItem(it.id, it.quantity - 1)}
                              className="w-5 h-5 rounded bg-surface hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 flex items-center justify-center transition disabled:opacity-40"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="w-4 text-center font-mono font-bold text-white text-xs">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              title="زيادة الكمية"
                              disabled={updatingSessionItemId === it.id}
                              onClick={() => handleUpdateSessionItem(it.id, it.quantity + 1)}
                              className="w-5 h-5 rounded bg-surface hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 flex items-center justify-center transition disabled:opacity-40"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              title="حذف الصنف وإرجاعه للمخزن"
                              disabled={updatingSessionItemId === it.id}
                              onClick={() => {
                                if (window.confirm(`هل أنت متأكد من حذف ${lang === 'ar' ? it.name_ar || it.product?.name_ar || it.name : it.name} وإرجاعه للمخزن؟`)) {
                                  handleUpdateSessionItem(it.id, 0);
                                }
                              }}
                              className="w-5 h-5 rounded bg-surface hover:bg-rose-600 text-rose-400 hover:text-white flex items-center justify-center transition disabled:opacity-40 ml-1"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Products Picker */}
            <div className="p-6 overflow-y-auto space-y-3">
              <p className="text-xs text-slate-400">
                إضافة أصناف ومشروبات جديدة إلى حساب الجلسة:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {products.map((p) => {
                  const qty = selectedDrinks[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition ${
                        qty > 0 ? 'bg-primary/10 border-primary' : 'bg-surface border-border'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs text-white leading-tight">{p.name}</p>
                        <p className="text-[10px] text-amber-400 font-mono font-bold mt-0.5" dir="ltr">
                          {formatMoney(p.price)} {t.currency}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {qty > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedDrinks((prev) => ({
                                ...prev,
                                [p.id]: Math.max(0, qty - 1),
                              }))
                            }
                            className="w-6 h-6 rounded-lg bg-card border border-border text-slate-300 font-bold flex items-center justify-center hover:bg-surface text-xs"
                          >
                            -
                          </button>
                        )}
                        {qty > 0 && <span className="font-mono text-xs font-bold text-white">{qty}</span>}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDrinks((prev) => ({
                              ...prev,
                              [p.id]: qty + 1,
                            }))
                          }
                          className="w-6 h-6 rounded-lg bg-primary hover:bg-primary-hover text-white font-bold flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-surface/80">
              <span className="text-xs text-slate-400">
                Total Drinks Selected:{' '}
                <strong className="text-white font-mono">
                  {Object.values(selectedDrinks).reduce((a, b) => a + b, 0)} items
                </strong>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDrinkModalDevice(null);
                    setSelectedDrinks({});
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300 hover:bg-card"
                >
                  {t.close}
                </button>
                <button
                  type="button"
                  onClick={handleDrinkSubmit}
                  disabled={actionLoading || Object.values(selectedDrinks).reduce((a, b) => a + b, 0) === 0}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-neon-amber transition disabled:opacity-50"
                >
                  {actionLoading ? 'Adding...' : 'Add to Station Tab'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- END SESSION & SETTLE PAYMENT MODAL --- */}
      {endModalDevice && endModalDevice.active_session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-rose-500" />
                <h3 className="text-base font-bold text-white">
                  {t.endSessionBtn}: {endModalDevice.device_name}
                </h3>
              </div>
              <button
                onClick={() => setEndModalDevice(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEndSubmit} className="p-6 space-y-4">
              {/* Itemized breakdown */}
              <div className="p-4 rounded-xl bg-surface border border-border space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">{t.gamerName}:</span>
                  <span className="font-bold text-white">{endModalDevice.active_session.customer_name}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">{t.sessionCost} ({endModalDevice.active_session.is_open_ended ? `${formatTime(countdowns[endModalDevice.id] || 0)} مفتوح` : `${endModalDevice.active_session.duration_minutes}m`}):</span>
                    <span className="font-mono" dir="ltr">{formatMoney(settlementSessionCost)} {t.currency}</span>
                </div>
                {safeNum(endModalDevice.active_session.beverage_cost) > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span className="text-slate-400">{t.drinksCost}:</span>
                    <span className="font-mono text-amber-400" dir="ltr">+{formatMoney(endModalDevice.active_session.beverage_cost)} {t.currency}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-slate-400">{t.discount}:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={endDiscount}
                    onChange={(e) => setEndDiscount(e.target.value)}
                    className="w-20 px-2 py-1 rounded-lg bg-card border border-border text-right text-xs font-mono font-bold text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="flex justify-between text-white font-bold pt-2 border-t border-border text-base">
                  <span>{t.totalDue}:</span>
                  <span className="font-mono text-emerald-400" dir="ltr">
                    {formatMoney(Math.max(
                      0,
                      settlementSessionCost +
                        safeNum(endModalDevice.active_session.beverage_cost) -
                        (parseFloat(endDiscount) || 0)
                    ))}{' '}
                    {t.currency}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cash', label: t.cash },
                    { id: 'visa', label: t.visa },
                    { id: 'wallet', label: t.wallet },
                    { id: 'instapay', label: t.instapay },
                    { id: 'credit', label: 'آجل' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setEndPaymentMethod(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        endPaymentMethod === m.id
                          ? 'bg-primary text-white border-primary shadow-neon-purple'
                          : 'bg-surface text-slate-300 border-border hover:border-slate-500'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {endPaymentMethod === 'credit' && (
                <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
                  <p className="text-xs font-bold text-amber-300">بيانات العميل الآجل مطلوبة</p>
                  <input value={endCustomerName} onChange={(e) => setEndCustomerName(e.target.value)} required placeholder="اسم العميل" className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-white text-sm" />
                  <input value={endCustomerPhone} onChange={(e) => setEndCustomerPhone(e.target.value)} required placeholder="رقم الهاتف" className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-white text-sm" />
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEndModalDevice(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300 hover:bg-card"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-neon-rose transition disabled:opacity-50"
                >
                  {actionLoading ? 'Settling...' : t.confirmEnd}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MANUAL / OFFLINE SESSION MODAL --- */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    إضافة جلسة سابقة / يدوية (أوفلاين)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    لتسجيل الجلسات المسجلة بالورقة عند انقطاع النت لإدخالها في الإيراد والخزنة فوراً
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManualModalOpen(false)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualSessionSubmit} className="p-6 overflow-y-auto space-y-4">
              {manualError && (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                  {manualError}
                </div>
              )}

              {/* Choose Device */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  اختر الجهاز / المحطة *
                </label>
                <select
                  value={manualDeviceId}
                  onChange={(e) => {
                    const devId = Number(e.target.value);
                    setManualDeviceId(devId);
                    const d = devices.find((x) => x.id === devId);
                    if (d) setManualHourlyRate(d.hourly_rate.toString());
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-primary"
                >
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {lang === 'ar' && d.device_name_ar ? d.device_name_ar : d.device_name} ({d.room_name}) - {d.hourly_rate} {t.currency}/ساعة
                    </option>
                  ))}
                </select>
              </div>

              {/* Customer Info (Optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    اسم العميل (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد محمد"
                    value={manualCustomerName}
                    onChange={(e) => setManualCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="010XXXXXXXX"
                    value={manualCustomerPhone}
                    onChange={(e) => setManualCustomerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Duration Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  مدة اللعب المسجلة بالورقة *
                </label>
                <div className="grid grid-cols-5 gap-1.5 mb-2">
                  {[30, 45, 60, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setManualDuration(mins);
                        setManualCustomDuration('');
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold transition border ${
                        !manualCustomDuration && manualDuration === mins
                          ? 'bg-purple-600 text-white border-purple-500 shadow-neon-purple'
                          : 'bg-surface text-slate-300 border-border hover:border-slate-500'
                      }`}
                    >
                      {mins < 60 ? `${mins} دقيقة` : `${mins / 60} ساعة`}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  placeholder="أو أدخل المدة بالدقائق مخصصة (مثال: 75 دقيقة)"
                  value={manualCustomDuration}
                  onChange={(e) => setManualCustomDuration(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Hourly rate adjustment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    سعر الساعة ({t.currency})
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={manualHourlyRate}
                    placeholder={(devices.find((d) => d.id === manualDeviceId)?.hourly_rate || 30).toString()}
                    onChange={(e) => setManualHourlyRate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    حساب الوقت المحسوب
                  </label>
                  <div className="px-3 py-1.5 rounded-xl bg-surface/50 border border-border text-emerald-400 font-mono font-bold text-xs">
                    {(() => {
                      const d = devices.find((x) => x.id === manualDeviceId);
                      const dur = manualCustomDuration ? parseInt(manualCustomDuration, 10) : manualDuration;
                      const rate = manualHourlyRate ? parseFloat(manualHourlyRate) : (d?.hourly_rate || 30);
                      const cost = Math.round(((dur / 60) * rate) * 100) / 100;
                      return `${formatMoney(cost)} ${t.currency}`;
                    })()}
                  </div>
                </div>
              </div>

              {/* Consumed Drinks / Snacks during session */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  مشروبات أو تسالي تم استهلاكها (اختياري)
                </label>
                <div className="max-h-36 overflow-y-auto grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-surface border border-border">
                  {products.map((p) => {
                    const qty = manualDrinks[p.id] || 0;
                    return (
                      <div
                        key={p.id}
                        className={`p-2 rounded-lg border flex items-center justify-between transition ${
                          qty > 0 ? 'bg-primary/10 border-primary' : 'bg-card border-border/60'
                        }`}
                      >
                        <div className="truncate max-w-[110px]">
                          <p className="font-bold text-[11px] text-white truncate">{p.name}</p>
                          <p className="text-[9px] text-amber-400 font-mono" dir="ltr">
                            {formatMoney(p.price)} {t.currency}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {qty > 0 && (
                            <button
                              type="button"
                              onClick={() => setManualDrinks((prev) => ({ ...prev, [p.id]: Math.max(0, qty - 1) }))}
                              className="w-5 h-5 rounded bg-surface text-slate-300 hover:text-white flex items-center justify-center text-xs"
                            >
                              -
                            </button>
                          )}
                          {qty > 0 && <span className="font-mono text-xs font-bold text-white px-1">{qty}</span>}
                          <button
                            type="button"
                            onClick={() => setManualDrinks((prev) => ({ ...prev, [p.id]: qty + 1 }))}
                            className="w-5 h-5 rounded bg-primary text-white flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discount & Payment Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    خصم (اختياري)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    طريقة الدفع *
                  </label>
                  <select
                    value={manualPaymentMethod}
                    onChange={(e) => setManualPaymentMethod(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="cash">كاش نقدية (يدخل في درج الخزنة)</option>
                    <option value="visa">فيزا / بطاقة</option>
                    <option value="instapay">إنستاباي / محفظة</option>
                    <option value="credit">آجل (تسجيل على حساب العميل)</option>
                  </select>
                </div>
              </div>

              {/* Total Calculation Preview */}
              {(() => {
                const d = devices.find((x) => x.id === manualDeviceId);
                const dur = manualCustomDuration ? parseInt(manualCustomDuration, 10) : manualDuration;
                const rate = manualHourlyRate ? parseFloat(manualHourlyRate) : (d?.hourly_rate || 30);
                const sessionCost = Math.round(((dur / 60) * rate) * 100) / 100;
                const beverageCost = Object.entries(manualDrinks).reduce((sum, [id, qty]) => {
                  const p = products.find((prod) => prod.id === Number(id));
                  return sum + (p ? p.price * qty : 0);
                }, 0);
                const disc = parseFloat(manualDiscount) || 0;
                const finalTotal = Math.max(0, sessionCost + beverageCost - disc);

                return (
                  <div className="p-3.5 rounded-xl bg-surface/90 border border-border space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>حساب الوقت ({dur} دقيقة):</span>
                      <span className="font-mono text-white" dir="ltr">{formatMoney(sessionCost)} {t.currency}</span>
                    </div>
                    {beverageCost > 0 && (
                      <div className="flex justify-between text-slate-400">
                        <span>المشاريب والضيافة:</span>
                        <span className="font-mono text-amber-400" dir="ltr">+{formatMoney(beverageCost)} {t.currency}</span>
                      </div>
                    )}
                    {disc > 0 && (
                      <div className="flex justify-between text-rose-400">
                        <span>الخصم:</span>
                        <span className="font-mono" dir="ltr">-{formatMoney(disc)} {t.currency}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-border flex justify-between items-center text-sm font-black text-white">
                      <span>الإجمالي المطلوب:</span>
                      <span className="font-mono text-emerald-400 text-base" dir="ltr">
                        {formatMoney(finalTotal)} {t.currency}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setManualModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300 hover:bg-card"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  disabled={manualLoading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-neon-purple transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>{manualLoading ? 'جاري التسجيل...' : 'حفظ وإدخال في الخزنة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
