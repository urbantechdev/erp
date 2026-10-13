import React, { createContext, useContext, useState, useMemo } from 'react';
import {
  StaffMember,
  Branch,
  Product,
  InventoryItem,
  WebsiteDeliveryOrder,
  WebsiteDeliveryOrderStatus,
  ProductRatingRecord,
  BarcodeScanRecord,
  LiveLoggedInCustomer,
  SaleOrder,
  ETimsInvoice,
} from '../types';
import { MASTER_IMPORTED_INVENTORY } from '../erpUtils';

export interface MpesaCompletionResult {
  success: boolean;
  order?: SaleOrder;
  invoice?: ETimsInvoice;
  error?: string;
}

export interface ErpContextType {
  isAuthenticated: boolean;
  currentUser: StaffMember | null;
  currentRole: StaffMember['role'] | null;
  activeBranch: Branch | null;
  branches: Branch[];
  products: Product[];
  inventoryItems: InventoryItem[];
  scanHistory: BarcodeScanRecord[];
  websiteDeliveryOrders: WebsiteDeliveryOrder[];
  orders: SaleOrder[];
  placeWebsiteDeliveryOrder: (order: Partial<WebsiteDeliveryOrder> & any) => WebsiteDeliveryOrder;
  updateWebsiteDeliveryOrderStatus: (
    orderId: string,
    status: WebsiteDeliveryOrderStatus,
    notes?: string
  ) => void;
  completeWebsiteDeliveryOrderWithMpesaPrompt: (
    orderId: string,
    phoneUsed: string,
    meta?: { checkoutRequestId?: string; receiptNumber?: string }
  ) => Promise<MpesaCompletionResult>;
  productRatings: ProductRatingRecord[];
  submitProductRating: (rating: Partial<ProductRatingRecord> & any) => void;
  upsertLiveCustomerSession: (customer: LiveLoggedInCustomer | any) => void;
  removeLiveCustomerSession: (uid: string) => void;
  logout: () => void;
}

const ErpContext = createContext<ErpContextType | null>(null);

const DEFAULT_BRANCH: Branch = {
  id: 'branch-main-hq',
  code: 'HQ-WESTLANDS',
  name: 'Westlands Central Distribution Hub',
  regionId: 'reg-metro-core',
  regionName: 'Nairobi Metro Core',
  address: 'Parklands Road, Westlands, Nairobi',
  managerName: 'Operations Director',
  exciseBondLicense: 'KRA-EXC-2026-NBI-0941',
  status: 'Operational',
  createdAt: new Date().toISOString(),
};

