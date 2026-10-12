import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  StaffRole,
  ERPModuleId,
  Product,
  GeoRegion,
  TransactionDoc,
  LineItem,
} from './types';
import { NAIROBI_DRINKS_PRODUCTS } from './data/nairobiDrinksCatalog';

// Detect real client device fingerprint & browser metadata for audit & security monitoring
export function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') return 'Server Runtime';
  const ua = navigator.userAgent;
  const platform = navigator.platform || 'Unknown OS';
  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  const isMobile = /Mobile|Android|iP(hone|od|ad)/.test(ua);
  const screenRes = `${window.screen.width}x${window.screen.height}`;
  return `${isMobile ? 'MobileApp' : 'Desktop'} · ${browser} (${platform}) · ${screenRes}`;
}

// Convert any NAIROBI_DRINKS_PRODUCTS item into a complete ERP Product with Auto-SKU & stock
export function normalizeCatalogProduct(raw: Product, index: number): Product {
  const packSize = raw.packSize || raw.bottlesPerCase || 12;
  const abv = raw.alcoholPercentage ?? raw.abv ?? 40;
  const origin = raw.countryOfOrigin || raw.originCountry || (raw.category === 'LPS' ? 'Kenya' : 'Scotland');
  const wholesale = raw.wholesalePriceKes ?? raw.baseWholesalePrice ?? 2500;
  const retail = raw.retailPriceKes ?? raw.baseRetailPrice ?? 3200;
  const cost = raw.warehouseCostKes ?? raw.baseLandedCost ?? Math.round(wholesale * 0.82);
  const totalBottles = raw.totalBottles ?? packSize * 30; // Default 30 cases distributed across branches

  const defaultBranchStock = JSON.stringify({
    'br-hq-metro': Math.floor(totalBottles * 0.55),
    'br-suburb-north': Math.floor(totalBottles * 0.30),
    'br-lower-valley': Math.max(0, totalBottles - Math.floor(totalBottles * 0.85)),
  });

  return {
    ...raw,
    id: raw.id || `cat-prod-${index + 1}`,
    sku: raw.sku || generateAutoSku(raw.subCategory || 'Whisky', raw.volumeMl || 750, origin, index),
    category: raw.category === 'LPS' ? 'LPS' : 'IPS',
    subCategory: raw.subCategory || 'Whisky',
    brand: raw.brand || raw.name.split(' ')[0] || 'VAAIRO',
    volumeMl: raw.volumeMl || 750,
    abv,
    alcoholPercentage: abv,
    bottlesPerCase: packSize,
    packSize,
    originCountry: origin,
    countryOfOrigin: origin,
    supplierName: raw.supplierName || '',
    importEntryRef: raw.importDeclarationNumber || raw.importEntryRef || '',
    exciseStampSeries: raw.exciseStampSeries || '',
    baseLandedCost: cost,
    warehouseCostKes: cost,
    baseWholesalePrice: wholesale,
    wholesalePriceKes: wholesale,
    baseRetailPrice: retail,
    retailPriceKes: retail,
    totalBottles,
    branchStockSummary: raw.branchStockSummary || defaultBranchStock,
    geoPriceOverrides: raw.geoPriceOverrides || JSON.stringify({}),
    createdAt: raw.createdAt || '2026-10-01T00:00:00.000Z',
  };
}

export const MASTER_IMPORTED_INVENTORY: Product[] = NAIROBI_DRINKS_PRODUCTS.map((p, idx) =>
  normalizeCatalogProduct(p, idx)
);

// Auto SKU Generator for independent liquor products
const SUBCATEGORY_PREFIX: Record<string, string> = {
  Whisky: 'WHS',
  'Cognac & Brandy': 'COG',
  Gin: 'GIN',
  Vodka: 'VDK',
  Rum: 'RUM',
  'White Rum': 'WRM',
  'Spiced & Dark Rum': 'DRM',
  Tequila: 'TEQ',
  'Liqueur & Cream': 'LIQ',
  'Cream Liqueur': 'CRM',
  'Champagne & Wine': 'WNE',
  'Beer & Cider': 'BER',
};

export function generateAutoSku(
  subCategory: string,
  volumeMl: number,
  originCountry: string,
  sequenceIndex: number,
  stockCategory: 'IPS' | 'LPS' = 'IPS'
): string {
  const catCode = SUBCATEGORY_PREFIX[subCategory] || 'LIQ';
  const countryCode = (originCountry || 'KE')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 2)
    .toUpperCase()
    .padEnd(2, 'X');
  const seq = String(sequenceIndex + 101).padStart(4, '0');
  return `${stockCategory}-${catCode}-${volumeMl}-${countryCode}-${seq}`;
}

export function formatKes(amount: number): string {
  return `KES ${Math.round(amount || 0).toLocaleString('en-KE')}`;
}

