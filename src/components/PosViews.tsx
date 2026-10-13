import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  Barcode,
  Camera,
  Bluetooth,
  Volume2,
  VolumeX,
  Sparkles,
  Coins,
  CreditCard,
  Smartphone,
  Zap,
  ScanLine,
  X,
  AlertCircle,
  UtensilsCrossed,
  Flame,
  Cigarette,
  Wine,
  ChefHat,
  Layers,
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
  BusinessUnit,
  RestaurantInventoryItem,
} from '../types';
import { calculateGeoPrice, formatKes } from '../erpUtils';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../data/nairobiDrinksCatalog';
import {
  PRESET_SIGGER_ITEMS,
  PRESET_SHISHA_ITEMS,
  PRESET_AMENITY_ITEMS,
  ClubTopupItem,
} from '../data/clubTopupsData';
import { ProductImage } from './ProductImage';
import { AnimatedSuccessTickIcon } from './AnimatedFeedback';
import { PhoneBarcodeScannerModal } from './PhoneBarcodeScannerModal';
import { playPosBeep, triggerScanHaptic, isAudioMuted, toggleAudioMuted } from '../utils/audioBeep';

interface PosViewsProps {
  mode: 'retail' | 'wholesale';
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  regions: GeoRegion[];
  partners: Partner[];
  businessUnits?: BusinessUnit[];
  restaurantInventory?: RestaurantInventoryItem[];
  onCommitTransaction: (
    txDraft: Omit<TransactionDoc, 'id' | 'createdAt'>,
    updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[]
  ) => Promise<TransactionDoc | null>;
  onPreviewDoc: (doc: TransactionDoc) => void;
  onUpdateRestaurantItem?: (itemId: string, updates: Partial<RestaurantInventoryItem>) => Promise<void>;
}

