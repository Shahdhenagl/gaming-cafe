import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  DollarSign, 
  ShoppingCart, 
  Gamepad2, 
  Coffee, 
  CheckCircle2, 
  History, 
  Printer, 
  FileText,
  User,
  CreditCard,
  Banknote
} from 'lucide-react';
import { Shift, ShiftMetrics, User as UserType } from '../types';
import { Language, translations } from '../i18n/translations';
import { api } from '../services/api';
import { formatMoney } from '../utils/format';

interface ShiftDashboardProps {
  lang: Language;
  shift: Shift | null;
  metrics: ShiftMetrics | null;
  user: UserType | null;
  onOpenStartShift: () => void;
  onOpenEndShift: () => void;
}

export const ShiftDashboard: React.FC<ShiftDashboardProps> = ({
  lang,
  shift,
  metrics,
  user,
  onOpenStartShift,
  onOpenEndShift,
}) => {
  const t = translations[lang];

  const [history, setHistory] = useState<Shift[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseFilter, setExpenseFilter] = useState<'today' | 'all'>('today');
  const [todayReport, setTodayReport] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [expenseDraft, setExpenseDraft] = useState({ category: 'general', description: '', amount: '', payment_method: 'cash', expense_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    fetchHistory();
    api.getExpenses(30).then(res => setExpenses(res.expenses || [])).catch(() => undefined);
    api.getAnalytics('day').then(res => setTodayReport(res.summary || null)).catch(() => undefined);
  }, [shift?.id]);

  useEffect(() => {
    api.getFinanceSummary(shift?.id).then(setFinance).catch(() => setFinance(null));
  }, [shift?.id, shift?.status]);

  const today = new Date().toISOString().slice(0, 10);
  const visibleExpenses = expenseFilter === 'today' ? expenses.filter(exp => String(exp.expense_date).slice(0, 10) === today) : expenses;

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getShiftHistory();
      setHistory(res.shifts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleExpenseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseDraft.description || !expenseDraft.amount) return;
    const payload = { ...expenseDraft, amount: Number(expenseDraft.amount) };
    if (editingExpenseId) await api.updateExpense(editingExpenseId, payload);
    else await api.createExpense(payload);
    const res = await api.getExpenses(30);
    setExpenses(res.expenses || []);
    setExpenseDraft({ ...expenseDraft, description: '', amount: '' });
    setEditingExpenseId(null);
  };

  const editExpense = (expense: any) => {
    setEditingExpenseId(expense.id);
    setExpenseDraft({ category: expense.category, description: expense.description, amount: String(expense.amount), payment_method: expense.payment_method, expense_date: String(expense.expense_date).slice(0, 10) });
  };
  const removeExpense = async (id: number) => {
    if (!window.confirm('حذف المصروف؟ / Delete expense?')) return;
    await api.deleteExpense(id);
    setExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2.5">
            <Clock className="w-7 h-7 text-emerald-400" />
            <span>{t.shiftTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.shiftSubtitle}
          </p>
        </div>

        {/* Action Button */}
        <div>
          {shift?.status === 'active' ? (
            <button
              onClick={onOpenEndShift}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-neon-amber transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{t.endShift}</span>
            </button>
          ) : (
            <button
              onClick={onOpenStartShift}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-neon-green transition flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>{t.startShift}</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Performance KPI Cards */}
      {shift && shift.status === 'active' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">{t.shiftDuration}</p>
              <p className="text-xl font-mono font-black text-white">{metrics?.elapsed_time_formatted || '00:00:00'}</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10 text-primary-light border border-purple-500/30">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">{t.grossRevenue}</p>
              <p className="text-xl font-mono font-black text-emerald-400" dir="ltr">
                {formatMoney(metrics?.total_revenue)} {t.currency}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">{t.cashInDrawer}</p>
              <p className="text-xl font-mono font-black text-amber-300" dir="ltr">
                {formatMoney(metrics?.cash_collected)} {t.currency}
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border flex items-center gap-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-semibold">{t.cardSales}</p>
              <p className="text-xl font-mono font-black text-cyan-300" dir="ltr">
                {formatMoney(metrics?.card_collected)} {t.currency}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-card border border-border text-center space-y-3">
          <Clock className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">{t.noActiveShift}</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Please start a shift to begin recording live orders, cash balance, and device sessions.
          </p>
        </div>
      )}

      {shift && shift.status === 'active' && <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border"><span className="text-xs text-slate-400 block">إيراد الألعاب / Gaming revenue</span><b className="text-emerald-300">{formatMoney(metrics?.gaming_revenue)} {t.currency}</b><small className="block text-slate-500">ربح 100%</small></div>
        <div className="p-4 rounded-xl bg-card border border-border"><span className="text-xs text-slate-400 block">إيراد المشروبات / Beverage sales</span><b className="text-cyan-300">{formatMoney(metrics?.beverage_revenue)} {t.currency}</b></div>
        <div className="p-4 rounded-xl bg-card border border-border"><span className="text-xs text-slate-400 block">تكلفة المشروبات / Cost</span><b className="text-amber-300">{formatMoney(metrics?.beverage_cost)} {t.currency}</b></div>
        <div className="p-4 rounded-xl bg-card border border-border"><span className="text-xs text-slate-400 block">المصروفات الخارجة / Withdrawn</span><b className="text-rose-300">{formatMoney(metrics?.expenses_total)} {t.currency}</b></div>
        <div className="p-4 rounded-xl bg-card border border-border"><span className="text-xs text-slate-400 block">صافي الربح / Net profit</span><b className="text-emerald-300">{formatMoney(metrics?.net_profit)} {t.currency}</b></div>
      </div>}

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-bold text-white">الماليات والخزنة الرئيسية</h3><p className="text-xs text-slate-400">كل المقبوضات حسب الشيفت ووسيلة الدفع مع تاريخ العملية</p></div>
          <div className="text-right"><span className="block text-xs text-slate-400">رصيد الخزنة المرحّل</span><b className="text-xl text-emerald-300">{formatMoney(finance?.treasury?.balance)} {t.currency}</b></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {([['cash','نقدي'], ['visa','بطاقة'], ['wallet','محفظة'], ['instapay','InstaPay'], ['installment','تقسيط'], ['other','أخرى']] as const).map(([method, label]) => {
            const item = finance?.payment_breakdown?.[method] || { income: 0, expenses: 0, net: 0, count: 0 };
            return <div key={method} className="rounded-xl bg-surface border border-border p-3"><span className="block text-xs text-slate-400">{label}</span><b className={`block text-lg ${Number(item.net) >= 0 ? 'text-cyan-300' : 'text-rose-300'}`} dir="ltr">صافي {formatMoney(item.net)} {t.currency}</b><div className="mt-1 flex justify-between gap-2 text-[10px]" dir="ltr"><span className="text-emerald-300">قبض {formatMoney(item.income)}</span><span className="text-rose-300">مصروف {formatMoney(item.expenses)}</span></div><small className="text-slate-500">{item.count || 0} معاملات</small></div>;
          })}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-slate-400 border-b border-border"><th className="text-right p-2">التاريخ</th><th className="text-right p-2">البيان</th><th className="text-right p-2">الوسيلة</th><th className="text-left p-2">المبلغ</th></tr></thead><tbody>{(finance?.transactions || []).slice(0, 12).map((tx: any) => <tr key={tx.id} className="border-b border-border/50"><td className="p-2 text-slate-400" dir="ltr">{tx.date ? new Date(tx.date).toLocaleString('ar-EG') : '-'}</td><td className="p-2 text-slate-300">{tx.reference}</td><td className="p-2 text-slate-400">{tx.payment_method}</td><td className={tx.type === 'expense' ? 'p-2 text-left text-rose-300' : 'p-2 text-left text-emerald-300'} dir="ltr">{tx.type === 'expense' ? '-' : '+'}{formatMoney(tx.amount)} {t.currency}</td></tr>)}</tbody></table>{(finance?.transactions || []).length === 0 && <p className="text-center text-slate-500 py-4">لا توجد معاملات مسجلة</p>}</div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-white">تقفيل اليوم / Today closing</h3>
          <div className="flex gap-2"><button type="button" onClick={() => setExpenseFilter('today')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${expenseFilter === 'today' ? 'bg-primary text-white' : 'bg-surface text-slate-400'}`}>اليوم / Today</button><button type="button" onClick={() => setExpenseFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${expenseFilter === 'all' ? 'bg-primary text-white' : 'bg-surface text-slate-400'}`}>كل الفترة / All</button></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm"><div><span className="block text-slate-400">الإيراد</span><b className="text-emerald-300">{formatMoney(todayReport?.revenue)} {t.currency}</b></div><div><span className="block text-slate-400">تكلفة المشروبات</span><b className="text-amber-300">{formatMoney(todayReport?.cost_of_goods)} {t.currency}</b></div><div><span className="block text-slate-400">المصروفات</span><b className="text-rose-300">{formatMoney(todayReport?.expenses)} {t.currency}</b></div><div><span className="block text-slate-400">صافي الربح</span><b className="text-cyan-300">{formatMoney(todayReport?.net_profit)} {t.currency}</b></div></div>
      </div>

      {/* Secondary Metrics Row */}
      {shift && shift.status === 'active' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <span className="text-xs text-slate-400 block mb-1">{t.totalOrders}</span>
            <span className="text-lg font-mono font-bold text-white">{metrics?.total_orders || 0}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <span className="text-xs text-slate-400 block mb-1">{t.totalSessions}</span>
            <span className="text-lg font-mono font-bold text-white">{metrics?.total_sessions || 0}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <span className="text-xs text-slate-400 block mb-1">{t.beveragesSold}</span>
            <span className="text-lg font-mono font-bold text-white">{metrics?.total_beverages_sold || 0}</span>
          </div>
          <div className="p-4 rounded-xl bg-surface border border-border text-center">
            <span className="text-xs text-slate-400 block mb-1">{t.averageTicket}</span>
            <span className="text-lg font-mono font-bold text-white" dir="ltr">
              {formatMoney(metrics?.average_order_value)} {t.currency}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={handleExpenseSubmit} className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white">إنشاء مصروف / Create Expense</h3>
          <input required className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm" placeholder="الوصف / Description" value={expenseDraft.description} onChange={e => setExpenseDraft({ ...expenseDraft, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-xl bg-surface border border-border px-3 py-2 text-sm" value={expenseDraft.category} onChange={e => setExpenseDraft({ ...expenseDraft, category: e.target.value })}><option value="general">عام / General</option><option value="supplies">مستلزمات / Supplies</option><option value="maintenance">صيانة / Maintenance</option><option value="utilities">فواتير / Utilities</option><option value="staff">عاملين / Staff</option><option value="other">أخرى / Other</option></select>
            <input required type="number" min="0" step="0.01" className="rounded-xl bg-surface border border-border px-3 py-2 text-sm" placeholder="المبلغ / Amount" value={expenseDraft.amount} onChange={e => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} />
          </div>
          <select className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm" value={expenseDraft.payment_method} onChange={e => setExpenseDraft({ ...expenseDraft, payment_method: e.target.value })}><option value="cash">خرج من الدرج / Cash drawer</option><option value="visa">بطاقة / Visa</option><option value="wallet">محفظة / Wallet</option><option value="instapay">InstaPay</option><option value="bank_transfer">تحويل بنكي / Bank transfer</option><option value="other">أخرى / Other</option></select>
          <input required type="date" className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm" value={expenseDraft.expense_date} onChange={e => setExpenseDraft({ ...expenseDraft, expense_date: e.target.value })} />
          <button className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-sm font-bold">{editingExpenseId ? 'تعديل المصروف / Update expense' : 'حفظ المصروف / Save expense'}</button>
        </form>
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5"><h3 className="font-bold text-white mb-3">مصروفات {expenseFilter === 'today' ? 'اليوم / Today' : 'كل الفترة / All'}</h3><div className="space-y-2 max-h-56 overflow-auto">{visibleExpenses.slice(0, 10).map(exp => <div key={exp.id} className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 text-sm"><span className="text-slate-300">{exp.description}<small className="block text-slate-500">{exp.category} • {exp.payment_method === 'cash' ? 'خرج من الدرج' : exp.payment_method}</small></span><span className="font-mono text-rose-300">{formatMoney(exp.amount)} {t.currency}</span><button type="button" onClick={() => editExpense(exp)} className="text-cyan-300">تعديل</button><button type="button" onClick={() => removeExpense(exp.id)} className="text-rose-300">حذف</button></div>)}{visibleExpenses.length === 0 && <p className="text-slate-500 text-sm">لا توجد مصروفات في الفلتر الحالي</p>}</div></div>
      </div>

      {/* Shift History Archive Table */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">
              {t.shiftHistory}
            </h3>
          </div>
          <button
            onClick={fetchHistory}
            className="text-xs text-primary-light hover:underline font-semibold"
          >
            Refresh History
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] text-slate-400 uppercase bg-surface/60 border-y border-border">
              <tr>
                <th className="py-2.5 px-3">Shift ID</th>
                <th className="py-2.5 px-3">Staff</th>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">End Time</th>
                <th className="py-2.5 px-3">Gross Sales</th>
                <th className="py-2.5 px-3">Cash / Card</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500">
                    No past shifts found.
                  </td>
                </tr>
              ) : (
                history.map((s) => (
                  <tr key={s.id} className="hover:bg-surface/40 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-200">
                      #{s.id}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {s.staff?.name || 'Staff'}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono">
                      {new Date(s.start_time).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono">
                      {s.end_time
                        ? new Date(s.end_time).toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Active Now'}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-emerald-400" dir="ltr">
                      {formatMoney(s.total_before_deductions)} {t.currency}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300" dir="ltr">
                      {formatMoney(s.cash_collected)} / {formatMoney(s.card_collected)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          s.status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-surface text-slate-400 border border-border'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
