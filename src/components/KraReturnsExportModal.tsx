import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Settings,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Building2,
  Receipt,
  Users,
  Percent,
} from 'lucide-react';
import {
  TransactionDoc,
  Product,
  Partner,
  ExternalCustomer,
  StaffMember,
  PayrollRun,
  ComplianceRecord,
  Branch,
  GeoRegion,
} from '../types';
import {
  KraReturnScheduleType,
  KraPeriodFilterMode,
  KraTaxpayerConfig,
  KraSupplierExpenseEntry,
  loadKraTaxpayerConfig,
  saveKraTaxpayerConfig,
  loadKraSupplierExpenses,
  saveKraSupplierExpenses,
  buildKraReturnsDataset,
  downloadKraMasterWorkbookXlsx,
  downloadKraScheduleCsv,
  isValidKraPin,
  normalizeKraPin,
  round2,
} from '../utils/kraReturnsExport';

export interface KraReturnsPanelProps {
  currentUser: StaffMember;
  transactions: TransactionDoc[];
  products: Product[];
  partners: Partner[];
  externalCustomers?: ExternalCustomer[];
  staffList?: StaffMember[];
  payrollRuns?: PayrollRun[];
  complianceRecords?: ComplianceRecord[];
  branches: Branch[];
  regions: GeoRegion[];
  defaultTab?: KraReturnScheduleType;
  onTriggerToast?: (type: 'success' | 'error', title: string, message: string) => void;
}

