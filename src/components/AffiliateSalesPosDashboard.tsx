/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Send,
  CreditCard,
  CheckCircle2,
  Clock,
  User,
  Phone,
  FileText,
  Package,
  Layers,
  TrendingUp,
  DollarSign,
  Building2,
  Trash2,
  Plus,
  Minus,
  X,
  Printer,
  Share2,
  Copy,
  Check,
  Percent,
  MapPin,
  ExternalLink,
  Store,
  Tag,
  AlertCircle,
  HelpCircle,
  Sparkles,
  QrCode,
  ArrowRight,
  RefreshCw,
  Download,
  Barcode,
  Camera,
  ScanLine,
  Keyboard,
} from 'lucide-react';
import {
  Product,
  Branch,
  GeoRegion,
  TransactionDoc,
  StaffMember,
  StockCategory,
} from '../types';
import { calculateGeoPrice, formatKes, exportReportToPDF, exportToCSV } from '../erpUtils';
import { playPosBeep, triggerScanHaptic } from '../utils/audioBeep';
import { ProductImage } from './ProductImage';
import { EtimsReceiptModal, EtimsReceiptData } from './EtimsReceiptModal';
import { PhoneBarcodeScannerModal } from './PhoneBarcodeScannerModal';
import { subscribeToProductScans } from '../utils/productScanBroadcast';
import { FloatingSalesKeyboardModal } from './FloatingSalesKeyboardModal';
import { ProductPreviewModal } from './ProductPreviewModal';

interface CartItem {
  productId: string;
  product: Product;
  unitMode: 'Bottle' | 'Case';
  quantity: number;
  unitPrice: number;
  packSize: number;
  totalBottles: number;
  affiliateMarkupPerUnit: number;
  lineTotal: number;
}

