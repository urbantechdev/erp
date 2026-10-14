import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Product,
  Branch,
  InventoryItem,
  WebsiteDeliveryOrder,
  WebsiteDeliveryOrderStatus,
  BranchRoutingModel,
  ProductRatingRecord,
  LiveLoggedInCustomer,
  SaleOrder,
  ETimsInvoice,
  BarcodeScanRecord
} from '../types';
import { MASTER_IMPORTED_INVENTORY } from '../erpUtils';
import { auth, db } from '../firebase';
import { collection, doc, setDoc, getDocs, onSnapshot } from 'firebase/firestore';

export interface ErpContextType {
  products: Product[];
  inventoryItems: InventoryItem[];
  branches: Branch[];
  activeBranch: Branch;
  scanHistory: BarcodeScanRecord[];
  websiteDeliveryOrders: WebsiteDeliveryOrder[];
  placeWebsiteDeliveryOrder: (params: {
    customerName: string;
    customerEmail?: string;
    customerPhone: string;
    deliveryLocation: string;
    deliveryNotes?: string;
    branchId?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    distanceKm?: number;
    estimatedEtaMinutes?: number;
    routingModel?: BranchRoutingModel;
    items: { product: Product; quantity: number }[];
  }) => WebsiteDeliveryOrder;
  updateWebsiteDeliveryOrderStatus: (orderId: string, status: WebsiteDeliveryOrderStatus) => void;
  assignRiderToWebsiteDeliveryOrder: (
    orderId: string,
    riderName: string,
    riderPhone: string,
    deliveryNotes?: string
  ) => void;
  completeWebsiteDeliveryOrderWithMpesaPrompt: (
    orderId: string,
    mpesaPhone: string,
    options?: {
      checkoutRequestId?: string;
      receiptNumber?: string;
    }
  ) => Promise<{
    success: boolean;
    order?: SaleOrder;
    invoice?: ETimsInvoice;
    websiteOrder?: WebsiteDeliveryOrder;
    error?: string;
  }>;
  productRatings: ProductRatingRecord[];
  submitProductRating: (rating: Omit<ProductRatingRecord, 'id' | 'createdAt' | 'updatedAt'>) => void;
  upsertLiveCustomerSession: (session: LiveLoggedInCustomer) => void;
  removeLiveCustomerSession: (uidOrPhone: string) => void;
  isAuthenticated: boolean;
  currentUser: any;
  currentRole: string;
  logout: () => void;
  orders: SaleOrder[];
}

const ErpContext = createContext<ErpContextType | null>(null);

const DEFAULT_MAIN_BRANCH: Branch = {
  id: 'br-hq-01',
  code: 'BR-HQ-001',
  name: 'HQ - Main Branch',
  regionId: 'reg-nrb-cbd',
  regionName: 'Nairobi Central Business District',
  address: 'Kenyatta Avenue & Kimathi St, Nairobi CBD',
  managerName: 'Operations Director',
  exciseBondLicense: 'KRA-BOND-2026-8841A',
  status: 'Operational',
  isMain: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  location: 'Nairobi CBD',
  county: 'Nairobi',
  latitude: -1.2833,
  longitude: 36.8167,
  maxDeliveryRadiusKm: 25,
  deliveryZones: ['CBD', 'Westlands', 'Kilimani', 'Kileleshwa', 'Lavington', 'Karen', 'Langata', 'Parklands'],
  allowDirectSales: true,
  tier: 'LIQUOR_STORE',
  marketClassTier: 'AFFLUENT_PREMIUM'
};

const WEB_ORDERS_STORAGE_KEY = 'vaairo_website_delivery_orders_v1';
const RATINGS_STORAGE_KEY = 'vaairo_product_ratings_v1';

