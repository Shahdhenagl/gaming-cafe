import React, { useState, useEffect } from 'react';
import { 
  Package, 
  AlertTriangle, 
  Plus, 
  Search, 
  History, 
  CheckCircle2, 
  ArrowUpRight, 
  ArrowDownRight,
  Sparkles
} from 'lucide-react';
import { Product } from '../types';
import { Language, translations } from '../i18n/translations';
import { api } from '../services/api';
import { formatMoney } from '../utils/format';

interface InventoryViewProps {
  lang: Language;
  products: Product[];
  onRefreshProducts: () => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  lang,
  products,
  onRefreshProducts,
}) => {
  const t = translations[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('10');
  const [purchaseTotal, setPurchaseTotal] = useState('');
  const [purchaseMethod, setPurchaseMethod] = useState('cash');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.getInventoryReport();
      setLogs(res.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleQuickRestock = async () => {
    if (!restockProduct || Number(restockQty) <= 0) return;
    if (!window.confirm(`تأكيد إضافة ${restockQty} قطعة وتسجيل قيمة الشراء كمصروف؟`)) return;
    setLoadingAction(restockProduct.id);
    try {
      await api.updateStock(restockProduct.id, {
        quantity_change: Number(restockQty),
        reason: 'restock',
        purchase_total: Number(purchaseTotal || 0),
        purchase_payment_method: purchaseMethod,
      });
      onRefreshProducts();
      fetchLogs();
      setRestockProduct(null);
      setPurchaseTotal('');
    } finally {
      setLoadingAction(null);
    }
  };

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_ar.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2.5">
            <Package className="w-7 h-7 text-cyan-400" />
            <span>{t.inventoryTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.inventorySubtitle}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 left-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.search}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-border text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-slate-400 uppercase bg-surface/60 border-y border-border">
              <tr>
                <th className="py-2.5 px-3">{t.productName}</th>
                <th className="py-2.5 px-3">{t.category}</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">{t.stockLevel}</th>
                <th className="py-2.5 px-3">{t.reorderLevel}</th>
                <th className="py-2.5 px-3 text-right">Quick Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map((prod) => {
                const isLow = prod.stock_quantity <= prod.reorder_level;
                const isOut = prod.stock_quantity <= 0;

                return (
                  <tr key={prod.id} className="hover:bg-surface/40 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white text-xs">
                        {lang === 'ar' ? prod.name_ar : prod.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {lang === 'ar' ? prod.name : prod.name_ar}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-surface text-slate-300 border border-border">
                        {prod.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-amber-400" dir="ltr">
                      {formatMoney(prod.price)} {t.currency}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                        {isLow && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span
                          className={`${
                            isOut
                              ? 'text-rose-400 font-black'
                              : isLow
                              ? 'text-amber-400 font-bold'
                              : 'text-slate-200'
                          }`}
                        >
                          {prod.stock_quantity} units
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {prod.reorder_level} units
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {[10, 25, 50].map((qty) => (
                          <button
                            key={qty}
                            disabled={loadingAction === prod.id}
                            onClick={() => { setRestockProduct(prod); setRestockQty(String(qty)); }}
                            className="px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-cyan-500 hover:text-cyan-300 text-slate-300 text-[11px] font-mono font-semibold transition"
                          >
                            +{qty} تأكيد
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {restockProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4"><h3 className="text-white font-bold">إضافة مخزون: {restockProduct.name_ar}</h3><p className="text-xs text-slate-400">اكتب الكمية وإجمالي قيمة الشراء. سيتم تسجيلها كمصروف مشتريات وخصمها من الخزنة الرئيسية.</p><label className="block text-xs text-slate-300">عدد القطع<input type="number" min="1" value={restockQty} onChange={e => setRestockQty(e.target.value)} className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-white" /></label><label className="block text-xs text-slate-300">إجمالي قيمة الشراء<input type="number" min="0" step="0.01" value={purchaseTotal} onChange={e => setPurchaseTotal(e.target.value)} placeholder="0 إذا لم تدفع الآن" className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-white" /></label><label className="block text-xs text-slate-300">طريقة الدفع<select value={purchaseMethod} onChange={e => setPurchaseMethod(e.target.value)} className="mt-1 w-full rounded-xl bg-surface border border-border px-3 py-2 text-white"><option value="cash">نقدي / من الخزنة</option><option value="visa">Visa</option><option value="wallet">Wallet</option><option value="instapay">InstaPay</option><option value="bank_transfer">تحويل بنكي</option><option value="other">أخرى</option></select></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setRestockProduct(null)} className="px-4 py-2 rounded-xl bg-surface text-slate-300">إلغاء</button><button type="button" disabled={loadingAction === restockProduct.id} onClick={handleQuickRestock} className="px-4 py-2 rounded-xl bg-cyan-600 text-white font-bold">{loadingAction === restockProduct.id ? 'جاري الحفظ...' : 'تأكيد الإضافة'}</button></div></div></div>}

      {/* Audit Log Table */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <History className="w-5 h-5 text-cyan-400" />
          <h3 className="text-base font-bold text-white">
            {t.inventoryLogs}
          </h3>
        </div>

        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-slate-400 uppercase bg-surface/60 border-y border-border">
              <tr>
                <th className="py-2 px-3">Product</th>
                <th className="py-2 px-3">Change</th>
                <th className="py-2 px-3">Reason</th>
                <th className="py-2 px-3">Staff</th>
                <th className="py-2 px-3">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface/30">
                  <td className="py-2 px-3 font-semibold text-white">
                    {log.product?.name || 'Product'}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold">
                    <span
                      className={`inline-flex items-center gap-0.5 ${
                        log.quantity_change > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {log.quantity_change > 0 ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {log.quantity_change > 0 ? `+${log.quantity_change}` : log.quantity_change}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-surface text-slate-300">
                      {log.reason}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400">
                    {log.staff?.name || 'System / Auto'}
                  </td>
                  <td className="py-2 px-3 font-mono text-[10px] text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
