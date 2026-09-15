import React, { useState } from 'react';
import { CheckCircle2, X, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { Shift, ShiftMetrics } from '../types';
import { Language, translations } from '../i18n/translations';
import { formatMoney } from '../utils/format';

interface EndShiftModalProps {
  lang: Language;
  isOpen: boolean;
  shift: Shift | null;
  metrics: ShiftMetrics | null;
  onClose: () => void;
  onEndShift: (data: { cash_counted: number; deductions: number; notes: string }) => Promise<void>;
}

export const EndShiftModal: React.FC<EndShiftModalProps> = ({
  lang,
  isOpen,
  shift,
  metrics,
  onClose,
  onEndShift,
}) => {
  const t = translations[lang];
  const [cashCounted, setCashCounted] = useState<string>(metrics?.cash_collected?.toString() || '0');
  const [deductions, setDeductions] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen || !shift) return null;

  const expectedCash = metrics?.cash_collected || 0;
  const counted = parseFloat(cashCounted) || 0;
  const discrepancy = counted - expectedCash;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onEndShift({
        cash_counted: counted,
        deductions: parseFloat(deductions) || 0,
        notes,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              {t.confirmCloseShift}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Shift Financial Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-surface border border-border text-center">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                {t.grossRevenue}
              </span>
              <span className="text-sm font-bold text-emerald-400 font-mono" dir="ltr">
                {formatMoney(metrics?.total_revenue)} {t.currency}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border text-center">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                {t.cashInDrawer}
              </span>
              <span className="text-sm font-bold text-amber-300 font-mono" dir="ltr">
                {formatMoney(expectedCash)} {t.currency}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-surface border border-border text-center">
              <span className="text-[10px] uppercase text-slate-400 font-bold block">
                {t.cardSales}
              </span>
              <span className="text-sm font-bold text-cyan-400 font-mono" dir="ltr">
                {formatMoney(metrics?.card_collected)} {t.currency}
              </span>
            </div>
          </div>

          {/* Cash Register Declaration */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>{t.countedCash} ({t.currency})</span>
              </span>
              <span className={`text-xs font-mono font-bold ${discrepancy === 0 ? 'text-emerald-400' : discrepancy < 0 ? 'text-rose-400' : 'text-cyan-400'}`} dir="ltr">
                {discrepancy === 0 ? 'Exact Match' : `${discrepancy > 0 ? '+' : ''}${formatMoney(discrepancy)} diff`}
              </span>
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={cashCounted}
              onChange={(e) => setCashCounted(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-sm font-mono font-bold focus:outline-none focus:border-primary"
            />
          </div>

          {/* Deductions */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-rose-400" />
              <span>{t.shiftDeductions} ({t.currency})</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary-light" />
              <span>{t.shiftNotes}</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash handed over to next manager, float preserved in safe."
              className="w-full px-3.5 py-2 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-primary placeholder-slate-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border hover:bg-card text-slate-300 transition"
            >
              {t.close}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow-neon-amber transition disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Closing...' : t.confirmCloseShift}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
