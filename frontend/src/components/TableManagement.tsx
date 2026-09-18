import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Clock, 
  Gamepad2, 
  DollarSign, 
  ArrowRightLeft, 
  CheckCircle, 
  Coffee, 
  Sparkles,
  X
} from 'lucide-react';
import { Device, Table } from '../types';
import { Language, translations } from '../i18n/translations';
import { sounds } from '../utils/audio';
import { formatMoney } from '../utils/format';
import { api } from '../services/api';

interface TableManagementProps {
  lang: Language;
  tables: Table[];
  devices: Device[];
  onOccupyTable: (tableId: number) => Promise<void>;
  onMoveTableToGaming: (tableId: number, deviceSessionId: number) => Promise<void>;
  onReleaseTable: (tableId: number, paymentMethod: string) => Promise<void>;
  onRefresh: () => void;
}

export const TableManagement: React.FC<TableManagementProps> = ({
  lang,
  tables,
  devices,
  onOccupyTable,
  onMoveTableToGaming,
  onReleaseTable,
  onRefresh,
}) => {
  const t = translations[lang];

  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [moveModalTable, setMoveModalTable] = useState<Table | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<Record<number, number>>({});
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('4');

  useEffect(() => {
    const sync = () => setElapsedSeconds(Object.fromEntries(tables.filter(t => t.status === 'occupied').map(t => [t.id, t.elapsed_seconds ?? (t.elapsed_minutes ?? 0) * 60])));
    sync();
    const timer = window.setInterval(() => setElapsedSeconds(prev => Object.fromEntries(Object.entries(prev).map(([id, seconds]) => [id, seconds + 1]))), 1000);
    return () => window.clearInterval(timer);
  }, [tables]);

  const formatElapsed = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const h = Math.floor(safe / 3600).toString().padStart(2, '0');
    const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
    const s = (safe % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Active gaming stations
  const activeStations = devices.filter((d) => d.active_session);

  const handleMoveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moveModalTable || !targetSessionId) return;
    setLoading(true);
    try {
      await onMoveTableToGaming(moveModalTable.id, targetSessionId);
      sounds.playWarning10Min();
      setMoveModalTable(null);
      setSelectedTable(null);
      setTargetSessionId(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseSubmit = async (tableId: number, paymentMethod: string = 'cash') => {
    setLoading(true);
    try {
      await onReleaseTable(tableId, paymentMethod);
      sounds.playCashRegister();
      setSelectedTable(null);
      onRefresh();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTableName.trim()) return;
    await api.createTable({ table_number: newTableName.trim(), capacity: Number(newTableCapacity) || 4 });
    setNewTableName('');
    onRefresh();
  };

  const handleDeleteTable = async (table: Table) => {
    if (table.status === 'occupied') return;
    if (!window.confirm(`حذف الطاولة ${table.table_number}؟`)) return;
    await api.deleteTable(table.id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface/60 border border-border/80 p-4 lg:p-6 rounded-2xl">
        <div>
          <h2 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-amber-400" />
            <span>{t.tablesTitle}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t.tablesSubtitle}
          </p>
        </div>

        <form onSubmit={handleCreateTable} className="flex items-center gap-2">
          <input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="اسم الطاولة" className="w-28 rounded-lg bg-card border border-border px-2 py-1.5 text-xs text-white" />
          <input value={newTableCapacity} onChange={e => setNewTableCapacity(e.target.value)} type="number" min="1" max="50" className="w-14 rounded-lg bg-card border border-border px-2 py-1.5 text-xs text-white" />
          <button className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">+ إضافة</button>
        </form>
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-neon-green" />
            <span className="text-slate-300">{t.tableAvailable}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 shadow-neon-amber" />
            <span className="text-slate-300">{t.tableOccupied}</span>
          </div>
        </div>
      </div>

      {/* Tables Floor Plan Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 lg:gap-5">
        {tables.map((table) => {
          const isOccupied = table.status === 'occupied';

          return (
            <div
              key={table.id}
              onClick={() => setSelectedTable(table)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group hover:border-amber-500 hover:shadow-neon-amber ${
                isOccupied
                  ? 'bg-card border-amber-500/60 shadow-neon-amber'
                  : 'bg-card/70 border-border/80 hover:bg-card'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{table.capacity} {t.guests}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      isOccupied
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {isOccupied ? t.tableOccupied : t.tableAvailable}
                  </span>
                </div>

                <div className="text-center py-2">
                  <span className="text-2xl lg:text-3xl font-black text-white group-hover:text-amber-300 transition font-mono">
                    {table.table_number}
                  </span>
                  {isOccupied && (
                    <div className="flex items-center justify-center gap-1 text-[11px] text-slate-400 mt-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span className="font-mono text-amber-300">{formatElapsed(elapsedSeconds[table.id] ?? 0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Card Info */}
              <div className="pt-3 border-t border-border/60 mt-2 flex items-center justify-between text-xs">
                {isOccupied && table.order ? (
                  <>
                    <span className="text-slate-400 font-medium">
                      {table.order.items_count} items
                    </span>
                    <span className="font-bold text-amber-400 font-mono" dir="ltr">
                      {formatMoney(table.total_spent)} {t.currency}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500 text-[11px] italic mx-auto">
                    Click to occupy / view
                  </span>
                )}
                {!isOccupied && <button type="button" onClick={(event) => { event.stopPropagation(); handleDeleteTable(table); }} className="text-[10px] text-rose-300 hover:text-rose-200">حذف</button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* --- TABLE DETAILS MODAL --- */}
      {selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">
                  Table {selectedTable.table_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedTable(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-border">
                <span className="text-slate-400">Capacity:</span>
                <span className="font-bold text-white">{selectedTable.capacity} Persons</span>
                <span className="text-slate-400">Status:</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedTable.status === 'occupied'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {selectedTable.status}
                </span>
              </div>

              {selectedTable.status === 'occupied' && selectedTable.order ? (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Current Order Tab (#{selectedTable.order.order_number})
                  </h4>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-border/40">
                    {selectedTable.order.items.map((it) => (
                      <div key={it.id} className="pt-1.5 flex justify-between text-xs">
                        <span className="text-slate-200">
                          {it.quantity}x {lang === 'ar' ? it.name_ar : it.name}
                        </span>
                        <span className="font-mono text-amber-400 font-bold" dir="ltr">
                          {formatMoney(it.subtotal)} {t.currency}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border flex justify-between text-sm font-black text-white">
                    <span>{t.total}:</span>
                    <span className="font-mono text-emerald-400" dir="ltr">
                      {formatMoney(selectedTable.total_spent)} {t.currency}
                    </span>
                  </div>

                  {/* Move to Gaming Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setMoveModalTable(selectedTable);
                      }}
                      className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-neon-purple transition flex items-center justify-center gap-2"
                    >
                      <Gamepad2 className="w-4 h-4" />
                      <span>{t.moveToGaming}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-400">
                    Table is currently unoccupied.
                  </p>
                  <button
                    onClick={async () => {
                      await onOccupyTable(selectedTable.id);
                      setSelectedTable(null);
                      onRefresh();
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-neon-amber transition"
                  >
                    {t.occupyTable}
                  </button>
                </div>
              )}

              {/* Actions Footer */}
              {selectedTable.status === 'occupied' && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button
                    onClick={() => setSelectedTable(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300"
                  >
                    {t.close}
                  </button>
                  <button
                    onClick={() => handleReleaseSubmit(selectedTable.id, 'cash')}
                    disabled={loading}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-neon-green transition disabled:opacity-50"
                  >
                    {t.releaseTable}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MOVE TO GAMING STATION MODAL --- */}
      {moveModalTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">
                  {t.moveToGaming} (Table {moveModalTable.table_number})
                </h3>
              </div>
              <button
                onClick={() => setMoveModalTable(null)}
                className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMoveSubmit} className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                {t.transferBillNotice}
              </p>

              <div className="p-3 rounded-xl bg-surface border border-border text-xs flex justify-between items-center">
                <span className="text-slate-400">Current Table Bill:</span>
                <span className="font-mono font-bold text-amber-400 text-sm" dir="ltr">
                  {formatMoney(moveModalTable.total_spent)} {t.currency}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.selectDestinationSession}
                </label>
                {activeStations.length === 0 ? (
                  <p className="text-xs text-rose-400 py-2">
                    No active gaming sessions running right now. Please start a gaming session first.
                  </p>
                ) : (
                  <select
                    required
                    value={targetSessionId || ''}
                    onChange={(e) => setTargetSessionId(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">-- Choose Gamer / Station --</option>
                    {activeStations.map((st) => (
                      <option key={st.active_session!.id} value={st.active_session!.id}>
                        {st.device_name} ({st.active_session!.customer_name}) - Current Tab: {formatMoney(st.active_session?.total_amount)} {t.currency}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setMoveModalTable(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-surface border border-border text-slate-300"
                >
                  {t.close}
                </button>
                <button
                  type="submit"
                  disabled={loading || !targetSessionId}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-neon-purple transition disabled:opacity-50"
                >
                  {loading ? 'Transferring...' : 'Transfer & Free Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
