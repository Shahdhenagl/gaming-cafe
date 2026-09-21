import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Language, translations } from '../i18n/translations';

interface LoginModalProps {
  lang: Language;
  isOpen: boolean;
  onClose: () => void;
  onLogin: (credentials: { email?: string; password?: string; pin?: string }) => Promise<void>;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  lang,
  isOpen,
  onClose,
  onLogin,
}) => {
  const t = translations[lang];

  const [mode, setMode] = useState<'pin' | 'email'>('pin');
  const [pin, setPin] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleKeypadPress = (val: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + val);
    }
  };

  const handleDeletePin = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClearPin = () => {
    setPin('');
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) return;
    setLoading(true);
    setError(null);
    try {
      await onLogin({ pin });
      onClose();
      setPin('');
    } catch (err: any) {
      const msg = err?.message || 'رمز PIN غير صحيح';
      if (msg.includes('Server Error') || msg.includes('500') || msg.includes('HTTP Error')) {
        setError('تعذر الاتصال بالخادم. يمكنك استخدام أحد رموز الـ PIN التجريبية: 0000 (كاشير)، 5678 (مدير)، 1234 (أدمن)');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onLogin({ email, password });
      onClose();
      setEmail('');
      setPassword('');
    } catch (err: any) {
      const msg = err?.message || 'بيانات الدخول غير صحيحة';
      if (msg.includes('Server Error') || msg.includes('500') || msg.includes('HTTP Error')) {
        setError('تعذر الاتصال بالخادم. يمكنك استخدام Staff Quick PIN برمز 0000 للدخول السريع');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-purple-500/40 shrink-0">
              <img src="/al5al-banner.png" alt="AL5AL" className="w-full h-full object-cover object-top" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white font-display flex items-center gap-1">
                AL<span className="text-amber-400">5</span>AL <span className="text-xs font-normal text-slate-400 font-sans">• {mode === 'pin' ? 'Quick PIN' : 'Login'}</span>
              </h3>
              <p className="text-[10px] text-amber-300 font-semibold">★ Enjoy The Game ★</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-2 bg-surface/50 border-b border-border gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('pin');
              setError(null);
            }}
            className={`py-1.5 rounded-lg transition ${
              mode === 'pin' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Staff Quick PIN
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('email');
              setError(null);
            }}
            className={`py-1.5 rounded-lg transition ${
              mode === 'email' ? 'bg-primary text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Email & Password
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs text-center">
            {error}
          </div>
        )}

        {mode === 'pin' ? (
          <div className="p-6 space-y-4">
            {/* PIN display dots */}
            <div className="flex justify-center items-center gap-3 py-2">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    idx < pin.length
                      ? 'bg-purple-500 border-purple-400 shadow-neon-purple scale-110'
                      : 'border-slate-600 bg-surface'
                  }`}
                />
              ))}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Quick demo PINs: <strong className="text-purple-300">0000</strong> (Staff),{' '}
              <strong className="text-amber-300">5678</strong> (Manager),{' '}
              <strong className="text-emerald-300">1234</strong> (Admin)
            </p>

            {/* Keypad Grid */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="w-16 h-14 rounded-2xl bg-surface border border-border hover:border-primary hover:bg-card text-white font-mono font-bold text-xl transition active:scale-95 flex items-center justify-center shadow-sm"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearPin}
                className="w-16 h-14 rounded-2xl bg-surface border border-border text-slate-400 text-xs font-semibold hover:text-white transition flex items-center justify-center"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="w-16 h-14 rounded-2xl bg-surface border border-border hover:border-primary hover:bg-card text-white font-mono font-bold text-xl transition active:scale-95 flex items-center justify-center shadow-sm"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDeletePin}
                className="w-16 h-14 rounded-2xl bg-surface border border-border text-slate-400 hover:text-white transition flex items-center justify-center"
              >
                ⌫
              </button>
            </div>

            <button
              type="button"
              disabled={pin.length < 4 || loading}
              onClick={handlePinSubmit}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-neon-purple transition disabled:opacity-40"
            >
              {loading ? 'Verifying PIN...' : 'Unlock Register'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@gamingcafe.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-neon-purple transition disabled:opacity-40"
            >
              {loading ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
