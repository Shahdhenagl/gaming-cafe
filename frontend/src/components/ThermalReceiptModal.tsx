import React from 'react';
import { Printer, X, Check, Copy } from 'lucide-react';
import { ThermalReceipt } from '../types';
import { Language, translations } from '../i18n/translations';
import { formatMoney, safeNum } from '../utils/format';

interface ThermalReceiptModalProps {
  lang: Language;
  receipt: ThermalReceipt | null;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  lang,
  receipt,
  onClose,
}) => {
  const t = translations[lang];

  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface/80">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold text-white">
              {t.receiptTitle}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-card text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thermal Paper Container */}
        <div className="overflow-y-auto p-6 flex justify-center bg-slate-950/60">
          <div 
            id="thermal-receipt"
            className="w-[300px] bg-white text-black p-5 font-mono text-xs shadow-lg rounded-sm selection:bg-slate-300 selection:text-black leading-tight border-t-8 border-purple-600"
          >
            {/* Header */}
            <div className="text-center pb-3 border-b border-dashed border-gray-400">
              <div className="text-xl font-black tracking-wider uppercase font-mono">
                ★ AL5AL LOUNGE ★
              </div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">
                صالة الخال للألعاب والبلياردو والكافيه
              </div>
              <div className="text-[10px] font-semibold text-gray-700 mt-1">
                بلياردو • بلايستيشن • بينج بونج • مشروبات
              </div>
              <div className="text-[9px] font-bold text-gray-600 italic mt-0.5">
                ★ Enjoy The Game ★ استمتع بأفضل تجربة لعب وتحدي
              </div>
              <div className="text-[9px] text-gray-600 mt-1 pt-1 border-t border-dotted border-gray-300">
                <span>كريم: 01032890430</span> • <span>الغريب: 01289535503</span>
              </div>
              <div className="text-[9px] text-gray-600">
                هاتف أرضي: 0502943796
              </div>
            </div>

            {/* Metadata */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold">Order #:</span>
                <span className="font-bold">{receipt.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Date & Time:</span>
                <span>{receipt.date_time}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier / Staff:</span>
                <span>{receipt.staff_name}</span>
              </div>
              <div className="flex justify-between">
                <span>Destination:</span>
                <span className="font-bold uppercase">
                  {receipt.table_number ? `Table ${receipt.table_number}` : (receipt.device_name || receipt.order_type)}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-gray-400">
              <div className="flex justify-between font-bold pb-1 border-b border-gray-300 text-[10px] uppercase">
                <span>Item</span>
                <span>Qty x Price</span>
                <span>Total</span>
              </div>
              <div className="divide-y divide-gray-100 py-1 space-y-1">
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="pt-1">
                    <div className="font-bold text-[11px]">{item.name}</div>
                    {item.name_ar && <div className="text-[9px] text-gray-600">{item.name_ar}</div>}
                    <div className="flex justify-between text-[10px] text-gray-600 font-mono">
                      <span>{item.quantity} x {formatMoney(item.unit_price)}</span>
                      <span className="font-bold text-black">{formatMoney(item.subtotal)} {t.currency}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatMoney(receipt.subtotal)} {t.currency}</span>
              </div>
              {safeNum(receipt.discount) > 0 && (
                <div className="flex justify-between text-red-600 font-bold">
                  <span>Discount:</span>
                  <span>-{formatMoney(receipt.discount)} {t.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 text-[10px]">
                <span>VAT (Included 15%):</span>
                <span>{formatMoney((safeNum(receipt.total_amount) * 14) / 114)} {t.currency}</span>
              </div>
              <div className="flex justify-between text-base font-black pt-1 border-t border-gray-400 font-mono">
                <span>TOTAL:</span>
                <span>{formatMoney(receipt.total_amount)} {t.currency}</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>Payment:</span>
                <span className="uppercase font-bold">{receipt.payment_method} ({receipt.payment_status})</span>
              </div>
            </div>

            {/* Barcode representation */}
            <div className="py-3 text-center">
              <div className="inline-block tracking-[6px] font-black text-xs py-1 border-y border-black font-mono">
                |||||| | |||| ||| |||| | ||||
              </div>
              <div className="text-[9px] tracking-widest mt-0.5 text-gray-600 font-mono">
                {receipt.order_number}
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-gray-600 space-y-0.5 pt-1">
              <p className="font-bold text-black">★ Enjoy The Game ★</p>
              <p>استمتع بأفضل تجربة لعب وتحدي في صالة الخال</p>
              <p className="text-[8px] text-gray-400 pt-1">Powered by AL5AL Gaming & Lounge POS</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-surface/90">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-card border border-border hover:bg-surface text-slate-300 transition"
          >
            {t.close}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary-hover text-white shadow-neon-purple transition"
          >
            <Printer className="w-4 h-4" />
            <span>{t.printThermal}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