export const ErpProvider: React.FC<{
  children: React.ReactNode;
  initialProducts?: Product[];
  initialBranches?: Branch[];
  initialCurrentUser?: any;
  onCommitOrder?: (order: SaleOrder) => void;
}> = ({
  children,
  initialProducts = MASTER_IMPORTED_INVENTORY,
  initialBranches = [DEFAULT_MAIN_BRANCH],
  initialCurrentUser = null,
  onCommitOrder
}) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [branches, setBranches] = useState<Branch[]>(initialBranches);
  const [currentUser, setCurrentUser] = useState<any>(initialCurrentUser);
  const [scanHistory] = useState<BarcodeScanRecord[]>([]);

  // Keep synced with external prop changes
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  useEffect(() => {
    if (initialBranches && initialBranches.length > 0) {
      setBranches(initialBranches);
    }
  }, [initialBranches]);

  useEffect(() => {
    setCurrentUser(initialCurrentUser);
  }, [initialCurrentUser]);

  // Derive active branch
  const activeBranch = useMemo(() => {
    return (
      branches.find(b => b.isMain) ||
      branches.find(b => b.allowDirectSales) ||
      branches[0] ||
      DEFAULT_MAIN_BRANCH
    );
  }, [branches]);

  // Synthesize or derive inventory items from products
  const inventoryItems = useMemo<InventoryItem[]>(() => {
    return products.map(p => ({
      id: `inv-${p.id}`,
      productId: p.id,
      branchId: activeBranch.id,
      bottlesOnHand: p.totalBottles ?? 36,
      casesOnHand: Math.floor((p.totalBottles ?? 36) / (p.packSize || 12)),
      reorderLevel: p.minReorderThresholdBottles ?? 10,
      batchNumber: 'BATCH-2026-A1',
      expiryDate: p.batchExpiryDate || '2028-12-31',
      lastScannedAt: new Date().toISOString()
    }));
  }, [products, activeBranch]);

  // Website delivery orders
  const [websiteDeliveryOrders, setWebsiteDeliveryOrders] = useState<WebsiteDeliveryOrder[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(WEB_ORDERS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  // Save delivery orders locally
  useEffect(() => {
    try {
      localStorage.setItem(WEB_ORDERS_STORAGE_KEY, JSON.stringify(websiteDeliveryOrders));
    } catch {
      // ignore
    }
  }, [websiteDeliveryOrders]);

  // Product ratings
  const [productRatings, setProductRatings] = useState<ProductRatingRecord[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(RATINGS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(RATINGS_STORAGE_KEY, JSON.stringify(productRatings));
    } catch {
      // ignore
    }
  }, [productRatings]);

  const [orders, setOrders] = useState<SaleOrder[]>([]);

  // Function to place website delivery order
  const placeWebsiteDeliveryOrder = useCallback(
    (params: {
      customerName: string;
      customerEmail?: string;
      customerPhone: string;
      deliveryLocation: string;
      deliveryNotes?: string;
      branchId?: string;
      customerLatitude?: number;
      customerLongitude?: number;
      distanceKm?: number;
      estimatedEtaMinutes?: number;
      routingModel?: BranchRoutingModel;
      items: { product: Product; quantity: number }[];
    }): WebsiteDeliveryOrder => {
      const fulfillingBranch =
        branches.find(b => b.id === params.branchId) ||
        activeBranch;

      const mappedItems = params.items.map(it => {
        const companyUnitPrice = it.product.retailPriceKes || 0;
        return {
          product: it.product,
          quantity: it.quantity,
          companyUnitPrice,
          totalAmount: companyUnitPrice * it.quantity
        };
      });

      const totalCompanyPriceKes = mappedItems.reduce((sum, it) => sum + it.totalAmount, 0);
      const webSeq = (websiteDeliveryOrders.length + 301).toString();

      const newOrder: WebsiteDeliveryOrder = {
        id: `web-ord-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        orderNumber: `WEB-2026-${webSeq}`,
        customerName: params.customerName.trim(),
        customerEmail: params.customerEmail?.trim(),
        customerPhone: params.customerPhone.trim(),
        deliveryLocation: params.deliveryLocation.trim(),
        deliveryNotes: params.deliveryNotes?.trim(),
        branchId: fulfillingBranch.id,
        branchName: fulfillingBranch.name,
        customerLatitude: params.customerLatitude,
        customerLongitude: params.customerLongitude,
        distanceKm: params.distanceKm,
        estimatedEtaMinutes: params.estimatedEtaMinutes || 35,
        routingModel: params.routingModel || 'SERVICE_ZONE_GEOFENCE',
        items: mappedItems,
        totalCompanyPriceKes,
        deliveryStatus: 'ON_HOLD_PENDING_DELIVERY',
        riderName: 'Nairobi Express Dispatch Rider',
        riderPhone: '+254 700 882 476',
        createdAt: new Date().toISOString()
      };

      setWebsiteDeliveryOrders(prev => [newOrder, ...prev]);

      // Fire and forget Firestore backup if collection exists
      try {
        setDoc(doc(db, 'website_delivery_orders', newOrder.id), newOrder).catch(() => {});
      } catch {
        // ignore
      }

      return newOrder;
    },
    [branches, activeBranch, websiteDeliveryOrders.length]
  );

  const updateWebsiteDeliveryOrderStatus = useCallback(
    (orderId: string, status: WebsiteDeliveryOrderStatus) => {
      setWebsiteDeliveryOrders(prev =>
        prev.map(ord => (ord.id === orderId ? { ...ord, deliveryStatus: status } : ord))
      );
    },
    []
  );

  const assignRiderToWebsiteDeliveryOrder = useCallback(
    (orderId: string, riderName: string, riderPhone: string, deliveryNotes?: string) => {
      setWebsiteDeliveryOrders(prev =>
        prev.map(ord =>
          ord.id === orderId
            ? {
                ...ord,
                riderName,
                riderPhone,
                deliveryNotes: deliveryNotes || ord.deliveryNotes
              }
            : ord
        )
      );
    },
    []
  );

  const completeWebsiteDeliveryOrderWithMpesaPrompt = useCallback(
    async (
      orderId: string,
      mpesaPhone: string,
      options?: {
        checkoutRequestId?: string;
        receiptNumber?: string;
      }
    ) => {
      const targetWebOrder = websiteDeliveryOrders.find(o => o.id === orderId);
      if (!targetWebOrder) {
        return { success: false, error: 'Website delivery order not found.' };
      }
      if (targetWebOrder.deliveryStatus === 'COMPLETED_AND_PAID') {
        return { success: false, error: 'This website order has already been completed and paid.' };
      }

      const receiptNumber =
        options?.receiptNumber ||
        `QA${Math.floor(10000000 + Math.random() * 90000000).toString()}`;

      const fulfillingBranch =
        branches.find(b => b.id === targetWebOrder.branchId) || activeBranch;

      const saleOrder: SaleOrder = {
        id: `sale-${Date.now()}`,
        orderNumber: targetWebOrder.orderNumber,
        orderSource: 'WEBSITE',
        deliveryAddress: targetWebOrder.deliveryLocation,
        branchId: fulfillingBranch.id,
        branchName: fulfillingBranch.name,
        customerName: targetWebOrder.customerName,
        customerEmail: targetWebOrder.customerEmail,
        customerPhone: mpesaPhone || targetWebOrder.customerPhone,
        saleType: 'RETAIL',
        items: targetWebOrder.items.map(it => ({
          productId: it.product.id,
          productName: it.product.name,
          sku: it.product.sku,
          barcode: it.product.barcode,
          quantity: it.quantity,
          companyUnitPrice: it.companyUnitPrice,
          unitPrice: it.companyUnitPrice,
          costPrice: it.product.warehouseCostKes || 0,
          vatAmount: Math.round((it.totalAmount - it.totalAmount / 1.16) * 100) / 100,
          totalAmount: it.totalAmount
        })),
        subtotalKes: Math.round((targetWebOrder.totalCompanyPriceKes / 1.16) * 100) / 100,
        vatAmountKes:
          Math.round((targetWebOrder.totalCompanyPriceKes - targetWebOrder.totalCompanyPriceKes / 1.16) * 100) / 100,
        totalKes: targetWebOrder.totalCompanyPriceKes,
        totalAmount: targetWebOrder.totalCompanyPriceKes,
        createdAt: new Date().toISOString(),
        paymentMethod: 'MPESA',
        mpesaReceiptNumber: receiptNumber,
        etimsInvoiceNumber: `KRA-ETIMS-${Date.now().toString().slice(-6)}`
      };

      const etimsInvoice: ETimsInvoice = {
        id: `inv-${Date.now()}`,
        invoiceNumber: saleOrder.etimsInvoiceNumber!,
        orderId: saleOrder.id,
        branchId: fulfillingBranch.id,
        sellerPin: 'P051829301A',
        sellerName: 'VAAIRO BEVERAGES & LIQUOR HUB LTD',
        buyerName: targetWebOrder.customerName,
        servedBy: 'Website Express Delivery Portal',
        deviceSerialNumber: 'OSCU-2026-KRA-00912',
        cuSerialNumber: 'KRA-CU-0988421A',
        qrCodeUrl: `https://itax.kra.go.ke/KRA-Portal/invoiceVerification?invoiceNumber=${saleOrder.etimsInvoiceNumber}`,
        kraControlCode: `KRACONTROL-${Math.floor(100000 + Math.random() * 900000)}`,
        invoiceDate: new Date().toISOString(),
        taxableAmount: saleOrder.subtotalKes!,
        taxAmount: saleOrder.vatAmountKes!,
        totalInvoiceAmount: saleOrder.totalKes,
        transmissionStatus: 'VERIFIED'
      };

      const updatedOrder: WebsiteDeliveryOrder = {
        ...targetWebOrder,
        deliveryStatus: 'COMPLETED_AND_PAID',
        paidAt: new Date().toISOString(),
        deliveredAt: new Date().toISOString(),
        paymentPhone: mpesaPhone,
        mpesaReceiptNumber: receiptNumber,
        completedSaleOrderId: saleOrder.id,
        etimsInvoiceNumber: saleOrder.etimsInvoiceNumber
      };

      setWebsiteDeliveryOrders(prev =>
        prev.map(ord => (ord.id === orderId ? updatedOrder : ord))
      );
      setOrders(prev => [saleOrder, ...prev]);

      if (onCommitOrder) {
        onCommitOrder(saleOrder);
      }

      return {
        success: true,
        order: saleOrder,
        invoice: etimsInvoice,
        websiteOrder: updatedOrder
      };
    },
    [websiteDeliveryOrders, branches, activeBranch, onCommitOrder]
  );

  const submitProductRating = useCallback(
    (rating: Omit<ProductRatingRecord, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString();
      const id = `${rating.productId}_${rating.raterKey}`;
      const rec: ProductRatingRecord = {
        ...rating,
        id,
        createdAt: now,
        updatedAt: now
      };
      setProductRatings(prev => {
        const filtered = prev.filter(r => r.id !== id);
        return [rec, ...filtered];
      });
    },
    []
  );

  const upsertLiveCustomerSession = useCallback((session: LiveLoggedInCustomer) => {
    // Session state monitor
  }, []);

  const removeLiveCustomerSession = useCallback((uidOrPhone: string) => {
    // Session cleanup
  }, []);

  const logout = useCallback(() => {
    auth.signOut().catch(() => {});
  }, []);

  const value: ErpContextType = {
    products,
    inventoryItems,
    branches,
    activeBranch,
    scanHistory,
    websiteDeliveryOrders,
    placeWebsiteDeliveryOrder,
    updateWebsiteDeliveryOrderStatus,
    assignRiderToWebsiteDeliveryOrder,
    completeWebsiteDeliveryOrderWithMpesaPrompt,
    productRatings,
    submitProductRating,
    upsertLiveCustomerSession,
    removeLiveCustomerSession,
    isAuthenticated: Boolean(currentUser),
    currentUser,
    currentRole: currentUser?.role || 'CUSTOMER',
    logout,
    orders
  };

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
};

export const useErp = (): ErpContextType => {
  const context = useContext(ErpContext);
  if (!context) {
    throw new Error('useErp must be used within an ErpProvider');
  }
  return context;
};
