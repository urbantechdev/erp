import React from 'react';
import { Printer, Download, X, FileCheck2, ShieldCheck, Award } from 'lucide-react';
import { TransactionDoc, LineItem } from '../types';
import { exportCommercialDocumentPDF, formatKes } from '../erpUtils';

interface DocumentPrintModalProps {
  docData: TransactionDoc | null;
  onClose: () => void;
}

export const DocumentPrintModal: React.FC<DocumentPrintModalProps> = ({ docData, onClose }) => {
  if (!docData) return null;

  let items: LineItem[] = [];
  try {
    items = JSON.parse(docData.itemsSummary);
  } catch {
    items = [];
  }

  const isLogisticsOnly = docData.docType === 'Packing List' || docData.docType === 'Delivery Note';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white border-0 sm:border-2 border-[#0A006E] rounded-none sm:rounded-2xl max-w-none sm:max-w-3xl w-full h-full sm:h-auto overflow-y-auto shadow-2xl my-0 sm:my-8 flex flex-col">
        {/* Top Action Bar (Hidden during print) */}
        <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b-4 border-[#FFDE00] relative overflow-hidden print:hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A006E] via-indigo-950 to-[#0A006E] opacity-90" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-montserrat font-black uppercase tracking-wider text-[#FFDE00]">
                Official Commercial Document · {docData.docType}
              </h3>
              <p className="text-sm font-mono-tabular font-bold text-white">{docData.docNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={() => exportCommercialDocumentPDF(docData)}
              className="px-4 py-2 bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 transition shadow cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#34D186] text-[#0A006E] hover:bg-emerald-400 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 transition shadow cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Print Document
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Canvas */}
        <div id="printable-erp-document" className="p-8 sm:p-10 bg-white text-slate-900 space-y-6 relative">
          {/* Watermark Stamp */}
          <div className="absolute right-12 top-24 pointer-events-none opacity-10 border-4 border-[#0A006E] rounded-2xl p-4 transform rotate-12 flex items-center gap-2">
            <Award className="w-16 h-16 text-[#0A006E]" />
            <div className="text-right">
              <div className="font-montserrat font-black text-xs uppercase text-[#0A006E]">VAAIRO BONDED</div>
              <div className="font-montserrat font-bold text-[10px] text-slate-700">VERIFIED &amp; AUDITED</div>
            </div>
          </div>

          {/* Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b-2 border-slate-200">
            <div>
              <div className="text-xs font-montserrat font-black text-[#0A006E] tracking-widest uppercase flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D186]" />
                VAAIRO BEVERAGES &amp; MERCHANTS LTD
              </div>
              <h1 className="text-3xl font-montserrat font-black italic text-[#0A006E] mt-1 tracking-tight">
                {docData.docType.toUpperCase()}
              </h1>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Licensed Importer &amp; Regional Distributor · Branch:{' '}
                <span className="font-bold text-slate-900">{docData.branchName}</span> ({docData.regionName})
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Channel: <span className="font-semibold text-slate-800">{docData.channel}</span> · Issued By:{' '}
                <span className="font-semibold text-slate-800">{docData.createdBy} ({docData.createdByRole})</span>
              </p>
            </div>

            <div className="sm:text-right font-mono-tabular bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="text-sm font-black text-[#0A006E]">{docData.docNumber}</div>
              <div className="text-xs text-slate-600 mt-1">
                Issued: {new Date(docData.createdAt).toLocaleString()}
              </div>
              <div className="text-xs text-emerald-700 mt-1 font-bold flex items-center sm:justify-end gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Status: {docData.status} · {docData.paymentMethod}
              </div>
            </div>
          </div>

          {/* Consignee & Compliance Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAFC] p-4 rounded-xl border border-slate-200 text-xs">
            <div>
              <div className="text-[10px] text-[#0A006E] font-montserrat font-black uppercase tracking-wider">
                Consignee / Customer Details
              </div>
              <div className="text-sm font-montserrat font-bold text-slate-900 mt-1">
                {docData.customerName}
              </div>
              <div className="text-xs text-slate-600 font-mono-tabular mt-1">
                Liquor License / PIN: <strong className="text-slate-900">{docData.customerLicenseNo || 'Walk-in Retail 21+ Verified'}</strong>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#1E9E60] font-montserrat font-black uppercase tracking-wider">
                Regulatory &amp; Excise Stamp Metadata
              </div>
              <div className="text-xs text-slate-700 mt-1 leading-relaxed">
                All IPS/LPS spirits &amp; alcoholic beverages carry verified KRA Digital Excise &amp; Import Duty Stamps. Bonded under Kenya Revenue Authority rules.
              </div>
              {docData.relatedInvoiceNo && (
                <div className="text-xs font-bold text-amber-800 mt-1">
                  Ref Invoice: {docData.relatedInvoiceNo} · Reason: {docData.creditReason}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] text-xs font-montserrat">
                  <th className="py-3 px-3 font-black">SKU</th>
                  <th className="py-3 px-3 font-black">Product Description</th>
                  <th className="py-3 px-3 font-black">Pack Mode</th>
                  <th className="py-3 px-3 font-black text-right">Qty</th>
                  <th className="py-3 px-3 font-black text-right">Total Btls</th>
                  {isLogisticsOnly ? (
                    <th className="py-3 px-3 font-black text-right">Excise Stamp Verification</th>
                  ) : (
                    <>
                      <th className="py-3 px-3 font-black text-right">Unit Price (KES)</th>
                      <th className="py-3 px-3 font-black text-right">Line Total (KES)</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {item.sku}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-3 px-3 text-slate-600 font-mono">
                      {item.unitMode} ({item.bottlesPerCase}/cs)
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular font-bold">{item.quantityUnits}</td>
                    <td className="py-3 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">{item.totalBottles}</td>
                    {isLogisticsOnly ? (
                      <td className="py-3 px-3 text-right font-mono-tabular text-[#1E9E60] font-bold">
                        ✓ VERIFIED SEALED
                      </td>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-right font-mono-tabular text-slate-700">
                          {formatKes(item.unitPrice)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono-tabular font-black text-[#0A006E]">
                          {formatKes(item.lineTotal)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals or Dispatch Sign-off */}
          {!isLogisticsOnly ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 pt-2">
              <div className="text-xs text-slate-600 max-w-sm flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <ShieldCheck className="w-4 h-4 text-[#0A006E] shrink-0 mt-0.5" />
                <span>
                  Prices reflect regional geo-location tariff rules ({docData.regionName}). Sale of alcohol to persons under 21 is strictly prohibited by Kenyan law.
                </span>
              </div>
              <div className="w-full sm:w-72 bg-[#F0FDF4] p-4 rounded-xl border-2 border-[#34D186] space-y-1.5 font-mono-tabular">
                <div className="flex justify-between text-xs text-slate-700">
                  <span>Subtotal:</span>
                  <span>{formatKes(docData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-700">
                  <span>Excise &amp; Regional VAT:</span>
                  <span>{formatKes(docData.exciseAndTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-montserrat font-black text-[#0A006E] pt-2 border-t border-emerald-300">
                  <span>{docData.docType === 'Credit Note' ? 'Total Credit:' : 'Grand Total:'}</span>
                  <span>{formatKes(docData.totalAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-xs text-slate-700">
              <div className="space-y-4">
                <div className="font-montserrat font-bold text-slate-900">
                  Bonded Warehouse Dispatch Officer
                </div>
                <div className="border-b-2 border-slate-400 w-56 pb-1 font-mono text-slate-500 text-[10px]">
                  Signature &amp; Excise Seal Check
                </div>
              </div>
              <div className="space-y-4">
                <div className="font-montserrat font-bold text-slate-900">
                  Logistics Driver / Consignee Receiver
                </div>
                <div className="border-b-2 border-slate-400 w-56 pb-1 font-mono text-slate-500 text-[10px]">
                  Received in Good Bonded Condition
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