export const PosViews: React.FC<PosViewsProps> = ({
  mode,
  currentUser,
  products,
  branches,
  regions,
  partners,
  businessUnits = [],
  restaurantInventory = [],
  onCommitTransaction,
  onPreviewDoc,
  onUpdateRestaurantItem,
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

  // Outlets under current active branch
  const branchOutlets = useMemo(() => {
    if (!activeBranch) return [];
    return businessUnits.filter((u) => u.branchId === activeBranch.id);
  }, [businessUnits, activeBranch]);

  // Priority outlet selection: if staff is assigned to a specific businessUnit, default to it!
  const [selectedOutletId, setSelectedOutletId] = useState<string>(() => {
    if (currentUser.businessUnitId) return currentUser.businessUnitId;
    return 'BONDED_CENTRAL';
  });

  const activeOutlet = useMemo(() => {
    if (selectedOutletId === 'BONDED_CENTRAL') return null;
    return businessUnits.find((u) => u.id === selectedOutletId) || null;
  }, [businessUnits, selectedOutletId]);

  const isRestaurantMode = activeOutlet?.unitType === 'restaurant_club';
  const isMerchantShopMode = activeOutlet?.unitType === 'merchant_shop';

  // Restaurant Food Category filter
  const [restaurantCategoryFilter, setRestaurantCategoryFilter] = useState<string>('ALL');
  const [activeTableNumber, setActiveTableNumber] = useState<string>('Table 01');
  const [guestCount, setGuestCount] = useState<number>(2);

  // Club Topup Modal State (Liquor, Cigars/Sigger, Shisha)
  const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
  const [topupTab, setTopupTab] = useState<'liquor' | 'sigger' | 'shisha' | 'amenity'>('liquor');
  const [topupLiquorSearch, setTopupLiquorSearch] = useState('');

  const [cart, setCart] = useState<
    {
      id: string;
      kind: 'bonded_product' | 'restaurant_food' | 'topup_item';
      product?: Product;
      restaurantItem?: RestaurantInventoryItem;
      topupItem?: ClubTopupItem;
      unitMode: 'Bottle' | 'Case' | 'Portion' | 'Plate' | 'Platter' | 'Glass' | 'Cup' | 'Stick' | 'Head' | 'Serving' | 'Basket';
      quantityUnits: number;
      unitPrice: number;
      name: string;
      category: string;
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

  // Barcode Scanner Integration (Phone, Desktop USB & Bluetooth Scanners)
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isPhoneScannerOpen, setIsPhoneScannerOpen] = useState(false);
  const [scanNotification, setScanNotification] = useState<{
    type: 'success' | 'error' | 'case';
    text: string;
    productName?: string;
    price?: number;
    qtyInCart?: number;
    timestamp: number;
  } | null>(null);
  const [soundMuted, setSoundMuted] = useState(() => isAudioMuted());
  const [cashTendered, setCashTendered] = useState<number>(0);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const handleScanBarcode = useCallback(
    (rawBarcode: string): { success: boolean; product?: Product; message?: string } => {
      const code = rawBarcode.trim();
      if (!code) return { success: false, message: 'Empty barcode' };
      const digitsOnly = code.replace(/\D/g, '');

      // 1. Exact match on barcode, caseBarcode or SKU
      let matched = products.find(
        (p) =>
          (p.barcode && p.barcode.trim() === code) ||
          (p.caseBarcode && p.caseBarcode.trim() === code) ||
          (p.sku && p.sku.toLowerCase() === code.toLowerCase())
      );

      let isCaseScan = false;
      if (matched && matched.caseBarcode && matched.caseBarcode.trim() === code) {
        isCaseScan = true;
      }

      // 2. Normalized digit matching (EAN-13, UPC-A 12 vs 13 digits with leading zero, ITF-14)
      if (!matched && digitsOnly) {
        matched = products.find((p) => {
          const pCase = p.caseBarcode ? p.caseBarcode.replace(/\D/g, '') : '';
          const pBottle = p.barcode ? p.barcode.replace(/\D/g, '') : '';

          if (pCase && (pCase === digitsOnly || pCase.endsWith(digitsOnly) || digitsOnly.endsWith(pCase))) {
            isCaseScan = true;
            return true;
          }
          if (pBottle) {
            if (pBottle === digitsOnly) return true;
            if (pBottle.padStart(13, '0') === digitsOnly.padStart(13, '0')) return true;
          }
          return false;
        });
      }

      if (!matched) {
        playPosBeep('error');
        setScanNotification({
          type: 'error',
          text: `Barcode "${code}" not found in bonded product catalog`,
          timestamp: Date.now(),
        });
        return { success: false, message: `Barcode "${code}" not found` };
      }

      const targetUnit: 'Bottle' | 'Case' = isCaseScan
        ? 'Case'
        : mode === 'wholesale'
        ? 'Case'
        : 'Bottle';

      playPosBeep(isCaseScan ? 'case' : 'success');
      triggerScanHaptic();
      setLastScannedBarcode(code);

      let updatedQty = 1;
      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) => item.product?.id === matched!.id && item.unitMode === targetUnit && item.kind === 'bonded_product'
        );
        if (existingIdx >= 0) {
          updatedQty = prev[existingIdx].quantityUnits + 1;
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            quantityUnits: updatedQty,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: `scan-${matched!.id}-${Date.now()}`,
            kind: 'bonded_product',
            product: matched!,
            unitMode: targetUnit,
            quantityUnits: 1,
            unitPrice: 0,
            name: matched!.name,
            category: matched!.category,
          },
        ];
      });

      const geoPrice = calculateGeoPrice(
        matched,
        activeRegion,
        mode === 'wholesale' ? 'wholesale' : 'retail'
      );
      const unitPrice = targetUnit === 'Case' ? geoPrice.casePrice : geoPrice.unitBottlePrice;

      setScanNotification({
        type: isCaseScan ? 'case' : 'success',
        text: `Scanned & Added: ${matched.name}`,
        productName: matched.name,
        price: unitPrice,
        qtyInCart: updatedQty,
        timestamp: Date.now(),
      });

      setBarcodeInput('');
      return { success: true, product: matched };
    },
    [products, mode, activeRegion]
  );

  // Global listener for Desktop USB & Bluetooth Handheld Barcode Scanners (HID Wedge mode)
  useEffect(() => {
    let keyBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const activeTag = activeEl?.tagName?.toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea';
      const isQuickScanInput = activeEl?.id === 'barcode-scanner-quick-input';

      const now = Date.now();
      const charInterval = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (isQuickScanInput && barcodeInput.trim()) {
          e.preventDefault();
          handleScanBarcode(barcodeInput);
          return;
        }

        if (keyBuffer.length >= 3) {
          e.preventDefault();
          const code = keyBuffer;
          keyBuffer = '';
          handleScanBarcode(code);
        } else {
          keyBuffer = '';
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isInput && !isQuickScanInput) {
          if (charInterval < 50) {
            keyBuffer += e.key;
          } else {
            keyBuffer = '';
          }
        } else {
          if (charInterval > 85 && !isQuickScanInput) {
            keyBuffer = e.key;
          } else {
            keyBuffer += e.key;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleScanBarcode, barcodeInput]);

  // Auto-dismiss scan notification banner after 4.5 seconds
  useEffect(() => {
    if (scanNotification) {
      const timer = setTimeout(() => {
        setScanNotification(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [scanNotification]);

  // Pre-curated sample barcodes for instant 1-click test simulation
  const sampleTestBarcodes = useMemo(() => {
    return products
      .filter((p) => Boolean(p.barcode))
      .slice(0, 10)
      .map((p) => ({
        barcode: p.barcode!,
        name: p.name,
        sku: p.sku,
        category: p.category,
      }));
  }, [products]);

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
        (item) => item.product?.id === product.id && item.unitMode === defaultUnitMode && item.kind === 'bonded_product'
      );
      if (existing) {
        return prev.map((item) =>
          item.product?.id === product.id && item.unitMode === defaultUnitMode && item.kind === 'bonded_product'
            ? { ...item, quantityUnits: item.quantityUnits + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          id: `prod-${product.id}-${Date.now()}`,
          kind: 'bonded_product',
          product,
          unitMode: defaultUnitMode,
          quantityUnits: 1,
          unitPrice: 0,
          name: product.name,
          category: product.category,
        },
      ];
    });
  };

  // Add Restaurant Food / Drink dish to order
  const handleAddRestaurantDish = (dish: RestaurantInventoryItem) => {
    if (dish.portionsAvailable <= 0) {
      playPosBeep('error');
      setScanNotification({
        type: 'error',
        text: `"${dish.name}" is sold out in kitchen inventory!`,
        timestamp: Date.now(),
      });
      return;
    }
    playPosBeep('success');
    triggerScanHaptic();
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.restaurantItem?.id === dish.id && item.kind === 'restaurant_food'
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantityUnits: item.quantityUnits + 1 } : item
        );
      }
      const unitMode = (dish.portionUnit || 'Plate') as any;
      return [
        ...prev,
        {
          id: `dish-${dish.id}-${Date.now()}`,
          kind: 'restaurant_food',
          restaurantItem: dish,
          unitMode,
          quantityUnits: 1,
          unitPrice: dish.sellingPriceKes,
          name: dish.name,
          category: dish.category,
        },
      ];
    });
  };

  // Add Club Topup (Bonded Liquor, Cigars/Sigger, Shisha, Amenities)
  const handleAddClubTopup = (topup: ClubTopupItem, linkedProduct?: Product) => {
    playPosBeep('case');
    triggerScanHaptic();
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.topupItem?.id === topup.id && item.kind === 'topup_item'
      );
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantityUnits: item.quantityUnits + 1 } : item
        );
      }
      const unitMode = (topup.portionUnit || 'Stick') as any;
      return [
        ...prev,
        {
          id: `topup-${topup.id}-${Date.now()}`,
          kind: 'topup_item',
          topupItem: topup,
          product: linkedProduct,
          unitMode,
          quantityUnits: 1,
          unitPrice: topup.priceKes,
          name: topup.name,
          category: topup.category,
        },
      ];
    });
    setIsTopupModalOpen(false);
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
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (item.kind === 'bonded_product') {
          return { ...item, unitMode: item.unitMode === 'Bottle' ? 'Case' : 'Bottle' };
        }
        return item;
      })
    );
  };

  const computedLineItems: LineItem[] = useMemo(() => {
    return cart.map((entry) => {
      if (entry.kind === 'bonded_product' && entry.product) {
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
      } else if (entry.kind === 'restaurant_food' && entry.restaurantItem) {
        const unitPrice = entry.unitPrice ?? entry.restaurantItem.sellingPriceKes;
        const lineTotal = Math.round(unitPrice * entry.quantityUnits);
        return {
          productId: entry.restaurantItem.id,
          sku: `FOOD-${entry.restaurantItem.id.slice(-4)}`,
          name: `[FOOD] ${entry.restaurantItem.name}`,
          unitMode: entry.unitMode,
          bottlesPerCase: 1,
          quantityUnits: entry.quantityUnits,
          totalBottles: 0,
          unitPrice,
          lineTotal,
          businessUnitId: entry.restaurantItem.businessUnitId,
        };
      } else {
        const unitPrice = entry.unitPrice ?? entry.topupItem?.priceKes ?? 0;
        const lineTotal = Math.round(unitPrice * entry.quantityUnits);
        const topupTag =
          entry.topupItem?.category === 'liquor'
            ? '[LIQUOR TOPUP]'
            : entry.topupItem?.category === 'sigger'
            ? '[SIGGER TOPUP]'
            : entry.topupItem?.category === 'shisha'
            ? '[SHISHA TOPUP]'
            : '[CLUB AMENITY]';
        return {
          productId: entry.product?.id || entry.topupItem?.id || `topup-${Date.now()}`,
          sku: `TOP-${(entry.topupItem?.category || 'gen').slice(0, 3).toUpperCase()}`,
          name: `${topupTag} ${entry.name || entry.topupItem?.name}`,
          unitMode: entry.unitMode,
          bottlesPerCase: 1,
          quantityUnits: entry.quantityUnits,
          totalBottles: entry.topupItem?.category === 'liquor' ? entry.quantityUnits : 0,
          unitPrice,
          lineTotal,
          isTopup: true,
          topupType: entry.topupItem?.category || 'liquor',
        };
      }
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

      // Deduct central liquor bottles for bonded or topup items
      if (docTypeToIssue !== 'Quote') {
        for (const line of computedLineItems) {
          const prod = products.find((p) => p.id === line.productId);
          if (prod && line.totalBottles > 0) {
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

        // Deduct portions from separate kitchen inventory for restaurant items
        if (onUpdateRestaurantItem) {
          for (const item of cart) {
            if (item.kind === 'restaurant_food' && item.restaurantItem) {
              const currentPortions = item.restaurantItem.portionsAvailable || 0;
              const remaining = Math.max(0, currentPortions - item.quantityUnits);
              await onUpdateRestaurantItem(item.restaurantItem.id, {
                portionsAvailable: remaining,
                isAvailable: remaining > 0,
              }).catch(() => {});
            }
          }
        }
      }

      const isRestaurantPos = isRestaurantMode && activeOutlet;
      const createdTx = await onCommitTransaction(
        {
          docNumber,
          docType: docTypeToIssue,
          channel: isRestaurantPos
            ? 'Restaurant & Club POS'
            : isMerchantShopMode
            ? 'Merchant Shop POS'
            : currentUser.role === 'Affiliate Sales Representative'
            ? 'Affiliate Rep'
            : mode === 'retail'
            ? 'Retail Counter POS'
            : 'B2B Wholesale POS',
          branchId: activeBranch.id,
          branchName: activeBranch.name,
          businessUnitId: isRestaurantPos ? activeOutlet.id : undefined,
          businessUnitName: isRestaurantPos ? activeOutlet.name : undefined,
          tableNumber: isRestaurantPos ? activeTableNumber : undefined,
          regionId: activeRegion.id,
          regionName: activeRegion.name,
          customerName: isRestaurantPos
            ? `${activeTableNumber ? `${activeTableNumber} · ` : ''}${customerName.trim() || 'Dine-In Guest'}`
            : customerName.trim() || 'Walk-in Customer',
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

      {/* RETAIL CHECKOUT BARCODE SCANNER STATION (Phone Camera + Desktop USB + Bluetooth Scanners) */}
      <div className="bg-white border-2 border-[#0A006E] rounded-3xl p-5 shadow-lg space-y-4 relative overflow-hidden">
        <div className="silent-scanner-beam" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md shrink-0">
              <Barcode className="w-7 h-7 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-black text-base text-[#0A006E]">
                  Retail Barcode Scanner Checkout Station
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Desktop & Bluetooth Scanners Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Scan with phone camera, desktop USB laser gun, or Bluetooth handheld barcode scanner — automatically adds to checkout.
              </p>
            </div>
          </div>

          {/* Scanner Controls & Modalities */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Phone Camera Scanner Launcher */}
            <button
              type="button"
              onClick={() => setIsPhoneScannerOpen(true)}
              className="px-4 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-2 cursor-pointer shadow-md transition hover:scale-[1.02]"
            >
              <Camera className="w-4 h-4 text-[#FFDE00]" />
              Phone / Camera Scanner
            </button>

            {/* Sound Mute/Unmute Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = toggleAudioMuted();
                setSoundMuted(next);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer border transition ${
                !soundMuted
                  ? 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
              title={soundMuted ? 'Unmute POS Chime' : 'Mute POS Chime'}
            >
              {soundMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-rose-600" />
                  <span>Beep Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Beep ON</span>
                </>
              )}
            </button>

            {/* Auto-focus Gun Input */}
            <button
              type="button"
              onClick={() => barcodeInputRef.current?.focus()}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition"
              title="Click to focus input for barcode gun"
            >
              <Bluetooth className="w-3.5 h-3.5 text-[#0A006E]" />
              <span>Focus Gun</span>
            </button>
          </div>
        </div>

        {/* Barcode Quick-Scan Input Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center relative z-10">
          <div className="md:col-span-8 relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-slate-400">
              <ScanLine className="w-5 h-5 text-[#0A006E]" />
            </div>
            <input
              ref={barcodeInputRef}
              id="barcode-scanner-quick-input"
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleScanBarcode(barcodeInput);
                }
              }}
              placeholder="Scan product barcode (Desktop USB gun, Bluetooth scanner, or type EAN-13 & press Enter)..."
              className="w-full pl-12 pr-28 py-3 bg-slate-50 border-2 border-slate-200 focus:border-[#0A006E] focus:bg-white rounded-2xl text-xs sm:text-sm font-mono-tabular text-slate-900 transition focus:outline-none focus:ring-4 focus:ring-[#0A006E]/10"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => setBarcodeInput('')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleScanBarcode(barcodeInput)}
                disabled={!barcodeInput.trim()}
                className="px-3 py-1.5 bg-[#FFDE00] hover:bg-amber-400 disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs rounded-xl cursor-pointer transition shadow-xs"
              >
                Scan Item
              </button>
            </div>
          </div>

          {/* Quick-Test Sample Barcode Selector */}
          <div className="md:col-span-4">
            <div className="relative">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleScanBarcode(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="w-full py-3 px-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-xs font-montserrat font-semibold text-slate-700 cursor-pointer focus:outline-none focus:border-[#0A006E]"
              >
                <option value="" disabled>
                  ⚡ Test Sample Onboarded Barcodes...
                </option>
                {sampleTestBarcodes.map((item) => (
                  <option key={item.barcode} value={item.barcode}>
                    {item.name} ({item.barcode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Scan Notification Toast Banner */}
        {scanNotification && (
          <div
            className={`p-3.5 rounded-2xl border-2 flex items-center justify-between gap-3 text-xs font-montserrat font-bold shadow-md animate-fade-in relative z-10 ${
              scanNotification.type === 'error'
                ? 'bg-rose-50 border-rose-400 text-rose-950'
                : 'bg-emerald-50 border-emerald-500 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {scanNotification.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              )}
              <div className="truncate">
                <span>{scanNotification.text}</span>
                {scanNotification.price && (
                  <span className="ml-2 font-mono-tabular text-emerald-700">
                    · {formatKes(scanNotification.price)}
                    {scanNotification.qtyInCart && ` (Cart Qty: ${scanNotification.qtyInCart})`}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setScanNotification(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
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

            <div className="sm:col-span-2 space-y-2">
              <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                Payment Method & Checkout Settlement
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {[
                  { id: 'M-Pesa Till / Instant Card', label: 'M-Pesa / Card', icon: Smartphone },
                  { id: 'Cash Till Settlement', label: 'Cash Till', icon: Coins },
                  { id: 'Corporate Bank EFT / M-Pesa Paybill', label: 'Bank / Paybill', icon: CreditCard },
                  { id: 'Distributor Credit Line', label: 'Credit Line', icon: Zap },
                ].map((pm) => {
                  const IconC = pm.icon;
                  const isSel = paymentMethod === pm.id;
                  return (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`py-2 px-2.5 rounded-xl border text-[11px] font-montserrat font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        isSel
                          ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <IconC className={`w-3.5 h-3.5 ${isSel ? 'text-[#FFDE00]' : 'text-slate-500'}`} />
                      <span className="truncate">{pm.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Cash Tendered & Change Calculator for Counter Cashiers */}
            {paymentMethod === 'Cash Till Settlement' && (
              <div className="sm:col-span-2 bg-amber-50/80 border border-amber-300 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-montserrat font-black text-amber-950">
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-600" />
                    Cash Tendered & Change Due Calculator
                  </span>
                  <span className="font-mono-tabular text-[#0A006E]">
                    Payable: <strong>{formatKes(grandTotal)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Cash Tendered (KES)</label>
                    <input
                      type="number"
                      value={cashTendered || ''}
                      onChange={(e) => setCashTendered(Number(e.target.value))}
                      placeholder={String(grandTotal)}
                      className="w-full mt-1 px-3 py-2 bg-white border-2 border-amber-300 focus:border-[#0A006E] rounded-xl text-xs font-mono-tabular font-black text-slate-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 uppercase">Change Due (KES)</label>
                    <div className="mt-1 px-3 py-2 bg-white border-2 border-amber-300 rounded-xl text-xs font-mono-tabular font-black flex items-center justify-between">
                      <span className={cashTendered >= grandTotal ? 'text-emerald-700' : 'text-amber-700'}>
                        {cashTendered >= grandTotal
                          ? formatKes(cashTendered - grandTotal)
                          : cashTendered > 0
                          ? `Short ${formatKes(grandTotal - cashTendered)}`
                          : 'KES 0'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Cash Bill Shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-montserrat font-bold text-slate-500 mr-1">Quick Bills:</span>
                  <button
                    type="button"
                    onClick={() => setCashTendered(grandTotal)}
                    className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-[10px] font-montserrat font-bold text-amber-900 rounded-lg cursor-pointer transition shadow-2xs"
                  >
                    Exact Amount
                  </button>
                  {[1000, 2000, 3000, 5000, 10000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashTendered(amt)}
                      className="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-[10px] font-mono-tabular font-bold text-amber-900 rounded-lg cursor-pointer transition shadow-2xs"
                    >
                      {amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

      {/* Live Phone Camera Barcode Scanner Viewfinder Modal */}
      <PhoneBarcodeScannerModal
        isOpen={isPhoneScannerOpen}
        onClose={() => setIsPhoneScannerOpen(false)}
        onBarcodeScanned={handleScanBarcode}
      />
    </div>
  );
};
