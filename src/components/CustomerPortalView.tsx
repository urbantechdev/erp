import React, { useState, useMemo } from 'react';
import {
  ShoppingBag,
  MapPin,
  CheckCircle2,
  ArrowLeft,
  Plus,
  Minus,
  ShieldCheck,
  FileText,
  Search,
  Wine,
} from 'lucide-react';
import {
  Product,
  Branch,
  GeoRegion,
  TransactionDoc,
  LineItem,
  StockCategory,
} from '../types';
import { calculateGeoPrice, formatKes, isProductAvailableForSale } from '../erpUtils';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../data/nairobiDrinksCatalog';
import { ProductImage } from './ProductImage';
import { AnimatedSuccessTickIcon } from './AnimatedFeedback';

interface CustomerPortalViewProps {
  products: Product[];
  branches: Branch[];
  regions: GeoRegion[];
  onPlaceOnlineOrder: (
    orderDraft: Omit<TransactionDoc, 'id' | 'createdAt'>
  ) => Promise<TransactionDoc | null>;
  onPreviewDoc: (doc: TransactionDoc) => void;
  onBackToErpLogin?: () => void;
  isStandalonePortal?: boolean;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  products,
  branches,
  regions,
  onPlaceOnlineOrder,
  onPreviewDoc,
  onBackToErpLogin,
  isStandalonePortal = false,
}) => {
  const [selectedRegionId, setSelectedRegionId] = useState<string>(regions[0]?.id || '');
  const activeRegion = useMemo(
    () => regions.find((r) => r.id === selectedRegionId) || regions[0],
    [regions, selectedRegionId]
  );

  const fulfillmentBranch = useMemo(
    () => branches.find((b) => b.regionId === activeRegion?.id) || branches[0],
    [branches, activeRegion]
  );

  const [orderType, setOrderType] = useState<'wholesale' | 'retail'>('retail');
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'ALL' | StockCategory>('ALL');
  const [selectedSubCat, setSelectedSubCat] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(36);

  const [buyerName, setBuyerName] = useState('');
  const [buyerLicenseOrId, setBuyerLicenseOrId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [ageVerified, setAgeVerified] = useState(true);
  const [cart, setCart] = useState<
    { product: Product; unitMode: 'Bottle' | 'Case'; quantityUnits: number }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<TransactionDoc | null>(null);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if (!isProductAvailableForSale(p)) return false;
      const matchStock = stockFilter === 'ALL' || p.category === stockFilter;
      const matchSub = selectedSubCat === 'ALL' || (p.subCategory || p.category) === selectedSubCat;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q);
      return matchStock && matchSub && matchQuery;
    });
  }, [products, stockFilter, selectedSubCat, searchQuery]);

  const handleAdd = (product: Product) => {
    const unitMode: 'Bottle' | 'Case' = orderType === 'wholesale' ? 'Case' : 'Bottle';
    setCart((prev) => {
      const found = prev.find((i) => i.product.id === product.id && i.unitMode === unitMode);
      if (found) {
        return prev.map((i) =>
          i.product.id === product.id && i.unitMode === unitMode
            ? { ...i, quantityUnits: i.quantityUnits + 1 }
            : i
        );
      }
      return [...prev, { product, unitMode, quantityUnits: 1 }];
    });
  };

  const handleQty = (idx: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item, i) =>
          i === idx ? { ...item, quantityUnits: Math.max(0, item.quantityUnits + delta) } : item
        )
        .filter((item) => item.quantityUnits > 0)
    );
  };

  const lineItems: LineItem[] = useMemo(() => {
    return cart.map((c) => {
      const packSize = c.product.packSize || c.product.bottlesPerCase || 12;
      const geo = calculateGeoPrice(c.product, activeRegion, orderType);
      const unitPrice = c.unitMode === 'Case' ? geo.casePrice : geo.unitBottlePrice;
      const totalBottles =
        c.unitMode === 'Case' ? c.quantityUnits * packSize : c.quantityUnits;
      return {
        productId: c.product.id,
        sku: c.product.sku,
        name: c.product.name,
        unitMode: c.unitMode,
        bottlesPerCase: packSize,
        quantityUnits: c.quantityUnits,
        totalBottles,
        unitPrice,
        lineTotal: Math.round(unitPrice * c.quantityUnits),
      };
    });
  }, [cart, activeRegion, orderType]);

  const subtotal = useMemo(
    () => lineItems.reduce((acc, l) => acc + l.lineTotal, 0),
    [lineItems]
  );
  const tax = Math.round(subtotal * (activeRegion?.regionalTaxRate ?? 0.16));
  const total = subtotal + tax;

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ageVerified || lineItems.length === 0 || !fulfillmentBranch || !activeRegion) return;
    setSubmitting(true);
    try {
      const docNumber = `ONL-${Date.now().toString().slice(-6)}`;
      const created = await onPlaceOnlineOrder({
        docNumber,
        docType: 'Online Order',
        channel: 'Customer Online Portal',
        branchId: fulfillmentBranch.id,
        branchName: fulfillmentBranch.name,
        regionId: activeRegion.id,
        regionName: activeRegion.name,
        customerName: `${buyerName.trim() || 'Online Buyer'} (${deliveryAddress.trim() || activeRegion.name})`,
        customerLicenseNo: buyerLicenseOrId.trim() || 'ONLINE-21-VERIFIED',
        itemsSummary: JSON.stringify(lineItems),
        subtotal,
        exciseAndTax: tax,
        totalAmount: total,
        paymentMethod: 'M-Pesa Express / Online Escrow',
        status: 'Approved',
        createdBy: buyerName.trim() || 'Customer Portal Buyer',
        createdByRole: 'Online Customer',
      });
      setCart([]);
      if (created) {
        setOrderSuccess(created);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {isStandalonePortal && (
        <header className="relative flex items-center justify-between gap-8 px-6 pt-6 pb-14 bg-[#0A006E] text-white overflow-hidden shadow-lg">
          <div className="silent-scanner-beam" />
          <div className="flex items-center gap-3.5 relative z-10 whitespace-nowrap shrink-0">
            <div className="w-13 h-13 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black border-2 border-white shadow-md">
              <Wine className="w-7 h-7" />
            </div>
            <span className="text-2xl sm:text-3xl lg:text-4xl font-montserrat font-black italic tracking-tighter">
              VAAIRO LIQUOR HUB · Online Ordering Portal
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-xs font-montserrat font-bold text-slate-200 relative z-10">
            <span>Direct Company Price ({products.length} SKUs)</span>
            <span>Real-Time Regional Excise Tariffs</span>
            <span>Instant Order Receipt</span>
          </div>
          {onBackToErpLogin && (
            <button
              onClick={onBackToErpLogin}
              className="px-4 py-2.5 bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 relative z-10 shadow-md"
            >
              <ArrowLeft className="w-4 h-4" />
              Staff ERP Sign-In
            </button>
          )}

          {/* Single Smooth Curved Wave Bottom Edge */}
          <svg
            className="absolute bottom-0 left-0 w-full h-10 sm:h-12 pointer-events-none block"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <path
              d="M0,25 C480,85 960,-15 1440,45 L1440,80 L0,80 Z"
              fill="#FFFFFF"
            />
            <path
              d="M0,25 C480,85 960,-15 1440,45"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
            />
          </svg>
        </header>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* VAAIRO Yellow Hero Banner */}
        <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
          <div className="silent-scanner-beam-dark" />
          <div className="relative z-10">
            <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
              Choose it, get it, Drink it · Direct Company Storefront
            </span>
            <h1 className="text-xl sm:text-2xl font-montserrat font-black italic text-[#0A006E] mt-1">
              Order Verified IPS & LPS Spirits, Wine & Beer with Geo-Location Pricing
            </h1>
            <p className="text-xs font-medium text-slate-900 mt-1">
              Select your delivery region below. Prices automatically adjust for Metro Core, Affluent Suburb Ring, or Lower Region zones and route to {fulfillmentBranch?.name}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            <div className="bg-[#0A006E] text-white border-2 border-[#0A006E] rounded-xl px-3.5 py-2">
              <label className="block text-[10px] font-montserrat font-black text-[#FFDE00] uppercase flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#FFDE00]" />
                Delivery Geo-Location Zone
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

            <div className="flex items-center gap-1 p-1 bg-white border-2 border-[#0A006E] rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setOrderType('retail');
                  setCart([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black transition-colors cursor-pointer ${
                  orderType === 'retail'
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Personal / Event (Bottles)
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderType('wholesale');
                  setCart([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-black transition-colors cursor-pointer ${
                  orderType === 'wholesale'
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                Licensed Retailer (Cases)
              </button>
            </div>
          </div>
        </div>

        {orderSuccess && (
          <div className="bg-emerald-50 border-2 border-[#34D186] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-success-pop shadow-lg">
            <div className="flex items-center gap-3.5">
              <AnimatedSuccessTickIcon size="md" />
              <div>
                <h3 className="text-sm font-montserrat font-black text-emerald-950">
                  Online Order {orderSuccess.docNumber} Confirmed & Logged!
                </h3>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Routed to {orderSuccess.branchName} for excise verification and dispatch.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPreviewDoc(orderSuccess)}
              className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4" />
              Print / Download Order Confirmation PDF
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Catalog + Category Bar */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleCount(36);
                    }}
                    placeholder={`Search ${products.length} drinks by brand, name or SKU...`}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
                  {(['ALL', 'IPS', 'LPS'] as const).map((sc) => (
                    <button
                      key={sc}
                      type="button"
                      onClick={() => {
                        setStockFilter(sc);
                        setVisibleCount(36);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-montserrat font-black cursor-pointer ${
                        stockFilter === sc ? 'bg-[#0A006E] text-[#FFDE00]' : 'text-slate-600'
                      }`}
                    >
                      {sc}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSubCat('ALL');
                    setVisibleCount(36);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedSubCat === 'ALL'
                      ? 'bg-[#0A006E] text-[#FFDE00]'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  All ({filteredProducts.length})
                </button>
                {NAIROBI_DRINKS_SUB_CATEGORIES.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => {
                      setSelectedSubCat(sub);
                      setVisibleCount(36);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedSubCat === sub
                        ? 'bg-[#0A006E] text-[#FFDE00]'
                        : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredProducts.slice(0, visibleCount).map((product) => {
                const packSize = product.packSize || product.bottlesPerCase || 12;
                const abv = product.alcoholPercentage ?? product.abv ?? 40;
                const geo = calculateGeoPrice(product, activeRegion, orderType);
                return (
                  <div
                    key={product.id}
                    className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4 flex flex-col justify-between"
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
                        <div className="flex items-center justify-between text-[10px] font-mono-tabular text-slate-500">
                          <span className="font-bold text-[#0A006E] truncate">{product.sku}</span>
                          <span className="font-bold text-[#1E9E60]">{product.subCategory}</span>
                        </div>
                        <h3 className="text-sm font-montserrat font-bold text-[#0A006E] mt-1">
                          {product.name}
                        </h3>
                        <p className="text-[11px] text-slate-600 mt-1">
                          {product.countryOfOrigin || product.originCountry} · {abv}% ABV
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                      <div className="font-mono-tabular">
                        <div className="text-[10px] text-slate-500">
                          {orderType === 'wholesale'
                            ? `Case of ${packSize} Btls`
                            : 'Single Bottle Price'}
                        </div>
                        <div className="text-sm font-montserrat font-black text-[#0A006E]">
                          {orderType === 'wholesale'
                            ? formatKes(geo.casePrice)
                            : formatKes(geo.unitBottlePrice)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAdd(product)}
                        className="min-h-[40px] px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        Add {orderType === 'wholesale' ? 'Case' : 'Bottle'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length > visibleCount && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 48)}
                  className="px-5 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer"
                >
                  Load More Drinks ({filteredProducts.length - visibleCount} more)
                </button>
              </div>
            )}
          </div>

          {/* Checkout Form */}
          <form
            onSubmit={handleSubmitOrder}
            className="lg:col-span-4 bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4 sticky top-6"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#0A006E]" />
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Online Order Summary
                </h3>
              </div>
              <span className="text-xs font-mono-tabular font-bold text-[#0A006E]">
                {lineItems.length} item(s)
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-montserrat font-bold text-slate-700">
                  Buyer / Licensed Establishment Name *
                </label>
                <input
                  required
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Kilimani Lounge Ltd"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat font-bold text-slate-700">
                  Liquor License No. or National Age ID *
                </label>
                <input
                  required
                  type="text"
                  value={buyerLicenseOrId}
                  onChange={(e) => setBuyerLicenseOrId(e.target.value)}
                  placeholder="e.g. LIQ-RET-2026-991"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono-tabular text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-montserrat font-bold text-slate-700">
                  Delivery Street & Suburb/Town *
                </label>
                <input
                  required
                  type="text"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Argwings Kodhek Rd, Kilimani"
                  className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {lineItems.map((item, idx) => (
                <div
                  key={item.productId}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-montserrat font-bold text-slate-900 truncate">
                      {item.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-tabular">
                      {formatKes(item.unitPrice)} × {item.quantityUnits} {item.unitMode}(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQty(idx, -1)}
                      className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono-tabular font-bold">{item.quantityUnits}</span>
                    <button
                      type="button"
                      onClick={() => handleQty(idx, 1)}
                      className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-950 text-white border-2 border-[#0A006E] rounded-2xl p-3.5 space-y-1 font-mono-tabular text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Fulfillment Depot:</span>
                <span className="font-montserrat font-bold text-[#FFDE00]">
                  {fulfillmentBranch?.code}
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Subtotal:</span>
                <span>{formatKes(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Regional Excise & VAT:</span>
                <span>{formatKes(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-montserrat font-black text-[#FFDE00] pt-1.5 border-t border-slate-800">
                <span>Order Total:</span>
                <span>{formatKes(total)}</span>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={ageVerified}
                onChange={(e) => setAgeVerified(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I confirm the recipient is legally 21+ years of age or holds an active retail liquor permit.
              </span>
            </label>

            <button
              type="submit"
              disabled={lineItems.length === 0 || !ageVerified || submitting}
              className="w-full min-h-[46px] py-2.5 px-4 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <ShieldCheck className="w-4 h-4" />
              {submitting ? 'Submitting Online Order...' : `Submit Online Order (${formatKes(total)})`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
