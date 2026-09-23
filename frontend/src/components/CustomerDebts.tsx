import React, { useEffect, useState } from 'react';
import { 
  CreditCard, 
  Search, 
  Wallet, 
  Archive, 
  ArchiveRestore, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  RefreshCw, 
  UserCheck, 
  Inbox,
  Filter
} from 'lucide-react';
import { api } from '../services/api';
import { formatMoney } from '../utils/format';

type TabType = 'active' | 'zero_debt' | 'all' | 'archived';

export const CustomerDebts: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({
    total_remaining: 0,
    active_with_debt_count: 0,
    active_zero_debt_count: 0,
    archived_count: 0,
  });
  const [currentTab, setCurrentTab] = useState<TabType>('active');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Archive & Delete confirmation dialogs
  const [archiveTarget, setArchiveTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getCustomerDebts({
        search: search.trim() || undefined,
        tab: currentTab,
      });
      setCustomers(res.customers || []);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (e) {
      console.error('Error loading customer debts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [currentTab]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void load();
  };

  const pay = async () => {
    if (!selected || !Number(amount) || Number(amount) <= 0) return;
    setActionLoading(true);
    try {
      await api.payCustomerDebt(selected.debt.id, { 
        amount: Number(amount), 
        payment_method: method 
      });
      setSelected(null);
      setAmount('');
      showToast('تم تسجيل سداد المديونية بنجاح');
      await load();
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ أثناء تسجيل السداد');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      await api.archiveCustomer(archiveTarget.id);
      showToast(`تم نقل العميل "${archiveTarget.name}" إلى الأرشيف بنجاح. يمكنك استعادته في أي وقت.`);
      setArchiveTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ أثناء أرشفة العميل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async (customer: any) => {
    setActionLoading(true);
    try {
      await api.restoreCustomer(customer.id);
      showToast(`تمت استعادة العميل "${customer.name}" من الأرشيف بنجاح.`);
      await load();
    } catch (e: any) {
      alert(e?.message || 'حدث خطأ أثناء استعادة العميل');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.deleteCustomer(deleteTarget.id);
      showToast(`تم حذف العميل "${deleteTarget.name}" نهائياً.`);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      alert(e?.message || 'لا يمكن حذف العميل');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-bold animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-7 h-7 text-amber-400" />
            <h2 className="text-xl lg:text-2xl font-black text-white">آجل وحسابات العملاء</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            متابعة أرصدة الآجل، تسجيل دفعات السداد، وتنظيم العملاء عبر الأرشفة والاستعادة
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم العميل أو رقم الهاتف..."
              className="w-full rounded-xl bg-surface border border-border pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary font-sans"
            />
          </div>
          <button 
            type="submit" 
            className="rounded-xl bg-primary hover:bg-primary/90 px-3.5 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>بحث</span>
          </button>
          <button 
            type="button" 
            onClick={() => void load()} 
            className="rounded-xl bg-card border border-border p-2 text-slate-300 hover:text-white hover:border-primary transition"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </form>
      </div>

      {/* Tabs and Quick Statistics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCurrentTab('active')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              currentTab === 'active'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-900/30'
                : 'bg-card border border-border text-slate-300 hover:bg-surface'
            }`}
          >
            <span>الآجل الحالي (عليه مديونية)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              currentTab === 'active' ? 'bg-rose-900/80 text-rose-100' : 'bg-surface text-slate-400'
            }`}>
              {summary.active_with_debt_count}
            </span>
          </button>

          <button
            onClick={() => setCurrentTab('zero_debt')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              currentTab === 'zero_debt'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/30'
                : 'bg-card border border-border text-slate-300 hover:bg-surface'
            }`}
          >
            <span>المسددة بالكامل (رصيد 0)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              currentTab === 'zero_debt' ? 'bg-emerald-900/80 text-emerald-100' : 'bg-surface text-slate-400'
            }`}>
              {summary.active_zero_debt_count}
            </span>
          </button>

          <button
            onClick={() => setCurrentTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              currentTab === 'all'
                ? 'bg-primary text-white shadow-md shadow-purple-900/30'
                : 'bg-card border border-border text-slate-300 hover:bg-surface'
            }`}
          >
            <span>كل العملاء النشطين</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              currentTab === 'all' ? 'bg-purple-900/80 text-purple-100' : 'bg-surface text-slate-400'
            }`}>
              {summary.active_with_debt_count + summary.active_zero_debt_count}
            </span>
          </button>

          <button
            onClick={() => setCurrentTab('archived')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              currentTab === 'archived'
                ? 'bg-purple-700 text-white shadow-md shadow-purple-900/30'
                : 'bg-card border border-border text-slate-400 hover:text-white hover:bg-surface'
            }`}
          >
            <Archive className="w-3.5 h-3.5" />
            <span>الأرشيف (المؤرشفة)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] ${
              currentTab === 'archived' ? 'bg-purple-950 text-purple-200' : 'bg-surface text-slate-400'
            }`}>
              {summary.archived_count}
            </span>
          </button>
        </div>

        {/* Total Outstanding Badge */}
        {currentTab !== 'archived' && (
          <div className="text-left font-mono">
            <span className="text-[11px] text-slate-400 block">إجمالي الآجل المعلق:</span>
            <span className="text-base font-black text-rose-400" dir="ltr">
              {formatMoney(summary.total_remaining)} EGP
            </span>
          </div>
        )}
      </div>

      {/* Customers Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {customers.map((c) => {
          const hasDebt = Number(c.remaining_debt) > 0;
          const isArchived = Boolean(c.is_archived);

          return (
            <div 
              key={c.id} 
              className={`rounded-2xl border p-4.5 flex flex-col justify-between transition relative overflow-hidden ${
                isArchived 
                  ? 'bg-card/60 border-purple-900/40 opacity-90' 
                  : hasDebt 
                    ? 'bg-card border-border hover:border-rose-500/40' 
                    : 'bg-card/80 border-border hover:border-emerald-500/40'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isArchived 
                        ? 'bg-purple-950 text-purple-300 border border-purple-800' 
                        : hasDebt 
                          ? 'bg-rose-950 text-rose-300 border border-rose-800' 
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {c.name ? c.name.charAt(0).toUpperCase() : 'ع'}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{c.name}</span>
                        {isArchived && (
                          <span className="text-[10px] bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/60">
                            مؤرشف
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 font-mono" dir="ltr">
                        {c.phone || 'بدون هاتف'}
                      </p>
                    </div>
                  </div>

                  {/* Top Action Icons */}
                  <div className="flex items-center gap-1">
                    {!isArchived ? (
                      <button
                        onClick={() => setArchiveTarget(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-950/40 border border-transparent hover:border-amber-800/40 transition text-xs flex items-center gap-1"
                        title="نقل العميل للأرشيف"
                      >
                        <Archive className="w-4 h-4 text-amber-400/80" />
                        <span className="text-[11px] hidden sm:inline">أرشفة</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => void handleRestore(c)}
                          disabled={actionLoading}
                          className="px-2 py-1 rounded-lg text-purple-300 bg-purple-950/80 hover:bg-purple-900 border border-purple-800 transition text-xs flex items-center gap-1 font-bold"
                          title="استعادة العميل من الأرشيف"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          <span>استعادة</span>
                        </button>

                        {!hasDebt && (
                          <button
                            onClick={() => setDeleteTarget(c)}
                            disabled={actionLoading}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                            title="حذف نهائي"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Remaining Debt Summary */}
                <div className="mt-3 flex items-center justify-between text-xs p-2 rounded-xl bg-surface/80 border border-border/40">
                  <span className="text-slate-400">المبلغ المتبقي:</span>
                  <div className="flex items-center gap-1.5">
                    {hasDebt ? (
                      <b className="text-rose-400 text-sm font-mono font-black" dir="ltr">
                        {formatMoney(c.remaining_debt)} EGP
                      </b>
                    ) : (
                      <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>مسدد بالكامل (0.00)</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Unpaid Bills List */}
                <div className="mt-3 space-y-2">
                  {(c.debts || [])
                    .filter((d: any) => Number(d.remaining_amount) > 0)
                    .map((d: any) => (
                      <div 
                        key={d.id} 
                        className="flex items-center justify-between rounded-xl bg-surface p-2.5 text-xs border border-border/60 hover:border-border transition"
                      >
                        <div>
                          <span className="text-slate-200 font-semibold block">{d.description}</span>
                          <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                            متبقي: {formatMoney(d.remaining_amount)} EGP
                          </span>
                        </div>
                        <button 
                          onClick={() => { 
                            setSelected({ customer: c, debt: d }); 
                            setAmount(String(d.remaining_amount)); 
                          }} 
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 font-bold text-white transition text-xs shadow-sm shadow-emerald-900/20"
                        >
                          سداد
                        </button>
                      </div>
                    ))}

                  {/* Empty state when customer has 0 remaining debt */}
                  {!hasDebt && (
                    <div className="text-center py-2 text-[11px] text-slate-500">
                      <span>الحساب خالص بالكامل، لا توجد فواتير معلقة.</span>
                      {!isArchived && (
                        <button
                          onClick={() => setArchiveTarget(c)}
                          className="block mx-auto mt-1 text-amber-400/90 hover:text-amber-300 font-bold hover:underline"
                        >
                          اضغط هنا لأرشفة العميل لتنظيم الشاشة 📦
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Notes if any */}
              {c.notes && (
                <div className="mt-3 pt-2 border-t border-border/40 text-[10px] text-slate-500 truncate">
                  ملاحظات: {c.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {customers.length === 0 && !loading && (
        <div className="py-16 text-center text-slate-400 bg-card/40 rounded-2xl border border-dashed border-border/80">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">
            {currentTab === 'archived' 
              ? 'الأرشيف فارغ، لا يوجد أي عملاء مؤرشفين حالياً.' 
              : currentTab === 'zero_debt'
                ? 'لا يوجد أي عملاء برصيد مسدد (0) حالياً.'
                : 'لا توجد أي أرصدة آجلة مسجلة.'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {currentTab === 'archived'
              ? 'عند أرشفة أي عميل مسدد سيظهر هنا لحفظ السجل ويمكنك استعادته في أي وقت.'
              : 'يمكنك إضافة فواتير الآجل مباشرة عند تسجيل خروج الطاولات أو جلسات اللعب.'}
          </p>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">
                  تسجيل سداد من: {selected.customer.name}
                </h3>
              </div>
              <button 
                onClick={() => setSelected(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-surface p-3 rounded-xl border border-border/60 text-xs">
              <span className="text-slate-400 block mb-0.5">تفاصيل الفاتورة:</span>
              <strong className="text-white text-sm">{selected.debt.description}</strong>
              <div className="mt-1 flex justify-between text-slate-300">
                <span>المتبقي المطلوب:</span>
                <b className="font-mono text-rose-400">{formatMoney(selected.debt.remaining_amount)} ج.م</b>
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">المبلغ المراد تحصيله (ج.م):</label>
              <input 
                type="number" 
                min="0.01" 
                max={selected.debt.remaining_amount}
                step="0.5" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="w-full rounded-xl bg-surface border border-border p-3 text-white font-mono text-base focus:outline-none focus:border-primary" 
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">طريقة الدفع (تدخل في الخزنة الحالية):</label>
              <select 
                value={method} 
                onChange={e => setMethod(e.target.value)} 
                className="w-full rounded-xl bg-surface border border-border p-3 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="cash">نقدي (درج الكاش)</option>
                <option value="visa">فيزا / بنك</option>
                <option value="wallet">محفظة إلكترونية</option>
                <option value="instapay">InstaPay</option>
                <option value="other">أخرى</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button 
                onClick={() => setSelected(null)} 
                className="rounded-xl bg-surface hover:bg-surface/80 px-4 py-2.5 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button 
                disabled={actionLoading || !Number(amount) || Number(amount) <= 0} 
                onClick={() => void pay()} 
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
              >
                <Wallet className="w-4 h-4" />
                <span>{actionLoading ? 'جاري التسجيل...' : 'تأكيد السداد'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE CONFIRMATION MODAL */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-800/80 flex items-center justify-center text-amber-400">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  أرشفة العميل: {archiveTarget.name}
                </h3>
                <p className="text-xs text-slate-400">حفظ ونقل العميل إلى تبويب الأرشيف</p>
              </div>
            </div>

            <div className="bg-surface/90 border border-border/80 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed">
              <p>
                سيتم نقل العميل <strong>"{archiveTarget.name}"</strong> إلى تبويب <strong>الأرشيف</strong> وإخفاؤه من شاشة الآجل الحالية لتنظيم العرض.
              </p>
              <p className="mt-2 text-emerald-400 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>لن يتم حذف أي فواتير، ويمكنك استعادة العميل في أي وقت بنقرة واحدة!</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setArchiveTarget(null)} 
                className="rounded-xl bg-surface hover:bg-surface/80 px-4 py-2.5 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button 
                disabled={actionLoading} 
                onClick={() => void handleArchive()} 
                className="rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-amber-900/30"
              >
                <Archive className="w-4 h-4" />
                <span>{actionLoading ? 'جاري الأرشفة...' : 'تأكيد الأرشفة'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  حذف العميل نهائياً: {deleteTarget.name}
                </h3>
                <p className="text-xs text-slate-400">إزالة العميل تماماً من قاعدة البيانات</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-surface/90 border border-border/80 rounded-xl p-3.5">
              هل أنت متأكد من حذف العميل <strong>"{deleteTarget.name}"</strong> نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button 
                onClick={() => setDeleteTarget(null)} 
                className="rounded-xl bg-surface hover:bg-surface/80 px-4 py-2.5 text-xs text-slate-300"
              >
                إلغاء
              </button>
              <button 
                disabled={actionLoading} 
                onClick={() => void handleDelete()} 
                className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 px-5 py-2.5 text-xs font-bold text-white flex items-center gap-1.5 shadow-md shadow-rose-900/30"
              >
                <Trash2 className="w-4 h-4" />
                <span>{actionLoading ? 'جاري الحذف...' : 'حذف نهائي'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

