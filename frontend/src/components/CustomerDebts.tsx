import React, { useEffect, useState } from 'react';
import { CreditCard, Search, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { formatMoney } from '../utils/format';

export const CustomerDebts: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const load = async () => { const res = await api.getCustomerDebts(search); setCustomers(res.customers || []); };
  useEffect(() => { void load(); }, []);
  const pay = async () => {
    if (!selected || !Number(amount) || Number(amount) <= 0) return;
    setLoading(true);
    try { await api.payCustomerDebt(selected.debt.id, { amount: Number(amount), payment_method: method }); setSelected(null); setAmount(''); await load(); }
    finally { setLoading(false); }
  };
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h2 className="text-xl font-black text-white">آجل العملاء</h2><p className="text-sm text-slate-400">متابعة الأرصدة وتسجيل السداد</p></div><div className="flex gap-2"><input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && void load()} placeholder="بحث بالاسم أو الهاتف" className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-white" /><button onClick={() => void load()} className="rounded-xl bg-primary px-3 text-white"><Search className="w-4 h-4" /></button></div></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{customers.map(c => <div key={c.id} className="rounded-2xl border border-border bg-card p-4"><div className="flex justify-between"><div><h3 className="font-bold text-white">{c.name}</h3><p className="text-xs text-slate-400" dir="ltr">{c.phone}</p></div><CreditCard className="text-amber-300" /></div><div className="mt-4 flex justify-between text-sm"><span className="text-slate-400">المتبقي</span><b className="text-rose-300" dir="ltr">{formatMoney(c.remaining_debt)} جنيه</b></div><div className="mt-3 space-y-2">{(c.debts || []).filter((d: any) => Number(d.remaining_amount) > 0).map((d: any) => <div key={d.id} className="flex items-center justify-between rounded-xl bg-surface p-2 text-xs"><span className="text-slate-300">{d.description}</span><button onClick={() => { setSelected({ customer: c, debt: d }); setAmount(String(d.remaining_amount)); }} className="rounded-lg bg-emerald-600 px-2 py-1 font-bold text-white">سداد</button></div>)}</div></div>)}</div>
    {customers.length === 0 && <div className="py-16 text-center text-slate-500">لا توجد أرصدة آجلة</div>}
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 space-y-4"><h3 className="text-lg font-bold text-white">سداد من {selected.customer.name}</h3><input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full rounded-xl bg-surface border border-border p-3 text-white" /><select value={method} onChange={e => setMethod(e.target.value)} className="w-full rounded-xl bg-surface border border-border p-3 text-white"><option value="cash">نقدي</option><option value="visa">فيزا</option><option value="wallet">محفظة</option><option value="instapay">InstaPay</option></select><div className="flex justify-end gap-2"><button onClick={() => setSelected(null)} className="rounded-xl bg-surface px-4 py-2 text-slate-300">إلغاء</button><button disabled={loading} onClick={() => void pay()} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white"><Wallet className="inline w-4 h-4 ml-1" /> تسجيل السداد</button></div></div></div>}
  </div>;
};
