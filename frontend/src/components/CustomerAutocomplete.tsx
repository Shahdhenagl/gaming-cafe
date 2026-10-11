import React, { useEffect, useRef, useState } from 'react';
import { Check, Loader2, Search, UserRound, X } from 'lucide-react';
import { api } from '../services/api';

export interface CustomerSuggestion {
  id: number;
  name: string;
  phone: string;
  total_debt?: number;
  remaining_debt?: number;
}

interface CustomerAutocompleteProps {
  name: string;
  phone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  phoneRequired?: boolean;
  namePlaceholder?: string;
  phonePlaceholder?: string;
  compact?: boolean;
}

export const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  name,
  phone,
  onNameChange,
  onPhoneChange,
  phoneRequired = true,
  namePlaceholder = 'اسم العميل',
  phonePlaceholder = 'رقم الهاتف',
  compact = false,
}) => {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSuggestion | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const query = name.trim();
    if (query.length < 2 || selectedCustomer?.name === query) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.getCustomerDebts({ search: query, tab: 'all' });
        if (currentRequest !== requestId.current) return;
        setSuggestions((response.customers || []).slice(0, 8));
        setShowSuggestions(true);
      } catch {
        if (currentRequest === requestId.current) setSuggestions([]);
      } finally {
        if (currentRequest === requestId.current) setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [name, selectedCustomer]);

  const handleNameChange = (value: string) => {
    if (selectedCustomer && value !== selectedCustomer.name) {
      setSelectedCustomer(null);
      onPhoneChange('');
    }
    onNameChange(value);
    setShowSuggestions(value.trim().length >= 2);
  };

  const selectCustomer = (customer: CustomerSuggestion) => {
    setSelectedCustomer(customer);
    onNameChange(customer.name);
    onPhoneChange(customer.phone || '');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    onNameChange('');
    onPhoneChange('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const inputClass = compact
    ? 'w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-white text-xs placeholder-slate-500 focus:outline-none focus:border-primary'
    : 'w-full px-3 py-2 rounded-xl bg-surface border border-border text-white text-sm placeholder-slate-500 focus:outline-none focus:border-amber-500';

  return (
    <div ref={rootRef} className="space-y-2">
      <div className="relative">
        <UserRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
        <input
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          required
          placeholder={namePlaceholder}
          className={`${inputClass} pr-9 ${selectedCustomer ? 'border-emerald-500/70' : ''}`}
          autoComplete="off"
        />
        {selectedCustomer ? (
          <button type="button" onClick={clearCustomer} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white" aria-label="مسح العميل">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : searching ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 animate-spin" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        )}

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <p className="px-3 py-2 text-[10px] font-bold text-slate-400 border-b border-border">عملاء مسجلون — اختر العميل</p>
            {suggestions.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => selectCustomer(customer)}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-right hover:bg-surface transition border-b last:border-b-0 border-border/60"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-white truncate">{customer.name}</span>
                  <span className="block text-[11px] text-slate-400 font-mono" dir="ltr">{customer.phone || 'بدون رقم'}</span>
                </span>
                {customer.remaining_debt !== undefined && (
                  <span className="shrink-0 text-[10px] text-amber-300 font-mono" dir="ltr">متبقي {Number(customer.remaining_debt).toFixed(2)}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <input
          value={phone}
          onChange={(event) => {
            setSelectedCustomer(null);
            onPhoneChange(event.target.value);
          }}
          required={phoneRequired}
          placeholder={phonePlaceholder}
          className={inputClass}
          dir="ltr"
          autoComplete="tel"
        />
        {selectedCustomer && <Check className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />}
      </div>
      {selectedCustomer && <p className="text-[10px] text-emerald-300">تم اختيار العميل المسجل، وسيتم إضافة الدين إلى نفس حسابه.</p>}
    </div>
  );
};
