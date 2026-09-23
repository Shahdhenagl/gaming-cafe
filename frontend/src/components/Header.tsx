import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Coffee, 
  Clock, 
  Bell, 
  Globe, 
  DollarSign, 
  User as UserIcon, 
  LogOut, 
  PlayCircle, 
  CheckCircle2, 
  AlertTriangle,
  Volume2,
  X,
  Sun,
  Moon
} from 'lucide-react';
import { Shift, ShiftMetrics, User, NotificationItem } from '../types';
import { Language, translations } from '../i18n/translations';
import { sounds } from '../utils/audio';
import { formatMoney } from '../utils/format';

interface HeaderProps {
  lang: Language;
  onToggleLang: () => void;
  isLightMode: boolean;
  onToggleTheme: () => void;
  user: User | null;
  shift: Shift | null;
  metrics: ShiftMetrics | null;
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  onMarkNotificationRead: (id: number) => void;
  onMarkAllNotificationsRead: () => void;
  onOpenStartShift: () => void;
  onOpenEndShift: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onEnableNotifications: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onToggleLang,
  isLightMode,
  onToggleTheme,
  user,
  shift,
  metrics,
  notifications,
  unreadNotificationsCount,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenStartShift,
  onOpenEndShift,
  onOpenLogin,
  onLogout,
  onEnableNotifications,
}) => {
  const t = translations[lang];
  const [currentTime, setCurrentTime] = useState<string>('');
  const [shiftElapsedSeconds, setShiftElapsedSeconds] = useState(0);
  const [showNotifMenu, setShowNotifMenu] = useState<boolean>(false);
  const [showUserMenu, setShowUserMenu] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [lang]);

  useEffect(() => {
    const updateShiftElapsed = () => {
      if (!shift || shift.status !== 'active') {
        setShiftElapsedSeconds(0);
        return;
      }
      setShiftElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(shift.start_time).getTime()) / 1000)));
    };
    updateShiftElapsed();
    const timer = window.setInterval(updateShiftElapsed, 1000);
    return () => window.clearInterval(timer);
  }, [shift?.id, shift?.status, shift?.start_time]);

  const shiftHours = Math.floor(shiftElapsedSeconds / 3600);
  const shiftMinutes = Math.floor((shiftElapsedSeconds % 3600) / 60);
  const shiftSeconds = shiftElapsedSeconds % 60;
  const shiftElapsedFormatted = `${String(shiftHours).padStart(2, '0')}:${String(shiftMinutes).padStart(2, '0')}:${String(shiftSeconds).padStart(2, '0')}`;

  return (
    <header className="sticky top-0 z-40 bg-[#0c1022]/95 backdrop-blur-md border-b border-border/80 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 transition-colors">
      <div className="flex items-center justify-between gap-2 sm:gap-4 min-w-0">
        {/* Brand & Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950 border border-purple-500/40 shadow-neon-purple overflow-hidden shrink-0 group">
            <img
              src="/al5al-banner.png"
              alt="AL5AL Lounge"
              className="w-full h-full object-cover object-top opacity-90 group-hover:scale-110 transition duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-1.5 font-display">
                <span className="tracking-wider text-white">
                  AL<span className="text-amber-400 font-extrabold drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">5</span>AL
                </span>
                <span className="text-slate-300 font-semibold text-xs md:text-sm hidden sm:inline px-2 py-0.5 rounded-lg bg-surface/80 border border-border/80">
                  {lang === 'ar' ? 'صالة الخال' : 'Gaming & Lounge'}
                </span>
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 hidden md:inline animate-pulse">
                ★ ENJOY THE GAME ★
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden lg:flex items-center gap-2 mt-0.5">
              <span>{t.appTagline}</span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-300 font-mono text-[10px]">📞 01032890430 / 01289535503</span>
            </p>
          </div>
        </div>

        {/* Center: Shift & Live Counter Widget */}
        <div className="hidden md:flex items-center gap-4 bg-surface/80 border border-border px-4 py-1.5 rounded-xl text-sm">
          {shift && shift.status === 'active' ? (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-slate-300 font-medium">
                  {t.currentShift}:
                </span>
                <span className="font-mono font-bold text-emerald-400" dir="ltr">
                  {shiftElapsedFormatted}
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-purple-400" />
                <span className="text-slate-400 text-xs">{t.shiftRevenue}:</span>
                <span className="font-bold text-white font-mono" dir="ltr">
                  {formatMoney(metrics?.total_revenue)} {t.currency}
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40">
                <span className="text-xs text-emerald-400 font-bold">{lang === 'ar' ? 'الخزينة (الكاش):' : 'Drawer Cash:'}</span>
                <span className="font-mono font-black text-emerald-300" dir="ltr">
                  {formatMoney(metrics?.cash_in_drawer ?? metrics?.cash_collected)} {t.currency}
                </span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-400">{t.activeDevices}:</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary-light border border-primary/30">
                  {metrics?.active_sessions_count ?? 0}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-400">{t.noActiveShift}</span>
              <button
                onClick={onOpenStartShift}
                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
              >
                {t.startShift}
              </button>
            </div>
          )}
        </div>

        {/* Right Section: Time, Notifs, Audio Test, Language, Profile */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Live Clock */}
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-300 bg-surface/50 border border-border px-3 py-1.5 rounded-lg font-mono">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>{currentTime}</span>
          </div>

          {/* Browser notifications */}
          <button
            onClick={onToggleTheme}
            title={isLightMode ? 'Switch to dark mode' : 'التبديل للوضع الفاتح'}
            aria-label={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
            className="p-2 rounded-lg bg-surface border border-border hover:border-primary text-slate-300 hover:text-white transition"
          >
            {isLightMode ? <Moon className="w-4 h-4 text-indigo-600" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>
          {/* Browser notifications */}
          <button
            onClick={onEnableNotifications}
            title={lang === 'ar' ? 'تفعيل إشعارات انتهاء الجلسات' : 'Enable session-end notifications'}
            className="p-2 rounded-lg bg-surface border border-border hover:border-primary text-slate-300 hover:text-white transition"
          >
            <Bell className="w-4 h-4 text-cyan-400" />
          </button>
          {/* Audio Test Chime */}
          <button
            onClick={() => sounds.playWarning10Min()}
            title="Test Audio Alert"
            className="p-2 rounded-lg bg-surface border border-border hover:border-primary text-slate-300 hover:text-white transition"
          >
            <Volume2 className="w-4 h-4 text-slate-400" />
          </button>

          {/* Language Switcher */}
          <button
            onClick={onToggleLang}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-border hover:border-primary text-slate-200 hover:text-white transition"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{lang === 'en' ? 'عربي' : 'English'}</span>
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifMenu(!showNotifMenu)}
              className="relative p-2 rounded-lg bg-surface border border-border hover:border-primary text-slate-300 hover:text-white transition"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-neon-rose">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {showNotifMenu && (
              <div 
                className={`absolute top-full mt-2 w-80 md:w-96 rounded-xl bg-card border border-border shadow-2xl p-3 z-50 animate-in fade-in-50 duration-150 ${
                  lang === 'ar' ? 'left-0' : 'right-0'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/80 mb-2">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-sm text-white">
                      {t.notifications}
                    </span>
                  </div>
                  {unreadNotificationsCount > 0 && (
                    <button
                      onClick={onMarkAllNotificationsRead}
                      className="text-xs text-primary-light hover:underline"
                    >
                      {t.markAllRead}
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <p className="text-center py-6 text-xs text-slate-400">
                      {t.noNotifications}
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => onMarkNotificationRead(n.id)}
                        className={`p-2.5 rounded-lg border text-xs transition cursor-pointer ${
                          n.is_read
                            ? 'bg-surface/40 border-border/60 text-slate-400'
                            : 'bg-primary/10 border-primary/40 text-slate-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-200">
                            {n.title}
                          </span>
                          {!n.is_read && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="mt-1 text-slate-300 text-[11px]">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 md:px-3 rounded-lg bg-surface border border-border hover:border-primary transition"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover border border-purple-500/50"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-primary-light">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="hidden md:block text-left text-xs">
                <p className="font-semibold text-white leading-tight">
                  {user ? user.name : 'Guest Cashier'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {user?.role === 'super_admin' ? (lang === 'ar' ? 'سوبر مدير' : 'Super Admin') :
                   user?.role === 'admin' ? (lang === 'ar' ? 'مدير عام' : 'Admin') :
                   user?.role === 'manager' ? (lang === 'ar' ? 'مدير صالة' : 'Manager') :
                   (lang === 'ar' ? 'كاشير' : 'Staff')}
                </p>
              </div>
            </button>

            {showUserMenu && (
              <div 
                className={`absolute top-full mt-2 w-56 rounded-xl bg-card border border-border shadow-2xl p-2 z-50 ${
                  lang === 'ar' ? 'left-0' : 'right-0'
                }`}
              >
                <div className="px-3 py-2 border-b border-border/60 mb-1">
                  <p className="font-semibold text-sm text-white">{user?.name || 'Staff'}</p>
                  <p className="text-xs text-slate-400">{user?.email || 'staff@gamingcafe.com'}</p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                    user?.role === 'super_admin'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : user?.role === 'admin'
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      : 'bg-primary/20 text-cyan-300 border-primary/30'
                  }`}>
                    {user?.role === 'super_admin' ? (lang === 'ar' ? 'سوبر مدير' : 'Super Admin') :
                     user?.role === 'admin' ? (lang === 'ar' ? 'مدير عام' : 'Admin') :
                     user?.role === 'manager' ? (lang === 'ar' ? 'مدير صالة' : 'Manager') :
                     (lang === 'ar' ? 'كاشير / موظف' : 'Staff')}
                  </span>
                </div>

                {shift?.status === 'active' ? (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenEndShift();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 rounded-lg transition"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t.endShift}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenStartShift();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{t.startShift}</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    onOpenLogin();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-surface rounded-lg transition"
                >
                  <UserIcon className="w-4 h-4" />
                  <span>Switch Account / PIN</span>
                </button>

                {user && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-lg transition border-t border-border/60 mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
