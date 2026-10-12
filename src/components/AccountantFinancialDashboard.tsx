import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Package,
  PackageX,
  AlertTriangle,
  FileText,
  Download,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Building,
  CreditCard,
  Percent,
  Receipt,
  Sparkles,
  HelpCircle,
} from 'lucide-react';
import {
  Product,
  TransactionDoc,
  Branch,
  GeoRegion,
  StaffMember,
  PayrollRun,
  LineItem,
} from '../types';
import { formatKes, exportReportToPDF, exportToCSV } from '../erpUtils';

interface AccountantFinancialDashboardProps {
  currentUser: StaffMember;
  products: Product[];
  transactions: TransactionDoc[];
  branches: Branch[];
  regions: GeoRegion[];
  payrollRuns?: PayrollRun[];
  onPreviewDoc?: (doc: TransactionDoc) => void;
}

type DateFilter = 'ALL' | '30D' | '7D' | 'TODAY';
type ActiveFinanceTab = 'summary' | 'sales' | 'stock' | 'deadstock_damages' | 'tax_credit';

export const AccountantFinancialDashboard: React.FC<AccountantFinancialDashboardProps> = ({
  currentUser,
  products,
  transactions,
  branches,
  regions,
  payrollRuns = [],
  onPreviewDoc,
}) => {
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [activeTab, setActiveTab] = useState<ActiveFinanceTab>('summary');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  // Filter transactions based on date filter
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return transactions.filter((tx) => {
      if (selectedBranchFilter !== 'ALL' && tx.branchId !== selectedBranchFilter) {
        return false;
      }
      if (dateFilter === 'ALL') return true;
      const txDate = new Date(tx.createdAt);
      const diffMs = now.getTime() - txDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (dateFilter === 'TODAY') return diffDays <= 1;
      if (dateFilter === '7D') return diffDays <= 7;
      if (dateFilter === '30D') return diffDays <= 30;
      return true;
    });
  }, [transactions, dateFilter, selectedBranchFilter]);

  // LIVE DATA FROM SALES CALCULATIONS
  const salesMetrics = useMemo(() => {
    let grossSales = 0;
    let creditNotesTotal = 0;
    let completedOrdersCount = 0;
    let estimatedCogs = 0;

    // Channel totals
    const channelTotals: Record<string, { count: number; total: number }> = {
      'Retail Counter POS': { count: 0, total: 0 },
      'B2B Wholesale POS': { count: 0, total: 0 },
      'Customer Online Portal': { count: 0, total: 0 },
      'Affiliate Rep': { count: 0, total: 0 },
    };

    // Payment method totals
    const paymentTotals: Record<string, { count: number; total: number }> = {};

    // SKU sales velocity & performance
    const skuPerformance: Record<
      string,
      { sku: string; name: string; volumeMl: number; category: string; unitsSold: number; totalRevenue: number; cogs: number }
    > = {};

    // Accounts receivable
    let accountsReceivable = 0;
    let overdueReceivable = 0;

    const now = new Date();

    filteredTransactions.forEach((tx) => {
      if (tx.docType === 'Receipt' || tx.docType === 'Invoice' || tx.docType === 'Online Order') {
        grossSales += tx.totalAmount;
        completedOrdersCount++;

        // Track channel
        if (channelTotals[tx.channel]) {
          channelTotals[tx.channel].count++;
          channelTotals[tx.channel].total += tx.totalAmount;
        }

        // Track payment method
        const method = tx.paymentMethod || 'Other';
        if (!paymentTotals[method]) {
          paymentTotals[method] = { count: 0, total: 0 };
        }
        paymentTotals[method].count++;
        paymentTotals[method].total += tx.totalAmount;

        // Accounts receivable for unpaid invoices
        if (tx.docType === 'Invoice' && tx.status !== 'Paid') {
          accountsReceivable += tx.totalAmount;
          const txAgeDays = (now.getTime() - new Date(tx.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          if (txAgeDays > 30) {
            overdueReceivable += tx.totalAmount;
          }
        }

        // Parse line items for COGS and SKU velocity
        try {
          const items: LineItem[] = JSON.parse(tx.itemsSummary);
          items.forEach((item) => {
            const matchedProduct = products.find((p) => p.id === item.productId || p.sku === item.sku);
            const unitCost = matchedProduct?.warehouseCostKes || matchedProduct?.baseLandedCost || Math.round(item.unitPrice * 0.72);
            const lineCogs = (item.totalBottles || item.quantityUnits) * unitCost;
            estimatedCogs += lineCogs;

            if (!skuPerformance[item.sku]) {
              skuPerformance[item.sku] = {
                sku: item.sku,
                name: item.name,
                volumeMl: matchedProduct?.volumeMl || 750,
                category: matchedProduct?.category || 'IPS',
                unitsSold: 0,
                totalRevenue: 0,
                cogs: 0,
              };
            }
            skuPerformance[item.sku].unitsSold += item.totalBottles || item.quantityUnits;
            skuPerformance[item.sku].totalRevenue += item.lineTotal;
            skuPerformance[item.sku].cogs += lineCogs;
          });
        } catch {
          // Fallback if parsing fails
          estimatedCogs += tx.totalAmount * 0.72;
        }
      } else if (tx.docType === 'Credit Note') {
        creditNotesTotal += tx.totalAmount;
      }
    });

    const netCommercialSales = Math.max(0, grossSales - creditNotesTotal);
    const grossProfit = Math.max(0, netCommercialSales - estimatedCogs);
    const grossMarginPct = netCommercialSales > 0 ? (grossProfit / netCommercialSales) * 100 : 0;
    const aov = completedOrdersCount > 0 ? grossSales / completedOrdersCount : 0;

    const topSkus = Object.values(skuPerformance)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 8);

    return {
      grossSales,
      creditNotesTotal,
      netCommercialSales,
      completedOrdersCount,
      estimatedCogs,
      grossProfit,
      grossMarginPct,
      aov,
      channelTotals,
      paymentTotals,
      topSkus,
      accountsReceivable,
      overdueReceivable,
    };
  }, [filteredTransactions, products]);

  // LIVE DATA FROM STOCK CALCULATIONS
  const stockMetrics = useMemo(() => {
    let totalStockCost = 0;
    let totalStockRetailValue = 0;
    let totalStockWholesaleValue = 0;
    let totalBottlesInBond = 0;

    let ipsCost = 0;
    let ipsBottles = 0;
    let lpsCost = 0;
    let lpsBottles = 0;

    let totalDamagedBottles = 0;
    let totalDamagedLossKes = 0;
    let totalSpoiledBottles = 0;
    let totalSpoiledLossKes = 0;

    let totalDeadStockBottles = 0;
    let totalDeadStockCapitalKes = 0;
    const deadStockItems: Array<{ product: Product; daysInactive: number; tiedUpCapital: number }> = [];

    const now = new Date();

    // Branch stock distribution
    const branchStockMap: Record<string, { branchName: string; bottles: number; costValuation: number; retailValuation: number }> = {};
    branches.forEach((b) => {
      branchStockMap[b.id] = {
        branchName: b.name,
        bottles: 0,
        costValuation: 0,
        retailValuation: 0,
      };
    });

    products.forEach((p) => {
      const bottles = p.totalBottles ?? (p.packSize || 12) * 30;
      const unitCost = p.warehouseCostKes ?? p.baseLandedCost ?? Math.round((p.retailPriceKes || 3000) * 0.72);
      const retailPrice = p.retailPriceKes ?? p.baseRetailPrice ?? Math.round(unitCost * 1.35);
      const wholesalePrice = p.wholesalePriceKes ?? p.baseWholesalePrice ?? Math.round(unitCost * 1.18);

      const itemCostVal = bottles * unitCost;
      const itemRetailVal = bottles * retailPrice;
      const itemWholesaleVal = bottles * wholesalePrice;

      totalStockCost += itemCostVal;
      totalStockRetailValue += itemRetailVal;
      totalStockWholesaleValue += itemWholesaleVal;
      totalBottlesInBond += bottles;

      if (p.category === 'LPS') {
        lpsCost += itemCostVal;
        lpsBottles += bottles;
      } else {
        ipsCost += itemCostVal;
        ipsBottles += bottles;
      }

      // Damages & Spoiled items
      const dmgCount = p.damagedBottlesCount || 0;
      const spoilCount = p.spoiledBottlesCount || 0;
      if (dmgCount > 0) {
        totalDamagedBottles += dmgCount;
        totalDamagedLossKes += dmgCount * unitCost;
      }
      if (spoilCount > 0) {
        totalSpoiledBottles += spoilCount;
        totalSpoiledLossKes += spoilCount * unitCost;
      }

      // Dead stock threshold checking
      const thresholdDays = p.deadStockThresholdDays || 90;
      const lastMoveDate = p.lastStockMovementDate ? new Date(p.lastStockMovementDate) : new Date(p.createdAt || '2026-08-01');
      const daysInactive = Math.max(0, Math.floor((now.getTime() - lastMoveDate.getTime()) / (1000 * 60 * 60 * 24)));

      if (daysInactive >= thresholdDays && bottles > 0) {
        totalDeadStockBottles += bottles;
        totalDeadStockCapitalKes += itemCostVal;
        deadStockItems.push({
          product: p,
          daysInactive,
          tiedUpCapital: itemCostVal,
        });
      }

      // Branch breakdown
      try {
        if (p.branchStockSummary) {
          const bMap: Record<string, number> = JSON.parse(p.branchStockSummary);
          Object.entries(bMap).forEach(([bId, bQty]) => {
            if (branchStockMap[bId]) {
              branchStockMap[bId].bottles += bQty;
              branchStockMap[bId].costValuation += bQty * unitCost;
              branchStockMap[bId].retailValuation += bQty * retailPrice;
            }
          });
        }
      } catch {
        // Fallback: assign to first branch
        const firstBranch = branches[0];
        if (firstBranch && branchStockMap[firstBranch.id]) {
          branchStockMap[firstBranch.id].bottles += bottles;
          branchStockMap[firstBranch.id].costValuation += itemCostVal;
          branchStockMap[firstBranch.id].retailValuation += itemRetailVal;
        }
      }
    });

    const potentialGrossMargin = totalStockRetailValue - totalStockCost;
    const potentialMarginPct = totalStockRetailValue > 0 ? (potentialGrossMargin / totalStockRetailValue) * 100 : 0;
    const totalWriteOffs = totalDamagedLossKes + totalSpoiledLossKes;
    const shrinkagePct = totalStockCost > 0 ? (totalWriteOffs / totalStockCost) * 100 : 0;

    // Sort dead stock by highest capital tied up
    deadStockItems.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);

    return {
      totalStockCost,
      totalStockRetailValue,
      totalStockWholesaleValue,
      totalBottlesInBond,
      ipsCost,
      ipsBottles,
      lpsCost,
      lpsBottles,
      potentialGrossMargin,
      potentialMarginPct,
      totalDamagedBottles,
      totalDamagedLossKes,
      totalSpoiledBottles,
      totalSpoiledLossKes,
      totalWriteOffs,
      shrinkagePct,
      totalDeadStockBottles,
      totalDeadStockCapitalKes,
      deadStockItems,
      branchStockMap,
    };
  }, [products, branches]);

  // TAX & STATUTORY LIABILITIES
  const taxMetrics = useMemo(() => {
    // Standard VAT in Kenya is 16% (VAT = gross / 1.16 * 0.16)
    const estimatedVatPayable = (salesMetrics.grossSales / 1.16) * 0.16;

    // Approximate KRA Digital Excise stamps liability (253 KES per litre of spirit)
    const estimatedExciseLiability = (stockMetrics.ipsBottles * 0.75) * 253;

    // Payroll disbursements and PAYE/NSSF
    let totalPayrollDisbursed = 0;
    payrollRuns.forEach((pr) => {
      totalPayrollDisbursed += pr.totalDisbursed;
    });

    return {
      estimatedVatPayable,
      estimatedExciseLiability,
      totalPayrollDisbursed,
    };
  }, [salesMetrics.grossSales, stockMetrics.ipsBottles, payrollRuns]);

  // EXPORT HANDLERS
  const handleExportComprehensiveFinancialPDF = () => {
    exportReportToPDF(
      'Official Chief Financial Accountant Statement & Live Balance Sheet',
      `Accounting Period: ${dateFilter} · Prepared for ${currentUser.name}`,
      ['Financial Ledger Item', 'Valuation Basis', 'Volume / Count', 'Amount (KES)', 'Classification'],
      [
        ['Gross Commercial Turnover', 'Sales Ledger', `${salesMetrics.completedOrdersCount} Orders`, Math.round(salesMetrics.grossSales).toLocaleString(), 'Revenue'],
        ['Commercial Credit Notes Issued', 'Adjustments & Returns', `${filteredTransactions.filter((t) => t.docType === 'Credit Note').length} Notes`, Math.round(salesMetrics.creditNotesTotal).toLocaleString(), 'Deduction'],
        ['Net Commercial Revenue', 'Gross - Credits', '-', Math.round(salesMetrics.netCommercialSales).toLocaleString(), 'Net Sales'],
        ['Estimated Cost of Goods Sold (COGS)', 'Unit Landed Cost', '-', Math.round(salesMetrics.estimatedCogs).toLocaleString(), 'Expense'],
        ['Gross Commercial Profit', 'Net Revenue - COGS', `${salesMetrics.grossMarginPct.toFixed(1)}% Margin`, Math.round(salesMetrics.grossProfit).toLocaleString(), 'Operating Surplus'],
        ['Live Stock Valuation (Landed Cost)', 'Asset on Hand', `${stockMetrics.totalBottlesInBond.toLocaleString()} Btls`, Math.round(stockMetrics.totalStockCost).toLocaleString(), 'Current Asset'],
        ['Live Stock Valuation (Retail)', 'Market Value', `${stockMetrics.totalBottlesInBond.toLocaleString()} Btls`, Math.round(stockMetrics.totalStockRetailValue).toLocaleString(), 'Potential Asset'],
        ['Stagnant / Dead Stock Capital', 'Idle Past Threshold', `${stockMetrics.totalDeadStockBottles.toLocaleString()} Btls`, Math.round(stockMetrics.totalDeadStockCapitalKes).toLocaleString(), 'Risk Asset'],
        ['Damaged Stock Write-Off Loss', 'Written Off', `${stockMetrics.totalDamagedBottles} Btls`, Math.round(stockMetrics.totalDamagedLossKes).toLocaleString(), 'Loss Write-Off'],
        ['Spoiled Stock Write-Off Loss', 'Written Off', `${stockMetrics.totalSpoiledBottles} Btls`, Math.round(stockMetrics.totalSpoiledLossKes).toLocaleString(), 'Loss Write-Off'],
        ['Outstanding Accounts Receivable', 'Unsettled B2B Invoices', '-', Math.round(salesMetrics.accountsReceivable).toLocaleString(), 'Current Asset'],
        ['Output VAT (16%) Obligation', 'KRA Statutory Remittance', '-', Math.round(taxMetrics.estimatedVatPayable).toLocaleString(), 'Liability'],
      ],
      'Vaairo_Accountant_Financial_Analysis_Statement'
    );
  };

  const handleExportFinancialLedgerCSV = () => {
    exportToCSV(
      'Vaairo_Live_Accounting_Ledger',
      ['Transaction Date', 'Doc Number', 'Doc Type', 'Branch', 'Channel', 'Payment Tender', 'Customer', 'Amount (KES)', 'Status'],
      filteredTransactions.map((tx) => [
        new Date(tx.createdAt).toLocaleDateString(),
        tx.docNumber,
        tx.docType,
        tx.branchName,
        tx.channel,
        tx.paymentMethod,
        tx.customerName,
        Math.round(tx.totalAmount),
        tx.status,
      ])
    );
  };

  return (
    <div className="space-y-6">
      {/* ACCOUNTANT COMMAND HEADER */}
      <div className="bg-[#0A006E] text-white border-2 border-[#FFDE00] rounded-2xl p-5 relative overflow-hidden shadow-xl">
        <div className="silent-scanner-beam" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-montserrat uppercase tracking-wider bg-[#FFDE00] text-[#0A006E]">
                Chief Financial Accountant Portal
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-[#FFDE00] border border-white/20">
                Live Sales & Stock Synchronization Active
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-montserrat font-black italic text-white mt-1.5">
              Financial Analysis & Commercial Accounting Center
            </h2>
            <p className="text-xs text-white/80 max-w-2xl mt-0.5">
              Strict accounting governance: Live sales ledger, real-time stock valuation, Cost of Goods Sold (COGS), gross margins, stock write-offs (damages/spoiled), and KRA tax schedules.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Date filter pills */}
            <div className="bg-white/10 p-1 rounded-xl border border-white/20 flex items-center text-xs">
              {(['ALL', '30D', '7D', 'TODAY'] as DateFilter[]).map((period) => (
                <button
                  key={period}
                  onClick={() => setDateFilter(period)}
                  className={`px-2.5 py-1 rounded-lg font-montserrat font-bold text-xs transition cursor-pointer ${
                    dateFilter === period
                      ? 'bg-[#FFDE00] text-[#0A006E] shadow-sm'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {period === 'ALL' ? 'All Time' : period === '30D' ? '30 Days' : period === '7D' ? '7 Days' : 'Today'}
                </button>
              ))}
            </div>

            <button
              onClick={handleExportComprehensiveFinancialPDF}
              className="px-3.5 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export Financial PDF
            </button>
            <button
              onClick={handleExportFinancialLedgerCSV}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* TOP 5 LIVE FINANCIAL KPI METERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Live Gross Sales */}
        <div className="bg-[#F0F2F0] border-2 border-slate-200 hover:border-[#0A006E] rounded-2xl p-4 transition shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-montserrat font-black text-slate-500 uppercase tracking-wider">
              Live Gross Sales
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#0A006E] text-[#FFDE00] flex items-center justify-center">
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1.5">
            {formatKes(salesMetrics.grossSales)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>Orders: <strong className="text-slate-800">{salesMetrics.completedOrdersCount}</strong></span>
            <span>AOV: <strong className="text-slate-800">{formatKes(salesMetrics.aov)}</strong></span>
          </div>
        </div>

        {/* KPI 2: Live Stock Asset Valuation */}
        <div className="bg-[#F0F2F0] border-2 border-slate-200 hover:border-[#0A006E] rounded-2xl p-4 transition shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-montserrat font-black text-slate-500 uppercase tracking-wider">
              Stock Asset (Landed Cost)
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#34D186] text-white flex items-center justify-center">
              <Package className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-montserrat font-black text-[#1E9E60] font-mono-tabular mt-1.5">
            {formatKes(stockMetrics.totalStockCost)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>Bottles in Bond:</span>
            <strong className="text-slate-800">{stockMetrics.totalBottlesInBond.toLocaleString()} Btls</strong>
          </div>
        </div>

        {/* KPI 3: Gross Commercial Profit */}
        <div className="bg-[#F0F2F0] border-2 border-slate-200 hover:border-[#0A006E] rounded-2xl p-4 transition shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-montserrat font-black text-slate-500 uppercase tracking-wider">
              Gross Profit & Margin
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#0A006E] text-white flex items-center justify-center">
              <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1.5">
            {formatKes(salesMetrics.grossProfit)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>Operating Margin:</span>
            <span className="font-bold text-[#1E9E60]">{salesMetrics.grossMarginPct.toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 4: Stock Write-Offs (Damaged + Spoiled) */}
        <div className="bg-[#F0F2F0] border-2 border-slate-200 hover:border-rose-400 rounded-2xl p-4 transition shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-montserrat font-black text-rose-700 uppercase tracking-wider">
              Damaged & Spoiled Loss
            </span>
            <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center">
              <PackageX className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-montserrat font-black text-rose-700 font-mono-tabular mt-1.5">
            {formatKes(stockMetrics.totalWriteOffs)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>Dmg: <strong>{stockMetrics.totalDamagedBottles}</strong> · Spoil: <strong>{stockMetrics.totalSpoiledBottles}</strong></span>
            <span className="text-rose-600 font-semibold">{stockMetrics.shrinkagePct.toFixed(2)}% of stock</span>
          </div>
        </div>

        {/* KPI 5: Dead Stock Capital at Risk */}
        <div className="bg-[#F0F2F0] border-2 border-slate-200 hover:border-amber-400 rounded-2xl p-4 transition shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-montserrat font-black text-amber-800 uppercase tracking-wider">
              Stagnant / Dead Stock
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-montserrat font-black text-amber-900 font-mono-tabular mt-1.5">
            {formatKes(stockMetrics.totalDeadStockCapitalKes)}
          </div>
          <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
            <span>Stagnant SKUs:</span>
            <strong className="text-amber-900">{stockMetrics.deadStockItems.length} SKUs ({stockMetrics.totalDeadStockBottles.toLocaleString()} btls)</strong>
          </div>
        </div>
      </div>

      {/* ACCOUNTANT NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b-2 border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'summary'
              ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Executive P&L & Balance Sheet
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`px-4 py-2.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'sales'
              ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Live Sales Analysis & Tender Breakdown
        </button>

        <button
          onClick={() => setActiveTab('stock')}
          className={`px-4 py-2.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'stock'
              ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Live Stock Valuation & Depots (IPS vs LPS)
        </button>

        <button
          onClick={() => setActiveTab('deadstock_damages')}
          className={`px-4 py-2.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'deadstock_damages'
              ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <PackageX className="w-4 h-4" />
          Dead Stock, Damages & Spoilage Write-Offs
          {(stockMetrics.totalDamagedBottles > 0 || stockMetrics.totalSpoiledBottles > 0) && (
            <span className="w-2 h-2 rounded-full bg-rose-500 ml-1" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('tax_credit')}
          className={`px-4 py-2.5 rounded-xl font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'tax_credit'
              ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          KRA Tax, VAT & Accounts Receivable
        </button>
      </div>

      {/* TAB 1: EXECUTIVE P&L & BALANCE SHEET */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Live Profit & Loss Breakdown Card */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                <div>
                  <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                    Comprehensive Commercial Income Statement (P&L)
                  </h3>
                  <p className="text-xs text-slate-600">
                    Calculated in real-time from active receipts, invoices, and product landed costs.
                  </p>
                </div>
                <span className="text-xs font-mono-tabular font-bold text-[#0A006E] bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  {dateFilter}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="font-semibold text-slate-700">Gross Commercial Sales Turnover:</span>
                  <span className="font-mono-tabular font-bold text-slate-900">{formatKes(salesMetrics.grossSales)}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200 text-rose-700">
                  <span className="font-semibold">Less: Credit Notes Issued & Commercial Returns:</span>
                  <span className="font-mono-tabular font-bold">- {formatKes(salesMetrics.creditNotesTotal)}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-300 font-bold text-slate-900 bg-white/70 px-2 rounded-lg">
                  <span>Net Commercial Revenue:</span>
                  <span className="font-mono-tabular text-sm text-[#0A006E]">{formatKes(salesMetrics.netCommercialSales)}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200 text-amber-800">
                  <span className="font-semibold">Less: Cost of Goods Sold (COGS on Units Dispatched):</span>
                  <span className="font-mono-tabular font-bold">- {formatKes(salesMetrics.estimatedCogs)}</span>
                </div>

                <div className="flex items-center justify-between py-1.5 border-b border-slate-300 font-bold text-[#1E9E60] bg-white px-2 rounded-lg">
                  <span>Gross Operating Margin:</span>
                  <span className="font-mono-tabular text-sm">{formatKes(salesMetrics.grossProfit)} ({salesMetrics.grossMarginPct.toFixed(1)}%)</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200 text-rose-600">
                  <span className="font-semibold">Less: Stock Write-Offs (Damaged Bottles Written Off):</span>
                  <span className="font-mono-tabular font-bold">- {formatKes(stockMetrics.totalDamagedLossKes)}</span>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-slate-200 text-rose-600">
                  <span className="font-semibold">Less: Stock Write-Offs (Spoiled Bottles Written Off):</span>
                  <span className="font-mono-tabular font-bold">- {formatKes(stockMetrics.totalSpoiledLossKes)}</span>
                </div>

                {taxMetrics.totalPayrollDisbursed > 0 && (
                  <div className="flex items-center justify-between py-1 border-b border-slate-200 text-slate-700">
                    <span className="font-semibold">Less: Operational Payroll Disbursed:</span>
                    <span className="font-mono-tabular font-bold">- {formatKes(taxMetrics.totalPayrollDisbursed)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between py-2 border-t-2 border-[#0A006E] font-black text-sm text-[#0A006E] bg-[#FFDE00]/30 px-3 rounded-xl mt-2">
                  <span>Net Commercial Contribution / Operating Surplus:</span>
                  <span className="font-mono-tabular">
                    {formatKes(
                      Math.max(
                        0,
                        salesMetrics.grossProfit -
                          stockMetrics.totalWriteOffs -
                          taxMetrics.totalPayrollDisbursed
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Inventory Asset & Working Capital Balance */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                <div>
                  <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                    Current Inventory Asset Valuation & Tied-Up Working Capital
                  </h3>
                  <p className="text-xs text-slate-600">
                    Audit of balance sheet assets currently sitting in bonded depots and regional warehouses.
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700">Total Landed Inventory Asset (At Cost):</span>
                    <span className="font-mono-tabular font-black text-[#0A006E] text-base">
                      {formatKes(stockMetrics.totalStockCost)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Represents actual cash capital disbursed for customs duties, shipping, and supplier purchases.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[11px] font-bold">Wholesale Realization Value:</div>
                    <div className="text-base font-montserrat font-black text-slate-900 font-mono-tabular mt-1">
                      {formatKes(stockMetrics.totalStockWholesaleValue)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">B2B Distributor bulk pricing</div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-slate-500 text-[11px] font-bold">Retail Realization Value:</div>
                    <div className="text-base font-montserrat font-black text-[#1E9E60] font-mono-tabular mt-1">
                      {formatKes(stockMetrics.totalStockRetailValue)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Counter POS potential turnover</div>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-800">
                    <span className="font-semibold">Unrealized Gross Inventory Margin:</span>
                    <span className="font-mono-tabular font-bold text-[#1E9E60]">
                      {formatKes(stockMetrics.potentialGrossMargin)} ({stockMetrics.potentialMarginPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-800">
                    <span className="font-semibold">Total Stock Units in Bond:</span>
                    <span className="font-mono-tabular font-bold">
                      {stockMetrics.totalBottlesInBond.toLocaleString()} Bottles ({Math.round(stockMetrics.totalBottlesInBond / 12).toLocaleString()} Cases)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-amber-800">
                    <span className="font-semibold">Capital Locked in Dead Stock:</span>
                    <span className="font-mono-tabular font-bold">
                      {formatKes(stockMetrics.totalDeadStockCapitalKes)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Recent Transactions Ledger */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Recent Live Commercial & Financial Ledger
                </h3>
                <p className="text-xs text-slate-600">
                  Latest validated accounting events recorded from POS terminals and bank settlements.
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-[#0A006E]">
                Showing {Math.min(10, filteredTransactions.length)} of {filteredTransactions.length}
              </span>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">Doc Number</th>
                    <th className="py-2.5 px-3 font-black">Type</th>
                    <th className="py-2.5 px-3 font-black">Channel</th>
                    <th className="py-2.5 px-3 font-black">Branch</th>
                    <th className="py-2.5 px-3 font-black">Customer / Client</th>
                    <th className="py-2.5 px-3 font-black">Payment Tender</th>
                    <th className="py-2.5 px-3 font-black text-right">Amount (KES)</th>
                    <th className="py-2.5 px-3 font-black text-center">Status</th>
                    <th className="py-2.5 px-3 font-black text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredTransactions.slice(0, 10).map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">{t.docNumber}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.docType === 'Credit Note'
                            ? 'bg-rose-100 text-rose-700'
                            : t.docType === 'Invoice'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {t.docType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{t.channel}</td>
                      <td className="py-2.5 px-3 text-slate-700">{t.branchName}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{t.customerName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{t.paymentMethod || 'Settled'}</td>
                      <td className={`py-2.5 px-3 text-right font-mono-tabular font-bold ${
                        t.docType === 'Credit Note' ? 'text-rose-600' : 'text-slate-900'
                      }`}>
                        {t.docType === 'Credit Note' ? `- ${formatKes(t.totalAmount)}` : formatKes(t.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#34D186]/20 text-[#1E9E60]">
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => onPreviewDoc?.(t)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-[#FFDE00] text-[#0A006E] rounded-lg text-[11px] font-bold transition cursor-pointer"
                        >
                          View Doc
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE SALES ANALYSIS & TENDER BREAKDOWN */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales by Channel */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Gross Turnover by Sales Distribution Channel
                </h3>
                <span className="text-xs font-mono-tabular font-bold text-slate-600">
                  Total: {formatKes(salesMetrics.grossSales)}
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(salesMetrics.channelTotals).map(([channel, data]) => {
                  const sharePct = salesMetrics.grossSales > 0 ? (data.total / salesMetrics.grossSales) * 100 : 0;
                  return (
                    <div key={channel} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>{channel}</span>
                        <span className="font-mono-tabular text-[#0A006E]">
                          {formatKes(data.total)} ({sharePct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#0A006E] h-full rounded-full transition-all duration-500"
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>Transactions Issued: {data.count}</span>
                        <span>Avg Order: {data.count > 0 ? formatKes(data.total / data.count) : 'KES 0'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sales by Payment Method / Tender Liquidity */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-300 pb-3">
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Commercial Cashflow & Payment Tender Liquidity
                </h3>
                <span className="text-xs font-mono-tabular font-bold text-slate-600">
                  {Object.keys(salesMetrics.paymentTotals).length} Tenders
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(salesMetrics.paymentTotals).map(([method, data]) => {
                  const sharePct = salesMetrics.grossSales > 0 ? (data.total / salesMetrics.grossSales) * 100 : 0;
                  const isLiquid = method.toLowerCase().includes('pesa') || method.toLowerCase().includes('cash');
                  return (
                    <div key={method} className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                          {method}
                          {isLiquid && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Instant Liquidity
                            </span>
                          )}
                        </span>
                        <span className="font-mono-tabular text-slate-900">
                          {formatKes(data.total)} ({sharePct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-[#34D186] h-full rounded-full transition-all duration-500"
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Captured across {data.count} payment transactions.
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Top Selling Liquor SKUs by Gross Turnover */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
              Top Revenue & Profit Generating Liquor SKUs (Live Velocity)
            </h3>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">SKU Code</th>
                    <th className="py-2.5 px-3 font-black">Liquor Description</th>
                    <th className="py-2.5 px-3 font-black">Category</th>
                    <th className="py-2.5 px-3 font-black text-right">Units Sold</th>
                    <th className="py-2.5 px-3 font-black text-right">Total Revenue (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">COGS (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Gross Margin (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {salesMetrics.topSkus.map((sku) => {
                    const margin = sku.totalRevenue - sku.cogs;
                    const marginPct = sku.totalRevenue > 0 ? (margin / sku.totalRevenue) * 100 : 0;
                    return (
                      <tr key={sku.sku} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">{sku.sku}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{sku.name} ({sku.volumeMl}ml)</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            sku.category === 'LPS' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {sku.category === 'LPS' ? 'LPS Local' : 'IPS Import'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">{sku.unitsSold} btls</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900">
                          {formatKes(sku.totalRevenue)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-600">
                          {formatKes(sku.cogs)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">
                          {formatKes(margin)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">
                          {marginPct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE STOCK VALUATION & DEPOTS (IPS vs LPS) */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* IPS vs LPS Asset Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#F0F2F0] border-2 border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#0A006E] text-[#FFDE00] uppercase">
                    IPS Bonded Import Stock
                  </span>
                  <h4 className="text-base font-montserrat font-black text-[#0A006E] mt-1">
                    Imported Products Stock (IPS)
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-bold">Total IPS Bottles:</div>
                  <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                    {stockMetrics.ipsBottles.toLocaleString()} Btls
                  </div>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs text-slate-500">Landed Asset Capital (Customs & Shipping Paid):</div>
                <div className="text-xl font-montserrat font-black text-[#0A006E] font-mono-tabular">
                  {formatKes(stockMetrics.ipsCost)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Share of Total Inventory: {stockMetrics.totalStockCost > 0 ? ((stockMetrics.ipsCost / stockMetrics.totalStockCost) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="bg-[#F0F2F0] border-2 border-slate-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500 text-white uppercase">
                    LPS Local Kenyan Stock
                  </span>
                  <h4 className="text-base font-montserrat font-black text-amber-900 mt-1">
                    Local Products Stock (LPS)
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 font-bold">Total LPS Bottles:</div>
                  <div className="text-sm font-bold text-slate-900 font-mono-tabular">
                    {stockMetrics.lpsBottles.toLocaleString()} Btls
                  </div>
                </div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-1">
                <div className="text-xs text-slate-500">Warehouse Purchase Capital:</div>
                <div className="text-xl font-montserrat font-black text-amber-800 font-mono-tabular">
                  {formatKes(stockMetrics.lpsCost)}
                </div>
                <div className="text-[11px] text-slate-500">
                  Share of Total Inventory: {stockMetrics.totalStockCost > 0 ? ((stockMetrics.lpsCost / stockMetrics.totalStockCost) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Regional Branch Depot Inventory Valuation Matrix */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Regional Branch & Bonded Depot Stock Asset Ledger
                </h3>
                <p className="text-xs text-slate-600">
                  Asset valuation breakdown per geographical depot and licensed bond warehouse.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">Branch Depot Name</th>
                    <th className="py-2.5 px-3 font-black">Geo-Pricing Zone</th>
                    <th className="py-2.5 px-3 font-black text-right">Physical Stock (Btls)</th>
                    <th className="py-2.5 px-3 font-black text-right">Asset Cost Value (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Retail Market Value (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Unrealized Margin (KES)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {branches.map((b) => {
                    const bData = stockMetrics.branchStockMap[b.id] || {
                      bottles: 0,
                      costValuation: 0,
                      retailValuation: 0,
                    };
                    const margin = bData.retailValuation - bData.costValuation;
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">{b.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{b.regionName}</td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                          {bData.bottles.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#0A006E]">
                          {formatKes(bData.costValuation)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900">
                          {formatKes(bData.retailValuation)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">
                          {formatKes(margin)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DEAD STOCK, DAMAGES & SPOILAGE WRITE-OFFS */}
      {activeTab === 'deadstock_damages' && (
        <div className="space-y-6">
          {/* Write-off Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4">
              <span className="text-xs font-bold text-rose-700 uppercase">Damaged Goods Write-Off</span>
              <div className="text-2xl font-montserrat font-black text-rose-800 font-mono-tabular mt-1">
                {formatKes(stockMetrics.totalDamagedLossKes)}
              </div>
              <div className="text-xs text-rose-600 mt-1">
                {stockMetrics.totalDamagedBottles} bottles broken, crushed or damaged in transit.
              </div>
            </div>

            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
              <span className="text-xs font-bold text-amber-700 uppercase">Spoiled Stock Write-Off</span>
              <div className="text-2xl font-montserrat font-black text-amber-800 font-mono-tabular mt-1">
                {formatKes(stockMetrics.totalSpoiledLossKes)}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                {stockMetrics.totalSpoiledBottles} bottles curdled, corked, oxidized or spoiled.
              </div>
            </div>

            <div className="bg-slate-100 border-2 border-slate-300 rounded-2xl p-4">
              <span className="text-xs font-bold text-slate-700 uppercase">Total Shrinkage & Write-Offs</span>
              <div className="text-2xl font-montserrat font-black text-slate-900 font-mono-tabular mt-1">
                {formatKes(stockMetrics.totalWriteOffs)}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Deducted from gross commercial surplus on the P&L statement.
              </div>
            </div>
          </div>

          {/* Stagnant & Dead Stock Analysis (Set by Inventory Manager) */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Stagnant & Dead Stock Valuation Ledger
                </h3>
                <p className="text-xs text-slate-600">
                  SKUs exceeding the Inventory Manager's inactivity threshold with zero sales velocity.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-mono-tabular">
                Total Locked Capital: {formatKes(stockMetrics.totalDeadStockCapitalKes)}
              </span>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">SKU</th>
                    <th className="py-2.5 px-3 font-black">Liquor Description</th>
                    <th className="py-2.5 px-3 font-black">Category</th>
                    <th className="py-2.5 px-3 font-black text-center">Days Inactive</th>
                    <th className="py-2.5 px-3 font-black text-center">Threshold</th>
                    <th className="py-2.5 px-3 font-black text-right">Idle Stock</th>
                    <th className="py-2.5 px-3 font-black text-right">Tied-Up Capital (KES)</th>
                    <th className="py-2.5 px-3 font-black text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {stockMetrics.deadStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500 font-medium">
                        No SKUs currently exceed the dead stock threshold. Inventory circulation is healthy!
                      </td>
                    </tr>
                  ) : (
                    stockMetrics.deadStockItems.map((item) => (
                      <tr key={item.product.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">{item.product.sku}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">{item.product.name}</td>
                        <td className="py-2.5 px-3">{item.product.category} · {item.product.subCategory}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-amber-700 font-mono-tabular">
                          {item.daysInactive} days
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500">
                          {item.product.deadStockThresholdDays || 90} days
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                          {item.product.totalBottles} btls
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-black text-amber-900">
                          {formatKes(item.tiedUpCapital)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            DEAD STOCK
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: KRA TAX, VAT & ACCOUNTS RECEIVABLE */}
      {activeTab === 'tax_credit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* KRA Tax Liabilities */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-300 pb-3">
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  KRA Statutory Tax & Excise Duties Accrual
                </h3>
                <p className="text-xs text-slate-600">
                  Fiscal obligations calculated per Kenya Revenue Authority requirements.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">Output Value Added Tax (VAT 16%):</div>
                    <div className="text-[11px] text-slate-500">Calculated on gross commercial retail & wholesale turnover</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black font-montserrat text-[#0A006E] font-mono-tabular">
                      {formatKes(taxMetrics.estimatedVatPayable)}
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Payable 20th Monthly
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">KRA Digital Excise Stamps / Spirits Duty:</div>
                    <div className="text-[11px] text-slate-500">Excise stamps duty verified on IPS spirits & liqueurs</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black font-montserrat text-slate-900 font-mono-tabular">
                      {formatKes(taxMetrics.estimatedExciseLiability)}
                    </div>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                      Bonded / Cleared
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">Staff Statutory Payroll Deductions:</div>
                    <div className="text-[11px] text-slate-500">PAYE, NSSF, and NHIF/SHIF withholdings from payroll</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black font-montserrat text-slate-900 font-mono-tabular">
                      {formatKes(taxMetrics.totalPayrollDisbursed * 0.22)}
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Remittance Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Accounts Receivable & Aging Analysis */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="border-b border-slate-300 pb-3">
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Accounts Receivable & Commercial Credit Aging
                </h3>
                <p className="text-xs text-slate-600">
                  Outstanding credit invoices issued to B2B retailers and distributors.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-800">Total Outstanding Receivables:</div>
                    <div className="text-[11px] text-slate-500">Unsettled credit invoices awaiting bank clearance</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-black font-montserrat text-[#0A006E] font-mono-tabular">
                      {formatKes(salesMetrics.accountsReceivable)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-emerald-800">Current (0 - 30 Days):</div>
                    <div className="text-sm font-black text-slate-900 font-mono-tabular mt-1">
                      {formatKes(Math.max(0, salesMetrics.accountsReceivable - salesMetrics.overdueReceivable))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Within standard terms</div>
                  </div>

                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold text-rose-700">Overdue (30+ Days Risk):</div>
                    <div className="text-sm font-black text-rose-700 font-mono-tabular mt-1">
                      {formatKes(salesMetrics.overdueReceivable)}
                    </div>
                    <div className="text-[10px] text-rose-500 mt-0.5">Follow-up required</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
