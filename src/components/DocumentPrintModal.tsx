import React from 'react';
import { Printer, Download, X, FileCheck2, ShieldAlert } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border-2 border-[#0A006E] rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl my-8">
        {/* Top Action Bar (Hidden during print) */}
        <div className="bg-[#0A006E] text-white px-6 py-4 flex items-center justify-between border-b-3 border-[#FFDE00] relative overflow-hidden">
          <div className="silent-scanner-beam" />
          <div className="flex items-center gap-3 relative z-10">
            <FileCheck2 className="w-5 h-5 text-[#FFDE00]" />
            <div>
              <h3 className="text-sm font-montserrat font-black tracking-tight">
                Commercial Document Preview · {docData.docType}
              </h3>
              <p className="text-xs text-[#FFDE00] font-mono-tabular">{docData.docNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative z-10">
            <button
              onClick={() => exportCommercialDocumentPDF(docData)}
              className="px-3.5 py-2 bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-[#34D186] text-[#0A006E] hover:bg-[#28B873] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
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
        <div id="printable-erp-document" className="p-8 bg-white text-slate-900 space-y-6">
          {/* Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="text-xs font-montserrat font-black text-[#0A006E] tracking-wider uppercase">
                VAAIRO — Liquor Distribution & Importer ERP
              </div>
              <h1 className="text-2xl font-montserrat font-black italic text-[#0A006E] mt-1">
                {docData.docType.toUpperCase()}
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Branch: <span className="font-bold text-slate-900">{docData.branchName}</span> · Geo-Zone:{' '}
                <span className="font-bold text-slate-900">{docData.regionName}</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Channel: {docData.channel} · Issued By: {docData.createdBy} ({docData.createdByRole})
              </p>
            </div>

            <div className="sm:text-right font-mono-tabular">
              <div className="text-sm font-bold text-[#0A006E]">{docData.docNumber}</div>
              <div className="text-xs text-slate-600 mt-1">
                Issued: {new Date(docData.createdAt).toLocaleString()}
              </div>
              <div className="text-xs text-slate-800 mt-1 font-bold">
                Status: {docData.status} · {docData.paymentMethod}
              </div>
            </div>
          </div>

          {/* Consignee & Compliance Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F0F2F0] p-4 rounded-xl border border-slate-200">
            <div>
              <div className="text-xs text-slate-500 font-semibold">Customer / Consignee</div>
              <div className="text-sm font-montserrat font-bold text-slate-900 mt-0.5">
                {docData.customerName}
              </div>
              <div className="text-xs text-slate-600 font-mono-tabular mt-1">
                Liquor License / PIN: {docData.customerLicenseNo || 'Walk-in Retail 21+ Verified'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 font-semibold">Regulatory & Dispatch Metadata</div>
              <div className="text-xs text-slate-800 mt-0.5">
                All IPS/LPS spirits & alcoholic beverages carry verified KRA Digital Excise / Import Duty Stamps.
              </div>
              {docData.relatedInvoiceNo && (
                <div className="text-xs font-bold text-amber-800 mt-1">
                  Ref Invoice: {docData.relatedInvoiceNo} · Reason: {docData.creditReason}
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] text-xs font-montserrat">
                  <th className="py-2.5 px-3 font-black">Auto SKU</th>
                  <th className="py-2.5 px-3 font-black">Product Description</th>
                  <th className="py-2.5 px-3 font-black">Pack Mode</th>
                  <th className="py-2.5 px-3 font-black text-right">Qty</th>
                  <th className="py-2.5 px-3 font-black text-right">Total Bottles</th>
                  {isLogisticsOnly ? (
                    <th className="py-2.5 px-3 font-black text-right">Excise Seal Check</th>
                  ) : (
                    <>
                      <th className="py-2.5 px-3 font-black text-right">Geo Unit Price</th>
                      <th className="py-2.5 px-3 font-black text-right">Line Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {item.sku}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.unitMode} ({item.bottlesPerCase}/cs)
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{item.quantityUnits}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{item.totalBottles}</td>
                    {isLogisticsOnly ? (
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#1E9E60] font-bold">
                        VERIFIED SEALED
                      </td>
                    ) : (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono-tabular">
                          {formatKes(item.unitPrice)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900">
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
              <div className="text-xs text-slate-600 max-w-sm flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-[#0A006E] shrink-0 mt-0.5" />
                <span>
                  Prices reflect regional geo-location tariff rules ({docData.regionName}). Sale of alcohol to persons under 21 is strictly prohibited.
                </span>
              </div>
              <div className="w-full sm:w-72 bg-[#F0F2F0] p-4 rounded-xl border border-slate-200 space-y-1.5 font-mono-tabular">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatKes(docData.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Excise & Regional VAT:</span>
                  <span>{formatKes(docData.exciseAndTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-montserrat font-black text-[#0A006E] pt-2 border-t border-slate-300">
                  <span>{docData.docType === 'Credit Note' ? 'Total Credit:' : 'Grand Total:'}</span>
                  <span>{formatKes(docData.totalAmount)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-xs text-slate-700">
              <div>
                <div className="font-montserrat font-bold text-slate-900">
                  Bonded Warehouse Dispatch Officer
                </div>
                <div className="mt-6 border-b border-slate-400 w-48"></div>
                <div className="text-slate-500 mt-1">Signature & Excise Stamp Verification</div>
              </div>
              <div>
                <div className="font-montserrat font-bold text-slate-900">
                  Logistics Driver / Consignee Receiver
                </div>
                <div className="mt-6 border-b border-slate-400 w-48"></div>
                <div className="text-slate-500 mt-1">Received in Good Bonded Condition</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
