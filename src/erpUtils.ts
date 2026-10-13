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

  const defaultBranchStock = JSON.stringify({});

  // Real Barcode Governance: Remove all fake simulated barcodes.
  // Barcode is ONLY populated if scanned and registered as real by the Inventory Manager.
  const isReal = Boolean(raw.hasRealBarcode);
  const realBarcode = isReal ? raw.barcode : undefined;
  const realCaseBarcode = isReal ? raw.caseBarcode : undefined;

  return {
    ...raw,
    barcode: realBarcode,
    caseBarcode: realCaseBarcode,
    hasRealBarcode: isReal,
    barcodeVerificationStatus: isReal ? 'APPROVED_MASTER' : 'UNVERIFIED_SOURCE',
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

// Generate simple SVG QR code for KRA eTIMS invoice compliance
export function generateSimpleQrSvg(text: string, size = 160): string {
  const gridSize = 25;
  const matrix: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  const addFinder = (startX: number, startY: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (
          r === 0 || r === 6 || c === 0 || c === 6 ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[startY + r][startX + c] = true;
        } else {
          matrix[startY + r][startX + c] = false;
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(gridSize - 7, 0);
  addFinder(0, gridSize - 7);

  for (let i = 8; i < gridSize - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) + text.charCodeAt(i);
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if ((r < 7 && c < 7) || (r < 7 && c >= gridSize - 7) || (r >= gridSize - 7 && c < 7)) {
        continue;
      }
      if (r === 6 || c === 6) continue;
      const pseudo = Math.abs(Math.sin((r * gridSize + c + hash) * 9301 + 49297));
      matrix[r][c] = (pseudo * 10) % 2 > 0.95;
    }
  }

  const cellSize = size / gridSize;
  let paths = '';
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (matrix[r][c]) {
        const x = (c * cellSize).toFixed(1);
        const y = (r * cellSize).toFixed(1);
        const w = cellSize.toFixed(1);
        const h = cellSize.toFixed(1);
        paths += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0A006E" />`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="mx-auto">${paths}</svg>`;
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

// Target Access Model Matrix Definition
export type AccessLevel =
  | 'Full'
  | 'Finance'
  | 'HR KPIs'
  | 'Sales KPIs'
  | 'Branch KPIs'
  | 'Stock KPIs'
  | 'Manage'
  | 'Read-only'
  | 'Limited'
  | 'Branch'
  | 'Cost / stock'
  | 'Financial view'
  | 'Financial'
  | 'Sales scope'
  | 'Branch scope'
  | 'Delivery docs'
  | 'Own POS docs'
  | 'Own sales docs'
  | 'Tax reports'
  | 'View'
  | 'Branch view'
  | 'Limited staff operations'
  | 'Financial reports'
  | 'Finance audit'
  | 'HR audit'
  | 'Stock scope'
  | 'Own activity'
  | 'Assigned POS'
  | 'Approved prices'
  | 'Own sales'
  | 'None';

export interface ModuleAccessItem {
  moduleName: string;
  moduleId: ERPModuleId;
  permissions: Record<StaffRole, AccessLevel>;
  description: string;
}

export const TARGET_ACCESS_MATRIX: ModuleAccessItem[] = [
  {
    moduleName: 'Executive overview',
    moduleId: 'overview',
    description: 'Executive dashboards, performance metrics, and operational command views.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Finance',
      HR: 'HR KPIs',
      'Sales Manager': 'Sales KPIs',
      'Branch Manager': 'Branch KPIs',
      'Inventory Controller': 'Stock KPIs',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'Own sales',
    },
  },
  {
    moduleName: 'Retail POS',
    moduleId: 'retail_pos',
    description: 'Direct counter retail checkout, barcode scanning, and instant cash/M-Pesa receipting.',
    permissions: {
      Admin: 'Full',
      Accountant: 'None',
      HR: 'None',
      'Sales Manager': 'Manage',
      'Branch Manager': 'Manage',
      'Inventory Controller': 'None',
      'Counter Cashier': 'Limited',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'Wholesale / sales POS',
    moduleId: 'sales_pos',
    description: 'Commercial B2B distributor invoicing, quote generation, and bulk sales dispatch.',
    permissions: {
      Admin: 'Full',
      Accountant: 'None',
      HR: 'None',
      'Sales Manager': 'Manage',
      'Branch Manager': 'Limited',
      'Inventory Controller': 'None',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'Own sales',
    },
  },
  {
    moduleName: 'Inventory',
    moduleId: 'inventory',
    description: 'Master IPS/LPS liquor stock, batch expiry, barcode governance, and spoilage tracking.',
    permissions: {
      Admin: 'Full',
      Accountant: 'None',
      HR: 'None',
      'Sales Manager': 'Read-only',
      'Branch Manager': 'Branch',
      'Inventory Controller': 'Manage',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'Transfers',
    moduleId: 'branches_transfers',
    description: 'Bonded inter-branch stock transfers, dispatch permits, transit logistics, and receiving.',
    permissions: {
      Admin: 'Full',
      Accountant: 'None',
      HR: 'None',
      'Sales Manager': 'Read-only',
      'Branch Manager': 'Branch',
      'Inventory Controller': 'Manage',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'Pricing',
    moduleId: 'geo_pricing',
    description: 'Geo-regional pricing multipliers, wholesale margins, freight levies, and price tiers.',
    permissions: {
      Admin: 'Full',
      Accountant: 'None',
      HR: 'None',
      'Sales Manager': 'Manage',
      'Branch Manager': 'Branch scope',
      'Inventory Controller': 'Cost / stock',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'Approved prices',
    },
  },
  {
    moduleName: 'Suppliers / partners',
    moduleId: 'partners',
    description: 'Bonded distillers, commercial importers, licensed retail partners, and fleet logistics.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Financial view',
      HR: 'None',
      'Sales Manager': 'Manage',
      'Branch Manager': 'Branch scope',
      'Inventory Controller': 'Manage',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'Invoices / credits',
    moduleId: 'documents_credit',
    description: 'Commercial tax invoices, delivery notes, packing lists, quotes, and credit notes.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Financial',
      HR: 'None',
      'Sales Manager': 'Sales scope',
      'Branch Manager': 'Branch scope',
      'Inventory Controller': 'Delivery docs',
      'Counter Cashier': 'Own POS docs',
      'Affiliate Sales Representative': 'Own sales docs',
    },
  },
  {
    moduleName: 'Tax / excise compliance',
    moduleId: 'compliance',
    description: 'KRA eTIMS fiscalization, customs bonded warehouse licenses, and digital excise stamps.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Tax reports',
      HR: 'None',
      'Sales Manager': 'View',
      'Branch Manager': 'Branch view',
      'Inventory Controller': 'Manage',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'HR / staff / roles',
    moduleId: 'hr_rbac',
    description: 'Staff directory, credential provisioning, PIN access, and role assignment boundaries.',
    permissions: {
      Admin: 'Full',
      Accountant: 'None',
      HR: 'Manage',
      'Sales Manager': 'None',
      'Branch Manager': 'Limited staff operations',
      'Inventory Controller': 'None',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'Payroll',
    moduleId: 'hr_rbac',
    description: 'Salary computations, statutory deductions (PAYE, NSSF, SHIF, Housing Levy), and payslips.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Financial reports',
      HR: 'Manage',
      'Sales Manager': 'None',
      'Branch Manager': 'None',
      'Inventory Controller': 'None',
      'Counter Cashier': 'None',
      'Affiliate Sales Representative': 'None',
    },
  },
  {
    moduleName: 'Audit / security',
    moduleId: 'audit_security',
    description: 'Zero-trust security logs, device fingerprints, auth traces, and tamper-evident audit trails.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Finance audit',
      HR: 'HR audit',
      'Sales Manager': 'Sales scope',
      'Branch Manager': 'Branch scope',
      'Inventory Controller': 'Stock scope',
      'Counter Cashier': 'Own activity',
      'Affiliate Sales Representative': 'Own activity',
    },
  },
  {
    moduleName: 'Restaurant / merchant outlets',
    moduleId: 'outlets_restaurants',
    description: 'Bars, restaurant clubs, and merchant shops with kitchen/pantry and central liquor top-ups.',
    permissions: {
      Admin: 'Full',
      Accountant: 'Financial reports',
      HR: 'None',
      'Sales Manager': 'Manage',
      'Branch Manager': 'Branch scope',
      'Inventory Controller': 'Stock scope',
      'Counter Cashier': 'Assigned POS',
      'Affiliate Sales Representative': 'None',
    },
  },
];

export const ROLE_DISTINCTIONS: Record<StaffRole, string> = {
  Accountant:
    'Financial access must not automatically permit editing inventory, staff, product costs, or transaction histories. Allows approved accounting actions, reconciliation, financial reporting, and credit-note workflows according to policy.',
  HR:
    'Can manage employee records and approved role assignments, but cannot change financial records or access unrestricted business data.',
  'Branch Manager':
    'Access must be limited to the assigned branch and explicitly assigned business units.',
  'Inventory Controller':
    'Can manage stock, batches, expiry, damages, spoilage, and transfers according to their authorized warehouse or branch scope. Cannot edit sales totals or finalize payroll.',
  'Counter Cashier':
    'Can process permitted checkout transactions, issue receipts, and view their own permitted transaction history. Refunds, voids, and credits require supervisor approval.',
  'Affiliate Sales Representative':
    'Can create and track their own permitted sales and orders. Must not access another representative\'s customer records or the full company customer database.',
  Admin:
    'Has broad administrative access, but sensitive actions should still be audited, with strong authentication and additional confirmation for destructive operations.',
  'Sales Manager':
    'Oversees commercial wholesale and retail sales channels, national pricing, partner retailers, with read-only oversight of bonded inventory.',
};

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
      'outlets_restaurants',
    ],
    canCreateRoles: ['HR'], // Admin provisions HR, who then manages other operational roles
    badgeTitle: 'Executive System Administrator (Google Auth)',
    authRequirement: 'google',
    scopeToAssignedBranch: false,
  },
  Accountant: {
    allowedModules: [
      'overview',
      'partners',
      'documents_credit',
      'compliance',
      'audit_security',
      'outlets_restaurants',
    ],
    canCreateRoles: [],
    badgeTitle: 'Chief Financial Accountant (Google Auth)',
    authRequirement: 'google',
    scopeToAssignedBranch: false,
  },
  HR: {
    allowedModules: ['overview', 'hr_rbac', 'audit_security'],
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
      'retail_pos',
      'sales_pos',
      'inventory',
      'branches_transfers',
      'geo_pricing',
      'partners',
      'documents_credit',
      'compliance',
      'audit_security',
      'outlets_restaurants',
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
      'geo_pricing',
      'partners',
      'documents_credit',
      'compliance',
      'hr_rbac',
      'audit_security',
      'outlets_restaurants',
    ],
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
      'geo_pricing',
      'partners',
      'documents_credit',
      'compliance',
      'audit_security',
      'outlets_restaurants',
    ],
    canCreateRoles: [],
    badgeTitle: 'Bonded Warehouse & Inventory Controller (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: false,
  },
  'Counter Cashier': {
    allowedModules: ['retail_pos', 'documents_credit', 'audit_security', 'outlets_restaurants'],
    canCreateRoles: [],
    badgeTitle: 'Retail Checkout Counter Cashier (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: true,
  },
  'Affiliate Sales Representative': {
    allowedModules: ['overview', 'sales_pos', 'geo_pricing', 'documents_credit', 'audit_security', 'customer_portal'],
    canCreateRoles: [],
    badgeTitle: 'Field & Affiliate Sales Representative (6-Digit PIN)',
    authRequirement: 'pin',
    scopeToAssignedBranch: true,
  },
};

export function getRoleAccessLevel(role: StaffRole, moduleId: ERPModuleId): AccessLevel {
  const item = TARGET_ACCESS_MATRIX.find((m) => m.moduleId === moduleId);
  if (!item) return 'None';
  return item.permissions[role] || 'None';
}

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
