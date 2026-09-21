import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Gamepad2, 
  Coffee, 
  DollarSign, 
  Flame, 
  Calendar,
  CalendarDays,
  Printer,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Receipt,
  RefreshCw,
  X,
  Clock,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { Language, translations } from '../i18n/translations';
import { api } from '../services/api';
import { StatementResponse, StatementTransaction } from '../types';
import { formatMoney, safeNum } from '../utils/format';

interface AdminDashboardProps {
  lang: Language;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ lang }) => {
  const t = translations[lang];

  // Helper date strings
  const getTodayStr = () => new Date().toISOString().slice(0, 10);
  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  };
  const getCurrentMonthStr = () => new Date().toISOString().slice(0, 7);
  const getLastMonthStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  };

  // Filter state
  const [filterMode, setFilterMode] = useState<'day' | 'month' | 'range'>('day');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayStr());
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());
  const [fromDate, setFromDate] = useState<string>(getTodayStr());
  const [toDate, setToDate] = useState<string>(getTodayStr());

  // Statement & search filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [statementData, setStatementData] = useState<StatementResponse | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [statementLoading, setStatementLoading] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [expenseDraft, setExpenseDraft] = useState({ 
    category: 'general', 
    description: '', 
    amount: '', 
    payment_method: 'cash', 
    expense_date: getTodayStr() 
  });

  // Calculate current active date parameters
  const getDateParams = () => {
    if (filterMode === 'day') {
      return { date: selectedDate };
    } else if (filterMode === 'month') {
      return { month: selectedMonth };
    } else {
      return { from_date: fromDate, to_date: toDate };
    }
  };

  // Initial and reactive load
  useEffect(() => {
    fetchFullDashboard();
  }, [filterMode, selectedDate, selectedMonth, fromDate, toDate, analyticsPeriod]);

  // Reactive load for ledger table search & type filters
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStatement();
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchTerm, typeFilter, paymentFilter]);

  const fetchFullDashboard = async () => {
    setLoading(true);
    try {
      const dateParams = getDateParams();
      const statementParams = {
        ...dateParams,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        payment_method: paymentFilter !== 'all' ? paymentFilter : undefined,
        search: searchTerm.trim() || undefined,
      };

      const [dash, anal, stateRes, expenseRes] = await Promise.all([
        api.getDashboardReport(dateParams),
        api.getAnalytics(analyticsPeriod),
        api.getStatement(statementParams).catch(() => null),
        api.getExpenses(30).catch(() => ({ expenses: [] })),
      ]);

      setDashboardData(dash);
      setAnalyticsData(anal);
      if (stateRes) setStatementData(stateRes);
      setExpenses(expenseRes.expenses || []);
    } catch (e) {
      console.error('Error fetching dashboard reports:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatement = async () => {
    setStatementLoading(true);
    try {
      const dateParams = getDateParams();
      const statementParams = {
        ...dateParams,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        payment_method: paymentFilter !== 'all' ? paymentFilter : undefined,
        search: searchTerm.trim() || undefined,
      };
      const res = await api.getStatement(statementParams);
      setStatementData(res);
    } catch (e) {
      console.error('Error fetching statement ledger:', e);
    } finally {
      setStatementLoading(false);
    }
  };

  const setPreset = (preset: 'today' | 'yesterday' | 'this_month' | 'last_month') => {
    if (preset === 'today') {
      setFilterMode('day');
      setSelectedDate(getTodayStr());
    } else if (preset === 'yesterday') {
      setFilterMode('day');
      setSelectedDate(getYesterdayStr());
    } else if (preset === 'this_month') {
      setFilterMode('month');
      setSelectedMonth(getCurrentMonthStr());
    } else if (preset === 'last_month') {
      setFilterMode('month');
      setSelectedMonth(getLastMonthStr());
    }
  };

  const addExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!expenseDraft.description || !expenseDraft.amount) return;
    await api.createExpense({ ...expenseDraft, amount: Number(expenseDraft.amount) });
    setExpenseDraft({ ...expenseDraft, description: '', amount: '' });
    await fetchFullDashboard();
  };

  if (loading && !dashboardData) {
    return (
      <div className="p-12 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs">جاري تحميل التقارير المالية وحركة الدرج...</p>
      </div>
    );
  }

  const metrics = dashboardData?.metrics;
  const summary = statementData?.summary;
  const transactions = statementData?.transactions || [];

  return (
    <div className="space-y-6">
      {/* Top Bar: Title & Refresh */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-purple-400" />
            <span>{lang === 'ar' ? 'التقارير وسجل حركة الدرج' : t.analyticsTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {lang === 'ar' 
              ? 'فلترة تفصيلية باليوم أو الشهر لمعرفة الوارد والصادر ومبيعات البلايستيشن والكافيه بدقة'
              : t.analyticsSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition shadow-lg shadow-purple-900/30"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة كشف الحساب</span>
          </button>

          <button
            onClick={fetchFullDashboard}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-card border border-border hover:border-primary text-xs font-semibold text-slate-200 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Date & Month Filter Panel */}
      <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" />
            <span className="font-bold text-sm text-white">تحديد فترة التقرير:</span>
            <span className="text-xs text-purple-300 font-mono bg-purple-950/60 px-2.5 py-1 rounded-lg border border-purple-800/40">
              {statementData?.period.label || 'الفترة الحالية'}
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setPreset('today')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filterMode === 'day' && selectedDate === getTodayStr()
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface/80 text-slate-300 border border-border/70'
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setPreset('yesterday')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filterMode === 'day' && selectedDate === getYesterdayStr()
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface/80 text-slate-300 border border-border/70'
              }`}
            >
              أمس
            </button>
            <button
              onClick={() => setPreset('this_month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filterMode === 'month' && selectedMonth === getCurrentMonthStr()
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface/80 text-slate-300 border border-border/70'
              }`}
            >
              هذا الشهر
            </button>
            <button
              onClick={() => setPreset('last_month')}
              className={`px-3 py-1.5 rounded-xl font-bold transition ${
                filterMode === 'month' && selectedMonth === getLastMonthStr()
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-surface hover:bg-surface/80 text-slate-300 border border-border/70'
              }`}
            >
              الشهر السابق
            </button>
          </div>
        </div>

        {/* Filter Mode Selector & Input Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-4 flex rounded-xl bg-surface p-1 border border-border">
            <button
              onClick={() => setFilterMode('day')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                filterMode === 'day' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              يوم محدد
            </button>
            <button
              onClick={() => setFilterMode('month')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                filterMode === 'month' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              شهر كامل
            </button>
            <button
              onClick={() => setFilterMode('range')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                filterMode === 'range' ? 'bg-primary text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              فترة مخصصة
            </button>
          </div>

          <div className="md:col-span-8 flex flex-wrap items-center gap-3">
            {filterMode === 'day' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 whitespace-nowrap">اختر اليوم:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-xl bg-surface border border-border px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>
            )}

            {filterMode === 'month' && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-slate-400 whitespace-nowrap">اختر الشهر:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-xl bg-surface border border-border px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                />
              </div>
            )}

            {filterMode === 'range' && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">من:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-xl bg-surface border border-border px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">إلى:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-xl bg-surface border border-border px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards: Period Summary & Cash Drawer Movement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* Cash In */}
        <div className="p-4 rounded-2xl bg-card border border-emerald-500/20 bg-emerald-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-bold text-emerald-300">وارد الدرج (نقدي)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black font-mono text-emerald-400" dir="ltr">
            {formatMoney(summary?.cash_in ?? metrics?.cash_total)} {t.currency}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">المقبوضات النقدية الفعلية</p>
        </div>

        {/* Cash Out */}
        <div className="p-4 rounded-2xl bg-card border border-rose-500/20 bg-rose-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-bold text-rose-300">صادر الدرج (مصروفات)</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-xl font-black font-mono text-rose-400" dir="ltr">
            {formatMoney(summary?.cash_out ?? metrics?.expenses_today)} {t.currency}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">المصروفات المسحوبة من الدرج</p>
        </div>

        {/* Net Cash in Drawer */}
        <div className="p-4 rounded-2xl bg-card border border-cyan-500/30 bg-cyan-950/15 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-bold text-cyan-300">صافي حركة الدرج</span>
            <Wallet className="w-4 h-4 text-cyan-400" />
          </div>
          <p className={`text-xl font-black font-mono ${(summary?.net_cash ?? 0) >= 0 ? 'text-cyan-300' : 'text-rose-400'}`} dir="ltr">
            {formatMoney(summary?.net_cash ?? ((metrics?.cash_total || 0) - (metrics?.expenses_today || 0)))} {t.currency}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">الداخل - الخارج من الكاش</p>
        </div>

        {/* Gaming Revenue */}
        <div className="p-4 rounded-2xl bg-card border border-purple-500/20 bg-purple-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-bold text-purple-300">{t.gamingSales}</span>
            <Gamepad2 className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-xl font-black font-mono text-purple-300" dir="ltr">
            {formatMoney(summary?.gaming_income ?? metrics?.gaming_revenue_today)} {t.currency}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">بلايستيشن وغرف الألعاب</p>
        </div>

        {/* Cafe Revenue */}
        <div className="p-4 rounded-2xl bg-card border border-amber-500/20 bg-amber-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-bold text-amber-300">{t.cafeSales}</span>
            <Coffee className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-black font-mono text-amber-300" dir="ltr">
            {formatMoney(summary?.cafe_income ?? metrics?.cafe_revenue_today)} {t.currency}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">مشروبات ومأكولات وسناكس</p>
        </div>

        {/* Net Period Income */}
        <div className="p-4 rounded-2xl bg-card border border-border relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1.5">
            <span className="font-bold text-slate-300">صافي أرباح الفترة</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-black font-mono text-white" dir="ltr">
            {formatMoney(summary?.net_income ?? metrics?.net_profit_today)} {t.currency}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">الإيراد الكلي - المصروفات</p>
        </div>
      </div>

      {/* DETAILED OPERATIONS & DRAWER LEDGER TABLE */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        {/* Table Header Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-400" />
              <span>سجل العمليات وحركة الدرج بالتفصيل</span>
              <span className="text-xs bg-purple-950 text-purple-300 px-2 py-0.5 rounded-full border border-purple-800/60 font-mono">
                {transactions.length} عملية
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              كل ما دخل أو خرج من الدرج بتفاصيل الروم، العميل، الوقت، المشروبات، واسم الكاشير
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="ابحث باسم العميل أو الروم أو الكاشير..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl bg-surface border border-border pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 ml-1">النوع:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'gaming', label: '🎮 بلايستيشن وألعاب' },
              { id: 'cafe', label: '☕ كافيه ومشروبات' },
              { id: 'expense', label: '💸 مصروفات درج' },
              { id: 'debt_payment', label: '💳 تحصيل مديونية' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  typeFilter === f.id
                    ? 'bg-primary text-white shadow'
                    : 'bg-surface hover:bg-surface/80 text-slate-400 hover:text-white border border-border/60'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 ml-1">الدفع:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'cash', label: 'نقدي (الدرج)' },
              { id: 'card', label: 'فيزا / إلكتروني' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPaymentFilter(p.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  paymentFilter === p.id
                    ? 'bg-purple-700 text-white'
                    : 'bg-surface text-slate-400 hover:text-white border border-border/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full text-right text-xs">
            <thead className="bg-surface/90 text-slate-400 font-bold border-b border-border">
              <tr>
                <th className="p-3">الوقت</th>
                <th className="p-3">النوع</th>
                <th className="p-3">البيان والتفاصيل (العميل / الجهاز / المشروبات)</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3 text-center">وارد (+)</th>
                <th className="p-3 text-center">صادر (-)</th>
                <th className="p-3 text-center">الصافي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {statementLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>جاري تحديث سجل العمليات...</span>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    لا توجد أي حركات أو عمليات مسجلة خلال الفترة المحددة.
                  </td>
                </tr>
              ) : (
                transactions.map((tx: StatementTransaction) => {
                  const isGaming = tx.type === 'gaming';
                  const isCafe = tx.type === 'cafe';
                  const isExpense = tx.type === 'expense';
                  const isDebt = tx.type === 'debt_payment';

                  return (
                    <tr key={tx.id} className="hover:bg-surface/50 transition">
                      {/* Time */}
                      <td className="p-3 whitespace-nowrap font-mono text-[11px] text-slate-300">
                        {tx.date_time || tx.created_at}
                      </td>

                      {/* Type Badge */}
                      <td className="p-3 whitespace-nowrap">
                        {isGaming && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-950/70 border border-purple-800 text-purple-300 font-bold text-[11px]">
                            <Gamepad2 className="w-3 h-3" />
                            <span>لعب ألعاب</span>
                          </span>
                        )}
                        {isCafe && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-950/70 border border-amber-800 text-amber-300 font-bold text-[11px]">
                            <Coffee className="w-3 h-3" />
                            <span>كافيه</span>
                          </span>
                        )}
                        {isExpense && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-950/70 border border-rose-800 text-rose-300 font-bold text-[11px]">
                            <ArrowUpRight className="w-3 h-3" />
                            <span>مصروف درج</span>
                          </span>
                        )}
                        {isDebt && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/70 border border-cyan-800 text-cyan-300 font-bold text-[11px]">
                            <Wallet className="w-3 h-3" />
                            <span>تحصيل دين</span>
                          </span>
                        )}
                      </td>

                      {/* Details */}
                      <td className="p-3">
                        <div className="font-bold text-white text-xs mb-0.5">
                          {tx.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          {tx.duration && (
                            <span className="text-purple-300 bg-purple-950/40 px-1.5 py-0.5 rounded">
                              ⏱ {tx.duration}
                            </span>
                          )}
                          {tx.details && <span>{tx.details}</span>}
                          {tx.items_summary && (
                            <span className="text-amber-300/90 font-medium">
                              • بوفيه: {tx.items_summary}
                            </span>
                          )}
                          {tx.staff_name && (
                            <span className="text-slate-500 text-[10px]">
                              (كاشير: {tx.staff_name})
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payment Method */}
                      <td className="p-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          tx.payment_method === 'cash'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
                            : 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/40'
                        }`}>
                          {tx.payment_method_label}
                        </span>
                      </td>

                      {/* Amount In (+) */}
                      <td className="p-3 text-center whitespace-nowrap font-mono font-bold text-emerald-400" dir="ltr">
                        {tx.amount_in > 0 ? `+${formatMoney(tx.amount_in)}` : '-'}
                      </td>

                      {/* Amount Out (-) */}
                      <td className="p-3 text-center whitespace-nowrap font-mono font-bold text-rose-400" dir="ltr">
                        {tx.amount_out > 0 ? `-${formatMoney(tx.amount_out)}` : '-'}
                      </td>

                      {/* Net Amount */}
                      <td className="p-3 text-center whitespace-nowrap font-mono font-black" dir="ltr">
                        <span className={tx.net_amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                          {formatMoney(tx.net_amount)} {t.currency}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EXPENSES FORM & RECENT EXPENSES */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <form onSubmit={addExpense} className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3">
          <h3 className="font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
            <span>تسجيل مصروف خارج من الدرج</span>
          </h3>
          <input 
            className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary" 
            placeholder="البيان (مثلاً: شراء سكر وشاي، صيانة دراعات...)" 
            value={expenseDraft.description} 
            onChange={e => setExpenseDraft({ ...expenseDraft, description: e.target.value })} 
          />
          <div className="grid grid-cols-2 gap-3">
            <input 
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary" 
              placeholder="الفئة (خامات / صيانة / عام)" 
              value={expenseDraft.category} 
              onChange={e => setExpenseDraft({ ...expenseDraft, category: e.target.value })} 
            />
            <input 
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary font-mono" 
              type="number" 
              min="0" 
              step="0.5" 
              placeholder="المبلغ (ج.م)" 
              value={expenseDraft.amount} 
              onChange={e => setExpenseDraft({ ...expenseDraft, amount: e.target.value })} 
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select 
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" 
              value={expenseDraft.payment_method} 
              onChange={e => setExpenseDraft({ ...expenseDraft, payment_method: e.target.value })}
            >
              <option value="cash">نقدي من الدرج (Cash)</option>
              <option value="visa">فيزا / بنك</option>
              <option value="wallet">محفظة إلكترونية</option>
              <option value="instapay">InstaPay</option>
              <option value="other">أخرى</option>
            </select>
            <input 
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-white focus:outline-none focus:border-primary font-mono" 
              type="date" 
              value={expenseDraft.expense_date} 
              onChange={e => setExpenseDraft({ ...expenseDraft, expense_date: e.target.value })} 
            />
          </div>
          <button 
            type="submit" 
            className="w-full rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-sm font-bold text-white transition shadow-md shadow-rose-900/20"
          >
            حفظ المصروف وسحبه من الدرج
          </button>
        </form>

        <div className="lg:col-span-3 bg-card border border-border rounded-2xl p-5">
          <h3 className="font-bold text-white mb-3 flex items-center justify-between">
            <span>آخر المصروفات المسجلة</span>
            <span className="text-xs text-slate-400 font-normal">آخر 30 يوم</span>
          </h3>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {expenses.map(exp => (
              <div key={exp.id} className="flex justify-between items-center border-b border-border/60 pb-2 text-sm">
                <div>
                  <span className="text-slate-200 font-medium">{exp.description}</span>
                  <small className="block text-slate-500 text-[11px]">{exp.category} • {exp.expense_date} • {exp.payment_method}</small>
                </div>
                <span className="font-mono font-bold text-rose-400" dir="ltr">
                  -{formatMoney(exp.amount)} {t.currency}
                </span>
              </div>
            ))}
            {expenses.length === 0 && <p className="text-slate-500 text-sm py-4 text-center">لا توجد أي مصروفات مسجلة.</p>}
          </div>
        </div>
      </div>

      {/* Analytics Charts & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Revenue Trend (8 Cols) */}
        <div className="lg:col-span-8 bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-base text-white">
                  {t.peakHours} ({analyticsPeriod === 'day' ? 'Today / اليوم' : analyticsPeriod === 'month' ? 'This month / هذا الشهر' : 'Past 7 days / آخر 7 أيام'})
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">توزيع مبيعات الكافيه مقابل البلايستيشن</p>
              </div>
              <div className="flex gap-1 mr-3">
                <button 
                  onClick={() => setAnalyticsPeriod('day')} 
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${analyticsPeriod === 'day' ? 'bg-primary text-white' : 'bg-surface text-slate-400'}`}
                >
                  يوم
                </button>
                <button 
                  onClick={() => setAnalyticsPeriod('week')} 
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${analyticsPeriod === 'week' ? 'bg-primary text-white' : 'bg-surface text-slate-400'}`}
                >
                  أسبوع
                </button>
                <button 
                  onClick={() => setAnalyticsPeriod('month')} 
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold ${analyticsPeriod === 'month' ? 'bg-primary text-white' : 'bg-surface text-slate-400'}`}
                >
                  شهر
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" />
                الكافيه
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-purple-500" />
                البلايستيشن
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
            <Flame className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-base text-white">
              {t.topProducts}
            </h3>
          </div>

          <div className="space-y-3">
            {dashboardData?.top_products?.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-surface/60 border border-border/60">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-card border border-border flex items-center justify-center text-xs font-bold text-amber-400">
                    #{idx + 1}
                  </span>
                  <div>
                    <p className="font-bold text-xs text-white leading-tight">
                      {lang === 'ar' ? (item.product?.name_ar || item.name_ar) : (item.product?.name || item.name)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {item.total_quantity || item.sales_count} تم بيعها
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold text-xs text-emerald-400" dir="ltr">
                  {formatMoney(item.total_sales || item.revenue)} {t.currency}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PRINT STATEMENT MODAL */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  معاينة وطباعة كشف الحساب ({statementData?.period.label})
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-xs font-bold text-white flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة الآن</span>
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Area */}
            <div className="overflow-y-auto p-6 bg-slate-950/70 flex justify-center">
              <div id="statement-print-sheet" className="w-full max-w-xl bg-white text-slate-900 p-6 rounded-lg font-sans text-xs shadow-xl leading-normal border-t-8 border-purple-600">
                {/* Header */}
                <div className="text-center pb-4 border-b-2 border-slate-300">
                  <h2 className="text-xl font-black text-slate-900 tracking-wider">صالة الخال للألعاب والبلياردو والكافيه</h2>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">AL5AL Gaming, Billiards & Lounge</p>
                  <div className="mt-2 inline-block bg-slate-100 border border-slate-300 px-3 py-1 rounded-md text-xs font-bold text-slate-800">
                    كشف حساب تفصيلي: {statementData?.period.label}
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">تاريخ ووقت التقرير: {new Date().toLocaleString('ar-EG')}</p>
                </div>

                {/* Summary Box */}
                <div className="grid grid-cols-3 gap-2 my-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block">وارد الدرج (كاش)</span>
                    <strong className="text-sm font-mono text-emerald-700">{formatMoney(summary?.cash_in)} ج.م</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">صادر الدرج (مصروفات)</span>
                    <strong className="text-sm font-mono text-rose-700">{formatMoney(summary?.cash_out)} ج.م</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">صافي الدرج الفعلي</span>
                    <strong className="text-sm font-mono text-purple-700">{formatMoney(summary?.net_cash)} ج.م</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-1 mt-1">
                    <span className="text-[10px] text-slate-500 block">إيراد البلايستيشن</span>
                    <strong className="text-xs font-mono text-slate-800">{formatMoney(summary?.gaming_income)} ج.م</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-1 mt-1">
                    <span className="text-[10px] text-slate-500 block">إيراد الكافيه</span>
                    <strong className="text-xs font-mono text-slate-800">{formatMoney(summary?.cafe_income)} ج.م</strong>
                  </div>
                  <div className="border-t border-slate-200 pt-1 mt-1">
                    <span className="text-[10px] text-slate-500 block">صافي الأرباح الكلي</span>
                    <strong className="text-xs font-mono text-slate-800">{formatMoney(summary?.net_income)} ج.م</strong>
                  </div>
                </div>

                {/* Detailed Table */}
                <table className="w-full text-right border-collapse mt-3 text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                      <th className="p-2">الوقت</th>
                      <th className="p-2">النوع</th>
                      <th className="p-2">البيان والتفاصيل</th>
                      <th className="p-2 text-center">وارد (+)</th>
                      <th className="p-2 text-center">صادر (-)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {transactions.map((tx: StatementTransaction) => (
                      <tr key={tx.id} className="text-slate-800">
                        <td className="p-2 font-mono text-[10px] whitespace-nowrap">{tx.date_time}</td>
                        <td className="p-2 font-bold whitespace-nowrap">{tx.type_label}</td>
                        <td className="p-2">
                          <div className="font-bold">{tx.title}</div>
                          <div className="text-[10px] text-slate-600">
                            {tx.duration && <span>{tx.duration} • </span>}
                            {tx.details && <span>{tx.details} </span>}
                            {tx.items_summary && <span>• {tx.items_summary} </span>}
                          </div>
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-emerald-700" dir="ltr">
                          {tx.amount_in > 0 ? `+${formatMoney(tx.amount_in)}` : '-'}
                        </td>
                        <td className="p-2 text-center font-mono font-bold text-rose-700" dir="ltr">
                          {tx.amount_out > 0 ? `-${formatMoney(tx.amount_out)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Footer */}
                <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500 flex justify-between">
                  <span>تم استخراج التقرير آلياً عبر نظام إدارة الصالة</span>
                  <span>توقيع المسؤول / الكاشير: ........................</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

