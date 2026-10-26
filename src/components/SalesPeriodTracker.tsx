import React, { useState, useMemo } from 'react';
import {
  Calendar,
  TrendingUp,
  Download,
  FileSpreadsheet,
  FileText,
  Search,
  ShoppingCart,
  Building2,
  Globe,
  Printer,
  ChevronRight,
  ArrowUpRight,
  Clock,
  Sparkles,
  DollarSign,
  Receipt,
  Layers,
} from 'lucide-react';
import { TransactionDoc, StaffMember, LineItem, Branch } from '../types';
import { formatKes, exportToCSV, exportReportToPDF } from '../erpUtils';

export type SalesPeriod = 'today' | 'this_week' | 'this_month' | 'this_year' | 'all';

interface SalesPeriodTrackerProps {
  transactions: TransactionDoc[];
  currentUser: StaffMember;
  onPreviewDoc: (doc: TransactionDoc) => void;
  onInspectOrder?: (doc: TransactionDoc) => void;
  onNavigateToPos?: (mode: 'retail' | 'wholesale') => void;
  branches?: Branch[];
  staff?: StaffMember[];
}

interface PeriodStats {
  periodKey: SalesPeriod;
  label: string;
  shortLabel: string;
  dateRangeDesc: string;
  transactions: TransactionDoc[];
  grossSales: number;
  creditNotes: number;
  netSales: number;
  ordersCount: number;
  averageOrderValue: number;
  channelBreakdown: {
    retail: { total: number; count: number };
    wholesale: { total: number; count: number };
    online: { total: number; count: number };
    other: { total: number; count: number };
  };
}