// Geo-Location Price Calculator (Suburb vs Lower Region vs Metro vs Duty-Free)
export function calculateGeoPrice(
  product: Product,
  region: GeoRegion | undefined,
  mode: 'wholesale' | 'retail'
): { unitBottlePrice: number; casePrice: number; appliedRuleLabel: string } {
  const baseWholesale = product.wholesalePriceKes ?? product.baseWholesalePrice ?? 2500;
  const baseRetail = product.retailPriceKes ?? product.baseRetailPrice ?? 3200;
  const packSize = product.packSize || product.bottlesPerCase || 12;
  const baseUnit = mode === 'wholesale' ? baseWholesale : baseRetail;

  if (!region) {
    return {
      unitBottlePrice: Math.round(baseUnit),
      casePrice: Math.round(baseUnit * packSize),
      appliedRuleLabel: 'Standard Base Tariff',
    };
  }

  // Check if product has explicit regional override
  try {
    const overrides = product.geoPriceOverrides ? JSON.parse(product.geoPriceOverrides) : {};
    const regOverride = overrides[region.id];
    if (regOverride && typeof regOverride[mode] === 'number' && regOverride[mode] > 0) {
      const unitOverride = Number(regOverride[mode]);
      return {
        unitBottlePrice: Math.round(unitOverride),
        casePrice: Math.round(
          unitOverride * packSize + (mode === 'wholesale' ? region.freightLevyPerCase : 0)
        ),
        appliedRuleLabel: `${region.name} Custom Override`,
      };
    }
  } catch {
    // fallback to multiplier
  }

  const multiplier = mode === 'wholesale' ? region.wholesaleMultiplier : region.retailMultiplier;
  const freightPerBottle = region.freightLevyPerCase / Math.max(1, packSize);
  const computedBottle =
    baseUnit * multiplier + (mode === 'wholesale' ? freightPerBottle : freightPerBottle * 0.5);

  return {
    unitBottlePrice: Math.round(computedBottle),
    casePrice: Math.round(computedBottle * packSize),
    appliedRuleLabel: `${region.name} (${region.tierType} ×${multiplier.toFixed(2)} + KES ${region.freightLevyPerCase}/case freight)`,
  };
}

// Strict Role-Based Access Control Matrix
export const ROLE_PERMISSIONS: Record<
  StaffRole,
  {
    allowedModules: ERPModuleId[];
    canCreateRoles: StaffRole[];
    badgeTitle: string;
    authRequirement: 'google' | 'pin';
    scopeToAssignedBranch: boolean;
  }
> = {
  Admin: {
    allowedModules: [
      'overview',
      'retail_pos',
      'sales_pos',
      'inventory',
      'branches_transfers',
      'geo_pricing',
      'partners',
      'documents_credit',
      'compliance',
      'hr_rbac',
      'audit_security',
      'customer_portal',
    ],
    canCreateRoles: ['HR'], // Per requirement: "just the admin to create HR then HR can create other roles"
    badgeTitle: 'Executive System Administrator (Google Auth)',
    authRequirement: 'google',
    scopeToAssignedBranch: false,
  },
  Accountant: {
    allowedModules: [
      'overview',
      'geo_pricing',
      'documents_credit',
      'partners',
      'compliance',
      'audit_security',
    ],
    canCreateRoles: [],
    badgeTitle: 'Chief Financial Accountant (Google Auth)',
    authRequirement: 'google',
    scopeToAssignedBranch: false,
  },
  HR: {
    allowedModules: ['overview', 'hr_rbac', 'branches_transfers', 'audit_security'],
    canCreateRoles: [
      'Accountant',
      'Sales Manager',
      'Branch Manager',
      'Inventory Controller',
      'Counter Cashier',
      'Affiliate Sales Representative',
    ],
    badgeTitle: 'Human Resources & Access Controller (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: false,
  },
  'Sales Manager': {
    allowedModules: [
      'overview',
      'sales_pos',
      'retail_pos',
      'geo_pricing',
      'partners',
      'documents_credit',
      'customer_portal',
    ],
    canCreateRoles: [],
    badgeTitle: 'National Distribution Sales Manager (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: false,
  },
  'Branch Manager': {
    allowedModules: [
      'overview',
      'retail_pos',
      'sales_pos',
      'inventory',
      'branches_transfers',
      'documents_credit',
      'hr_rbac',
    ],
    // Per requirement: "Branch manager should have capacity to also create sales persons and their cashier"
    canCreateRoles: ['Counter Cashier', 'Affiliate Sales Representative'],
    badgeTitle: 'Regional Branch Manager (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: true,
  },
  'Inventory Controller': {
    allowedModules: [
      'overview',
      'inventory',
      'branches_transfers',
      'partners',
      'compliance',
      'documents_credit',
    ],
    canCreateRoles: [],
    badgeTitle: 'Bonded Warehouse & Inventory Controller (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: false,
  },
  'Counter Cashier': {
    allowedModules: ['retail_pos', 'documents_credit'],
    canCreateRoles: [],
    badgeTitle: 'Retail Checkout Counter Cashier (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: true,
  },
  'Affiliate Sales Representative': {
    allowedModules: ['sales_pos', 'documents_credit', 'customer_portal'],
    canCreateRoles: [],
    badgeTitle: 'Field & Affiliate Sales Representative (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: true,
  },
};

