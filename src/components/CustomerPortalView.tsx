import React from 'react';
import { CustomerStorefrontWebsite } from './storefront/CustomerStorefrontWebsite';
import { ErpProvider } from '../context/ErpContext';
import { Product, Branch, GeoRegion, TransactionDoc, SaleOrder } from '../types';

interface CustomerPortalViewProps {
  products: Product[];
  branches: Branch[];
  regions?: GeoRegion[];
  onPlaceOnlineOrder?: (
    orderDraft: Omit<TransactionDoc, 'id' | 'createdAt'>
  ) => Promise<TransactionDoc | null>;
  onPreviewDoc?: (doc: TransactionDoc) => void;
  onBackToErpLogin?: () => void;
  isStandalonePortal?: boolean;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  products,
  branches,
  onPlaceOnlineOrder,
  onPreviewDoc,
  onBackToErpLogin,
}) => {
  const handleCommitOrder = async (order: SaleOrder) => {
    if (onPlaceOnlineOrder) {
      const lineItems = order.items.map((it) => ({
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        barcode: it.barcode,
        unitMode: 'Bottle' as const,
        quantityUnits: it.quantity,
        unitPriceKes: it.unitPrice,
        lineTotalKes: it.totalAmount,
      }));

      const draft: Omit<TransactionDoc, 'id' | 'createdAt'> = {
        docNumber: order.orderNumber || `ORD-WEB-${Date.now().toString().slice(-6)}`,
        docType: 'Receipt',
        channel: 'Customer Online Portal',
        branchId: order.branchId,
        branchName: order.branchName,
        regionId: 'reg-nrb-cbd',
        regionName: 'Nairobi Central Business District',
        customerName: order.customerName || 'Online Direct Customer',
        customerLicenseNo: order.customerPhone || 'N/A',
        itemsSummary: JSON.stringify(lineItems),
        subtotal: order.subtotalKes || Math.round((order.totalKes / 1.16) * 100) / 100,
        exciseAndTax: order.vatAmountKes || Math.round((order.totalKes - order.totalKes / 1.16) * 100) / 100,
        totalAmount: order.totalKes,
        paymentMethod: order.paymentMethod || 'M-Pesa',
        status: 'Paid',
        createdBy: 'Customer Direct Web Portal',
        createdByRole: 'Direct Customer Order',
      };
      const created = await onPlaceOnlineOrder(draft);
      if (created && onPreviewDoc) {
        onPreviewDoc(created);
      }
    }
  };

  return (
    <ErpProvider
      initialProducts={products}
      initialBranches={branches}
      onCommitOrder={handleCommitOrder}
    >
      <div className="w-full min-h-screen">
        <CustomerStorefrontWebsite onSwitchToErp={onBackToErpLogin || (() => {})} />
      </div>
    </ErpProvider>
  );
};
