import * as XLSX from 'xlsx';
import {
  TransactionDoc,
  Product,
  Partner,
  ExternalCustomer,
  StaffMember,
  PayrollRun,
  PayrollRecord,
  ComplianceRecord,
  GeoRegion,
  LineItem,
} from '../types';
import { DEFAULT_BRANDING_CONFIG } from '../config/erpConfig';
import {
  calculateNssf,
  calculateShif,
  calculateHousingLevy,
  calculatePaye,
} from './kenyaTax';

export type KraReturnScheduleType =
  | 'VAT3_SALES_SEC_B'
  | 'VAT3_PURCHASES_SEC_F'
  | 'VAT3_CREDIT_NOTES'
  | 'PAYE_P10_SEC_B'
  | 'STATUTORY_AHL_SHIF_NSSF'
  | 'TURNOVER_TAX_TOT';

export type KraPeriodFilterMode = 'MONTH' | 'ALL_TIME' | 'CUSTOM_RANGE';

export interface KraTaxpayerConfig {
  companyKraPin: string;
  companyLegalName: string;
  etimsControlUnitSerial: string;
  vatRatePercent: number;
  pricesAreVatInclusive: boolean;
  consolidateWalkInSales: boolean;
}

export interface KraSupplierExpenseEntry {
  id: string;
  purchaseType: 'Local' | 'Import';
  supplierPin: string;
  supplierName: string;
  invoiceDate: string; // YYYY-MM-DD
  invoiceNumber: string;
  description: string;
  customEntryNumber?: string;
  taxableValueKes: number;
  vatAmountKes: number;
  createdAt: string;
}

export interface KraVatSalesRow {
  purchaserPin: string;
  purchaserName: string;
  etrSerialNumber: string;
  invoiceDateKra: string; // DD/MM/YYYY
  invoiceNumber: string;
  description: string;
  taxableValueKes: number;
  vatAmountKes: number;
  grossAmountKes: number;
  relevantInvoiceNumber: string;
  relevantInvoiceDateKra: string;
  rowCategory: 'B2B_PIN_SALE' | 'LUMP_SUM_CASH' | 'WALK_IN_ITEMIZED' | 'CREDIT_NOTE' | 'ZERO_RATED';
  pinFormatValid: boolean;
}

export interface KraVatPurchaseRow {
  purchaseType: 'Local' | 'Import';
  supplierPin: string;
  supplierName: string;
  invoiceDateKra: string; // DD/MM/YYYY
  invoiceNumber: string;
  description: string;
  customEntryNumber: string;
  taxableValueKes: number;
  vatAmountKes: number;
  relevantInvoiceNumber: string;
  relevantInvoiceDateKra: string;
  sourceLabel: 'ERP Stock Invoice' | 'Customs / Excise Entry' | 'Supplier Expense Bill';
  pinFormatValid: boolean;
}

export interface KraPayeP10Row {
  employeePin: string;
  employeeName: string;
  residentialStatus: 'Resident' | 'Non-Resident';
  employeeType: 'Primary Employee' | 'Secondary Employee';
  basicSalary: number;
  houseAllowance: number;
  transportAllowance: number;
  leavePay: number;
  overtimeAllowance: number;
  directorsFee: number;
  lumpSumPayment: number;
  otherAllowance: number;
  totalCashPay: number;
  carBenefit: number;
  otherNonCashBenefits: number;
  totalNonCashPay: number;
  globalIncome: number;
  housingType: string;
  rentOfHouse: number;
  computedRent: number;
  rentRecovered: number;
  netHousingValue: number;
  totalGrossPay: number;
  thirtyPercentCashPay: number;
  actualPensionNssf: number;
  permissibleLimit: number;
  mortgageInterest: number;
  hospDeposit: number;
  amountOfBenefit: number;
  taxablePay: number;
  taxChargedBeforeRelief: number;
  monthlyPersonalRelief: number;
  insuranceRelief: number;
  payeTaxNet: number;
  selfAssessedPaye: number;
  // Companion statutory columns for AHL / SHIF / NSSF sheet
  staffId: string;
  role: string;
  branchName: string;
  nssfNo: string;
  shifDeduction: number;
  employeeHousingLevy: number;
  employerHousingLevy: number;
  totalHousingLevy: number;
  netTakeHomePay: number;
  pinFormatValid: boolean;
}

export interface KraComputedDataset {
  periodLabel: string;
  periodStartKra: string;
  periodEndKra: string;
  fileSlug: string;
  vatSalesSecB: KraVatSalesRow[];
  vatZeroRatedSecC: KraVatSalesRow[];
  vatCreditNotes: KraVatSalesRow[];
  vatPurchasesSecF: KraVatPurchaseRow[];
  payeP10Rows: KraPayeP10Row[];
  payeSourceLabel: string;
  summary: {
    pinSalesTaxable: number;
    pinSalesVat: number;
    walkInSalesTaxable: number;
    walkInSalesVat: number;
    zeroRatedSalesTaxable: number;
    creditNotesTaxable: number;
    creditNotesVat: number;
    netTaxableSales: number;
    totalOutputVat: number;
    localPurchasesTaxable: number;
    localPurchasesVat: number;
    importPurchasesTaxable: number;
    importPurchasesVat: number;
    totalInputVat: number;
    netVatPayableOrClaimable: number;
    grossTurnoverForTot: number;
    turnoverTax3Pct: number;
    excisableLitresSold: number;
    totalPayrollGross: number;
    totalPayePayable: number;
    totalShifPayable: number;
    totalNssfEmployee: number;
    totalHousingLevyCombined: number;
  };
}

const TAXPAYER_CONFIG_STORAGE_KEY = 'vaairo_kra_taxpayer_config_v1';
const SUPPLIER_EXPENSES_STORAGE_KEY = 'vaairo_kra_supplier_expenses_v1';

export const KRA_PIN_REGEX = /^[AP]\d{9}[A-Z]$/;

