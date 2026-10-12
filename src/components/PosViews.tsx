import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  Search,
  Printer,
  CheckCircle2,
  Trash2,
  Plus,
  Minus,
  MapPin,
  Store,
  Briefcase,
} from 'lucide-react';
import {
  Product,
  Branch,
  GeoRegion,
  Partner,
  StaffMember,
  TransactionDoc,
  DocType,
  LineItem,
  StockCategory,
} from '../types';
import { calculateGeoPrice, formatKes } from '../erpUtils';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../data/nairobiDrinksCatalog';
import { ProductImage } from './ProductImage';
import { AnimatedSuccessTickIcon } from './AnimatedFeedback';

interface PosViewsProps {
  mode: 'retail' | 'wholesale';
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  regions: GeoRegion[];
  partners: Partner[];
  onCommitTransaction: (
    txDraft: Omit<TransactionDoc, 'id' | 'createdAt'>,
    updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[]
  ) => Promise<TransactionDoc | null>;
  onPreviewDoc: (doc: TransactionDoc) => void;
}

export const PosViews: React.FC<PosViewsProps> = ({
  mode,
  currentUser,
  products,
  branches,
  regions,
  partners,
  onCommitTransaction,
  onPreviewDoc,
}) => {
  const isScopedBranch =
    currentUser.role === 'Branch Manager' ||
    currentUser.role === 'Counter Cashier' ||
    currentUser.role === 'Affiliate Sales Representative';

  const defaultBranchId =
    (isScopedBranch && currentUser.branchId ? currentUser.branchId : branches[0]?.id) || '';

  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const activeBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || branches[0],
    [branches, selectedBranchId]
  );

  const [selectedRegionId, setSelectedRegionId] = useState<string>(
    activeBranch?.regionId || regions[0]?.id || ''
  );

  const effectiveRegionId =
    mode === 'retail'
      ? activeBranch?.regionId || selectedRegionId
      : selectedRegionId || activeBranch?.regionId || '';

  const activeRegion = useMemo(
    () => regions.find((r) => r.id === effectiveRegionId) || regions[0],
    [regions, effectiveRegionId]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<'ALL' | StockCategory>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [visibleLimit, setVisibleLimit] = useState<number>(36);

  const [cart, setCart] = useState<
    {
      product: Product;
      unitMode: 'Bottle' | 'Case';
      quantityUnits: number;
    }[]
  >([]);

  const retailers = useMemo(
    () => partners.filter((p) => p.partnerType === 'Retailer'),
    [partners]
  );

  const [customerName, setCustomerName] = useState<string>(
    mode === 'retail' ? 'Walk-In Retail Customer (21+ Verified)' : retailers[0]?.companyName || ''
  );
  const [customerLicense, setCustomerLicense] = useState<string>(
    mode === 'retail' ? 'AGE-21-VERIFIED' : retailers[0]?.liquorLicenseNo || ''
  );
  const [paymentMethod, setPaymentMethod] = useState<string>(
    mode === 'retail' ? 'M-Pesa Till / Instant Card' : 'Corporate Bank EFT / M-Pesa Paybill'
  );
  const [docTypeToIssue, setDocTypeToIssue] = useState<DocType>(
    mode === 'retail' ? 'Receipt' : 'Invoice'
  );
  const [affiliateCode, setAffiliateCode] = useState<string>(
    currentUser.role === 'Affiliate Sales Representative'
      ? `AFF-${currentUser.name.slice(0, 3).toUpperCase()}-01`
      : ''
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesStockCat =
        stockCategoryFilter === 'ALL' || p.category === stockCategoryFilter;
      const matchesSub =
        selectedSubCategory === 'ALL' ||
        (p.subCategory || p.category) === selectedSubCategory;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.barcode || '').includes(q);
      return matchesStockCat && matchesSub && matchesSearch;
    });
  }, [products, stockCategoryFilter, selectedSubCategory, searchQuery]);

  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, visibleLimit),
    [filteredProducts, visibleLimit]
  );

  const getBranchBottleStock = (product: Product, branchId: string): number => {
    const fallbackTotal = product.totalBottles ?? (product.packSize || 12) * 30;
    try {
      const parsed = product.branchStockSummary ? JSON.parse(product.branchStockSummary) : {};
      return typeof parsed[branchId] === 'number' ? parsed[branchId] : fallbackTotal;
    } catch {
      return fallbackTotal;
    }
  };

  const handleAddToCart = (product: Product) => {
    const defaultUnitMode: 'Bottle' | 'Case' = mode === 'wholesale' ? 'Case' : 'Bottle';
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === product.id && item.unitMode === defaultUnitMode
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id && item.unitMode === defaultUnitMode
            ? { ...item, quantityUnits: item.quantityUnits + 1 }
            : item
        );
      }
      return [...prev, { product, unitMode: defaultUnitMode, quantityUnits: 1 }];
    });
  };

  const handleUpdateQty = (index: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, idx) =>
          idx === index ? { ...item, quantityUnits: Math.max(0, item.quantityUnits + delta) } : item
        )
        .filter((item) => item.quantityUnits > 0)
    );
  };

  const handleToggleUnitMode = (index: number) => {
    setCart((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, unitMode: item.unitMode === 'Bottle' ? 'Case' : 'Bottle' }
          : item
      )
    );
  };

  const computedLineItems: LineItem[] = useMemo(() => {
    return cart.map((entry) => {
      const packSize = entry.product.packSize || entry.product.bottlesPerCase || 12;
      const geoPricing = calculateGeoPrice(
        entry.product,
        activeRegion,
        mode === 'wholesale' ? 'wholesale' : 'retail'
      );
      const unitPrice =
        entry.unitMode === 'Case' ? geoPricing.casePrice : geoPricing.unitBottlePrice;
      const totalBottles =
        entry.unitMode === 'Case'
          ? entry.quantityUnits * packSize
          : entry.quantityUnits;
      const lineTotal = Math.round(unitPrice * entry.quantityUnits);

      return {
        productId: entry.product.id,
        sku: entry.product.sku,
        name: entry.product.name,
        unitMode: entry.unitMode,
        bottlesPerCase: packSize,
        quantityUnits: entry.quantityUnits,
        totalBottles,
        unitPrice,
        lineTotal,
      };
    });
  }, [cart, activeRegion, mode]);

  const subtotal = useMemo(
    () => computedLineItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [computedLineItems]
  );
  const taxRate = activeRegion?.regionalTaxRate ?? 0.16;
  const exciseAndTax = Math.round(subtotal * taxRate);
  const grandTotal = subtotal + exciseAndTax;

  const handleCompleteCheckout = async () => {
    if (computedLineItems.length === 0 || !activeBranch || !activeRegion) return;
    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const prefixMap: Record<DocType, string> = {
        Receipt: 'RCP',
        Invoice: 'INV',
        Quote: 'QUO',
        'Packing List': 'PKL',
        'Delivery Note': 'DLN',
        'Credit Note': 'CRN',
        'Online Order': 'ONL',
      };
      const docNumber = `${prefixMap[docTypeToIssue]}-${Date.now().toString().slice(-6)}`;

      const updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[] = [];

      if (docTypeToIssue !== 'Quote') {
        for (const line of computedLineItems) {
          const prod = products.find((p) => p.id === line.productId);
          if (prod) {
            const fallbackTotal = prod.totalBottles ?? (prod.packSize || 12) * 30;
            let branchMap: Record<string, number> = {};
            try {
              branchMap = prod.branchStockSummary ? JSON.parse(prod.branchStockSummary) : {};
            } catch {
              branchMap = {};
            }
            const currentBranchQty = branchMap[activeBranch.id] ?? fallbackTotal;
            const nextBranchQty = Math.max(0, currentBranchQty - line.totalBottles);
            branchMap[activeBranch.id] = nextBranchQty;
            const newTotal = Math.max(0, fallbackTotal - line.totalBottles);

            updatedProducts.push({
              productId: prod.id,
              newTotal,
              newBranchStockJson: JSON.stringify(branchMap),
            });
          }
        }
      }

      const createdTx = await onCommitTransaction(
        {
          docNumber,
          docType: docTypeToIssue,
          channel:
            currentUser.role === 'Affiliate Sales Representative'
              ? 'Affiliate Rep'
              : mode === 'retail'
              ? 'Retail Counter POS'
              : 'B2B Wholesale POS',
          branchId: activeBranch.id,
          branchName: activeBranch.name,
          regionId: activeRegion.id,
          regionName: activeRegion.name,
          customerName: customerName.trim() || 'Walk-in Customer',
          customerLicenseNo: customerLicense.trim() || 'VERIFIED-21',
          itemsSummary: JSON.stringify(computedLineItems),
          subtotal,
          exciseAndTax,
          totalAmount: grandTotal,
          paymentMethod,
          status: docTypeToIssue === 'Quote' ? 'Issued' : 'Paid',
          createdBy: currentUser.name,
          createdByRole: currentUser.role,
          affiliateCode: affiliateCode || undefined,
        },
        updatedProducts
      );

      setCart([]);
      setStatusMessage(`${docTypeToIssue} ${docNumber} committed and ready to print.`);
      if (createdTx) {
        onPreviewDoc(createdTx);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* VAAIRO Signature Yellow Hero Banner */}
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            {mode === 'retail' ? (
              <>
                <Store className="w-4 h-4" />
                Retail Counter Checkout Terminal (IPS & LPS)
              </>
            ) : (
              <>
                <Briefcase className="w-4 h-4" />
                B2B Wholesale, Suburb/Regional Distribution & Affiliate Sales POS
              </>
            )}
          </div>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            {mode === 'retail'
              ? 'Walk-In Bottle & Counter Checkout POS'
              : 'Distributor Case & Geo-Regional Sales Terminal'}
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Prices automatically adapt to the selected Geo-Location Zone ({activeRegion?.name}) to enforce suburb vs. lower-region alcohol pricing rules.
          </p>
        </div>

        {/* Branch & Geo-Zone Selectors */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className="bg-white border-2 border-[#0A006E] rounded-xl px-3 py-2">
            <label className="block text-[10px] font-montserrat font-black text-slate-500 uppercase">
              Operating Branch
            </label>
            <select
              disabled={isScopedBranch}
              value={activeBranch?.id || ''}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                const br = branches.find((b) => b.id === e.target.value);
                if (br) setSelectedRegionId(br.regionId);
              }}
              className="text-xs font-montserrat font-black text-[#0A006E] bg-transparent focus:outline-none mt-0.5"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-[#0A006E] text-white border-2 border-[#0A006E] rounded-xl px-3 py-2">
            <label className="block text-[10px] font-montserrat font-black text-[#FFDE00] uppercase flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#FFDE00]" />
              Geo-Pricing Zone (Suburb / Lower Region)
            </label>
            <select
              value={activeRegion?.id || ''}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="text-xs font-montserrat font-black text-white bg-[#0A006E] focus:outline-none mt-0.5"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.tierType})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main 2-Column POS Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: SKU Catalog & Geo-Tariff Cards */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search, IPS/LPS Filter & 12 Subcategories */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleLimit(36);
                  }}
                  placeholder={`Search ${products.length} IPS/LPS products by name, brand, SKU or EAN-13 barcode...`}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0A006E]"
                />
              </div>

              {/* IPS / LPS Stock Category Toggle */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shrink-0">
                {(['ALL', 'IPS', 'LPS'] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => {
                      setStockCategoryFilter(sc);
                      setVisibleLimit(36);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black transition-colors cursor-pointer ${
                      stockCategoryFilter === sc
                        ? 'bg-[#0A006E] text-[#FFDE00]'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sc === 'ALL' ? `All (${products.length})` : sc}
                  </button>
                ))}
              </div>
            </div>

            {/* 12 Imported Subcategories from urbantechdev/LIQOUR */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedSubCategory('ALL');
                  setVisibleLimit(36);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  selectedSubCategory === 'ALL'
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Categories ({filteredProducts.length})
              </button>
              {NAIROBI_DRINKS_SUB_CATEGORIES.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setSelectedSubCategory(sub);
                    setVisibleLimit(36);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    selectedSubCategory === sub
                      ? 'bg-[#0A006E] text-[#FFDE00]'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {displayedProducts.map((product) => {
              const packSize = product.packSize || product.bottlesPerCase || 12;
              const abv = product.alcoholPercentage ?? product.abv ?? 40;
              const geoPrice = calculateGeoPrice(
                product,
                activeRegion,
                mode === 'wholesale' ? 'wholesale' : 'retail'
              );
              const branchStock = activeBranch
                ? getBranchBottleStock(product, activeBranch.id)
                : product.totalBottles ?? 0;

              return (
                <div
                  key={product.id}
                  className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-[#0A006E] transition-all"
                >
                  <div className="flex items-start gap-3.5">
                    <ProductImage
                      product={{
                        ...product,
                        category: product.category === 'LPS' ? 'LPS' : 'IPS',
                      }}
                      size="md"
                      showVolumeBadge={true}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono-tabular">
                        <span className="font-bold text-[#0A006E] truncate">{product.sku}</span>
                        <span className="font-bold text-[#1E9E60] shrink-0">
                          {product.category} · {product.subCategory || 'Spirit'}
                        </span>
                      </div>
                      <h3 className="text-sm font-montserrat font-bold text-[#0A006E] mt-1 leading-snug">
                        {product.name}
                      </h3>
                      <div className="text-[11px] text-slate-600 mt-1">
                        {product.countryOfOrigin || product.originCountry} · {abv}% ABV · {packSize}/cs
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono-tabular">
                        Stock: <strong className="text-slate-900">{branchStock} btls</strong> ({Math.floor(branchStock / packSize)} cs)
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-2">
                    <div className="font-mono-tabular">
                      <div className="text-[10px] text-slate-500">
                        {mode === 'wholesale' ? 'Geo Case / Btl' : 'Geo Retail Bottle'}
                      </div>
                      <div className="text-sm font-montserrat font-black text-[#0A006E]">
                        {mode === 'wholesale'
                          ? `${formatKes(geoPrice.casePrice)}/cs (${formatKes(geoPrice.unitBottlePrice)}/btl)`
                          : `${formatKes(geoPrice.unitBottlePrice)} / btl`}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      className="min-h-[40px] px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#FFDE00]" />
                      Add {mode === 'wholesale' ? 'Case' : 'Bottle'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length > visibleLimit && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setVisibleLimit((prev) => prev + 48)}
                className="px-5 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer"
              >
                Load More Products ({filteredProducts.length - visibleLimit} remaining)
              </button>
            </div>
          )}
        </div>

        {/* Right 5 Columns: Active Order Register & Document Generator */}
        <div className="lg:col-span-5 bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4 sticky top-20">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#0A006E]" />
              <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                {mode === 'retail' ? 'Retail Counter Register' : 'B2B Dispatch & Document Register'}
              </h3>
            </div>
            <span className="text-xs font-mono-tabular font-bold text-[#0A006E]">
              {computedLineItems.length} Line Item(s)
            </span>
          </div>

          {statusMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-[#34D186] text-xs text-[#0A006E] font-montserrat font-black flex items-center gap-3 animate-success-pop shadow-md">
              <AnimatedSuccessTickIcon size="sm" />
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Customer / Retailer Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            {mode === 'wholesale' && retailers.length > 0 && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                  Quick-Select Onboarded Retailer
                </label>
                <select
                  onChange={(e) => {
                    const found = retailers.find((r) => r.id === e.target.value);
                    if (found) {
                      setCustomerName(found.companyName);
                      setCustomerLicense(found.liquorLicenseNo);
                      if (found.regionId) setSelectedRegionId(found.regionId);
                    }
                  }}
                  className="w-full mt-1 px-2.5 py-1.5 bg-[#F0F2F0] border border-slate-200 rounded-lg text-xs text-slate-900 font-semibold"
                >
                  <option value="">-- Choose Licensed Retailer or Type Below --</option>
                  {retailers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.companyName} ({r.regionName} · Lic: {r.liquorLicenseNo})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                Customer / Business Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full mt-1 px-2.5 py-1.5 bg-[#F0F2F0] border border-slate-200 rounded-lg text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                Liquor License / Age ID
              </label>
              <input
                type="text"
                value={customerLicense}
                onChange={(e) => setCustomerLicense(e.target.value)}
                className="w-full mt-1 px-2.5 py-1.5 bg-[#F0F2F0] border border-slate-200 rounded-lg text-xs font-mono-tabular text-slate-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                Document to Generate
              </label>
              <select
                value={docTypeToIssue}
                onChange={(e) => setDocTypeToIssue(e.target.value as DocType)}
                className="w-full mt-1 px-2.5 py-1.5 bg-[#F0F2F0] border border-slate-200 rounded-lg text-xs font-montserrat font-black text-[#0A006E]"
              >
                {mode === 'retail' ? (
                  <>
                    <option value="Receipt">Fiscal POS Receipt</option>
                    <option value="Invoice">Tax Invoice</option>
                  </>
                ) : (
                  <>
                    <option value="Invoice">B2B Tax Invoice</option>
                    <option value="Quote">Commercial Proforma Quote</option>
                    <option value="Packing List">Warehouse Packing List</option>
                    <option value="Delivery Note">Bonded Delivery Note</option>
                    <option value="Receipt">Wholesale Cash Receipt</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                Payment / Settlement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full mt-1 px-2.5 py-1.5 bg-[#F0F2F0] border border-slate-200 rounded-lg text-xs text-slate-900"
              >
                <option value="M-Pesa Till / Instant Card">M-Pesa Till / Instant Card</option>
                <option value="Cash Till Settlement">Cash Till Settlement</option>
                <option value="Corporate Bank EFT / M-Pesa Paybill">Corporate Bank EFT / M-Pesa Paybill</option>
                <option value="Distributor Credit Line">Distributor Credit Line</option>
              </select>
            </div>

            {mode === 'wholesale' && (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                  Affiliate Sales Representative Code (Optional)
                </label>
                <input
                  type="text"
                  value={affiliateCode}
                  onChange={(e) => setAffiliateCode(e.target.value)}
                  placeholder="e.g. AFF-REP-204"
                  className="w-full mt-1 px-2.5 py-1.5 bg-[#F0F2F0] border border-slate-200 rounded-lg text-xs font-mono-tabular text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {computedLineItems.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                Select IPS/LPS liquor products on the left to populate the checkout register.
              </div>
            ) : (
              computedLineItems.map((item, idx) => (
                <div
                  key={`${item.productId}-${item.unitMode}`}
                  className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono-tabular text-[#0A006E] font-bold">
                      {item.sku}
                    </div>
                    <div className="text-xs font-montserrat font-bold text-slate-900 truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-tabular mt-0.5">
                      {formatKes(item.unitPrice)} / {item.unitMode} ({item.totalBottles} btls)
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleUnitMode(idx)}
                      className="px-2 py-1 rounded bg-[#F0F2F0] hover:bg-[#FFDE00] border border-slate-200 text-[10px] font-montserrat font-black text-[#0A006E] cursor-pointer"
                      title="Switch between Bottle and Case"
                    >
                      {item.unitMode}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, -1)}
                      className="w-7 h-7 rounded bg-[#F0F2F0] hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-mono-tabular text-xs font-bold">
                      {item.quantityUnits}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(idx, 1)}
                      className="w-7 h-7 rounded bg-[#F0F2F0] hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Totals Box */}
          <div className="bg-slate-950 text-white border-2 border-[#0A006E] rounded-2xl p-4 space-y-1.5 font-mono-tabular text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Geo-Pricing Zone:</span>
              <span className="font-montserrat font-bold text-[#FFDE00]">{activeRegion?.name}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Subtotal:</span>
              <span>{formatKes(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Regional Excise & VAT ({(taxRate * 100).toFixed(0)}%):</span>
              <span>{formatKes(exciseAndTax)}</span>
            </div>
            <div className="flex justify-between text-lg font-montserrat font-black text-[#FFDE00] pt-2 border-t border-slate-800">
              <span>Total Charge:</span>
              <span>{formatKes(grandTotal)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="min-h-[44px] px-3.5 py-2.5 bg-white hover:bg-red-50 text-red-600 border border-slate-200 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" />
              Clear
            </button>
            <button
              type="button"
              disabled={cart.length === 0 || isProcessing}
              onClick={handleCompleteCheckout}
              className="flex-1 min-h-[44px] py-2.5 px-4 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              {isProcessing
                ? 'Issuing Document...'
                : `Commit & Print ${docTypeToIssue} (${formatKes(grandTotal)})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
