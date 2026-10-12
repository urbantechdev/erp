import React, { useState, useMemo } from 'react';
import {
  Package,
  Building2,
  ArrowLeftRight,
  MapPin,
  Download,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  StaffMember,
  Branch,
  GeoRegion,
  Product,
  Partner,
  StockTransfer,
  TransactionDoc,
  StockCategory,
  LiquorSubCategory,
} from '../types';
import {
  generateAutoSku,
  calculateGeoPrice,
  ROLE_PERMISSIONS,
  exportToCSV,
  exportReportToPDF,
  formatKes,
} from '../erpUtils';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../data/nairobiDrinksCatalog';
import { ProductImage } from './ProductImage';

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
  onPreviewDoc: (doc: TransactionDoc) => void;
}> = ({
  currentUser,
  products,
  branches,
  regions,
  partners,
  transactions,
  transfers,
  staffList,
  onPreviewDoc,
}) => {
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
      btls += p.totalBottles ?? (p.packSize || 12) * 30;
      if (p.category === 'LPS') lps++;
      else ips++;
    });
    return { totalBottlesInBond: btls, ipsCount: ips, lpsCount: lps };
  }, [products]);

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

  return (
    <div className="space-y-6">
      {/* VAAIRO Signature Yellow Hero Banner */}
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            {ROLE_PERMISSIONS[currentUser.role].badgeTitle}
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            {scopedBranchId
              ? `Regional Branch Command · ${currentUser.branchName}`
              : 'National Importer & Multi-Branch Operations Center'}
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Real-time IPS/LPS excise inventory valuation, regional price governance, and commercial ledger monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10">
          <button
            onClick={handleDownloadStatementPDF}
            className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] hover:bg-[#060046] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-md"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            Export PDF Statement
          </button>
          <button
            onClick={handleDownloadStatementCSV}
            className="px-3.5 py-2 bg-white border-2 border-[#0A006E] text-[#0A006E] hover:bg-slate-50 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#0A006E]" />
            Export CSV
          </button>
        </div>
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
  products: Product[];
  branches: Branch[];
  onCreateProduct: (prod: Omit<Product, 'id' | 'createdAt'>) => Promise<void>;
}> = ({ products, branches, onCreateProduct }) => {
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
  const [baseLandedCost, setBaseLandedCost] = useState<number>(0);
  const [baseWholesalePrice, setBaseWholesalePrice] = useState<number>(0);
  const [baseRetailPrice, setBaseRetailPrice] = useState<number>(0);
  const [initialBottles, setInitialBottles] = useState<number>(0);
  const [targetBranchId, setTargetBranchId] = useState<string>(branches[0]?.id || '');

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
      return matchStock && matchSub && matchSearch;
    });
  }, [products, filterStockCat, filterSubCat, searchQuery]);

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const branchMap: Record<string, number> = {};
    branches.forEach((b) => {
      branchMap[b.id] = b.id === (targetBranchId || branches[0]?.id) ? initialBottles : 0;
    });

    await onCreateProduct({
      sku: previewAutoSku,
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
    });

    setName('');
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
      {/* VAAIRO Yellow Hero Banner */}
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            Bonded Warehouse & Auto-SKU Controller ({products.length} Master SKUs Imported)
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            IPS (Imported) & LPS (Local) Liquor Inventory + Auto-SKU Engine
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Complete with all 12 Liquor Categories from the VAAIRO catalog and deterministic Auto-SKU generation for new products.
          </p>
        </div>
        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={handleExportInventoryPDF}
            className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            Download PDF
          </button>
          <button
            onClick={handleExportInventoryCSV}
            className="px-3.5 py-2 bg-white border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#0A006E]" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Add New Independent Liquor SKU Form */}
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
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="px-2 py-2 bg-white border border-slate-200 rounded-xl"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code}
                  </option>
                ))}
              </select>
            </div>
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

      {/* Master Catalog Filter Bar & Table */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
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
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs"
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
                className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black cursor-pointer ${
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

        {/* 12 Subcategory Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setFilterSubCat('ALL');
              setTableLimit(60);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer ${
              filterSubCat === 'ALL'
                ? 'bg-[#0A006E] text-[#FFDE00]'
                : 'bg-white text-slate-700 border border-slate-200'
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
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                filterSubCat === sub
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-white text-slate-700 border border-slate-200'
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
                <th className="py-2.5 px-3 font-black">Bottle</th>
                <th className="py-2.5 px-3 font-black">Auto SKU & Barcode</th>
                <th className="py-2.5 px-3 font-black">Brand & Product Name</th>
                <th className="py-2.5 px-3 font-black">Class & Subcategory</th>
                <th className="py-2.5 px-3 font-black">Spec & Origin</th>
                <th className="py-2.5 px-3 font-black text-right">Wholesale (KES)</th>
                <th className="py-2.5 px-3 font-black text-right">Retail (KES)</th>
                <th className="py-2.5 px-3 font-black text-right">Total Bottles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.slice(0, tableLimit).map((p) => {
                const packSize = p.packSize || p.bottlesPerCase || 12;
                const abv = p.alcoholPercentage ?? p.abv ?? 40;
                const wholesale = p.wholesalePriceKes ?? p.baseWholesalePrice ?? 0;
                const retail = p.retailPriceKes ?? p.baseRetailPrice ?? 0;
                const totalBtls = p.totalBottles ?? packSize * 30;

                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2 px-3">
                      <ProductImage
                        product={{
                          ...p,
                          category: p.category === 'LPS' ? 'LPS' : 'IPS',
                        }}
                        size="xs"
                      />
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular">
                      <div className="font-bold text-[#0A006E]">{p.sku}</div>
                      {p.barcode && <div className="text-[10px] text-slate-500">EAN: {p.barcode}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-montserrat font-bold text-slate-900">{p.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.brand} · {p.importDeclarationNumber || p.importEntryRef}
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
    </div>
  );
};

// ---------------------------------------------------------------------------
// 3. BRANCH CREATION & STOCK TRANSFER MODULE
// ---------------------------------------------------------------------------
export const BranchesAndTransfersModule: React.FC<{
  currentUser: StaffMember;
  branches: Branch[];
  regions: GeoRegion[];
  products: Product[];
  partners: Partner[];
  transfers: StockTransfer[];
  onCreateBranch: (b: Omit<Branch, 'id' | 'createdAt'>) => Promise<void>;
  onCreateStockTransfer: (
    tr: Omit<StockTransfer, 'id' | 'createdAt'>,
    updatedProduct: { productId: string; newBranchStockJson: string }
  ) => Promise<void>;
}> = ({
  currentUser,
  branches,
  regions,
  products,
  partners,
  transfers,
  onCreateBranch,
  onCreateStockTransfer,
}) => {
  const [branchName, setBranchName] = useState('');
  const [branchRegionId, setBranchRegionId] = useState(regions[0]?.id || '');
  const [branchAddress, setBranchAddress] = useState('');
  const [exciseBondLicense, setExciseBondLicense] = useState('');

  const [fromBranchId, setFromBranchId] = useState(branches[0]?.id || '');
  const [toBranchId, setToBranchId] = useState(branches[1]?.id || branches[0]?.id || '');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [qtyBottles, setQtyBottles] = useState<number>(12);
  const [vehicleReg, setVehicleReg] = useState('');
  const [excisePermitNo, setExcisePermitNo] = useState('');

  const logisticsPartners = useMemo(
    () => partners.filter((p) => p.partnerType === 'Logistics'),
    [partners]
  );
  const [logisticsName, setLogisticsName] = useState('');

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;
    const reg = regions.find((r) => r.id === branchRegionId) || regions[0];
    const code = `BR-${branchName.slice(0, 3).toUpperCase()}-00${branches.length + 1}`;
    await onCreateBranch({
      code,
      name: branchName.trim(),
      regionId: reg?.id || 'reg-metro-core',
      regionName: reg?.name || 'Metropolitan Zone',
      address: branchAddress.trim() || 'Regional Distribution Yard',
      managerName: currentUser.name,
      exciseBondLicense: exciseBondLicense.trim(),
      status: 'Operational',
    });
    setBranchName('');
    setBranchAddress('');
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromBranchId === toBranchId) return;
    const fromBr = branches.find((b) => b.id === fromBranchId);
    const toBr = branches.find((b) => b.id === toBranchId);
    const prod = products.find((p) => p.id === productId);
    if (!fromBr || !toBr || !prod) return;

    const fallbackTotal = prod.totalBottles ?? (prod.packSize || 12) * 30;
    let branchStock: Record<string, number> = {};
    try {
      branchStock = prod.branchStockSummary ? JSON.parse(prod.branchStockSummary) : {};
    } catch {
      branchStock = {};
    }

    const sourceAvail = branchStock[fromBr.id] ?? fallbackTotal;
    const actualMove = Math.min(sourceAvail, Math.max(1, qtyBottles));
    branchStock[fromBr.id] = Math.max(0, sourceAvail - actualMove);
    branchStock[toBr.id] = (branchStock[toBr.id] ?? 0) + actualMove;

    await onCreateStockTransfer(
      {
        transferNo: `TRF-${Date.now().toString().slice(-6)}`,
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
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create New Branch Card */}
        <form
          onSubmit={handleAddBranch}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Building2 className="w-4 h-4 text-[#0A006E]" />
            <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
              Establish New Regional Distribution Branch / Depot
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Branch / Depot Name *</label>
              <input
                required
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Karen Suburban Bonded Hub"
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
              <label className="font-montserrat font-bold text-slate-700">Physical Yard Address *</label>
              <input
                required
                type="text"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                placeholder="e.g. Industrial Park Block C"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="font-montserrat font-bold text-slate-700">Customs / Excise Bond License</label>
              <input
                type="text"
                value={exciseBondLicense}
                onChange={(e) => setExciseBondLicense(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#FFDE00]" />
            Commission New Branch
          </button>
        </form>

        {/* Inter-Branch Bonded Stock Transfer Card */}
        <form
          onSubmit={handleExecuteTransfer}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <ArrowLeftRight className="w-4 h-4 text-[#0A006E]" />
            <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
              Inter-Branch Bonded Stock Transfer & Transit Manifest
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
                {branches.map((b) => (
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
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-montserrat font-bold text-slate-700">Liquor Auto-SKU to Transfer</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
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
              <label className="font-montserrat font-bold text-slate-700">Quantity (Bottles) & Vehicle</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="number"
                  min={1}
                  value={qtyBottles}
                  onChange={(e) => setQtyBottles(Number(e.target.value))}
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
                <input
                  type="text"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value)}
                  className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Authorize Bonded Stock Transfer
          </button>
        </form>
      </div>

      {/* Stock Transfer Ledger */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
            Inter-Branch Stock Transfer Ledger
          </h3>
          <button
            onClick={() =>
              exportReportToPDF(
                'Inter-Branch Bonded Stock Transfer Manifest',
                `Exported by ${currentUser.name}`,
                ['Transfer No', 'From Branch', 'To Branch', 'SKU', 'Product', 'Qty Btls', 'Carrier / Vehicle', 'Status'],
                transfers.map((t) => [
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
              )
            }
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
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No inter-branch stock transfers recorded yet. Use the form above to move stock between branches.
                  </td>
                </tr>
              ) : (
                transfers.map((tr) => (
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
  regions: GeoRegion[];
  products: Product[];
  onCreateRegion: (reg: Omit<GeoRegion, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateProductGeoOverride: (
    productId: string,
    regionId: string,
    wholesalePrice: number,
    retailPrice: number
  ) => Promise<void>;
}> = ({ regions, products, onCreateRegion, onUpdateProductGeoOverride }) => {
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
    if (!regionName.trim()) return;
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
    if (!selectedProdId || !selectedRegId) return;
    await onUpdateProductGeoOverride(
      selectedProdId,
      selectedRegId,
      Number(customWholesale),
      Number(customRetail)
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            Regional Tariff & Purchasing Parity Engine
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            Geo-Location Alcohol Pricing Matrix (Affluent Suburb vs. Lower Region vs. Metro)
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Because alcohol cannot be sold in affluent suburbs (e.g. Kilimani/Westlands) at the same price as lower regions (e.g. Donholm/Eastlands), configure regional multipliers, freight levies per case, or explicit SKU price overrides.
          </p>
        </div>
      </div>

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