export function normalizeKraPin(raw?: string | null): string {
  if (!raw) return '';
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidKraPin(raw?: string | null): boolean {
  const clean = normalizeKraPin(raw);
  if (!clean) return false;
  return KRA_PIN_REGEX.test(clean);
}

export function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Formats any ISO or YYYY-MM-DD date string to KRA iTax required DD/MM/YYYY format.
 */
export function formatKraDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    return `${String(fallback.getDate()).padStart(2, '0')}/${String(fallback.getMonth() + 1).padStart(2, '0')}/${fallback.getFullYear()}`;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function loadKraTaxpayerConfig(): KraTaxpayerConfig {
  const defaults: KraTaxpayerConfig = {
    companyKraPin: DEFAULT_BRANDING_CONFIG.kraPin || 'P051829301A',
    companyLegalName: DEFAULT_BRANDING_CONFIG.companyName || 'VAAIRO BEVERAGES & LIQUOR HUB LTD',
    etimsControlUnitSerial: 'KRAMW00928172',
    vatRatePercent: 16,
    pricesAreVatInclusive: true,
    consolidateWalkInSales: true,
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem(TAXPAYER_CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      companyKraPin: normalizeKraPin(parsed.companyKraPin) || defaults.companyKraPin,
      companyLegalName: parsed.companyLegalName || defaults.companyLegalName,
      etimsControlUnitSerial: parsed.etimsControlUnitSerial || defaults.etimsControlUnitSerial,
      vatRatePercent: typeof parsed.vatRatePercent === 'number' ? parsed.vatRatePercent : 16,
      pricesAreVatInclusive:
        typeof parsed.pricesAreVatInclusive === 'boolean' ? parsed.pricesAreVatInclusive : true,
      consolidateWalkInSales:
        typeof parsed.consolidateWalkInSales === 'boolean' ? parsed.consolidateWalkInSales : true,
    };
  } catch {
    return defaults;
  }
}

export function saveKraTaxpayerConfig(config: KraTaxpayerConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      TAXPAYER_CONFIG_STORAGE_KEY,
      JSON.stringify({
        ...config,
        companyKraPin: normalizeKraPin(config.companyKraPin),
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function loadKraSupplierExpenses(): KraSupplierExpenseEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SUPPLIER_EXPENSES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveKraSupplierExpenses(entries: KraSupplierExpenseEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SUPPLIER_EXPENSES_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
}

function isDateWithinPeriod(
  isoDateStr: string | undefined,
  mode: KraPeriodFilterMode,
  selectedMonthYm: string, // YYYY-MM
  customStart: string, // YYYY-MM-DD
  customEnd: string // YYYY-MM-DD
): boolean {
  if (mode === 'ALL_TIME') return true;
  if (!isoDateStr) return false;
  const d = new Date(isoDateStr);
  if (Number.isNaN(d.getTime())) return false;

  if (mode === 'MONTH') {
    const [yr, mo] = selectedMonthYm.split('-').map(Number);
    if (!yr || !mo) return true;
    return d.getFullYear() === yr && d.getMonth() + 1 === mo;
  }

  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date(0);
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date(8640000000000000);
  return d >= start && d <= end;
}

function summarizeLineItemsDescription(itemsSummaryJson: string, fallbackType: string): {
  description: string;
  totalBottlesSold: number;
  parsedItems: LineItem[];
} {
  try {
    const parsed: LineItem[] = JSON.parse(itemsSummaryJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const totalBottlesSold = parsed.reduce((acc, it) => acc + (Number(it.totalBottles) || 0), 0);
      const names = parsed
        .slice(0, 3)
        .map((it) => `${it.quantityUnits}x ${it.name}`)
        .join('; ');
      const suffix = parsed.length > 3 ? ` (+${parsed.length - 3} more)` : '';
      return {
        description: `${names}${suffix}`.slice(0, 140),
        totalBottlesSold,
        parsedItems: parsed,
      };
    }
  } catch {
    // ignore malformed JSON
  }
  return {
    description: `${fallbackType} Commercial Beverage Supply`,
    totalBottlesSold: 0,
    parsedItems: [],
  };
}

/**
 * Resolves a buyer's KRA PIN from the transaction, external customer directory, or trade partner directory.
 */
function resolveBuyerKraPin(
  tx: TransactionDoc,
  externalCustomers: ExternalCustomer[],
  partners: Partner[]
): string {
  const direct = normalizeKraPin(tx.customerKraPin);
  if (isValidKraPin(direct)) return direct;

  const licCandidate = normalizeKraPin(tx.customerLicenseNo);
  if (isValidKraPin(licCandidate)) return licCandidate;

  const custNameLower = (tx.customerName || '').trim().toLowerCase();
  if (custNameLower) {
    const matchedExt = externalCustomers.find(
      (c) =>
        (tx.customerId && c.id === tx.customerId) ||
        c.name.trim().toLowerCase() === custNameLower ||
        (c.companyName && c.companyName.trim().toLowerCase() === custNameLower)
    );
    if (matchedExt?.kraPin) {
      const extPin = normalizeKraPin(matchedExt.kraPin);
      if (extPin) return extPin;
    }

    const matchedPartner = partners.find(
      (p) =>
        p.companyName.trim().toLowerCase() === custNameLower ||
        (tx.customerLicenseNo && p.liquorLicenseNo === tx.customerLicenseNo)
    );
    if (matchedPartner?.taxPin) {
      const pPin = normalizeKraPin(matchedPartner.taxPin);
      if (pPin) return pPin;
    }
  }

  return direct;
}

/**
 * Computes the complete KRA Returns dataset from live ERP records with zero mock data.
 */
export function buildKraReturnsDataset(params: {
  config: KraTaxpayerConfig;
  periodMode: KraPeriodFilterMode;
  selectedMonthYm: string; // e.g. '2026-10'
  customStartDate: string; // YYYY-MM-DD
  customEndDate: string; // YYYY-MM-DD
  branchFilterId: string; // 'ALL' or branchId
  transactions: TransactionDoc[];
  products: Product[];
  partners: Partner[];
  externalCustomers: ExternalCustomer[];
  staffList: StaffMember[];
  payrollRuns: PayrollRun[];
  complianceRecords: ComplianceRecord[];
  regions: GeoRegion[];
  manualSupplierExpenses: KraSupplierExpenseEntry[];
}): KraComputedDataset {
  const {
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
    manualSupplierExpenses,
  } = params;

  // Compute human period label & DD/MM/YYYY start/end
  let periodLabel = 'All Recorded Periods';
  let periodStartKra = '01/01/2026';
  let periodEndKra = formatKraDate(new Date());
  let fileSlug = 'ALL_PERIODS';

  if (periodMode === 'MONTH' && selectedMonthYm) {
    const [yr, mo] = selectedMonthYm.split('-').map(Number);
    const startObj = new Date(yr, mo - 1, 1);
    const endObj = new Date(yr, mo, 0);
    periodLabel = startObj.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
    periodStartKra = formatKraDate(startObj);
    periodEndKra = formatKraDate(endObj);
    fileSlug = selectedMonthYm;
  } else if (periodMode === 'CUSTOM_RANGE') {
    periodLabel = `${customStartDate || 'Start'} to ${customEndDate || 'Today'}`;
    periodStartKra = customStartDate ? formatKraDate(customStartDate) : '01/01/2026';
    periodEndKra = customEndDate ? formatKraDate(customEndDate) : formatKraDate(new Date());
    fileSlug = `${customStartDate || 'START'}_${customEndDate || 'END'}`;
  }

  const vatRateDec = Math.max(0, config.vatRatePercent) / 100;

  // Map invoice docNumbers -> createdAt for Credit Note reference lookup
  const invoiceDateByNumber = new Map<string, string>();
  transactions.forEach((t) => {
    if (t.docNumber && (t.docType === 'Invoice' || t.docType === 'Receipt' || t.docType === 'Online Order')) {
      invoiceDateByNumber.set(t.docNumber.trim().toUpperCase(), formatKraDate(t.createdAt));
    }
  });

  // Filter period transactions
  const periodTx = transactions.filter((tx) => {
    if (branchFilterId !== 'ALL' && tx.branchId !== branchFilterId) return false;
    return isDateWithinPeriod(tx.createdAt, periodMode, selectedMonthYm, customStartDate, customEndDate);
  });

  const b2bPinSales: KraVatSalesRow[] = [];
  const walkInRawSales: KraVatSalesRow[] = [];
  const zeroRatedSales: KraVatSalesRow[] = [];
  const creditNoteRows: KraVatSalesRow[] = [];

  let excisableLitresSold = 0;

  periodTx.forEach((tx) => {
    const isSaleDoc =
      tx.docType === 'Invoice' || tx.docType === 'Receipt' || tx.docType === 'Online Order';
    const isCreditNote = tx.docType === 'Credit Note';
    if (!isSaleDoc && !isCreditNote) return;

    const { description, parsedItems } = summarizeLineItemsDescription(tx.itemsSummary, tx.docType);

    // Compute excisable litres from sold product bottles
    if (isSaleDoc) {
      parsedItems.forEach((item) => {
        const matchedProd = products.find((p) => p.id === item.productId || p.sku === item.sku);
        const volMl = matchedProd?.volumeMl || 750;
        const bottles = Number(item.totalBottles) || 0;
        if (bottles > 0) {
          excisableLitresSold += (bottles * volMl) / 1000;
        }
      });
    }

    const region = regions.find((r) => r.id === tx.regionId || r.name === tx.regionName);
    const isZeroRatedExport =
      region?.tierType === 'Duty-Free / Export' || (region && region.regionalTaxRate === 0);

    // Determine exact taxable value & VAT amount
    let taxableValue = 0;
    let vatAmount = 0;
    const totalAmt = Math.abs(Number(tx.totalAmount) || 0);
    const subAmt = Math.abs(Number(tx.subtotal) || 0);
    const taxAmt = Math.abs(Number(tx.exciseAndTax) || 0);

    if (isZeroRatedExport) {
      taxableValue = round2(totalAmt);
      vatAmount = 0;
    } else if (subAmt > 0 && taxAmt > 0 && Math.abs(subAmt + taxAmt - totalAmt) <= 5) {
      taxableValue = round2(subAmt);
      vatAmount = round2(taxAmt);
    } else if (config.pricesAreVatInclusive && vatRateDec > 0) {
      taxableValue = round2(totalAmt / (1 + vatRateDec));
      vatAmount = round2(totalAmt - taxableValue);
    } else {
      taxableValue = round2(totalAmt);
      vatAmount = round2(taxableValue * vatRateDec);
    }

    const buyerPin = resolveBuyerKraPin(tx, externalCustomers, partners);
    const hasValidPin = isValidKraPin(buyerPin);

    if (isCreditNote) {
      const refNo = (tx.relatedInvoiceNo || '').trim();
      const refDate =
        (refNo && invoiceDateByNumber.get(refNo.toUpperCase())) || formatKraDate(tx.createdAt);

      creditNoteRows.push({
        purchaserPin: buyerPin,
        purchaserName: tx.customerName || 'Trade Credit Account',
        etrSerialNumber: config.etimsControlUnitSerial,
        invoiceDateKra: formatKraDate(tx.createdAt),
        invoiceNumber: tx.docNumber,
        description: tx.creditReason ? `Credit Note: ${tx.creditReason}` : description,
        taxableValueKes: -Math.abs(taxableValue),
        vatAmountKes: -Math.abs(vatAmount),
        grossAmountKes: -Math.abs(round2(taxableValue + vatAmount)),
        relevantInvoiceNumber: refNo,
        relevantInvoiceDateKra: refDate,
        rowCategory: 'CREDIT_NOTE',
        pinFormatValid: buyerPin ? hasValidPin : true,
      });
      return;
    }

    if (isZeroRatedExport) {
      zeroRatedSales.push({
        purchaserPin: buyerPin,
        purchaserName: tx.customerName || 'Export Consignee',
        etrSerialNumber: config.etimsControlUnitSerial,
        invoiceDateKra: formatKraDate(tx.createdAt),
        invoiceNumber: tx.docNumber,
        description,
        taxableValueKes: taxableValue,
        vatAmountKes: 0,
        grossAmountKes: taxableValue,
        relevantInvoiceNumber: '',
        relevantInvoiceDateKra: '',
        rowCategory: 'ZERO_RATED',
        pinFormatValid: buyerPin ? hasValidPin : true,
      });
      return;
    }

    if (buyerPin) {
      b2bPinSales.push({
        purchaserPin: buyerPin,
        purchaserName: tx.customerName || 'Registered Trade Buyer',
        etrSerialNumber: config.etimsControlUnitSerial,
        invoiceDateKra: formatKraDate(tx.createdAt),
        invoiceNumber: tx.docNumber,
        description,
        taxableValueKes: taxableValue,
        vatAmountKes: vatAmount,
        grossAmountKes: round2(taxableValue + vatAmount),
        relevantInvoiceNumber: '',
        relevantInvoiceDateKra: '',
        rowCategory: 'B2B_PIN_SALE',
        pinFormatValid: hasValidPin,
      });
    } else {
      walkInRawSales.push({
        purchaserPin: '',
        purchaserName: tx.customerName || 'Walk-In Retail Customer',
        etrSerialNumber: config.etimsControlUnitSerial,
        invoiceDateKra: formatKraDate(tx.createdAt),
        invoiceNumber: tx.docNumber,
        description,
        taxableValueKes: taxableValue,
        vatAmountKes: vatAmount,
        grossAmountKes: round2(taxableValue + vatAmount),
        relevantInvoiceNumber: '',
        relevantInvoiceDateKra: '',
        rowCategory: 'WALK_IN_ITEMIZED',
        pinFormatValid: true,
      });
    }
  });

  // Consolidate or itemize walk-in non-PIN sales per KRA VAT3 rules
  let finalWalkInRows: KraVatSalesRow[] = walkInRawSales;
  if (config.consolidateWalkInSales && walkInRawSales.length > 0) {
    // Group by DD/MM/YYYY date so daily Z-report / POS lump sum totals align cleanly with ETR/eTIMS daily totals
    const byDate = new Map<
      string,
      { count: number; firstDoc: string; lastDoc: string; taxable: number; vat: number; gross: number }
    >();
    walkInRawSales.forEach((r) => {
      const existing = byDate.get(r.invoiceDateKra);
      if (!existing) {
        byDate.set(r.invoiceDateKra, {
          count: 1,
          firstDoc: r.invoiceNumber,
          lastDoc: r.invoiceNumber,
          taxable: r.taxableValueKes,
          vat: r.vatAmountKes,
          gross: r.grossAmountKes,
        });
      } else {
        existing.count += 1;
        existing.lastDoc = r.invoiceNumber;
        existing.taxable = round2(existing.taxable + r.taxableValueKes);
        existing.vat = round2(existing.vat + r.vatAmountKes);
        existing.gross = round2(existing.gross + r.grossAmountKes);
      }
    });

    finalWalkInRows = Array.from(byDate.entries()).map(([dateKra, agg]) => ({
      purchaserPin: '',
      purchaserName: `CASH / POS RETAIL CUSTOMERS (${agg.count} RECEIPT${agg.count === 1 ? '' : 'S'})`,
      etrSerialNumber: config.etimsControlUnitSerial,
      invoiceDateKra: dateKra,
      invoiceNumber: agg.count === 1 ? agg.firstDoc : `${agg.firstDoc}-${agg.lastDoc.split('-').pop()}`,
      description: 'Consolidated Walk-In Retail Beverage Sales (No Buyer PIN)',
      taxableValueKes: agg.taxable,
      vatAmountKes: agg.vat,
      grossAmountKes: agg.gross,
      relevantInvoiceNumber: '',
      relevantInvoiceDateKra: '',
      rowCategory: 'LUMP_SUM_CASH',
      pinFormatValid: true,
    }));
  }

  // Section B combines B2B PIN sales + Walk-In Sales + Credit Notes (which offset output VAT in KRA VAT3)
  const vatSalesSecB: KraVatSalesRow[] = [
    ...b2bPinSales,
    ...finalWalkInRows,
    ...creditNoteRows,
  ];

  // =========================================================================
  // SECTION F: PURCHASES & INPUT VAT (ERP Stock Purchases + Customs + Bills)
  // =========================================================================
  const vatPurchasesSecF: KraVatPurchaseRow[] = [];
  const suppliers = partners.filter((p) => p.partnerType === 'Supplier');

  // 1. Real Stock Purchase Invoices linked on Products in period
  products.forEach((prod) => {
    const prodDate = prod.linkedInvoiceDate || prod.createdAt;
    const hasInvoiceOrEntry = Boolean(
      prod.linkedInvoiceNumber || prod.importDeclarationNumber || prod.importEntryRef || prod.supplierName
    );
    if (!hasInvoiceOrEntry) return;
    if (!isDateWithinPeriod(prodDate, periodMode, selectedMonthYm, customStartDate, customEndDate)) {
      return;
    }

    const bottles = Number(prod.totalBottles) || 0;
    const unitCost = Number(prod.warehouseCostKes ?? prod.baseLandedCost ?? 0);
    if (bottles <= 0 || unitCost <= 0) return;

    const totalCost = round2(bottles * unitCost);
    const taxableCost = config.pricesAreVatInclusive && vatRateDec > 0
      ? round2(totalCost / (1 + vatRateDec))
      : totalCost;
    const inputVat = round2(
      config.pricesAreVatInclusive && vatRateDec > 0
        ? totalCost - taxableCost
        : taxableCost * vatRateDec
    );

    const matchedSupplier = suppliers.find(
      (s) =>
        prod.supplierName &&
        s.companyName.trim().toLowerCase() === prod.supplierName.trim().toLowerCase()
    );
    const supPin = normalizeKraPin(matchedSupplier?.taxPin || '');
    const isImport =
      prod.category === 'IPS' || Boolean(prod.importDeclarationNumber || prod.importEntryRef);

    vatPurchasesSecF.push({
      purchaseType: isImport ? 'Import' : 'Local',
      supplierPin: supPin,
      supplierName: prod.supplierName || matchedSupplier?.companyName || 'Bonded Beverage Supplier',
      invoiceDateKra: formatKraDate(prodDate),
      invoiceNumber: prod.linkedInvoiceNumber || `STK-${prod.sku}`,
      description: `${bottles} btls ${prod.name} (${prod.volumeMl}ml)`,
      customEntryNumber: isImport
        ? prod.importDeclarationNumber || prod.importEntryRef || ''
        : '',
      taxableValueKes: taxableCost,
      vatAmountKes: inputVat,
      relevantInvoiceNumber: '',
      relevantInvoiceDateKra: '',
      sourceLabel: 'ERP Stock Invoice',
      pinFormatValid: supPin ? isValidKraPin(supPin) : !isImport ? false : true,
    });
  });

  // 2. Customs Import Bond entries from Compliance Records in period
  complianceRecords.forEach((rec) => {
    if (rec.recordType !== 'Customs Import Bond') return;
    if (rec.dutyPaidAmount <= 0) return;
    if (!isDateWithinPeriod(rec.createdAt, periodMode, selectedMonthYm, customStartDate, customEndDate)) {
      return;
    }
    const taxableVal = round2(rec.dutyPaidAmount);
    const vatVal = round2(taxableVal * vatRateDec);
    vatPurchasesSecF.push({
      purchaseType: 'Import',
      supplierPin: '',
      supplierName: 'KENYA REVENUE AUTHORITY - CUSTOMS & BORDER CONTROL',
      invoiceDateKra: formatKraDate(rec.createdAt),
      invoiceNumber: rec.certificateNo,
      description: `Customs Import Bond Clearance (${rec.skuRef || rec.branchName})`,
      customEntryNumber: rec.certificateNo,
      taxableValueKes: taxableVal,
      vatAmountKes: vatVal,
      relevantInvoiceNumber: '',
      relevantInvoiceDateKra: '',
      sourceLabel: 'Customs / Excise Entry',
      pinFormatValid: true,
    });
  });

  // 3. User-recorded Supplier / Expense eTIMS Tax Invoices in period
  manualSupplierExpenses.forEach((exp) => {
    if (!isDateWithinPeriod(exp.invoiceDate, periodMode, selectedMonthYm, customStartDate, customEndDate)) {
      return;
    }
    const cleanPin = normalizeKraPin(exp.supplierPin);
    vatPurchasesSecF.push({
      purchaseType: exp.purchaseType,
      supplierPin: cleanPin,
      supplierName: exp.supplierName,
      invoiceDateKra: formatKraDate(exp.invoiceDate),
      invoiceNumber: exp.invoiceNumber,
      description: exp.description,
      customEntryNumber: exp.purchaseType === 'Import' ? exp.customEntryNumber || '' : '',
      taxableValueKes: round2(exp.taxableValueKes),
      vatAmountKes: round2(exp.vatAmountKes),
      relevantInvoiceNumber: '',
      relevantInvoiceDateKra: '',
      sourceLabel: 'Supplier Expense Bill',
      pinFormatValid: cleanPin ? isValidKraPin(cleanPin) : exp.purchaseType === 'Import',
    });
  });

  // =========================================================================
  // PAYE P10 (SHEET B: EMPLOYEE DETAILS) & STATUTORY (AHL, SHIF, NSSF)
  // =========================================================================
  // Match finalized PayrollRun for selected month if available
  let matchedPayrollRun: PayrollRun | undefined;
  if (periodMode === 'MONTH' && selectedMonthYm) {
    const [yr, mo] = selectedMonthYm.split('-').map(Number);
    const targetMonthName = new Date(yr, mo - 1, 1)
      .toLocaleDateString('en-US', { month: 'long' })
      .toLowerCase();
    matchedPayrollRun = payrollRuns.find((run) => {
      const pLower = (run.period || '').toLowerCase();
      return (
        (pLower.includes(targetMonthName) && pLower.includes(String(yr))) ||
        isDateWithinPeriod(run.runDate, periodMode, selectedMonthYm, customStartDate, customEndDate)
      );
    });
  } else if (payrollRuns.length > 0) {
    matchedPayrollRun = payrollRuns[0];
  }

  const payeP10Rows: KraPayeP10Row[] = [];
  let payeSourceLabel = 'Live Active Staff Roster';

  const buildP10RowFromGross = (info: {
    staffId: string;
    name: string;
    role: string;
    branchName: string;
    kraPin: string;
    nssfNo: string;
    basicSalary: number;
  }): KraPayeP10Row => {
    const basic = round2(Math.max(0, info.basicSalary));
    const { totalNssf } = calculateNssf(basic);
    const shif = calculateShif(basic);
    const empAhl = calculateHousingLevy(basic);
    const employerAhl = empAhl;
    const netPaye = calculatePaye(basic, totalNssf);
    const personalRelief = basic > 24000 ? 2400 : round2(Math.min(2400, basic * 0.1));
    const taxChargedBeforeRelief = round2(netPaye + (netPaye > 0 ? 2400 : personalRelief));
    const taxablePay = round2(Math.max(0, basic - totalNssf));
    const netTakeHome = round2(Math.max(0, basic - totalNssf - shif - empAhl - netPaye));
    const cleanPin = normalizeKraPin(info.kraPin);

    return {
      employeePin: cleanPin,
      employeeName: info.name,
      residentialStatus: 'Resident',
      employeeType: 'Primary Employee',
      basicSalary: basic,
      houseAllowance: 0,
      transportAllowance: 0,
      leavePay: 0,
      overtimeAllowance: 0,
      directorsFee: 0,
      lumpSumPayment: 0,
      otherAllowance: 0,
      totalCashPay: basic,
      carBenefit: 0,
      otherNonCashBenefits: 0,
      totalNonCashPay: 0,
      globalIncome: 0,
      housingType: 'Benefit not given',
      rentOfHouse: 0,
      computedRent: 0,
      rentRecovered: 0,
      netHousingValue: 0,
      totalGrossPay: basic,
      thirtyPercentCashPay: round2(basic * 0.3),
      actualPensionNssf: totalNssf,
      permissibleLimit: 30000,
      mortgageInterest: 0,
      hospDeposit: 0,
      amountOfBenefit: totalNssf,
      taxablePay,
      taxChargedBeforeRelief,
      monthlyPersonalRelief: 2400,
      insuranceRelief: 0,
      payeTaxNet: netPaye,
      selfAssessedPaye: netPaye,
      staffId: info.staffId,
      role: info.role,
      branchName: info.branchName,
      nssfNo: info.nssfNo || '',
      shifDeduction: shif,
      employeeHousingLevy: empAhl,
      employerHousingLevy: employerAhl,
      totalHousingLevy: round2(empAhl + employerAhl),
      netTakeHomePay: netTakeHome,
      pinFormatValid: isValidKraPin(cleanPin),
    };
  };

  if (matchedPayrollRun) {
    payeSourceLabel = `Finalized Payroll Run (${matchedPayrollRun.period})`;
    let runRecords: PayrollRecord[] = [];
    try {
      runRecords = JSON.parse(matchedPayrollRun.recordsJson);
    } catch {
      runRecords = [];
    }
    runRecords
      .filter((rec) => {
        if (branchFilterId === 'ALL') return true;
        const staffMatch = staffList.find((s) => s.id === rec.staffId);
        return staffMatch ? staffMatch.branchId === branchFilterId : true;
      })
      .forEach((rec) => {
        const staffMatch = staffList.find((s) => s.id === rec.staffId);
        payeP10Rows.push(
          buildP10RowFromGross({
            staffId: rec.staffId,
            name: rec.staffName,
            role: rec.staffRole,
            branchName: rec.branchName,
            kraPin: rec.kraPin || staffMatch?.kraPin || '',
            nssfNo: rec.nssfNo || staffMatch?.nssfNo || '',
            basicSalary: rec.baseSalary,
          })
        );
      });
  } else {
    staffList
      .filter((s) => {
        if (s.status !== 'Active') return false;
        if (branchFilterId !== 'ALL' && s.branchId !== branchFilterId) return false;
        return true;
      })
      .forEach((s) => {
        const defaultBase =
          s.baseSalaryKes ??
          (s.role === 'Admin'
            ? 180000
            : s.role === 'Accountant'
            ? 120000
            : s.role === 'Branch Manager'
            ? 95000
            : 65000);
        payeP10Rows.push(
          buildP10RowFromGross({
            staffId: s.id,
            name: s.name,
            role: s.role,
            branchName: s.branchName,
            kraPin: s.kraPin || '',
            nssfNo: s.nssfNo || '',
            basicSalary: defaultBase,
          })
        );
      });
  }

  // =========================================================================
  // AGGREGATE SUMMARY TOTALS
  // =========================================================================
  const pinSalesTaxable = round2(b2bPinSales.reduce((s, r) => s + r.taxableValueKes, 0));
  const pinSalesVat = round2(b2bPinSales.reduce((s, r) => s + r.vatAmountKes, 0));
  const walkInSalesTaxable = round2(finalWalkInRows.reduce((s, r) => s + r.taxableValueKes, 0));
  const walkInSalesVat = round2(finalWalkInRows.reduce((s, r) => s + r.vatAmountKes, 0));
  const zeroRatedSalesTaxable = round2(zeroRatedSales.reduce((s, r) => s + r.taxableValueKes, 0));
  const creditNotesTaxable = round2(creditNoteRows.reduce((s, r) => s + Math.abs(r.taxableValueKes), 0));
  const creditNotesVat = round2(creditNoteRows.reduce((s, r) => s + Math.abs(r.vatAmountKes), 0));

  const netTaxableSales = round2(
    pinSalesTaxable + walkInSalesTaxable + zeroRatedSalesTaxable - creditNotesTaxable
  );
  const totalOutputVat = round2(pinSalesVat + walkInSalesVat - creditNotesVat);

  const localPurchases = vatPurchasesSecF.filter((p) => p.purchaseType === 'Local');
  const importPurchases = vatPurchasesSecF.filter((p) => p.purchaseType === 'Import');

  const localPurchasesTaxable = round2(localPurchases.reduce((s, r) => s + r.taxableValueKes, 0));
  const localPurchasesVat = round2(localPurchases.reduce((s, r) => s + r.vatAmountKes, 0));
  const importPurchasesTaxable = round2(importPurchases.reduce((s, r) => s + r.taxableValueKes, 0));
  const importPurchasesVat = round2(importPurchases.reduce((s, r) => s + r.vatAmountKes, 0));
  const totalInputVat = round2(localPurchasesVat + importPurchasesVat);

  const netVatPayableOrClaimable = round2(totalOutputVat - totalInputVat);
  const grossTurnoverForTot = round2(Math.max(0, netTaxableSales + totalOutputVat));
  const turnoverTax3Pct = round2(Math.max(0, netTaxableSales * 0.03));

  const totalPayrollGross = round2(payeP10Rows.reduce((s, r) => s + r.totalGrossPay, 0));
  const totalPayePayable = round2(payeP10Rows.reduce((s, r) => s + r.payeTaxNet, 0));
  const totalShifPayable = round2(payeP10Rows.reduce((s, r) => s + r.shifDeduction, 0));
  const totalNssfEmployee = round2(payeP10Rows.reduce((s, r) => s + r.actualPensionNssf, 0));
  const totalHousingLevyCombined = round2(payeP10Rows.reduce((s, r) => s + r.totalHousingLevy, 0));

  return {
    periodLabel,
    periodStartKra,
    periodEndKra,
    fileSlug,
    vatSalesSecB,
    vatZeroRatedSecC: zeroRatedSales,
    vatCreditNotes: creditNoteRows,
    vatPurchasesSecF,
    payeP10Rows,
    payeSourceLabel,
    summary: {
      pinSalesTaxable,
      pinSalesVat,
      walkInSalesTaxable,
      walkInSalesVat,
      zeroRatedSalesTaxable,
      creditNotesTaxable,
      creditNotesVat,
      netTaxableSales,
      totalOutputVat,
      localPurchasesTaxable,
      localPurchasesVat,
      importPurchasesTaxable,
      importPurchasesVat,
      totalInputVat,
      netVatPayableOrClaimable,
      grossTurnoverForTot,
      turnoverTax3Pct,
      excisableLitresSold: round2(excisableLitresSold),
      totalPayrollGross,
      totalPayePayable,
      totalShifPayable,
      totalNssfEmployee,
      totalHousingLevyCombined,
    },
  };
}

// ============================================================================
// STANDARDIZED KRA iTAX SHEET COLUMN BUILDERS
// ============================================================================

const VAT3_SEC_B_HEADERS = [
  'PIN of Purchaser',
  'Name of Purchaser',
  'ETR Serial Number',
  'Invoice Date',
  'Invoice Number',
  'Description of Goods / Services',
  'Taxable Value (Ksh)',
  'Amount of VAT (Ksh)',
  'Relevant Invoice Number',
  'Relevant Invoice Date',
];

const VAT3_SEC_F_HEADERS = [
  'Type of Purchases',
  'PIN of Supplier',
  'Name of Supplier',
  'Invoice Date',
  'Invoice Number',
  'Description of Goods / Services',
  'Custom Entry Number',
  'Taxable Value (Ksh)',
  'Amount of VAT (Ksh)',
  'Relevant Invoice Number',
  'Relevant Invoice Date',
];

const PAYE_P10_SEC_B_HEADERS = [
  'PIN of Employee',
  'Name of Employee',
  'Residential Status',
  'Type of Employee',
  'Basic Salary',
  'House Allowance',
  'Transport Allowance',
  'Leave Pay',
  'Overtime Allowance',
  'Directors Fee',
  'Lump Sum Payment if any',
  'Other Allowance',
  'Total Cash Pay',
  'Value of Car Benefit',
  'Other Non Cash Benefits',
  'Total Non Cash Pay',
  'Global Income',
  'Type of Housing',
  'Rent of House/Market Value',
  'Computed Rent of House',
  'Rent Recovered from Employee',
  'Net Value of Housing',
  'Total Gross Pay',
  '30% of Cash Pay',
  'Actual Contribution',
  'Permissible Limit',
  'Mortgage Interest',
  'Deposit on Home Ownership Savings Plan',
  'Amount of Benefit',
  'Taxable Pay',
  'Tax Charged',
  'Monthly Personal Relief',
  'Amount of Insurance Relief',
  'PAYE Tax (Ksh)',
  'Self Assessed PAYE Tax (Ksh)',
];

const STATUTORY_AHL_SHIF_NSSF_HEADERS = [
  'Employee KRA PIN',
  'Employee Full Name',
  'Staff ID',
  'Role / Designation',
  'Branch Depot',
  'NSSF Member No',
  'Gross Monthly Pay (Ksh)',
  'Employee Housing Levy 1.5% (Ksh)',
  'Employer Housing Levy 1.5% (Ksh)',
  'Total AHL Remittance 3.0% (Ksh)',
  'SHIF Contribution 2.75% (Ksh)',
  'NSSF Tier I & II Employee (Ksh)',
  'NSSF Employer Match (Ksh)',
  'Net PAYE Tax (Ksh)',
  'Net Salary Payable (Ksh)',
];

function mapVatSecBRows(rows: KraVatSalesRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.purchaserPin,
    r.purchaserName,
    r.etrSerialNumber,
    r.invoiceDateKra,
    r.invoiceNumber,
    r.description,
    r.taxableValueKes,
    r.vatAmountKes,
    r.relevantInvoiceNumber,
    r.relevantInvoiceDateKra,
  ]);
}

function mapVatSecFRows(rows: KraVatPurchaseRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.purchaseType,
    r.supplierPin,
    r.supplierName,
    r.invoiceDateKra,
    r.invoiceNumber,
    r.description,
    r.customEntryNumber,
    r.taxableValueKes,
    r.vatAmountKes,
    r.relevantInvoiceNumber,
    r.relevantInvoiceDateKra,
  ]);
}

