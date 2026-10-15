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
import { calculateGeoPrice, formatKes, isUserFeaturePermitted } from '../erpUtils';
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
import QRCode from 'qrcode';
import {
  syncPosCartToFirestore,
  subscribeToActivePosCart,
  clearActivePosCart,
} from '../utils/posCartSync';
import { PhoneScannerCompanion } from './PhoneScannerCompanion';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';

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

  const canVoidOrder = isUserFeaturePermitted(currentUser, 'pos_voids');

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

  // Barcode Scanner Integration & Activation (Phone, Desktop USB & Bluetooth Scanners)
  const [barcodeInput, setBarcodeInput] = useState('');
  const [activatedProductIds, setActivatedProductIds] = useState<string[]>([]);
  const [isPhoneScannerOpen, setIsPhoneScannerOpen] = useState(false);

  // Real-time listener for product activations
  useEffect(() => {
    if (!activeBranch) return;
    const q = query(
      collection(db, 'branch_product_activations'),
      where('branchId', '==', activeBranch.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const ids = snap.docs.map((d) => d.data().productId);
      setActivatedProductIds(ids);
    });
    return unsub;
  }, [activeBranch]);

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

  // Real-time Phone-to-Desktop Cashier Sync State under Cashier Account
  const [isPhoneSyncActive, setIsPhoneSyncActive] = useState(false);
  const [isPhonePairModalOpen, setIsPhonePairModalOpen] = useState(false);
  const [pairingQrDataUrl, setPairingQrDataUrl] = useState<string>('');
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [isPhoneCompanionModalOpen, setIsPhoneCompanionModalOpen] = useState(false);
  const [mpesaCustomerPhone, setMpesaCustomerPhone] = useState('');
  const [mpesaReceiptCode, setMpesaReceiptCode] = useState('');
  const isApplyingRemoteSyncRef = useRef(false);

  // Generate pairing QR code whenever pairing modal opens
  useEffect(() => {
    if (isPhonePairModalOpen) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/?phone_scanner=true&staffId=${encodeURIComponent(currentUser.id)}&staffName=${encodeURIComponent(currentUser.name)}&staffRole=${encodeURIComponent(currentUser.role)}&staffEmail=${encodeURIComponent(currentUser.email || '')}`;
      setPairingUrl(url);
      QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: '#0A006E', light: '#FFFFFF' } })
        .then((dataUrl) => setPairingQrDataUrl(dataUrl))
        .catch((err) => console.warn('QR Code generation error:', err));
    }
  }, [isPhonePairModalOpen, currentUser]);

  const localCartRef = useRef(cart);
  localCartRef.current = cart;

  // Real-time listener: receive instant scans from phone under currentUser's account
  useEffect(() => {
    const staffKey = currentUser.email;
    if (!staffKey) return;

    const unsub = subscribeToActivePosCart(staffKey, (remote) => {
      // Enrich remote items with catalog product details for accurate pricing, taxes, and images
      const enrichedCart = remote.cart.map((item) => {
        if (item.kind === 'bonded_product' && item.product?.id) {
          const fullProd = products.find((p) => p.id === item.product!.id) || item.product;
          return { ...item, product: fullProd };
        }
        return item;
      });

      const remoteSummary = enrichedCart.map((it) => `${it.id}:${it.quantityUnits}:${it.unitMode}`).join('|');
      const localSummary = localCartRef.current.map((it) => `${it.id}:${it.quantityUnits}:${it.unitMode}`).join('|');

      if (remoteSummary !== localSummary) {
        isApplyingRemoteSyncRef.current = true;
        setCart(enrichedCart as any);
        if (remote.activatedProductIds && remote.activatedProductIds.length > 0) {
          setActivatedProductIds((prev) => Array.from(new Set([...prev, ...remote.activatedProductIds])));
        }
        setIsPhoneSyncActive(true);

        if (remote.lastScannedProductName) {
          playPosBeep('success');
          triggerScanHaptic();
          setScanNotification({
            type: 'success',
            text: `📱 Phone Scanned: ${remote.lastScannedProductName} (+1 item) · New Total: ${formatKes(remote.grandTotal)}`,
            productName: remote.lastScannedProductName,
            price: remote.cart[remote.cart.length - 1]?.unitPrice || 0,
            qtyInCart: remote.cart.find((it) => it.name === remote.lastScannedProductName)?.quantityUnits || 1,
            timestamp: Date.now(),
          });
        }
      }
    });

    return () => unsub();
  }, [currentUser.id, currentUser.email, products]);

  // Synchronize local desktop cart updates to Firestore
  useEffect(() => {
    if (isApplyingRemoteSyncRef.current) {
      isApplyingRemoteSyncRef.current = false;
      return;
    }
    const staffKey = currentUser.email;
    if (!staffKey) return;

    let sub = 0;
    let units = 0;
    for (const it of cart) {
      units += it.quantityUnits;
      sub += Math.round((it.unitPrice || 0) * it.quantityUnits);
    }
    const tax = Math.round(sub * (activeRegion?.regionalTaxRate ?? 0.16));

    syncPosCartToFirestore({
      staffId: currentUser.id,
      staffName: currentUser.name,
      staffEmail: currentUser.email || '',
      staffRole: currentUser.role,
      branchId: activeBranch?.id || '',
      cart,
      activatedProductIds,
      totalUnits: units,
      subtotal: sub,
      exciseAndTax: tax,
      grandTotal: sub + tax,
      lastScannedBarcode,
      sourceDevice: 'desktop',
    }).catch(() => {});
  }, [cart, activatedProductIds, currentUser, activeBranch, activeRegion, lastScannedBarcode]);

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

      // Activate product into POS checkout session shelf
      if (!activatedProductIds.includes(matched!.id)) {
        const activationId = `${activeBranch.id}_${matched!.id}`;
        setDoc(doc(db, 'branch_product_activations', activationId), {
          id: activationId,
          branchId: activeBranch.id,
          productId: matched!.id,
          activatedAt: new Date().toISOString(),
          activatedBy: currentUser.id,
        }).catch((err) => console.error('Activation write failed:', err));
      }

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

  // Real registered barcodes for test simulation
  const sampleTestBarcodes = useMemo(() => {
    return products
      .filter((p) => Boolean(p.hasRealBarcode && p.barcode))
      .slice(0, 10)
      .map((p) => ({
        barcode: p.barcode!,
        name: p.name,
        sku: p.sku,
        category: p.category,
      }));
  }, [products]);

  // Strict POS Barcode-Activation: POS shows NO products until barcode is scanned to activate them!
  const activatedProducts = useMemo(() => {
    return products.filter((p) => activatedProductIds.includes(p.id));
  }, [products, activatedProductIds]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    // In POS Barcode-Activated mode: only filter and display among activated products!
    return activatedProducts.filter((p) => {
      // Sales Rep restriction: only show IPS products
      if (currentUser.role === 'Affiliate Sales Representative' && p.category !== 'IPS') {
        return false;
      }

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
  }, [activatedProducts, stockCategoryFilter, selectedSubCategory, searchQuery, currentUser.role]);

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
    setActivatedProductIds((prev) => (prev.includes(product.id) ? prev : [product.id, ...prev]));
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
      setActivatedProductIds([]);
      clearActivePosCart(currentUser.id || currentUser.email).catch(() => {});
      setStatusMessage(`${docTypeToIssue} ${docNumber} committed and ready to print.`);
      if (createdTx) {
        onPreviewDoc(createdTx);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Minimized Cashier Header Bar - Ultra Streamlined & Space-Saving */}
      <div className="bg-[#FFDE00] border-2 border-[#0A006E] rounded-xl sm:rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative overflow-hidden shadow-xs">
        <div className="silent-scanner-beam-dark" />
        
        {/* Terminal Title & Active Zone Pill */}
        <div className="relative z-10 flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 shadow-xs">
            {mode === 'retail' ? (
              <Store className="w-4 h-4" />
            ) : (
              <Briefcase className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-extrabold font-montserrat text-[#0A006E] tracking-tight">
                {mode === 'retail' ? 'Retail Checkout' : 'Wholesale POS'}
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-montserrat font-bold bg-[#0A006E]/10 text-[#0A006E] border border-[#0A006E]/15">
                <MapPin className="w-2.5 h-2.5 text-[#0A006E]" />
                {activeRegion?.name || 'Default Zone'}
              </span>
              {currentUser.role === 'Affiliate Sales Representative' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-montserrat font-bold bg-violet-100 text-violet-800 border border-violet-200">
                  <Sparkles className="w-2.5 h-2.5" />
                  Sales Rep Mode
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] font-semibold text-[#0A006E]/80 truncate">
              {branches.find((b) => b.id === activeBranch?.id)?.name || 'Central Outlet'} · Suburb vs. Lower-Region Geo-Pricing Active
            </p>
          </div>
        </div>

        {/* Compact Branch & Geo-Pricing Dropdowns */}
        <div className="flex items-center gap-2 relative z-10 shrink-0 flex-wrap">
          <div className="flex items-center bg-white border border-[#0A006E]/30 rounded-lg px-2 py-1 shadow-xs">
            <span className="text-[9px] font-montserrat font-black text-slate-500 uppercase mr-1 hidden sm:inline">
              Branch:
            </span>
            <select
              disabled={isScopedBranch}
              value={activeBranch?.id || ''}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                const br = branches.find((b) => b.id === e.target.value);
                if (br) setSelectedRegionId(br.regionId);
              }}
              className="text-[11px] font-montserrat font-black text-[#0A006E] bg-transparent focus:outline-none cursor-pointer"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center bg-[#0A006E] text-white border border-[#0A006E] rounded-lg px-2 py-1 shadow-xs">
            <MapPin className="w-3 h-3 text-[#FFDE00] mr-1 shrink-0" />
            <select
              value={activeRegion?.id || ''}
              onChange={(e) => setSelectedRegionId(e.target.value)}
              className="text-[11px] font-montserrat font-bold text-white bg-[#0A006E] focus:outline-none cursor-pointer"
              title="Geo-Pricing Zone"
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
      <div className="bg-white border-2 border-[#0A006E] rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3 relative overflow-hidden">
        <div className="silent-scanner-beam" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs shrink-0">
              <Barcode className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-montserrat font-black text-sm text-[#0A006E]">
                  Barcode Scanner Checkout Station
                </h3>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-montserrat font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Scanner Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Phone camera, desktop USB laser gun, or Bluetooth scanner adds items instantly.
              </p>
            </div>
          </div>

          {/* Scanner Controls & Modalities */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Scan with My Phone QR / Pair Button */}
            <button
              type="button"
              onClick={() => setIsPhonePairModalOpen(true)}
              className="px-3.5 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition hover:scale-[1.02]"
              title="Point phone camera at QR code to pair and scan into this cashier register"
            >
              <Smartphone className="w-4 h-4 text-[#0A006E]" />
              <span>📱 Scan with My Phone</span>
              {isPhoneSyncActive ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#0A006E] text-[#FFDE00] font-mono">LINK</span>
              )}
            </button>

            {/* Phone Camera Scanner Launcher */}
            <button
              type="button"
              onClick={() => setIsPhoneScannerOpen(true)}
              className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition hover:scale-[1.02]"
            >
              <Camera className="w-4 h-4 text-[#FFDE00]" />
              <span>Webcam Scanner</span>
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
                  {sampleTestBarcodes.length > 0
                    ? '⚡ Test Registered Real Barcodes...'
                    : '⚠️ No Real Barcodes Registered Yet'}
                </option>
                {sampleTestBarcodes.map((item) => (
                  <option key={item.barcode} value={item.barcode}>
                    {item.name} ({item.barcode})
                  </option>
                ))}
                {sampleTestBarcodes.length === 0 && (
                  <option value="" disabled>
                    ℹ️ Inventory Manager scans real bottle barcodes in Inventory Management
                  </option>
                )}
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
          {activatedProducts.length === 0 ? (
            /* ZERO-STATE: POS DOES NOT SHOW ANY PRODUCTS UNTIL BARCODE IS SCANNED */
            <div className="bg-white border-2 border-dashed border-[#0A006E]/30 rounded-3xl p-8 sm:p-10 text-center space-y-6 shadow-sm">
              <div className="relative inline-block mx-auto">
                <div className="w-20 h-20 rounded-3xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-lg">
                  <Barcode className="w-10 h-10 stroke-[2.2]" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
              </div>

              <div className="max-w-md mx-auto space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-montserrat font-black bg-[#FFDE00] text-[#0A006E]">
                  <ScanLine className="w-3.5 h-3.5" />
                  Barcode Scan-To-Activate POS Mode
                </div>
                <h3 className="font-montserrat font-black text-xl text-[#0A006E]">
                  No Products Displayed Yet
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  To eliminate mistakes and ensure 100% stock fidelity, products remain hidden until a real physical bottle barcode is scanned to activate them.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-lg mx-auto text-left space-y-2.5">
                <div className="text-xs font-montserrat font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#0A006E]" />
                  Retail Checkout Workflow:
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                  <li>Scan a bottle's real barcode using your desktop laser gun, Bluetooth scanner, or phone camera.</li>
                  <li>Once scanned, the matching item is immediately activated and displayed on this shelf and added to cart.</li>
                  <li>All fake mock barcodes have been removed. Real barcodes are registered by the Inventory Manager.</li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPhonePairModalOpen(true)}
                  className="px-5 py-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] border-2 border-[#FFDE00] rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition hover:scale-105"
                >
                  <Smartphone className="w-4 h-4 text-[#FFDE00]" />
                  Scan with Phone (Instant Desktop Link)
                </button>
                <button
                  type="button"
                  onClick={() => setIsPhoneScannerOpen(true)}
                  className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition hover:scale-105"
                >
                  <Camera className="w-4 h-4 text-[#FFDE00]" />
                  Open Camera Scanner
                </button>
                <button
                  type="button"
                  onClick={() => barcodeInputRef.current?.focus()}
                  className="px-5 py-3 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl font-montserrat font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition hover:scale-105"
                >
                  <Barcode className="w-4 h-4 text-[#0A006E]" />
                  Focus Desktop Laser Gun
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Items Header Bar */}
              <div className="bg-[#0A006E] text-white p-3.5 rounded-2xl flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-montserrat font-black text-xs text-[#FFDE00]">
                    Activated Shelf ({activatedProducts.length} Item{activatedProducts.length === 1 ? '' : 's'} Active in this Checkout)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPhoneScannerOpen(true)}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    Scan Next Bottle
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActivatedProductIds([]);
                      setCart([]);
                    }}
                    className="px-2.5 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[11px] font-montserrat font-bold cursor-pointer"
                  >
                    Reset Shelf
                  </button>
                </div>
              </div>

              {/* Search & Categories within Activated Items */}
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
                      placeholder={`Filter among ${activatedProducts.length} activated items by name, SKU, or barcode...`}
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0A006E]"
                    />
                  </div>

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
                        {sc === 'ALL' ? `All (${activatedProducts.length})` : sc}
                      </button>
                    ))}
                  </div>
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
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded text-[9px] font-montserrat font-black uppercase flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Activated Item
                        </span>
                        {product.barcode && (
                          <span className="px-1.5 py-0.5 bg-slate-200/80 text-slate-800 border border-slate-300 rounded text-[9px] font-mono-tabular font-bold">
                            EAN: {product.barcode}
                          </span>
                        )}
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
          )}
        </div>

        {/* Right 5 Columns: Active Order Register & Document Generator with Permanently Floating Total */}
        <div className="lg:col-span-5 bg-[#F0F2F0] border border-slate-200 rounded-2xl flex flex-col sticky top-20 max-h-[calc(100vh-6rem)] overflow-hidden shadow-sm">
          {/* Fixed Register Header */}
          <div className="p-4 border-b border-slate-200 bg-white/90 backdrop-blur-xs flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#0A006E]" />
              <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                {mode === 'retail' ? 'Retail Counter Register' : 'B2B Dispatch & Document Register'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-tabular font-bold text-[#0A006E] bg-[#F0F2F0] px-2 py-0.5 rounded-md border border-slate-200">
                {computedLineItems.length} Line Item{computedLineItems.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {/* Scrollable Register Content: Customer Details, Simplified M-Pesa, and Line Items */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
            {statusMessage && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-[#34D186] text-xs text-[#0A006E] font-montserrat font-black flex items-center gap-3 animate-success-pop shadow-md">
                <AnimatedSuccessTickIcon size="sm" />
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Customer / Retailer Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
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

              <div className="sm:col-span-2">
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

              {/* Payment Method Selector */}
              <div className="sm:col-span-2 space-y-1.5 pt-1">
                <label className="block text-[11px] font-montserrat font-bold text-slate-600">
                  Payment Method
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'M-Pesa Till / Instant Card', label: 'Lipa M-Pesa', icon: Smartphone },
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
                        className={`py-2 px-2 rounded-xl border text-[11px] font-montserrat font-bold flex items-center justify-center gap-1.5 cursor-pointer transition ${
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

              {/* SIMPLIFIED M-PESA UI */}
              {paymentMethod === 'M-Pesa Till / Instant Card' && (
                <div className="sm:col-span-2 bg-emerald-50/95 border-2 border-emerald-400 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-montserrat font-black text-emerald-950">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-[#1E9E60]" />
                      Lipa Na M-Pesa (Till 4082211)
                    </span>
                    <span className="font-mono-tabular text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                      Payable: {formatKes(grandTotal)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        placeholder="Customer Phone (07XX XXX XXX)"
                        value={mpesaCustomerPhone}
                        onChange={(e) => setMpesaCustomerPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-emerald-300 focus:border-[#0A006E] rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusMessage(`📲 M-Pesa STK Prompt sent to customer handset for ${formatKes(grandTotal)}!`);
                      }}
                      className="px-3.5 py-2 bg-[#1E9E60] hover:bg-emerald-700 text-[#FFDE00] rounded-xl text-[11px] font-montserrat font-black flex items-center gap-1 cursor-pointer transition shadow-xs shrink-0"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      Prompt Handset
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Cash Calculator */}
              {paymentMethod === 'Cash Till Settlement' && (
                <div className="sm:col-span-2 bg-amber-50/80 border border-amber-300 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-montserrat font-black text-amber-950">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-600" />
                      Cash Tendered & Change
                    </span>
                    <span className="font-mono-tabular text-[#0A006E]">
                      Payable: <strong>{formatKes(grandTotal)}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input
                        type="number"
                        value={cashTendered || ''}
                        onChange={(e) => setCashTendered(Number(e.target.value))}
                        placeholder={`Tendered (${grandTotal})`}
                        className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none"
                      />
                    </div>
                    <div className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-mono font-black flex items-center justify-between">
                      <span className="text-slate-500 text-[10px]">Change:</span>
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
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-montserrat font-bold text-slate-500 px-1">
                <span>Items in Register</span>
                <span className="font-mono">{computedLineItems.reduce((s, it) => s + it.quantityUnits, 0)} units</span>
              </div>

              {computedLineItems.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-5 text-center text-xs text-slate-500">
                  Select IPS/LPS liquor products on the left or scan with your phone to populate this register.
                </div>
              ) : (
                computedLineItems.map((item, idx) => (
                  <div
                    key={`${item.productId}-${item.unitMode}`}
                    className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 shadow-2xs hover:border-[#0A006E] transition"
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
          </div>

          {/* FLOATING CART TOTAL & SETTLEMENT BAR - PERMANENTLY FLOATS AT THE BOTTOM, NEVER SCROLLS */}
          <div className="p-4 bg-slate-950 text-white border-t-2 border-[#0A006E] space-y-2.5 shrink-0 shadow-[0_-8px_25px_rgba(0,0,0,0.18)] z-20">
            <div className="flex items-center justify-between text-xs font-mono-tabular">
              <div className="flex items-center gap-1.5 text-slate-300">
                <ShoppingCart className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>
                  Items: <strong>{computedLineItems.length}</strong> ({computedLineItems.reduce((s, it) => s + it.quantityUnits, 0)} units)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {isPhoneSyncActive ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Phone Linked &amp; Live
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPhonePairModalOpen(true)}
                    className="text-[10px] text-[#FFDE00] hover:underline font-montserrat font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Smartphone className="w-3 h-3" />
                    <span>Link Phone</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 font-mono-tabular">
              <span>Subtotal: {formatKes(subtotal)}</span>
              <span>Regional Tax ({(taxRate * 100).toFixed(0)}%): {formatKes(exciseAndTax)}</span>
            </div>

            <div className="flex justify-between items-baseline text-lg sm:text-xl font-montserrat font-black text-[#FFDE00] pt-1.5 border-t border-slate-800 font-mono-tabular">
              <span>Total Charge:</span>
              <span className="text-xl sm:text-2xl text-emerald-400">{formatKes(grandTotal)}</span>
            </div>

            {/* Floating Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  if (!canVoidOrder) return;
                  setCart([]);
                  setActivatedProductIds([]);
                  clearActivePosCart(currentUser.id || currentUser.email).catch(() => {});
                }}
                disabled={cart.length === 0 || !canVoidOrder}
                className={`min-h-[42px] px-3.5 py-2 border rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 transition-colors ${
                  !canVoidOrder
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : 'bg-white hover:bg-red-50 text-red-600 border-slate-200 cursor-pointer disabled:opacity-40'
                }`}
                title={
                  !canVoidOrder
                    ? 'Order void authorization stripped by Administrator'
                    : 'Clear active cart'
                }
              >
                <Trash2 className="w-4 h-4" />
                <span>{canVoidOrder ? 'Clear' : 'Locked'}</span>
              </button>
              <button
                type="button"
                disabled={cart.length === 0 || isProcessing}
                onClick={handleCompleteCheckout}
                className="flex-1 min-h-[42px] py-2 px-4 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] disabled:opacity-40 text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                {paymentMethod === 'M-Pesa Till / Instant Card' ? (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'Processing Settlement...'
                        : `Lipa M-Pesa & Print (${formatKes(grandTotal)})`}
                    </span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'Issuing Document...'
                        : `Commit & Print (${formatKes(grandTotal)})`}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Phone Camera Barcode Scanner Viewfinder Modal */}
      <PhoneBarcodeScannerModal
        isOpen={isPhoneScannerOpen}
        onClose={() => setIsPhoneScannerOpen(false)}
        onBarcodeScanned={handleScanBarcode}
      />

      {/* Instant Phone Barcode Scanner QR Pairing Modal */}
      {isPhonePairModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border-2 border-[#0A006E] animate-in fade-in zoom-in-95">
            <div className="bg-[#0A006E] text-white p-4.5 flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-sm text-[#FFDE00]">
                    Instant Phone Barcode Scanner Link
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Beam bottle barcodes from your phone directly into this cashier register
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPhonePairModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 text-center space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <span className="text-slate-600">Active Cashier Account:</span>
                <span className="font-montserrat font-black text-[#0A006E]">
                  {currentUser.name} ({currentUser.role})
                </span>
              </div>

              {/* QR Code Container */}
              <div className="p-4 bg-white border-2 border-dashed border-[#0A006E]/30 rounded-2xl inline-block shadow-inner">
                {pairingQrDataUrl ? (
                  <img
                    src={pairingQrDataUrl}
                    alt="Pairing QR Code"
                    className="w-56 h-56 mx-auto rounded-lg"
                  />
                ) : (
                  <div className="w-56 h-56 flex items-center justify-center text-xs text-slate-400">
                    Generating QR code...
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <p className="font-montserrat font-bold text-slate-800">
                  📱 How to Scan Bottles with Your Phone:
                </p>
                <ol className="text-left text-[11px] space-y-1 list-decimal list-inside bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700">
                  <li>Open the Camera app on your mobile phone.</li>
                  <li>Scan the QR code above to launch the Mobile Scanner Station.</li>
                  <li>Aim at any bottle barcode — it will <strong>instant show on this desktop cashier</strong> and the total increases automatically!</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsPhoneCompanionModalOpen(true)}
                  className="flex-1 py-2.5 px-3 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition"
                >
                  <Camera className="w-4 h-4" />
                  <span>Launch Scanner on this Screen</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(pairingUrl);
                    setStatusMessage('Phone pairing link copied to clipboard!');
                  }}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer"
                  title="Copy direct pairing link"
                >
                  Copy Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Phone Scanner Companion Modal */}
      {isPhoneCompanionModalOpen && (
        <PhoneScannerCompanion
          products={products}
          staffId={currentUser.id}
          staffName={currentUser.name}
          staffEmail={currentUser.email || ''}
          staffRole={currentUser.role}
          branchId={activeBranch?.id}
          branches={branches}
          regions={regions}
          onClose={() => setIsPhoneCompanionModalOpen(false)}
        />
      )}
    </div>
  );
};
