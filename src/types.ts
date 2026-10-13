export type StaffRole =
  | 'Admin'
  | 'Accountant'
  | 'HR'
  | 'Sales Manager'
  | 'Branch Manager'
  | 'Inventory Controller'
  | 'Counter Cashier'
  | 'Affiliate Sales Representative';

export type StockCategory = 'IPS' | 'LPS'; // Imported Products Stock vs Local Products Stock

export type LiquorSubCategory =
  | 'Whisky'
  | 'Cognac & Brandy'
  | 'Gin'
  | 'Vodka'
  | 'Rum'
  | 'White Rum'
  | 'Spiced & Dark Rum'
  | 'Tequila'
  | 'Liqueur & Cream'
  | 'Cream Liqueur'
  | 'Champagne & Wine'
  | 'Beer & Cider';

// Alias for compatibility with existing modules
export type LiquorCategory = LiquorSubCategory | StockCategory;

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  authMethod: 'google' | 'pin';
  pin?: string;
  branchId: string;
  branchName: string;
  businessUnitId?: string;
  businessUnitName?: string;
  assignedLine?: 'restaurant' | 'supermarket' | 'all';
  status: 'Active' | 'Suspended' | 'Terminated';
  createdBy: string;
  createdByRole: string;
  lastLoginAt?: string;
  lastDevice?: string;
  createdAt: string;

  // Compensation & Payroll attributes set by HR/Admin
  baseSalaryKes?: number;
  deductionsKes?: number;
  penaltiesKes?: number;
  deductionsBreakdown?: string;
  penaltiesReason?: string;
  kraPin?: string;
  nssfNo?: string;
  nhifNo?: string;

  // Casual Sales Representative specific attributes
  isCasual?: boolean;
  agreedCommissionPct?: number; // e.g. 5, 8, 10%
  casualDailyRateKes?: number;
}

export interface PayrollRecord {
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffRole: StaffRole;
  branchName: string;
  period: string;
  baseSalary: number;
  deductions: number;
  penalties: number;
  netSalary: number;
  deductionsBreakdown?: string;
  penaltiesReason?: string;
  kraPin?: string;
  nssfNo?: string;
  nhifNo?: string;
  runDate: string;
  payrollRunId: string;
}

export interface PayrollRun {
  id: string;
  period: string;
  runDate: string;
  runBy: string;
  runByRole: string;
  totalDisbursed: number;
  totalEmployees: number;
  status: 'Draft' | 'Finalized' | 'Paid';
  recordsJson: string; // Serialized PayrollRecord[]
  createdAt: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  regionId: string;
  regionName: string;
  address: string;
  managerName: string;
  exciseBondLicense: string;
  status: 'Operational' | 'Audit Hold' | 'Closed';
  isMain?: boolean;
  createdAt: string;
}

export type BusinessUnitType = 'restaurant_club' | 'merchant_shop' | 'bar_lounge';

export interface BusinessUnit {
  id: string;
  code: string;
  name: string;
  branchId: string;
  branchName: string;
  unitType: BusinessUnitType;
  description?: string;
  managerName?: string;
  managerStaffId?: string;
  assignedStaffIds?: string[];
  status: 'Active' | 'Inactive';
  foodCategories: string[]; // Custom food categories for restaurant
  beverageCategories: string[]; // Custom beverage categories
  allowLiquorTopup: boolean; // allow adding liquor/cigar/shisha topups from central bonded inventory
  tableCount?: number;
  currency?: string; // 'KES'
  createdAt: string;
}

export type RestaurantItemType = 'food' | 'beverage' | 'club_amenity' | 'tobacco_sigger' | 'shisha';

export interface RestaurantInventoryItem {
  id: string;
  businessUnitId: string;
  businessUnitName: string;
  branchId: string;
  name: string;
  category: string; // One of the businessUnit food or beverage categories
  itemType: RestaurantItemType;
  portionUnit: string; // 'Plate' | 'Portion' | 'Glass' | 'Cup' | 'Stick' | 'Head' | 'Bottle' | 'Serving'
  costPriceKes: number;
  sellingPriceKes: number;
  portionsAvailable: number; // Current live kitchen/pantry stock
  minStockAlert: number;
  prepTimeMinutes?: number;
  isAvailable: boolean;
  description?: string;
  allergens?: string;
  image?: string;
  createdAt: string;
}