function mapPayeP10Rows(rows: KraPayeP10Row[]): (string | number)[][] {
  return rows.map((r) => [
    r.employeePin,
    r.employeeName,
    r.residentialStatus,
    r.employeeType,
    r.basicSalary,
    r.houseAllowance,
    r.transportAllowance,
    r.leavePay,
    r.overtimeAllowance,
    r.directorsFee,
    r.lumpSumPayment,
    r.otherAllowance,
    r.totalCashPay,
    r.carBenefit,
    r.otherNonCashBenefits,
    r.totalNonCashPay,
    r.globalIncome,
    r.housingType,
    r.rentOfHouse,
    r.computedRent,
    r.rentRecovered,
    r.netHousingValue,
    r.totalGrossPay,
    r.thirtyPercentCashPay,
    r.actualPensionNssf,
    r.permissibleLimit,
    r.mortgageInterest,
    r.hospDeposit,
    r.amountOfBenefit,
    r.taxablePay,
    r.taxChargedBeforeRelief,
    r.monthlyPersonalRelief,
    r.insuranceRelief,
    r.payeTaxNet,
    r.selfAssessedPaye,
  ]);
}

function mapStatutoryRows(rows: KraPayeP10Row[]): (string | number)[][] {
  return rows.map((r) => [
    r.employeePin,
    r.employeeName,
    r.staffId,
    r.role,
    r.branchName,
    r.nssfNo,
    r.totalGrossPay,
    r.employeeHousingLevy,
    r.employerHousingLevy,
    r.totalHousingLevy,
    r.shifDeduction,
    r.actualPensionNssf,
    r.actualPensionNssf,
    r.payeTaxNet,
    r.netTakeHomePay,
  ]);
}

