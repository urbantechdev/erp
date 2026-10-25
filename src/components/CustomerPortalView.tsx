import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Search,
  ArrowLeft,
  X,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  Truck,
  ShieldCheck,
  Wine,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  Receipt,
  Store,
  Eye,
  Layers,
  Menu,
  ScanLine,
  Camera,
  Barcode,
  Zap,
} from 'lucide-react';
import { Product, Branch, GeoRegion, TransactionDoc, StaffMember } from '../types';
import { ProductImage } from './ProductImage';
import { formatKes, generateSimpleQrSvg } from '../erpUtils';
import { playPosBeep } from '../utils/audioBeep';
import { db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

interface CustomerPortalViewProps {
  products: Product[];
  branches: Branch[];
  regions?: GeoRegion[];
  onPlaceOnlineOrder: (draft: any) => Promise<TransactionDoc | null | void> | void;
  onPreviewDoc: (d: any) => void;
  onBackToErpLogin: () => void;
  currentUser?: StaffMember | null;
}

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
}

const CATEGORIES = [
  'ALL',
  'Whisky',
  'Cognac & Brandy',
  'Gin',
  'Vodka',
  'Rum',
  'Tequila',
  'Wine & Champagne',
  'Beer & Cider',
  'LPS',
];

// Helper to strip volume from product name for matching variant sizes
export function cleanBaseProductName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\((?:750\s*ml|1000\s*ml|1\s*litre|1\s*l|375\s*ml|350\s*ml|250\s*ml|500\s*ml|330\s*ml|1\.5\s*l|1\.75\s*l|4\.5\s*l)\)/gi, '')
    .replace(/\s*-\s*(?:750\s*ml|1000\s*ml|1\s*litre|1\s*l|375\s*ml|350\s*ml|250\s*ml|500\s*ml|330\s*ml)/gi, '')
    .replace(/\s+(?:750\s*ml|1000\s*ml|1\s*litre|1\s*l|375\s*ml|350\s*ml|250\s*ml|500\s*ml|330\s*ml)$/gi, '')
    .trim();
}

// Friendly nickname for commercial liquor bottle sizes
export function getVolumeNickname(ml: number): string {
  if (ml <= 275) return 'Quarter / Pocket';
  if (ml <= 400) return 'Half Bottle / Pint';
  if (ml <= 760) return 'Standard Bottle';
  if (ml <= 1100) return '1 Litre Master';
  if (ml <= 1750) return 'Magnum';
  return `${ml}ml`;
}

// Ultra-fast memory cache for computed product variants
const variantResolutionCache = new Map<string, Product[]>();

// Find all available ml variants for a selected product (catalog siblings + authentic standard sizes)
export function getProductVariants(target: Product, allProducts: Product[]): Product[] {
  if (!target) return [];
  if (variantResolutionCache.has(target.id)) {
    return variantResolutionCache.get(target.id)!;
  }

  const baseName = cleanBaseProductName(target.name).toLowerCase();
  const brand = (target.brand || '').toLowerCase().trim();

  // Narrow search candidate pool to identical brand/subcategory to turn O(N) into ~5 items
  const candidatePool = brand
    ? allProducts.filter((p) => (p.brand || '').toLowerCase().trim() === brand)
    : allProducts.filter((p) => p.subCategory === target.subCategory);

  const pool = candidatePool.length > 0 ? candidatePool : allProducts;

  // Find all sibling products in catalog matching this brand and base name
  const catalogSiblings = pool.filter((p) => {
    if (p.status === ('Deleted' as any)) return false;
    const pBase = cleanBaseProductName(p.name).toLowerCase();
    const pBrand = (p.brand || '').toLowerCase().trim();

    if (p.id === target.id) return true;
    if (pBase && pBase === baseName) return true;
    if (brand && pBrand && brand === pBrand && (pBase.includes(baseName) || baseName.includes(pBase))) {
      return true;
    }
    return false;
  });

  const targetVol = target.volumeMl || 750;
  const targetPrice = target.retailPriceKes || target.baseRetailPrice || 3200;

  const subCat = (target.subCategory || target.category || '').toLowerCase();
  const isBeer = subCat.includes('beer') || subCat.includes('cider');
  const isWine = subCat.includes('wine') || subCat.includes('champagne');

  let standardVolumes: number[] = [250, 375, 750, 1000];
  if (isBeer) standardVolumes = [330, 500];
  else if (isWine) standardVolumes = [750, 1500];

  if (!standardVolumes.includes(targetVol)) {
    standardVolumes.push(targetVol);
  }
  standardVolumes.sort((a, b) => a - b);

  const cleanName = cleanBaseProductName(target.name);
  const variants: Product[] = [];

  for (const vol of standardVolumes) {
    // 1. Look for matching catalog item
    const existing = catalogSiblings.find((s) => Math.abs((s.volumeMl || 750) - vol) < 35);
    if (existing) {
      if (!variants.some((v) => v.id === existing.id)) {
        variants.push(existing);
      }
    } else {
      // 2. Synthesize authentic bottle size with proportional commercial pricing
      const ratio = vol / targetVol;
      const markup = ratio < 1 ? 1.08 : 0.96;
      const estPrice = Math.max(250, Math.round((targetPrice * ratio * markup) / 50) * 50);
      const volLabel = vol === 1000 ? '1 Litre' : `${vol}ml`;

      variants.push({
        ...target,
        id: `${target.id}-vol-${vol}`,
        sku: `${target.sku || 'SKU'}-${vol}ML`,
        name: `${cleanName} (${volLabel})`,
        volumeMl: vol,
        retailPriceKes: estPrice,
        baseRetailPrice: estPrice,
        wholesalePriceKes: Math.round(estPrice * 0.8),
      });
    }
  }

  // Ensure target itself is in variants
  if (!variants.some((v) => v.id === target.id)) {
    variants.push(target);
  }

  const result = variants.sort((a, b) => (a.volumeMl || 0) - (b.volumeMl || 0));
  variantResolutionCache.set(target.id, result);
  return result;
}

// Helper to ensure compatibility with ProductImage
const toImageProduct = (p: Product) => ({
  ...p,
  category: (p.category === 'LPS' ? 'LPS' : 'IPS') as any,
});

interface PortalProductCardProps {
  prod: Product;
  inCartQty: number;
  onPreview: (prod: Product) => void;
  onQuickAdd: (prod: Product) => void;
}

