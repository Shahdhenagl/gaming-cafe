import React, { useState } from 'react';
import { 
  Coffee, 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  DollarSign, 
  Printer, 
  Gamepad2, 
  Users, 
  Package, 
  Flame, 
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { Device, Order, OrderType, PaymentMethod, Product, Table, ThermalReceipt } from '../types';
import { Language, translations } from '../i18n/translations';
import { sounds } from '../utils/audio';
import { formatMoney } from '../utils/format';

interface PosBarProps {
  lang: Language;
  products: Product[];
  tables: Table[];
  devices: Device[];
  onCheckout: (data: {
    order_type: OrderType;
    table_id?: number | null;
    device_session_id?: number | null;
    items: { product_id: number; quantity: number; notes?: string }[];
    discount?: number;
    tax?: number;
    payment_method?: PaymentMethod;
    payment_status?: string;
    notes?: string;
  }) => Promise<{ order: Order; receipt?: ThermalReceipt }>;
  onShowReceipt: (receipt: ThermalReceipt) => void;
}

export const PosBar: React.FC<PosBarProps> = ({
  lang,
  products,
  tables,
  devices,
  onCheckout,
  onShowReceipt,
}) => {
  const t = translations[lang];

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Cart
  const [cart, setCart] = useState<{ [productId: number]: number }>({});
  const [orderType, setOrderType] = useState<OrderType>('take_away');
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedDeviceSessionId, setSelectedDeviceSessionId] = useState<number | null>(null);
  const [discount, setDiscount] = useState<string>('0');
  const [orderNotes, setOrderNotes] = useState<string>('');

  // Checkout modal
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Categories list
  const categories = [
    { id: 'all', label: t.all, icon: Sparkles },
    { id: 'hot_drinks', label: t.categoryHot, icon: Coffee },
    { id: 'cold_drinks', label: t.categoryCold, icon: Flame },
    { id: 'soft_drinks', label: t.categorySoft, icon: Package },
    { id: 'snacks', label: t.categorySnacks, icon: Flame },
    { id: 'food', label: t.categoryFood, icon: Coffee },
  ];

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesQuery =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_ar.includes(searchQuery);
    return matchesCat && matchesQuery;
  });

  // Active gaming sessions for destination picker
  const activeSessions = devices
    .filter((d) => d.active_session)
    .map((d) => ({
      session_id: d.active_session!.id,
      label: `${d.device_name} (${d.active_session!.customer_name})`,
    }));

  // Available tables for dine-in
  const availableTables = tables.filter((tb) => tb.status === 'available');

  // Cart calculations
  const cartItems = Object.entries(cart)
    .filter(([_, qty]) => qty > 0)
    .map(([productId, qty]) => {
      const prod = products.find((p) => p.id === parseInt(productId))!;
      return {
        product: prod,
        quantity: qty,
        subtotal: prod.price * qty,
      };
    });

  const subtotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
  const discountVal = parseFloat(discount) || 0;
  const taxVal = 0; // included in pricing
  const total = Math.max(0, subtotal - discountVal + taxVal);

  const tenderedVal = parseFloat(cashTendered) || total;
  const changeDue = Math.max(0, tenderedVal - total);

  // Cart helpers
  const addToCart = (productId: number) => {
    setCart((prev) => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1,
    }));
  };

  const updateCartQty = (productId: number, delta: number) => {
    setCart((prev) => {
      const cur = prev[productId] || 0;
      const next = cur + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  };

  const clearCart = () => {
    setCart({});
    setDiscount('0');
    setOrderNotes('');
  };

  const handleOpenCheckout = () => {
    if (cartItems.length === 0) return;
    setCashTendered(total.toString());
    setShowCheckoutModal(true);
  };

  const handleCompleteOrder = async () => {
    setLoading(true);
    try {
      const res = await onCheckout({
        order_type: orderType,
        table_id: orderType === 'dine_in' ? selectedTableId : null,
        device_session_id: orderType === 'gaming_room' ? selectedDeviceSessionId : null,
        items: cartItems.map((ci) => ({
          product_id: ci.product.id,
          quantity: ci.quantity,
        })),
        discount: discountVal,
        tax: taxVal,
        payment_method: paymentMethod,
        payment_status: orderType === 'take_away' ? 'paid' : 'paid',
        notes: orderNotes.trim() || undefined,
      });

      sounds.playCashRegister();
      setShowCheckoutModal(false);
      clearCart();

      // Show receipt modal
      if (res && res.receipt) {
        onShowReceipt(res.receipt);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* LEFT: Product Catalog & Categories (8 Columns) */}
      <div className="xl:col-span-8 space-y-5">
        {/* Top Bar: Search & Category Pills */}
        <div className="bg-surface/60 border border-border/80 p-4 lg:p-5 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <Coffee className="w-6 h-6 text-amber-400" />
                <span>{t.posTitle}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.posSubtitle}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.search}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${
                    selectedCategory === cat.id
                      ? 'bg-amber-600 text-white border-amber-500 shadow-neon-amber'
                      : 'bg-card text-slate-300 border-border hover:bg-surface hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredProducts.map((product) => {
            const isLow = product.stock_quantity <= product.reorder_level;
            const isOut = product.stock_quantity <= 0;
            const inCartQty = cart[product.id] || 0;

            return (
              <button
                key={product.id}
                disabled={isOut}
                onClick={() => addToCart(product.id)}
                className={`relative p-4 rounded-2xl bg-card/90 border text-left flex flex-col justify-between transition group hover:border-amber-500 hover:shadow-neon-amber disabled:opacity-40 disabled:pointer-events-none ${
                  inCartQty > 0 ? 'border-amber-500/80 ring-1 ring-amber-500/50' : 'border-border/80'
                }`}
              >
                {/* Stock badge */}
                <div className="flex items-start justify-between w-full mb-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      isOut
                        ? 'bg-rose-500/20 text-rose-300'
                        : isLow
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-surface text-slate-400'
                    }`}
                  >
                    {isOut ? t.outOfStock : isLow ? t.lowStock : `${product.stock_quantity} left`}
                  </span>

                  {inCartQty > 0 && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center font-mono">
                      {inCartQty}
                    </span>
                  )}
                </div>

                {/* Product Name */}
                <div className="my-1">
                  <h4 className="font-bold text-xs md:text-sm text-white group-hover:text-amber-300 transition line-clamp-1">
                    {lang === 'ar' ? product.name_ar : product.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 line-clamp-1">
                    {lang === 'ar' ? product.name : product.name_ar}
                  </p>
                </div>

                {/* Price */}
                <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between w-full">
                  <span className="font-bold text-amber-400 font-mono text-xs md:text-sm" dir="ltr">
                    {formatMoney(product.price)} {t.currency}
                  </span>
                  <div className="p-1 rounded-lg bg-surface group-hover:bg-amber-500 group-hover:text-black transition text-slate-300">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Order Cart (4 Columns) */}
      <div className="xl:col-span-4 bg-card border border-border/90 rounded-2xl shadow-xl p-5 sticky top-20">
        {/* Cart Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">
              {t.cartTitle}
            </h3>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearCart}</span>
            </button>
          )}
        </div>

        {/* Order Destination Selector */}
        <div className="mb-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            {t.orderType}
          </label>
          <div className="grid grid-cols-3 gap-1.5 mb-2.5">
            <button
              type="button"
              onClick={() => setOrderType('take_away')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold transition border text-center ${
                orderType === 'take_away'
                  ? 'bg-primary text-white border-primary shadow-neon-purple'
                  : 'bg-surface text-slate-400 border-border hover:text-white'
              }`}
            >
              {t.typeTakeaway}
            </button>
            <button
              type="button"
              onClick={() => setOrderType('dine_in')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold transition border text-center ${
                orderType === 'dine_in'
                  ? 'bg-amber-600 text-white border-amber-500 shadow-neon-amber'
                  : 'bg-surface text-slate-400 border-border hover:text-white'
              }`}
            >
              {t.typeDineIn}
            </button>
            <button
              type="button"
              onClick={() => setOrderType('gaming_room')}
              className={`py-2 px-1 rounded-xl text-[11px] font-bold transition border text-center ${
                orderType === 'gaming_room'
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-neon-cyan'
                  : 'bg-surface text-slate-400 border-border hover:text-white'
              }`}
            >
              {t.typeGamingRoom}
            </button>
          </div>

          {/* Conditional Dropdowns */}
          {orderType === 'dine_in' && (
            <select
              value={selectedTableId || ''}
              onChange={(e) => setSelectedTableId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="">-- {t.selectTable} --</option>
              {availableTables.map((tb) => (
                <option key={tb.id} value={tb.id}>
                  {tb.table_number} ({tb.capacity} {t.guests})
                </option>
              ))}
            </select>
          )}

          {orderType === 'gaming_room' && (
            <select
              value={selectedDeviceSessionId || ''}
              onChange={(e) => setSelectedDeviceSessionId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- {t.selectDevice} --</option>
              {activeSessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Cart Items List */}
        <div className="max-h-60 overflow-y-auto divide-y divide-border/60 pr-1 space-y-1 mb-4">
          {cartItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-50" />
              <p>{t.emptyCart}</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div key={item.product.id} className="pt-2 pb-1 flex items-center justify-between">
                <div className="flex-1 pr-2">
                  <p className="font-bold text-xs text-white leading-tight">
                    {lang === 'ar' ? item.product.name_ar : item.product.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono" dir="ltr">
                    {formatMoney(item.product.price)} {t.currency}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateCartQty(item.product.id, -1)}
                    className="w-5 h-5 rounded-md bg-surface border border-border hover:border-rose-500 flex items-center justify-center text-slate-300 text-xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono text-xs font-bold text-white w-4 text-center" dir="ltr">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(item.product.id, 1)}
                    className="w-5 h-5 rounded-md bg-surface border border-border hover:border-amber-500 flex items-center justify-center text-slate-300 text-xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <span className="font-mono font-bold text-xs text-amber-400 w-16 text-right" dir="ltr">
                    {formatMoney(item.subtotal)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation Summary */}
        <div className="pt-3 border-t border-border space-y-1.5 text-xs text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">{t.subtotal}:</span>
            <span className="font-mono" dir="ltr">{formatMoney(subtotal)} {t.currency}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400">{t.discount}:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-16 px-2 py-0.5 rounded bg-surface border border-border text-right text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
              <span className="text-slate-400">{t.currency}</span>
            </div>
          </div>

          <div className="flex justify-between text-base font-black text-white pt-2 border-t border-border">
            <span>{t.total}:</span>
            <span className="font-mono text-emerald-400 text-lg" dir="ltr">
              {formatMoney(total)} {t.currency}
            </span>
          </div>
        </div>

        {/* Checkout Button */}
        <button
          onClick={handleOpenCheckout}
          disabled={cartItems.length === 0}
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-sm shadow-neon-amber transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
        >
          <DollarSign className="w-4 h-4" />
          <span>{t.checkout}</span>
        </button>
      </div>

      {/* --- PAYMENT & CHECKOUT MODAL --- */}
      {showCheckoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  {t.checkout}: <span dir="ltr">{formatMoney(total)}</span> {t.currency}
                </h3>
              </div>
              <button
                onClick={() => setShowCheckoutModal(false)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Payment Methods */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.paymentMethod}
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: t.cash },
                    { id: 'visa', label: t.visa },
                    { id: 'wallet', label: t.wallet },
                    { id: 'instapay', label: t.instapay },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        paymentMethod === m.id
                          ? 'bg-amber-600 text-white border-amber-500 shadow-neon-amber'
                          : 'bg-surface text-slate-300 border-border hover:border-slate-500'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">المبلغ المطلوب تحصيله / Amount to collect</span>
                <strong className="text-2xl font-mono text-emerald-300" dir="ltr">{formatMoney(total)} {t.currency}</strong>
              </div>

              {/* Cash Quick Tenders */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-semibold text-slate-300">
                      {t.cashTendered} ({t.currency})
                    </label>
                    <span className="text-xs font-mono font-bold text-emerald-400" dir="ltr">
                      {t.changeDue}: {formatMoney(changeDue)} {t.currency}
                    </span>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-base font-mono font-bold focus:outline-none focus:border-amber-500"
                  />

                  {/* Preset Cash Bills */}
                  <div className="flex gap-2">
                    {[total, 50, 100, 200].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setCashTendered(preset.toString())}
                        className="flex-1 py-1.5 rounded-lg bg-surface border border-border hover:border-amber-500 text-xs font-mono text-slate-300"
                      >
                        {preset === total ? 'Exact' : `${preset}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Order Special Notes (Optional)
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="e.g. Extra oat milk, no sugar"
                  className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300 hover:bg-card"
                >
                  {t.close}
                </button>
                <button
                  type="button"
                  onClick={handleCompleteOrder}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-neon-amber transition disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>{loading ? 'Processing...' : t.completeOrder}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