function autoFitSheetColumns(aoa: (string | number)[][]): XLSX.ColInfo[] {
  if (aoa.length === 0) return [];
  const maxCols = Math.max(...aoa.map((r) => r.length));
  const widths: XLSX.ColInfo[] = [];
  for (let c = 0; c < maxCols; c++) {
    let maxLen = 12;
    for (let r = 0; r < Math.min(aoa.length, 200); r++) {
      const cell = aoa[r]?.[c];
      const len = cell !== undefined && cell !== null ? String(cell).length : 0;
      if (len > maxLen) maxLen = len;
    }
    widths.push({ wch: Math.min(Math.max(maxLen + 3, 13), 46) });
  }
  return widths;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the complete multi-sheet KRA iTax Master Return Workbook (.xlsx).
 * Every worksheet uses authentic KRA iTax column headers, DD/MM/YYYY dates, and unformatted numbers.
 */
export function downloadKraMasterWorkbookXlsx(
  dataset: KraComputedDataset,
  config: KraTaxpayerConfig
): string {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 01_VAT3_Summary (Executive & iTax Filing Summary)
  const summaryAoa: (string | number)[][] = [
    ['KENYA REVENUE AUTHORITY (KRA) - iTAX RETURN WORKBOOK'],
    ['Entity Legal Name', config.companyLegalName],
    ['Taxpayer KRA PIN', config.companyKraPin],
    ['eTIMS / ETR Control Unit Serial', config.etimsControlUnitSerial],
    ['Return Period', `${dataset.periodLabel} (${dataset.periodStartKra} to ${dataset.periodEndKra})`],
    ['Generated Timestamp', formatKraDate(new Date())],
    [],
    ['SECTION M - VAT3 MONTHLY RETURN CALCULATION SUMMARY', 'TAXABLE VALUE (KSH)', 'VAT AMOUNT (KSH)'],
    ['1. General Rate Sales (16%) - Registered Buyers with KRA PIN (Sec B)', dataset.summary.pinSalesTaxable, dataset.summary.pinSalesVat],
    ['2. General Rate Sales (16%) - Walk-In / POS Lump Sum Sales (Sec B)', dataset.summary.walkInSalesTaxable, dataset.summary.walkInSalesVat],
    ['3. Zero-Rated Supplies (0%) - Export / Duty-Free Zone (Sec C)', dataset.summary.zeroRatedSalesTaxable, 0],
    ['4. Less: Credit Notes Issued on Taxable Sales (Sec B)', -dataset.summary.creditNotesTaxable, -dataset.summary.creditNotesVat],
    ['TOTAL NET OUTPUT VAT & TAXABLE TURNOVER', dataset.summary.netTaxableSales, dataset.summary.totalOutputVat],
    [],
    ['INPUT TAX DEDUCTIBLE (SECTION F - PURCHASES @ 16%)', 'TAXABLE VALUE (KSH)', 'INPUT VAT (KSH)'],
    ['5. Local Vatable Purchases & Supplier eTIMS Invoices', dataset.summary.localPurchasesTaxable, dataset.summary.localPurchasesVat],
    ['6. Imported Goods & Customs Entry Clearances (IPS)', dataset.summary.importPurchasesTaxable, dataset.summary.importPurchasesVat],
    ['TOTAL DEDUCTIBLE INPUT VAT', round2(dataset.summary.localPurchasesTaxable + dataset.summary.importPurchasesTaxable), dataset.summary.totalInputVat],
    [],
    [
      dataset.summary.netVatPayableOrClaimable >= 0
        ? 'NET VAT PAYABLE TO KRA (OUTPUT VAT LESS INPUT VAT)'
        : 'NET VAT CREDIT CARRIED FORWARD (EXCESS INPUT VAT)',
      '',
      dataset.summary.netVatPayableOrClaimable,
    ],
    [],
    ['OTHER KRA MONTHLY STATUTORY OBLIGATIONS SUMMARY', 'BASE / GROSS (KSH)', 'TAX / LEVY PAYABLE (KSH)'],
    ['PAYE (P10 Monthly Employee Tax Remittance - Due 9th)', dataset.summary.totalPayrollGross, dataset.summary.totalPayePayable],
    ['Affordable Housing Levy (AHL 1.5% Emp + 1.5% Employer - Due 9th)', dataset.summary.totalPayrollGross, dataset.summary.totalHousingLevyCombined],
    ['SHIF Contribution (2.75% Social Health Insurance - Due 9th)', dataset.summary.totalPayrollGross, dataset.summary.totalShifPayable],
    ['NSSF Pension Contribution (Employee Tier I & II - Due 9th)', dataset.summary.totalPayrollGross, dataset.summary.totalNssfEmployee],
    ['Turnover Tax (TOT 3% Reference, if applicable - Due 20th)', dataset.summary.netTaxableSales, dataset.summary.turnoverTax3Pct],
    ['Excisable Beverage Volume Dispatched (Litres)', dataset.summary.excisableLitresSold, 0],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = autoFitSheetColumns(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, '01_VAT3_Summary');

  // Sheet 2: B_Sales_Invoices (KRA VAT3 Section B Upload Format)
  const secBAoa = [VAT3_SEC_B_HEADERS, ...mapVatSecBRows(dataset.vatSalesSecB)];
  const wsSecB = XLSX.utils.aoa_to_sheet(secBAoa);
  wsSecB['!cols'] = autoFitSheetColumns(secBAoa);
  XLSX.utils.book_append_sheet(wb, wsSecB, 'B_Sales_Invoices');

  // Sheet 3: F_Purchases_Invoices (KRA VAT3 Section F Upload Format)
  const secFAoa = [VAT3_SEC_F_HEADERS, ...mapVatSecFRows(dataset.vatPurchasesSecF)];
  const wsSecF = XLSX.utils.aoa_to_sheet(secFAoa);
  wsSecF['!cols'] = autoFitSheetColumns(secFAoa);
  XLSX.utils.book_append_sheet(wb, wsSecF, 'F_Purchases_Invoices');

  // Sheet 4: C_Zero_Rated_Sales (Zero-Rated / Export Sales)
  const secCAoa = [
    [
      'PIN of Purchaser',
      'Name of Purchaser',
      'ETR Serial Number',
      'Invoice Date',
      'Invoice Number',
      'Description of Goods / Services',
      'Custom Entry / Export No',
      'Taxable Value (Ksh)',
    ],
    ...dataset.vatZeroRatedSecC.map((r) => [
      r.purchaserPin,
      r.purchaserName,
      r.etrSerialNumber,
      r.invoiceDateKra,
      r.invoiceNumber,
      r.description,
      '',
      r.taxableValueKes,
    ]),
  ];
  const wsSecC = XLSX.utils.aoa_to_sheet(secCAoa);
  wsSecC['!cols'] = autoFitSheetColumns(secCAoa);
  XLSX.utils.book_append_sheet(wb, wsSecC, 'C_Zero_Rated_Sales');

  // Sheet 5: P10_B_Employee_Details (Exact 35-Column KRA iTax PAYE P10 Upload Sheet)
  const p10Aoa = [PAYE_P10_SEC_B_HEADERS, ...mapPayeP10Rows(dataset.payeP10Rows)];
  const wsP10 = XLSX.utils.aoa_to_sheet(p10Aoa);
  wsP10['!cols'] = autoFitSheetColumns(p10Aoa);
  XLSX.utils.book_append_sheet(wb, wsP10, 'P10_B_Employee_Details');

  // Sheet 6: AHL_SHIF_NSSF_Schedule (Housing Levy, SHIF & NSSF Remittance Sheet)
  const statAoa = [STATUTORY_AHL_SHIF_NSSF_HEADERS, ...mapStatutoryRows(dataset.payeP10Rows)];
  const wsStat = XLSX.utils.aoa_to_sheet(statAoa);
  wsStat['!cols'] = autoFitSheetColumns(statAoa);
  XLSX.utils.book_append_sheet(wb, wsStat, 'AHL_SHIF_NSSF_Schedule');

  // Sheet 7: TOT_And_Excise_Schedule
  const totAoa: (string | number)[][] = [
    [
      'Taxpayer KRA PIN',
      'Return Period From',
      'Return Period To',
      'Net Taxable Sales (Ksh)',
      'Gross Sales Incl VAT (Ksh)',
      'Turnover Tax @ 3% (Ksh)',
      'Excisable Volume Sold (Litres)',
    ],
    [
      config.companyKraPin,
      dataset.periodStartKra,
      dataset.periodEndKra,
      dataset.summary.netTaxableSales,
      dataset.summary.grossTurnoverForTot,
      dataset.summary.turnoverTax3Pct,
      dataset.summary.excisableLitresSold,
    ],
  ];
  const wsTot = XLSX.utils.aoa_to_sheet(totAoa);
  wsTot['!cols'] = autoFitSheetColumns(totAoa);
  XLSX.utils.book_append_sheet(wb, wsTot, 'TOT_And_Excise');

  const outBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([outBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = `KRA_iTax_Returns_${config.companyKraPin}_${dataset.fileSlug}.xlsx`;
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Downloads a specific KRA iTax Upload CSV schedule (.csv) formatted for direct import into KRA's iTax template/portal.
 * Optionally omits the header row when `includeHeaders` is false (some KRA Excel macro imports accept headerless CSVs).
 */
export function downloadKraScheduleCsv(
  schedule: KraReturnScheduleType,
  dataset: KraComputedDataset,
  config: KraTaxpayerConfig,
  includeHeaders: boolean = true
): string {
  let headers: string[] = [];
  let bodyRows: (string | number)[][] = [];
  let baseName = '';

  switch (schedule) {
    case 'VAT3_SALES_SEC_B':
      headers = VAT3_SEC_B_HEADERS;
      bodyRows = mapVatSecBRows(dataset.vatSalesSecB);
      baseName = `KRA_VAT3_SecB_Sales_${config.companyKraPin}_${dataset.fileSlug}`;
      break;
    case 'VAT3_PURCHASES_SEC_F':
      headers = VAT3_SEC_F_HEADERS;
      bodyRows = mapVatSecFRows(dataset.vatPurchasesSecF);
      baseName = `KRA_VAT3_SecF_Purchases_${config.companyKraPin}_${dataset.fileSlug}`;
      break;
    case 'VAT3_CREDIT_NOTES':
      headers = VAT3_SEC_B_HEADERS;
      bodyRows = mapVatSecBRows(dataset.vatCreditNotes);
      baseName = `KRA_VAT3_CreditNotes_${config.companyKraPin}_${dataset.fileSlug}`;
      break;
    case 'PAYE_P10_SEC_B':
      headers = PAYE_P10_SEC_B_HEADERS;
      bodyRows = mapPayeP10Rows(dataset.payeP10Rows);
      baseName = `KRA_PAYE_P10_SecB_Employees_${config.companyKraPin}_${dataset.fileSlug}`;
      break;
    case 'STATUTORY_AHL_SHIF_NSSF':
      headers = STATUTORY_AHL_SHIF_NSSF_HEADERS;
      bodyRows = mapStatutoryRows(dataset.payeP10Rows);
      baseName = `KRA_AHL_SHIF_NSSF_Schedule_${config.companyKraPin}_${dataset.fileSlug}`;
      break;
    case 'TURNOVER_TAX_TOT':
      headers = [
        'Taxpayer PIN',
        'Period Start',
        'Period End',
        'Taxable Turnover (Ksh)',
        'Turnover Tax 3% (Ksh)',
      ];
      bodyRows = [
        [
          config.companyKraPin,
          dataset.periodStartKra,
          dataset.periodEndKra,
          dataset.summary.netTaxableSales,
          dataset.summary.turnoverTax3Pct,
        ],
      ];
      baseName = `KRA_TurnoverTax_TOT_${config.companyKraPin}_${dataset.fileSlug}`;
      break;
  }

  const escapeCsvCell = (val: string | number): string => {
    if (typeof val === 'number') {
      // KRA iTax requires raw numbers without commas or currency symbols
      return Number.isInteger(val) ? String(val) : val.toFixed(2);
    }
    const str = String(val ?? '').replace(/"/g, '""');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str}"`;
    }
    return str;
  };

  const allRows = includeHeaders ? [headers, ...bodyRows] : bodyRows;
  const csvContent = allRows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `${baseName}.csv`;
  triggerBlobDownload(blob, filename);
  return filename;
}