const PortalProductCard: React.FC<PortalProductCardProps> = React.memo(
  ({ prod, inCartQty, onPreview, onQuickAdd }) => {
    const price = prod.retailPriceKes || prod.baseRetailPrice || 3200;
    return (
      <div
        onClick={() => onPreview(prod)}
        className={`bg-white rounded-2xl border-2 transition-all duration-150 overflow-hidden flex flex-col group cursor-pointer hover:shadow-lg active:scale-98 select-none relative touch-manipulation ${
          inCartQty > 0
            ? 'border-[#0A006E] shadow-sm ring-2 ring-[#FFDE00]/50'
            : 'border-slate-200 hover:border-[#0A006E]'
        }`}
      >
        {/* Thumbnail */}
        <div className="relative aspect-square w-full bg-slate-50 p-2 overflow-hidden flex items-center justify-center">
          <ProductImage
            product={prod as any}
            size="full"
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
          />
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 text-white text-[9px] font-black">
            {prod.volumeMl || 750}ml
          </span>
          {prod.alcoholPercentage && (
            <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-[#0A006E] text-[#FFDE00] text-[9px] font-black">
              {prod.alcoholPercentage}%
            </span>
          )}
          {inCartQty > 0 && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] border border-[#FFDE00] text-[10px] font-black shadow-md animate-in zoom-in-50">
              x{inCartQty} in Ticket
            </span>
          )}
        </div>

        {/* Product Details */}
        <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider line-clamp-1">
              {prod.brand || prod.subCategory}
            </div>
            <h4
              className="text-xs font-bold text-slate-900 line-clamp-2 group-hover:text-[#0A006E]"
              title={prod.name}
            >
              {prod.name}
            </h4>
            <div className="pt-1 flex items-center gap-1 text-[10px] text-[#0A006E] font-bold">
              <Eye className="w-3 h-3 text-[#0A006E]" />
              <span>Tap for other ml sizes</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase">Price</div>
              <div className="text-xs font-black text-[#0A006E] font-mono-tabular">
                {formatKes(price)}
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(prod);
              }}
              className="p-2 rounded-xl bg-[#FFDE00] hover:bg-amber-400 active:scale-90 text-[#0A006E] font-black text-xs transition-transform cursor-pointer shadow-xs touch-manipulation"
              title="Instant Add to Ticket"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.prod.id === next.prod.id &&
    prev.inCartQty === next.inCartQty &&
    prev.prod.retailPriceKes === next.prod.retailPriceKes &&
    prev.prod.name === next.prod.name &&
    prev.prod.image === next.prod.image
);

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  products,
  branches,
  onPlaceOnlineOrder,
  onPreviewDoc,
  onBackToErpLogin,
  currentUser,
}) => {
  // Catalog Search & Category Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || '');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isMobileCategorySheetOpen, setIsMobileCategorySheetOpen] = useState(false);
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState(false);
  const [scannerQuery, setScannerQuery] = useState('');
  const [scannedProductMatch, setScannedProductMatch] = useState<Product | null>(null);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleReviewSubmit = async () => {
    if (!previewProduct) return;
    if (rating === 0) {
      playPosBeep('error');
      setReviewFeedback({ type: 'error', message: 'Please select a star rating (1-5).' });
      return;
    }
    try {
      const consumerId = currentUser?.id || (customerPhone ? `cust-${customerPhone.replace(/\D/g, '')}` : 'guest-consumer');
      const raterName = currentUser?.name || customerName || 'Verified Consumer';

      await addDoc(collection(db, 'product_ratings'), {
        productId: previewProduct.id,
        consumerId,
        raterName,
        stars: rating,
        comment: reviewComment,
        isVerifiedBuyer: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      playPosBeep('success');
      setRating(0);
      setReviewComment('');
      setReviewFeedback({ type: 'success', message: 'Thank you! Your rating has been transmitted to admin.' });
      setTimeout(() => setReviewFeedback(null), 4000);
    } catch (e) {
      console.error('Error submitting review:', e);
      playPosBeep('error');
      setReviewFeedback({ type: 'error', message: 'Failed to submit review. Please try again.' });
      setTimeout(() => setReviewFeedback(null), 4000);
    }
  };

  // Cart & Checkout State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastPlacedOrder, setLastPlacedOrder] = useState<TransactionDoc | null>(null);

  // Customer Delivery Info
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'M-Pesa STK' | 'Cash'>('M-Pesa STK');
  const [orderNotes, setOrderNotes] = useState('');

  // Quick Product Details & Variant Modal
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [activeVariant, setActiveVariant] = useState<Product | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState<number>(1);

  const openProductPreview = useCallback((prod: Product) => {
    setPreviewProduct(prod);
    setActiveVariant(prod);
    setPreviewQuantity(1);
  }, []);

  const availableVariants = useMemo(() => {
    if (!previewProduct) return [];
    return getProductVariants(previewProduct, products);
  }, [previewProduct, products]);

  // Active Branch
  const activeBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0] || {
      id: 'br-hq',
      name: 'Nairobi Central Depôt',
      code: 'NRB-HQ',
    };
  }, [branches, selectedBranchId]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (prod.status === ('Deleted' as any)) return false;

      // Category check
      if (selectedCategory !== 'ALL') {
        if (selectedCategory === 'LPS') {
          if (prod.category !== 'LPS') return false;
        } else {
          const sub = (prod.subCategory || '').toLowerCase();
          const target = selectedCategory.toLowerCase();
          if (!sub.includes(target) && !(prod.category || '').toLowerCase().includes(target)) {
            return false;
          }
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (prod.name || '').toLowerCase();
        const brand = (prod.brand || '').toLowerCase();
        const sku = (prod.sku || '').toLowerCase();
        const barcode = (prod.barcode || '').toLowerCase();
        if (!name.includes(q) && !brand.includes(q) && !sku.includes(q) && !barcode.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [products, selectedCategory, searchQuery]);

  // Progressive batching for instantaneous 60fps catalog navigation
  const [visibleLimit, setVisibleLimit] = useState(36);

  useEffect(() => {
    setVisibleLimit(36);
  }, [searchQuery, selectedCategory]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleLimit);
  }, [filteredProducts, visibleLimit]);

  // Fast O(1) quantity map to eliminate O(N*M) lookup latency across thousands of products
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  }, [cart]);

  // Cart Calculations
  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  }, [cart]);

  const deliveryFee = cartSubtotal >= 10000 || cartSubtotal === 0 ? 0 : 350;
  const cartTotal = cartSubtotal + deliveryFee;

  // Add to Cart
  const handleAddToCart = useCallback((product: Product, quantity = 1) => {
    const unitPrice = product.retailPriceKes || product.baseRetailPrice || 3200;
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product.id === product.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += quantity;
        return updated;
      }
      return [...prev, { product, quantity, unitPrice }];
    });
    playPosBeep('success');
  }, []);

  // Modify Cart Qty
  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Checkout submission
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      alert('Please provide your name and phone number for delivery dispatch.');
      return;
    }

    setIsSubmitting(true);
    const docNumber = `WEB-2026-${Date.now().toString().slice(-6)}`;

    const txDraft: Omit<TransactionDoc, 'id' | 'createdAt'> = {
      docNumber,
      docType: 'Online Order',
      channel: 'Customer Online Portal',
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      regionId: (activeBranch as any).regionId || 'reg-metro-core',
      regionName: (activeBranch as any).regionName || 'Nairobi Metro Core',
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      customerLicenseNo: 'RETAIL-CONSUMER',
      subtotal: cartSubtotal,
      exciseAndTax: Math.round(cartSubtotal * 0.16),
      totalAmount: cartTotal,
      paymentMethod,
      status: 'Issued',
      itemsSummary: JSON.stringify(
        cart.map((i) => ({
          productId: i.product.id,
          sku: i.product.sku,
          name: i.product.name,
          quantityUnits: i.quantity,
          totalBottles: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.quantity * i.unitPrice,
          bottlesPerCase: i.product.bottlesPerCase || 12,
          unitMode: 'Bottle',
        }))
      ),
      createdBy: 'Customer Storefront',
      createdByRole: 'Online Customer',
    };

    try {
      const created = await onPlaceOnlineOrder(txDraft);
      const fullDoc: TransactionDoc = (created as TransactionDoc) || {
        ...txDraft,
        id: `tx-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      setLastPlacedOrder(fullDoc);
      setCart([]);
      setIsCartOpen(false);
      playPosBeep('success');
    } catch (err) {
      console.error('Failed to submit online order:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-montserrat text-slate-800 pb-36 md:pb-24">
      {/* Main Store Header: VAAIRO Signature Deep Navy Header (2x Height) with Curved Single-Wave Bottom Edge */}
      <header className="sticky top-0 z-30 pt-5 pb-12 px-4 sm:px-6 bg-[#0A006E] text-white flex flex-col relative overflow-hidden shadow-lg">
        {/* Animated silent scanner sweep across header */}
        <div className="silent-scanner-beam" />

        <div className="w-full flex items-center justify-between gap-4 sm:gap-6 relative z-10">
          {/* Zone 1: Logo & Store Brand */}
          <div className="flex items-center gap-3 sm:gap-3.5 relative z-10 whitespace-nowrap shrink-0 group">
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white text-[#0A006E] flex items-center justify-center shadow-md border-2 border-white group-hover:scale-105 transition-transform duration-200">
              <Wine className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-montserrat font-black italic text-2xl sm:text-3xl lg:text-4xl tracking-tighter text-white">
                VAAIRO{' '}
                <span className="bg-[#FFDE00] text-[#0A006E] not-italic text-xs sm:text-sm font-black px-2.5 py-0.5 rounded-xl ml-1.5 align-middle shadow-xs">
                  STORE
                </span>
              </span>
            </div>
          </div>

          {/* Zone 2: Centered Search Bar (Desktop) */}
          <div className="hidden md:flex flex-1 max-w-lg mx-6 relative z-10">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="customer-portal-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spirits, brand, volume or SKU..."
              className="w-full pl-9 pr-8 py-2.5 bg-white text-slate-900 border-2 border-white rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFDE00] shadow-md transition placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Zone 3: Header Right Action Icons (Matching ERP White Background Style) */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 shrink-0 relative z-10">
            {/* Branch selector if multiple branches */}
            {branches.length > 1 && (
              <div className="hidden lg:flex items-center">
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="h-11 sm:h-12 text-xs font-bold text-[#0A006E] bg-white border-2 border-white rounded-2xl px-3 cursor-pointer shadow-md focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cart Button (Hidden on Mobile home page / Header as requested) */}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className="hidden sm:flex w-11 h-11 sm:w-12 sm:h-12 rounded-2xl items-center justify-center border-2 border-white transition-all cursor-pointer shadow-md relative group bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 active:scale-95"
              title={`Direct Checkout Box (${cartItemCount} items)`}
              aria-label="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0A006E] text-[#FFDE00] border-2 border-white text-[10px] font-black flex items-center justify-center shadow-md">
                  {cartItemCount}
                </span>
              )}
              <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                Cart ({cartItemCount})
              </span>
            </button>

            {/* Back to ERP / Back to Login button */}
            <button
              type="button"
              onClick={onBackToErpLogin}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 border-white transition-all cursor-pointer shadow-md relative group bg-white text-[#0A006E] hover:bg-slate-100 active:scale-95"
              title="Return to ERP Backoffice"
              aria-label="Return to ERP"
            >
              <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
              <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
                Back to ERP
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Search Row inside Header */}
        <div className="md:hidden w-full pt-3 relative z-10">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="customer-portal-mobile-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search spirits, brand, volume or SKU..."
              className="w-full pl-9 pr-8 py-2 bg-white text-slate-900 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFDE00] shadow-md placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Single Smooth Curved Wave Bottom Edge with Gold Stroke */}
        <svg
          className="absolute bottom-0 left-0 w-full h-9 sm:h-11 pointer-events-none block"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,25 C480,85 960,-15 1440,45 L1440,80 L0,80 Z"
            fill="#F8FAFC"
          />
          <path
            d="M0,25 C480,85 960,-15 1440,45"
            fill="none"
            stroke="#FFDE00"
            strokeWidth="5"
          />
        </svg>
      </header>

      {/* Category Sub-Menu Aligned at the Center */}
      <nav aria-label="Product categories" className="w-full py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none py-1">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shadow-xs active:scale-95 ${
                  isActive
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-md font-black ring-2 ring-[#FFDE00]'
                    : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-[#0A006E] border border-slate-200'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area: High-Performance POS Layout with Right-Side Checkout Box */}
      <main className="max-w-[1680px] mx-auto w-full px-3 sm:px-6 py-4 flex-1 flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Product Catalog Grid */}
        <section className="flex-1 w-full min-w-0 flex flex-col space-y-3">
          {/* Catalog Status Bar */}
          <div className="flex items-center justify-between pb-1 border-b border-slate-200 text-xs">
            <div>
              <span className="font-montserrat font-black text-slate-900 text-sm sm:text-base">
                {selectedCategory === 'ALL' ? 'All Catalog Spirits' : selectedCategory}
              </span>
              <span className="text-slate-500 font-medium ml-2">
                ({filteredProducts.length} {filteredProducts.length === 1 ? 'bottle' : 'bottles'} available)
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Fulfillment: <span className="font-bold text-[#0A006E]">{activeBranch.name}</span>
            </div>
          </div>

          {/* Products Grid */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
              <Store className="w-12 h-12 text-slate-400 mx-auto" />
              <h4 className="font-black text-slate-700">No products found</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No items match your active search or category. Try clearing filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                }}
                className="px-4 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-bold"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5 sm:gap-3">
              {visibleProducts.map((prod) => (
                <PortalProductCard
                  key={prod.id}
                  prod={prod}
                  inCartQty={cartQtyMap.get(prod.id) || 0}
                  onPreview={openProductPreview}
                  onQuickAdd={handleAddToCart}
                />
              ))}

              {visibleProducts.length < filteredProducts.length && (
                <div className="col-span-full pt-6 pb-2 flex flex-col items-center justify-center space-y-2">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((v) => v + 36)}
                    className="px-6 py-3 rounded-2xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-black text-xs font-montserrat shadow-md transition cursor-pointer flex items-center gap-2 active:scale-95"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Load More Spirits ({filteredProducts.length - visibleProducts.length} more)
                  </button>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Showing {visibleProducts.length} of {filteredProducts.length} bottles
                  </span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: POS Register Checkout Box */}
        <aside
          id="pos-checkout-box"
          className="w-full lg:w-[380px] xl:w-[420px] shrink-0 lg:sticky lg:top-4 self-start bg-white rounded-3xl border-2 border-[#0A006E] shadow-xl overflow-hidden flex flex-col"
        >
          {/* Checkout Box Header */}
          <div className="p-4 bg-[#0A006E] text-white flex items-center justify-between border-b-2 border-[#FFDE00]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white text-[#0A006E] flex items-center justify-center font-black shadow-xs">
                <Receipt className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-montserrat font-black text-sm text-white">POS Checkout Box</h3>
                <p className="text-[10px] text-white/80 font-medium">Customer Order Ticket</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-[#FFDE00] text-[#0A006E] text-xs font-black">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
              </span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Clear Ticket"
                >
                  <Trash2 className="w-4 h-4 text-rose-300 hover:text-rose-100" />
                </button>
              )}
            </div>
          </div>

          {/* Cart Items List */}
          <div className="p-3.5 max-h-[250px] overflow-y-auto divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Your order ticket is empty</p>
                <p className="text-[11px] text-slate-400 max-w-[240px] mx-auto">
                  Tap any bottle on the left to add it directly to this checkout ticket.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2.5"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 p-1 flex items-center justify-center">
                      <ProductImage
                        product={toImageProduct(item.product)}
                        size="full"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-bold text-slate-900 truncate">{item.product.name}</h5>
                      <div className="text-[11px] font-black text-[#0A006E] font-mono-tabular">
                        {formatKes(item.unitPrice)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.product.id, -1)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-100 font-bold"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black min-w-[18px] text-center font-mono-tabular">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.product.id, 1)}
                        className="w-6 h-6 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer hover:bg-slate-100 font-bold"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="w-6 h-6 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer ml-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delivery & Customer Details Form */}
          <form
            id="checkout-form"
            onSubmit={handlePlaceOrder}
            className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#0A006E]" /> Delivery &amp; Customer Details
              </h4>
              <span className="text-[10px] text-slate-500 font-bold">{activeBranch.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A006E]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phone / M-Pesa *</label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A006E]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Delivery Address / Landmark</label>
              <input
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="e.g. Westlands, Rhapta Road, Apt 4B"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A006E]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('M-Pesa STK')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                    paymentMethod === 'M-Pesa STK'
                      ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  M-Pesa STK
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Cash')}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                    paymentMethod === 'Cash'
                      ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                >
                  Cash on Delivery
                </button>
              </div>
            </div>
          </form>

          {/* Pricing Summary & Checkout Button */}
          <div className="p-4 bg-white border-t border-slate-200 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono-tabular font-bold">{formatKes(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>VAT (16% Included)</span>
                <span className="font-mono-tabular font-bold">{formatKes(Math.round(cartSubtotal * 0.16))}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Fee</span>
                <span className="font-mono-tabular font-bold">
                  {deliveryFee === 0 ? (
                    <span className="text-emerald-600 font-black">FREE</span>
                  ) : (
                    formatKes(deliveryFee)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                <span>Total Due</span>
                <span className="font-mono-tabular text-base text-[#0A006E]">{formatKes(cartTotal)}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-3.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl font-black text-xs font-montserrat shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
            >
              {isSubmitting ? (
                'Processing Order...'
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Place Delivery Order ({formatKes(cartTotal)})
                </>
              )}
            </button>
          </div>
        </aside>
      </main>



      {/* Order Placed Success Modal */}
      {lastPlacedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-[#0A006E] max-w-md w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Order Received
              </span>
              <h3 className="font-black text-lg text-[#0A006E] mt-1">
                Thank You, {lastPlacedOrder.customerName}!
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Your order <span className="font-bold text-slate-900 font-mono-tabular">{lastPlacedOrder.docNumber}</span> has been dispatched to our {lastPlacedOrder.branchName} packing depot.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-black text-[#0A006E] font-mono-tabular">{formatKes(lastPlacedOrder.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="font-bold text-slate-800">{lastPlacedOrder.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Order Ref:</span>
                <span className="font-mono text-[10px] text-slate-600 font-bold">{lastPlacedOrder.docNumber}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onPreviewDoc(lastPlacedOrder);
                }}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-[#0A006E] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" /> View Receipt
              </button>
              <button
                type="button"
                onClick={() => setLastPlacedOrder(null)}
                className="flex-1 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-black cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Details & Available Volume Sizes (ML) Full-Screen Modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 bg-white sm:bg-black/60 sm:backdrop-blur-xs flex flex-col sm:items-center sm:justify-center sm:p-4 overflow-y-auto">
          <div className="w-full h-full sm:h-auto sm:max-w-2xl bg-white sm:rounded-3xl sm:border-2 sm:border-[#0A006E] p-5 sm:p-6 space-y-5 shadow-2xl relative my-auto animate-in zoom-in-95 duration-200 flex flex-col justify-between sm:justify-start min-h-screen sm:min-h-0">
            {/* Modal Close Button */}
            <button
              type="button"
              onClick={() => {
                setPreviewProduct(null);
                setActiveVariant(null);
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer z-10"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Active Bottle Showcase Header */}
            <div className="flex flex-col gap-0 items-center sm:items-start pt-0">
              <div className="w-full h-64 sm:w-36 sm:h-36 sm:rounded-2xl bg-slate-50 p-6 sm:p-2 shrink-0 flex items-center justify-center relative sm:border sm:border-slate-200">
                <ProductImage
                  product={toImageProduct(activeVariant || previewProduct)}
                  size="full"
                  className="w-full h-full object-contain"
                />
                <span className="absolute bottom-4 left-4 sm:bottom-2 sm:left-2 px-3 py-1 sm:px-2 sm:py-0.5 rounded-md bg-[#0A006E] text-[#FFDE00] text-xs sm:text-[9px] font-black">
                  {(activeVariant || previewProduct).volumeMl || 750}ml
                </span>
              </div>
              <div className="w-full px-5 pt-5 pb-2 sm:px-0 sm:pt-0 sm:pb-0">
                <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
                  <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {(activeVariant || previewProduct).brand} · {(activeVariant || previewProduct).subCategory}
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> KRA Stamp Verified
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-black text-[#0A006E] leading-snug">
                  {(activeVariant || previewProduct).name}
                </h3>

                <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                  <span className="text-xl font-black text-[#0A006E] font-mono-tabular">
                    {formatKes(
                      (activeVariant || previewProduct).retailPriceKes ||
                      (activeVariant || previewProduct).baseRetailPrice ||
                      3200
                    )}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">per bottle</span>
                </div>

                <div className="flex items-center gap-3 pt-1 text-xs text-slate-600 justify-center sm:justify-start flex-wrap">
                  <span className="font-semibold">
                    Volume: <strong className="text-slate-900">{(activeVariant || previewProduct).volumeMl || 750}ml</strong>
                  </span>
                  <span>•</span>
                  <span className="font-semibold">
                    ABV: <strong className="text-slate-900">{(activeVariant || previewProduct).alcoholPercentage || (activeVariant || previewProduct).abv || 40}%</strong>
                  </span>
                  <span>•</span>
                  <span className="font-semibold">
                    Origin: <strong className="text-slate-900">{(activeVariant || previewProduct).originCountry || (activeVariant || previewProduct).countryOfOrigin || 'Imported'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Other ML & Available Volume Sizes Section */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#0A006E]" />
                  <span className="text-xs font-black uppercase tracking-wider text-[#0A006E]">
                    Available Bottle Volumes ({availableVariants.length} Sizes)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Tap to switch or quick-add
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {availableVariants.map((variant) => {
                  const isSelected = (activeVariant?.id || previewProduct.id) === variant.id;
                  const vPrice = variant.retailPriceKes || variant.baseRetailPrice || 3200;
                  const inCartVariant = cart.find((c) => c.product.id === variant.id);
                  const volMl = variant.volumeMl || 750;
                  const nickname = getVolumeNickname(volMl);

                  return (
                    <div
                      key={variant.id}
                      onClick={() => setActiveVariant(variant)}
                      className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                        isSelected
                          ? 'border-[#0A006E] bg-blue-50/70 shadow-sm ring-1 ring-[#0A006E]'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                            isSelected
                              ? 'bg-[#0A006E] text-[#FFDE00]'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {volMl >= 1000 ? `${(volMl / 1000).toFixed(0)}L` : `${volMl}`}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 truncate">
                              {volMl >= 1000 ? '1 Litre' : `${volMl}ml`}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium truncate">
                              ({nickname})
                            </span>
                          </div>
                          <div className="text-xs font-black text-[#0A006E] font-mono-tabular">
                            {formatKes(vPrice)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {inCartVariant && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#0A006E] text-[#FFDE00]">
                            x{inCartVariant.quantity}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(variant, 1);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] font-black text-[11px] transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                          title={`Add ${volMl}ml to order ticket`}
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" /> Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rate & Review Section */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-black uppercase text-[#0A006E] mb-2">Rate & Review</h4>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-2xl cursor-pointer hover:scale-110 transition"
                  >
                    {star <= rating ? '★' : '☆'}
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your thoughts about this product..."
                className="w-full p-2 border border-slate-200 rounded-xl text-xs mb-2"
                rows={2}
              />
              {reviewFeedback && (
                <div
                  className={`p-2 rounded-xl text-xs font-semibold mb-2 flex items-center gap-1.5 ${
                    reviewFeedback.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}
                >
                  <span>{reviewFeedback.message}</span>
                </div>
              )}
              <button
                type="button"
                onClick={handleReviewSubmit}
                className="w-full py-2 bg-[#0A006E] text-white rounded-xl text-xs font-bold hover:bg-[#070050] transition cursor-pointer"
              >
                Submit Review
              </button>
            </div>

            {/* Bonded Storage Note */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
              <Store className="w-4 h-4 text-[#0A006E] shrink-0" />
              <span>
                Fulfillment via <strong>{activeBranch.name}</strong> bonded warehouse. In-stock and ready for immediate dispatch.
              </span>
            </div>

            {/* Mobile Footer: Stepper + Primary Add Button */}
            <div className="sm:hidden sticky bottom-0 z-20 bg-white pt-4 pb-4 border-t border-slate-100 flex flex-col items-center gap-3">
              <div className="flex items-center bg-slate-100 border border-slate-300 rounded-2xl p-1 w-full justify-between">
                <button
                  type="button"
                  onClick={() => setPreviewQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-xl bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-40"
                  disabled={previewQuantity <= 1}
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="px-4 text-base font-black font-mono-tabular text-slate-900">
                  {previewQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewQuantity((q) => q + 1)}
                  className="w-10 h-10 rounded-xl bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-50 cursor-pointer shadow-xs"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const toAdd = activeVariant || previewProduct;
                  handleAddToCart(toAdd, previewQuantity);
                  setPreviewQuantity(1);
                }}
                className="w-full py-4 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl font-black text-xs font-montserrat shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                Add to Ticket ({formatKes(
                  ((activeVariant || previewProduct).retailPriceKes ||
                    (activeVariant || previewProduct).baseRetailPrice ||
                    3200) * previewQuantity
                )})
              </button>
            </div>

            {/* Desktop / Standard Content Layout */}
            <div className="hidden sm:flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 border border-slate-300 rounded-2xl p-1 shrink-0 w-auto justify-between">
                  <button
                    type="button"
                    onClick={() => setPreviewQuantity((q) => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-xl bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-50 cursor-pointer shadow-xs disabled:opacity-40"
                    disabled={previewQuantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 text-sm font-black font-mono-tabular text-slate-900">
                    {previewQuantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewQuantity((q) => q + 1)}
                    className="w-9 h-9 rounded-xl bg-white text-slate-700 flex items-center justify-center font-bold hover:bg-slate-50 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const toAdd = activeVariant || previewProduct;
                    handleAddToCart(toAdd, previewQuantity);
                    setPreviewQuantity(1);
                  }}
                  className="flex-1 w-full py-3.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl font-black text-xs font-montserrat shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  Add {(activeVariant || previewProduct).volumeMl || 750}ml ({formatKes(
                    ((activeVariant || previewProduct).retailPriceKes ||
                      (activeVariant || previewProduct).baseRetailPrice ||
                      3200) * previewQuantity
                  )})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Constant Bottom Navigation Bar (Stays Locked in Place on Top, Zero Movement on Scroll) */}
      <nav
        aria-label="Customer Portal Bottom Navigation"
        style={{ transform: 'translate3d(0, 0, 0)', WebkitTransform: 'translate3d(0, 0, 0)' }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#0A006E] text-white border-t-2 border-[#FFDE00] shadow-[0_-10px_35px_rgba(10,0,110,0.45)] px-2 sm:px-6 pt-1.5 sm:pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] select-none touch-manipulation overflow-visible"
      >
        {/* Single Curved Wave Top Edge with Gold Stroke */}
        <div className="absolute left-0 right-0 -top-7 sm:-top-9 w-full leading-none pointer-events-none z-10">
          <svg
            viewBox="0 0 1200 70"
            preserveAspectRatio="none"
            className="w-full h-7 sm:h-9 block"
          >
            <path d="M0,71 L1200,71 L1200,54 C760,2 340,68 0,22 Z" fill="#0A006E" />
            <path
              d="M0,22 C340,68 760,2 1200,54"
              fill="none"
              stroke="#FFDE00"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* 1. Desktop View (md+) */}
        <div className="hidden md:flex max-w-7xl mx-auto items-center justify-between gap-2 sm:gap-4 relative z-20">
          {/* Section 1: Depot Fulfillment Indicator */}
          <div className="hidden lg:flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-[#FFDE00]/40 text-[#FFDE00] flex items-center justify-center shadow-xs">
              <Wine className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="text-left">
              <div className="text-[9px] font-black uppercase tracking-wider text-[#FFDE00] flex items-center gap-1.5 leading-none">
                <span>VAAIRO Storefront</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-xs font-bold text-white/90 truncate max-w-[180px]">
                {activeBranch.name}
              </div>
            </div>
          </div>

          {/* Section 2: Quick Category Pills & Search */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('ALL');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#FFDE00] text-[#0A006E] font-black shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>All Spirits</span>
            </button>

            {['Whisky', 'Gin', 'Vodka', 'Wine & Champagne', 'Beer & Cider'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`hidden md:flex px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-[#FFDE00] text-[#0A006E] font-black shadow-xs'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <span>{cat}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                const input =
                  document.getElementById('customer-portal-search-input') ||
                  document.getElementById('customer-portal-mobile-search-input');
                if (input) {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  (input as HTMLInputElement).focus();
                }
              }}
              className="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5 text-[#FFDE00]" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>

          {/* Section 3: Cart / Checkout Ticket & Return to ERP */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Live Checkout Ticket Button */}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(true)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-montserrat font-black text-xs transition cursor-pointer shadow-md active:scale-95 ${
                cart.length > 0
                  ? 'bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 border border-white/30'
                  : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/15 border border-white/15'
              }`}
            >
              <div className="relative">
                <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 py-0.2 bg-[#0A006E] text-[#FFDE00] text-[9px] font-black rounded-full leading-tight">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="hidden sm:inline">Order Ticket</span>
              <span className="font-mono-tabular font-black">
                {cartTotal > 0 ? formatKes(cartTotal) : '0 items'}
              </span>
            </button>

            {/* Back to ERP Backoffice */}
            <button
              type="button"
              onClick={onBackToErpLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold transition cursor-pointer"
              title="Return to ERP Backoffice"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="hidden sm:inline">Exit to ERP</span>
            </button>
          </div>
        </div>

        {/* 2. Mobile Native App Sticky Tab Bar (< md) with Big Animated Center Scan Button */}
        <div className="md:hidden flex items-center justify-between gap-1 relative z-20 px-2 py-0.5">
          {/* Tab 1: Shop / Home */}
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('ALL');
              setIsMobileCartOpen(false);
              setIsMobileCategorySheetOpen(false);
              setIsMobileScannerOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer flex-1 ${
              selectedCategory === 'ALL' && !isMobileCartOpen && !isMobileCategorySheetOpen && !isMobileScannerOpen
                ? 'text-[#FFDE00] font-black'
                : 'text-white/75 hover:text-white'
            }`}
          >
            <Store className="w-5 h-5 stroke-[2.3]" />
            <span className="text-[10px] font-bold mt-0.5">Shop</span>
          </button>

          {/* Tab 2: Categories */}
          <button
            type="button"
            onClick={() => {
              setIsMobileCategorySheetOpen(true);
              setIsMobileCartOpen(false);
              setIsMobileScannerOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer flex-1 ${
              isMobileCategorySheetOpen || (selectedCategory !== 'ALL' && !isMobileCartOpen && !isMobileScannerOpen)
                ? 'text-[#FFDE00] font-black'
                : 'text-white/75 hover:text-white'
            }`}
          >
            <Layers className="w-5 h-5 stroke-[2.3]" />
            <span className="text-[10px] font-bold mt-0.5">Categories</span>
          </button>

          {/* Tab 3: BIG CENTER ANIMATED SEARCH BUTTON WITH YELLOW BACKGROUND & SCAN EFFECT */}
          <div className="relative flex-1 flex flex-col items-center justify-center -mt-8 z-50">
            <button
              type="button"
              onClick={() => {
                const input =
                  document.getElementById('customer-portal-mobile-search-input') ||
                  document.getElementById('customer-portal-search-input');
                if (input) {
                  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  (input as HTMLInputElement).focus();
                }
                playPosBeep('click');
              }}
              className="center-scan-btn relative w-15 h-15 rounded-full bg-[#FFDE00] border-[4px] border-[#0A006E] text-[#0A006E] flex items-center justify-center shadow-[0_10px_35px_rgba(255,222,0,0.6)] active:scale-90 transition-transform cursor-pointer group overflow-hidden z-50"
              title="Search Spirits Catalog"
              aria-label="Search Spirits Catalog"
            >
              {/* Moving Laser Scan Line Effect */}
              <div className="center-laser-line" />

              {/* Subtly animated glow gradient */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-amber-300/30 pointer-events-none" />

              {/* Pulse Search Icon */}
              <div className="relative z-10 flex items-center justify-center">
                <Search className="w-6 h-6 stroke-[2.8] text-[#0A006E] drop-shadow-[0_0_8px_rgba(10,0,110,0.5)] animate-pulse" />
              </div>
            </button>
            <span className="text-[9px] font-black tracking-wider uppercase text-[#FFDE00] mt-0.5 font-montserrat drop-shadow-sm z-50">
              SEARCH
            </span>
          </div>

          {/* Tab 4: Cart / Order Ticket */}
          <button
            type="button"
            onClick={() => {
              setIsMobileCartOpen(true);
              setIsMobileCategorySheetOpen(false);
              setIsMobileScannerOpen(false);
            }}
            className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer flex-1 relative ${
              isMobileCartOpen ? 'text-[#FFDE00] font-black' : 'text-white/75 hover:text-white'
            }`}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 stroke-[2.3]" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 bg-[#FFDE00] text-[#0A006E] text-[9px] font-black rounded-full leading-tight shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-0.5">
              {cartTotal > 0 ? formatKes(cartTotal) : 'Cart'}
            </span>
          </button>

          {/* Tab 5: Back to ERP Backoffice */}
          <button
            type="button"
            onClick={onBackToErpLogin}
            className="flex flex-col items-center justify-center py-1 px-1 rounded-xl transition cursor-pointer flex-1 text-white/75 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.3]" />
            <span className="text-[10px] font-bold mt-0.5">Back</span>
          </button>
        </div>
      </nav>

      {/* 1. Full-Screen Cart & Checkout Modal on Mobile */}
      {isMobileCartOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-white sm:bg-black/75 sm:backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full h-full sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-3xl flex flex-col overflow-hidden sm:border-2 sm:border-[#0A006E] sm:shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          >
            {/* Mobile Native App Header */}
            <div className="p-4 bg-[#0A006E] text-white flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMobileCartOpen(false)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
                  <Receipt className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm text-white">Order Checkout Ticket</h3>
                  <p className="text-[10px] text-slate-300 font-medium">
                    {cartItemCount} {cartItemCount === 1 ? 'bottle' : 'bottles'} · Fulfillment: {activeBranch.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
                aria-label="Close Checkout"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Cart Items & Form */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Item List */}
              {cart.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <ShoppingCart className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">Your ticket is empty</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Browse spirits and tap + to add bottles to your delivery order ticket.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsMobileCartOpen(false)}
                    className="px-5 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl font-black text-xs cursor-pointer shadow-md"
                  >
                    Browse Spirits Catalog
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-1">
                    <span className="font-montserrat font-black text-xs text-[#0A006E] uppercase tracking-wider">
                      Selected Bottles ({cartItemCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => setCart([])}
                      className="text-[11px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 p-1 flex items-center justify-center">
                        <ProductImage
                          product={toImageProduct(item.product)}
                          size="full"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h5 className="text-xs font-bold text-slate-900 truncate">{item.product.name}</h5>
                        <div className="text-xs font-black text-[#0A006E] font-mono-tabular">
                          {formatKes(item.unitPrice)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.product.id, -1)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer font-bold active:scale-90"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black min-w-[20px] text-center font-mono-tabular">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.product.id, 1)}
                          className="w-7 h-7 rounded-lg bg-white border border-slate-300 text-slate-700 flex items-center justify-center cursor-pointer font-bold active:scale-90"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(item.product.id)}
                          className="w-7 h-7 rounded-lg text-rose-500 hover:bg-rose-50 flex items-center justify-center cursor-pointer ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Delivery Details Form */}
              {cart.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-200">
                  <h4 className="text-xs font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#0A006E]" /> Delivery Information
                  </h4>

                  <div className="space-y-2.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="e.g. Victor Mutua"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A006E] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phone / M-Pesa Number *</label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="07XX XXX XXX"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A006E] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Delivery Address / Landmark *</label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="e.g. Westlands, Rhapta Road, Apt 4B"
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A006E] focus:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">Payment Method</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('M-Pesa STK')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                            paymentMethod === 'M-Pesa STK'
                              ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          M-Pesa STK
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('Cash')}
                          className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition cursor-pointer text-center ${
                            paymentMethod === 'Cash'
                              ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          Cash on Delivery
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-mono-tabular font-bold">{formatKes(cartSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>VAT (16% Included)</span>
                      <span className="font-mono-tabular font-bold">{formatKes(Math.round(cartSubtotal * 0.16))}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Delivery Fee</span>
                      <span className="font-mono-tabular font-bold">
                        {deliveryFee === 0 ? <span className="text-emerald-600 font-black">FREE</span> : formatKes(deliveryFee)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-200">
                      <span>Total Due</span>
                      <span className="font-mono-tabular text-base text-[#0A006E]">{formatKes(cartTotal)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Complete Button with Safe Area Inset */}
            {cart.length > 0 && (
              <div className="p-4 bg-white border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg">
                <button
                  type="button"
                  onClick={async (e) => {
                    await handlePlaceOrder(e as any);
                    setIsMobileCartOpen(false);
                  }}
                  disabled={isSubmitting || cart.length === 0}
                  className="w-full py-4 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl font-black text-xs font-montserrat shadow-md transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98"
                >
                  {isSubmitting ? (
                    'Processing Order...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" /> Complete Delivery Order ({formatKes(cartTotal)})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Full-Screen Category Picker on Mobile */}
      {isMobileCategorySheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-white flex flex-col w-full h-full overflow-hidden animate-in fade-in slide-in-from-bottom duration-200"
        >
          {/* Top Header */}
          <div className="p-4 bg-[#0A006E] text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMobileCategorySheetOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-montserrat font-black text-sm text-white">Spirits &amp; Beverage Categories</h3>
                <p className="text-[10px] text-slate-300">Tap category to filter storefront catalog</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileCategorySheetOpen(false)}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Filter Search inside Categories */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={categorySearchTerm}
                onChange={(e) => setCategorySearchTerm(e.target.value)}
                placeholder="Search spirits categories..."
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#0A006E]"
              />
            </div>
          </div>

          {/* Full Screen Scrollable Categories Grid */}
          <div className="p-4 overflow-y-auto flex-1 grid grid-cols-2 gap-3 pb-24">
            {CATEGORIES.filter(
              (cat) => !categorySearchTerm.trim() || cat.toLowerCase().includes(categorySearchTerm.toLowerCase().trim())
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setSelectedCategory(cat);
                  setIsMobileCategorySheetOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`p-4 rounded-2xl border-2 text-left font-montserrat font-bold text-xs transition cursor-pointer flex flex-col justify-between h-28 relative shadow-xs active:scale-98 ${
                  selectedCategory === cat
                    ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E] shadow-md ring-2 ring-[#FFDE00]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                    selectedCategory === cat ? 'bg-white/20 text-[#FFDE00]' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {cat === 'ALL' ? 'Catalog' : cat}
                  </span>
                  {selectedCategory === cat && <CheckCircle2 className="w-5 h-5 text-[#FFDE00]" />}
                </div>
                <div>
                  <h4 className="font-montserrat font-black text-sm">
                    {cat === 'ALL' ? 'All Spirits' : cat}
                  </h4>
                  <span className={`text-[10px] font-medium block mt-0.5 ${
                    selectedCategory === cat ? 'text-white/80' : 'text-slate-500'
                  }`}>
                    Tap to view products
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Full-Screen Mobile Barcode & Spirits Scanner Station */}
      {isMobileScannerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col w-full h-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="p-4 bg-[#0A006E] text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setIsMobileScannerOpen(false);
                  setScannedProductMatch(null);
                }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
                <ScanLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-montserrat font-black text-sm text-white">Spirits Barcode Scanner</h3>
                <p className="text-[10px] text-slate-300">Point at bottle barcode or quick lookup</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMobileScannerOpen(false);
                setScannedProductMatch(null);
              }}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scanner Viewfinder Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-start space-y-4">
            {/* Viewfinder Target Reticle with Animated Laser Scan Beam */}
            <div className="relative w-full max-w-sm aspect-square bg-slate-900 rounded-3xl border-2 border-slate-700 overflow-hidden flex flex-col items-center justify-center shadow-2xl shrink-0 mt-2">
              {/* Corner targeting brackets */}
              <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-[#FFDE00] rounded-tl-lg pointer-events-none" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-[#FFDE00] rounded-tr-lg pointer-events-none" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-[#FFDE00] rounded-bl-lg pointer-events-none" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-[#FFDE00] rounded-br-lg pointer-events-none" />

              {/* Animated Laser Scanning Beam */}
              <div className="absolute left-6 right-6 h-1 bg-gradient-to-r from-transparent via-[#FFDE00] to-transparent shadow-[0_0_15px_#FFDE00,0_0_25px_#FFDE00] animate-pulse pointer-events-none center-laser-line" />

              <div className="text-center p-6 space-y-2 relative z-10 pointer-events-none">
                <Barcode className="w-16 h-16 text-[#FFDE00]/80 mx-auto animate-pulse" />
                <h4 className="font-montserrat font-black text-sm text-white">Scanner Sensor Active</h4>
                <p className="text-[11px] text-slate-400 max-w-[220px] mx-auto">
                  Align bottle EAN-13 barcode within brackets or use demo tests below.
                </p>
              </div>
            </div>

            {/* Direct Input Field */}
            <div className="w-full max-w-sm space-y-2">
              <div className="relative">
                <Barcode className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={scannerQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setScannerQuery(val);
                    const q = val.trim().toLowerCase();
                    if (!q) {
                      setScannedProductMatch(null);
                      return;
                    }
                    const match = products.find((p) => {
                      if (p.barcode && p.barcode.toLowerCase() === q) return true;
                      if (p.caseBarcode && p.caseBarcode.toLowerCase() === q) return true;
                      if (p.sku && p.sku.toLowerCase() === q) return true;
                      if (p.name && p.name.toLowerCase().includes(q)) return true;
                      return false;
                    });
                    if (match) {
                      setScannedProductMatch(match);
                      playPosBeep('success');
                    } else {
                      setScannedProductMatch(null);
                    }
                  }}
                  placeholder="Type barcode or search spirit name..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl text-xs font-semibold text-white focus:outline-none focus:border-[#FFDE00] placeholder:text-slate-500 shadow-inner"
                />
              </div>
            </div>

            {/* Matched Product Showcase Card */}
            {scannedProductMatch && (
              <div className="w-full max-w-sm bg-slate-900 border-2 border-[#FFDE00] rounded-3xl p-4 space-y-3 animate-in zoom-in-95 duration-150 shadow-2xl">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Verified Bottle Recognized!</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-white p-1 shrink-0 flex items-center justify-center">
                    <ProductImage
                      product={toImageProduct(scannedProductMatch)}
                      size="full"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase text-[#FFDE00] block">
                      {scannedProductMatch.brand || scannedProductMatch.subCategory}
                    </span>
                    <h4 className="font-montserrat font-black text-sm text-white truncate">
                      {scannedProductMatch.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-black font-mono-tabular text-[#FFDE00]">
                        {formatKes(scannedProductMatch.retailPriceKes || scannedProductMatch.baseRetailPrice || 3200)}
                      </span>
                      <span className="text-[10px] text-slate-400">· {scannedProductMatch.volumeMl || 750}ml</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      handleAddToCart(scannedProductMatch, 1);
                      setIsMobileScannerOpen(false);
                      setIsMobileCartOpen(true);
                    }}
                    className="flex-1 py-3 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    Add to Ticket ({formatKes(scannedProductMatch.retailPriceKes || scannedProductMatch.baseRetailPrice || 3200)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openProductPreview(scannedProductMatch);
                      setIsMobileScannerOpen(false);
                    }}
                    className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
                    title="View ML Variants"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Quick 1-Tap Sample Barcode Simulator */}
            <div className="w-full max-w-sm pt-2 space-y-2">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block text-center">
                Instant 1-Tap Barcode Samples:
              </span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Johnnie Walker Black', barcode: '5000267014203' },
                  { name: 'Hennessy VS', barcode: '3245990250004' },
                  { name: 'Tanqueray Gin', barcode: '5000281005409' },
                  { name: 'Tusker 500ml', barcode: '6161100000018' },
                ].map((sample) => (
                  <button
                    key={sample.barcode}
                    type="button"
                    onClick={() => {
                      setScannerQuery(sample.barcode);
                      const match = products.find(
                        (p) =>
                          (p.barcode && p.barcode.includes(sample.barcode)) ||
                          p.name.toLowerCase().includes(sample.name.toLowerCase().split(' ')[0])
                      );
                      if (match) {
                        setScannedProductMatch(match);
                        playPosBeep('success');
                      }
                    }}
                    className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-[#FFDE00] rounded-xl text-left transition cursor-pointer flex flex-col justify-between active:scale-95"
                  >
                    <span className="text-[11px] font-bold text-white truncate">{sample.name}</span>
                    <span className="text-[9px] font-mono font-bold text-[#FFDE00] truncate">{sample.barcode}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