export const SalesPeriodTracker: React.FC<SalesPeriodTrackerProps> = ({
  transactions,
  currentUser,
  onPreviewDoc,
  onInspectOrder,
  onNavigateToPos,
  branches = [],
  staff = [],
}) => {
  const [activePeriod, setActivePeriod] = useState<SalesPeriod>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'ALL' | 'Retail' | 'Wholesale' | 'Online'>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'ledger' | 'items'>('ledger');

  // Helper to compute stats for any arbitrary date filter
  const computeStatsForRange = (
    periodKey: SalesPeriod,
    label: string,
    shortLabel: string,
    filterFn: (txDate: Date, now: Date) => boolean,
    dateRangeDesc: string
  ): PeriodStats => {
    const now = new Date();
    const periodTxs = transactions.filter((tx) => {
      if (!tx.createdAt) return false;
      const txDate = new Date(tx.createdAt);
      if (isNaN(txDate.getTime())) return false;
      
      // Additional filters
      if (selectedBranchId !== 'ALL' && tx.branchId !== selectedBranchId) return false;
      if (selectedStaffId !== 'ALL' && tx.createdBy !== selectedStaffId) return false;
      
      return filterFn(txDate, now);
    });

    let grossSales = 0;
    let creditNotes = 0;
    let ordersCount = 0;

    const channelBreakdown = {
      retail: { total: 0, count: 0 },
      wholesale: { total: 0, count: 0 },
      online: { total: 0, count: 0 },
      other: { total: 0, count: 0 },
    };

    periodTxs.forEach((tx) => {
      const isSale =
        tx.docType === 'Receipt' ||
        tx.docType === 'Invoice' ||
        tx.docType === 'Online Order';

      if (isSale) {
        grossSales += tx.totalAmount;
        ordersCount++;

        const ch = (tx.channel || '').toLowerCase();
        if (ch.includes('retail') || ch.includes('counter')) {
          channelBreakdown.retail.total += tx.totalAmount;
          channelBreakdown.retail.count++;
        } else if (ch.includes('wholesale') || ch.includes('b2b')) {
          channelBreakdown.wholesale.total += tx.totalAmount;
          channelBreakdown.wholesale.count++;
        } else if (ch.includes('online') || ch.includes('portal') || ch.includes('store')) {
          channelBreakdown.online.total += tx.totalAmount;
          channelBreakdown.online.count++;
        } else {
          channelBreakdown.other.total += tx.totalAmount;
          channelBreakdown.other.count++;
        }
      } else if (tx.docType === 'Credit Note') {
        creditNotes += tx.totalAmount;
      }
    });

    const netSales = Math.max(0, grossSales - creditNotes);
    const averageOrderValue = ordersCount > 0 ? Math.round(grossSales / ordersCount) : 0;

    return {
      periodKey,
      label,
      shortLabel,
      dateRangeDesc,
      transactions: periodTxs,
      grossSales,
      creditNotes,
      netSales,
      ordersCount,
      averageOrderValue,
      channelBreakdown,
    };
  };

  // Compute all period stats simultaneously for side-by-side display
  const allPeriodStats = useMemo<Record<SalesPeriod, PeriodStats>>(() => {
    const now = new Date();

    // 1. TODAY: from 00:00:00 to 23:59:59 of current day
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayStats = computeStatsForRange(
      'today',
      'Today',
      'Today',
      (txDate) => txDate >= startOfToday && txDate <= endOfToday,
      startOfToday.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    );

    // 2. THIS WEEK: from Monday 00:00:00 of current week to now
    const dayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0);
    const weekStats = computeStatsForRange(
      'this_week',
      'This Week',
      'Week',
      (txDate) => txDate >= startOfWeek && txDate <= now,
      `${startOfWeek.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    );

    // 3. THIS MONTH: from 1st of current month to now
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthStats = computeStatsForRange(
      'this_month',
      'This Month',
      'Month',
      (txDate) => txDate >= startOfMonth && txDate <= now,
      now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    );

    // 4. THIS YEAR: from Jan 1 of current year to now
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const yearStats = computeStatsForRange(
      'this_year',
      'This Year',
      'Year',
      (txDate) => txDate >= startOfYear && txDate <= now,
      `Calendar Year ${now.getFullYear()}`
    );

    // 5. ALL TIME
    const allStats = computeStatsForRange(
      'all',
      'All Time',
      'All',
      () => true,
      'Cumulative System History'
    );

    return {
      today: todayStats,
      this_week: weekStats,
      this_month: monthStats,
      this_year: yearStats,
      all: allStats,
    };
  }, [transactions, selectedBranchId, selectedStaffId]);

  const activeStats = allPeriodStats[activePeriod];

  // Filter transactions in active period by search & channel
  const filteredActiveTransactions = useMemo(() => {
    return activeStats.transactions.filter((tx) => {
      // Channel filter
      if (selectedChannel === 'Retail') {
        const ch = (tx.channel || '').toLowerCase();
        if (!ch.includes('retail') && !ch.includes('counter')) return false;
      } else if (selectedChannel === 'Wholesale') {
        const ch = (tx.channel || '').toLowerCase();
        if (!ch.includes('wholesale') && !ch.includes('b2b')) return false;
      } else if (selectedChannel === 'Online') {
        const ch = (tx.channel || '').toLowerCase();
        if (!ch.includes('online') && !ch.includes('portal') && !ch.includes('store')) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDoc = (tx.docNumber || '').toLowerCase().includes(q);
        const matchesCust = (tx.customerName || '').toLowerCase().includes(q);
        const matchesChannel = (tx.channel || '').toLowerCase().includes(q);
        const matchesPay = (tx.paymentMethod || '').toLowerCase().includes(q);
        const matchesBranch = (tx.branchName || '').toLowerCase().includes(q);
        if (!matchesDoc && !matchesCust && !matchesChannel && !matchesPay && !matchesBranch) {
          return false;
        }
      }

      return true;
    });
  }, [activeStats.transactions, selectedChannel, searchQuery]);

  const itemStatistics = useMemo(() => {
    const stats: Record<string, { name: string; quantity: number; revenue: number }> = {};
    filteredActiveTransactions.forEach((tx) => {
      try {
        const items: LineItem[] = JSON.parse(tx.itemsSummary || '[]');
        items.forEach((item) => {
          if (!stats[item.productId]) {
            stats[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
          }
          // Assuming item price is calculated; I'll use a simple approximation if needed, but for now just quantity
          stats[item.productId].quantity += 1; // Assuming 1 per line item, or I need item.quantity
        });
      } catch (e) {
        console.error('Error parsing items', e);
      }
    });
    return Object.values(stats).sort((a, b) => b.quantity - a.quantity);
  }, [filteredActiveTransactions]);

  // CSV Download for the active period
  const handleDownloadCSV = () => {
    const periodClean = activeStats.label.replace(/\s+/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Vaairo_Sales_${periodClean}_${dateStamp}`;

    exportToCSV(
      filename,
      [
        'Document No',
        'Date & Time',
        'Doc Type',
        'Channel',
        'Branch',
        'Geo-Zone',
        'Customer / Retailer',
        'Payment Method',
        'Status',
        'Subtotal (KES)',
        'Excise & Tax (KES)',
        'Total Amount (KES)',
        'Issued By',
      ],
      activeStats.transactions.map((tx) => [
        tx.docNumber,
        new Date(tx.createdAt).toLocaleString(),
        tx.docType,
        tx.channel,
        tx.branchName,
        tx.regionName,
        tx.customerName,
        tx.paymentMethod,
        tx.status,
        Math.round(tx.subtotal || tx.totalAmount),
        Math.round(tx.exciseAndTax || 0),
        Math.round(tx.totalAmount),
        `${tx.createdBy || 'Terminal'} (${tx.createdByRole || 'Staff'})`,
      ])
    );
  };

  // PDF Download for the active period
  const handleDownloadPDF = () => {
    const periodClean = activeStats.label.replace(/\s+/g, '_');
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `Vaairo_Sales_Statement_${periodClean}_${dateStamp}`;

    exportReportToPDF(
      `OFFICIAL COMMERCIAL SALES AUDIT LEDGER — ${activeStats.label.toUpperCase()}`,
      `Period: ${activeStats.dateRangeDesc} | Prepared for ${currentUser.name} (${currentUser.role}) | Branch: ${currentUser.branchName}`,
      [
        'Doc Number',
        'Date & Time',
        'Type',
        'Channel',
        'Customer / Account',
        'Payment',
        'Status',
        'Total (KES)',
      ],
      activeStats.transactions.map((tx) => [
        tx.docNumber,
        new Date(tx.createdAt).toLocaleDateString() + ' ' + new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tx.docType,
        tx.channel.replace(' POS', ''),
        tx.customerName,
        tx.paymentMethod,
        tx.status,
        Math.round(tx.totalAmount).toLocaleString(),
      ]),
      filename
    );
  };

  const periodOptions: { key: SalesPeriod; label: string; badge: string }[] = [
    { key: 'today', label: 'Today', badge: formatKes(allPeriodStats.today.grossSales) },
    { key: 'this_week', label: 'This Week', badge: formatKes(allPeriodStats.this_week.grossSales) },
    { key: 'this_month', label: 'This Month', badge: formatKes(allPeriodStats.this_month.grossSales) },
    { key: 'this_year', label: 'This Year', badge: formatKes(allPeriodStats.this_year.grossSales) },
    { key: 'all', label: 'All Time', badge: formatKes(allPeriodStats.all.grossSales) },
  ];

  return (
    <div className="bg-[#F0F2F0] border-2 border-[#0A006E]/20 rounded-2xl p-4 sm:p-5 space-y-4 sm:space-y-5 shadow-xs">
      {/* Top Header: Title, Period Description & Download Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 border-b border-slate-300 pb-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-montserrat uppercase tracking-wider bg-[#0A006E] text-[#FFDE00]">
              Commercial Revenue Intelligence
            </span>
            <span className="text-xs font-montserrat font-bold text-slate-600">
              {activeStats.dateRangeDesc}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-montserrat font-black text-[#0A006E] mt-1">
            Sales Performance &amp; Revenue Ledger
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time multi-branch retail checkout, wholesale invoicing, and online portal commercial orders.
          </p>
        </div>

        {/* Action Buttons: Download CSV & Download PDF */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleDownloadCSV}
            className="flex-1 sm:flex-none px-3.5 py-2.5 bg-white border-2 border-[#0A006E] hover:bg-slate-50 active:bg-slate-100 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
            title={`Download ${activeStats.label} sales as CSV`}
          >
            <FileSpreadsheet className="w-4 h-4 stroke-[2.2] text-[#0A006E]" />
            <span>Download CSV</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] active:bg-[#040030] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-2 cursor-pointer shadow-md transition active:scale-95 whitespace-nowrap"
            title={`Download ${activeStats.label} sales statement as PDF`}
          >
            <Download className="w-4 h-4 stroke-[2.2] text-[#FFDE00]" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Branch & Staff Drill-down Filters */}
      <div className="flex gap-2">
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="ALL">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <select
          value={selectedStaffId}
          onChange={(e) => setSelectedStaffId(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white"
        >
          <option value="ALL">All Sales Persons</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Period Selection Selector Tabs (Today, This Week, This Month, This Year, All Time) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-0.5">
        {periodOptions.map((opt) => {
          const isSelected = activePeriod === opt.key;
          const stats = allPeriodStats[opt.key];
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setActivePeriod(opt.key)}
              className={`p-3 rounded-2xl border-2 text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                isSelected
                  ? 'bg-[#0A006E] border-[#0A006E] text-white shadow-md scale-[1.02]'
                  : 'bg-white border-slate-200 hover:border-[#0A006E] text-slate-800 hover:bg-[#FFDE00]/15'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`text-[11px] font-montserrat font-black uppercase tracking-wider ${
                    isSelected ? 'text-[#FFDE00]' : 'text-[#0A006E]'
                  }`}
                >
                  {opt.label}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stats.ordersCount} sales
                </span>
              </div>
              <div
                className={`text-sm sm:text-base font-montserrat font-black font-mono-tabular truncate ${
                  isSelected ? 'text-white' : 'text-slate-900'
                }`}
              >
                {formatKes(stats.grossSales)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Period Key Statistics & KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Gross Revenue */}
        <div className="bg-white border-2 border-[#0A006E]/15 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-montserrat font-bold">
            <span>Gross Sales ({activeStats.label})</span>
            <TrendingUp className="w-4 h-4 text-[#1E9E60]" />
          </div>
          <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular">
            {formatKes(activeStats.grossSales)}
          </div>
          <div className="text-[11px] text-slate-500">
            Across <strong className="text-slate-800 font-bold">{activeStats.ordersCount}</strong> completed transactions
          </div>
        </div>

        {/* Metric 2: Net Realized Sales */}
        <div className="bg-white border-2 border-[#0A006E]/15 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-montserrat font-bold">
            <span>Net Realized Revenue</span>
            <DollarSign className="w-4 h-4 text-[#0A006E]" />
          </div>
          <div className="text-2xl font-montserrat font-black text-[#1E9E60] font-mono-tabular">
            {formatKes(activeStats.netSales)}
          </div>
          <div className="text-[11px] text-slate-500">
            {activeStats.creditNotes > 0
              ? `Credit Notes: -${formatKes(activeStats.creditNotes)}`
              : 'Zero credit adjustments deducted'}
          </div>
        </div>

        {/* Metric 3: Average Order Value */}
        <div className="bg-white border-2 border-[#0A006E]/15 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-montserrat font-bold">
            <span>Average Ticket (AOV)</span>
            <Layers className="w-4 h-4 text-[#0A006E]" />
          </div>
          <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular">
            {formatKes(activeStats.averageOrderValue)}
          </div>
          <div className="text-[11px] text-slate-500">
            Mean invoice size for {activeStats.label.toLowerCase()}
          </div>
        </div>

        {/* Metric 4: Channel Split Summary */}
        <div className="bg-white border-2 border-[#0A006E]/15 rounded-2xl p-4 space-y-1 shadow-2xs">
          <div className="text-slate-500 text-xs font-montserrat font-bold">
            Sales Channels Mix
          </div>
          <div className="space-y-1 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <ShoppingCart className="w-3.5 h-3.5 text-[#0A006E]" />
                Retail Counter:
              </span>
              <span className="font-montserrat font-bold font-mono-tabular text-slate-900">
                {formatKes(activeStats.channelBreakdown.retail.total)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Building2 className="w-3.5 h-3.5 text-[#0A006E]" />
                Wholesale B2B:
              </span>
              <span className="font-montserrat font-bold font-mono-tabular text-slate-900">
                {formatKes(activeStats.channelBreakdown.wholesale.total)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600">
                <Globe className="w-3.5 h-3.5 text-[#0A006E]" />
                Online Store:
              </span>
              <span className="font-montserrat font-bold font-mono-tabular text-slate-900">
                {formatKes(activeStats.channelBreakdown.online.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      
      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setViewMode('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${viewMode === 'ledger' ? 'bg-[#0A006E] text-white' : 'bg-white border border-slate-300'}`}
        >
          Sales Ledger
        </button>
        <button
          onClick={() => setViewMode('items')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${viewMode === 'items' ? 'bg-[#0A006E] text-white' : 'bg-white border border-slate-300'}`}
        >
          Item Statistics
        </button>
      </div>

      {viewMode === 'ledger' ? (
        /* Transactions Search, Channel Filter & Table */
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                {activeStats.label} Commercial Ledger
              </span>
              <span className="text-xs text-slate-500 font-mono-tabular">
                ({filteredActiveTransactions.length} of {activeStats.transactions.length} records)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search Box */}
              <div className="relative min-w-[200px] flex-1 sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search doc#, customer, payment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-[#F0F2F0] border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:border-[#0A006E]"
                />
              </div>

              {/* Channel filter chips */}
              <div className="flex items-center gap-1 bg-[#F0F2F0] p-0.5 rounded-xl border border-slate-200 text-xs">
                {(['ALL', 'Retail', 'Wholesale', 'Online'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setSelectedChannel(ch)}
                    className={`px-2.5 py-1 rounded-lg font-montserrat font-bold transition cursor-pointer text-[11px] ${
                      selectedChannel === ch
                        ? 'bg-[#0A006E] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>
          </div>
        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Document No</th>
                <th className="py-2.5 px-3 font-black">Date &amp; Time</th>
                <th className="py-2.5 px-3 font-black">Type &amp; Channel</th>
                <th className="py-2.5 px-3 font-black">Customer / Account</th>
                <th className="py-2.5 px-3 font-black">Branch / Zone</th>
                <th className="py-2.5 px-3 font-black">Payment</th>
                <th className="py-2.5 px-3 font-black text-right">Amount (KES)</th>
                <th className="py-2.5 px-3 font-black text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredActiveTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Receipt className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                      <span className="text-xs font-semibold">No transactions found for this period/filter</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredActiveTransactions.map((tx) => {
                  const txDate = new Date(tx.createdAt);
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                        {tx.docNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {txDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-tabular">
                          {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black font-montserrat ${
                            tx.docType === 'Receipt'
                              ? 'bg-emerald-100 text-emerald-800'
                              : tx.docType === 'Invoice'
                              ? 'bg-blue-100 text-blue-800'
                              : tx.docType === 'Online Order'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {tx.docType}
                        </span>
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">
                          {tx.channel}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">
                        {tx.customerName || 'Walk-in Retail Customer'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        <div className="font-medium text-slate-800">{tx.branchName}</div>
                        <div className="text-[10px] text-slate-500 truncate">{tx.regionName}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-[#F0F2F0] border border-slate-200 text-[11px] font-semibold">
                          {tx.paymentMethod || 'Cash'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-tabular font-black text-slate-900 text-sm">
                        {formatKes(tx.totalAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {onInspectOrder && (
                            <button
                              type="button"
                              onClick={() => onInspectOrder(tx)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-montserrat font-black cursor-pointer shadow-2xs transition active:scale-95 inline-flex items-center gap-1 ${
                                tx.docType === 'Online Order' || tx.deliveryAddress
                                  ? 'bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border border-[#0A006E]'
                                  : 'bg-slate-100 hover:bg-slate-200 text-[#0A006E] border border-slate-300'
                              }`}
                            >
                              <span>
                                {tx.docType === 'Online Order' || tx.deliveryAddress
                                  ? 'Order Details & Delivery'
                                  : 'Details'}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(tx)}
                            className="px-2.5 py-1.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-black cursor-pointer shadow-2xs transition active:scale-95 inline-flex items-center gap-1"
                          >
                            <Printer className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </div>
      ) : (
        /* Item Statistics Table */
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
          <h4 className="font-bold">Item Statistics</h4>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left py-2">Item Name</th>
                <th className="text-right py-2">Quantity Sold</th>
              </tr>
            </thead>
            <tbody>
              {itemStatistics.map((item) => (
                <tr key={item.name}>
                  <td className="py-2">{item.name}</td>
                  <td className="text-right py-2">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
};
