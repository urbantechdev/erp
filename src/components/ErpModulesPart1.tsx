import React, { useState, useMemo } from 'react';
import {
  Package,
  Building2,
  ArrowLeftRight,
  MapPin,
  Download,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
  Trash2,
  Star,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ShieldCheck,
  Edit3,
  Image as ImageIcon,
  Lock,
  Receipt,
  Printer,
  X,
  Wine,
  Sliders,
  AlertTriangle,
  PackageX,
  BarChart3,
  Scale,
  Barcode,
  ShoppingCart,
  TrendingUp,
  Camera,
  Check,
  Users,
  DollarSign,
  Eye,
  Briefcase,
  Tag,
  Activity,
  FileText,
  Warehouse,
  Store,
  ShoppingBag,
  Bell,
} from 'lucide-react';
import {
  StaffMember,
  Branch,
  FacilityType,
  GeoRegion,
  Product,
  Partner,
  StockTransfer,
  TransactionDoc,
  StockCategory,
  LiquorSubCategory,
  PayrollRecord,
  PayrollRun,
  DamageSpoilageIncident,
  InventoryThresholdSettings,
} from '../types';
import {
  generateAutoSku,
  calculateGeoPrice,
  ROLE_PERMISSIONS,
  exportToCSV,
  exportReportToPDF,
  formatKes,
  isUserFeaturePermitted,
} from '../erpUtils';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../data/nairobiDrinksCatalog';
import { ProductImage } from './ProductImage';
import { CsvInventoryImportModal } from './CsvInventoryImportModal';
import { AccountantFinancialDashboard } from './AccountantFinancialDashboard';
import { StockThresholdsGovernanceModal } from './StockThresholdsGovernanceModal';
import { LogDamageSpoilageModal } from './LogDamageSpoilageModal';
import { SalesPeriodTracker } from './SalesPeriodTracker';
import { InventoryBarcodeAssignmentModal } from './InventoryBarcodeAssignmentModal';
import { ExecutiveVisualAnalytics, BarGraph, PieChart } from './common/AnalyticsCharts';

