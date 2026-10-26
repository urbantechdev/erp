import {
  DeductionCategory,
  HrDeductionCatalogItem,
  StaffDeductionItem,
} from '../types';
import {
  calculateHousingLevy,
  calculateNssf,
  calculatePaye,
  calculateShif,
} from './kenyaTax';

export const DEDUCTION_CATEGORIES: DeductionCategory[] = [
  'Statutory',
  'Loan & Advance',
  'SACCO & Pension',
  'Insurance & Relief',
  'Welfare & Union',
  'Operational Recovery',
  'Custom',
];

export const STANDARD_HR_DEDUCTION_CATALOG: HrDeductionCatalogItem[] = [
  {
    id: 'ded-cat-paye',
    code: 'PAYE',
    name: 'KRA PAYE (Income Tax)',
    category: 'Statutory',
    defaultCalcMode: 'STATUTORY_AUTO',
    defaultValue: 0,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'PAYE',
    description: 'Graduated KRA monthly PAYE bands less KES 2,400 personal relief.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-shif',
    code: 'SHIF',
    name: 'SHIF Health Contribution (2.75%)',
    category: 'Statutory',
    defaultCalcMode: 'STATUTORY_AUTO',
    defaultValue: 0,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'SHIF',
    description: 'Social Health Insurance Fund statutory contribution at 2.75% of gross.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-nssf',
    code: 'NSSF',
    name: 'NSSF Pension Tier I & II (6%)',
    category: 'Statutory',
    defaultCalcMode: 'STATUTORY_AUTO',
    defaultValue: 0,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'NSSF_PENSION',
    description: 'Statutory NSSF Act 2013 Tier I & Tier II employee pension deduction.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-ahl',
    code: 'AHL',
    name: 'Affordable Housing Levy (1.5%)',
    category: 'Statutory',
    defaultCalcMode: 'STATUTORY_AUTO',
    defaultValue: 0,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'AHL',
    description: 'Employee Affordable Housing Levy at 1.5% of gross monthly pay.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-helb',
    code: 'HELB',
    name: 'HELB Student Loan Repayment',
    category: 'Loan & Advance',
    defaultCalcMode: 'FIXED',
    defaultValue: 2500,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'POST_TAX',
    description: 'Higher Education Loans Board monthly check-off recovery.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-salary-advance',
    code: 'SALARY_ADVANCE',
    name: 'Salary Advance Recovery',
    category: 'Loan & Advance',
    defaultCalcMode: 'FIXED',
    defaultValue: 5000,
    defaultFrequency: 'One-Off',
    kraP10Mapping: 'POST_TAX',
    description: 'Mid-month salary advance recovery deducted at month-end payroll.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-staff-loan',
    code: 'STAFF_LOAN',
    name: 'Staff Loan Installment',
    category: 'Loan & Advance',
    defaultCalcMode: 'FIXED',
    defaultValue: 5000,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'POST_TAX',
    description: 'Company staff loan principal and interest monthly recovery.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-sacco-savings',
    code: 'SACCO_SAVINGS',
    name: 'SACCO Monthly Shares / Savings',
    category: 'SACCO & Pension',
    defaultCalcMode: 'FIXED',
    defaultValue: 3000,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'POST_TAX',
    description: 'Voluntary SACCO member deposit / share capital check-off.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-sacco-loan',
    code: 'SACCO_LOAN',
    name: 'SACCO Loan Repayment',
    category: 'SACCO & Pension',
    defaultCalcMode: 'FIXED',
    defaultValue: 4500,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'POST_TAX',
    description: 'Monthly SACCO loan check-off remittance.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-voluntary-pension',
    code: 'VOLUNTARY_PENSION',
    name: 'Voluntary Pension / PRMF Top-Up',
    category: 'SACCO & Pension',
    defaultCalcMode: 'PERCENTAGE',
    defaultValue: 5,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'VOLUNTARY_PENSION',
    description: 'Registered pension or PRMF top-up (allowable pre-tax up to KES 30,000 cap).',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-private-insurance',
    code: 'PRIVATE_INSURANCE',
    name: 'Life / Medical Insurance Premium',
    category: 'Insurance & Relief',
    defaultCalcMode: 'FIXED',
    defaultValue: 3000,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'INSURANCE_RELIEF',
    description: 'Qualifying life/health policy check-off (eligible for 15% KRA Insurance Relief).',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-mortgage',
    code: 'MORTGAGE_INTEREST',
    name: 'Owner-Occupied Mortgage Interest',
    category: 'Insurance & Relief',
    defaultCalcMode: 'FIXED',
    defaultValue: 10000,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'MORTGAGE_INTEREST',
    description: 'Allowable mortgage interest check-off reflected on KRA P10 (up to KES 30,000/mo).',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-union-dues',
    code: 'UNION_DUES',
    name: 'COTU / Trade Union Dues',
    category: 'Welfare & Union',
    defaultCalcMode: 'FIXED',
    defaultValue: 500,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'POST_TAX',
    description: 'Authorized trade union monthly membership check-off.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-welfare',
    code: 'STAFF_WELFARE',
    name: 'Staff Welfare / Benevolent Fund',
    category: 'Welfare & Union',
    defaultCalcMode: 'FIXED',
    defaultValue: 500,
    defaultFrequency: 'Recurring Monthly',
    kraP10Mapping: 'POST_TAX',
    description: 'Internal staff welfare and bereavement kitty contribution.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-shortage',
    code: 'SHORTAGE_RECOVERY',
    name: 'Cash / POS Till Shortage Recovery',
    category: 'Operational Recovery',
    defaultCalcMode: 'FIXED',
    defaultValue: 1000,
    defaultFrequency: 'One-Off',
    kraP10Mapping: 'POST_TAX',
    description: 'Recovery for verified cashier shift or reconciliation shortage.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-breakage',
    code: 'BREAKAGE_RECOVERY',
    name: 'Stock Breakage / Spoilage Recovery',
    category: 'Operational Recovery',
    defaultCalcMode: 'FIXED',
    defaultValue: 1500,
    defaultFrequency: 'One-Off',
    kraP10Mapping: 'POST_TAX',
    description: 'Recovery for negligent bottle breakage or unaccounted stock loss.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'ded-cat-unpaid-leave',
    code: 'UNPAID_LEAVE',
    name: 'Absenteeism / Unpaid Leave Deduction',
    category: 'Operational Recovery',
    defaultCalcMode: 'FIXED',
    defaultValue: 1500,
    defaultFrequency: 'One-Off',
    kraP10Mapping: 'POST_TAX',
    description: 'Pro-rata deduction for unapproved absence or unpaid leave days.',
    isSystemPreset: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Computes exact statutory amounts for a given gross/basic salary, accounting for
 * allowable pre-tax pension / mortgage deductions and insurance/SHIF/AHL reliefs.
 */
export function computeStatutoryAmounts(
  grossSalary: number,
  extraAllowablePreTaxKes = 0,
  insuranceReliefKes = 0
): {
  nssf: number;
  shif: number;
  ahl: number;
  paye: number;
} {
  const safeGross = Math.max(0, Number(grossSalary) || 0);
  const { totalNssf } = calculateNssf(safeGross);
  const nssf = Math.round(totalNssf);
  const shif = Math.round(calculateShif(safeGross));
  const ahl = Math.round(calculateHousingLevy(safeGross));

  // Total allowable pension + mortgage relief before PAYE calculation
  const effectivePreTaxDeduction = Math.min(safeGross, nssf + Math.max(0, extraAllowablePreTaxKes));
  const basePaye = calculatePaye(safeGross, effectivePreTaxDeduction);
  const paye = Math.round(Math.max(0, basePaye - Math.min(5000, Math.max(0, insuranceReliefKes))));

  return { nssf, shif, ahl, paye };
}

/**
 * Recalculates any STATUTORY_AUTO or PERCENTAGE deduction items whenever Basic Salary changes
 * or pre-tax pension/mortgage items are added/updated.
 */
export function recalculateDeductionItemsForSalary(
  items: StaffDeductionItem[],
  basicSalary: number
): StaffDeductionItem[] {
  const safeSalary = Math.max(0, Number(basicSalary) || 0);

  // First pass: resolve FIXED and PERCENTAGE items so we know any voluntary pension / mortgage / insurance amounts
  const firstPass = items.map((item) => {
    if (item.calcMode === 'PERCENTAGE') {
      const pct = Math.max(0, Number(item.rateOrValue) || 0);
      const computed = Math.round((safeSalary * pct) / 100);
      return { ...item, amountKes: computed };
    }
    if (item.calcMode === 'FIXED') {
      const fixedVal = Math.max(0, Math.round(Number(item.amountKes) || Number(item.rateOrValue) || 0));
      return { ...item, rateOrValue: fixedVal, amountKes: fixedVal };
    }
    return item;
  });

  const voluntaryPensionTotal = firstPass
    .filter((i) => i.kraP10Mapping === 'VOLUNTARY_PENSION')
    .reduce((sum, i) => sum + i.amountKes, 0);

  const mortgageTotal = firstPass
    .filter((i) => i.kraP10Mapping === 'MORTGAGE_INTEREST')
    .reduce((sum, i) => sum + i.amountKes, 0);

  const insurancePremiumTotal = firstPass
    .filter((i) => i.kraP10Mapping === 'INSURANCE_RELIEF')
    .reduce((sum, i) => sum + i.amountKes, 0);

  const { totalNssf } = calculateNssf(safeSalary);
  const cappedExtraPension = Math.max(0, Math.min(30000 - totalNssf, voluntaryPensionTotal));
  const cappedMortgage = Math.min(30000, mortgageTotal);
  const insuranceRelief = Math.min(5000, Math.round(insurancePremiumTotal * 0.15));

  const statutory = computeStatutoryAmounts(
    safeSalary,
    cappedExtraPension + cappedMortgage,
    insuranceRelief
  );

  // Second pass: update STATUTORY_AUTO items
  return firstPass.map((item) => {
    if (item.calcMode !== 'STATUTORY_AUTO') return item;
    let nextAmt = item.amountKes;
    if (item.code === 'PAYE' || item.kraP10Mapping === 'PAYE') nextAmt = statutory.paye;
    else if (item.code === 'SHIF' || item.kraP10Mapping === 'SHIF') nextAmt = statutory.shif;
    else if (item.code === 'NSSF' || item.kraP10Mapping === 'NSSF_PENSION') nextAmt = statutory.nssf;
    else if (item.code === 'AHL' || item.kraP10Mapping === 'AHL') nextAmt = statutory.ahl;
    return {
      ...item,
      rateOrValue: nextAmt,
      amountKes: nextAmt,
    };
  });
}

/**
 * Creates the standard 4 Kenyan statutory deduction items for a given salary.
 */
export function buildDefaultStatutoryDeductionItems(basicSalary: number): StaffDeductionItem[] {
  const statutoryCodes = ['PAYE', 'SHIF', 'NSSF', 'AHL'];
  const baseItems: StaffDeductionItem[] = statutoryCodes
    .map((code, idx): StaffDeductionItem | null => {
      const preset = STANDARD_HR_DEDUCTION_CATALOG.find((c) => c.code === code);
      if (!preset) return null;
      return {
        id: `ded-item-${code.toLowerCase()}-${idx + 1}`,
        catalogId: preset.id,
        code: preset.code,
        name: preset.name,
        category: preset.category,
        calcMode: 'STATUTORY_AUTO',
        rateOrValue: 0,
        amountKes: 0,
        frequency: 'Recurring Monthly',
        kraP10Mapping: preset.kraP10Mapping,
      };
    })
    .filter((x): x is StaffDeductionItem => x !== null);

  return recalculateDeductionItemsForSalary(baseItems, basicSalary);
}

/**
 * Instantiates a StaffDeductionItem from a catalog preset and basic salary.
 */
export function createDeductionItemFromCatalog(
  preset: HrDeductionCatalogItem,
  basicSalary: number,
  overrides?: {
    calcMode?: StaffDeductionItem['calcMode'];
    rateOrValue?: number;
    frequency?: StaffDeductionItem['frequency'];
    referenceNote?: string;
    customName?: string;
  }
): StaffDeductionItem {
  const calcMode = overrides?.calcMode || preset.defaultCalcMode;
  const rawVal =
    overrides?.rateOrValue !== undefined ? overrides.rateOrValue : preset.defaultValue;

  let amountKes = 0;
  if (calcMode === 'FIXED') {
    amountKes = Math.max(0, Math.round(Number(rawVal) || 0));
  } else if (calcMode === 'PERCENTAGE') {
    amountKes = Math.max(0, Math.round(((Number(basicSalary) || 0) * (Number(rawVal) || 0)) / 100));
  }

  const draft: StaffDeductionItem = {
    id: `ded-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    catalogId: preset.id,
    code: preset.code,
    name: (overrides?.customName || preset.name).trim(),
    category: preset.category,
    calcMode,
    rateOrValue: calcMode === 'FIXED' ? amountKes : Number(rawVal) || 0,
    amountKes,
    frequency: overrides?.frequency || preset.defaultFrequency,
    referenceNote: overrides?.referenceNote?.trim() || undefined,
    kraP10Mapping: preset.kraP10Mapping || 'POST_TAX',
  };

  if (calcMode === 'STATUTORY_AUTO') {
    return recalculateDeductionItemsForSalary([draft], basicSalary)[0];
  }
  return draft;
}

/**
 * Summarizes an array of StaffDeductionItem into total KES and clean human-readable breakdown string.
 */
export function summarizeDeductionItems(items: StaffDeductionItem[]): {
  totalDeductionsKes: number;
  breakdownText: string;
} {
  const valid = (items || []).filter((i) => i && i.name);
  const totalDeductionsKes = valid.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number(item.amountKes) || 0)),
    0
  );
  const breakdownText = valid
    .map((item) => {
      const shortName = item.name.replace(/\s*\([^)]*\)/g, '').trim();
      const noteSuffix = item.referenceNote ? ` [${item.referenceNote}]` : '';
      return `${shortName}${noteSuffix}: KES ${Math.round(item.amountKes).toLocaleString()}`;
    })
    .join(', ');

  return { totalDeductionsKes, breakdownText };
}

/**
 * Hydrates structured StaffDeductionItem[] from an existing StaffMember or PayrollRecord,
 * gracefully converting legacy `deductionsBreakdown` text if `deductionItems` wasn't saved yet.
 */
export function hydrateStaffDeductionItems(params: {
  baseSalary: number;
  deductionsKes?: number;
  deductionsBreakdown?: string;
  deductionItems?: StaffDeductionItem[];
}): StaffDeductionItem[] {
  const { baseSalary, deductionsKes, deductionsBreakdown, deductionItems } = params;

  if (Array.isArray(deductionItems) && deductionItems.length > 0) {
    return deductionItems.map((it) => ({
      ...it,
      amountKes: Math.max(0, Math.round(Number(it.amountKes) || 0)),
    }));
  }

  // Parse legacy breakdown string like "PAYE: KES 8,500, SHIF: KES 1,800, NSSF: KES 1,080"
  if (deductionsBreakdown && deductionsBreakdown.includes(':')) {
    const parts = deductionsBreakdown
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const parsedItems: StaffDeductionItem[] = [];

    parts.forEach((part, idx) => {
      const colonIdx = part.indexOf(':');
      if (colonIdx === -1) return;
      const rawLabel = part.slice(0, colonIdx).trim();
      const rawValStr = part.slice(colonIdx + 1).replace(/[^0-9.]/g, '');
      const val = Math.round(Number(rawValStr) || 0);
      if (!rawLabel) return;

      const lower = rawLabel.toLowerCase();
      let matchedPreset = STANDARD_HR_DEDUCTION_CATALOG.find(
        (c) =>
          c.code.toLowerCase() === lower ||
          c.name.toLowerCase().includes(lower) ||
          (lower.includes('paye') && c.code === 'PAYE') ||
          ((lower.includes('shif') || lower.includes('nhif')) && c.code === 'SHIF') ||
          (lower.includes('nssf') && c.code === 'NSSF') ||
          (lower.includes('housing') && c.code === 'AHL') ||
          (lower.includes('helb') && c.code === 'HELB') ||
          (lower.includes('sacco') && c.code === 'SACCO_SAVINGS') ||
          (lower.includes('advance') && c.code === 'SALARY_ADVANCE')
      );

      parsedItems.push({
        id: `ded-legacy-${idx}-${Date.now()}`,
        catalogId: matchedPreset?.id || 'custom-legacy',
        code: matchedPreset?.code || 'CUSTOM',
        name: matchedPreset?.name || rawLabel,
        category: matchedPreset?.category || 'Custom',
        calcMode: 'FIXED',
        rateOrValue: val,
        amountKes: val,
        frequency: matchedPreset?.defaultFrequency || 'Recurring Monthly',
        kraP10Mapping: matchedPreset?.kraP10Mapping || 'POST_TAX',
      });
    });

    if (parsedItems.length > 0) {
      return parsedItems;
    }
  }

  // If deductionsKes === 0 explicitly, return empty list
  if (deductionsKes === 0) {
    return [];
  }

  // Fallback to clean statutory auto-calculation
  return buildDefaultStatutoryDeductionItems(baseSalary);
}
