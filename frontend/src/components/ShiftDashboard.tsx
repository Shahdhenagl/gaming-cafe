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

  useEffect(() => {
    fetchHistory();
  }, []);

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