interface QueuedSlipData {
  token: string;
  docNumber: string;
  customerName: string;
  customerPhone: string;
  items: { name: string; qty: number; unitMode: string; price: number }[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  branchName: string;
  affiliateName: string;
  affiliateCode: string;
  earnedCommission: number;
  notes?: string;
  createdAt: string;
}

interface AffiliateSalesPosDashboardProps {
  currentUser: StaffMember;
  products: Product[];
  branches: Branch[];
  regions: GeoRegion[];
  transactions: TransactionDoc[];
  onCommitTransaction: (
    txDraft: Omit<TransactionDoc, 'id' | 'createdAt'>,
    updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[]
  ) => Promise<TransactionDoc | null>;
  onUpdateTransaction?: (
    txId: string,
    updates: Partial<TransactionDoc>,
    updatedProducts?: { productId: string; newTotal: number; newBranchStockJson: string }[]
  ) => Promise<boolean>;
  onPreviewDoc: (doc: TransactionDoc) => void;
  onNavigateModule?: (module: any) => void;
}

const DRINK_CATEGORIES = [
  { id: 'ALL', label: 'All Drinks' },
  { id: 'Whisky', label: 'Whiskies' },
  { id: 'Vodka', label: 'Vodkas' },
  { id: 'Gin', label: 'Gins' },
  { id: 'Rum', label: 'Rums' },
  { id: 'Tequila', label: 'Tequilas' },
  { id: 'Cognac & Brandy', label: 'Cognacs & Brandies' },
  { id: 'Champagne & Wine', label: 'Wines & Champagne' },
  { id: 'Beer & Cider', label: 'Beers & Ciders' },
  { id: 'Liqueur & Cream', label: 'Liqueurs & Creams' },
];

export const AffiliateSalesPosDashboard: React.FC<AffiliateSalesPosDashboardProps> = ({
  currentUser,
  products,
  branches,
  regions,
  transactions,
  onCommitTransaction,
  onUpdateTransaction,
  onPreviewDoc,
  onNavigateModule,
}) => {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<'pos' | 'orders' | 'sales_statement'>('pos');

  // Download Order Statement PDF
  const handleDownloadOrderStatementPDF = () => {
    const filename = `Vaairo_Order_Statement_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    exportReportToPDF(
      `OFFICIAL AFFILIATE ORDER STATEMENT — ${currentUser.name.toUpperCase()} (${affiliateCode})`,
      `Branch Depot: ${currentUser.branchName} | Assigned Commission: ${commPct}%`,
      ['Doc Number', 'Date & Time', 'Customer Name', 'Channel', 'Branch', 'Total Amount (KES)', 'Commission (KES)', 'Status'],
      ownTransactions.map((tx) => [
        tx.docNumber,
        new Date(tx.createdAt).toLocaleString(),
        tx.customerName,
        tx.channel,
        tx.branchName,
        Math.round(tx.totalAmount).toLocaleString(),
        Math.round((tx.totalAmount * commPct) / 100).toLocaleString(),
        tx.status,
      ]),
      filename
    );
  };

  // Download Order Statement CSV
  const handleDownloadOrderStatementCSV = () => {
    const filename = `Vaairo_Order_Statement_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    exportToCSV(
      filename,
      ['Doc Number', 'Date & Time', 'Customer Name', 'Channel', 'Branch', 'Total Amount (KES)', 'Commission (KES)', 'Status'],
      ownTransactions.map((tx) => [
        tx.docNumber,
        new Date(tx.createdAt).toLocaleString(),
        tx.customerName,
        tx.channel,
        tx.branchName,
        Math.round(tx.totalAmount),
        Math.round((tx.totalAmount * commPct) / 100),
        tx.status,
      ])
    );
  };

  // Download Sales Statement PDF
  const handleDownloadSalesStatementPDF = () => {
    const filename = `Vaairo_Sales_Statement_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    exportReportToPDF(
      `OFFICIAL AFFILIATE SALES & COMMISSION STATEMENT — ${currentUser.name.toUpperCase()} (${affiliateCode})`,
      `Total Volume: ${formatKes(totalSalesVolume)} | Total Earned Commission: ${formatKes(totalEarnedCommission)} | Branch: ${currentUser.branchName}`,
      ['Order / Invoice', 'Date', 'Customer', 'Items Summary', 'Sales Volume (KES)', 'Commission (KES)', 'Payment Method'],
      ownTransactions.map((tx) => [
        tx.docNumber,
        new Date(tx.createdAt).toLocaleDateString(),
        tx.customerName,
        tx.itemsSummary || 'Multiple Items',
        Math.round(tx.totalAmount).toLocaleString(),
        Math.round((tx.totalAmount * commPct) / 100).toLocaleString(),
        tx.paymentMethod,
      ]),
      filename
    );
  };

  // Download Sales Statement CSV
  const handleDownloadSalesStatementCSV = () => {
    const filename = `Vaairo_Sales_Statement_${currentUser.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
    exportToCSV(
      filename,
      ['Order / Invoice', 'Date', 'Customer', 'Items Summary', 'Sales Volume (KES)', 'Commission (KES)', 'Payment Method'],
      ownTransactions.map((tx) => [
        tx.docNumber,
        new Date(tx.createdAt).toLocaleDateString(),
        tx.customerName,
        tx.itemsSummary || 'Multiple Items',
        Math.round(tx.totalAmount),
        Math.round((tx.totalAmount * commPct) / 100),
        tx.paymentMethod,
      ])
    );
  };

  // Branch & Region Scope (default to affiliate's assigned branch)
  const defaultBranch = useMemo(
    () => branches.find((b) => b.id === currentUser.branchId) || branches[0],
    [branches, currentUser.branchId]
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranch?.id || '');
  const activeBranch = useMemo(
    () => branches.find((b) => b.id === selectedBranchId) || defaultBranch,
    [branches, selectedBranchId, defaultBranch]
  );

  const activeRegion = useMemo(() => {
    if (activeBranch?.regionId) {
      return regions.find((r) => r.id === activeBranch.regionId) || regions[0];
    }
    return regions[0];
  }, [regions, activeBranch]);

  // Product Catalog Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [priceType, setPriceType] = useState<'wholesale' | 'retail'>('wholesale');

  // Active POS Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [dispatchType, setDispatchType] = useState<'counter_pickup' | 'field_delivery'>('counter_pickup');
  const [showAllCartItems, setShowAllCartItems] = useState(false);

  // Modals & UI States
  const [isProcessing, setIsProcessing] = useState(false);
  const [queuedSlip, setQueuedSlip] = useState<QueuedSlipData | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<'M-Pesa Express' | 'Cash' | 'Bank EFT / Cheque' | 'Credit'>('M-Pesa Express');
  const [checkoutMpesaPhone, setCheckoutMpesaPhone] = useState('');
  const [checkoutCashTendered, setCheckoutCashTendered] = useState<number>(0);
  const [etimsReceipt, setEtimsReceipt] = useState<EtimsReceiptData | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<any>(null);
  const [visibleLimit, setVisibleLimit] = useState<number>(36);

  const handleOpenPreview = (prod: any) => {
    setPreviewProduct(prod);
    setIsPreviewOpen(true);
  };

  // Orders Filter State (for Tab 2)
  const [ordersFilterStatus, setOrdersFilterStatus] = useState<'ALL' | 'QUEUED' | 'PAID'>('ALL');
  const [ordersSearch, setOrdersSearch] = useState('');

  // Affiliate Performance Metrics
  const commPct = currentUser.agreedCommissionPct || 8;
  const affiliateCode = `AFF-${currentUser.name.slice(0, 3).toUpperCase()}-${(currentUser.id || '01').slice(-3).toUpperCase()}`;

  const ownTransactions = useMemo(() => {
    return transactions.filter(
      (t) =>
        t.createdBy === currentUser.name ||
        t.createdBy === currentUser.email ||
        t.affiliateCode === currentUser.id ||
        t.affiliateCode === affiliateCode
    );
  }, [transactions, currentUser, affiliateCode]);

  const paidTransactions = useMemo(() => {
    return ownTransactions.filter((t) => t.status === 'Paid' || t.status === 'Approved' || t.status === 'Fulfilled');
  }, [ownTransactions]);

  const queuedTransactions = useMemo(() => {
    return ownTransactions.filter(
      (t) =>
        t.status === 'Pending Verification' &&
        (t.channel === 'Affiliate Rep' || t.paymentMethod?.toLowerCase().includes('cashier'))
    );
  }, [ownTransactions]);

  const totalSalesVolume = useMemo(() => {
    return paidTransactions.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
  }, [paidTransactions]);

  const totalEarnedCommission = useMemo(() => {
    return Math.round((totalSalesVolume * commPct) / 100);
  }, [totalSalesVolume, commPct]);

  // Today's Performance Metrics for this specific logged in user
  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const userTodayTransactions = useMemo(() => {
    return ownTransactions.filter((t) => t.createdAt?.startsWith(todayDateStr));
  }, [ownTransactions, todayDateStr]);

  const userTodayPaidTransactions = useMemo(() => {
    return userTodayTransactions.filter(
      (t) => t.status === 'Paid' || t.status === 'Approved' || t.status === 'Fulfilled'
    );
  }, [userTodayTransactions]);

  const userTodaySalesVolume = useMemo(() => {
    return userTodayPaidTransactions.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
  }, [userTodayPaidTransactions]);

  const userTodayTotalAllOrdersVolume = useMemo(() => {
    return userTodayTransactions.reduce((acc, t) => acc + (t.totalAmount || 0), 0);
  }, [userTodayTransactions]);

  const userTodayCommission = useMemo(() => {
    const baseVolume = userTodaySalesVolume > 0 ? userTodaySalesVolume : userTodayTotalAllOrdersVolume;
    return Math.round((baseVolume * commPct) / 100);
  }, [userTodaySalesVolume, userTodayTotalAllOrdersVolume, commPct]);

  // Barcode Scanner & Real-Time Sync States
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [liveScanNotice, setLiveScanNotice] = useState<{
    text: string;
    productName: string;
    timestamp: number;
  } | null>(null);
  const [newlyScannedId, setNewlyScannedId] = useState<string | null>(null);

  // Subscribe to real-time product scans from Inventory or other portals
  useEffect(() => {
    const unsub = subscribeToProductScans((evt) => {
      setNewlyScannedId(evt.productId);
      setLiveScanNotice({
        text: `⚡ Live Scan: "${evt.name}" (Barcode: ${evt.barcode}) was just scanned and is now live for sales!`,
        productName: evt.name,
        timestamp: Date.now(),
      });
      playPosBeep('success');
      triggerScanHaptic();
      const timer = setTimeout(() => setNewlyScannedId(null), 8000);
      return () => clearTimeout(timer);
    });
    return () => unsub();
  }, []);

  // Auto-dismiss live scan banner after 5s
  useEffect(() => {
    if (liveScanNotice) {
      const timer = setTimeout(() => setLiveScanNotice(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [liveScanNotice]);

  // Branch stock resolver
  const getProductBranchStock = (product: Product): number => {
    if (product.branchStockSummary && activeBranch) {
      try {
        const summary = JSON.parse(product.branchStockSummary);
        if (typeof summary[activeBranch.id] === 'number') {
          return summary[activeBranch.id];
        }
      } catch {}
    }
    if (product.totalBottles && product.totalBottles > 0) {
      return Math.max(12, Math.floor(product.totalBottles / Math.max(1, branches.length)));
    }
    if (product.hasRealBarcode || product.isScanned) {
      return 24; // Newly scanned item is immediately available
    }
    return 0;
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Instantly show any product that is scanned & has a barcode
      const isScannedAndReady = Boolean(
        (prod.isScanned || prod.hasRealBarcode || prod.isOnboarded) &&
        prod.barcode &&
        prod.status !== ('Deleted' as any)
      );
      if (!isScannedAndReady) return false;

      if (categoryFilter !== 'ALL') {
        const matchesCat =
          prod.subCategory === categoryFilter ||
          (prod.category && prod.category.toLowerCase() === categoryFilter.toLowerCase()) ||
          (prod.name && prod.name.toLowerCase().includes(categoryFilter.toLowerCase()));
        if (!matchesCat) return false;
      }
      const stock = getProductBranchStock(prod);
      // REQUIREMENT: Must have stock in their branch
      if (stock <= 0) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesSku = prod.sku.toLowerCase().includes(q);
        const matchesCategory = (prod.category || '').toLowerCase().includes(q);
        const matchesBrand = (prod.subCategory || '').toLowerCase().includes(q);
        const matchesBarcode = (prod.barcode || '').toLowerCase().includes(q);
        if (!matchesName && !matchesSku && !matchesCategory && !matchesBrand && !matchesBarcode) {
          return false;
        }
      }
      return true;
    });
  }, [products, categoryFilter, inStockOnly, searchQuery, activeBranch]);

  // Reset pagination limit on search or category filter change
  useEffect(() => {
    setVisibleLimit(36);
  }, [searchQuery, categoryFilter]);

  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleLimit);
  }, [filteredProducts, visibleLimit]);

  // Pricing helper
  const getProductPrices = (product: Product) => {
    const geoPrice = calculateGeoPrice(product, activeRegion, priceType);
    const packSize = product.packSize || product.bottlesPerCase || 12;
    const bottlePrice = geoPrice.unitBottlePrice;
    const casePrice = geoPrice.casePrice;

    return { bottlePrice, casePrice, packSize };
  };

  // Add Product to Cart
  const handleAddToCart = (product: Product, unitMode: 'Bottle' | 'Case', qty: number = 1) => {
    const { bottlePrice, casePrice, packSize } = getProductPrices(product);
    const unitPrice = unitMode === 'Bottle' ? bottlePrice : casePrice;
    const totalBottles = unitMode === 'Bottle' ? qty : qty * packSize;

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.productId === product.id && item.unitMode === unitMode
      );
      if (existingIdx >= 0) {
        const next = [...prev];
        const updatedQty = next[existingIdx].quantity + qty;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: updatedQty,
          totalBottles: unitMode === 'Bottle' ? updatedQty : updatedQty * packSize,
          lineTotal: updatedQty * (next[existingIdx].unitPrice + next[existingIdx].affiliateMarkupPerUnit),
        };
        return next;
      }
      const newItem: CartItem = {
        productId: product.id,
        product,
        unitMode,
        quantity: qty,
        unitPrice,
        packSize,
        totalBottles,
        affiliateMarkupPerUnit: 0,
        lineTotal: qty * unitPrice,
      };
      return [...prev, newItem];
    });

    playPosBeep('success');
  };

  // Instant barcode scan handler for laser gun and camera
  const handleScanBarcode = (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return { success: false, message: 'Empty barcode' };
    const digitsOnly = code.replace(/\D/g, '');

    let matched = products.find(
      (p) =>
        (p.barcode && p.barcode.trim() === code) ||
        (p.caseBarcode && p.caseBarcode.trim() === code) ||
        (p.sku && p.sku.toLowerCase() === code.toLowerCase())
    );

    if (!matched && digitsOnly) {
      matched = products.find((p) => {
        const pBottle = p.barcode ? p.barcode.replace(/\D/g, '') : '';
        const pCase = p.caseBarcode ? p.caseBarcode.replace(/\D/g, '') : '';
        return (
          (pBottle && (pBottle === digitsOnly || pBottle.endsWith(digitsOnly))) ||
          (pCase && (pCase === digitsOnly || pCase.endsWith(digitsOnly)))
        );
      });
    }

    if (!matched) {
      playPosBeep('error');
      setLiveScanNotice({
        text: `Barcode "${code}" not found in catalog`,
        productName: 'Unknown',
        timestamp: Date.now(),
      });
      return { success: false, message: `Barcode "${code}" not found` };
    }

    const isCase = Boolean(matched.caseBarcode && matched.caseBarcode.trim() === code);
    handleAddToCart(matched, isCase ? 'Case' : 'Bottle', 1);
    playPosBeep(isCase ? 'case' : 'success');
    triggerScanHaptic();
    setLiveScanNotice({
      text: `⚡ Scanned & Added: ${matched.name} (${isCase ? 'Case' : 'Bottle'})`,
      productName: matched.name,
      timestamp: Date.now(),
    });
    setBarcodeInput('');
    return { success: true, message: `Added ${matched.name}` };
  };

  // Update Cart Item Quantity
  const handleUpdateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const newQty = target.quantity + delta;
      if (newQty <= 0) {
        next.splice(index, 1);
        playPosBeep('error');
        return next;
      }
      const totalBottles = target.unitMode === 'Bottle' ? newQty : newQty * target.packSize;
      next[index] = {
        ...target,
        quantity: newQty,
        totalBottles,
        lineTotal: newQty * (target.unitPrice + target.affiliateMarkupPerUnit),
      };
      playPosBeep('case');
      return next;
    });
  };

  // Update Cart Item Markup
  const handleUpdateMarkup = (index: number, markup: number) => {
    setCart((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const safeMarkup = Math.max(0, markup);
      next[index] = {
        ...target,
        affiliateMarkupPerUnit: safeMarkup,
        lineTotal: target.quantity * (target.unitPrice + safeMarkup),
      };
      return next;
    });
  };

  // Remove Item
  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
    playPosBeep('error');
  };

  // Cart Financials
  const cartSubtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.lineTotal, 0);
  }, [cart]);

  const cartVatAndExcise = useMemo(() => {
    return Math.round(cartSubtotal * 0.16);
  }, [cartSubtotal]);

  const cartGrandTotal = useMemo(() => {
    return cartSubtotal; // VAT is included in quote or added based on wholesale terms
  }, [cartSubtotal]);

  const cartAffiliateBaseComm = useMemo(() => {
    return Math.round((cartSubtotal * commPct) / 100);
  }, [cartSubtotal, commPct]);

  const cartAffiliateMarkupTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.affiliateMarkupPerUnit * item.quantity, 0);
  }, [cart]);

  const cartTotalEarnings = useMemo(() => {
    return cartAffiliateBaseComm + cartAffiliateMarkupTotal;
  }, [cartAffiliateBaseComm, cartAffiliateMarkupTotal]);

  const totalUnitsInCart = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // -------------------------------------------------------------------------
  // ACTION 1: QUEUE TO CASHIER (Send Order to Branch Cashier Register)
  // -------------------------------------------------------------------------
  const handleQueueToCashier = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty. Please add items to queue this order.');
      return;
    }
    if (!customerName.trim()) {
      alert('Please enter a Customer or Venue Name for this order.');
      return;
    }

    setIsProcessing(true);
    const tokenNumber = `Q-AFF-${Math.floor(1000 + Math.random() * 9000)}`;
    const docNumber = `ORD-AFF-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const lineItemsSummary = cart.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      sku: item.product.sku,
      unitMode: item.unitMode,
      quantity: item.quantity,
      unitPrice: item.unitPrice + item.affiliateMarkupPerUnit,
      lineTotal: item.lineTotal,
      packSize: item.packSize,
      totalBottles: item.totalBottles,
      affiliateMarkup: item.affiliateMarkupPerUnit,
    }));

    const txDraft: Omit<TransactionDoc, 'id' | 'createdAt'> = {
      docNumber,
      docType: 'Invoice',
      channel: 'Affiliate Rep',
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      regionId: activeRegion.id,
      regionName: activeRegion.name,
      customerName: `${customerName.trim()}${customerPhone ? ` (${customerPhone.trim()})` : ''}`,
      customerLicenseNo: customerPhone.trim() ? `TEL:${customerPhone.trim()}` : `QUEUE-TOKEN:${tokenNumber}`,
      itemsSummary: JSON.stringify(lineItemsSummary),
      subtotal: cartSubtotal,
      exciseAndTax: cartVatAndExcise,
      totalAmount: cartGrandTotal,
      paymentMethod: `Queued at Cashier Counter · Token: ${tokenNumber}`,
      status: 'Pending Verification',
      createdBy: currentUser.name,
      createdByRole: currentUser.role,
      affiliateCode: currentUser.id || affiliateCode,
      relatedInvoiceNo: tokenNumber,
      creditReason: customerNotes ? `Notes: ${customerNotes}` : `Dispatch: ${dispatchType === 'counter_pickup' ? 'Counter Pickup' : 'Field Delivery'}`,
    };

    try {
      // Stock is not deducted until payment is finalized by the cashier, so updatedProducts = []
      const created = await onCommitTransaction(txDraft, []);
      if (created) {
        playPosBeep('case');
        setQueuedSlip({
          token: tokenNumber,
          docNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          items: cart.map((i) => ({
            name: i.product.name,
            qty: i.quantity,
            unitMode: i.unitMode,
            price: i.unitPrice + i.affiliateMarkupPerUnit,
          })),
          subtotal: cartSubtotal,
          tax: cartVatAndExcise,
          totalAmount: cartGrandTotal,
          branchName: activeBranch.name,
          affiliateName: currentUser.name,
          affiliateCode,
          earnedCommission: cartTotalEarnings,
          notes: customerNotes,
          createdAt: now,
        });

        // Reset cart for next customer
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerNotes('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // -------------------------------------------------------------------------
  // ACTION 2: DIRECT CHECKOUT (Instant Payment & eTIMS Receipt)
  // -------------------------------------------------------------------------
  const handleOpenCheckoutModal = () => {
    if (cart.length === 0) {
      alert('Your cart is empty. Please add items to checkout.');
      return;
    }
    if (!customerName.trim()) {
      alert('Please enter a Customer or Venue Name for this order.');
      return;
    }
    setCheckoutMpesaPhone(customerPhone || '');
    setCheckoutCashTendered(cartGrandTotal);
    setIsCheckoutModalOpen(true);
  };

  const handleConfirmDirectCheckout = async () => {
    setIsProcessing(true);
    const docNumber = `REC-AFF-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const lineItemsSummary = cart.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      sku: item.product.sku,
      unitMode: item.unitMode,
      quantity: item.quantity,
      unitPrice: item.unitPrice + item.affiliateMarkupPerUnit,
      lineTotal: item.lineTotal,
      packSize: item.packSize,
      totalBottles: item.totalBottles,
      affiliateMarkup: item.affiliateMarkupPerUnit,
    }));

    // Deduct central liquor bottles for this branch
    const updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[] = [];
    for (const item of cart) {
      const prod = products.find((p) => p.id === item.productId);
      if (prod && item.totalBottles > 0) {
        const fallbackTotal = prod.totalBottles ?? (prod.packSize || 12) * 20;
        let branchMap: Record<string, number> = {};
        try {
          branchMap = prod.branchStockSummary ? JSON.parse(prod.branchStockSummary) : {};
        } catch {
          branchMap = {};
        }
        const currentBranchQty = branchMap[activeBranch.id] ?? fallbackTotal;
        const nextBranchQty = Math.max(0, currentBranchQty - item.totalBottles);
        branchMap[activeBranch.id] = nextBranchQty;
        const newTotal = Math.max(0, fallbackTotal - item.totalBottles);

        updatedProducts.push({
          productId: prod.id,
          newTotal,
          newBranchStockJson: JSON.stringify(branchMap),
        });
      }
    }

    const txDraft: Omit<TransactionDoc, 'id' | 'createdAt'> = {
      docNumber,
      docType: 'Receipt',
      channel: 'Affiliate Rep',
      branchId: activeBranch.id,
      branchName: activeBranch.name,
      regionId: activeRegion.id,
      regionName: activeRegion.name,
      customerName: `${customerName.trim()}${customerPhone ? ` (${customerPhone.trim()})` : ''}`,
      customerLicenseNo: customerPhone.trim() ? `TEL:${customerPhone.trim()}` : 'DIRECT-SALE',
      itemsSummary: JSON.stringify(lineItemsSummary),
      subtotal: cartSubtotal,
      exciseAndTax: cartVatAndExcise,
      totalAmount: cartGrandTotal,
      paymentMethod: checkoutPaymentMethod,
      status: 'Paid',
      createdBy: currentUser.name,
      createdByRole: currentUser.role,
      affiliateCode: currentUser.id || affiliateCode,
      relatedInvoiceNo: `ETIMS-2026-${Date.now().toString().slice(-8)}`,
      creditReason: `Direct Affiliate Checkout · Commission credited: ${formatKes(cartTotalEarnings)}`,
    };

    try {
      const created = await onCommitTransaction(txDraft, updatedProducts);
      if (created) {
        playPosBeep('success');
        setIsCheckoutModalOpen(false);

        // Prepare eTIMS Receipt
        const receiptData: EtimsReceiptData = {
          invoiceNumber: docNumber,
          invoiceDate: now,
          sellerPin: 'P051239841Z',
          cuSerialNumber: 'KRA-CU-098418',
          deviceSerialNumber: `VAAIRO-POS-${activeBranch.code || 'BR01'}`,
          kraControlCode: `KRA-ETIMS-${Date.now().toString().slice(-8)}`,
          branchName: activeBranch.name,
          servedByName: `${currentUser.name} (Field Affiliate Rep)`,
          buyerName: customerName.trim() || 'Valued Customer',
          buyerPin: 'AGE-21-VERIFIED',
          paymentMethod: checkoutPaymentMethod,
          mpesaReceiptNumber: checkoutPaymentMethod.includes('M-Pesa') ? `Q${Math.random().toString(36).substring(2, 8).toUpperCase()}` : undefined,
          items: cart.map((i) => ({
            productName: i.product.name,
            sku: i.product.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice + i.affiliateMarkupPerUnit,
            totalAmount: i.lineTotal,
          })),
          taxableAmount: Math.round(cartGrandTotal / 1.16),
          taxAmount: Math.round(cartGrandTotal - cartGrandTotal / 1.16),
          totalInvoiceAmount: cartGrandTotal,
          qrCodeUrl: `https://itax.kra.go.ke/KRA-Portal/invoiceConfirmation.htm?invNumber=${docNumber}`,
          affiliateName: currentUser.name,
          affiliateProfitAmount: cartTotalEarnings,
        };

        setEtimsReceipt(receiptData);

        // Clear cart
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerNotes('');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy Ticket Details to Clipboard
  const handleCopyTicket = () => {
    if (!queuedSlip) return;
    const text = `VAAIRO POS - QUEUED ORDER TOKEN\nToken: ${queuedSlip.token}\nCustomer: ${queuedSlip.customerName}\nDepot: ${queuedSlip.branchName}\nTotal Amount: ${formatKes(queuedSlip.totalAmount)}\nSales Rep: ${queuedSlip.affiliateName} (${queuedSlip.affiliateCode})\nPlease present this token at the branch cashier counter to pay and collect items.`;
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    if (!queuedSlip) return;
    const text = `*VAAIRO POS ORDER QUEUE SLIP*\n*Token:* ${queuedSlip.token}\n*Customer:* ${queuedSlip.customerName}\n*Branch Depot:* ${queuedSlip.branchName}\n*Total:* ${formatKes(queuedSlip.totalAmount)}\n*Items:* ${queuedSlip.items.map((i) => `${i.qty}x ${i.name}`).join(', ')}\n*Representative:* ${queuedSlip.affiliateName}\n\nPresent this Token at the Cashier counter to complete payment and collect your order!`;
    const url = `https://wa.me/${queuedSlip.customerPhone ? queuedSlip.customerPhone.replace(/[^0-9]/g, '') : ''}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-4">
      {/* --------------------------------------------------------------------- */}
      {/* 1. TOP HERO: SIMPLE & STREAMLINED AFFILIATE COMMAND BAR               */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#0A006E] text-white rounded-2xl p-3.5 sm:p-4 shadow-sm border border-[#0A006E]/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Identity & Branch */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-montserrat font-black text-sm shrink-0 shadow-2xs">
              {currentUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-montserrat font-black text-white truncate">
                  {currentUser.name}
                </h1>
                <span className="text-[#FFDE00] text-[11px] font-mono font-bold px-2 py-0.5 bg-white/10 rounded-md">
                  {affiliateCode}
                </span>
                <span className="text-[10px] font-montserrat font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  {commPct}% Comm
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                <Building2 className="w-3 h-3 text-[#FFDE00] shrink-0" />
                <span className="truncate">{currentUser.branchName} Depot</span>
              </p>
            </div>
          </div>

          {/* Simple Inline Key Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="bg-white/10 rounded-xl px-2.5 py-1.5 border border-white/10">
              <span className="text-[9px] text-slate-300 block uppercase font-mono">Commission</span>
              <span className="text-xs sm:text-sm font-montserrat font-black text-[#FFDE00] font-mono-tabular">
                {formatKes(totalEarnedCommission)}
              </span>
            </div>

            <div className="bg-white/10 rounded-xl px-2.5 py-1.5 border border-white/10">
              <span className="text-[9px] text-slate-300 block uppercase font-mono">Fulfilled</span>
              <span className="text-xs sm:text-sm font-montserrat font-black text-white font-mono-tabular">
                {formatKes(totalSalesVolume)}
              </span>
            </div>

            {queuedTransactions.length > 0 && (
              <div className="bg-amber-400/20 border border-amber-300/40 rounded-xl px-2.5 py-1.5">
                <span className="text-[9px] text-amber-200 block uppercase font-mono">Queued</span>
                <span className="text-xs sm:text-sm font-montserrat font-black text-amber-300 font-mono-tabular">
                  {queuedTransactions.length} orders
                </span>
              </div>
            )}

            {/* Simple Segmented Tab Toggle */}
            <div className="flex items-center bg-black/30 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className={`px-3 py-1.5 rounded-lg font-montserrat font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'pos'
                    ? 'bg-[#FFDE00] text-[#0A006E] shadow-2xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>POS</span>
                {totalUnitsInCart > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-[#0A006E] text-[#FFDE00] text-[10px] font-black">
                    {totalUnitsInCart}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className={`px-3 py-1.5 rounded-lg font-montserrat font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'orders'
                    ? 'bg-[#FFDE00] text-[#0A006E] shadow-2xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Order Statement</span>
                {queuedTransactions.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-[#0A006E] text-[10px] font-black">
                    {queuedTransactions.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sales_statement')}
                className={`px-3 py-1.5 rounded-lg font-montserrat font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeTab === 'sales_statement'
                    ? 'bg-[#FFDE00] text-[#0A006E] shadow-2xs'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Sales Statement</span>
              </button>

              <button
                type="button"
                onClick={() => setIsKeyboardOpen(true)}
                className="px-3 py-1.5 rounded-lg font-montserrat font-black text-xs cursor-pointer transition-all flex items-center gap-1.5 bg-[#FFDE00]/20 hover:bg-[#FFDE00] text-[#FFDE00] hover:text-[#0A006E] border border-[#FFDE00]/40 shadow-xs"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Keyboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. TAB 1: FULL SALES POS TERMINAL WORKSPACE                           */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 7-8 COLUMNS: PRODUCT SEARCH, CATEGORIES & PRODUCT GRID */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-3.5">
            {/* Top Toolbar: Search, Branch Selector, Price Type */}
            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by whisky, gin, brand, barcode, SKU..."
                    className="w-full pl-9 pr-8 py-2 bg-[#F0F2F0] border border-slate-200 focus:border-[#0A006E] rounded-xl text-xs font-semibold text-slate-900 outline-none transition"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Branch Depot Selector (if staff authorized across depots) */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="py-2 px-3 bg-[#F0F2F0] border border-slate-200 rounded-xl text-xs font-montserrat font-bold text-[#0A006E] outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>

                  {/* Price Mode: Wholesale vs Retail */}
                  <div className="flex items-center bg-[#F0F2F0] rounded-xl p-0.5 border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPriceType('wholesale')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-montserrat font-black cursor-pointer transition ${
                        priceType === 'wholesale'
                          ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Wholesale
                    </button>
                    <button
                      type="button"
                      onClick={() => setPriceType('retail')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-montserrat font-black cursor-pointer transition ${
                        priceType === 'retail'
                          ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Retail
                    </button>
                  </div>
                </div>
              </div>

              {/* Instant Barcode Scanning Ribbon for Sales Representatives */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-gradient-to-r from-amber-50 to-emerald-50 border border-emerald-300 rounded-xl">
                <div className="relative flex-1">
                  <Barcode className="w-4 h-4 text-[#0A006E] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleScanBarcode(barcodeInput);
                      }
                    }}
                    placeholder="Scan product barcode (Desktop laser gun, Bluetooth scanner, or type digits)..."
                    className="w-full pl-9 pr-20 py-2 bg-white border border-slate-300 focus:border-[#0A006E] rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleScanBarcode(barcodeInput)}
                      disabled={!barcodeInput.trim()}
                      className="px-2.5 py-1 bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[11px] rounded-lg disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      Scan Item
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCameraScannerOpen(true)}
                  className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                  title="Open device camera barcode scanner"
                >
                  <Camera className="w-4 h-4" />
                  <span>Camera Scanner</span>
                </button>
              </div>

              {/* Real-Time Live Scan Activation Toast */}
              {liveScanNotice && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-400 rounded-xl flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-xs font-montserrat font-bold text-emerald-950">
                      {liveScanNotice.text}
                    </span>
                  </div>
                  <button
                    onClick={() => setLiveScanNotice(null)}
                    className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Category Pills Scroller */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {DRINK_CATEGORIES.map((cat) => {
                  const isActive = categoryFilter === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap cursor-pointer transition shrink-0 ${
                        isActive
                          ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs scale-102'
                          : 'bg-[#F0F2F0] text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white border border-slate-200 rounded-2xl p-6">
                  <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <h4 className="text-sm font-montserrat font-bold text-slate-700">No products match your filter</h4>
                  <p className="text-xs text-slate-500 mt-1">Try clearing your search query or selecting a different category.</p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCategoryFilter('ALL');
                    }}
                    className="mt-3 px-3.5 py-1.5 bg-[#0A006E] text-[#FFDE00] text-xs font-montserrat font-bold rounded-xl cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <>
                  {displayedProducts.map((prod) => {
                    const stock = getProductBranchStock(prod);
                    const { bottlePrice, casePrice, packSize } = getProductPrices(prod);
                    const isOutOfStock = stock <= 0;

                    return (
                      <div
                        key={prod.id}
                        onClick={() => handleOpenPreview(prod)}
                        className={`cursor-pointer bg-white border-2 rounded-2xl p-3 flex flex-col justify-between transition-all hover:shadow-md ${
                          isOutOfStock ? 'border-slate-200 opacity-60' : 'border-slate-200 hover:border-[#0A006E]'
                        }`}
                      >
                        {/* Product Visual Header */}
                        <div className="space-y-2">
                          <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-slate-900">
                            <ProductImage
                              product={{
                                ...prod,
                                category: prod.category === 'LPS' ? 'LPS' : 'IPS',
                              }}
                              size="full"
                              className="w-full h-full object-cover"
                            />
                            {/* Stock Badge */}
                            <div className="absolute top-2 left-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black ${
                                  stock > 10
                                    ? 'bg-[#34D186] text-[#0A006E]'
                                    : stock > 0
                                    ? 'bg-amber-400 text-[#0A006E]'
                                    : 'bg-rose-500 text-white'
                                }`}
                              >
                                {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                              </span>
                            </div>

                            {/* Category Tag */}
                            <div className="absolute top-2 right-2">
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-montserrat font-bold bg-[#0A006E]/80 text-white">
                                {prod.category}
                              </span>
                            </div>

                            {/* Live Scan Flash Banner */}
                            {newlyScannedId === prod.id && (
                              <div className="absolute inset-x-2 bottom-2 z-10 py-1 px-2 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md text-center animate-pulse flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-[#FFDE00]" />
                                <span>⚡ Just Scanned & Live!</span>
                              </div>
                            )}
                          </div>

                          {/* Title & Specs */}
                          <div>
                            <div className="text-[10px] font-mono font-bold text-slate-500">{prod.sku}</div>
                            <h4 className="text-xs font-montserrat font-black text-slate-900 leading-tight line-clamp-1">
                              {prod.name}
                            </h4>
                            <div className="text-[11px] text-slate-600 font-medium">
                              {prod.volumeMl}ml · {prod.abv}% ABV · Pack: {packSize}s
                            </div>
                          </div>
                        </div>

                        {/* Pricing & Add to Cart Controls */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-2">
                          {/* Pricing Details */}
                          <div className="flex items-baseline justify-between">
                            <div>
                              <div className="text-[10px] text-slate-500 font-medium">Per Bottle:</div>
                              <div className="text-xs font-montserrat font-black text-[#0A006E] font-mono-tabular">
                                {formatKes(bottlePrice)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 font-medium">Per Case ({packSize}s):</div>
                              <div className="text-xs font-montserrat font-black text-slate-800 font-mono-tabular">
                                {formatKes(casePrice)}
                              </div>
                            </div>
                          </div>

                          {/* Fast Add Buttons: Bottle vs Case */}
                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(prod, 'Bottle', 1);
                              }}
                              className="py-1.5 px-2 bg-[#F0F2F0] hover:bg-slate-200 active:bg-slate-300 text-[#0A006E] rounded-xl text-[11px] font-montserrat font-bold cursor-pointer transition flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Add 1 Single Bottle to Cart"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Bottle</span>
                            </button>

                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(prod, 'Case', 1);
                              }}
                              className="py-1.5 px-2 bg-[#0A006E] hover:bg-[#080055] active:bg-[#060046] text-[#FFDE00] rounded-xl text-[11px] font-montserrat font-black cursor-pointer transition flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                              title={`Add 1 Full Case (${packSize} bottles) to Cart`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Case</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredProducts.length > displayedProducts.length && (
                    <div className="col-span-full pt-3 pb-2 text-center">
                      <button
                        type="button"
                        onClick={() => setVisibleLimit((prev) => prev + 36)}
                        className="px-6 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-2xl text-xs font-montserrat font-black cursor-pointer shadow-md transition hover:scale-105 inline-flex items-center gap-2"
                      >
                        <span>Load More Products ({filteredProducts.length - displayedProducts.length} remaining)</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* RIGHT 4-5 COLUMNS: ACTIVE SALES CART & PERMANENTLY FLOATING TOTAL CHARGE */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-3.5">
            <div className="bg-white border-2 border-[#0A006E] rounded-2xl shadow-md sticky top-20 flex flex-col h-[calc(100vh-5.5rem)] max-h-[880px] overflow-hidden">
              {/* Fixed Cart Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-3.5 sm:p-4 bg-white/95 backdrop-blur-xs shrink-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-bold shadow-xs">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-montserrat font-black text-[#0A006E]">Sales POS Cart</h3>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {cart.length} line items · {totalUnitsInCart} total units
                    </div>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Clear all items from your sales cart?')) {
                        setCart([]);
                        playPosBeep('error');
                      }
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-montserrat font-bold flex items-center gap-1 cursor-pointer transition active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              {/* Scrollable Center: Client Details & Line Items */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 space-y-3">
                {/* Customer & Destination Details Form */}
                <div className="bg-[#F0F2F0] border border-slate-200 rounded-xl p-3 space-y-2.5 text-xs">
                  <div className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                    Client Details
                  </div>

                  {/* Customer Phone */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Client Phone / M-PESA Number
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="e.g. 0712345678"
                        className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 focus:border-[#0A006E] rounded-lg text-xs font-semibold text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  {/* Dispatch Mode */}
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                      Fulfillment Destination
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDispatchType('counter_pickup')}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-montserrat font-bold cursor-pointer transition text-center ${
                          dispatchType === 'counter_pickup'
                            ? 'bg-[#0A006E] text-[#FFDE00]'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        Counter Pickup
                      </button>
                      <button
                        type="button"
                        onClick={() => setDispatchType('field_delivery')}
                        className={`py-1.5 px-2 rounded-lg text-[10px] font-montserrat font-bold cursor-pointer transition text-center ${
                          dispatchType === 'field_delivery'
                            ? 'bg-[#0A006E] text-[#FFDE00]'
                            : 'bg-white text-slate-700 border border-slate-200'
                        }`}
                      >
                        Field / Direct Delivery
                      </button>
                    </div>
                  </div>
                </div>

                {/* Cart Line Items (displays 2 items by default, rest collapsed) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-montserrat font-bold text-slate-500 px-0.5">
                    <span>Items in Cart</span>
                    <span className="font-mono">{cart.length} item{cart.length === 1 ? '' : 's'} · {totalUnitsInCart} unit{totalUnitsInCart === 1 ? '' : 's'}</span>
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                      <ShoppingCart className="w-7 h-7 mx-auto mb-1 opacity-40 text-[#0A006E]" />
                      <p className="text-xs font-medium">Cart is empty.</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Tap &ldquo;+ Bottle&rdquo; or &ldquo;+ Case&rdquo; on any drink to add.</p>
                    </div>
                  ) : (
                    <>
                      {(showAllCartItems ? cart : cart.slice(0, 2)).map((item, idx) => (
                        <div key={`${item.productId}-${item.unitMode}`} className="bg-slate-50/80 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h5 className="text-xs font-montserrat font-bold text-slate-900 truncate">
                                {item.product.name}
                              </h5>
                              <div className="text-[10px] text-slate-500 font-medium">
                                <span className="font-bold text-[#0A006E]">{item.unitMode}</span> · {formatKes(item.unitPrice)} each
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-xs font-montserrat font-black text-[#0A006E] font-mono-tabular">
                                {formatKes(item.lineTotal)}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          </div>

                          {/* Quantity Controls & Markup field */}
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            {/* Stepper */}
                            <div className="flex items-center bg-white rounded-lg border border-slate-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(idx, -1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-7 text-center text-xs font-montserrat font-black text-slate-900 font-mono-tabular">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(idx, 1)}
                                className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Optional Markup Per Unit */}
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-slate-500 font-medium text-[10px]">Markup:</span>
                              <input
                                type="number"
                                min="0"
                                step="50"
                                value={item.affiliateMarkupPerUnit || ''}
                                onChange={(e) => handleUpdateMarkup(idx, Number(e.target.value))}
                                placeholder="+0"
                                className="w-16 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-center text-[10px] font-mono font-bold text-[#1E9E60] outline-none"
                                title="Add your custom profit markup per unit"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {cart.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setShowAllCartItems(!showAllCartItems)}
                          className="w-full text-center text-xs text-[#0A006E] font-montserrat font-bold py-1.5 underline cursor-pointer hover:text-indigo-900"
                        >
                          {showAllCartItems ? 'Collapse items' : `Show all ${cart.length} items (+${cart.length - 2} more)`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* FLOATING CART TOTAL CHARGE & ACTION BAR - PERMANENTLY FLOATS AT THE BOTTOM, NEVER SCROLLS */}
              <div className="shrink-0 border-t-2 border-[#0A006E]/20 bg-white p-3.5 sm:p-4 space-y-2.5 shadow-[0_-8px_25px_rgba(10,0,110,0.08)] z-20">
                {/* Cart Financials Summary */}
                <div className="space-y-1 bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5">
                  <div className="flex justify-between text-slate-500 text-[11px] font-mono-tabular">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-700">{formatKes(cartSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono-tabular">
                    <span>16% VAT &amp; Excise Included:</span>
                    <span>{formatKes(cartVatAndExcise)}</span>
                  </div>

                  {/* Highlighted Floating Total Charge Bar */}
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200">
                    <span className="text-xs sm:text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wide">
                      Cart Total Charge:
                    </span>
                    <span className="text-lg sm:text-xl font-montserrat font-black text-[#0A006E] font-mono-tabular">
                      {formatKes(cartGrandTotal)}
                    </span>
                  </div>

                  {/* Commission Preview Pill */}
                  <div className="mt-1 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[11px] font-montserrat font-bold text-[#0A006E]">
                    <span className="flex items-center gap-1 text-[10px] text-slate-600">
                      <TrendingUp className="w-3.5 h-3.5 text-[#1E9E60]" />
                      Earnings ({commPct}%):
                    </span>
                    <span className="font-mono-tabular text-xs text-[#1E9E60] font-black">
                      +{formatKes(cartTotalEarnings)}
                    </span>
                  </div>
                </div>

                {/* 2 Primary Floating Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                  {/* 1. BUTTON: QUEUE TO CASHIER */}
                  <button
                    type="button"
                    disabled={isProcessing || cart.length === 0}
                    onClick={handleQueueToCashier}
                    className="py-2.5 px-3 bg-[#FFDE00] hover:bg-amber-400 active:bg-amber-500 text-[#0A006E] border-2 border-[#0A006E] rounded-xl font-montserrat font-black text-xs cursor-pointer shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Send order token to cashier counter for customer payment"
                  >
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="truncate">Queue to Cashier</span>
                  </button>

                  {/* 2. BUTTON: DIRECT CHECKOUT */}
                  <button
                    type="button"
                    disabled={isProcessing || cart.length === 0}
                    onClick={handleOpenCheckoutModal}
                    className="py-2.5 px-3 bg-[#0A006E] hover:bg-[#080055] active:bg-[#060044] text-[#FFDE00] border-2 border-[#0A006E] rounded-xl font-montserrat font-black text-xs cursor-pointer shadow-xs transition-all active:scale-98 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Process direct instant payment & issue eTIMS receipt"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-[#34D186]" />
                    <span className="truncate">Direct Checkout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. TAB 2: MY ORDERS & REAL-TIME QUEUED SALES TRACKER                  */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0A006E]" />
                Official Affiliate Order Statement &amp; Ledger
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comprehensive order statement tracking all orders queued to branch cashiers and completed commercial sales.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadOrderStatementCSV}
                className="px-3 py-2 bg-white border border-[#0A006E] hover:bg-slate-50 text-[#0A006E] rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV Order Statement</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadOrderStatementPDF}
                className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>PDF Order Statement</span>
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 justify-between flex-wrap">
            <button
              type="button"
              onClick={() => setOrdersFilterStatus('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                ordersFilterStatus === 'ALL'
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-[#F0F2F0] text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Orders ({ownTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setOrdersFilterStatus('QUEUED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                ordersFilterStatus === 'QUEUED'
                  ? 'bg-amber-400 text-[#0A006E]'
                  : 'bg-[#F0F2F0] text-slate-700 hover:bg-slate-200'
              }`}
            >
              Queued ({queuedTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setOrdersFilterStatus('PAID')}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
                ordersFilterStatus === 'PAID'
                  ? 'bg-[#1E9E60] text-white'
                  : 'bg-[#F0F2F0] text-slate-700 hover:bg-slate-200'
              }`}
            >
              Paid &amp; Fulfilled ({paidTransactions.length})
            </button>
          </div>

          {/* Search box inside orders */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={ordersSearch}
              onChange={(e) => setOrdersSearch(e.target.value)}
              placeholder="Search by customer name, order doc number, or token..."
              className="w-full pl-9 pr-3 py-2 bg-[#F0F2F0] border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 outline-none"
            />
          </div>

          {/* Table of Orders */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                  <th className="py-2.5 px-3 font-black">Document / Token</th>
                  <th className="py-2.5 px-3 font-black">Customer</th>
                  <th className="py-2.5 px-3 font-black">Branch Depot</th>
                  <th className="py-2.5 px-3 font-black text-right">Order Amount</th>
                  <th className="py-2.5 px-3 font-black text-right">My Commission</th>
                  <th className="py-2.5 px-3 font-black text-center">Status</th>
                  <th className="py-2.5 px-3 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownTransactions
                  .filter((tx) => {
                    if (ordersFilterStatus === 'QUEUED') {
                      return tx.status === 'Pending Verification';
                    }
                    if (ordersFilterStatus === 'PAID') {
                      return tx.status === 'Paid' || tx.status === 'Approved' || tx.status === 'Fulfilled';
                    }
                    return true;
                  })
                  .filter((tx) => {
                    if (!ordersSearch.trim()) return true;
                    const q = ordersSearch.toLowerCase().trim();
                    return (
                      tx.docNumber.toLowerCase().includes(q) ||
                      tx.customerName.toLowerCase().includes(q) ||
                      (tx.relatedInvoiceNo || '').toLowerCase().includes(q)
                    );
                  })
                  .map((tx) => {
                    const isQueued = tx.status === 'Pending Verification';
                    const isPaid = tx.status === 'Paid' || tx.status === 'Approved' || tx.status === 'Fulfilled';
                    const commAmount = Math.round((tx.totalAmount * commPct) / 100);

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-mono-tabular font-bold text-[#0A006E]">{tx.docNumber}</div>
                          {tx.relatedInvoiceNo && (
                            <div className="text-[10px] font-mono font-bold text-amber-700">
                              Token: {tx.relatedInvoiceNo}
                            </div>
                          )}
                          <div className="text-[10px] text-slate-500">
                            {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(tx.createdAt).toLocaleDateString()}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-montserrat font-bold text-slate-900">{tx.customerName}</div>
                          <div className="text-[10px] text-slate-500">{tx.channel}</div>
                        </td>

                        <td className="py-3 px-3 text-slate-700 font-medium">
                          {tx.branchName}
                        </td>

                        <td className="py-3 px-3 text-right font-mono-tabular font-black text-slate-900 text-sm">
                          {formatKes(tx.totalAmount)}
                        </td>

                        <td className="py-3 px-3 text-right font-mono-tabular font-bold text-[#1E9E60]">
                          {formatKes(commAmount)}
                        </td>

                        <td className="py-3 px-3 text-center">
                          {isQueued ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-montserrat font-black bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-700" />
                              QUEUED AT CASHIER
                            </span>
                          ) : isPaid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-montserrat font-black bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/40">
                              <CheckCircle2 className="w-3 h-3 text-[#1E9E60]" />
                              PAID &amp; FULFILLED
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              {tx.status}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          {/* View PDF / Print Modal */}
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(tx)}
                            className="px-2.5 py-1 bg-[#0A006E] hover:bg-[#080055] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-bold cursor-pointer"
                          >
                            View PDF
                          </button>

                          {/* If Queued, show button to re-display token slip */}
                          {isQueued && (
                            <button
                              type="button"
                              onClick={() => {
                                let parsedItems = [];
                                try {
                                  parsedItems = JSON.parse(tx.itemsSummary);
                                } catch {}
                                setQueuedSlip({
                                  token: tx.relatedInvoiceNo || tx.docNumber,
                                  docNumber: tx.docNumber,
                                  customerName: tx.customerName,
                                  customerPhone: '',
                                  items: parsedItems.map((p: any) => ({
                                    name: p.productName || p.name,
                                    qty: p.quantity || 1,
                                    unitMode: p.unitMode || 'Bottle',
                                    price: p.unitPrice || 0,
                                  })),
                                  subtotal: tx.subtotal,
                                  tax: tx.exciseAndTax,
                                  totalAmount: tx.totalAmount,
                                  branchName: tx.branchName,
                                  affiliateName: currentUser.name,
                                  affiliateCode,
                                  earnedCommission: commAmount,
                                  createdAt: tx.createdAt,
                                });
                              }}
                              className="px-2.5 py-1 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-lg text-[11px] font-montserrat font-black cursor-pointer shadow-xs"
                            >
                              Token Slip
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. TAB 3: OFFICIAL AFFILIATE SALES & COMMISSION STATEMENT             */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'sales_statement' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#0A006E]" />
                Official Affiliate Sales &amp; Commission Statement
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Official commercial statement detailing your total gross sales volume, commission earnings, and fulfilled orders.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={handleDownloadSalesStatementCSV}
                className="px-3 py-2 bg-white border border-[#0A006E] hover:bg-slate-50 text-[#0A006E] rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>CSV Sales Statement</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadSalesStatementPDF}
                className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>PDF Sales Statement</span>
              </button>
            </div>
          </div>

          {/* Statement Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#F0F2F0] rounded-2xl p-4 border border-slate-200">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Gross Sales</span>
              <span className="text-lg font-montserrat font-black text-[#0A006E] font-mono-tabular mt-0.5 block">
                {formatKes(totalSalesVolume)}
              </span>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
              <span className="text-[10px] uppercase font-mono text-emerald-700 block">Total Earned Commission ({commPct}%)</span>
              <span className="text-lg font-montserrat font-black text-[#1E9E60] font-mono-tabular mt-0.5 block">
                {formatKes(totalEarnedCommission)}
              </span>
            </div>
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
              <span className="text-[10px] uppercase font-mono text-amber-800 block">Fulfilled Orders Count</span>
              <span className="text-lg font-montserrat font-black text-amber-900 font-mono-tabular mt-0.5 block">
                {paidTransactions.length} orders ({ownTransactions.length} total)
              </span>
            </div>
          </div>

          {/* Sales Transactions Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                  <th className="py-2.5 px-3 font-black">Order / Invoice</th>
                  <th className="py-2.5 px-3 font-black">Date</th>
                  <th className="py-2.5 px-3 font-black">Customer</th>
                  <th className="py-2.5 px-3 font-black">Payment</th>
                  <th className="py-2.5 px-3 font-black text-right">Sales Volume</th>
                  <th className="py-2.5 px-3 font-black text-right">Commission Earned</th>
                  <th className="py-2.5 px-3 font-black text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ownTransactions.map((tx) => {
                  const comm = Math.round((tx.totalAmount * commPct) / 100);
                  const isPaid = tx.status === 'Paid' || tx.status === 'Approved' || tx.status === 'Fulfilled';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-mono font-bold text-[#0A006E]">{tx.docNumber}</td>
                      <td className="py-3 px-3 text-slate-600">{new Date(tx.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{tx.customerName}</td>
                      <td className="py-3 px-3 text-slate-700">{tx.paymentMethod}</td>
                      <td className="py-3 px-3 text-right font-mono-tabular font-black text-slate-900">{formatKes(tx.totalAmount)}</td>
                      <td className="py-3 px-3 text-right font-mono-tabular font-black text-[#1E9E60]">{formatKes(comm)}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 1: QUEUED ORDER TOKEN SLIP (Presented to Customer / Cashier)    */}
      {/* --------------------------------------------------------------------- */}
      {queuedSlip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl max-w-md w-full overflow-hidden p-5 sm:p-6 space-y-4">
            {/* Header Badge */}
            <div className="text-center space-y-1">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-montserrat font-black bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]">
                <Clock className="w-3.5 h-3.5" />
                QUEUED TO BRANCH CASHIER
              </span>
              <h2 className="text-2xl font-montserrat font-black text-[#0A006E] tracking-tight">
                Order Token Slip
              </h2>
              <p className="text-xs text-slate-600">
                Show this token to any cashier at <strong>{queuedSlip.branchName}</strong> to pay and receive goods.
              </p>
            </div>

            {/* Giant Token Code Display */}
            <div className="bg-[#0A006E] text-white rounded-2xl p-4 text-center space-y-1 relative overflow-hidden shadow-inner">
              <div className="text-[11px] font-montserrat font-black text-[#FFDE00] uppercase tracking-widest">
                CASHIER QUEUE TOKEN
              </div>
              <div className="text-3xl sm:text-4xl font-mono font-black tracking-wider text-white">
                {queuedSlip.token}
              </div>
              <div className="text-[10px] text-white/70 font-mono">
                Ref: {queuedSlip.docNumber}
              </div>
            </div>

            {/* Order Details Summary */}
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-montserrat font-bold text-slate-900">{queuedSlip.customerName}</span>
              </div>
              {queuedSlip.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Phone:</span>
                  <span className="font-mono font-bold text-slate-900">{queuedSlip.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Branch Depot:</span>
                <span className="font-bold text-[#0A006E]">{queuedSlip.branchName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Sales Representative:</span>
                <span className="font-semibold text-slate-900">{queuedSlip.affiliateName} ({queuedSlip.affiliateCode})</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-montserrat font-black text-[#0A006E]">
                <span>Total Due at Counter:</span>
                <span className="font-mono-tabular text-base">{formatKes(queuedSlip.totalAmount)}</span>
              </div>
              <div className="text-[10px] text-[#1E9E60] font-bold text-right">
                Your Commission on Payment: {formatKes(queuedSlip.earnedCommission)}
              </div>
            </div>

            {/* Action Buttons: Copy, WhatsApp, Print, Done */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyTicket}
                className="py-2.5 px-3 bg-[#F0F2F0] hover:bg-slate-200 text-[#0A006E] rounded-xl text-xs font-montserrat font-bold cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                {copiedToken ? <Check className="w-4 h-4 text-[#1E9E60]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedToken ? 'Copied!' : 'Copy Slip'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="py-2.5 px-3 bg-[#34D186] hover:bg-[#28B873] text-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setQueuedSlip(null)}
              className="w-full py-3 bg-[#0A006E] hover:bg-[#080055] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition"
            >
              Done · Take Next Order
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 2: DIRECT CHECKOUT MODAL (Payment Method & Commission Credit)   */}
      {/* --------------------------------------------------------------------- */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl max-w-md w-full overflow-hidden p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider block">
                  Field POS Direct Settlement
                </span>
                <h3 className="text-lg font-montserrat font-black text-[#0A006E]">
                  Complete Customer Checkout
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total and Commission Preview */}
            <div className="bg-[#0A006E] text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-montserrat font-bold text-white/70">TOTAL AMOUNT PAYABLE</div>
                <div className="text-2xl font-montserrat font-black text-[#FFDE00] font-mono-tabular">
                  {formatKes(cartGrandTotal)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-montserrat font-bold text-[#34D186]">COMMISSION CREDITED</div>
                <div className="text-lg font-montserrat font-black text-white font-mono-tabular">
                  +{formatKes(cartTotalEarnings)}
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-montserrat font-bold text-slate-700">
                Select Customer Payment Method:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['M-Pesa Express', 'Cash', 'Bank EFT / Cheque', 'Credit'] as const).map((method) => {
                  const isSelected = checkoutPaymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCheckoutPaymentMethod(method)}
                      className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#FFDE00]/20 border-[#0A006E] text-[#0A006E] font-montserrat font-black shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 font-semibold'
                      }`}
                    >
                      <div className="text-xs leading-tight">{method}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* M-PESA Specific Input */}
            {checkoutPaymentMethod === 'M-Pesa Express' && (
              <div className="bg-[#34D186]/15 border border-[#34D186]/40 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="font-montserrat font-bold text-[#0A006E] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#1E9E60]" />
                  M-Pesa Customer Mobile Number
                </div>
                <input
                  type="text"
                  value={checkoutMpesaPhone}
                  onChange={(e) => setCheckoutMpesaPhone(e.target.value)}
                  placeholder="e.g. 0712 345 678"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 outline-none"
                />
                <p className="text-[10px] text-slate-600">
                  Instant STK Push or M-PESA Till payment will be recorded and attached to the eTIMS invoice.
                </p>
              </div>
            )}

            {/* Cash Tendered Input */}
            {checkoutPaymentMethod === 'Cash' && (
              <div className="bg-[#F0F2F0] border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-montserrat font-bold text-slate-700">Cash Received (KES):</span>
                  <input
                    type="number"
                    value={checkoutCashTendered || ''}
                    onChange={(e) => setCheckoutCashTendered(Number(e.target.value))}
                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-right font-mono font-bold text-[#0A006E] outline-none"
                  />
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-600 font-medium">Change Due:</span>
                  <span className="font-mono font-black text-[#1E9E60]">
                    {formatKes(Math.max(0, checkoutCashTendered - cartGrandTotal))}
                  </span>
                </div>
              </div>
            )}

            {/* Confirm Sale Button */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCheckoutModalOpen(false)}
                className="flex-1 py-3 bg-[#F0F2F0] hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDirectCheckout}
                className="flex-2 py-3 bg-[#0A006E] hover:bg-[#080055] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition disabled:opacity-50"
              >
                {isProcessing ? 'Processing Sale...' : 'Confirm & Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 3: KRA eTIMS RECEIPT MODAL                                      */}
      {/* --------------------------------------------------------------------- */}
      {etimsReceipt && (
        <EtimsReceiptModal receipt={etimsReceipt} onClose={() => setEtimsReceipt(null)} />
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL 4: CAMERA BARCODE SCANNER MODAL                                 */}
      {/* --------------------------------------------------------------------- */}
      {isCameraScannerOpen && (
        <PhoneBarcodeScannerModal
          isOpen={isCameraScannerOpen}
          onClose={() => setIsCameraScannerOpen(false)}
          onBarcodeScanned={(code) => handleScanBarcode(code)}
        />
      )}



      {/* Floating Keyboard Modal */}
      <FloatingSalesKeyboardModal
        isOpen={isKeyboardOpen}
        onClose={() => setIsKeyboardOpen(false)}
      />

      {isPreviewOpen && previewProduct && (
        <ProductPreviewModal
          product={previewProduct}
          onClose={() => setIsPreviewOpen(false)}
          onAddToCart={(prod, mode) => {
            handleAddToCart(prod, mode, 1);
            setIsPreviewOpen(false);
          }}
          stock={getProductBranchStock(previewProduct)}
        />
      )}
    </div>
  );
};
