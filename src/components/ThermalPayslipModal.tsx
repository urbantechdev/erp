import React, { useRef } from 'react';
import { Printer, Download, X, CheckCircle2, ShieldCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PayrollRecord } from '../types';

export interface ThermalPayslipModalProps {
  record: PayrollRecord;
  onClose: () => void;
}

export const ThermalPayslipModal: React.FC<ThermalPayslipModalProps> = ({ record, onClose }) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  const parsedDeductionRows = React.useMemo(() => {
    if (Array.isArray(record.deductionItems) && record.deductionItems.length > 0) {
      return record.deductionItems.map((it) => ({
        label: it.referenceNote ? `${it.name} (${it.referenceNote})` : it.name,
        amountFormatted: `KES ${Math.round(it.amountKes).toLocaleString()}`,
        category: it.category,
      }));
    }
    if (record.deductionsBreakdown) {
      return record.deductionsBreakdown
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((p) => {
          const colonIdx = p.indexOf(':');
          if (colonIdx === -1) {
            return { label: p, amountFormatted: '', category: 'Statutory' };
          }
          return {
            label: p.slice(0, colonIdx).trim(),
            amountFormatted: p.slice(colonIdx + 1).trim(),
            category: 'Statutory',
          };
        });
    }
    return [
      {
        label: 'PAYE / SHIF / NSSF / Housing',
        amountFormatted: `KES ${record.deductions.toLocaleString()}`,
        category: 'Statutory',
      },
    ];
  }, [record.deductionItems, record.deductionsBreakdown, record.deductions]);

  const handleDownloadPDF = () => {
    // Generate an authentic 80mm roll width thermal PDF with dynamic height for itemized deductions
    const dynamicHeightMm = Math.max(210, 175 + parsedDeductionRows.length * 4.5);
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, dynamicHeightMm],
    });

    let y = 8;
    const left = 5;
    const right = 75;

    // Header
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('VAAIRO SPIRITS & BEVERAGES', 40, y, { align: 'center' });
    y += 4;
    doc.setFontSize(8);
    doc.setFont('courier', 'normal');
    doc.text('VAAIRO BONDED DISTRIBUTORS LTD', 40, y, { align: 'center' });
    y += 3.5;
    doc.text('NAIROBI HQ · INDUSTRIAL AREA', 40, y, { align: 'center' });
    y += 3.5;
    doc.text('KRA PIN: P051928471Z · TEL: +254 700 000000', 40, y, { align: 'center' });
    y += 4;

    // Divider
    doc.text('----------------------------------------', 40, y, { align: 'center' });
    y += 4;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('OFFICIAL EMPLOYEE THERMAL PAYSLIP', 40, y, { align: 'center' });
    y += 4;
    doc.setFontSize(7.5);
    doc.setFont('courier', 'normal');
    doc.text(`PAY PERIOD: ${record.period.toUpperCase()}`, 40, y, { align: 'center' });
    y += 3.5;
    doc.text(`ISSUED ON: ${new Date(record.runDate).toLocaleString('en-KE')}`, 40, y, { align: 'center' });
    y += 4;

    doc.text('----------------------------------------', 40, y, { align: 'center' });
    y += 4;

    // Employee Info
    doc.setFont('courier', 'bold');
    doc.text('EMPLOYEE PARTICULARS:', left, y);
    y += 3.5;
    doc.setFont('courier', 'normal');
    doc.text(`Name:     ${record.staffName}`, left, y);
    y += 3.5;
    doc.text(`Role:     ${record.staffRole}`, left, y);
    y += 3.5;
    doc.text(`Staff ID: ${record.staffId}`, left, y);
    y += 3.5;
    doc.text(`Branch:   ${record.branchName}`, left, y);
    y += 3.5;
    doc.text(`KRA PIN:  ${record.kraPin || 'A009182741Z'}`, left, y);
    y += 3.5;
    doc.text(`NSSF No:  ${record.nssfNo || '092837192'}`, left, y);
    y += 3.5;
    doc.text(`SHIF/NHIF:${record.nhifNo || '88392019'}`, left, y);
    y += 4;

    doc.text('----------------------------------------', 40, y, { align: 'center' });
    y += 4;

    // Earnings
    doc.setFont('courier', 'bold');
    doc.text('EARNINGS & BASIC PAY:', left, y);
    y += 4;
    doc.setFont('courier', 'normal');
    doc.text('Basic Salary', left, y);
    doc.text(`KES ${record.baseSalary.toLocaleString()}`, right, y, { align: 'right' });
    y += 3.5;
    doc.setFont('courier', 'bold');
    doc.text('GROSS TAXABLE PAY', left, y);
    doc.text(`KES ${record.baseSalary.toLocaleString()}`, right, y, { align: 'right' });
    y += 4;

    doc.text('----------------------------------------', 40, y, { align: 'center' });
    y += 4;

    // Deductions
    doc.setFont('courier', 'bold');
    doc.text('ITEMIZED DEDUCTIONS:', left, y);
    y += 4;
    doc.setFont('courier', 'normal');
    parsedDeductionRows.forEach((row) => {
      doc.text(row.label.slice(0, 23), left, y);
      doc.text(row.amountFormatted ? `-${row.amountFormatted}` : '', right, y, { align: 'right' });
      y += 3.5;
    });
    doc.setFont('courier', 'bold');
    doc.text('TOTAL DEDUCTIONS', left, y);
    doc.text(`-KES ${record.deductions.toLocaleString()}`, right, y, { align: 'right' });
    y += 4;

    // Penalties if any
    if (record.penalties > 0) {
      doc.text('----------------------------------------', 40, y, { align: 'center' });
      y += 4;
      doc.setFont('courier', 'bold');
      doc.text('PENALTIES & DISCIPLINARY FINES:', left, y);
      y += 4;
      doc.setFont('courier', 'normal');
      doc.text(record.penaltiesReason ? record.penaltiesReason.slice(0, 20) : 'Shift Variance', left, y);
      doc.text(`-KES ${record.penalties.toLocaleString()}`, right, y, { align: 'right' });
      y += 3.5;
      doc.setFont('courier', 'bold');
      doc.text('TOTAL PENALTIES', left, y);
      doc.text(`-KES ${record.penalties.toLocaleString()}`, right, y, { align: 'right' });
      y += 4;
    }

    doc.text('========================================', 40, y, { align: 'center' });
    y += 4.5;

    // NET TAKE-HOME PAY
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text('NET TAKE-HOME PAY:', left, y);
    doc.text(`KES ${record.netSalary.toLocaleString()}`, right, y, { align: 'right' });
    y += 5;
    doc.setFontSize(7.5);
    doc.setFont('courier', 'normal');
    doc.text('Status: DISBURSED & CLEARED', left, y);
    y += 3.5;
    doc.text(`Disbursement Batch: ${record.payrollRunId}`, left, y);
    y += 4.5;

    doc.text('----------------------------------------', 40, y, { align: 'center' });
    y += 4;
    doc.text('* ELECTRONIC RECORD · NO SIGNATURE *', 40, y, { align: 'center' });
    y += 3.5;
    doc.text('POWERED BY VAAIRO ERP & KRA eTIMS', 40, y, { align: 'center' });

    doc.save(`Payslip_${record.staffName.replace(/\s+/g, '_')}_${record.period.replace(/\s+/g, '_')}.pdf`);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-none sm:max-w-[420px] h-full sm:h-auto bg-slate-900 rounded-none sm:rounded-3xl border-0 sm:border border-slate-700 shadow-2xl overflow-y-auto my-0 sm:my-auto flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#FFDE00]" />
            <h3 className="font-montserrat font-black text-xs uppercase tracking-wider text-[#FFDE00]">
              Thermal Payslip (80mm / 58mm)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="px-5 py-2.5 bg-slate-800/60 border-b border-slate-700 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex-1 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Thermal PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-montserrat font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Printer className="w-3.5 h-3.5 text-[#34D186]" />
            Print
          </button>
        </div>

        {/* Scrollable Receipt Body (Paper simulation) */}
        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto flex justify-center bg-slate-950">
          <div
            ref={receiptRef}
            className="w-full max-w-[340px] bg-white text-slate-900 p-5 rounded-md font-mono text-[11px] leading-relaxed shadow-lg border-t-4 border-dashed border-slate-300 select-none print:shadow-none print:border-none print:m-0"
          >
            {/* Thermal Header */}
            <div className="text-center space-y-0.5 pb-2">
              <div className="font-bold text-xs uppercase tracking-tight">
                VAAIRO SPIRITS & BEVERAGE ERP
              </div>
              <div className="text-[10px] text-slate-600">
                VAAIRO BONDED DISTRIBUTORS LTD
              </div>
              <div className="text-[10px] text-slate-600">
                HEAD OFFICE · INDUSTRIAL AREA, NAIROBI
              </div>
              <div className="text-[10px] text-slate-500">
                KRA PIN: P051928471Z · NAIROBI, KENYA
              </div>
            </div>

            <div className="text-center text-slate-400 tracking-widest text-[9px]">
              ----------------------------------------
            </div>

            <div className="text-center py-1">
              <div className="font-bold text-xs uppercase">
                EMPLOYEE THERMAL PAYSLIP
              </div>
              <div className="text-[10px] font-bold text-[#0A006E]">
                PERIOD: {record.period.toUpperCase()}
              </div>
              <div className="text-[9px] text-slate-500">
                Run Date: {new Date(record.runDate).toLocaleString('en-KE')}
              </div>
            </div>

            <div className="text-center text-slate-400 tracking-widest text-[9px]">
              ----------------------------------------
            </div>

            {/* Employee Particulars */}
            <div className="py-1 space-y-0.5 text-[10.5px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold">{record.staffName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Role:</span>
                <span className="font-semibold">{record.staffRole}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Staff ID:</span>
                <span className="font-mono text-[10px]">{record.staffId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branch Depot:</span>
                <span>{record.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">KRA Tax PIN:</span>
                <span className="font-mono">{record.kraPin || 'A009182741Z'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NSSF Number:</span>
                <span className="font-mono">{record.nssfNo || '092837192'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SHIF/NHIF No:</span>
                <span className="font-mono">{record.nhifNo || '88392019'}</span>
              </div>
            </div>

            <div className="text-center text-slate-400 tracking-widest text-[9px]">
              ----------------------------------------
            </div>

            {/* Earnings */}
            <div className="py-1 space-y-1">
              <div className="font-bold text-[10px] uppercase text-slate-700">
                EARNINGS & BASIC REMUNERATION
              </div>
              <div className="flex justify-between">
                <span>Basic Monthly Salary</span>
                <span>KES {record.baseSalary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-slate-200 pt-0.5">
                <span>GROSS TAXABLE EARNINGS</span>
                <span>KES {record.baseSalary.toLocaleString()}</span>
              </div>
            </div>

            <div className="text-center text-slate-400 tracking-widest text-[9px]">
              ----------------------------------------
            </div>

            {/* Deductions */}
            <div className="py-1 space-y-1">
              <div className="font-bold text-[10px] uppercase text-slate-700">
                STATUTORY &amp; VOLUNTARY DEDUCTIONS ({parsedDeductionRows.length})
              </div>
              {parsedDeductionRows.map((row, idx) => (
                <div key={idx} className="flex justify-between gap-2 text-slate-700">
                  <span className="truncate">{row.label}</span>
                  <span className="shrink-0 tabular-nums">
                    {row.amountFormatted ? `-${row.amountFormatted}` : ''}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-bold border-t border-slate-200 pt-0.5 text-rose-700">
                <span>TOTAL DEDUCTIONS</span>
                <span className="tabular-nums">-KES {record.deductions.toLocaleString()}</span>
              </div>
            </div>

            {/* Penalties if any */}
            {record.penalties > 0 && (
              <>
                <div className="text-center text-slate-400 tracking-widest text-[9px]">
                  ----------------------------------------
                </div>
                <div className="py-1 space-y-1">
                  <div className="font-bold text-[10px] uppercase text-rose-700">
                    PENALTIES & DISCIPLINARY FINES
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span className="truncate max-w-[190px]">
                      {record.penaltiesReason || 'Stock Variance / Tardiness'}
                    </span>
                    <span className="text-rose-700">-KES {record.penalties.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold border-t border-slate-200 pt-0.5 text-rose-800">
                    <span>TOTAL PENALTIES DEDUCTED</span>
                    <span>-KES {record.penalties.toLocaleString()}</span>
                  </div>
                </div>
              </>
            )}

            <div className="text-center text-slate-900 font-bold tracking-widest text-[9px]">
              ========================================
            </div>

            {/* Net Pay Highlight */}
            <div className="py-2 px-2 bg-slate-100 rounded border border-slate-300 text-center space-y-0.5">
              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                NET TAKE-HOME PAY
              </div>
              <div className="text-base font-black text-[#0A006E]">
                KES {record.netSalary.toLocaleString()}
              </div>
              <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-700">
                <CheckCircle2 className="w-3 h-3" />
                STATUS: APPROVED & CLEARED
              </div>
            </div>

            <div className="text-center text-slate-900 font-bold tracking-widest text-[9px]">
              ========================================
            </div>

            {/* Footer / Barcode */}
            <div className="pt-2 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[9px] text-slate-500">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified Payroll Run: {record.payrollRunId}
              </div>
              {/* Simulated barcode */}
              <div className="flex justify-center items-center py-1 gap-[2px] h-6 overflow-hidden">
                {Array.from({ length: 42 }).map((_, i) => (
                  <div
                    key={i}
                    className={`bg-slate-900 h-full ${i % 3 === 0 ? 'w-1' : i % 2 === 0 ? 'w-[2px]' : 'w-[1px]'}`}
                  />
                ))}
              </div>
              <div className="text-[8px] font-mono text-slate-400">
                *{record.staffId}-{record.period.replace(/\s+/g, '')}*
              </div>
              <div className="text-[8.5px] text-slate-500">
                ELECTRONIC RECEIPT · CONFIDENTIAL RECORD
              </div>
              <div className="text-[8px] text-slate-400">
                Vaairo Spirits & Beverage ERP System · Nairobi
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