export interface GeoRegion {
  id: string;
  code: string;
  name: string;
  tierType: 'Metro Core' | 'Suburban Ring' | 'Upcountry / Lower Region' | 'Duty-Free / Export';
  wholesaleMultiplier: number;
  retailMultiplier: number;
  freightLevyPerCase: number;
  regionalTaxRate: number;
  notes: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string; // 'IPS' | 'LPS' or subCategory
  subCategory?: string; // 'Whisky' | 'Cognac & Brandy' | 'Gin' | 'Vodka' | 'Rum' | 'White Rum' | 'Spiced & Dark Rum' | 'Tequila' | 'Liqueur & Cream' | 'Cream Liqueur' | 'Champagne & Wine' | 'Beer & Cider'
  brand?: string;
  barcode?: string;
  caseBarcode?: string;
  volumeMl: number;
  abv?: number;
  alcoholPercentage?: number;
  bottlesPerCase?: number;
  packSize?: number;
  originCountry?: string;
  countryOfOrigin?: string;
  supplierName?: string;
  importEntryRef?: string;
  importDeclarationNumber?: string;
  exciseStampSeries?: string;
  kraExciseStampType?: 'DIGITAL_EXCISE_STAMP' | 'IMPORT_DUTY_STAMP';
  baseLandedCost?: number;
  warehouseCostKes?: number;
  baseWholesalePrice?: number;
  wholesalePriceKes?: number;
  baseRetailPrice?: number;
  retailPriceKes?: number;
  minWholesaleQty?: number;
  vatRate?: number;
  exciseDutyPerLitreKes?: number;
  totalBottles?: number;
  branchStockSummary?: string; // JSON string mapping branchId -> bottle count
  geoPriceOverrides?: string; // JSON string mapping regionId -> { wholesale?: number, retail?: number }
  image?: string;
  sourceUrl?: string;
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
  linkedInvoiceDate?: string;
  barcodeVerificationStatus?:
    | 'APPROVED_MASTER'
    | 'REMEDIATED_CHECK_DIGIT'
    | 'REMEDIATED_DUPLICATE'
    | 'REMEDIATED_FORMAT'
    | 'UNVERIFIED_SOURCE';
  internalProvenance?: {
    source: string;
    observationDate: string;
    sourceUrl?: string;
    rawSourceBarcode?: string;
    rawSourceCaseBarcode?: string;
    photographyRightsVerified: boolean;
    contentLicenseStatus: 'FIRST_PARTY_NORMALIZED' | 'THIRD_PARTY_OBSERVATION_ONLY' | 'LICENSED';
  };
  isCreamBased?: boolean;
  requiresBatchExpiryTracking?: boolean;
  recommendedShelfLifeMonths?: number;
  maxStorageTempCelsius?: number;
  manufactureDate?: string;
  defaultExpiryDate?: string;
  createdAt?: string;

  // Stock Health, Expiry & Governance Thresholds set by Inventory Manager
  deadStockThresholdDays?: number;
  expiryThresholdDays?: number;
  batchExpiryDate?: string;
  damageAlertThresholdPct?: number;
  spoilageAlertThresholdPct?: number;
  minReorderThresholdBottles?: number;

  // Damages & Spoiled Items tracking set by Inventory Manager
  damagedBottlesCount?: number;
  spoiledBottlesCount?: number;
  lastStockMovementDate?: string;
  stockIncidentsJson?: string;

  // Onboarding & Activation by Branch Manager
  isOnboarded?: boolean;
  status?: 'Active' | 'Pending Onboarding' | 'Inactive';
  pendingActivationBottles?: number;
  onboardedAt?: string;
  onboardedBy?: string;
  onboardedBranchId?: string;
}

export interface DamageSpoilageIncident {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  incidentType: 'DAMAGED' | 'SPOILED';
  quantityBottles: number;
  reason: string;
  lossValueKes: number;
  branchId: string;
  branchName: string;
  reportedBy: string;
  reportedByRole: string;
  status: 'QUARANTINED' | 'WRITTEN_OFF';
  notes?: string;
  createdAt: string;
}

