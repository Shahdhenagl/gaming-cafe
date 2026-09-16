import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Gamepad2, 
  Coffee, 
  DollarSign, 
  Users, 
  Award, 
  Flame, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { api } from '../services/api';
import { formatMoney, safeNum } from '../utils/format';

interface AdminDashboardProps {
  lang: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang }) => {
  const t = translations[lang];

  const [dashboardData, setDashboardData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseDraft, setExpenseDraft] = useState({ category: 'general', description: '', amount: '', expense_date: new Date().toISOString().slice(0, 10) });

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dash, anal, expenseRes] = await Promise.all([
        api.getDashboardReport(),
        api.getAnalytics(7),
        api.getExpenses(30).catch(() => ({ expenses: [] })),
      ]);
      setDashboardData(dash);
      setAnalyticsData(anal);
      setExpenses(expenseRes.expenses || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const addExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseDraft.description || !expenseDraft.amount) return;
    await api.createExpense({ ...expenseDraft, amount: Number(expenseDraft.amount) });
    setExpenseDraft({ ...expenseDraft, description: '', amount: '' });
    await fetchDashboard();
  };

  if (loading || !dashboardData) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">Loading operations & financial analytics...</p>
      </div>
    );
  }

  const metrics = dashboardData.metrics;
  const totalRevenue = safeNum(metrics?.total_revenue_today);
  const cafePct = totalRevenue > 0 ? ((safeNum(metrics?.cafe_revenue_today) / totalRevenue) * 100).toFixed(0) : '0';
  const gamingPct = totalRevenue > 0 ? ((safeNum(metrics?.gaming_revenue_today) / totalRevenue) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-purple-400" />
            <span>{t.analyticsTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.analyticsSubtitle}
          </p>
        </div>

        <button
          onClick={fetchDashboard}
          className="px-4 py-2 rounded-xl bg-card border border-border hover:border-primary text-xs font-semibold text-slate-200 transition"
        >
          Refresh Data
        </button>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>{t.todayRevenue}</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black font-mono text-emerald-400" dir="ltr">
            {formatMoney(metrics?.total_revenue_today)} {t.currency}
          </p>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-mono" dir="ltr">
            <span className="text-amber-400">Cash: {formatMoney(metrics?.cash_total)}</span>
            <span>•</span>
            <span className="text-cyan-400">Card: {formatMoney(metrics?.card_total)}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>{t.cafeSales}</span>
            <Coffee className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-300" dir="ltr">
            {formatMoney(metrics?.cafe_revenue_today)} {t.currency}
          </p>
          <div className="w-full bg-surface h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-400 h-full rounded-full" style={{ width: `${cafePct}%` }} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>{t.gamingSales}</span>
            <Gamepad2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black font-mono text-purple-300" dir="ltr">
            {formatMoney(metrics?.gaming_revenue_today)} {t.currency}
          </p>
          <div className="w-full bg-surface h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${gamingPct}%` }} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-card border border-border">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>{t.stationOccupancy}</span>
            <Flame className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black font-mono text-white">
            {metrics.device_occupancy_rate}%
          </p>
          <p className="text-[10px] text-slate-400 mt-2">
            {metrics.active_devices_count} of {metrics.total_devices_count} gaming stations active
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border"><p className="text-xs text-slate-400">Revenue today</p><p className="text-xl font-black text-emerald-400">{formatMoney(metrics?.total_revenue_today)} EGP</p></div>
        <div className="p-4 rounded-2xl bg-card border border-border"><p className="text-xs text-slate-400">Expenses today</p><p className="text-xl font-black text-rose-400">{formatMoney(metrics?.expenses_today)} EGP</p></div>
        <div className="p-4 rounded-2xl bg-card border border-border"><p className="text-xs text-slate-400">Product cost today</p><p className="text-xl font-black text-amber-400">{formatMoney(metrics?.cost_of_goods_today)} EGP</p></div>
        <div className="p-4 rounded-2xl bg-card border border-border"><p className="text-xs text-slate-400">Net profit today</p><p className="text-xl font-black text-cyan-400">{formatMoney(metrics?.net_profit_today)} EGP</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={addExpense} className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white">Add expense / إضافة مصروف</h3>
          <input className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm" placeholder="Description / البيان" value={expenseDraft.description} onChange={e => setExpenseDraft({ ...expenseDraft, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3"><input className="rounded-xl bg-surface border border-border px-3 py-2 text-sm" placeholder="Category" value={expenseDraft.category} onChange={e => setExpenseDraft({ ...expenseDraft, category: e.target.value })} /><input className="rounded-xl bg-surface border border-border px-3 py-2 text-sm" type="number" min="0" placeholder="Amount" value={expenseDraft.amount} onChange={e => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} /></div>
          <input className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm" type="date" value={expenseDraft.expense_date} onChange={e => setExpenseDraft({ ...expenseDraft, expense_date: e.target.value })} />
          <button className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-2 text-sm font-bold">Save expense</button>
        </form>
        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5"><h3 className="font-bold text-white mb-3">Recent expenses / آخر المصروفات</h3><div className="space-y-2 max-h-52 overflow-auto">{expenses.map(exp => <div key={exp.id} className="flex justify-between border-b border-border/60 pb-2 text-sm"><span className="text-slate-300">{exp.description}<small className="block text-slate-500">{exp.category} • {exp.expense_date}</small></span><span className="font-mono text-rose-300">{formatMoney(exp.amount)} EGP</span></div>)}{expenses.length === 0 && <p className="text-slate-500 text-sm">No expenses recorded.</p>}</div></div>
      </div>

      {/* Analytics Charts & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Revenue Trend (8 Cols) */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base text-white">
                {t.peakHours} (Past 7 Days)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                Cafe
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-purple-500" />
                Gaming
              </span>
            </div>
          </div>

          {/* Bar chart representation */}
          <div className="pt-4 flex items-end justify-between gap-3 h-48 border-b border-border/60 pb-3">
            {analyticsData?.daily_stats?.map((day: any) => {
              const maxRev = Math.max(...analyticsData.daily_stats.map((s: any) => s.total_revenue), 100);
              const heightCafe = (day.cafe_revenue / maxRev) * 100;
              const heightGaming = (day.gaming_revenue / maxRev) * 100;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition" dir="ltr">
                    {safeNum(day.total_revenue).toFixed(0)}
                  </span>
                  <div className="w-full max-w-[32px] flex flex-col rounded-t-lg overflow-hidden bg-surface">
                    <div
                      className="bg-purple-500 w-full transition-all"
                      style={{ height: `${heightGaming}%`, minHeight: heightGaming > 0 ? '4px' : '0' }}
                    />
                    <div
                      className="bg-amber-500 w-full transition-all"
                      style={{ height: `${heightCafe}%`, minHeight: heightCafe > 0 ? '4px' : '0' }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 mt-1">
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Products (4 Cols) */}
        <div className="lg:col-span-4 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-border">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">
              {t.topProducts}
            </h3>
          </div>

          <div className="space-y-3">
            {dashboardData.top_products.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-surface/60 border border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-card border border-border flex items-center justify-center text-xs font-bold text-amber-400">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-xs text-white leading-tight">
                      {lang === 'ar' ? item.product?.name_ar : item.product?.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {item.total_quantity} sold
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs text-emerald-400" dir="ltr">
                  {formatMoney(item.total_sales)} {t.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
