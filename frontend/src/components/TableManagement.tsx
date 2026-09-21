import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Clock, 
  Gamepad2, 
  DollarSign, 
  ArrowRightLeft, 
  Coffee, 
  Plus,
  Receipt,
  Search,
  X,
  CreditCard
} from 'lucide-react';
import { Device, Product, Table, ThermalReceipt } from '../types';
import { Language, translations } from '../i18n/translations';
import { sounds } from '../utils/audio';
import { formatMoney } from '../utils/format';
import { api } from '../services/api';

interface TableManagementProps {
  lang: Language;
  tables: Table[];
  devices: Device[];
  products: Product[];
  onOccupyTable: (tableId: number) => Promise<void>;
  onMoveTableToGaming: (tableId: number, deviceSessionId: number) => Promise<void>;
  onCheckoutTable: (tableId: number, data: { payment_method: string; discount?: number; amount_paid?: number; customer_name?: string; customer_phone?: string }) => Promise<void>;
  onAddItemsToTable: (tableId: number, items: { product_id: number; quantity: number }[]) => Promise<void>;
  onShowReceipt?: (receipt: ThermalReceipt) => void;
  onRefresh: () => void;
}

export const TableManagement: React.FC<TableManagementProps> = ({
  lang,
  tables,
  devices,
  products,
  onOccupyTable,
  onMoveTableToGaming,
  onCheckoutTable,
  onAddItemsToTable,
  onShowReceipt,
  onRefresh,
}) => {
  const t = translations[lang];

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [moveModalTable, setMoveModalTable] = useState<Table | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<Record<number, number>>({});
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  // Drink/Item tab modal
  const [drinkModalTable, setDrinkModalTable] = useState<Table | null>(null);
  const [selectedDrinks, setSelectedDrinks] = useState<{ [productId: number]: number }>({});
  const [drinkSearch, setDrinkSearch] = useState('');
  const [drinkCategory, setDrinkCategory] = useState('all');

  // Checkout table modal
  const [checkoutModalTable, setCheckoutModalTable] = useState<Table | null>(null);
  const [checkoutMethod, setCheckoutMethod] = useState<string>('cash');
  const [checkoutDiscount, setCheckoutDiscount] = useState<string>('0');
  const [checkoutCustomerName, setCheckoutCustomerName] = useState<string>('');
  const [checkoutCustomerPhone, setCheckoutCustomerPhone] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string>('');

  useEffect(() => {
    const sync = () => setElapsedSeconds(Object.fromEntries(tables.filter(t => t.status === 'occupied').map(t => [t.id, t.elapsed_seconds ?? (t.elapsed_minutes ?? 0) * 60])));
    sync();
    const timer = window.setInterval(() => setElapsedSeconds(prev => Object.fromEntries(Object.entries(prev).map(([id, seconds]) => [id, seconds + 1]))), 1000);
    return () => window.clearInterval(timer);
  }, [tables]);

  const formatElapsed = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const h = Math.floor(safe / 3600).toString().padStart(2, '0');
    const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
    const s = (safe % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const activeStations = devices.filter((d) => d.active_session);
  const occupiedCount = tables.filter((table) => table.status === 'occupied').length;
  const availableCount = tables.length - occupiedCount;

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModalTable || !targetSessionId) return;
    setLoading(true);
    try {
      await onMoveTableToGaming(moveModalTable.id, targetSessionId);
      sounds.playWarning10Min();
      setMoveModalTable(null);
      setSelectedTable(null);
      setTargetSessionId(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleAddDrinksSubmit = async () => {
    if (!drinkModalTable) return;
    const itemsToAdd = Object.entries(selectedDrinks)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ product_id: Number(id), quantity: qty }));

    if (itemsToAdd.length === 0) return;

    setLoading(true);
    try {
      await onAddItemsToTable(drinkModalTable.id, itemsToAdd);
      sounds.playCashRegister();
      setSelectedDrinks({});
      setDrinkModalTable(null);
      setSelectedTable(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutModalTable) return;

    if (checkoutMethod === 'credit' && (!checkoutCustomerName.trim() || !checkoutCustomerPhone.trim())) {
      setCheckoutError('اكتب اسم العميل ورقم الهاتف لتسجيل الحساب الآجل');
      return;
    }

    setLoading(true);
    setCheckoutError('');
    try {
      await onCheckoutTable(checkoutModalTable.id, {
        payment_method: checkoutMethod,
        discount: Number(checkoutDiscount) || 0,
        customer_name: checkoutMethod === 'credit' ? checkoutCustomerName.trim() : undefined,
        customer_phone: checkoutMethod === 'credit' ? checkoutCustomerPhone.trim() : undefined,
      });
      sounds.playCashRegister();
      setCheckoutModalTable(null);
      setSelectedTable(null);
      setCheckoutDiscount('0');
      setCheckoutCustomerName('');
      setCheckoutCustomerPhone('');
      onRefresh();
    } catch (err: any) {
      setCheckoutError(err?.message || 'تعذر تسوية حساب الطاولة');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTableName.trim()) return;
    await api.createTable({ table_number: newTableName.trim(), capacity: Number(newTableCapacity) || 4 });
    setNewTableName('');
    onRefresh();
  };

  const handleDeleteTable = async (table: Table) => {
    if (table.status === 'occupied') return;
    if (!window.confirm(`حذف الطاولة ${table.table_number}؟`)) return;
    await api.deleteTable(table.id);
    onRefresh();
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = drinkCategory === 'all' || p.category === drinkCategory;
    const matchesSearch = !drinkSearch.trim() || 
      p.name.toLowerCase().includes(drinkSearch.toLowerCase()) || 
      (p.name_ar && p.name_ar.includes(drinkSearch.trim()));
    return matchesCategory && matchesSearch;
  });

  const totalDrinkModalPrice = Object.entries(selectedDrinks).reduce((sum, [id, qty]) => {
    const p = products.find((prod) => prod.id === Number(id));
    return sum + (p ? p.price * qty : 0);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-border bg-surface/70 p-5 lg:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-amber-400" />
              <span>إدارة الطاولات وحسابات الصالة (Table Tabs)</span>
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              افتحي حساب الطاولة، أضيفي المشاريب والطلبات في أي وقت، وحاسبي عند المغادرة دفعة واحدة بجميع وسائل الدفع.
            </p>
          </div>
          <div className="flex gap-2 text-center">
            <div className="rounded-xl bg-card border border-border px-4 py-2">
              <b className="block text-xl text-white">{tables.length}</b>
              <span className="text-[11px] text-slate-400">إجمالي الطاولات</span>
            </div>
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-2">
              <b className="block text-xl text-emerald-300">{availableCount}</b>
              <span className="text-[11px] text-slate-400">متاحة</span>
            </div>
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2">
              <b className="block text-xl text-amber-300">{occupiedCount}</b>
              <span className="text-[11px] text-slate-400">مشغولة</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateTable} className="rounded-xl bg-card border border-border p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم الطاولة الجديدة</label>
            <input 
              value={newTableName} 
              onChange={e => setNewTableName(e.target.value)} 
              placeholder="مثال: طاولة VIP 1 أو T-05" 
              className="w-full rounded-lg bg-surface border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">عدد الأشخاص</label>
            <input 
              value={newTableCapacity} 
              onChange={e => setNewTableCapacity(e.target.value)} 
              type="number" 
              min="1" 
              max="50" 
              className="w-full sm:w-28 rounded-lg bg-surface border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500" 
            />
          </div>
          <button className="rounded-lg bg-amber-600 hover:bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition">
            + إضافة طاولة
          </button>
        </form>
      </div>

      {/* Tables Grid */}
      {tables.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-border bg-card/40 p-10 text-center">
          <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">لا توجد طاولات مضافة</h3>
          <p className="text-sm text-slate-400 mt-2">استخدمي نموذج «إضافة طاولة» بالأعلى لإضافة طاولات الصالة.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
        {tables.map((table) => {
          const isOccupied = table.status === 'occupied';

          return (
            <div
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group hover:border-amber-500 hover:shadow-neon-amber ${
                isOccupied
                  ? 'bg-card border-amber-500/60 shadow-neon-amber'
                  : 'bg-card/70 border-border/80 hover:bg-card'
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>تسع {table.capacity} أشخاص</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isOccupied
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {isOccupied ? t.tableOccupied : t.tableAvailable}
                  </span>
                </div>

                {/* Table Number & Timer */}
                <div className="text-center py-2">
                  <span className="text-2xl lg:text-3xl font-black text-white group-hover:text-amber-300 transition">
                    {table.table_number}
                  </span>
                  {isOccupied && (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-mono text-amber-300 font-bold">{formatElapsed(elapsedSeconds[table.id] ?? 0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions & Info */}
              <div className="pt-3 border-t border-border/60 mt-3 space-y-2">
                {isOccupied ? (
                  <>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">
                        {table.order?.items_count ?? (table.order?.items?.length ?? 0)} أصناف
                      </span>
                      <span className="font-bold text-amber-400 font-mono text-sm" dir="ltr">
                        {formatMoney(table.total_spent)} {t.currency}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          setDrinkModalTable(table);
                          setSelectedDrinks({});
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-amber-600/30 hover:bg-amber-600 border border-amber-500/50 text-white font-bold text-xs flex items-center justify-center gap-1 transition"
                      >
                        <Coffee className="w-3.5 h-3.5 text-amber-300" />
                        <span>+ مشاريب</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutModalTable(table);
                          setCheckoutDiscount('0');
                        }}
                        className="flex-1 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/50 text-white font-bold text-xs flex items-center justify-center gap-1 transition"
                      >
                        <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
                        <span>تحصيل</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-emerald-300 font-semibold">اضغطي لفتح الحساب</span>
                    <button 
                      type="button" 
                      onClick={(event) => { event.stopPropagation(); handleDeleteTable(table); }} 
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- TABLE DETAILS MODAL --- */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  طاولة: {selectedTable.table_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-border">
                <span className="text-slate-400">السعة:</span>
                <span className="font-bold text-white">{selectedTable.capacity} أشخاص</span>
                <span className="text-slate-400">الحالة:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedTable.status === 'occupied'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {selectedTable.status === 'occupied' ? 'مشغولة' : 'متاحة'}
                </span>
                {selectedTable.status === 'occupied' && (
                  <div className="flex items-center gap-1 text-xs text-amber-300 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatElapsed(elapsedSeconds[selectedTable.id] ?? 0)}</span>
                  </div>
                )}
              </div>

              {selectedTable.status === 'occupied' ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      قائمة الطلبات المفتوحة على الطاولة
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setDrinkModalTable(selectedTable);
                        setSelectedDrinks({});
                      }}
                      className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مشاريب / طلبات</span>
                    </button>
                  </div>

                  {/* Items list */}
                  <div className="max-h-48 overflow-y-auto space-y-2 divide-y divide-border/40 p-3 rounded-xl bg-surface/60 border border-border">
                    {selectedTable.order?.items && selectedTable.order.items.length > 0 ? (
                      selectedTable.order.items.map((it: any, idx: number) => (
                        <div key={idx} className="pt-2 flex justify-between items-center text-xs">
                          <div>
                            <span className="text-white font-bold">{it.quantity}x </span>
                            <span className="text-slate-200">{lang === 'ar' ? it.name_ar || it.name : it.name}</span>
                          </div>
                          <span className="font-mono text-amber-400 font-bold" dir="ltr">
                            {formatMoney(it.subtotal)} {t.currency}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 text-center py-4">
                        لا توجد طلبات مسجلة على الطاولة بعد. اضغطي «إضافة مشاريب» بالأعلى لإضافة طلبات.
                      </p>
                    )}
                  </div>

                  {/* Total and Checkout summary */}
                  <div className="pt-3 border-t border-border flex justify-between items-center text-base font-black text-white">
                    <span>إجمالي الحساب:</span>
                    <span className="font-mono text-emerald-400 text-xl" dir="ltr">
                      {formatMoney(selectedTable.total_spent)} {t.currency}
                    </span>
                  </div>

                  {/* Actions buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={() => {
                        setMoveModalTable(selectedTable);
                      }}
                      className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-neon-purple transition flex items-center justify-center gap-2"
                    >
                      <Gamepad2 className="w-4 h-4" />
                      <span>{t.moveToGaming}</span>
                    </button>
                    <button
                      onClick={() => {
                        setCheckoutModalTable(selectedTable);
                        setCheckoutDiscount('0');
                      }}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-neon-green transition flex items-center justify-center gap-2"
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>تحصيل الحساب وإغلاق</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-xs text-slate-400">
                    الطاولة متاحة حاليًا — هل ترغبين في فتح حساب الطاولة؟
                  </p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={async () => {
                        await onOccupyTable(selectedTable.id);
                        setSelectedTable(null);
                        onRefresh();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-neon-amber transition"
                    >
                      فتح حساب الطاولة
                    </button>
                    <button
                      onClick={async () => {
                        await onOccupyTable(selectedTable.id);
                        setDrinkModalTable(selectedTable);
                        setSelectedDrinks({});
                        setSelectedTable(null);
                        onRefresh();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-neon-purple transition flex items-center gap-1.5"
                    >
                      <Coffee className="w-4 h-4" />
                      <span>فتح وإضافة مشاريب فوراً</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD DRINKS / ITEMS MODAL --- */}
      {drinkModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  إضافة طلبات لحساب طاولة: {drinkModalTable.table_number}
                </h3>
              </div>
              <button
                onClick={() => {
                  setDrinkModalTable(null);
                  setSelectedDrinks({});
                }}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search */}
            <div className="p-4 border-b border-border space-y-3 bg-surface/40">
              <div className="relative">
                <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
                <input
                  type="text"
                  value={drinkSearch}
                  onChange={(e) => setDrinkSearch(e.target.value)}
                  placeholder="ابحث عن مشروب أو صنف..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'hot_drinks', label: 'مشروبات ساخنة' },
                  { id: 'cold_drinks', label: 'مشروبات باردة' },
                  { id: 'snacks', label: 'تسالي ومقرمشات' },
                  { id: 'food', label: 'مأكولات سريعة' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setDrinkCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap border ${
                      drinkCategory === cat.id
                        ? 'bg-amber-600 text-white border-amber-500'
                        : 'bg-card text-slate-300 border-border hover:bg-surface'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Product items picker */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredProducts.map((p) => {
                  const qty = selectedDrinks[p.id] || 0;
                  return (
                    <div
                      key={p.id}
                      className={`p-3 rounded-xl border flex items-center justify-between transition ${
                        qty > 0 ? 'bg-amber-500/10 border-amber-500/60' : 'bg-surface border-border'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-xs text-white leading-tight">{lang === 'ar' ? p.name_ar || p.name : p.name}</p>
                        <p className="text-[11px] text-amber-400 font-mono font-bold mt-0.5" dir="ltr">
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
                            className="w-7 h-7 rounded-lg bg-card border border-border text-slate-300 font-bold flex items-center justify-center hover:bg-surface text-sm"
                          >
                            -
                          </button>
                        )}
                        {qty > 0 && <span className="font-mono text-sm font-bold text-white min-w-[16px] text-center">{qty}</span>}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDrinks((prev) => ({
                              ...prev,
                              [p.id]: qty + 1,
                            }))
                          }
                          className="w-7 h-7 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center justify-center text-sm shadow-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer with total and submit */}
            <div className="p-4 border-t border-border bg-surface/80 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 block">إجمالي الإضافة:</span>
                <span className="font-mono text-lg font-black text-amber-400" dir="ltr">
                  {formatMoney(totalDrinkModalPrice)} {t.currency}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrinkModalTable(null);
                    setSelectedDrinks({});
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={loading || totalDrinkModalPrice <= 0}
                  onClick={handleAddDrinksSubmit}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-neon-amber transition disabled:opacity-50"
                >
                  {loading ? 'جاري الإضافة...' : 'تأكيد الإضافة لحساب الطاولة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CHECKOUT TABLE MODAL --- */}
      {checkoutModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  تحصيل حساب طاولة: {checkoutModalTable.table_number}
                </h3>
              </div>
              <button
                onClick={() => setCheckoutModalTable(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCheckoutSubmit} className="p-6 space-y-4">
              {checkoutError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {checkoutError}
                </div>
              )}

              {/* Subtotal and Discount */}
              <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>إجمالي الطلبات:</span>
                  <span className="font-mono font-bold text-white" dir="ltr">
                    {formatMoney(checkoutModalTable.total_spent)} {t.currency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <label htmlFor="chk-discount">خصم (ج.م):</label>
                  <input
                    id="chk-discount"
                    type="number"
                    min="0"
                    step="0.5"
                    value={checkoutDiscount}
                    onChange={(e) => setCheckoutDiscount(e.target.value)}
                    className="w-24 px-2 py-1 rounded bg-card border border-border text-center text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="pt-2 border-t border-border flex justify-between items-center text-sm font-black text-white">
                  <span>المبلغ المطلوب سداده:</span>
                  <span className="font-mono text-emerald-400 text-lg" dir="ltr">
                    {formatMoney(Math.max(0, checkoutModalTable.total_spent - (Number(checkoutDiscount) || 0)))} {t.currency}
                  </span>
                </div>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  طريقة الدفع
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'نقدي (Cash)' },
                    { id: 'visa', label: 'فيزا (Visa)' },
                    { id: 'wallet', label: 'محفظة' },
                    { id: 'instapay', label: 'InstaPay' },
                    { id: 'credit', label: 'آجل (دين)' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCheckoutMethod(m.id)}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        checkoutMethod === m.id
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-neon-green'
                          : 'bg-surface text-slate-300 border-border hover:border-slate-500'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* If Credit selected */}
              {checkoutMethod === 'credit' && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold">
                    <CreditCard className="w-4 h-4" />
                    <span>تسجيل الحساب كدين آجل على العميل:</span>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">اسم العميل:</label>
                    <input
                      required
                      type="text"
                      value={checkoutCustomerName}
                      onChange={(e) => setCheckoutCustomerName(e.target.value)}
                      placeholder="اسم العميل"
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">رقم الهاتف:</label>
                    <input
                      required
                      type="text"
                      value={checkoutCustomerPhone}
                      onChange={(e) => setCheckoutCustomerPhone(e.target.value)}
                      placeholder="01xxxxxxxxx"
                      className="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setCheckoutModalTable(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-neon-green transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{loading ? 'جاري التحصيل...' : 'تأكيد السداد وطباعة الفاتورة'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MOVE TO GAMING STATION MODAL --- */}
      {moveModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {t.moveToGaming} (طاولة {moveModalTable.table_number})
                </h3>
              </div>
              <button
                onClick={() => setMoveModalTable(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMoveSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                {t.transferBillNotice}
              </p>

              <div className="p-3 rounded-xl bg-surface border border-border text-xs flex justify-between items-center">
                <span className="text-slate-400">حساب الطاولة الحالي:</span>
                <span className="font-mono font-bold text-amber-400 text-sm" dir="ltr">
                  {formatMoney(moveModalTable.total_spent)} {t.currency}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.selectDestinationSession}
                </label>
                {activeStations.length === 0 ? (
                  <p className="text-xs text-rose-400 py-2">
                    لا توجد جلسات ألعاب نشطة حالياً. شغلي جلسة ألعاب أولاً لنقل الحساب إليها.
                  </p>
                ) : (
                  <select
                    required
                    value={targetSessionId || ''}
                    onChange={(e) => setTargetSessionId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- اختاري الجهاز / اللاعب --</option>
                    {activeStations.map((st) => (
                      <option key={st.active_session!.id} value={st.active_session!.id}>
                        {st.device_name} ({st.active_session!.customer_name}) - الحساب الحالي: {formatMoney(st.active_session?.total_amount)} {t.currency}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setMoveModalTable(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  disabled={loading || !targetSessionId}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-neon-purple transition disabled:opacity-50"
                >
                  {loading ? 'جاري النقل...' : 'نقل الحساب وتحرير الطاولة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