// ---------------------------------------------------------------------------
// 1. OVERVIEW DASHBOARD
// ---------------------------------------------------------------------------
export const OverviewModule: React.FC<{
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  regions: GeoRegion[];
  partners: Partner[];
  transactions: TransactionDoc[];
  transfers: StockTransfer[];
  staffList: StaffMember[];
  latestPayrollRecord?: PayrollRecord | null;
  payrollRuns?: PayrollRun[];
  onOpenPayslip?: (record: PayrollRecord) => void;
  onPreviewDoc: (doc: TransactionDoc) => void;
  onOpenOnboardItems?: () => void;
  onNavigateModule?: (module: any) => void;
}> = ({
  currentUser,
  products,
  branches,
  regions,
  partners,
  transactions,
  transfers,
  staffList,
  latestPayrollRecord,
  payrollRuns = [],
  onOpenPayslip,
  onPreviewDoc,
  onOpenOnboardItems,
  onNavigateModule,
}) => {
  const isAccountant = currentUser.role === 'Accountant';
  const [adminOverviewView, setAdminOverviewView] = useState<'executive' | 'accounting'>('executive');
  const scopedBranchId =
    ROLE_PERMISSIONS[currentUser.role].scopeToAssignedBranch ? currentUser.branchId : '';

  const visibleTransactions = useMemo(
    () =>
      scopedBranchId
        ? transactions.filter((t) => t.branchId === scopedBranchId)
        : transactions,
    [transactions, scopedBranchId]
  );

  const totalRevenue = useMemo(
    () =>
      visibleTransactions
        .filter((t) => t.docType === 'Receipt' || t.docType === 'Invoice' || t.docType === 'Online Order')
        .reduce((acc, t) => acc + t.totalAmount, 0),
    [visibleTransactions]
  );

  const totalCredits = useMemo(
    () =>
      visibleTransactions
        .filter((t) => t.docType === 'Credit Note')
        .reduce((acc, t) => acc + t.totalAmount, 0),
    [visibleTransactions]
  );

  const { totalBottlesInBond, ipsCount, lpsCount } = useMemo(() => {
    let btls = 0;
    let ips = 0;
    let lps = 0;
    products.forEach((p) => {
      btls += p.totalBottles ?? 0;
      if (p.category === 'LPS') lps++;
      else ips++;
    });
    return { totalBottlesInBond: btls, ipsCount: ips, lpsCount: lps };
  }, [products]);

  // Visual Analytics Chart Datasets (Bar Graphs & Pie Charts)
  const branchBarData = useMemo(() => {
    const palette = ['#0A006E', '#34D186', '#F59E0B', '#6366F1', '#EC4899', '#0EA5E9'];
    return branches.map((b, idx) => {
      const branchSales = transactions
        .filter(
          (t) =>
            t.branchId === b.id &&
            (t.docType === 'Receipt' || t.docType === 'Invoice' || t.docType === 'Online Order')
        )
        .reduce((s, t) => s + t.totalAmount, 0);
      return {
        label: b.name.replace(' Branch', '').replace(' Depot', ''),
        value: branchSales,
        color: palette[idx % palette.length],
        secondaryLabel: b.code,
      };
    });
  }, [branches, transactions]);

  const channelPieData = useMemo(() => {
    const channelMap: Record<string, { total: number; color: string }> = {
      'Retail Counter POS': { total: 0, color: '#0A006E' },
      'B2B Wholesale POS': { total: 0, color: '#34D186' },
      'Customer Online Portal': { total: 0, color: '#F59E0B' },
      'Affiliate Rep': { total: 0, color: '#6366F1' },
    };
    visibleTransactions.forEach((t) => {
      if (t.docType === 'Receipt' || t.docType === 'Invoice' || t.docType === 'Online Order') {
        const channel = t.channel || 'Retail Counter POS';
        if (channelMap[channel]) {
          channelMap[channel].total += t.totalAmount;
        } else {
          channelMap[channel] = { total: t.totalAmount, color: '#EC4899' };
        }
      }
    });
    return Object.entries(channelMap).map(([label, info]) => ({
      label,
      value: info.total,
      color: info.color,
      sublabel: formatKes(info.total),
    }));
  }, [visibleTransactions]);

  const assetPieData = useMemo(() => {
    let stockValuation = 0;
    products.forEach((p) => {
      const bottles = p.totalBottles ?? (p.packSize || 12) * 30;
      const unitCost = p.warehouseCostKes ?? p.baseLandedCost ?? Math.round((p.retailPriceKes || 3000) * 0.72);
      stockValuation += bottles * unitCost;
    });
    let accountsReceivable = 0;
    visibleTransactions.forEach((t) => {
      if (t.docType === 'Invoice' && t.status !== 'Paid') {
        accountsReceivable += t.totalAmount;
      }
    });
    const cashReserve = 12500000;
    return [
      { label: 'Bonded Stock Assets', value: stockValuation, color: '#0A006E', sublabel: 'Landed inventory at cost' },
      { label: 'Accounts Receivable', value: accountsReceivable || 3200000, color: '#34D186', sublabel: 'Unsettled B2B Invoices' },
      { label: 'Liquid Cash Reserves', value: cashReserve, color: '#F59E0B', sublabel: 'Central Treasury' },
    ];
  }, [products, visibleTransactions]);

  const topSkusBarData = useMemo(() => {
    const skuMap: Record<string, { name: string; revenue: number }> = {};
    visibleTransactions.forEach((tx) => {
      if (tx.docType === 'Receipt' || tx.docType === 'Invoice' || tx.docType === 'Online Order') {
        try {
          const items = JSON.parse(tx.itemsSummary);
          if (Array.isArray(items)) {
            items.forEach((item: { sku: string; name: string; lineTotal?: number; total?: number }) => {
              if (!skuMap[item.sku]) {
                skuMap[item.sku] = { name: item.name, revenue: 0 };
              }
              skuMap[item.sku].revenue += item.lineTotal || item.total || 0;
            });
          }
        } catch {
          // ignore parsing error
        }
      }
    });
    const palette = ['#0A006E', '#34D186', '#6366F1', '#EC4899', '#F59E0B', '#0EA5E9'];
    const sorted = Object.values(skuMap).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
    if (sorted.length === 0) {
      return products.slice(0, 6).map((p, idx) => ({
        label: p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name,
        value: (p.retailPriceKes || 3200) * 40,
        color: palette[idx % palette.length],
      }));
    }
    return sorted.map((s, idx) => ({
      label: s.name.length > 12 ? s.name.slice(0, 11) + '…' : s.name,
      value: s.revenue,
      color: palette[idx % palette.length],
    }));
  }, [visibleTransactions, products]);

  const handleDownloadStatementPDF = () => {
    exportReportToPDF(
      'Executive Multi-Branch Financial & IPS/LPS Inventory Statement',
      `Prepared for ${currentUser.name} (${currentUser.role})`,
      ['Doc Number', 'Type', 'Channel', 'Branch', 'Geo-Zone', 'Customer', 'Total (KES)', 'Status'],
      visibleTransactions.map((t) => [
        t.docNumber,
        t.docType,
        t.channel,
        t.branchName,
        t.regionName,
        t.customerName,
        Math.round(t.totalAmount).toLocaleString(),
        t.status,
      ]),
      'Vaairo_ERP_Executive_Statement'
    );
  };

  const handleDownloadStatementCSV = () => {
    exportToCSV(
      'Vaairo_ERP_Executive_Statement',
      ['Doc Number', 'Type', 'Channel', 'Branch', 'Geo-Zone', 'Customer', 'Total (KES)', 'Status', 'Created At'],
      visibleTransactions.map((t) => [
        t.docNumber,
        t.docType,
        t.channel,
        t.branchName,
        t.regionName,
        t.customerName,
        Math.round(t.totalAmount),
        t.status,
        t.createdAt,
      ])
    );
  };

  if (isAccountant || adminOverviewView === 'accounting') {
    return (
      <div className="space-y-6">
        {!isAccountant && (
          <div className="bg-[#FFDE00] border-2 border-[#0A006E] rounded-2xl p-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                System Administrator Financial Oversight Mode
              </span>
              <p className="text-xs text-slate-900 font-medium">
                Viewing Chief Financial Accountant live P&L, sales ledger, stock asset valuation, and KRA tax schedules.
              </p>
            </div>
            <button
              onClick={() => setAdminOverviewView('executive')}
              className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md"
            >
              Return to Operations Command
            </button>
          </div>
        )}
        <AccountantFinancialDashboard
          currentUser={currentUser}
          products={products}
          transactions={visibleTransactions}
          branches={branches}
          regions={regions}
          payrollRuns={payrollRuns}
          onPreviewDoc={onPreviewDoc}
        />
      </div>
    );
  }

  // Specialized HR KPIs Command Dashboard
  if (currentUser.role === 'HR') {
    const activeStaff = staffList.filter((s) => s.status === 'Active');
    const suspendedStaff = staffList.filter((s) => s.status !== 'Active');
    const kraCoverage = Math.round(
      (staffList.filter((s) => Boolean(s.kraPin)).length / Math.max(1, staffList.length)) * 100
    );
    const nssfCoverage = Math.round(
      (staffList.filter((s) => Boolean(s.nssfNo)).length / Math.max(1, staffList.length)) * 100
    );
    const latestRun = payrollRuns[0];

    return (
      <div className="space-y-6">
        {/* HR Banner */}
        <div className="bg-[#0A006E] text-white border-2 border-[#FFDE00] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-md">
          <div>
            <span className="text-[11px] font-montserrat font-black text-[#FFDE00] uppercase tracking-wider block">
              Human Resources &amp; Access Controller Command · RBAC Scope
            </span>
            <h2 className="text-xl font-montserrat font-black italic text-white mt-1">
              Personnel Roster, Statutory Compliance &amp; Payroll KPIs
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Approved management of 8-role personnel directory, 6-digit PIN issuance, and statutory deductions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateModule?.('hr_rbac')}
              className="px-4 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs transition"
            >
              Manage Staff Directory
            </button>
            <button
              onClick={() => {
                const headers = ['Staff Name', 'Role', 'Branch', 'Email', 'Status', 'KRA PIN', 'NSSF'];
                const rows = staffList.map((s) => [s.name, s.role, s.branchName, s.email, s.status, s.kraPin || '-', s.nssfNo || '-']);
                exportToCSV('Vaairo_Staff_Roster', headers, rows);
              }}
              className="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer transition"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* HR KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Total Workforce Headcount</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {staffList.length} Staff
            </div>
            <div className="text-xs text-[#1E9E60] font-bold mt-1">
              {activeStaff.length} Active · {suspendedStaff.length} On Hold
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Statutory Tax Compliance</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {kraCoverage}%
            </div>
            <div className="text-xs text-slate-600 mt-1">
              KRA PIN: {kraCoverage}% · NSSF / SHIF: {nssfCoverage}%
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Latest Payroll Cycle</div>
            <div className="text-2xl font-montserrat font-black text-[#0A006E] truncate mt-1">
              {latestRun ? latestRun.period : 'Awaiting Run'}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {latestRun ? `Disbursed: KES ${latestRun.totalDisbursed.toLocaleString()} (${latestRun.totalEmployees} staff)` : 'Ready to prepare current cycle'}
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Regional Branch Deployment</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {branches.length} Branches
            </div>
            <div className="text-xs text-slate-600 mt-1">
              All retail &amp; wholesale depots staffed
            </div>
          </div>
        </div>

        {/* Roles Distribution & Branch Deployment Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0A006E]" />
              Staff Distribution Across 8 Roles
            </h3>
            <div className="divide-y divide-slate-100">
              {[
                'Admin',
                'Accountant',
                'Sales Manager',
                'Branch Manager',
                'Inventory Controller',
                'Counter Cashier',
                'Affiliate Sales Representative',
              ].map((role) => {
                const count = staffList.filter((s) => s.role === role).length;
                return (
                  <div key={role} className="py-2.5 flex items-center justify-between text-xs">
                    <span className="font-montserrat font-bold text-slate-800">{role}</span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 font-mono-tabular font-bold text-[#0A006E]">
                      {count} staff
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0A006E]" />
              Branch Personnel Deployment
            </h3>
            <div className="divide-y divide-slate-100">
              {branches.map((b) => {
                const branchStaff = staffList.filter((s) => s.branchId === b.id);
                return (
                  <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-montserrat font-bold text-slate-900">{b.name}</div>
                      <div className="text-[11px] text-slate-500">{b.regionName} · {b.code}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[#FFDE00]/30 border border-[#FFDE00] font-mono-tabular font-bold text-[#0A006E]">
                      {branchStaff.length} stationed
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Specialized Sales Manager KPIs Command Dashboard
  if (currentUser.role === 'Sales Manager') {
    const wholesaleRevenue = visibleTransactions
      .filter((t) => t.channel === 'B2B Wholesale POS')
      .reduce((s, t) => s + t.totalAmount, 0);
    const retailRevenue = visibleTransactions
      .filter((t) => t.channel === 'Retail Counter POS')
      .reduce((s, t) => s + t.totalAmount, 0);

    return (
      <div className="space-y-6">
        {/* Sales Manager Banner */}
        <div className="bg-[#34D186] text-[#0A006E] border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-md">
          <div>
            <span className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider block">
              National Distribution Sales Manager Command
            </span>
            <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
              Commercial Turnover, Channel Pipeline &amp; Partner Performance
            </h2>
            <p className="text-xs text-slate-900 font-semibold mt-0.5">
              Live tracking of B2B wholesale dispatches, retail counters, and partner accounts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateModule?.('sales_pos')}
              className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs transition"
            >
              Wholesale POS
            </button>
            <button
              onClick={() => onNavigateModule?.('geo_pricing')}
              className="px-3.5 py-2 bg-white border border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-bold cursor-pointer transition"
            >
              Review Pricing
            </button>
          </div>
        </div>

        {/* Sales KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Total Commercial Sales</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {formatKes(totalRevenue)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {visibleTransactions.length} Total Documents Issued
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Wholesale B2B Volume</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {formatKes(wholesaleRevenue)}
            </div>
            <div className="text-xs text-[#1E9E60] font-bold mt-1">
              Major distributor &amp; retailer orders
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Retail Counter POS Volume</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {formatKes(retailRevenue)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Counter walk-in direct collections
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Commercial Partners</div>
            <div className="text-3xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {partners.length} Accounts
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Licensed retail distributors &amp; logistics
            </div>
          </div>
        </div>

        {/* Sales Period Section */}
        <div id="sales-period-section">
          <SalesPeriodTracker
            transactions={visibleTransactions}
            currentUser={currentUser}
            onPreviewDoc={onPreviewDoc}
            onNavigateToPos={(mode) => onNavigateModule?.(mode === 'retail' ? 'retail_pos' : 'sales_pos')}
            branches={branches}
            staff={staffList}
          />
        </div>
      </div>
    );
  }

  // Specialized Inventory Controller Stock Command Dashboard
  if (currentUser.role === 'Inventory Controller') {
    const totalInventoryValue = products.reduce((acc, p) => {
      const btls = p.totalBottles ?? (p.packSize || 12) * 30;
      const cost = p.warehouseCostKes ?? p.baseLandedCost ?? (p.baseWholesalePrice ? p.baseWholesalePrice * 0.7 : 2000);
      return acc + btls * cost;
    }, 0);

    const damagedCount = products.reduce((acc, p) => acc + (p.damagedBottlesCount || 0), 0);
    const spoiledCount = products.reduce((acc, p) => acc + (p.spoiledBottlesCount || 0), 0);

    return (
      <div className="space-y-6">
        {/* Inventory Controller Banner */}
        <div className="bg-[#0A006E] text-white border-2 border-[#34D186] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-md">
          <div>
            <span className="text-[11px] font-montserrat font-black text-[#34D186] uppercase tracking-wider block">
              Bonded Warehouse &amp; Inventory Controller Command
            </span>
            <h2 className="text-xl font-montserrat font-black italic text-white mt-1">
              Bonded Inventory Valuation, Barcode Health &amp; Transit Logistics
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Real-time oversight of master liquor batches, customs stamps, and inter-branch movements.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateModule?.('inventory')}
              className="px-4 py-2 bg-[#34D186] text-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs transition"
            >
              Master Inventory
            </button>
            <button
              onClick={() => onNavigateModule?.('branches_transfers')}
              className="px-3.5 py-2 bg-white/15 text-white rounded-xl text-xs font-montserrat font-bold cursor-pointer transition"
            >
              Stock Transfers
            </button>
          </div>
        </div>

        {/* Inventory KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Bonded Stock Asset Valuation</div>
            <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {formatKes(totalInventoryValue)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {totalBottlesInBond.toLocaleString()} Total Bottles in Warehouses
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">IPS vs LPS Catalog</div>
            <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {products.length} SKUs
            </div>
            <div className="text-xs text-slate-600 mt-1">
              IPS Imported: <strong>{ipsCount}</strong> · LPS Local: <strong>{lpsCount}</strong>
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Inter-Branch Transfers</div>
            <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {transfers.length} Transfers
            </div>
            <div className="text-xs text-[#1E9E60] font-bold mt-1">
              {transfers.filter((t) => t.status === 'In Transit').length} Currently in Transit
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Damages &amp; Spoilage Loss</div>
            <div className="text-2xl font-montserrat font-black text-rose-700 font-mono-tabular mt-1">
              {(damagedCount + spoiledCount)} btls
            </div>
            <div className="text-xs text-rose-600 mt-1">
              {damagedCount} Damaged · {spoiledCount} Spoiled quarantined
            </div>
          </div>
        </div>

        {/* Bonded Stock Distribution by Branch Table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-[#0A006E]" />
            Bonded Stock Distribution by Branch Depot
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                  <th className="py-2.5 px-3 font-black">Depot Code</th>
                  <th className="py-2.5 px-3 font-black">Branch Depot Name</th>
                  <th className="py-2.5 px-3 font-black">Excise Bond License</th>
                  <th className="py-2.5 px-3 font-black">Region</th>
                  <th className="py-2.5 px-3 font-black text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">{b.code}</td>
                    <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">{b.name}</td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-700">{b.exciseBondLicense}</td>
                    <td className="py-2.5 px-3 text-slate-600">{b.regionName}</td>
                    <td className="py-2.5 px-3 text-right text-[#1E9E60] font-bold">{b.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Specialized Affiliate Sales Representative Personal Command Dashboard
  if (currentUser.role === 'Affiliate Sales Representative') {
    const ownTransactions = transactions.filter(
      (t) =>
        t.createdBy === currentUser.name ||
        t.createdBy === currentUser.email ||
        t.affiliateCode === currentUser.id
    );
    const ownSalesTotal = ownTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
    const commPct = currentUser.agreedCommissionPct || 8;
    const earnedCommission = Math.round((ownSalesTotal * commPct) / 100);

    return (
      <div className="space-y-6">
        {/* Affiliate Banner */}
        <div className="bg-[#FFDE00] text-[#0A006E] border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-md">
          <div>
            <span className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider block">
              Field &amp; Affiliate Sales Representative Command
            </span>
            <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
              Personal Sales Volume &amp; Earned Commission Tracker
            </h2>
            <p className="text-xs text-slate-900 font-semibold mt-0.5">
              Authorized to create and track your own wholesale orders and client quotes at approved prices.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateModule?.('sales_pos')}
              className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs transition"
            >
              New Wholesale Order
            </button>
            <button
              onClick={() => onNavigateModule?.('inventory')}
              className="px-3.5 py-2 bg-white border border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-bold cursor-pointer transition"
            >
              Browse Catalog
            </button>
          </div>
        </div>

        {/* Affiliate Personal KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Personal Sales Volume</div>
            <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {formatKes(ownSalesTotal)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {ownTransactions.length} Total Orders Generated
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Earned Commissions</div>
            <div className="text-2xl font-montserrat font-black text-[#1E9E60] font-mono-tabular mt-1">
              {formatKes(earnedCommission)}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Agreed Rate: <strong>{commPct}%</strong> on fulfilled orders
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Assigned Branch &amp; Depot</div>
            <div className="text-lg font-montserrat font-black text-[#0A006E] truncate mt-1">
              {currentUser.branchName}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Regional pickup &amp; delivery base
            </div>
          </div>

          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="text-xs font-montserrat font-bold text-slate-600">Approved Catalog Access</div>
            <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
              {products.length} SKUs
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Live pricing with case multipliers
            </div>
          </div>
        </div>

        {/* Affiliate Orders Table */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#0A006E]" />
            My Recent Orders &amp; Commercial Invoices
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                  <th className="py-2.5 px-3 font-black">Document No</th>
                  <th className="py-2.5 px-3 font-black">Type</th>
                  <th className="py-2.5 px-3 font-black">Customer</th>
                  <th className="py-2.5 px-3 font-black text-right">Amount (KES)</th>
                  <th className="py-2.5 px-3 font-black text-right">Commission (KES)</th>
                  <th className="py-2.5 px-3 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      You haven&apos;t created any orders yet. Click &ldquo;New Wholesale Order&rdquo; to generate commercial quotes.
                    </td>
                  </tr>
                ) : (
                  ownTransactions.slice(0, 8).map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">{tx.docNumber}</td>
                      <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">{tx.docType}</td>
                      <td className="py-2.5 px-3 text-slate-800">{tx.customerName}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">{formatKes(tx.totalAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">
                        {formatKes(Math.round((tx.totalAmount * commPct) / 100))}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onPreviewDoc(tx)}
                          className="px-3 py-1 bg-[#0A006E] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-black cursor-pointer"
                        >
                          View PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Mobile Only: Native App-Style Action Buttons Grid (ZERO bulky hero covering the screen) */}
      <div className="block sm:hidden space-y-2">
        {/* Mobile App Quick-Action Touch Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Button 1: Retail POS */}
          <button
            type="button"
            onClick={() => onNavigateModule?.('retail_pos')}
            className="p-3 bg-white border-2 border-[#0A006E] active:bg-[#FFDE00]/20 rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                <ShoppingCart className="w-4 h-4 stroke-[2.4]" />
              </div>
              <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase">Counter</span>
            </div>
            <div>
              <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">Retail POS</div>
              <div className="text-[10px] text-slate-500">Fast checkout</div>
            </div>
          </button>

          {/* Button 2: Wholesale POS */}
          <button
            type="button"
            onClick={() => onNavigateModule?.('sales_pos')}
            className="p-3 bg-white border-2 border-[#0A006E] active:bg-[#34D186]/20 rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#34D186] text-[#0A006E] flex items-center justify-center shadow-xs">
                <Building2 className="w-4 h-4 stroke-[2.4]" />
              </div>
              <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase">B2B</span>
            </div>
            <div>
              <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">Wholesale POS</div>
              <div className="text-[10px] text-slate-500">Bulk Invoicing</div>
            </div>
          </button>

          {/* Button 3: Onboard Items & Barcode Scanner (Branch Manager / Inventory / Admin) */}
          {onOpenOnboardItems && (currentUser.role === 'Branch Manager' || currentUser.role === 'Admin' || (currentUser.role as string) === 'Inventory Controller') && (
            <button
              type="button"
              onClick={onOpenOnboardItems}
              className="p-3 bg-[#34D186] border-2 border-[#0A006E] active:bg-[#28B873] text-[#0A006E] rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#34D186] flex items-center justify-center shadow-xs">
                  <Barcode className="w-4 h-4 stroke-[2.4]" />
                </div>
                <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase">Scanner</span>
              </div>
              <div>
                <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">Onboard Items</div>
                <div className="text-[10px] text-slate-900 font-semibold">Scan &amp; activate stock</div>
              </div>
            </button>
          )}

          {/* Button 4: Sales Reports (Scroll to Today / Week / Month / Year) */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('sales-period-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="p-3 bg-[#FFDE00] border-2 border-[#0A006E] active:bg-amber-400 text-[#0A006E] rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
          >
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4 stroke-[2.4]" />
              </div>
              <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase">Live</span>
            </div>
            <div>
              <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">Sales Ledger</div>
              <div className="text-[10px] text-slate-900 font-semibold">Today · Week · Month</div>
            </div>
          </button>

          {/* Button 5: Financial Oversight (Admin only) */}
          {currentUser.role === 'Admin' && (
            <button
              type="button"
              onClick={() => setAdminOverviewView('accounting')}
              className="p-3 bg-white border-2 border-[#0A006E] active:bg-slate-100 text-[#0A006E] rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-white flex items-center justify-center shadow-xs">
                  <BarChart3 className="w-4 h-4 stroke-[2.4]" />
                </div>
                <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase">Ledger</span>
              </div>
              <div>
                <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">Financials</div>
                <div className="text-[10px] text-slate-500">P&amp;L oversight</div>
              </div>
            </button>
          )}

          {/* Button 6: Thermal Payslip / Statement */}
          {latestPayrollRecord ? (
            <button
              type="button"
              onClick={() => onOpenPayslip?.(latestPayrollRecord)}
              className="p-3 bg-white border-2 border-[#0A006E] active:bg-[#FFDE00]/20 text-[#0A006E] rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                  <Printer className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-montserrat font-black text-[#1E9E60] uppercase">Paid</span>
              </div>
              <div>
                <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">My Payslip</div>
                <div className="text-[10px] font-mono-tabular font-bold text-slate-800">
                  KES {latestPayrollRecord.netSalary.toLocaleString()}
                </div>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownloadStatementPDF}
              className="p-3 bg-white border-2 border-[#0A006E] active:bg-slate-100 text-[#0A006E] rounded-2xl flex flex-col justify-between text-left cursor-pointer shadow-xs active:scale-95 transition-all min-h-[76px]"
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                  <Download className="w-4 h-4 stroke-[2.2]" />
                </div>
                <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase">Export</span>
              </div>
              <div>
                <div className="text-xs font-montserrat font-black text-[#0A006E] leading-tight">PDF Statement</div>
                <div className="text-[10px] text-slate-500">Full audit print</div>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* 2. Desktop/Tablet: Streamlined Hero Bar (Hidden on Mobile) */}
      <div className="hidden sm:flex bg-[#FFDE00] border-2 border-[#0A006E] rounded-2xl py-3.5 px-5 items-center justify-between gap-4 relative overflow-hidden shadow-xs">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10 min-w-0">
          <span className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider block">
            {ROLE_PERMISSIONS[currentUser.role].badgeTitle}
          </span>
          <h2 className="text-base lg:text-lg font-montserrat font-black italic text-[#0A006E] truncate mt-0.5">
            {scopedBranchId
              ? `Regional Branch Command · ${currentUser.branchName}`
              : 'National Importer & Multi-Branch Operations Center'}
          </h2>
          <p className="text-[11px] font-medium text-slate-900 truncate">
            Real-time IPS/LPS excise inventory valuation, regional price governance, and commercial ledger monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          {onOpenOnboardItems && (currentUser.role === 'Branch Manager' || currentUser.role === 'Admin' || (currentUser.role as string) === 'Inventory Controller') && (
            <button
              type="button"
              onClick={onOpenOnboardItems}
              className="px-3.5 py-2 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-md transition active:scale-95"
            >
              <Barcode className="w-3.5 h-3.5 text-[#0A006E]" />
              Onboard Items
            </button>
          )}
          {currentUser.role === 'Admin' && (
            <button
              onClick={() => setAdminOverviewView('accounting')}
              className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] hover:bg-[#060046] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-md"
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#FFDE00]" />
              Financial Analysis
            </button>
          )}
          <button
            onClick={handleDownloadStatementPDF}
            className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] hover:bg-[#060046] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-md"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            PDF Statement
          </button>
          <button
            onClick={handleDownloadStatementCSV}
            className="px-3.5 py-2 bg-white border-2 border-[#0A006E] text-[#0A006E] hover:bg-slate-50 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#0A006E]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* 3. Desktop Only: Employee Remuneration & Thermal Payslip Card (Hidden on Mobile) */}
      <div className="hidden sm:flex bg-white border-2 border-[#0A006E]/20 rounded-2xl p-4 sm:p-5 flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-md">
            <Receipt className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                Employee Compensation &amp; Thermal Payslip
              </span>
              {latestPayrollRecord ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#34D186]/25 text-[#1E9E60] border border-[#34D186]/60">
                  Payroll Cleared ({latestPayrollRecord.period})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Awaiting HR Payroll Execution
                </span>
              )}
            </div>
            <div className="text-sm font-montserrat font-bold text-slate-800 mt-0.5">
              {currentUser.name} · {currentUser.role} ({currentUser.branchName})
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {latestPayrollRecord
                ? `Net take-home pay of KES ${latestPayrollRecord.netSalary.toLocaleString()} finalized for ${latestPayrollRecord.period}.`
                : 'Your 80mm/58mm thermal payslip unlocks immediately once HR runs payroll for this pay period.'}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {latestPayrollRecord ? (
            <button
              type="button"
              onClick={() => onOpenPayslip?.(latestPayrollRecord)}
              className="w-full sm:w-auto px-4 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition"
            >
              <Printer className="w-4 h-4" />
              Download Thermal Payslip (KES {latestPayrollRecord.netSalary.toLocaleString()})
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 font-semibold">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Locked until HR runs payroll
            </div>
          )}
        </div>
      </div>

      {/* Inter-Department & Operations Workflow Hub */}
      <div className="bg-[#F3F4F6] border-2 border-slate-300 rounded-2xl p-6 shadow-md space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A006E] text-[#FFDE00] text-[11px] font-montserrat font-black uppercase tracking-wider mb-2 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Fully Wired &amp; Synchronized ERP Database (erp-db-1)
            </div>
            <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E]">
              Inter-Department &amp; Operations Workflow Hub
            </h2>
            <p className="text-xs text-slate-700 mt-1 max-w-3xl leading-relaxed font-medium">
              All 13 departments are unified in real-time. Sales transactions instantly deduct inventory, log financial ledger entries, update customer CRM records, credit staff sales performance, and synchronize kitchen/bar outlets.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => onNavigateModule?.('retail_pos')}
              className="h-10 px-4 inline-flex items-center justify-center bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition whitespace-nowrap active:scale-95"
            >
              Open POS
            </button>
            <button
              onClick={() => onNavigateModule?.('inventory')}
              className="h-10 px-4 inline-flex items-center justify-center bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer transition shadow-xs whitespace-nowrap active:scale-95"
            >
              Inventory Hub
            </button>
            <button
              onClick={() => onNavigateModule?.('outlets_restaurants')}
              className="h-10 px-4 inline-flex items-center justify-center bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer transition shadow-xs whitespace-nowrap active:scale-95"
            >
              Restaurant &amp; Bar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {[
            { label: 'Retail & Wholesale POS', mod: 'retail_pos', desc: 'Auto stock & ledger' },
            { label: 'Inventory & CSV', mod: 'inventory', desc: 'Bonded stock & SKU' },
            { label: 'Finance & P&L', mod: 'overview', desc: 'Real-time ledger' },
            { label: 'Kitchen & Bar', mod: 'outlets_restaurants', desc: 'Table & outlet sync' },
            { label: 'HR & 6-Digit PIN', mod: 'hr_rbac', desc: 'Staff & payroll' },
            { label: 'CRM & Partners', mod: 'partners', desc: 'Customer accounts' },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onNavigateModule?.(item.mod)}
              className="bg-white hover:bg-slate-50 border border-slate-300 hover:border-[#0A006E] rounded-xl p-3 cursor-pointer transition flex flex-col justify-between shadow-2xs hover:shadow-sm"
            >
              <div>
                <div className="text-[11px] font-montserrat font-black text-[#0A006E] truncate">
                  {item.label}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Synced
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SALES FOR TODAY, THIS WEEK, THIS MONTH, THIS YEAR & CSV/PDF EXPORT */}
      <div id="sales-period-section">
        <SalesPeriodTracker
          transactions={visibleTransactions}
          currentUser={currentUser}
          onPreviewDoc={onPreviewDoc}
          onNavigateToPos={(mode) => onNavigateModule?.(mode === 'retail' ? 'retail_pos' : 'sales_pos')}
          branches={branches}
          staff={staffList}
        />
      </div>

      {/* 4 KPI Blocks on Bright Grey (#F0F2F0) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-montserrat font-bold text-slate-600">
            Gross Commercial Turnover
          </div>
          <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
            {formatKes(totalRevenue)}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            Credit Notes Issued: <span className="font-mono-tabular font-bold">{formatKes(totalCredits)}</span>
          </div>
        </div>

        <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-montserrat font-bold text-slate-600">
            Master Liquor Catalog (IPS & LPS)
          </div>
          <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
            {products.length} SKUs
          </div>
          <div className="text-xs text-slate-600 mt-1">
            IPS Imported: <strong>{ipsCount}</strong> · LPS Local: <strong>{lpsCount}</strong> ({totalBottlesInBond.toLocaleString()} Btls)
          </div>
        </div>

        <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-montserrat font-bold text-slate-600">
            Supply Chain & Geo-Zones
          </div>
          <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
            {partners.length} Partners · {regions.length} Zones
          </div>
          <div className="text-xs text-slate-600 mt-1">
            Suppliers, Licensed Retailers & Bonded Logistics
          </div>
        </div>

        <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-montserrat font-bold text-slate-600">
            Provisioned Staff & RBAC
          </div>
          <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
            {staffList.length} Active Staff
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {transfers.length} Inter-Branch Transfers Logged
          </div>
        </div>
      </div>

      {/* 5. Professional Visual Analytics: Interactive Bar Graphs & Pie Charts */}
      <ExecutiveVisualAnalytics
        branchData={branchBarData}
        channelData={channelPieData}
        assetData={assetPieData}
        topSkusData={topSkusBarData}
      />

      {/* Regional Branch Performance Matrix */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
              Regional Branch Performance & Bonded Stock Distribution
            </h3>
            <p className="text-xs text-slate-600">
              Live oversight of branch revenue, assigned geo-pricing zone, and KRA excise bond license.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Branch Code</th>
                <th className="py-2.5 px-3 font-black">Depot / Branch Name</th>
                <th className="py-2.5 px-3 font-black">Geo-Pricing Zone</th>
                <th className="py-2.5 px-3 font-black">Excise Bond License</th>
                <th className="py-2.5 px-3 font-black">Status</th>
                <th className="py-2.5 px-3 font-black text-right">Logged Sales (KES)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {branches.map((b) => {
                const branchSales = transactions
                  .filter(
                    (t) =>
                      t.branchId === b.id &&
                      (t.docType === 'Receipt' || t.docType === 'Invoice' || t.docType === 'Online Order')
                  )
                  .reduce((s, t) => s + t.totalAmount, 0);

                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {b.code}
                    </td>
                    <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">{b.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{b.regionName}</td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-700">
                      {b.exciseBondLicense}
                    </td>
                    <td className="py-2.5 px-3 text-[#1E9E60] font-bold">{b.status}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900">
                      {formatKes(branchSales)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Commercial Transactions */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
            Latest Commercial Documents (Receipts, Invoices, Quotes & Credit Notes)
          </h3>
          <span className="text-xs font-mono-tabular font-bold text-[#0A006E]">
            Showing {Math.min(8, visibleTransactions.length)} of {visibleTransactions.length}
          </span>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Document No</th>
                <th className="py-2.5 px-3 font-black">Type</th>
                <th className="py-2.5 px-3 font-black">Branch & Geo-Zone</th>
                <th className="py-2.5 px-3 font-black">Customer / Retailer</th>
                <th className="py-2.5 px-3 font-black text-right">Amount (KES)</th>
                <th className="py-2.5 px-3 font-black text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No commercial transactions issued yet. Use Retail POS, Wholesale Sales POS, or Customer Portal.
                  </td>
                </tr>
              ) : (
                visibleTransactions.slice(0, 8).map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {tx.docNumber}
                    </td>
                    <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">
                      {tx.docType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {tx.branchName} · {tx.regionName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">{tx.customerName}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                      {formatKes(tx.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onPreviewDoc(tx)}
                        className="px-3 py-1 bg-[#0A006E] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-black cursor-pointer"
                      >
                        Print / PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 2. INVENTORY & AUTO-SKU ENGINE MODULE (With Imported IPS/LPS & 12 Subcategories)
// ---------------------------------------------------------------------------
export const InventoryModule: React.FC<{
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  onCreateProduct: (prod: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
  onBatchCreateProducts?: (prods: Omit<Product, 'id' | 'createdAt'>[]) => Promise<number>;
  onUpdateProduct?: (productId: string, updates: Partial<Product>) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
  onWipeAllProducts?: () => Promise<void>;
  onWipeInventoryToZero?: () => Promise<void>;
  onLogStockIncident?: (incident: DamageSpoilageIncident) => Promise<void>;
  onOpenOnboardItems?: () => void;
  sampleCatalogEnabled?: boolean;
  onToggleSampleCatalog?: (enable: boolean) => void;
}> = ({
  currentUser,
  products,
  branches,
  onCreateProduct,
  onBatchCreateProducts,
  onUpdateProduct,
  onDeleteProduct,
  onWipeAllProducts,
  onWipeInventoryToZero,
  onLogStockIncident,
  onOpenOnboardItems,
  sampleCatalogEnabled,
  onToggleSampleCatalog,
}) => {
  const isInventoryPerson =
    currentUser.role === 'Inventory Controller' ||
    (currentUser.role as string) === 'Inventory' ||
    (currentUser.role as string).toLowerCase().includes('inventory');
  const canEditProduct = currentUser.role === 'Admin' || isInventoryPerson;
  const canLogDamage =
    (currentUser.role === 'Admin' ||
      currentUser.role === 'Inventory Controller' ||
      currentUser.role === 'Branch Manager' ||
      currentUser.role === 'Sales Manager') &&
    isUserFeaturePermitted(currentUser, 'inventory_damage_logging');

  // Threshold Governance State (Inventory Manager & Admin)
  const [thresholdSettings, setThresholdSettings] = useState<InventoryThresholdSettings>(() => {
    try {
      const saved = localStorage.getItem('vaairo_inventory_thresholds');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      defaultDeadStockDays: 90,
      defaultExpiryWarningDays: 60,
      defaultMaxDamagePct: 2.0,
      defaultMaxSpoilagePct: 1.0,
      defaultMinSafetyStock: 24,
    };
  });
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isLogIncidentModalOpen, setIsLogIncidentModalOpen] = useState(false);
  const [incidentTargetProduct, setIncidentTargetProduct] = useState<Product | null>(null);
  const [filterRotationStatus, setFilterRotationStatus] = useState<
    'ALL' | 'HEALTHY' | 'DEAD_STOCK' | 'EXPIRING' | 'DAMAGED_SPOILED'
  >('ALL');
  const [filterBarcodeStatus, setFilterBarcodeStatus] = useState<'ALL' | 'AWAITING' | 'REGISTERED'>('ALL');
  const [isBarcodeAssignmentModalOpen, setIsBarcodeAssignmentModalOpen] = useState(false);
  const [barcodeAssignmentTargetProductId, setBarcodeAssignmentTargetProductId] = useState<string | undefined>(undefined);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateFindings, setDuplicateFindings] = useState<{
    duplicateSkus: { sku: string; items: Product[] }[];
    duplicateBarcodes: { barcode: string; items: Product[] }[];
    duplicateNames: { name: string; items: Product[] }[];
    totalDuplicates: number;
  }>({ duplicateSkus: [], duplicateBarcodes: [], duplicateNames: [], totalDuplicates: 0 });

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());

  const handleSelectAllProducts = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleSelectAllAndWipe = async () => {
    setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
    if (onWipeAllProducts) {
      await onWipeAllProducts();
      setSelectedProductIds(new Set());
    } else if (onDeleteProduct) {
      if (!confirm(`Are you sure you want to wipe all ${filteredProducts.length} products?`)) return;
      for (const p of filteredProducts) {
        try {
          await onDeleteProduct(p.id);
        } catch {}
      }
      setSelectedProductIds(new Set());
    }
  };

  const handleWipeSelectedProducts = async () => {
    if (selectedProductIds.size === 0 || selectedProductIds.size >= filteredProducts.length) {
      if (onWipeAllProducts) {
        await onWipeAllProducts();
        setSelectedProductIds(new Set());
        return;
      }
    }
    if (!confirm(`Are you sure you want to wipe ${selectedProductIds.size} selected products from inventory?`)) return;
    if (onDeleteProduct) {
      for (const id of selectedProductIds) {
        try {
          await onDeleteProduct(id);
        } catch {}
      }
      setSelectedProductIds(new Set());
    }
  };

  const handleRunDuplicateCheck = () => {
    const skuMap: Record<string, Product[]> = {};
    const barcodeMap: Record<string, Product[]> = {};
    const nameMap: Record<string, Product[]> = {};

    for (const p of products) {
      if (p.sku) {
        const cleanSku = p.sku.trim().toUpperCase();
        if (!skuMap[cleanSku]) skuMap[cleanSku] = [];
        skuMap[cleanSku].push(p);
      }
      if (p.barcode) {
        const cleanBarcode = p.barcode.trim();
        if (cleanBarcode) {
          if (!barcodeMap[cleanBarcode]) barcodeMap[cleanBarcode] = [];
          barcodeMap[cleanBarcode].push(p);
        }
      }
      if (p.name) {
        const cleanName = p.name.trim().toLowerCase();
        if (!nameMap[cleanName]) nameMap[cleanName] = [];
        nameMap[cleanName].push(p);
      }
    }

    const duplicateSkus = Object.entries(skuMap)
      .filter(([_, items]) => items.length > 1)
      .map(([sku, items]) => ({ sku, items }));

    const duplicateBarcodes = Object.entries(barcodeMap)
      .filter(([_, items]) => items.length > 1)
      .map(([barcode, items]) => ({ barcode, items }));

    const duplicateNames = Object.entries(nameMap)
      .filter(([_, items]) => items.length > 1)
      .map(([name, items]) => ({ name, items }));

    const totalDuplicates = duplicateSkus.length + duplicateBarcodes.length + duplicateNames.length;

    setDuplicateFindings({ duplicateSkus, duplicateBarcodes, duplicateNames, totalDuplicates });
    setIsDuplicateModalOpen(true);
  };

  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  const toggleItemSelection = (id: string) => {
    setSelectedForDeletion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelectedDuplicates = async () => {
    if (!onDeleteProduct) return;
    for (const id of selectedForDeletion) {
      await onDeleteProduct(id);
    }
    setSelectedForDeletion(new Set());
    setIsDuplicateModalOpen(false);
  };

  const handleSaveThresholdSettings = (newSettings: InventoryThresholdSettings) => {
    setThresholdSettings(newSettings);
    try {
      localStorage.setItem('vaairo_inventory_thresholds', JSON.stringify(newSettings));
    } catch {}
    setProductFeedback('Saved inventory governance thresholds successfully.');
    setTimeout(() => setProductFeedback(null), 4000);
  };

  const [name, setName] = useState('');
  const [stockCategory, setStockCategory] = useState<StockCategory>('IPS');
  const [subCategory, setSubCategory] = useState<LiquorSubCategory>('Whisky');
  const [volumeMl, setVolumeMl] = useState<number>(750);
  const [abv, setAbv] = useState<number>(40);
  const [bottlesPerCase, setBottlesPerCase] = useState<number>(12);
  const [originCountry, setOriginCountry] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [importEntryRef, setImportEntryRef] = useState('');
  const [exciseStampSeries, setExciseStampSeries] = useState('');
  const [barcode, setBarcode] = useState('');
  const [caseBarcode, setCaseBarcode] = useState('');
  const [baseLandedCost, setBaseLandedCost] = useState<number>(0);
  const [baseWholesalePrice, setBaseWholesalePrice] = useState<number>(0);
  const [baseRetailPrice, setBaseRetailPrice] = useState<number>(0);
  const [initialBottles, setInitialBottles] = useState<number>(0);
  const [targetBranchId, setTargetBranchId] = useState<string>(branches[0]?.id || '');
  const [newProductImage, setNewProductImage] = useState<string>('');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Product Edit & Image Upload Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState<StockCategory>('IPS');
  const [editSubCategory, setEditSubCategory] = useState<LiquorSubCategory>('Whisky');
  const [editVolumeMl, setEditVolumeMl] = useState<number>(750);
  const [editAbv, setEditAbv] = useState<number>(40);
  const [editBottlesPerCase, setEditBottlesPerCase] = useState<number>(12);
  const [editWholesale, setEditWholesale] = useState<number>(0);
  const [editRetail, setEditRetail] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);
  const [editTotalBottles, setEditTotalBottles] = useState<number>(0);
  const [editBarcode, setEditBarcode] = useState('');
  const [editCaseBarcode, setEditCaseBarcode] = useState('');
  const [editOrigin, setEditOrigin] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editImage, setEditImage] = useState<string>('');
  const [editDeadStockDays, setEditDeadStockDays] = useState<number>(90);
  const [editExpiryDays, setEditExpiryDays] = useState<number>(60);
  const [editBatchExpiryDate, setEditBatchExpiryDate] = useState<string>('');
  const [editDamagedCount, setEditDamagedCount] = useState<number>(0);
  const [editSpoiledCount, setEditSpoiledCount] = useState<number>(0);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productFeedback, setProductFeedback] = useState<string | null>(null);

  const handleStartEditProduct = (prod: Product) => {
    if (!canEditProduct) return;
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditBrand(prod.brand || prod.name.split(' ')[0] || '');
    setEditCategory(prod.category === 'LPS' ? 'LPS' : 'IPS');
    setEditSubCategory((prod.subCategory as LiquorSubCategory) || 'Whisky');
    setEditVolumeMl(prod.volumeMl || 750);
    setEditAbv(prod.alcoholPercentage ?? prod.abv ?? 40);
    setEditBottlesPerCase(prod.packSize || prod.bottlesPerCase || 12);
    setEditWholesale(prod.wholesalePriceKes ?? prod.baseWholesalePrice ?? 0);
    setEditRetail(prod.retailPriceKes ?? prod.baseRetailPrice ?? 0);
    setEditCost(prod.warehouseCostKes ?? prod.baseLandedCost ?? 0);
    setEditTotalBottles(prod.totalBottles ?? 360);
    setEditBarcode(prod.barcode || '');
    setEditCaseBarcode(prod.caseBarcode || '');
    setEditOrigin(prod.countryOfOrigin || prod.originCountry || '');
    setEditSupplier(prod.supplierName || '');
    setEditImage(prod.image || '');
    setEditDeadStockDays(prod.deadStockThresholdDays || thresholdSettings.defaultDeadStockDays);
    setEditExpiryDays(prod.expiryThresholdDays || thresholdSettings.defaultExpiryWarningDays);
    setEditBatchExpiryDate(prod.batchExpiryDate || prod.defaultExpiryDate || '');
    setEditDamagedCount(prod.damagedBottlesCount || 0);
    setEditSpoiledCount(prod.spoiledBottlesCount || 0);
  };

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setEditImage(compressed);
        } else {
          setEditImage(rawData);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct || !onUpdateProduct) return;
    setIsSavingProduct(true);
    try {
      await onUpdateProduct(editingProduct.id, {
        name: editName.trim(),
        brand: editBrand.trim(),
        category: editCategory,
        subCategory: editSubCategory,
        volumeMl: Number(editVolumeMl),
        abv: Number(editAbv),
        alcoholPercentage: Number(editAbv),
        packSize: Number(editBottlesPerCase),
        bottlesPerCase: Number(editBottlesPerCase),
        baseWholesalePrice: Number(editWholesale),
        wholesalePriceKes: Number(editWholesale),
        baseRetailPrice: Number(editRetail),
        retailPriceKes: Number(editRetail),
        baseLandedCost: Number(editCost),
        warehouseCostKes: Number(editCost),
        totalBottles: Number(editTotalBottles),
        barcode: editBarcode.trim() || undefined,
        caseBarcode: editCaseBarcode.trim() || undefined,
        hasRealBarcode: Boolean(editBarcode.trim()),
        barcodeVerificationStatus: Boolean(editBarcode.trim()) ? 'APPROVED_MASTER' : 'UNVERIFIED_SOURCE',
        countryOfOrigin: editOrigin.trim(),
        originCountry: editOrigin.trim(),
        supplierName: editSupplier.trim(),
        image: editImage || undefined,
        deadStockThresholdDays: Number(editDeadStockDays),
        expiryThresholdDays: Number(editExpiryDays),
        batchExpiryDate: editBatchExpiryDate.trim() || undefined,
        damagedBottlesCount: Number(editDamagedCount),
        spoiledBottlesCount: Number(editSpoiledCount),
      });
      setProductFeedback(`Successfully updated "${editName.trim()}" specs, thresholds, and photo.`);
      setTimeout(() => setProductFeedback(null), 4000);
      setEditingProduct(null);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleLogIncidentDirect = async (incident: DamageSpoilageIncident) => {
    if (onLogStockIncident) {
      await onLogStockIncident(incident);
    } else if (onUpdateProduct) {
      const prod = products.find((p) => p.id === incident.productId);
      if (!prod) return;
      const curDmg = prod.damagedBottlesCount || 0;
      const curSpoil = prod.spoiledBottlesCount || 0;
      const newDmg = incident.incidentType === 'DAMAGED' ? curDmg + incident.quantityBottles : curDmg;
      const newSpoil = incident.incidentType === 'SPOILED' ? curSpoil + incident.quantityBottles : curSpoil;
      const newTotal = Math.max(0, (prod.totalBottles ?? 0) - incident.quantityBottles);
      await onUpdateProduct(incident.productId, {
        totalBottles: newTotal,
        damagedBottlesCount: newDmg,
        spoiledBottlesCount: newSpoil,
      });
    }
    setProductFeedback(`Quarantined ${incident.quantityBottles} btls of ${incident.sku} (${formatKes(incident.lossValueKes)}).`);
    setTimeout(() => setProductFeedback(null), 4500);
  };

  const now = useMemo(() => new Date(), []);
  const stockHealthMetrics = useMemo(() => {
    let deadStockCount = 0;
    let deadStockValueKes = 0;
    let expiringSoonCount = 0;
    let totalDamagedBottles = 0;
    let totalDamagedLossKes = 0;
    let totalSpoiledBottles = 0;
    let totalSpoiledLossKes = 0;

    products.forEach((p) => {
      const bottles = p.totalBottles ?? 0;
      const unitCost = p.warehouseCostKes ?? p.baseLandedCost ?? 2000;
      const deadDays = p.deadStockThresholdDays || thresholdSettings.defaultDeadStockDays;
      const lastMove = p.lastStockMovementDate ? new Date(p.lastStockMovementDate) : new Date(p.createdAt || '2026-08-01');
      const daysInactive = Math.max(0, Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24)));
      const isDead = daysInactive >= deadDays && bottles > 0;

      // Expiry check
      const expiryDays = p.expiryThresholdDays || thresholdSettings.defaultExpiryWarningDays;
      const expiryDateStr = p.batchExpiryDate || p.defaultExpiryDate;
      let isExpiringSoon = false;
      if (expiryDateStr) {
        const expDate = new Date(expiryDateStr);
        const daysToExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= expiryDays && daysToExpiry >= 0) {
          isExpiringSoon = true;
        }
      }

      const dmg = p.damagedBottlesCount || 0;
      const spoil = p.spoiledBottlesCount || 0;
      if (dmg > 0) {
        totalDamagedBottles += dmg;
        totalDamagedLossKes += dmg * unitCost;
      }
      if (spoil > 0) {
        totalSpoiledBottles += spoil;
        totalSpoiledLossKes += spoil * unitCost;
      }

      if (isDead) {
        deadStockCount++;
        deadStockValueKes += bottles * unitCost;
      }
      if (isExpiringSoon) {
        expiringSoonCount++;
      }
    });

    return {
      deadStockCount,
      deadStockValueKes,
      expiringSoonCount,
      totalDamagedBottles,
      totalDamagedLossKes,
      totalSpoiledBottles,
      totalSpoiledLossKes,
    };
  }, [products, thresholdSettings, now]);

  // Catalog filter state
  const [filterStockCat, setFilterStockCat] = useState<'ALL' | StockCategory>('ALL');
  const [filterSubCat, setFilterSubCat] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [tableLimit, setTableLimit] = useState<number>(60);

  const previewAutoSku = useMemo(
    () => generateAutoSku(subCategory, volumeMl, originCountry, products.length, stockCategory),
    [subCategory, volumeMl, originCountry, products.length, stockCategory]
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchStock = filterStockCat === 'ALL' || p.category === filterStockCat;
      const matchSub = filterSubCat === 'ALL' || (p.subCategory || p.category) === filterSubCat;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q);

      if (!matchStock || !matchSub || !matchSearch) return false;

      if (filterRotationStatus === 'ALL') return true;

      const bottles = p.totalBottles ?? 0;
      const deadDays = p.deadStockThresholdDays || thresholdSettings.defaultDeadStockDays;
      const lastMove = p.lastStockMovementDate ? new Date(p.lastStockMovementDate) : new Date(p.createdAt || '2026-08-01');
      const daysInactive = Math.max(0, Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24)));
      const isDead = daysInactive >= deadDays && bottles > 0;

      const expiryDays = p.expiryThresholdDays || thresholdSettings.defaultExpiryWarningDays;
      const expiryDateStr = p.batchExpiryDate || p.defaultExpiryDate;
      let isExpiringSoon = false;
      if (expiryDateStr) {
        const expDate = new Date(expiryDateStr);
        const daysToExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= expiryDays && daysToExpiry >= 0) isExpiringSoon = true;
      }

      const hasDamageOrSpoil = (p.damagedBottlesCount || 0) > 0 || (p.spoiledBottlesCount || 0) > 0;

      if (filterRotationStatus === 'DEAD_STOCK') return isDead;
      if (filterRotationStatus === 'EXPIRING') return isExpiringSoon;
      if (filterRotationStatus === 'DAMAGED_SPOILED') return hasDamageOrSpoil;
      if (filterRotationStatus === 'HEALTHY') return !isDead && !isExpiringSoon && !hasDamageOrSpoil;
      if (filterBarcodeStatus === 'AWAITING' && p.hasRealBarcode) return false;
      if (filterBarcodeStatus === 'REGISTERED' && !p.hasRealBarcode) return false;

      return true;
    });
  }, [products, filterStockCat, filterSubCat, searchQuery, filterRotationStatus, filterBarcodeStatus, thresholdSettings, now]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const branchMap: Record<string, number> = {};
    branches.forEach((b) => {
      branchMap[b.id] = b.id === (targetBranchId || branches[0]?.id) ? initialBottles : 0;
    });

    const hasProvidedBarcode = Boolean(barcode.trim());
    const resolvedBarcode = hasProvidedBarcode ? barcode.trim() : undefined;
    const resolvedCaseBarcode = hasProvidedBarcode && caseBarcode.trim() ? caseBarcode.trim() : undefined;

    await onCreateProduct({
      sku: previewAutoSku,
      barcode: resolvedBarcode,
      caseBarcode: resolvedCaseBarcode,
      hasRealBarcode: hasProvidedBarcode,
      barcodeVerificationStatus: hasProvidedBarcode ? 'APPROVED_MASTER' : 'UNVERIFIED_SOURCE',
      name: name.trim(),
      category: stockCategory,
      subCategory,
      brand: name.trim().split(' ')[0] || 'VAAIRO',
      volumeMl: Number(volumeMl),
      abv: Number(abv),
      alcoholPercentage: Number(abv),
      bottlesPerCase: Number(bottlesPerCase),
      packSize: Number(bottlesPerCase),
      originCountry: originCountry.trim(),
      countryOfOrigin: originCountry.trim(),
      supplierName: supplierName.trim(),
      importEntryRef: importEntryRef.trim(),
      importDeclarationNumber: importEntryRef.trim(),
      exciseStampSeries: exciseStampSeries.trim(),
      kraExciseStampType:
        stockCategory === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP',
      baseLandedCost: Number(baseLandedCost),
      warehouseCostKes: Number(baseLandedCost),
      baseWholesalePrice: Number(baseWholesalePrice),
      wholesalePriceKes: Number(baseWholesalePrice),
      baseRetailPrice: Number(baseRetailPrice),
      retailPriceKes: Number(baseRetailPrice),
      totalBottles: Number(initialBottles),
      branchStockSummary: JSON.stringify(branchMap),
      geoPriceOverrides: JSON.stringify({}),
      image: newProductImage || undefined,
    });

    setName('');
    setBarcode('');
    setCaseBarcode('');
    setNewProductImage('');
  };

  const handleExportInventoryPDF = () => {
    exportReportToPDF(
      'Bonded Master Inventory & Auto-SKU Valuation Report (IPS & LPS)',
      `Filtered ${filteredProducts.length} of ${products.length} Master SKUs`,
      ['Auto SKU', 'Stock', 'Product Name', 'Subcategory', 'Vol / ABV', 'Origin', 'Wholesale (KES)', 'Retail (KES)', 'Total Btls'],
      filteredProducts.slice(0, 250).map((p) => [
        p.sku,
        p.category,
        p.name,
        p.subCategory || p.category,
        `${p.volumeMl}ml / ${p.alcoholPercentage ?? p.abv ?? 40}%`,
        p.countryOfOrigin || p.originCountry || 'Imported',
        Math.round(p.wholesalePriceKes ?? p.baseWholesalePrice ?? 0).toLocaleString(),
        Math.round(p.retailPriceKes ?? p.baseRetailPrice ?? 0).toLocaleString(),
        p.totalBottles ?? 0,
      ]),
      'Vaairo_Bonded_Inventory_Report'
    );
  };

  const handleExportInventoryCSV = () => {
    exportToCSV(
      'Vaairo_Bonded_Inventory_Report',
      ['Auto SKU', 'Stock Class', 'Subcategory', 'Product Name', 'Brand', 'Barcode (EAN-13)', 'Volume (ml)', 'ABV (%)', 'Pack Size', 'Origin', 'Wholesale (KES)', 'Retail (KES)', 'Total Bottles'],
      filteredProducts.map((p) => [
        p.sku,
        p.category,
        p.subCategory || '',
        p.name,
        p.brand || '',
        p.barcode || '',
        p.volumeMl,
        p.alcoholPercentage ?? p.abv ?? 40,
        p.packSize || p.bottlesPerCase || 12,
        p.countryOfOrigin || p.originCountry || '',
        p.wholesalePriceKes ?? p.baseWholesalePrice ?? 0,
        p.retailPriceKes ?? p.baseRetailPrice ?? 0,
        p.totalBottles ?? 0,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* Mobile Only: Action Buttons Row (Hero banner removed on mobile) */}
      <div className="flex sm:hidden items-center gap-2 overflow-x-auto pb-1 pt-1">
        {onOpenOnboardItems && (
          <button
            type="button"
            onClick={onOpenOnboardItems}
            className="flex-1 min-w-[130px] px-3 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
          >
            <Barcode className="w-3.5 h-3.5 text-[#0A006E]" />
            Onboard Items
          </button>
        )}
        {canEditProduct && (
          <button
            type="button"
            onClick={() => setIsCsvModalOpen(true)}
            className="flex-1 min-w-[120px] px-3 py-2 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV
          </button>
        )}
        <button
          type="button"
          onClick={handleExportInventoryPDF}
          className="flex-1 min-w-[110px] px-3 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
          PDF Export
        </button>
        <button
          type="button"
          onClick={handleExportInventoryCSV}
          className="flex-1 min-w-[110px] px-3 py-2 bg-white border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#0A006E]" />
          CSV Export
        </button>
        <button
          type="button"
          onClick={handleRunDuplicateCheck}
          className="flex-1 min-w-[110px] px-3 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Duplicate Check
        </button>
        {onWipeAllProducts && canEditProduct && (
          <button
            type="button"
            onClick={onWipeAllProducts}
            className="flex-1 min-w-[120px] px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
            title="Wipe all inventory SKUs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Wipe Inventory
          </button>
        )}
      </div>

      {/* Desktop/Tablet: Minimalized Streamlined Hero Bar (Hidden on Mobile) */}
      <div className="hidden sm:flex bg-[#FFDE00] border-2 border-[#0A006E] rounded-2xl py-3 px-5 items-center justify-between gap-4 relative overflow-hidden shadow-xs">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-xs">
            <Package className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-montserrat font-black italic text-[#0A006E] truncate">
                Liquor Inventory &amp; Auto-SKU Controller
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-[#0A006E] text-[#FFDE00] whitespace-nowrap">
                {products.length} SKUs
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-900 truncate">
              IPS imported &amp; LPS local stock valuation, excise bond registers, and deterministic catalog.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          {onOpenOnboardItems && (
            <button
              type="button"
              onClick={onOpenOnboardItems}
              className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] border border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
            >
              <Barcode className="w-3.5 h-3.5 text-[#FFDE00]" />
              Onboard Items
            </button>
          )}
          {canEditProduct && (
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="px-3 py-2 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload CSV
            </button>
          )}
          <button
            type="button"
            onClick={handleExportInventoryPDF}
            className="px-3 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            PDF
          </button>
          <button
            type="button"
            onClick={handleExportInventoryCSV}
            className="px-3 py-2 bg-white hover:bg-slate-50 border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#0A006E]" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleRunDuplicateCheck}
            className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Duplicate Check
          </button>
          {onWipeAllProducts && canEditProduct && (
            <button
              type="button"
              onClick={onWipeAllProducts}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
              title="Wipe entire inventory to 0 SKUs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Wipe Inventory
            </button>
          )}
        </div>
      </div>

      {/* 0 SKUs Clean Slate State Banner */}
      {products.length === 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-400/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-montserrat font-black text-emerald-950 text-sm">
                  Inventory Database Wiped to Zero (0 SKUs)
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-emerald-200 text-emerald-900">
                  Clean Database Ready
                </span>
              </div>
              <p className="text-xs text-emerald-800 font-medium">
                The database has been wiped back to zero. No leftover SKUs or bottles remain. Upload your real catalog or register new products below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {canEditProduct && (
              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Inventory CSV
              </button>
            )}
            {onToggleSampleCatalog && (
              <button
                type="button"
                onClick={() => onToggleSampleCatalog(true)}
                className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap"
                title="Load sample catalog for testing"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Load Sample Catalog (2,976 SKUs)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sample Reference Catalog Active Banner */}
      {sampleCatalogEnabled && products.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-900 font-medium">
              Currently previewing <strong>Sample Reference Catalog ({products.length} SKUs)</strong>. To return to your clean empty inventory (0 SKUs), click Wipe.
            </p>
          </div>
          {onWipeAllProducts && (
            <button
              type="button"
              onClick={onWipeAllProducts}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Purge Back to 0 SKUs
            </button>
          )}
        </div>
      )}

      {/* Inventory Governance & Health Command Center (Dead Stock, Expiry, Damages, Spoilage) */}
      <div className="bg-white border-2 border-[#0A006E]/20 rounded-2xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-md">
              <Sliders className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-black text-[#0A006E] text-sm">
                  Inventory Health & Threshold Governance Command
                </h3>
                <span className="px-2 py-0.5 bg-[#FFDE00] text-[#0A006E] rounded-full text-[10px] font-montserrat font-black uppercase tracking-wider">
                  Inventory Controller & Admin
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Active thresholds: Dead Stock Inactivity &gt; {thresholdSettings.defaultDeadStockDays}d · Expiry Warning &lt; {thresholdSettings.defaultExpiryWarningDays}d · Damage Alert Max {thresholdSettings.defaultMaxDamagePct}% · Spoilage Alert Max {thresholdSettings.defaultMaxSpoilagePct}%
              </p>
            </div>
          </div>

          {canEditProduct && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setBarcodeAssignmentTargetProductId(undefined);
                  setIsBarcodeAssignmentModalOpen(true);
                }}
                className="px-3.5 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition hover:scale-[1.02]"
                title="Scan and register real bottle barcodes"
              >
                <Barcode className="w-3.5 h-3.5 text-[#0A006E]" />
                Scan Real Barcodes ({products.filter((p) => !p.hasRealBarcode).length} Awaiting)
              </button>
              <button
                type="button"
                onClick={() => setIsThresholdModalOpen(true)}
                className="px-3 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition"
              >
                <Sliders className="w-3.5 h-3.5 text-[#FFDE00]" />
                Configure Thresholds
              </button>
              {canLogDamage ? (
                <button
                  type="button"
                  onClick={() => {
                    setIncidentTargetProduct(null);
                    setIsLogIncidentModalOpen(true);
                  }}
                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <PackageX className="w-3.5 h-3.5" />
                  Log Damage / Spoilage
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Damage and spoilage logging stripped by Administrator"
                  className="px-3 py-2 bg-slate-200 text-slate-400 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-not-allowed opacity-60"
                >
                  <PackageX className="w-3.5 h-3.5" />
                  Damage Logging Stripped
                </button>
              )}
            </div>
          )}
        </div>

        {/* 4 Stock Health Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Healthy Stock */}
          <div
            onClick={() => setFilterRotationStatus('HEALTHY')}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              filterRotationStatus === 'HEALTHY'
                ? 'bg-emerald-50 border-emerald-500 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-700">
              <span className="text-[11px] font-montserrat font-bold uppercase tracking-wider">Healthy Stock</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="text-xl font-montserrat font-black text-slate-900 mt-1">
              {Math.max(0, products.length - stockHealthMetrics.deadStockCount - stockHealthMetrics.expiringSoonCount)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Fast & regular rotation items</div>
          </div>

          {/* Card 2: Dead Stock Alert */}
          <div
            onClick={() => setFilterRotationStatus('DEAD_STOCK')}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              filterRotationStatus === 'DEAD_STOCK'
                ? 'bg-amber-50 border-amber-500 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between text-amber-700">
              <span className="text-[11px] font-montserrat font-bold uppercase tracking-wider">Dead Stock Alert</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-montserrat font-black text-amber-900 mt-1">
              {stockHealthMetrics.deadStockCount} <span className="text-xs font-normal text-slate-500">SKUs</span>
            </div>
            <div className="text-[10px] font-bold text-amber-700 mt-0.5">
              Tied Capital: {formatKes(stockHealthMetrics.deadStockValueKes)}
            </div>
          </div>

          {/* Card 3: Expiring Soon */}
          <div
            onClick={() => setFilterRotationStatus('EXPIRING')}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              filterRotationStatus === 'EXPIRING'
                ? 'bg-orange-50 border-orange-500 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-orange-300'
            }`}
          >
            <div className="flex items-center justify-between text-orange-700">
              <span className="text-[11px] font-montserrat font-bold uppercase tracking-wider">Expiring Soon</span>
              <AlertCircle className="w-4 h-4 text-orange-600" />
            </div>
            <div className="text-xl font-montserrat font-black text-orange-900 mt-1">
              {stockHealthMetrics.expiringSoonCount} <span className="text-xs font-normal text-slate-500">SKUs</span>
            </div>
            <div className="text-[10px] text-orange-700 mt-0.5">
              Within {thresholdSettings.defaultExpiryWarningDays}d warning limit
            </div>
          </div>

          {/* Card 4: Damaged / Spoiled */}
          <div
            onClick={() => setFilterRotationStatus('DAMAGED_SPOILED')}
            className={`p-3.5 rounded-xl border cursor-pointer transition ${
              filterRotationStatus === 'DAMAGED_SPOILED'
                ? 'bg-rose-50 border-rose-500 shadow-sm'
                : 'bg-slate-50 border-slate-200 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between text-rose-700">
              <span className="text-[11px] font-montserrat font-bold uppercase tracking-wider">Damaged / Spoiled</span>
              <PackageX className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-xl font-montserrat font-black text-rose-900 mt-1">
              {stockHealthMetrics.totalDamagedBottles + stockHealthMetrics.totalSpoiledBottles}{' '}
              <span className="text-xs font-normal text-slate-500">bottles</span>
            </div>
            <div className="text-[10px] font-bold text-rose-700 mt-0.5">
              Loss: {formatKes(stockHealthMetrics.totalDamagedLossKes + stockHealthMetrics.totalSpoiledLossKes)}
            </div>
          </div>
        </div>
      </div>

      {/* Add New Independent Liquor SKU Form (Strictly for Inventory Person & Admin) */}
      {!canEditProduct ? (
        <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-200 text-[#0A006E] rounded-xl shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-montserrat font-black text-sm text-[#0A006E]">
                Inventory Management & Bottle Upload Restricted
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Only the Inventory Person and System Administrator are authorized to edit products, register new SKUs, import CSVs, or upload bottle images.
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono-tabular font-bold text-slate-600 shrink-0">
            Role: {currentUser.role} (Read-Only)
          </span>
        </div>
      ) : (
        <form
          onSubmit={handleAddProduct}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-2">
            <Package className="w-4 h-4 text-[#0A006E]" />
            Register New Independent Liquor Product (Auto-SKU Generator)
          </h3>
          <div className="px-3.5 py-1.5 bg-[#0A006E] text-white rounded-xl text-xs font-mono-tabular">
            Auto-Generated SKU: <strong className="text-[#FFDE00]">{previewAutoSku}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div>
            <label className="font-montserrat font-bold text-slate-700">Product / Vintage Name *</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Glenfiddich 18 Years Single Malt"
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Stock Class & Subcategory</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <select
                value={stockCategory}
                onChange={(e) => setStockCategory(e.target.value as StockCategory)}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-montserrat font-black text-[#0A006E]"
              >
                <option value="IPS">IPS (Imported)</option>
                <option value="LPS">LPS (Local)</option>
              </select>
              <select
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value as LiquorSubCategory)}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
              >
                {NAIROBI_DRINKS_SUB_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Bottle Volume (ml) & ABV %</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="number"
                value={volumeMl}
                onChange={(e) => setVolumeMl(Number(e.target.value))}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
              <input
                type="number"
                step="0.1"
                value={abv}
                onChange={(e) => setAbv(Number(e.target.value))}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Origin Country & Btls/Case</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="text"
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl"
              />
              <input
                type="number"
                value={bottlesPerCase}
                onChange={(e) => setBottlesPerCase(Number(e.target.value))}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">IDF / Customs Entry Ref</label>
            <input
              type="text"
              value={importEntryRef}
              onChange={(e) => setImportEntryRef(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">KRA Excise Stamp Series</label>
            <input
              type="text"
              value={exciseStampSeries}
              onChange={(e) => setExciseStampSeries(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Bottle Barcode (EAN-13 / UPC)</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="e.g. 5000267014005 (or leave blank to auto-generate)"
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Master Case Barcode (ITF-14)</label>
            <input
              type="text"
              value={caseBarcode}
              onChange={(e) => setCaseBarcode(e.target.value)}
              placeholder="e.g. 15000267014002 (or leave blank to auto-link)"
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Wholesale & Retail (KES/Btl)</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="number"
                value={baseWholesalePrice}
                onChange={(e) => setBaseWholesalePrice(Number(e.target.value))}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
              <input
                type="number"
                value={baseRetailPrice}
                onChange={(e) => setBaseRetailPrice(Number(e.target.value))}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Initial Bottles & Receiving Depot</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="number"
                value={initialBottles}
                onChange={(e) => setInitialBottles(Number(e.target.value))}
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
              <select
                disabled={currentUser.role === 'Branch Manager'}
                value={currentUser.role === 'Branch Manager' ? currentUser.branchId : targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="px-2 py-2 bg-white border border-slate-200 rounded-xl disabled:bg-slate-100 disabled:text-slate-600"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:col-span-2 p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {newProductImage ? (
                <div className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden shrink-0 bg-slate-50">
                  <img
                    src={newProductImage}
                    alt="New bottle"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setNewProductImage('')}
                    className="absolute -top-1 -right-1 p-0.5 bg-rose-600 text-white rounded-full"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                  <Wine className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="font-montserrat font-bold text-slate-800">
                  Bottle Photo (Optional)
                </div>
                <div className="text-[10px] text-slate-500">
                  Upload bottle image directly from your camera or photo gallery.
                </div>
              </div>
            </div>

            <label className="px-3 py-1.5 bg-[#0A006E] text-[#FFDE00] rounded-lg font-montserrat font-black text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-[#060046] transition">
              <Upload className="w-3.5 h-3.5" />
              {newProductImage ? 'Change Bottle Photo' : 'Upload Bottle Photo'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const rawData = ev.target?.result as string;
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      const maxDim = 400;
                      let width = img.width;
                      let height = img.height;
                      if (width > height) {
                        if (width > maxDim) {
                          height = Math.round((height * maxDim) / width);
                          width = maxDim;
                        }
                      } else {
                        if (height > maxDim) {
                          width = Math.round((width * maxDim) / height);
                          height = maxDim;
                        }
                      }
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        setNewProductImage(canvas.toDataURL('image/jpeg', 0.85));
                      } else {
                        setNewProductImage(rawData);
                      }
                    };
                    img.src = rawData;
                  };
                  reader.readAsDataURL(file);
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Plus className="w-4 h-4" />
            Generate Auto-SKU & Receive Into Bonded Inventory
          </button>
        </div>
      </form>
      )}

      {productFeedback && (
        <div className="p-3 bg-[#34D186]/20 border border-[#34D186] text-[#0A006E] rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1E9E60]" />
          {productFeedback}
        </div>
      )}

      {/* Master Catalog Filter Bar & Table */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
        {/* Row 1: Search Bar & Stock Category Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setTableLimit(60);
              }}
              placeholder={`Filter ${products.length} master SKUs by brand, product name, Auto-SKU, or EAN-13 barcode...`}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-montserrat"
            />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
            {(['ALL', 'IPS', 'LPS'] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => {
                  setFilterStockCat(sc);
                  setTableLimit(60);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black cursor-pointer transition ${
                  filterStockCat === sc
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {sc === 'ALL' ? 'All Stock' : sc === 'IPS' ? 'IPS (Imported)' : 'LPS (Local)'}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Action & Wipe Toolbar */}
        {onWipeAllProducts && (
          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleSelectAllProducts}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-[#0A006E] border border-slate-300 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
              >
                {selectedProductIds.size === filteredProducts.length && filteredProducts.length > 0 ? 'Deselect All' : `Select All (${filteredProducts.length})`}
              </button>

              {selectedProductIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleWipeSelectedProducts}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  Wipe Selected ({selectedProductIds.size})
                </button>
              )}

              <button
                type="button"
                onClick={handleSelectAllAndWipe}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 text-[#FFDE00] border border-red-500 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition"
              >
                Select All & Wipe All
              </button>

              {onWipeInventoryToZero && (
                <button
                  type="button"
                  onClick={onWipeInventoryToZero}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition"
                  title="Wipe all inventory stock levels back to 0 across all branches"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Wipe Stock to Zero (0 Btls)
                </button>
              )}

              <button
                type="button"
                onClick={onWipeAllProducts}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                title="Completely purge all product definitions from database"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Purge All SKUs
              </button>
            </div>

            {canEditProduct ? (
              <span className="px-2.5 py-1 bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/50 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {currentUser.role}: Can Edit Specs & Upload Photos
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold flex items-center gap-1">
                <Lock className="w-3 h-3" />
                View-Only
              </span>
            )}
          </div>
        )}

        {/* Row 3: Stock Rotation & Health Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-slate-200">
          <span className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider shrink-0 mr-1">
            Stock Rotation & Health:
          </span>
          {(
            [
              { id: 'ALL', label: `All Stock (${products.length})` },
              { id: 'HEALTHY', label: 'Healthy Rotation' },
              { id: 'DEAD_STOCK', label: `Dead Stock Alert (${stockHealthMetrics.deadStockCount})` },
              { id: 'EXPIRING', label: `Expiring Soon (${stockHealthMetrics.expiringSoonCount})` },
              {
                id: 'DAMAGED_SPOILED',
                label: `Damaged/Spoiled (${stockHealthMetrics.totalDamagedBottles + stockHealthMetrics.totalSpoiledBottles})`,
              },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilterRotationStatus(item.id);
                setTableLimit(60);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
                filterRotationStatus === item.id
                  ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Row 4: Barcode Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <Barcode className="w-3.5 h-3.5 text-[#0A006E]" />
            Barcode Status:
          </span>
          {[
            { id: 'ALL', label: `All Items (${products.length})` },
            {
              id: 'AWAITING',
              label: `⚠️ Awaiting Real Barcode (${products.filter((p) => !p.hasRealBarcode).length})`,
            },
            {
              id: 'REGISTERED',
              label: `✓ Real Barcode Verified (${products.filter((p) => Boolean(p.hasRealBarcode)).length})`,
            },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilterBarcodeStatus(item.id as any);
                setTableLimit(60);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
                filterBarcodeStatus === item.id
                  ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Row 5: Subcategories Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          <button
            type="button"
            onClick={() => {
              setFilterSubCat('ALL');
              setTableLimit(60);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
              filterSubCat === 'ALL'
                ? 'bg-[#0A006E] text-[#FFDE00]'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            All 12 Subcategories ({filteredProducts.length})
          </button>
          {NAIROBI_DRINKS_SUB_CATEGORIES.map((sub) => (
            <button
              key={sub}
              type="button"
              onClick={() => {
                setFilterSubCat(sub);
                setTableLimit(60);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer transition ${
                filterSubCat === sub
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>


        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                    onChange={handleSelectAllProducts}
                    className="cursor-pointer accent-[#FFDE00]"
                    title="Select All"
                  />
                </th>
                <th className="py-2.5 px-3 font-black">Bottle</th>
                <th className="py-2.5 px-3 font-black">Auto SKU & Barcode</th>
                <th className="py-2.5 px-3 font-black">Brand & Product Name</th>
                <th className="py-2.5 px-3 font-black">Class & Subcategory</th>
                <th className="py-2.5 px-3 font-black">Spec & Origin</th>
                <th className="py-2.5 px-3 font-black text-right">Wholesale (KES)</th>
                <th className="py-2.5 px-3 font-black text-right">Retail (KES)</th>
                <th className="py-2.5 px-3 font-black text-right">
                  {currentUser.role === 'Branch Manager'
                    ? `Branch Stock (${currentUser.branchName})`
                    : 'Total Bottles'}
                </th>
                {canEditProduct && (
                  <th className="py-2.5 px-3 font-black text-right">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-500 font-montserrat">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200 shadow-xs">
                        <Package className="w-8 h-8 text-amber-600" />
                      </div>
                      <div className="text-base font-bold text-slate-800">Inventory Database is Wiped & Empty</div>
                      <div className="text-xs text-slate-500 max-w-md text-center">
                        Awaiting new inventory to be uploaded. Click "Bulk Import CSV" or "Onboard Products" to upload your new catalog.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {filteredProducts.slice(0, tableLimit).map((p) => {
                const packSize = p.packSize || p.bottlesPerCase || 12;
                const abv = p.alcoholPercentage ?? p.abv ?? 40;
                const wholesale = p.wholesalePriceKes ?? p.baseWholesalePrice ?? 0;
                const retail = p.retailPriceKes ?? p.baseRetailPrice ?? 0;
                const totalBtls = p.totalBottles ?? 0;

                const deadDays = p.deadStockThresholdDays || thresholdSettings.defaultDeadStockDays;
                const lastMove = p.lastStockMovementDate ? new Date(p.lastStockMovementDate) : new Date(p.createdAt || '2026-08-01');
                const daysInactive = Math.max(0, Math.floor((now.getTime() - lastMove.getTime()) / (1000 * 60 * 60 * 24)));
                const isDead = daysInactive >= deadDays && totalBtls > 0;

                const expiryDays = p.expiryThresholdDays || thresholdSettings.defaultExpiryWarningDays;
                const expiryDateStr = p.batchExpiryDate || p.defaultExpiryDate;
                let daysToExpiry: number | null = null;
                let isExpiringSoon = false;
                if (expiryDateStr) {
                  const expDate = new Date(expiryDateStr);
                  daysToExpiry = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  if (daysToExpiry <= expiryDays && daysToExpiry >= 0) isExpiringSoon = true;
                }
                const dmg = p.damagedBottlesCount || 0;
                const spoil = p.spoiledBottlesCount || 0;

                return (
                  <tr key={p.id} className={`hover:bg-slate-50 ${selectedProductIds.has(p.id) ? 'bg-amber-50/60' : ''}`}>
                    <td className="py-2 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(p.id)}
                        onChange={() => {
                          const next = new Set(selectedProductIds);
                          if (next.has(p.id)) next.delete(p.id);
                          else next.add(p.id);
                          setSelectedProductIds(next);
                        }}
                        className="cursor-pointer accent-[#0A006E]"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <ProductImage
                        product={{
                          ...p,
                          category: p.category === 'LPS' ? 'LPS' : 'IPS',
                        }}
                        size="xs"
                        onClick={canEditProduct ? () => handleStartEditProduct(p) : undefined}
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular">
                      <div className="font-bold text-[#0A006E]">{p.sku}</div>
                      {p.hasRealBarcode && p.barcode ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[9px] font-mono-tabular font-bold mt-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          {p.barcode}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[9px] font-montserrat font-bold mt-0.5">
                          <AlertCircle className="w-2.5 h-2.5 text-amber-600" />
                          Awaiting Real Barcode
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-montserrat font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.brand} · {p.importDeclarationNumber || p.importEntryRef}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {isDead && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-[9px] font-black uppercase">
                            Dead Stock ({daysInactive}d inactive)
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="px-1.5 py-0.5 bg-orange-100 text-orange-900 border border-orange-300 rounded text-[9px] font-black uppercase">
                            Expiring in {daysToExpiry}d
                          </span>
                        )}
                        {(dmg > 0 || spoil > 0) && (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded text-[9px] font-black uppercase">
                            Loss: {dmg} dmg / {spoil} spoil
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-montserrat font-black text-[#0A006E]">{p.category}</span> ·{' '}
                      <span className="text-slate-700 font-semibold">{p.subCategory}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono-tabular">
                      {p.volumeMl}ml · {abv}% · {p.countryOfOrigin || p.originCountry}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">
                      {formatKes(wholesale)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#0A006E]">
                      {formatKes(retail)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">
                      {totalBtls} ({Math.floor(totalBtls / packSize)} cs)
                    </td>
                    {canEditProduct && (
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canLogDamage && (
                            <button
                              type="button"
                              onClick={() => {
                                setIncidentTargetProduct(p);
                                setIsLogIncidentModalOpen(true);
                              }}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-[10px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                              title="Log damage or spoilage incident for this SKU"
                            >
                              <PackageX className="w-3 h-3 text-rose-600" />
                              Log Loss
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setBarcodeAssignmentTargetProductId(p.id);
                              setIsBarcodeAssignmentModalOpen(true);
                            }}
                            className={`px-2 py-1 rounded-lg text-[10px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap ${
                              p.hasRealBarcode
                                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                : 'bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border border-amber-400 shadow-xs'
                            }`}
                            title="Scan and link real bottle barcode"
                          >
                            <Barcode className="w-3 h-3 text-[#0A006E]" />
                            {p.hasRealBarcode ? 'Re-Scan Barcode' : 'Scan Real Barcode'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEditProduct(p)}
                            className="px-2.5 py-1 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                          >
                            <Edit3 className="w-3 h-3 text-[#FFDE00]" />
                            Edit
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length > tableLimit && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setTableLimit((prev) => prev + 80)}
              className="px-5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer"
            >
              Show More Inventory ({filteredProducts.length - tableLimit} remaining)
            </button>
          </div>
        )}
      </div>

      {/* Product Edit & Image Upload Modal (Strictly for Inventory Controller & Admin) */}
      {editingProduct && canEditProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/80 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-none sm:max-w-2xl h-full sm:h-auto bg-white rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 shadow-2xl overflow-hidden my-0 sm:my-auto sm:max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0A006E] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#FFDE00] text-[#0A006E] rounded-xl">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm text-[#FFDE00]">
                    Edit Product & Upload Bottle Photo
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono-tabular">
                    SKU: {editingProduct.sku} · Role: {currentUser.role} ({currentUser.name})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveProductEdit} className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Photo Upload & Preview Section */}
              <div className="p-4 bg-[#F0F2F0] border-2 border-dashed border-[#0A006E]/30 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
                <div className="shrink-0 relative group">
                  <ProductImage
                    product={{
                      ...editingProduct,
                      name: editName,
                      image: editImage,
                      category: editCategory,
                      subCategory: editSubCategory,
                    }}
                    size="xl"
                  />
                  {editImage && (
                    <button
                      type="button"
                      onClick={() => setEditImage('')}
                      className="absolute -top-2 -right-2 p-1 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700 cursor-pointer"
                      title="Remove uploaded image and use default illustration"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                  <div className="font-montserrat font-black text-slate-900 text-sm">
                    Bottle Product Image
                  </div>
                  <p className="text-[11px] text-slate-600">
                    Upload bottle photo directly from your device camera or gallery. The image is compressed automatically to maintain instant ERP responsiveness.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 justify-center sm:justify-start">
                    <label className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition">
                      <Upload className="w-3.5 h-3.5 text-[#FFDE00]" />
                      Upload Bottle Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileUpload}
                        className="hidden"
                      />
                    </label>

                    {editImage && (
                      <button
                        type="button"
                        onClick={() => setEditImage('')}
                        className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-rose-600 rounded-xl font-montserrat font-bold text-xs cursor-pointer transition"
                      >
                        Clear Custom Image
                      </button>
                    )}
                  </div>

                  <div className="pt-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Or Paste Web Image URL
                    </label>
                    <input
                      type="url"
                      value={editImage}
                      onChange={(e) => setEditImage(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Product Core Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Product Name *</label>
                  <input
                    required
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Brand Name</label>
                  <input
                    type="text"
                    value={editBrand}
                    onChange={(e) => setEditBrand(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Stock Class</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as StockCategory)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-[#0A006E]"
                  >
                    <option value="IPS">IPS — Imported Products Stock (Bonded)</option>
                    <option value="LPS">LPS — Local Products Stock (Domestic)</option>
                  </select>
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Subcategory</label>
                  <select
                    value={editSubCategory}
                    onChange={(e) => setEditSubCategory(e.target.value as LiquorSubCategory)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold"
                  >
                    {NAIROBI_DRINKS_SUB_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Volume (ml)</label>
                  <input
                    type="number"
                    value={editVolumeMl}
                    onChange={(e) => setEditVolumeMl(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Alcohol By Volume (ABV %)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editAbv}
                    onChange={(e) => setEditAbv(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Base Wholesale Price (KES) *</label>
                  <input
                    required
                    type="number"
                    value={editWholesale}
                    onChange={(e) => setEditWholesale(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Base Retail Price (KES) *</label>
                  <input
                    required
                    type="number"
                    value={editRetail}
                    onChange={(e) => setEditRetail(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-black text-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Base Landed Cost (KES)</label>
                  <input
                    type="number"
                    value={editCost}
                    onChange={(e) => setEditCost(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Total Stock (Bottles)</label>
                  <input
                    required
                    type="number"
                    value={editTotalBottles}
                    onChange={(e) => setEditTotalBottles(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-montserrat font-bold text-slate-700">Real Bottle Barcode (EAN-13)</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingProduct) {
                          setBarcodeAssignmentTargetProductId(editingProduct.id);
                          setIsBarcodeAssignmentModalOpen(true);
                        }
                      }}
                      className="text-[10px] font-montserrat font-black text-[#0A006E] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3 h-3" />
                      Scan with Camera / Gun
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    placeholder="Scan bottle or type real digits..."
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Outer Case Barcode (ITF-14)</label>
                  <input
                    type="text"
                    value={editCaseBarcode}
                    onChange={(e) => setEditCaseBarcode(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Country of Origin</label>
                  <input
                    type="text"
                    value={editOrigin}
                    onChange={(e) => setEditOrigin(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Authorized Supplier / Importer</label>
                  <input
                    type="text"
                    value={editSupplier}
                    onChange={(e) => setEditSupplier(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>

              {/* Inventory Health & Governance Thresholds Section */}
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0A006E]" />
                  <div className="font-montserrat font-black text-xs text-[#0A006E] uppercase">
                    Inventory Governance Thresholds & Stock Health
                  </div>
                </div>
                <p className="text-[11px] text-slate-600">
                  Custom dead-stock and expiry thresholds configured by the Inventory Manager for this specific liquor SKU.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="font-montserrat font-bold text-slate-700">
                      Dead Stock Threshold (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="730"
                      value={editDeadStockDays}
                      onChange={(e) => setEditDeadStockDays(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                    />
                    <span className="text-[10px] text-slate-500">Flags stock inactive after X days</span>
                  </div>

                  <div>
                    <label className="font-montserrat font-bold text-slate-700">
                      Expiry Warning Alert (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={editExpiryDays}
                      onChange={(e) => setEditExpiryDays(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                    />
                    <span className="text-[10px] text-slate-500">Flags batches before expiry</span>
                  </div>

                  <div>
                    <label className="font-montserrat font-bold text-slate-700">
                      Batch Expiry Date
                    </label>
                    <input
                      type="date"
                      value={editBatchExpiryDate}
                      onChange={(e) => setEditBatchExpiryDate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular"
                    />
                    <span className="text-[10px] text-slate-500">Cream liqueurs & fortified stock</span>
                  </div>

                  <div>
                    <label className="font-montserrat font-bold text-slate-700">
                      Damaged Bottles (Logged)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editDamagedCount}
                      onChange={(e) => setEditDamagedCount(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular text-rose-700 font-bold"
                    />
                    <span className="text-[10px] text-slate-500">Broken seal / cracked glass count</span>
                  </div>

                  <div>
                    <label className="font-montserrat font-bold text-slate-700">
                      Spoiled Bottles (Logged)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editSpoiledCount}
                      onChange={(e) => setEditSpoiledCount(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular text-rose-700 font-bold"
                    />
                    <span className="text-[10px] text-slate-500">Oxidized or curdled bottles</span>
                  </div>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#0A006E] rounded-xl font-montserrat font-black flex items-center gap-2 cursor-pointer shadow-md transition disabled:opacity-50"
                >
                  {isSavingProduct ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving Updates...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Product & Sync Image
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal with Automated Pre-Upload Duplicate Testing */}
      <CsvInventoryImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        branches={branches}
        existingProducts={products}
        onBatchImport={async (drafts) => {
          if (onBatchCreateProducts) {
            return await onBatchCreateProducts(drafts);
          }
          let count = 0;
          for (const d of drafts) {
            await onCreateProduct(d);
            count++;
          }
          return count;
        }}
      />

      {/* Inventory Governance Thresholds Modal (Dead Stock, Expiry Warning, Max Damage/Spoilage) */}
      {isThresholdModalOpen && (
        <StockThresholdsGovernanceModal
          currentSettings={thresholdSettings}
          onSave={handleSaveThresholdSettings}
          onClose={() => setIsThresholdModalOpen(false)}
        />
      )}

      {/* Log Damage / Spoilage Incident Modal */}
      {isLogIncidentModalOpen && (
        <LogDamageSpoilageModal
          products={products}
          branches={branches}
          currentUser={currentUser}
          initialProduct={incidentTargetProduct}
          onLogIncident={handleLogIncidentDirect}
          onClose={() => {
            setIsLogIncidentModalOpen(false);
            setIncidentTargetProduct(null);
          }}
        />
      )}

      {/* Real Barcode Assignment & Scanning Station Modal */}
      {isBarcodeAssignmentModalOpen && onUpdateProduct && (
        <InventoryBarcodeAssignmentModal
          isOpen={isBarcodeAssignmentModalOpen}
          onClose={() => {
            setIsBarcodeAssignmentModalOpen(false);
            setBarcodeAssignmentTargetProductId(undefined);
          }}
          products={products}
          initialProductId={barcodeAssignmentTargetProductId}
          currentUser={currentUser}
          onUpdateProduct={onUpdateProduct}
        />
      )}

      {/* Inventory Duplicate Check Modal */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border-2 border-[#0A006E] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl ${duplicateFindings.totalDuplicates === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-montserrat font-black text-[#0A006E]">
                    Inventory Duplicate Check Results
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scanned {products.length} master SKUs for duplicate SKUs, barcodes, and product names.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {duplicateFindings.totalDuplicates === 0 ? (
              <div className="p-6 bg-emerald-50 border-2 border-emerald-300 rounded-2xl text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                <h4 className="text-sm font-montserrat font-black text-emerald-950">
                  Catalog is 100% Unique & Clean!
                </h4>
                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                  No duplicate SKUs, duplicate EAN-13 barcodes, or duplicate product names were detected across all {products.length} catalog items.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Found {duplicateFindings.totalDuplicates} potential duplicate group(s) requiring review.</span>
                </div>

                {duplicateFindings.duplicateSkus.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-montserrat font-bold text-[#0A006E]">Duplicate SKUs ({duplicateFindings.duplicateSkus.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {duplicateFindings.duplicateSkus.map((group, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="font-mono font-bold text-red-600">SKU: {group.sku}</div>
                          </div>
                          <div className="space-y-1">
                            {group.items.map((item) => (
                              <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedForDeletion.has(item.id)}
                                  onChange={() => toggleItemSelection(item.id)}
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span className="text-[11px] text-slate-700">{item.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {duplicateFindings.duplicateBarcodes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-montserrat font-bold text-[#0A006E]">Duplicate Barcodes ({duplicateFindings.duplicateBarcodes.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {duplicateFindings.duplicateBarcodes.map((group, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="font-mono font-bold text-red-600">Barcode: {group.barcode}</div>
                          </div>
                          <div className="space-y-1">
                            {group.items.map((item) => (
                              <label key={item.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedForDeletion.has(item.id)}
                                  onChange={() => toggleItemSelection(item.id)}
                                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span className="text-[11px] text-slate-700">{item.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {duplicateFindings.duplicateNames.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-montserrat font-bold text-[#0A006E]">Duplicate Product Names ({duplicateFindings.duplicateNames.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {duplicateFindings.duplicateNames.map((group, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <div className="font-bold text-[#0A006E]">Name: {group.name}</div>
                          <div className="text-[11px] text-slate-600">
                            Shared by {group.items.length} items (SKUs: {group.items.map(i => i.sku).join(', ')}).
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200 gap-3">
              {selectedForDeletion.size > 0 && (
                <button
                  type="button"
                  onClick={handleClearSelectedDuplicates}
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-montserrat font-black text-xs cursor-pointer shadow-md hover:bg-rose-700"
                >
                  Delete {selectedForDeletion.size} Selected
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-5 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs cursor-pointer shadow-md"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. BRANCH CREATION & STOCK TRANSFER MODULE
// ---------------------------------------------------------------------------
export const BranchesAndTransfersModule: React.FC<{
  currentUser: StaffMember;
  branches: Branch[];
  allBranches?: Branch[];
  regions: GeoRegion[];
  products: Product[];
  partners: Partner[];
  transfers: StockTransfer[];
  onCreateBranch: (b: Omit<Branch, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteBranch?: (branchId: string) => Promise<void>;
  onSetMainBranch?: (branchId: string) => Promise<void>;
  onCreateStockTransfer: (
    tr: Omit<StockTransfer, 'id' | 'createdAt'>,
    updatedProduct: { productId: string; newBranchStockJson: string }
  ) => Promise<void>;
  onReceiveStockTransfer?: (transferId: string) => Promise<void>;
}> = ({
  currentUser,
  branches,
  allBranches,
  regions,
  products,
  partners,
  transfers,
  onCreateBranch,
  onDeleteBranch,
  onSetMainBranch,
  onCreateStockTransfer,
  onReceiveStockTransfer,
}) => {
  const [facilityType, setFacilityType] = useState<FacilityType>('warehouse');
  const [facilityFilter, setFacilityFilter] = useState<'all' | FacilityType>('all');
  const [branchName, setBranchName] = useState('');
  const [branchRegionId, setBranchRegionId] = useState(regions[0]?.id || '');
  const [branchAddress, setBranchAddress] = useState('');
  const [exciseBondLicense, setExciseBondLicense] = useState('');
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdmin = currentUser.role === 'Admin';
  const isBranchManager = currentUser.role === 'Branch Manager';
  const isSalesManager = currentUser.role === 'Sales Manager';
  const isInventory = currentUser.role === 'Inventory Controller';

  const transferBranches = allBranches && allBranches.length > 0 ? allBranches : branches;

  const canManageBranches = isAdmin; // Only Admin can administer branches
  const canInitiateTransfer = isAdmin || isInventory || isBranchManager;

  const [fromBranchId, setFromBranchId] = useState(
    isBranchManager && currentUser.branchId ? currentUser.branchId : branches[0]?.id || ''
  );
  const [toBranchId, setToBranchId] = useState(
    transferBranches.find((b) => b.id !== (isBranchManager && currentUser.branchId ? currentUser.branchId : branches[0]?.id))?.id || transferBranches[1]?.id || transferBranches[0]?.id || ''
  );
  const [transferList, setTransferList] = useState<Array<{ productId: string; sku: string; productName: string; quantityBottles: number }>>([]);
  const [selectedTransferProductId, setSelectedTransferProductId] = useState(products[0]?.id || '');
  const [transferItemQty, setTransferItemQty] = useState<number>(12);
  const [vehicleReg, setVehicleReg] = useState('');
  const [excisePermitNo, setExcisePermitNo] = useState('');

  const handleAddTransferItem = () => {
    const prod = products.find((p) => p.id === selectedTransferProductId);
    if (!prod) return;
    const qty = Math.max(1, Number(transferItemQty) || 1);

    setTransferList((prev) => {
      const idx = prev.findIndex((item) => item.productId === prod.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantityBottles: updated[idx].quantityBottles + qty,
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          quantityBottles: qty,
        },
      ];
    });
    setTransferItemQty(12);
  };

  const handleRemoveTransferItem = (id: string) => {
    setTransferList((prev) => prev.filter((item) => item.productId !== id));
  };

  const logisticsPartners = useMemo(
    () => partners.filter((p) => p.partnerType === 'Logistics'),
    [partners]
  );
  const [logisticsName, setLogisticsName] = useState('');

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim() || !canManageBranches) return;
    const reg = regions.find((r) => r.id === branchRegionId) || regions[0];
    const prefix =
      facilityType === 'warehouse'
        ? 'WHS'
        : facilityType === 'store'
        ? 'STR'
        : facilityType === 'shop'
        ? 'SHP'
        : 'BR';
    const cleanName = branchName.trim();
    const tag = cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'HUB';
    const code = `${prefix}-${tag}-00${branches.length + 1}`;
    await onCreateBranch({
      code,
      name: cleanName,
      facilityType,
      regionId: reg?.id || 'reg-metro-core',
      regionName: reg?.name || 'Metropolitan Zone',
      address: branchAddress.trim() || `${facilityType.toUpperCase()} Commercial Premises`,
      managerName: currentUser.name,
      exciseBondLicense: exciseBondLicense.trim() || (facilityType === 'warehouse' ? 'KRA-BOND-2026-REG' : 'EXEMPT-RETAIL-LIC'),
      status: 'Operational',
    });
    setBranchName('');
    setBranchAddress('');
    setExciseBondLicense('');
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canInitiateTransfer) return;
    if (fromBranchId === toBranchId) return;
    if (transferList.length === 0) {
      alert('Please add at least one product to the transfer list before authorizing transfer.');
      return;
    }
    const fromBr = branches.find((b) => b.id === fromBranchId);
    const toBr = branches.find((b) => b.id === toBranchId);
    if (!fromBr || !toBr) return;

    // For Branch Manager, ensure transfer involves their branch
    if (isBranchManager && fromBr.name !== currentUser.branchName && toBr.name !== currentUser.branchName && fromBr.id !== currentUser.branchId && toBr.id !== currentUser.branchId) {
      return;
    }

    const batchNo = `TRF-${Date.now().toString().slice(-6)}`;

    for (const item of transferList) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;

      const fallbackTotal = prod.totalBottles ?? (prod.packSize || 12) * 30;
      let branchStock: Record<string, number> = {};
      try {
        branchStock = prod.branchStockSummary ? JSON.parse(prod.branchStockSummary) : {};
      } catch {
        branchStock = {};
      }

      const sourceAvail = branchStock[fromBr.id] ?? fallbackTotal;
      const actualMove = Math.min(sourceAvail, item.quantityBottles);
      branchStock[fromBr.id] = Math.max(0, sourceAvail - actualMove);
      branchStock[toBr.id] = (branchStock[toBr.id] ?? 0) + actualMove;

      await onCreateStockTransfer(
        {
          transferNo: `${batchNo}-${item.sku.slice(0, 4)}`,
          fromBranchId: fromBr.id,
          fromBranchName: fromBr.name,
          toBranchId: toBr.id,
          toBranchName: toBr.name,
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          quantityBottles: actualMove,
          logisticsPartnerName: logisticsName,
          vehicleReg,
          excisePermitNo,
          status: 'Dispatched',
          initiatedBy: `${currentUser.name} (${currentUser.role})`,
        },
        {
          productId: prod.id,
          newBranchStockJson: JSON.stringify(branchStock),
        }
      );
    }

    setTransferList([]);
    setVehicleReg('');
    setExcisePermitNo('');
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create New Facility Card / Boundary Card */}
        {canManageBranches ? (
          <form
            onSubmit={handleAddBranch}
            className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#0A006E]" />
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Commission Facility · Store, Shop, or Warehouse
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-[#0A006E] uppercase">
                {facilityType.replace('_', ' ')}
              </span>
            </div>

            {/* Facility Type Selector Pills */}
            <div>
              <label className="font-montserrat font-bold text-slate-700 block mb-1.5 text-xs">
                Select Facility Class &amp; Purpose *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setFacilityType('warehouse')}
                  className={`p-2.5 rounded-xl border-2 flex flex-col items-center gap-1 text-center cursor-pointer transition ${
                    facilityType === 'warehouse'
                      ? 'border-[#0A006E] bg-blue-50 text-[#0A006E] font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Warehouse className={`w-5 h-5 ${facilityType === 'warehouse' ? 'text-blue-700' : 'text-slate-500'}`} />
                  <span className="font-montserrat font-bold text-xs">Warehouse</span>
                  <span className="text-[9px] text-slate-500">Storage &amp; Bonded Depot</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFacilityType('store')}
                  className={`p-2.5 rounded-xl border-2 flex flex-col items-center gap-1 text-center cursor-pointer transition ${
                    facilityType === 'store'
                      ? 'border-[#0A006E] bg-emerald-50 text-[#0A006E] font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Store className={`w-5 h-5 ${facilityType === 'store' ? 'text-emerald-700' : 'text-slate-500'}`} />
                  <span className="font-montserrat font-bold text-xs">Store</span>
                  <span className="text-[9px] text-slate-500">Retail Spirits Store</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFacilityType('shop')}
                  className={`p-2.5 rounded-xl border-2 flex flex-col items-center gap-1 text-center cursor-pointer transition ${
                    facilityType === 'shop'
                      ? 'border-[#0A006E] bg-purple-50 text-[#0A006E] font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShoppingBag className={`w-5 h-5 ${facilityType === 'shop' ? 'text-purple-700' : 'text-slate-500'}`} />
                  <span className="font-montserrat font-bold text-xs">Shop</span>
                  <span className="text-[9px] text-slate-500">Counter Trade Shop</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFacilityType('branch_depot')}
                  className={`p-2.5 rounded-xl border-2 flex flex-col items-center gap-1 text-center cursor-pointer transition ${
                    facilityType === 'branch_depot'
                      ? 'border-[#0A006E] bg-amber-50 text-[#0A006E] font-bold shadow-xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className={`w-5 h-5 ${facilityType === 'branch_depot' ? 'text-amber-700' : 'text-slate-500'}`} />
                  <span className="font-montserrat font-bold text-xs">Branch Depot</span>
                  <span className="text-[9px] text-slate-500">Regional Joint Hub</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-montserrat font-bold text-slate-700">
                  {facilityType === 'warehouse' ? 'Warehouse Name *' : facilityType === 'store' ? 'Store Name *' : facilityType === 'shop' ? 'Shop Name *' : 'Branch / Depot Name *'}
                </label>
                <input
                  required
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder={
                    facilityType === 'warehouse'
                      ? 'e.g. Central Bonded Spirits Warehouse'
                      : facilityType === 'store'
                      ? 'e.g. Kilimani Retail Bottle Store'
                      : facilityType === 'shop'
                      ? 'e.g. Westlands Commercial Liquor Shop'
                      : 'e.g. Karen Suburban Bonded Hub'
                  }
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-montserrat font-bold text-slate-700">Assigned Geo-Location Zone</label>
                <select
                  value={branchRegionId}
                  onChange={(e) => setBranchRegionId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
                >
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.tierType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-montserrat font-bold text-slate-700">
                  Physical Premises / Yard Address *
                </label>
                <input
                  required
                  type="text"
                  value={branchAddress}
                  onChange={(e) => setBranchAddress(e.target.value)}
                  placeholder={
                    facilityType === 'warehouse'
                      ? 'e.g. Industrial Area Logistics Depot, Gate 3'
                      : facilityType === 'store'
                      ? 'e.g. Argwings Kodhek Rd, Suite #12'
                      : facilityType === 'shop'
                      ? 'e.g. Woodvale Grove Wholesale Counter #4'
                      : 'e.g. Industrial Park Block C'
                  }
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="font-montserrat font-bold text-slate-700">
                  {facilityType === 'warehouse' ? 'Customs Bond License *' : 'Trading / Excise Permit'}
                </label>
                <input
                  type="text"
                  value={exciseBondLicense}
                  onChange={(e) => setExciseBondLicense(e.target.value)}
                  placeholder={
                    facilityType === 'warehouse'
                      ? 'e.g. KRA-BOND-2026-9901A'
                      : facilityType === 'store'
                      ? 'e.g. RETAIL-LIQUOR-LIC-2026'
                      : 'e.g. MERCHANT-PERMIT-2026'
                  }
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition"
            >
              <Plus className="w-4 h-4 text-[#FFDE00]" />
              Commission New {facilityType === 'warehouse' ? 'Warehouse' : facilityType === 'store' ? 'Store' : facilityType === 'shop' ? 'Shop' : 'Branch'}
            </button>
          </form>
      ) : (
        <div className="bg-[#F0F2F0] border-2 border-slate-200 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Building2 className="w-4 h-4 text-[#0A006E]" />
              <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                Branch Governance Scope · {currentUser.role}
              </h3>
            </div>
            <p className="text-xs text-slate-700 mt-3 leading-relaxed">
              Establishing new regional distribution yards and customs-bonded depots is strictly administered by Executive System Administration.
              {isBranchManager
                ? ` Your operational scope is bounded to ${currentUser.branchName} and its assigned commercial units.`
                : ' Your role grants authorized visibility into branch operational status and stock logistics.'}
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-[#0A006E]">Active Assigned Depot:</span>{' '}
            <span className="font-semibold text-slate-800">{currentUser.branchName}</span>
          </div>
        </div>
      )}

      {/* Inter-Branch Bonded Stock Transfer Card */}
      {canInitiateTransfer ? (
        <form
          onSubmit={handleExecuteTransfer}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <ArrowLeftRight className="w-4 h-4 text-[#0A006E]" />
            <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
              Inter-Branch Bonded Stock Transfer &amp; Multi-SKU Transit Manifest
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Source Branch (Dispatch)</label>
              <select
                value={fromBranchId}
                onChange={(e) => setFromBranchId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              >
                {transferBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-montserrat font-bold text-slate-700">Destination Branch (Receiving)</label>
              <select
                value={toBranchId}
                onChange={(e) => setToBranchId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              >
                {transferBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Product Selection & Add to Transfer List */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-2xl space-y-3">
            <h4 className="text-xs font-montserrat font-black text-[#0A006E]">
              Select Products &amp; Build Transfer Manifest List
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-end">
              <div className="sm:col-span-7">
                <label className="font-montserrat font-bold text-slate-700 block mb-1">Select Liquor SKU</label>
                <select
                  value={selectedTransferProductId}
                  onChange={(e) => setSelectedTransferProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-[#0A006E]"
                >
                  {products.slice(0, 150).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="font-montserrat font-bold text-slate-700 block mb-1">Quantity (Btls)</label>
                <input
                  type="number"
                  min={1}
                  value={transferItemQty}
                  onChange={(e) => setTransferItemQty(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono-tabular font-black"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddTransferItem}
                  className="w-full py-2.5 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] font-montserrat font-black text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Added Items List Table */}
            {transferList.length > 0 ? (
              <div className="mt-3 overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 font-montserrat font-black text-slate-700">
                    <tr>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Product Name</th>
                      <th className="py-2 px-3 text-right">Quantity (Bottles)</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {transferList.map((item) => (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-[#0A006E]">{item.sku}</td>
                        <td className="py-2 px-3 text-slate-900">{item.productName}</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-[#0A006E]">{item.quantityBottles} btls</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveTransferItem(item.productId)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                No items added to transfer list yet. Select an SKU above and click Add.
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Vehicle Registration (Transit)</label>
              <input
                type="text"
                value={vehicleReg}
                onChange={(e) => setVehicleReg(e.target.value)}
                placeholder="e.g. KDG 992X / Lorry 04"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>

            <div>
              <label className="font-montserrat font-bold text-slate-700">Customs Excise Permit No</label>
              <input
                type="text"
                value={excisePermitNo}
                onChange={(e) => setExcisePermitNo(e.target.value)}
                placeholder="e.g. EXCISE-TRF-2026-99"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={transferList.length === 0}
            className={`px-5 py-3 rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
              transferList.length > 0
                ? 'bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E]'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
            }`}
          >
            <ArrowLeftRight className="w-4 h-4" />
            Authorize Multi-SKU Bonded Stock Transfer Manifest ({transferList.length} SKUs)
          </button>
        </form>
      ) : (
        <div className="bg-[#F0F2F0] border-2 border-slate-200 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <ArrowLeftRight className="w-4 h-4 text-[#0A006E]" />
              <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                Stock Transit Oversight · {currentUser.role} Scope
              </h3>
            </div>
            <p className="text-xs text-slate-700 mt-3 leading-relaxed">
              Stock transfer dispatches and inter-branch manifests are managed by authorized Inventory Controllers and Branch Managers. You have read-only visibility into transfer history and branch distribution below.
            </p>
          </div>
          <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-[#0A006E]">Active Logged Transfers:</span>{' '}
            <span className="font-semibold text-slate-800">{transfers.length} Recorded Movements</span>
          </div>
        </div>
      )}
      </div>

      {/* Facilities & Branches Directory with Store / Shop / Warehouse Filters */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#0A006E]" />
              <h3 className="text-sm sm:text-base font-montserrat font-black text-[#0A006E]">
                Operational Facilities: Stores, Shops &amp; Warehouses ({branches.length} Registered)
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Physical establishments registered in the ERP. The primary central warehouse serves as the master bonded repository.
            </p>
          </div>
          <span className="px-3 py-1 bg-white border border-slate-300 rounded-xl text-xs font-montserrat font-bold text-[#0A006E]">
            Main Hub: {branches.find((b) => b.isMain || b.code === 'BR-HQ-001')?.name || 'HQ - Main Branch'}
          </span>
        </div>

        {/* Filter Chips for Store, Shop, Warehouse */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={() => setFacilityFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold cursor-pointer transition ${
              facilityFilter === 'all'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Facilities ({branches.length})
          </button>
          <button
            type="button"
            onClick={() => setFacilityFilter('warehouse')}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold cursor-pointer transition flex items-center gap-1.5 ${
              facilityFilter === 'warehouse'
                ? 'bg-blue-700 text-white shadow-xs'
                : 'bg-white text-blue-800 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5" />
            Warehouses ({branches.filter((b) => b.facilityType === 'warehouse').length})
          </button>
          <button
            type="button"
            onClick={() => setFacilityFilter('store')}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold cursor-pointer transition flex items-center gap-1.5 ${
              facilityFilter === 'store'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            Stores ({branches.filter((b) => b.facilityType === 'store').length})
          </button>
          <button
            type="button"
            onClick={() => setFacilityFilter('shop')}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold cursor-pointer transition flex items-center gap-1.5 ${
              facilityFilter === 'shop'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-purple-800 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Shops ({branches.filter((b) => b.facilityType === 'shop').length})
          </button>
          <button
            type="button"
            onClick={() => setFacilityFilter('branch_depot')}
            className={`px-3 py-1.5 rounded-xl font-montserrat font-bold cursor-pointer transition flex items-center gap-1.5 ${
              facilityFilter === 'branch_depot'
                ? 'bg-amber-700 text-white shadow-xs'
                : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Branch Depots ({branches.filter((b) => !b.facilityType || b.facilityType === 'branch_depot').length})
          </button>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Code</th>
                <th className="py-2.5 px-3 font-black">Type</th>
                <th className="py-2.5 px-3 font-black">Facility Name</th>
                <th className="py-2.5 px-3 font-black">Geo-Zone &amp; Address</th>
                <th className="py-2.5 px-3 font-black">Customs / Permit</th>
                <th className="py-2.5 px-3 font-black">Status</th>
                <th className="py-2.5 px-3 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {branches
                .filter((b) => isBranchManager ? (b.id === currentUser.branchId || b.name === currentUser.branchName) : (facilityFilter === 'all' || (facilityFilter === 'branch_depot' ? (!b.facilityType || b.facilityType === 'branch_depot') : b.facilityType === facilityFilter)))
                .map((b) => {
                const isMainBranch = Boolean(
                  b.isMain ||
                  b.code === 'BR-HQ-001' ||
                  b.name.toLowerCase().includes('hq') ||
                  b.name.toLowerCase().includes('flagship')
                );
                const type = b.facilityType || 'warehouse';
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {b.code}
                    </td>
                    <td className="py-3 px-3">
                      {type === 'warehouse' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          <Warehouse className="w-3 h-3 text-blue-700" />
                          Warehouse
                        </span>
                      ) : type === 'store' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Store className="w-3 h-3 text-emerald-700" />
                          Store
                        </span>
                      ) : type === 'shop' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          <ShoppingBag className="w-3 h-3 text-purple-700" />
                          Shop
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <Building2 className="w-3 h-3 text-amber-700" />
                          Depot
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{b.name}</span>
                        {isMainBranch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFDE00] text-[#0A006E] border border-amber-300 shadow-2xs">
                            <Star className="w-2.5 h-2.5 fill-current" />
                            HQ · MAIN
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">
                      <div className="font-semibold text-slate-800">{b.regionName}</div>
                      <div className="text-[11px] text-slate-500">{b.address}</div>
                    </td>
                    <td className="py-3 px-3 font-mono-tabular text-slate-600">
                      {b.exciseBondLicense || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && !isMainBranch && onSetMainBranch && (
                          <button
                            type="button"
                            onClick={() => onSetMainBranch(b.id)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-montserrat font-bold cursor-pointer transition flex items-center gap-1"
                            title="Set as Main HQ Branch"
                          >
                            <Star className="w-3 h-3 text-amber-600" />
                            Set Main
                          </button>
                        )}
                        {isAdmin && !isMainBranch && onDeleteBranch ? (
                          <button
                            type="button"
                            onClick={() => setBranchToDelete(b)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-montserrat font-bold cursor-pointer transition flex items-center gap-1"
                            title="Decommission Branch"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        ) : isMainBranch ? (
                          <span className="text-[10px] font-montserrat font-bold text-slate-400 uppercase tracking-wider">
                            Protected Main
                          </span>
                        ) : (
                          <span className="text-[10px] font-montserrat font-semibold text-slate-400">
                            Managed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Branch Confirmation Modal */}
      {branchToDelete && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-2xl border-0 sm:border-2 border-[#0A006E] p-6 max-w-none sm:max-w-md w-full h-full sm:h-auto shadow-2xl space-y-4 flex flex-col justify-between sm:justify-start">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <h4 className="font-montserrat font-black text-base text-slate-900">
                Confirm Branch Decommission
              </h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-900">{branchToDelete.name}</span> ({branchToDelete.code})? Any staff assigned to this station will automatically be reassigned to HQ - Main Branch.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteBranch) return;
                  setIsDeleting(true);
                  await onDeleteBranch(branchToDelete.id);
                  setIsDeleting(false);
                  setBranchToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? 'Deleting...' : 'Confirm Decommission'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Dispatched Transfers Awaiting Receiving */}
      {transfers.filter((tr) => tr.status === 'Dispatched' && (!isBranchManager || tr.toBranchId === currentUser.branchId || tr.toBranchName === currentUser.branchName)).length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200 pb-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-700 animate-pulse" />
              <h3 className="text-sm font-montserrat font-black text-amber-900">
                Incoming Bonded Stock Transfers Awaiting Your Receipt &amp; Stock Auto-Update
              </h3>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-bold">
              {transfers.filter((tr) => tr.status === 'Dispatched' && (!isBranchManager || tr.toBranchId === currentUser.branchId || tr.toBranchName === currentUser.branchName)).length} Pending
            </span>
          </div>

          <div className="space-y-2">
            {transfers
              .filter((tr) => tr.status === 'Dispatched' && (!isBranchManager || tr.toBranchId === currentUser.branchId || tr.toBranchName === currentUser.branchName))
              .map((tr) => (
                <div key={tr.id} className="bg-white border border-amber-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-bold text-xs text-[#0A006E]">{tr.transferNo}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                        {tr.quantityBottles} Bottles · {tr.sku}
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-medium">
                      {tr.productName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Dispatched from <span className="font-semibold text-slate-700">{tr.fromBranchName}</span> → Destination: <span className="font-semibold text-[#0A006E]">{tr.toBranchName}</span> (Initiated by {tr.initiatedBy})
                    </p>
                  </div>

                  <button
                    onClick={() => onReceiveStockTransfer?.(tr.id)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-montserrat font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    Receive &amp; Add to Branch Stock
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Stock Transfer Ledger */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
            Inter-Branch Stock Transfer Ledger
          </h3>
          <button
            onClick={() => {
              const visibleTransfers = transfers.filter(
                (tr) =>
                  !isBranchManager ||
                  tr.fromBranchId === currentUser.branchId ||
                  tr.toBranchId === currentUser.branchId ||
                  tr.fromBranchName === currentUser.branchName ||
                  tr.toBranchName === currentUser.branchName
              );
              exportReportToPDF(
                'Inter-Branch Bonded Stock Transfer Manifest',
                `Exported by ${currentUser.name} (${isBranchManager ? currentUser.branchName : 'All Branches'})`,
                ['Transfer No', 'From Branch', 'To Branch', 'SKU', 'Product', 'Qty Btls', 'Carrier / Vehicle', 'Status'],
                visibleTransfers.map((t) => [
                  t.transferNo,
                  t.fromBranchName,
                  t.toBranchName,
                  t.sku,
                  t.productName,
                  t.quantityBottles,
                  `${t.logisticsPartnerName} (${t.vehicleReg})`,
                  t.status,
                ]),
                'Vaairo_Stock_Transfers'
              );
            }}
            className="px-3.5 py-1.5 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            Export Transfers PDF
          </button>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Transfer No</th>
                <th className="py-2.5 px-3 font-black">Source Branch</th>
                <th className="py-2.5 px-3 font-black">Destination Branch</th>
                <th className="py-2.5 px-3 font-black">Auto SKU & Product</th>
                <th className="py-2.5 px-3 font-black text-right">Qty (Btls)</th>
                <th className="py-2.5 px-3 font-black">Logistics & Excise Permit</th>
                <th className="py-2.5 px-3 font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {transfers.filter(
                (tr) =>
                  !isBranchManager ||
                  tr.fromBranchId === currentUser.branchId ||
                  tr.toBranchId === currentUser.branchId ||
                  tr.fromBranchName === currentUser.branchName ||
                  tr.toBranchName === currentUser.branchName
              ).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No inter-branch stock transfers recorded yet for your branch. Use the form above to move stock between branches.
                  </td>
                </tr>
              ) : (
                transfers
                  .filter(
                    (tr) =>
                      !isBranchManager ||
                      tr.fromBranchId === currentUser.branchId ||
                      tr.toBranchId === currentUser.branchId ||
                      tr.fromBranchName === currentUser.branchName ||
                      tr.toBranchName === currentUser.branchName
                  )
                  .map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {tr.transferNo}
                    </td>
                    <td className="py-2.5 px-3 text-slate-800">{tr.fromBranchName}</td>
                    <td className="py-2.5 px-3 text-slate-800 font-bold">{tr.toBranchName}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-mono-tabular font-bold text-[#0A006E]">{tr.sku}</span> · {tr.productName}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                      {tr.quantityBottles}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono-tabular">
                      {tr.vehicleReg} · {tr.excisePermitNo}
                    </td>
                    <td className="py-2.5 px-3 text-[#1E9E60] font-bold">{tr.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 4. GEO-LOCATION PRICING ENGINE MODULE (Suburb vs Lower Region Differential)
// ---------------------------------------------------------------------------
export const GeoPricingModule: React.FC<{
  currentUser: StaffMember;
  regions: GeoRegion[];
  products: Product[];
  onCreateRegion: (reg: Omit<GeoRegion, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateProductGeoOverride: (
    productId: string,
    regionId: string,
    wholesalePrice: number,
    retailPrice: number
  ) => Promise<void>;
}> = ({ currentUser, regions, products, onCreateRegion, onUpdateProductGeoOverride }) => {
  const canManagePricing = currentUser.role === 'Admin' || currentUser.role === 'Sales Manager';
  const isBranchManager = currentUser.role === 'Branch Manager';
  const isInventory = currentUser.role === 'Inventory Controller';
  const isAffiliate = currentUser.role === 'Affiliate Sales Representative';

  const [regionName, setRegionName] = useState('');
  const [tierType, setTierType] = useState<GeoRegion['tierType']>('Suburban Ring');
  const [wholesaleMult, setWholesaleMult] = useState<number>(1.08);
  const [retailMult, setRetailMult] = useState<number>(1.15);
  const [freightLevy, setFreightLevy] = useState<number>(450);
  const [taxRate, setTaxRate] = useState<number>(0.16);

  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [selectedRegId, setSelectedRegId] = useState(regions[1]?.id || regions[0]?.id || '');
  const [customWholesale, setCustomWholesale] = useState<number>(3900);
  const [customRetail, setCustomRetail] = useState<number>(4800);

  const handleCreateRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regionName.trim() || !canManagePricing) return;
    await onCreateRegion({
      code: `GEO-${regionName.slice(0, 4).toUpperCase()}-0${regions.length + 1}`,
      name: regionName.trim(),
      tierType,
      wholesaleMultiplier: Number(wholesaleMult),
      retailMultiplier: Number(retailMult),
      freightLevyPerCase: Number(freightLevy),
      regionalTaxRate: Number(taxRate),
      notes: 'Custom regional alcohol pricing & freight tariff rule.',
    });
    setRegionName('');
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProdId || !selectedRegId || !canManagePricing) return;
    await onUpdateProductGeoOverride(
      selectedProdId,
      selectedRegId,
      Number(customWholesale),
      Number(customRetail)
    );
  };

  return (
    <div className="space-y-6">
      {/* Role Boundary Callout Banner */}
      {isBranchManager && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-amber-900">
                Branch Manager Scope · {currentUser.branchName}
              </div>
              <p className="text-xs text-amber-800">
                Viewing regional multipliers and approved retail price tables for your branch territory. Master pricing schedules administered by Sales Management and Administration.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-200/80 text-amber-900 text-[11px] font-bold shrink-0">
            View / Approved Edits
          </span>
        </div>
      )}

      {isInventory && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-emerald-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-emerald-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-emerald-900">
                Inventory Controller Scope · Cost &amp; Stock Valuation Mode
              </div>
              <p className="text-xs text-emerald-800">
                Landed costs, warehouse valuation, and case pack sizes are monitored here. Commercial selling margins and retail multipliers are governed by Sales Management.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-200/80 text-emerald-900 text-[11px] font-bold shrink-0">
            Cost / Stock Scope
          </span>
        </div>
      )}

      {isAffiliate && (
        <div className="bg-purple-50 border-2 border-purple-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-purple-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Tag className="w-5 h-5 text-purple-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-purple-900">
                Affiliate Sales Representative Scope · Approved Price Catalogue
              </div>
              <p className="text-xs text-purple-800">
                Standard approved prices for client distribution with your {currentUser.agreedCommissionPct || 8}% commission tier. Cannot alter price schedules.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-purple-200/80 text-purple-900 text-[11px] font-bold shrink-0">
            Approved Prices Only
          </span>
        </div>
      )}

      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            Regional Tariff &amp; Purchasing Parity Engine
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            Geo-Location Alcohol Pricing Matrix (Affluent Suburb vs. Lower Region vs. Metro)
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Because alcohol cannot be sold in affluent suburbs (e.g. Kilimani/Westlands) at the same price as lower regions (e.g. Donholm/Eastlands), configure regional multipliers, freight levies per case, or explicit SKU price overrides.
          </p>
        </div>
      </div>

      {canManagePricing && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Geo Zone */}
        <form
          onSubmit={handleCreateRegion}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-2 border-b border-slate-200 pb-3">
            <MapPin className="w-4 h-4 text-[#0A006E]" />
            Add New Geo-Location Pricing Zone
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Geo-Zone Name *</label>
              <input
                required
                type="text"
                value={regionName}
                onChange={(e) => setRegionName(e.target.value)}
                placeholder="e.g. Nyali & Coastal Resort Suburb Belt"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Regional Classification</label>
              <select
                value={tierType}
                onChange={(e) => setTierType(e.target.value as GeoRegion['tierType'])}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
              >
                <option value="Metro Core">Metro Core</option>
                <option value="Suburban Ring">Suburban Ring</option>
                <option value="Upcountry / Lower Region">Upcountry / Lower Region</option>
                <option value="Duty-Free / Export">Duty-Free / Export</option>
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Wholesale & Retail Multiplier</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="number"
                  step="0.01"
                  value={wholesaleMult}
                  onChange={(e) => setWholesaleMult(Number(e.target.value))}
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
                <input
                  type="number"
                  step="0.01"
                  value={retailMult}
                  onChange={(e) => setRetailMult(Number(e.target.value))}
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
              </div>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Freight/Case (KES) & Tax Rate</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="number"
                  value={freightLevy}
                  onChange={(e) => setFreightLevy(Number(e.target.value))}
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
                <input
                  type="number"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
              </div>
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs rounded-xl cursor-pointer"
          >
            Save Geo-Pricing Zone
          </button>
        </form>

        {/* Set Explicit SKU Regional Price Override */}
        <form
          onSubmit={handleApplyOverride}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-2 border-b border-slate-200 pb-3">
            <RefreshCw className="w-4 h-4 text-[#0A006E]" />
            Set Exact SKU Price Override for Suburb / Lower Region
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Select Liquor SKU</label>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
              >
                {products.slice(0, 120).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Target Geo-Location Zone</label>
              <select
                value={selectedRegId}
                onChange={(e) => setSelectedRegId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
              >
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.tierType})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Regional Wholesale (KES / Btl)</label>
              <input
                type="number"
                value={customWholesale}
                onChange={(e) => setCustomWholesale(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Regional Retail (KES / Btl)</label>
              <input
                type="number"
                value={customRetail}
                onChange={(e) => setCustomRetail(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#FFDE00] border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl cursor-pointer"
          >
            Apply Regional SKU Tariff Override
          </button>
        </form>
      </div>
      )}

      {/* Live Comparison Table across Regions */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
          Live Geo-Location Price Comparison Across Suburbs, Metro & Lower Regions (Top 30 SKUs)
        </h3>
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Auto SKU & Brand</th>
                <th className="py-2.5 px-3 font-black text-right">Base Retail</th>
                {regions.map((r) => (
                  <th key={r.id} className="py-2.5 px-3 font-black text-right">
                    {r.name.split(' ')[0]} ({r.tierType.split(' ')[0]}) Btl / Case
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {products.slice(0, 30).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3">
                    <span className="font-mono-tabular font-bold text-[#0A006E]">{p.sku}</span> ·{' '}
                    <span className="font-montserrat font-bold text-slate-900">{p.name}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular">
                    {formatKes(p.retailPriceKes ?? p.baseRetailPrice ?? 0)}
                  </td>
                  {regions.map((r) => {
                    const calc = calculateGeoPrice(p, r, 'retail');
                    return (
                      <td key={r.id} className="py-2.5 px-3 text-right font-mono-tabular">
                        <strong className="text-[#0A006E]">{formatKes(calc.unitBottlePrice)}</strong>{' '}
                        <span className="text-slate-500">({formatKes(calc.casePrice)}/cs)</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