// Export any dataset to CSV
export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Export any tabular ERP statement or report to PDF
export function exportReportToPDF(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string
): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Deep Sovereign Navy Header Banner (#0A006E)
  doc.setFillColor(10, 0, 110);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 74, 'F');

  // Electric Gold Accent Rule (#FFDE00)
  doc.setFillColor(255, 222, 0);
  doc.rect(0, 74, doc.internal.pageSize.getWidth(), 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('VAAIRO / AEGIS SPIRITS & BEVERAGE IMPORTERS ERP', 36, 32);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 36, 52);

  doc.setFontSize(9);
  doc.setTextColor(255, 222, 0);
  doc.text(`Generated: ${new Date().toLocaleString()} | ${subtitle}`, 36, 66);

  autoTable(doc, {
    startY: 94,
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c ?? ''))),
    theme: 'grid',
    headStyles: {
      fillColor: [10, 0, 110],
      textColor: [255, 222, 0],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [240, 242, 240],
    },
    margin: { left: 36, right: 36 },
  });

  doc.save(`${filename}.pdf`);
}

// Export specific Commercial Document (Receipt, Invoice, Quote, Packing List, Delivery Note, Credit Note) to PDF
export function exportCommercialDocumentPDF(tx: TransactionDoc): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(10, 0, 110);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setFillColor(255, 222, 0);
  doc.rect(0, 88, pageWidth, 5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('VAAIRO LIQUOR DISTRIBUTION & IMPORTERS ERP', 40, 38);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bonded Importer & Regional Distributor · Branch: ${tx.branchName} (${tx.regionName})`, 40, 56);
  doc.text(`Channel: ${tx.channel} · Issued By: ${tx.createdBy} (${tx.createdByRole})`, 40, 72);

  // Document Type Title
  doc.setTextColor(10, 0, 110);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(tx.docType.toUpperCase(), 40, 125);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(`Document No: ${tx.docNumber}`, 40, 145);
  doc.text(`Date & Time: ${new Date(tx.createdAt).toLocaleString()}`, 40, 160);
  doc.text(`Status: ${tx.status}`, 40, 175);

  doc.text(`Customer / Consignee: ${tx.customerName}`, 320, 145);
  doc.text(`Liquor License / PIN: ${tx.customerLicenseNo || 'Walk-in Retail Verified 21+'}`, 320, 160);
  doc.text(`Payment / Terms: ${tx.paymentMethod}`, 320, 175);

  if (tx.relatedInvoiceNo) {
    doc.setTextColor(180, 83, 9);
    doc.text(`Ref Invoice: ${tx.relatedInvoiceNo} | Reason: ${tx.creditReason || 'Return / Adjustment'}`, 40, 192);
  }

  let items: LineItem[] = [];
  try {
    items = JSON.parse(tx.itemsSummary);
  } catch {
    items = [];
  }

  const isLogisticsOnly = tx.docType === 'Packing List' || tx.docType === 'Delivery Note';

  const tableHeaders = isLogisticsOnly
    ? ['SKU', 'Product Description', 'Pack Mode', 'Qty Units', 'Total Bottles', 'Verification']
    : ['SKU', 'Product Description', 'Mode', 'Qty', 'Total Btls', 'Unit Price (KES)', 'Line Total (KES)'];

  const tableRows = items.map((item) =>
    isLogisticsOnly
      ? [
          item.sku,
          item.name,
          `${item.unitMode} (${item.bottlesPerCase}/cs)`,
          String(item.quantityUnits),
          String(item.totalBottles),
          'SEALED / EXCISE OK',
        ]
      : [
          item.sku,
          item.name,
          item.unitMode,
          String(item.quantityUnits),
          String(item.totalBottles),
          Math.round(item.unitPrice).toLocaleString(),
          Math.round(item.lineTotal).toLocaleString(),
        ]
  );

  autoTable(doc, {
    startY: 208,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [10, 0, 110],
      textColor: [255, 222, 0],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [15, 23, 42],
    },
    alternateRowStyles: {
      fillColor: [240, 242, 240],
    },
    margin: { left: 40, right: 40 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 360;

  if (!isLogisticsOnly) {
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Subtotal: KES ${Math.round(tx.subtotal).toLocaleString()}`, pageWidth - 200, finalY + 28);
    doc.text(`Excise & Regional Tax: KES ${Math.round(tx.exciseAndTax).toLocaleString()}`, pageWidth - 200, finalY + 44);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `${tx.docType === 'Credit Note' ? 'Total Credit Issued' : 'Grand Total'}: KES ${Math.round(tx.totalAmount).toLocaleString()}`,
      pageWidth - 200,
      finalY + 64
    );
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Dispatched Under Excise Bond · Receiver Signature: ___________________________', 40, finalY + 40);
  }

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Regulatory Notice: Alcohol sale strictly prohibited to persons under 21. Excise stamps verified at dispatch.',
    40,
    finalY + 95
  );

  doc.save(`${tx.docType.replace(/\s+/g, '_')}_${tx.docNumber}.pdf`);
}