const formatNum = (val: number): string =>
  val.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const KraReturnsPanel: React.FC<KraReturnsPanelProps> = ({
  transactions,
  products,
  partners,
  externalCustomers = [],
  staffList = [],
  payrollRuns = [],
  complianceRecords = [],
  branches,
  regions,
  defaultTab = 'VAT3_SALES_SEC_B',
  onTriggerToast,
}) => {
  const [config, setConfig] = useState<KraTaxpayerConfig>(() => loadKraTaxpayerConfig());
  const [showConfigSettings, setShowConfigSettings] = useState(false);

  // Default to current YYYY-MM; if current month has 0 transactions but transactions exist in another month,
  // still default to current month while showing total historical transactions count for 1-click switch.
  const currentYm = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [periodMode, setPeriodMode] = useState<KraPeriodFilterMode>('MONTH');
  const [selectedMonthYm, setSelectedMonthYm] = useState<string>(currentYm);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [branchFilterId, setBranchFilterId] = useState<string>('ALL');
  const [activeSchedule, setActiveSchedule] = useState<KraReturnScheduleType>(defaultTab);
  const [includeCsvHeaders, setIncludeCsvHeaders] = useState<boolean>(true);
  const [downloadStatusBanner, setDownloadStatusBanner] = useState<string | null>(null);

  // Supplier / Expense eTIMS Input VAT Bills (user-managed, zero mock data)
  const [manualExpenses, setManualExpenses] = useState<KraSupplierExpenseEntry[]>(() =>
    loadKraSupplierExpenses()
  );
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const [expType, setExpType] = useState<'Local' | 'Import'>('Local');
  const [expSupplierPin, setExpSupplierPin] = useState('');
  const [expSupplierName, setExpSupplierName] = useState('');
  const [expInvoiceDate, setExpInvoiceDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );
  const [expInvoiceNo, setExpInvoiceNo] = useState('');
  const [expCustomEntry, setExpCustomEntry] = useState('');
  const [expDescription, setExpDescription] = useState('');
  const [expGrossOrTaxable, setExpGrossOrTaxable] = useState<string>('');
  const [expIsInclusive, setExpIsInclusive] = useState<boolean>(true);

  const handleUpdateConfig = (patch: Partial<KraTaxpayerConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch };
      saveKraTaxpayerConfig(next);
      return next;
    });
  };

  const handleAddSupplierExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmt = Number(expGrossOrTaxable);
    if (!expSupplierName.trim() || !expInvoiceNo.trim() || !(numericAmt > 0)) return;

    const rateDec = Math.max(0, config.vatRatePercent) / 100;
    const taxableValueKes = expIsInclusive && rateDec > 0
      ? round2(numericAmt / (1 + rateDec))
      : round2(numericAmt);
    const vatAmountKes = expIsInclusive && rateDec > 0
      ? round2(numericAmt - taxableValueKes)
      : round2(taxableValueKes * rateDec);

    const newEntry: KraSupplierExpenseEntry = {
      id: `kra-exp-${Date.now()}`,
      purchaseType: expType,
      supplierPin: normalizeKraPin(expSupplierPin),
      supplierName: expSupplierName.trim(),
      invoiceDate: expInvoiceDate,
      invoiceNumber: expInvoiceNo.trim(),
      description: expDescription.trim() || 'Vatable Business Expense / Stock Supply',
      customEntryNumber: expType === 'Import' ? expCustomEntry.trim() : '',
      taxableValueKes,
      vatAmountKes,
      createdAt: new Date().toISOString(),
    };

    const updated = [newEntry, ...manualExpenses];
    setManualExpenses(updated);
    saveKraSupplierExpenses(updated);

    setExpSupplierPin('');
    setExpSupplierName('');
    setExpInvoiceNo('');
    setExpCustomEntry('');
    setExpDescription('');
    setExpGrossOrTaxable('');
    setShowAddExpenseForm(false);

    onTriggerToast?.(
      'success',
      'Input VAT Invoice Added',
      `Recorded ${newEntry.invoiceNumber} (${newEntry.supplierName}) in Section F Purchases.`
    );
  };

  const handleDeleteManualExpense = (invoiceNo: string, supplierName: string) => {
    const updated = manualExpenses.filter(
      (item) => !(item.invoiceNumber === invoiceNo && item.supplierName === supplierName)
    );
    setManualExpenses(updated);
    saveKraSupplierExpenses(updated);
  };

  const dataset = useMemo(
    () =>
      buildKraReturnsDataset({
        config,
        periodMode,
        selectedMonthYm,
        customStartDate,
        customEndDate,
        branchFilterId,
        transactions,
        products,
        partners,
        externalCustomers,
        staffList,
        payrollRuns,
        complianceRecords,
        regions,
        manualSupplierExpenses: manualExpenses,
      }),
    [
      config,
      periodMode,
      selectedMonthYm,
      customStartDate,
      customEndDate,
      branchFilterId,
      transactions,
      products,
      partners,
      externalCustomers,
      staffList,
      payrollRuns,
      complianceRecords,
      regions,
      manualExpenses,
    ]
  );

  // Count how many total commercial sales exist across all time so if current month is empty, user knows
  const totalHistoricalSalesCount = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.docType === 'Invoice' ||
          t.docType === 'Receipt' ||
          t.docType === 'Online Order' ||
          t.docType === 'Credit Note'
      ).length,
    [transactions]
  );

  const missingStaffPinCount = useMemo(
    () => dataset.payeP10Rows.filter((r) => !r.pinFormatValid).length,
    [dataset.payeP10Rows]
  );

  const handleDownloadWorkbook = () => {
    const filename = downloadKraMasterWorkbookXlsx(dataset, config);
    const msg = `Downloaded ${filename} (7 KRA iTax worksheets)`;
    setDownloadStatusBanner(msg);
    onTriggerToast?.('success', 'KRA Workbook Downloaded', msg);
  };

  const handleDownloadCsv = (schedule: KraReturnScheduleType) => {
    const filename = downloadKraScheduleCsv(schedule, dataset, config, includeCsvHeaders);
    const msg = `Downloaded ${filename} for KRA iTax upload`;
    setDownloadStatusBanner(msg);
    onTriggerToast?.('success', 'KRA Upload CSV Downloaded', msg);
  };

  const companyPinValid = isValidKraPin(config.companyKraPin);

  const scheduleTabs: {
    id: KraReturnScheduleType;
    label: string;
    count: number;
  }[] = [
    {
      id: 'VAT3_SALES_SEC_B',
      label: 'VAT3 Sec B: Sales (16%)',
      count: dataset.vatSalesSecB.length,
    },
    {
      id: 'VAT3_PURCHASES_SEC_F',
      label: 'VAT3 Sec F: Purchases (16%)',
      count: dataset.vatPurchasesSecF.length,
    },
    {
      id: 'PAYE_P10_SEC_B',
      label: 'PAYE P10: Employees',
      count: dataset.payeP10Rows.length,
    },
    {
      id: 'STATUTORY_AHL_SHIF_NSSF',
      label: 'Housing Levy, SHIF & NSSF',
      count: dataset.payeP10Rows.length,
    },
    {
      id: 'TURNOVER_TAX_TOT',
      label: 'TOT (3%) & Zero-Rated',
      count: dataset.vatZeroRatedSecC.length + 1,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Top Action & Period Bar */}
      <div className="bg-[#0A006E] text-white p-4 sm:p-5 border-b border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[#FFDE00] font-montserrat font-bold tracking-wide uppercase">
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>Kenya Revenue Authority (iTax) Return Spreadsheets</span>
            </div>
            <h3 className="text-lg sm:text-xl font-montserrat font-black text-white">
              Download KRA Upload Workbooks (.xlsx) &amp; iTax Schedules (.csv)
            </h3>
            <p className="text-xs text-slate-300">
              Populated directly from live ERP invoices, POS receipts, credit notes, customs entries, and payroll records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfigSettings((v) => !v)}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/25 text-white rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <Settings className="w-3.5 h-3.5 text-[#FFDE00]" />
              <span>PIN &amp; eTIMS Setup</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadCsv(activeSchedule)}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-100 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition"
            >
              <Download className="w-3.5 h-3.5 text-[#0A006E]" />
              <span>Download Current Sheet (.csv)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadWorkbook}
              className="px-4 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#0A006E]" />
              <span>Download KRA Workbook (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Period & Branch Filter Row */}
        <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex bg-white/10 p-1 rounded-xl border border-white/15">
              {(
                [
                  { id: 'MONTH', label: 'Monthly Filing' },
                  { id: 'CUSTOM_RANGE', label: 'Date Range' },
                  { id: 'ALL_TIME', label: 'All Recorded' },
                ] as { id: KraPeriodFilterMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPeriodMode(m.id)}
                  className={`px-3 py-1.5 rounded-lg font-montserrat font-bold text-xs cursor-pointer whitespace-nowrap transition ${
                    periodMode === m.id
                      ? 'bg-[#FFDE00] text-[#0A006E]'
                      : 'text-slate-200 hover:text-white'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {periodMode === 'MONTH' && (
              <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                <Calendar className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span className="text-slate-300 font-semibold">Return Month:</span>
                <input
                  type="month"
                  value={selectedMonthYm}
                  onChange={(e) => setSelectedMonthYm(e.target.value)}
                  className="bg-transparent text-white font-mono-tabular font-bold focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {periodMode === 'CUSTOM_RANGE' && (
              <div className="flex flex-wrap items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-transparent text-white font-mono-tabular font-bold focus:outline-none"
                />
                <span className="text-slate-300">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-transparent text-white font-mono-tabular font-bold focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
              <Building2 className="w-3.5 h-3.5 text-[#FFDE00]" />
              <select
                value={branchFilterId}
                onChange={(e) => setBranchFilterId(e.target.value)}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="text-slate-900">
                  All Branches ({branches.length})
                </option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id} className="text-slate-900">
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-200 font-mono-tabular">
            <span>
              Taxpayer PIN:{' '}
              <strong className={companyPinValid ? 'text-[#34D186]' : 'text-amber-300'}>
                {config.companyKraPin || 'UNSET'}
              </strong>
            </span>
            <span>
              Period: <strong className="text-white">{dataset.periodStartKra} – {dataset.periodEndKra}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Taxpayer KRA PIN, CU Serial & VAT Rules Configuration */}
      {showConfigSettings && (
        <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-montserrat font-black text-slate-900 text-sm">
                Taxpayer KRA PIN, eTIMS Control Unit &amp; VAT Calculation Rules
              </h4>
              <p className="text-slate-600">
                Saved automatically on this terminal and stamped onto exported KRA iTax spreadsheets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowConfigSettings(false)}
              className="text-slate-500 hover:text-slate-800 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block font-montserrat font-bold text-slate-700">
                Company KRA PIN (11 Chars)
              </label>
              <input
                type="text"
                maxLength={11}
                value={config.companyKraPin}
                onChange={(e) =>
                  handleUpdateConfig({ companyKraPin: e.target.value.toUpperCase() })
                }
                placeholder="P051829301A"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular uppercase font-bold text-slate-900"
              />
              <div className="mt-1 text-[11px]">
                {companyPinValid ? (
                  <span className="text-emerald-700 font-semibold">Valid iTax PIN format</span>
                ) : (
                  <span className="text-amber-700 font-semibold">
                    Expected format: P051234567A (A/P + 9 digits + letter)
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block font-montserrat font-bold text-slate-700">
                Registered Taxpayer Name
              </label>
              <input
                type="text"
                value={config.companyLegalName}
                onChange={(e) => handleUpdateConfig({ companyLegalName: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-montserrat font-bold text-slate-700">
                eTIMS / ETR Control Unit Serial
              </label>
              <input
                type="text"
                value={config.etimsControlUnitSerial}
                onChange={(e) =>
                  handleUpdateConfig({ etimsControlUnitSerial: e.target.value.toUpperCase() })
                }
                placeholder="KRAMW00928172"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-montserrat font-bold text-slate-700">
                Standard VAT Rate (%)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                step={1}
                value={config.vatRatePercent}
                onChange={(e) =>
                  handleUpdateConfig({ vatRatePercent: Number(e.target.value) || 16 })
                }
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-slate-200">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.consolidateWalkInSales}
                onChange={(e) =>
                  handleUpdateConfig({ consolidateWalkInSales: e.target.checked })
                }
                className="w-4 h-4 accent-[#0A006E] rounded cursor-pointer"
              />
              <span className="font-semibold text-slate-800">
                Consolidate Walk-In Retail POS Sales (No Buyer KRA PIN) into Daily Lump Sum Rows (KRA VAT3 Standard)
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={config.pricesAreVatInclusive}
                onChange={(e) =>
                  handleUpdateConfig({ pricesAreVatInclusive: e.target.checked })
                }
                className="w-4 h-4 accent-[#0A006E] rounded cursor-pointer"
              />
              <span className="font-semibold text-slate-800">
                Extract {config.vatRatePercent}% VAT from Gross Amounts when Tax is Unseparated
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeCsvHeaders}
                onChange={(e) => setIncludeCsvHeaders(e.target.checked)}
                className="w-4 h-4 accent-[#0A006E] rounded cursor-pointer"
              />
              <span className="font-semibold text-slate-800">
                Include Column Header Row in Downloaded .csv Files
              </span>
            </label>
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5 space-y-5">
        {downloadStatusBanner && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadStatusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadStatusBanner(null)}
              className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Helpful notice when current month has 0 sales but historical ERP sales exist */}
        {periodMode === 'MONTH' &&
          dataset.vatSalesSecB.length === 0 &&
          totalHistoricalSalesCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  No sales documents recorded in <strong>{dataset.periodLabel}</strong>, though{' '}
                  <strong className="font-mono-tabular">{totalHistoricalSalesCount}</strong> commercial
                  document(s) exist in other periods.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPeriodMode('ALL_TIME')}
                className="px-3 py-1.5 bg-amber-200/80 hover:bg-amber-300 text-amber-950 rounded-lg font-montserrat font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                View All Recorded Periods
              </button>
            </div>
          )}

        {/* 4-Metric Tabular Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[11px] font-montserrat font-bold text-slate-500 uppercase">
              Output VAT (Sec B Sales @ {config.vatRatePercent}%)
            </div>
            <div className="text-xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              KES {formatNum(dataset.summary.totalOutputVat)}
            </div>
            <div className="text-[11px] text-slate-600 font-mono-tabular mt-1">
              Taxable Sales: KES {formatNum(dataset.summary.netTaxableSales)}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[11px] font-montserrat font-bold text-slate-500 uppercase">
              Input VAT (Sec F Purchases @ {config.vatRatePercent}%)
            </div>
            <div className="text-xl font-montserrat font-black text-emerald-700 font-mono-tabular mt-1">
              KES {formatNum(dataset.summary.totalInputVat)}
            </div>
            <div className="text-[11px] text-slate-600 font-mono-tabular mt-1">
              {dataset.vatPurchasesSecF.length} Qualifying Purchase Entries
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[11px] font-montserrat font-bold text-slate-500 uppercase">
              {dataset.summary.netVatPayableOrClaimable >= 0
                ? 'Net VAT3 Payable (Due 20th)'
                : 'Net VAT3 Credit Carry-Forward'}
            </div>
            <div
              className={`text-xl font-montserrat font-black font-mono-tabular mt-1 ${
                dataset.summary.netVatPayableOrClaimable >= 0
                  ? 'text-slate-900'
                  : 'text-emerald-700'
              }`}
            >
              KES {formatNum(Math.abs(dataset.summary.netVatPayableOrClaimable))}
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              {dataset.summary.netVatPayableOrClaimable >= 0
                ? 'Output VAT minus Input VAT'
                : 'Excess Input VAT credit'}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-[11px] font-montserrat font-bold text-slate-500 uppercase">
              PAYE P10 &amp; Statutory (Due 9th)
            </div>
            <div className="text-xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              KES {formatNum(dataset.summary.totalPayePayable)}
            </div>
            <div className="text-[11px] text-slate-600 font-mono-tabular mt-1">
              AHL: KES {formatNum(dataset.summary.totalHousingLevyCombined)} · SHIF: KES{' '}
              {formatNum(dataset.summary.totalShifPayable)}
            </div>
          </div>
        </div>

        {/* Direct KRA iTax Schedule Tabs & Quick CSV Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {scheduleTabs.map((tab) => {
              const isAct = activeSchedule === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSchedule(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-montserrat font-bold flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 transition ${
                    isAct
                      ? 'bg-[#0A006E] text-[#FFDE00]'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-bold ${
                      isAct ? 'bg-white/15 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SCHEDULE 1: VAT3 SECTION B - GENERAL RATE SALES (16%)                 */}
        {/* ===================================================================== */}
        {activeSchedule === 'VAT3_SALES_SEC_B' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-montserrat font-black text-slate-900">
                  KRA VAT3 Return — Section B: General Rate Taxable Sales ({config.vatRatePercent}%)
                </span>
                <p className="text-slate-500">
                  Columns match KRA iTax <code className="font-mono">B_Sales_Invoices</code> CSV import order (DD/MM/YYYY dates, raw numeric amounts).
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {dataset.vatCreditNotes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleDownloadCsv('VAT3_CREDIT_NOTES')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-montserrat font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Credit Notes Only (.csv)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('VAT3_SALES_SEC_B')}
                  className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                  <span>Download VAT3 Sec B Sales (.csv)</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-montserrat">
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">PIN of Purchaser</th>
                    <th className="py-2.5 px-3 font-bold">Name of Purchaser</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">ETR Serial No</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Invoice Date</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Invoice No</th>
                    <th className="py-2.5 px-3 font-bold">Description of Goods</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Taxable Value (Ksh)</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">VAT Amount (Ksh)</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Relevant Inv No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataset.vatSalesSecB.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        <Receipt className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <div className="font-montserrat font-bold text-slate-700">
                          No Taxable Sales Recorded for {dataset.periodLabel}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Completed POS receipts, B2B invoices, online orders, and credit notes in this period will populate this KRA VAT3 schedule automatically. You can still download a clean Nil-Return template above.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dataset.vatSalesSecB.map((row, idx) => (
                      <tr key={`${row.invoiceNumber}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono-tabular font-bold text-[#0A006E] whitespace-nowrap">
                          {row.purchaserPin ? (
                            <span className={row.pinFormatValid ? 'text-[#0A006E]' : 'text-amber-700'}>
                              {row.purchaserPin}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">Lump Sum / Blank</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900 max-w-[210px] truncate">
                          {row.purchaserName}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                          {row.etrSerialNumber}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {row.invoiceDateKra}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                          {row.invoiceNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-600 max-w-[220px] truncate">
                          {row.description}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono-tabular font-bold whitespace-nowrap ${
                            row.taxableValueKes < 0 ? 'text-rose-700' : 'text-slate-900'
                          }`}
                        >
                          {formatNum(row.taxableValueKes)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono-tabular font-bold whitespace-nowrap ${
                            row.vatAmountKes < 0 ? 'text-rose-700' : 'text-[#0A006E]'
                          }`}
                        >
                          {formatNum(row.vatAmountKes)}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-500 whitespace-nowrap">
                          {row.relevantInvoiceNumber || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dataset.vatSalesSecB.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-montserrat font-black text-slate-900">
                      <td colSpan={6} className="py-2.5 px-3 text-right">
                        Section B Net Totals ({dataset.vatSalesSecB.length} Rows):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {formatNum(
                          dataset.summary.pinSalesTaxable +
                            dataset.summary.walkInSalesTaxable -
                            dataset.summary.creditNotesTaxable
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#0A006E]">
                        {formatNum(dataset.summary.totalOutputVat)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SCHEDULE 2: VAT3 SECTION F - GENERAL RATE PURCHASES & INPUT VAT (16%) */}
        {/* ===================================================================== */}
        {activeSchedule === 'VAT3_PURCHASES_SEC_F' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-montserrat font-black text-slate-900">
                  KRA VAT3 Return — Section F: General Rate Purchases &amp; Input VAT ({config.vatRatePercent}%)
                </span>
                <p className="text-slate-500">
                  Combines onboarded stock supplier invoices, customs import entries, and recorded eTIMS expense bills.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseForm((v) => !v)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-xl font-montserrat font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Supplier eTIMS Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadCsv('VAT3_PURCHASES_SEC_F')}
                  className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                  <span>Download VAT3 Sec F Purchases (.csv)</span>
                </button>
              </div>
            </div>

            {showAddExpenseForm && (
              <form
                onSubmit={handleAddSupplierExpense}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-montserrat font-black text-slate-900">
                    Record Supplier / Expense eTIMS Tax Invoice for Input VAT Claim
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddExpenseForm(false)}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700">Purchase Type</label>
                    <select
                      value={expType}
                      onChange={(e) => setExpType(e.target.value as 'Local' | 'Import')}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold"
                    >
                      <option value="Local">Local</option>
                      <option value="Import">Import</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700">Supplier KRA PIN *</label>
                    <input
                      required={expType === 'Local'}
                      type="text"
                      maxLength={11}
                      value={expSupplierPin}
                      onChange={(e) => setExpSupplierPin(e.target.value.toUpperCase())}
                      placeholder="P051092831Z"
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-tabular uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700">Supplier Legal Name *</label>
                    <input
                      required
                      type="text"
                      value={expSupplierName}
                      onChange={(e) => setExpSupplierName(e.target.value)}
                      placeholder="e.g. Kenya Power / EABL / Freight Ltd"
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700">Invoice Date *</label>
                    <input
                      required
                      type="date"
                      value={expInvoiceDate}
                      onChange={(e) => setExpInvoiceDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700">eTIMS / CU Invoice No *</label>
                    <input
                      required
                      type="text"
                      value={expInvoiceNo}
                      onChange={(e) => setExpInvoiceNo(e.target.value)}
                      placeholder="e.g. 009281720000142"
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-tabular"
                    />
                  </div>

                  {expType === 'Import' && (
                    <div>
                      <label className="block font-bold text-slate-700">Customs Entry No</label>
                      <input
                        type="text"
                        value={expCustomEntry}
                        onChange={(e) => setExpCustomEntry(e.target.value)}
                        placeholder="e.g. 2026JKA409182"
                        className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-tabular"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-700">Description of Goods / Service</label>
                    <input
                      type="text"
                      value={expDescription}
                      onChange={(e) => setExpDescription(e.target.value)}
                      placeholder="Commercial Electricity / Depot Rent / Stock"
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700">Invoice Amount (KES) *</label>
                    <input
                      required
                      type="number"
                      min={1}
                      step="0.01"
                      value={expGrossOrTaxable}
                      onChange={(e) => setExpGrossOrTaxable(e.target.value)}
                      placeholder="e.g. 58000"
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono-tabular font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={expIsInclusive}
                      onChange={(e) => setExpIsInclusive(e.target.checked)}
                      className="w-4 h-4 accent-[#0A006E] rounded"
                    />
                    <span className="font-semibold text-slate-700">
                      Amount entered includes {config.vatRatePercent}% VAT
                    </span>
                  </label>

                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-lg font-montserrat font-black cursor-pointer whitespace-nowrap"
                  >
                    Add Input VAT Invoice
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-montserrat">
                    <th className="py-2.5 px-3 font-bold">Type</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">PIN of Supplier</th>
                    <th className="py-2.5 px-3 font-bold">Name of Supplier</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Invoice Date</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Invoice No</th>
                    <th className="py-2.5 px-3 font-bold">Description</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Custom Entry No</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Taxable Value (Ksh)</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Input VAT (Ksh)</th>
                    <th className="py-2.5 px-3 font-bold text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataset.vatPurchasesSecF.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-slate-500">
                        <FileSpreadsheet className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <div className="font-montserrat font-bold text-slate-700">
                          No Vatable Purchase Invoices Recorded in {dataset.periodLabel}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 max-w-lg mx-auto">
                          Stock SKUs onboarded with supplier invoice numbers, customs import bonds, or supplier bills logged via &ldquo;Log Supplier eTIMS Bill&rdquo; will appear here for VAT3 Section F input tax deduction.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    dataset.vatPurchasesSecF.map((row, idx) => (
                      <tr key={`${row.invoiceNumber}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{row.purchaseType}</td>
                        <td className="py-2 px-3 font-mono-tabular font-bold text-[#0A006E] whitespace-nowrap">
                          {row.supplierPin || '—'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900 max-w-[200px] truncate">
                          {row.supplierName}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {row.invoiceDateKra}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                          {row.invoiceNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">
                          {row.description}
                        </td>
                        <td className="py-2 px-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                          {row.customEntryNumber || '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                          {formatNum(row.taxableValueKes)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-bold text-emerald-700 whitespace-nowrap">
                          {formatNum(row.vatAmountKes)}
                        </td>
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          {row.sourceLabel === 'Supplier Expense Bill' ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteManualExpense(row.invoiceNumber, row.supplierName)
                              }
                              className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                              title="Remove manual supplier bill"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">{row.sourceLabel}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dataset.vatPurchasesSecF.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-montserrat font-black text-slate-900">
                      <td colSpan={7} className="py-2.5 px-3 text-right">
                        Section F Input Tax Totals ({dataset.vatPurchasesSecF.length} Rows):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {formatNum(
                          dataset.summary.localPurchasesTaxable +
                            dataset.summary.importPurchasesTaxable
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-700">
                        {formatNum(dataset.summary.totalInputVat)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SCHEDULE 3: PAYE P10 MONTHLY RETURN (SHEET B: EMPLOYEE DETAILS)       */}
        {/* ===================================================================== */}
        {activeSchedule === 'PAYE_P10_SEC_B' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-montserrat font-black text-slate-900">
                  KRA PAYE Monthly Return (P10) — Sheet B: Employee Details (35 iTax Columns)
                </span>
                <p className="text-slate-500">
                  Source: <strong>{dataset.payeSourceLabel}</strong> · Includes NSSF allowable deduction, KES 2,400 Personal Relief, and Self-Assessed PAYE.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadCsv('PAYE_P10_SEC_B')}
                className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>Download PAYE P10 Sec B (.csv)</span>
              </button>
            </div>

            {missingStaffPinCount > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>{missingStaffPinCount}</strong> employee(s) below do not yet have a valid 11-character KRA PIN assigned in HR &amp; Payroll. Update their KRA PIN in HR before uploading the P10 CSV to iTax.
                </span>
              </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-montserrat">
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">PIN of Employee</th>
                    <th className="py-2.5 px-3 font-bold">Name of Employee</th>
                    <th className="py-2.5 px-3 font-bold">Status / Type</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Basic / Gross Pay</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">NSSF Contribution</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Taxable Pay</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Tax Charged</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Personal Relief</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Net PAYE (Ksh)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataset.payeP10Rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        <Users className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <div className="font-montserrat font-bold text-slate-700">
                          No Active Employees Found for P10 Schedule
                        </div>
                      </td>
                    </tr>
                  ) : (
                    dataset.payeP10Rows.map((row) => (
                      <tr key={row.staffId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono-tabular font-bold whitespace-nowrap">
                          {row.employeePin ? (
                            <span className={row.pinFormatValid ? 'text-[#0A006E]' : 'text-amber-700'}>
                              {row.employeePin}
                            </span>
                          ) : (
                            <span className="text-amber-700">MISSING PIN</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{row.employeeName}</td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {row.residentialStatus} · Primary
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-bold text-slate-900">
                          {formatNum(row.totalGrossPay)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                          {formatNum(row.actualPensionNssf)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                          {formatNum(row.taxablePay)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                          {formatNum(row.taxChargedBeforeRelief)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular text-emerald-700">
                          {formatNum(row.monthlyPersonalRelief)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-black text-[#0A006E]">
                          {formatNum(row.payeTaxNet)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {dataset.payeP10Rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-montserrat font-black text-slate-900">
                      <td colSpan={3} className="py-2.5 px-3 text-right">
                        P10 Payroll Totals ({dataset.payeP10Rows.length} Staff):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {formatNum(dataset.summary.totalPayrollGross)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular">
                        {formatNum(dataset.summary.totalNssfEmployee)}
                      </td>
                      <td colSpan={3} />
                      <td className="py-2.5 px-3 text-right font-mono-tabular text-[#0A006E]">
                        {formatNum(dataset.summary.totalPayePayable)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SCHEDULE 4: AFFORDABLE HOUSING LEVY (AHL), SHIF & NSSF SCHEDULE       */}
        {/* ===================================================================== */}
        {activeSchedule === 'STATUTORY_AHL_SHIF_NSSF' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-montserrat font-black text-slate-900">
                  Affordable Housing Levy (AHL 1.5% + 1.5%), SHIF (2.75%) &amp; NSSF Remittance Schedule
                </span>
                <p className="text-slate-500">
                  Ready for KRA iTax Affordable Housing Levy return upload, SHA/SHIF portal, and NSSF Tier I &amp; II by-product return.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadCsv('STATUTORY_AHL_SHIF_NSSF')}
                className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>Download AHL, SHIF &amp; NSSF (.csv)</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-montserrat">
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">Employee PIN</th>
                    <th className="py-2.5 px-3 font-bold">Employee Name</th>
                    <th className="py-2.5 px-3 font-bold whitespace-nowrap">NSSF No</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Gross Pay (Ksh)</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Emp AHL 1.5%</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Employer AHL 1.5%</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">Total AHL 3.0%</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">SHIF 2.75%</th>
                    <th className="py-2.5 px-3 font-bold text-right whitespace-nowrap">NSSF Emp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataset.payeP10Rows.map((row) => (
                    <tr key={row.staffId} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono-tabular font-bold text-[#0A006E]">
                        {row.employeePin || 'MISSING'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{row.employeeName}</td>
                      <td className="py-2 px-3 font-mono-tabular text-slate-600">
                        {row.nssfNo || '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-bold text-slate-900">
                        {formatNum(row.totalGrossPay)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                        {formatNum(row.employeeHousingLevy)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-slate-700">
                        {formatNum(row.employerHousingLevy)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-bold text-[#0A006E]">
                        {formatNum(row.totalHousingLevy)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-emerald-700">
                        {formatNum(row.shifDeduction)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono-tabular text-slate-800">
                        {formatNum(row.actualPensionNssf)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* SCHEDULE 5: TURNOVER TAX (TOT 3%), EXCISE VOLUME & ZERO-RATED SALES   */}
        {/* ===================================================================== */}
        {activeSchedule === 'TURNOVER_TAX_TOT' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-montserrat font-black text-slate-900">
                  KRA Monthly Turnover Tax (TOT @ 3%), Excise Litres &amp; Zero-Rated Export Supplies
                </span>
                <p className="text-slate-500">
                  Summary schedule for entities or sub-units declaring 3% Turnover Tax or tracking excisable beverage volume.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadCsv('TURNOVER_TAX_TOT')}
                className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Percent className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>Download TOT Return (.csv)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-slate-500 font-bold uppercase text-[11px]">
                  Net Taxable Turnover ({dataset.periodLabel})
                </div>
                <div className="text-lg font-montserrat font-black text-slate-900 font-mono-tabular mt-1">
                  KES {formatNum(dataset.summary.netTaxableSales)}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-slate-500 font-bold uppercase text-[11px]">
                  Turnover Tax @ 3% Reference
                </div>
                <div className="text-lg font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
                  KES {formatNum(dataset.summary.turnoverTax3Pct)}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-slate-500 font-bold uppercase text-[11px]">
                  Excisable Beverage Dispatched
                </div>
                <div className="text-lg font-montserrat font-black text-emerald-700 font-mono-tabular mt-1">
                  {formatNum(dataset.summary.excisableLitresSold)} Litres
                </div>
              </div>
            </div>

            {dataset.vatZeroRatedSecC.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 border-b border-slate-200 font-montserrat">
                      <th className="py-2.5 px-3 font-bold">Purchaser PIN</th>
                      <th className="py-2.5 px-3 font-bold">Export / Duty-Free Consignee</th>
                      <th className="py-2.5 px-3 font-bold">Invoice Date</th>
                      <th className="py-2.5 px-3 font-bold">Invoice No</th>
                      <th className="py-2.5 px-3 font-bold text-right">Zero-Rated Value (Ksh)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataset.vatZeroRatedSecC.map((r, i) => (
                      <tr key={`${r.invoiceNumber}-${i}`} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono-tabular">{r.purchaserPin || 'EXPORT'}</td>
                        <td className="py-2 px-3 font-semibold">{r.purchaserName}</td>
                        <td className="py-2 px-3 font-mono-tabular">{r.invoiceDateKra}</td>
                        <td className="py-2 px-3 font-mono-tabular font-bold">{r.invoiceNumber}</td>
                        <td className="py-2 px-3 text-right font-mono-tabular font-bold">
                          {formatNum(r.taxableValueKes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export interface KraReturnsExportModalProps extends KraReturnsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KraReturnsExportModal: React.FC<KraReturnsExportModalProps> = ({
  isOpen,
  onClose,
  ...panelProps
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="bg-white rounded-none sm:rounded-2xl border-0 sm:border-2 border-[#0A006E] shadow-2xl w-full max-w-6xl h-full sm:max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#0A006E]" />
            <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wide">
              KRA iTax Return Spreadsheets Exporter
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 bg-white hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-montserrat font-bold flex items-center gap-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50">
          <KraReturnsPanel {...panelProps} />
        </div>
      </div>
    </div>
  );
};
