import React from 'react';
import { Printer, CheckCircle2, ShieldCheck, X, Download } from 'lucide-react';
import { formatKes, generateSimpleQrSvg } from '../erpUtils';

export interface EtimsReceiptData {
  invoiceNumber: string;
  invoiceDate: string;
  sellerPin: string;
  cuSerialNumber: string;
  deviceSerialNumber: string;
  kraControlCode: string;
  branchName: string;
  servedByName: string;
  buyerName: string;
  buyerPin?: string;
  paymentMethod: string;
  mpesaReceiptNumber?: string;
  items: {
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
  }[];
  taxableAmount: number;
  taxAmount: number;
  totalInvoiceAmount: number;
  qrCodeUrl: string;
  affiliateProfitAmount?: number;
  affiliateName?: string;
}

interface Props {
  receipt: EtimsReceiptData | null;
  onClose: () => void;
}

export const EtimsReceiptModal: React.FC<Props> = ({ receipt, onClose }) => {
  if (!receipt) return null;

  const qrSvg = generateSimpleQrSvg(receipt.qrCodeUrl, 140);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-y-auto border border-slate-300 animate-in fade-in zoom-in-95 duration-200">
        {/* Receipt Header Banner */}
        <div className="bg-[#0A006E] text-white p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFDE00] flex items-center justify-center text-[#0A006E] font-black text-xs font-montserrat shadow-xs">
              VAT
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm tracking-wide text-[#FFDE00]">
                VAAIRO 16% VAT TAX INVOICE
              </h3>
              <p className="text-[11px] text-slate-300">Official KRA eTIMS Compliant Fiscal Receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 font-mono text-xs space-y-4 bg-slate-50/50 text-slate-900">
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            <h2 className="font-montserrat font-black italic text-base text-slate-900 tracking-tight">
              VAAIRO BEVERAGES &amp; MERCHANTS LTD
            </h2>
            <p className="text-slate-600 text-[11px]">LICENSED ALCOHOL MERCHANT &amp; IMPORTER • VAAIRO POS</p>
            <p className="text-slate-600 text-[11px]">
              TAX PIN: <span className="font-bold text-slate-900">{receipt.sellerPin}</span>
            </p>
            <p className="text-slate-600 text-[11px]">
              VAT REG REF: <span className="font-bold text-slate-900">{receipt.cuSerialNumber}</span>
            </p>
            <p className="text-slate-600 text-[11px]">
              TERMINAL ID: <span className="font-bold">{receipt.deviceSerialNumber}</span> • {receipt.branchName}
            </p>
          </div>

          <div className="space-y-1 text-slate-700 border-b border-dashed border-slate-300 pb-2.5 text-[11px]">
            <div className="flex justify-between">
              <span>INVOICE NUMBER:</span>
              <span className="font-bold text-slate-900">{receipt.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>DATE / TIME:</span>
              <span>{receipt.invoiceDate}</span>
            </div>
            <div className="flex justify-between">
              <span>SERVED BY -</span>
              <span className="font-bold text-[#0A006E]">{receipt.servedByName}</span>
            </div>
            <div className="flex justify-between">
              <span>BUYER PIN:</span>
              <span className="font-bold">{receipt.buyerPin || 'NOT REGISTERED (CASH/RETAIL)'}</span>
            </div>
            <div className="flex justify-between">
              <span>BUYER NAME:</span>
              <span className="truncate max-w-[180px] font-semibold">{receipt.buyerName}</span>
            </div>
            <div className="flex justify-between">
              <span>PAYMENT METHOD:</span>
              <span className="font-bold text-[#1E9E60]">
                {receipt.paymentMethod} {receipt.mpesaReceiptNumber ? `(${receipt.mpesaReceiptNumber})` : ''}
              </span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border-b border-dashed border-slate-300 pb-3">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-[10px]">
                  <th className="pb-1 font-semibold">ITEM DESCRIPTION</th>
                  <th className="pb-1 text-center font-semibold">QTY</th>
                  <th className="pb-1 text-right font-semibold">TOTAL (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipt.items.map((item, idx) => (
                  <tr key={idx} className="text-slate-800">
                    <td className="py-1">
                      <div className="font-medium text-slate-900">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                    </td>
                    <td className="py-1 text-center font-bold">{item.quantity}</td>
                    <td className="py-1 text-right font-bold font-mono">
                      {item.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Enforced 16% VAT & Financials breakdown */}
          <div className="space-y-1.5 text-slate-800 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>TAXABLE AMOUNT (EXCL. 16% VAT):</span>
              <span className="font-mono">{formatKes(receipt.taxableAmount)}</span>
            </div>
            <div className="flex justify-between text-[#1E9E60] font-bold text-[11px]">
              <span>ENFORCED 16% VAT COLLECTED:</span>
              <span className="font-black text-slate-900 font-mono">{formatKes(receipt.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-montserrat font-black text-slate-900 pt-1.5 border-t border-slate-200">
              <span>TOTAL INVOICE (INCL. 16% VAT):</span>
              <span className="text-[#0A006E] font-mono">{formatKes(receipt.totalInvoiceAmount)}</span>
            </div>
          </div>

          {/* Affiliate Markup Attribution if applicable */}
          {receipt.affiliateName && (receipt.affiliateProfitAmount || 0) > 0 && (
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] space-y-1">
              <div className="flex justify-between text-slate-700">
                <span>Sales Representative:</span>
                <span className="font-bold text-[#0A006E]">{receipt.affiliateName}</span>
              </div>
              <div className="flex justify-between text-[#1E9E60] font-bold">
                <span>Rep Markup Commission:</span>
                <span className="font-mono">{formatKes(receipt.affiliateProfitAmount || 0)}</span>
              </div>
            </div>
          )}

          {/* VAT Verification QR Code & Compliance Stamp */}
          <div className="text-center pt-1 space-y-2">
            <div
              className="inline-block p-1 bg-white border border-slate-300 rounded shadow-inner"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-[10px] text-slate-500 font-sans">
              SCAN QR CODE TO VERIFY OFFICIAL VAAIRO 16% VAT TAX INVOICE
            </p>
            <div className="bg-[#34D186]/10 text-[#1E9E60] font-bold p-1.5 rounded flex items-center justify-center space-x-1.5 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-[#1E9E60]" />
              <span>VAT AUDIT CODE: {receipt.kraControlCode}</span>
            </div>
            <div className="flex items-center justify-center space-x-1 text-[10px] text-[#1E9E60]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>16% VAT Status: ENFORCED &amp; COMMITTED (ELECTRONICALLY SIGNED)</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl font-montserrat font-bold text-xs text-slate-700 transition cursor-pointer"
          >
            Close Window
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 px-4 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Fiscal Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
};