export interface InventoryThresholdSettings {
  defaultDeadStockDays: number;
  defaultExpiryWarningDays: number;
  defaultMaxDamagePct: number;
  defaultMaxSpoilagePct: number;
  defaultMinSafetyStock: number;
}

export interface InventoryItem {
  id: string;
  productId: string;
  branchId: string;
  bottlesOnHand: number;
  casesOnHand: number;
  reorderLevel: number;
  batchNumber: string;
  manufactureDate?: string;
  expiryDate: string;
  lastScannedAt: string;
  linkedInvoiceId?: string;
  linkedInvoiceNumber?: string;
}

export interface Partner {
  id: string;
  partnerType: 'Supplier' | 'Retailer' | 'Logistics';
  code: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  regionId: string;
  regionName: string;
  liquorLicenseNo: string;
  taxPin: string;
  licenseExpiry: string;
  creditLimit: number;
  fleetCapacity?: string;
  complianceStatus: 'Verified' | 'Pending Review' | 'Expired';
  createdAt: string;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  productId: string;
  sku: string;
  productName: string;
  quantityBottles: number;
  logisticsPartnerName: string;
  vehicleReg: string;
  excisePermitNo: string;
  status: 'Dispatched' | 'In Transit' | 'Received';
  initiatedBy: string;
  createdAt: string;
}

export type DocType =
  | 'Receipt'
  | 'Invoice'
  | 'Quote'
  | 'Packing List'
  | 'Delivery Note'
  | 'Credit Note'
  | 'Online Order';

export interface LineItem {
  productId: string;
  sku: string;
  name: string;
  unitMode:
    | 'Bottle'
    | 'Case'
    | 'Portion'
    | 'Plate'
    | 'Glass'
    | 'Cup'
    | 'Stick'
    | 'Head'
    | 'Serving'
    | 'Basket'
    | 'Platter';
  bottlesPerCase: number;
  quantityUnits: number;
  totalBottles: number;
  unitPrice: number;
  lineTotal: number;
  isTopup?: boolean;
  topupType?: 'liquor' | 'sigger' | 'shisha' | 'amenity';
  businessUnitId?: string;
}

export interface TransactionDoc {
  id: string;
  docNumber: string;
  docType: DocType;
  channel: 'Retail Counter POS' | 'B2B Wholesale POS' | 'Customer Online Portal' | 'Affiliate Rep' | 'Restaurant & Club POS' | 'Merchant Shop POS';
  branchId: string;
  branchName: string;
  businessUnitId?: string;
  businessUnitName?: string;
  tableNumber?: string;
  regionId: string;
  regionName: string;
  customerName: string;
  customerLicenseNo: string;
  itemsSummary: string; // JSON string of LineItem[]
  subtotal: number;
  exciseAndTax: number;
  totalAmount: number;
  paymentMethod: string;
  status: 'Paid' | 'Issued' | 'Approved' | 'Fulfilled' | 'Credited' | 'Pending Verification';
  relatedInvoiceNo?: string;
  creditReason?: string;
  createdBy: string;
  createdByRole: string;
  affiliateCode?: string;
  createdAt: string;
}

export interface ComplianceRecord {
  id: string;
  certificateNo: string;
  recordType: 'Customs Import Bond' | 'Digital Excise Stamp Batch' | 'Standard Bureau Certificate' | 'Distributor Liquor Permit';
  skuRef: string;
  branchName: string;
  stampRangeStart: string;
  stampRangeEnd: string;
  dutyPaidAmount: number;
  expiryDate: string;
  status: 'Active' | 'Cleared' | 'Expiring Soon' | 'Flagged';
  inspectorName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorName: string;
  actorRole: string;
  actorEmailOrPinId: string;
  action: string;
  module: string;
  details: string;
  deviceFingerprint: string;
  branchName: string;
  severity: 'Info' | 'Security' | 'Financial' | 'Critical';
  createdAt: string;
}

export type ERPModuleId =
  | 'overview'
  | 'retail_pos'
  | 'sales_pos'
  | 'inventory'
  | 'branches_transfers'
  | 'geo_pricing'
  | 'partners'
  | 'documents_credit'
  | 'compliance'
  | 'hr_rbac'
  | 'audit_security'
  | 'customer_portal'
  | 'outlets_restaurants';
