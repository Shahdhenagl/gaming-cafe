import React, { useState } from 'react';
import { PlayCircle, X, User, DollarSign, FileText } from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface StartShiftModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onStartShift: (notes: string) => Promise<void>;
}

export const StartShiftModal: React.FC<StartShiftModalProps> = ({
  lang,
  isOpen,
  onClose,
  onStartShift,
}) => {
  const t = translations[lang];
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onStartShift(notes);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
          <div className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              {t.startShift}
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
          <p className="text-xs text-slate-300">
            {lang === 'ar'
              ? 'قم ببدء الوردية لتسجيل ساعات العمل ومبيعات صالات الألعاب والكافيه ومطابقة الدرج.'
              : 'Start your operational shift to begin tracking gaming room timers, POS transactions, and cash register balance.'}
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary-light" />
              <span>{lang === 'ar' ? 'ملاحظات البداية (اختياري)' : 'Opening Shift Notes (Optional)'}</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={lang === 'ar' ? 'مثال: بداية وردية الصباح مع استلام الرصيد...' : 'e.g. Morning shift, float counted'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs focus:outline-none focus:border-primary placeholder-slate-500"
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-neon-green transition disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{loading ? 'Starting...' : t.startShift}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