export const ErpProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [branches] = useState<Branch[]>([DEFAULT_BRANCH]);
  const [activeBranch] = useState<Branch | null>(DEFAULT_BRANCH);
  const [products] = useState<Product[]>(MASTER_IMPORTED_INVENTORY);
  const [inventoryItems] = useState<InventoryItem[]>([]);
  const [scanHistory] = useState<BarcodeScanRecord[]>([]);
  const [websiteDeliveryOrders, setWebsiteDeliveryOrders] = useState<WebsiteDeliveryOrder[]>(() => {
    try {
      const saved = localStorage.getItem('erp_delivery_orders');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [productRatings, setProductRatings] = useState<ProductRatingRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_product_ratings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const isAuthenticated = Boolean(currentUser);
  const currentRole = currentUser?.role || null;

  const placeWebsiteDeliveryOrder = (orderData: Partial<WebsiteDeliveryOrder> & any): WebsiteDeliveryOrder => {
    const newOrder: WebsiteDeliveryOrder = {
      id: `web-ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      orderNumber: `WEB-${Math.floor(100000 + Math.random() * 900000)}`,
      customerName: orderData.customerName || 'Customer',
      customerPhone: orderData.customerPhone || '',
      customerEmail: orderData.customerEmail,
      deliveryLocation: orderData.deliveryLocation || '',
      deliveryNotes: orderData.deliveryNotes,
      branchId: orderData.branchId || activeBranch?.id || DEFAULT_BRANCH.id,
      branchName: orderData.branchName || activeBranch?.name || DEFAULT_BRANCH.name,
      items: orderData.items || [],
      totalCompanyPriceKes: orderData.totalCompanyPriceKes || 0,
      grossSoldPriceKes: orderData.grossSoldPriceKes || orderData.totalCompanyPriceKes || 0,
      deliveryStatus: 'ON_HOLD_PENDING_DELIVERY',
      createdAt: new Date().toISOString(),
      ...orderData,
    };

    setWebsiteDeliveryOrders((prev) => {
      const updated = [newOrder, ...prev];
      try {
        localStorage.setItem('erp_delivery_orders', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    return newOrder;
  };

  const updateWebsiteDeliveryOrderStatus = (
    orderId: string,
    status: WebsiteDeliveryOrderStatus,
    _notes?: string
  ) => {
    setWebsiteDeliveryOrders((prev) => {
      const updated = prev.map((ord) =>
        ord.id === orderId
          ? {
              ...ord,
              deliveryStatus: status,
              deliveredAt: status === 'DELIVERED_AWAITING_PAYMENT' ? new Date().toISOString() : ord.deliveredAt,
              paidAt: status === 'COMPLETED_AND_PAID' ? new Date().toISOString() : ord.paidAt,
            }
          : ord
      );
      try {
        localStorage.setItem('erp_delivery_orders', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const completeWebsiteDeliveryOrderWithMpesaPrompt = async (
    orderId: string,
    phoneUsed: string,
    meta?: { checkoutRequestId?: string; receiptNumber?: string }
  ): Promise<MpesaCompletionResult> => {
    const receipt = meta?.receiptNumber || `MPESA-${Date.now().toString().slice(-6)}`;
    let matchedOrder: WebsiteDeliveryOrder | undefined;

    setWebsiteDeliveryOrders((prev) => {
      const updated = prev.map((ord) => {
        if (ord.id === orderId) {
          matchedOrder = {
            ...ord,
            deliveryStatus: 'COMPLETED_AND_PAID' as WebsiteDeliveryOrderStatus,
            mpesaReceiptNumber: receipt,
            paymentPhone: phoneUsed,
            paidAt: new Date().toISOString(),
          };
          return matchedOrder;
        }
        return ord;
      });
      try {
        localStorage.setItem('erp_delivery_orders', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const target = matchedOrder || websiteDeliveryOrders.find((o) => o.id === orderId);
    const saleOrder: SaleOrder = {
      id: `so-${Date.now()}`,
      orderNumber: target?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
      orderSource: 'WEBSITE',
      deliveryAddress: target?.deliveryLocation || 'Nairobi',
      branchId: target?.branchId || DEFAULT_BRANCH.id,
      branchName: target?.branchName || DEFAULT_BRANCH.name,
      customerName: target?.customerName || 'Online Customer',
      customerPhone: target?.customerPhone || phoneUsed,
      items: (target?.items || []).map((it) => {
        const unitPrice = it.companyUnitPrice || it.product.retailPriceKes || 0;
        const total = it.totalAmount || unitPrice * it.quantity;
        return {
          productId: it.product.id,
          sku: it.product.sku,
          productName: it.product.name,
          quantity: it.quantity,
          unitPrice,
          costPrice: it.product.warehouseCostKes || 0,
          subtotal: total,
          totalAmount: total,
        };
      }),
      totalKes: target?.grossSoldPriceKes || target?.totalCompanyPriceKes || 0,
      createdAt: new Date().toISOString(),
      mpesaReceiptNumber: receipt,
    };

    const invoice: ETimsInvoice = {
      id: `etims-${Date.now()}`,
      invoiceNumber: `ETIMS-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      orderId: saleOrder.id,
      branchId: saleOrder.branchId,
      sellerPin: 'P051234567Z',
      sellerName: 'AEGIS SPIRITS & BEVERAGE LTD',
      deviceSerialNumber: 'KRA-ETIMS-009182',
      cuSerialNumber: 'CU-8812903',
      qrCodeUrl: `https://etims.kra.go.ke/verify/${saleOrder.id}`,
      kraControlCode: `KRA-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      invoiceDate: new Date().toISOString(),
      taxableAmount: Math.round(saleOrder.totalKes / 1.16),
      taxAmount: Math.round(saleOrder.totalKes - saleOrder.totalKes / 1.16),
      totalInvoiceAmount: saleOrder.totalKes,
      transmissionStatus: 'VERIFIED',
    };

    return {
      success: true,
      order: saleOrder,
      invoice,
    };
  };

  const submitProductRating = (ratingData: Partial<ProductRatingRecord> & any) => {
    const newRating: ProductRatingRecord = {
      id: `rating-${Date.now()}`,
      productId: ratingData.productId || '',
      raterKey: ratingData.raterKey || 'anon',
      raterName: ratingData.raterName || 'Anonymous Buyer',
      stars: ratingData.stars || 5,
      comment: ratingData.comment,
      isVerifiedBuyer: ratingData.isVerifiedBuyer ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...ratingData,
    };

    setProductRatings((prev) => {
      const updated = [newRating, ...prev.filter((r) => r.id !== newRating.id)];
      try {
        localStorage.setItem('erp_product_ratings', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const upsertLiveCustomerSession = (_customer: LiveLoggedInCustomer | any) => {
    // Session tracking in-memory
  };

  const removeLiveCustomerSession = (_uid: string) => {
    // Session cleanup
  };

  const logout = () => {
    setCurrentUser(null);
  };

  const contextValue: ErpContextType = useMemo(
    () => ({
      isAuthenticated,
      currentUser,
      currentRole,
      activeBranch,
      branches,
      products,
      inventoryItems,
      scanHistory,
      websiteDeliveryOrders,
      orders: [],
      placeWebsiteDeliveryOrder,
      updateWebsiteDeliveryOrderStatus,
      completeWebsiteDeliveryOrderWithMpesaPrompt,
      productRatings,
      submitProductRating,
      upsertLiveCustomerSession,
      removeLiveCustomerSession,
      logout,
    }),
    [
      isAuthenticated,
      currentUser,
      currentRole,
      activeBranch,
      branches,
      products,
      inventoryItems,
      scanHistory,
      websiteDeliveryOrders,
      productRatings,
    ]
  );

  return <ErpContext.Provider value={contextValue}>{children}</ErpContext.Provider>;
};

export const useErp = (): ErpContextType => {
  const ctx = useContext(ErpContext);
  if (!ctx) {
    // Safe default fallback if used outside of ErpProvider
    return {
      isAuthenticated: false,
      currentUser: null,
      currentRole: null,
      activeBranch: DEFAULT_BRANCH,
      branches: [DEFAULT_BRANCH],
      products: MASTER_IMPORTED_INVENTORY,
      inventoryItems: [],
      scanHistory: [],
      websiteDeliveryOrders: [],
      orders: [],
      placeWebsiteDeliveryOrder: (order: any) => ({
        id: `ord-${Date.now()}`,
        orderNumber: `WEB-${Date.now()}`,
        customerName: order.customerName || '',
        customerPhone: order.customerPhone || '',
        deliveryLocation: order.deliveryLocation || '',
        branchId: DEFAULT_BRANCH.id,
        branchName: DEFAULT_BRANCH.name,
        items: order.items || [],
        totalCompanyPriceKes: order.totalCompanyPriceKes || 0,
        deliveryStatus: 'ON_HOLD_PENDING_DELIVERY',
        createdAt: new Date().toISOString(),
        ...order,
      }),
      updateWebsiteDeliveryOrderStatus: () => {},
      completeWebsiteDeliveryOrderWithMpesaPrompt: async () => ({ success: true }),
      productRatings: [],
      submitProductRating: () => {},
      upsertLiveCustomerSession: () => {},
      removeLiveCustomerSession: () => {},
      logout: () => {},
    };
  }
  return ctx;
};
