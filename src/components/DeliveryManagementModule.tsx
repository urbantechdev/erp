import React, { useState, useMemo } from 'react';
import { StaffMember, Branch, TransactionDoc, LineItem } from '../types';
import { useErp } from '../context/ErpContext';
import { formatKes } from '../erpUtils';
import {
  Truck,
  Users,
  MapPin,
  Smartphone,
  CheckCircle2,
  Search,
  Building2,
  Activity,
  UserPlus,
  Mail,
  Eye,
  Package,
  Printer,
  Navigation,
} from 'lucide-react';

interface DeliveryManagementModuleProps {
  currentUser: StaffMember;
  branches: Branch[];
  staffList: StaffMember[];
  transactions?: TransactionDoc[];
  onCreateStaff?: (newStaff: Omit<StaffMember, 'id' | 'createdAt'>) => Promise<void>;
  onInspectCustomerOrder?: (tx: TransactionDoc) => void;
  onProcessDeliveryUpdate?: (txId: string, updates: Partial<TransactionDoc>) => Promise<boolean>;
  onPreviewDoc?: (doc: TransactionDoc) => void;
  onTriggerToast: (type: 'success' | 'error', title: string, message: string) => void;
}

export const DeliveryManagementModule: React.FC<DeliveryManagementModuleProps> = ({
  currentUser,
  branches,
  staffList,
  transactions = [],
  onCreateStaff,
  onInspectCustomerOrder,
  onProcessDeliveryUpdate,
  onPreviewDoc,
  onTriggerToast,
}) => {
  const {
    websiteDeliveryOrders,
    updateWebsiteDeliveryOrderStatus,
    assignRiderToWebsiteDeliveryOrder,
  } = useErp();

  const [activeTab, setActiveTab] = useState<'orders' | 'riders' | 'mpesa_payments' | 'transactions'>('orders');

  // Rider employment state
  const [isEmployRiderModalOpen, setIsEmployRiderModalOpen] = useState(false);
  const [riderName, setRiderName] = useState('');
  const [riderEmail, setRiderEmail] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [riderBranchId, setRiderBranchId] = useState(branches[0]?.id || '');
  const [riderPin, setRiderPin] = useState('123456');

  // Filter & Search state
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');

  // Active riders list
  const activeRiders = useMemo(() => {
    return staffList.filter(
      (s) => s.role === 'Delivery Rider' || (s.role as string).toLowerCase().includes('rider')
    );
  }, [staffList]);

  // Unified customer delivery orders combining Online Order TransactionDocs + WebsiteDeliveryOrders
  const unifiedCustomerOrders = useMemo<TransactionDoc[]>(() => {
    const onlineTxs = transactions.filter(
      (t) =>
        t.docType === 'Online Order' ||
        t.channel === 'Customer Online Portal' ||
        Boolean(t.deliveryAddress) ||
        Boolean(t.deliveryStatus)
    );

    const existingDocNos = new Set(onlineTxs.map((t) => t.docNumber));
    const convertedLegacyOrders: TransactionDoc[] = websiteDeliveryOrders
      .filter((w) => !existingDocNos.has(w.orderNumber))
      .map((w) => ({
        id: w.id,
        docNumber: w.orderNumber,
        docType: 'Online Order',
        channel: 'Customer Online Portal',
        branchId: w.branchId,
        branchName: w.branchName,
        regionId: 'reg-nrb-cbd',
        regionName: w.deliveryLocation,
        customerName: w.customerName,
        customerPhone: w.customerPhone,
        customerEmail: w.customerEmail,
        customerLicenseNo: 'RETAIL-CONSUMER',
        deliveryAddress: w.deliveryLocation,
        deliveryNotes: w.deliveryNotes,
        deliveryStatus:
          w.deliveryStatus === 'COMPLETED_AND_PAID'
            ? 'Delivered'
            : w.deliveryStatus === 'OUT_FOR_DELIVERY'
            ? 'Out for Delivery'
            : 'Pending Dispatch',
        assignedRiderName: w.riderName,
        assignedRiderPhone: w.riderPhone,
        deliveredAt: w.deliveredAt,
        itemsSummary: JSON.stringify(
          (w.items || []).map((it) => ({
            productId: it.product.id,
            sku: it.product.sku,
            name: it.product.name,
            unitMode: 'Bottle',
            bottlesPerCase: it.product.bottlesPerCase || 12,
            quantityUnits: it.quantity,
            totalBottles: it.quantity,
            unitPrice: it.companyUnitPrice,
            lineTotal: it.totalAmount,
          }))
        ),
        subtotal: Math.round(w.totalCompanyPriceKes / 1.16),
        exciseAndTax: Math.max(0, w.totalCompanyPriceKes - Math.round(w.totalCompanyPriceKes / 1.16)),
        totalAmount: w.totalCompanyPriceKes,
        paymentMethod: 'M-Pesa STK',
        status: w.deliveryStatus === 'COMPLETED_AND_PAID' ? 'Fulfilled' : 'Issued',
        createdBy: w.customerEmail || 'Customer Storefront',
        createdByRole: 'Online Customer',
        createdAt: w.createdAt,
      }));

    return [...onlineTxs, ...convertedLegacyOrders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [transactions, websiteDeliveryOrders]);

  const handleEmployRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderName.trim() || !riderPhone.trim()) {
      onTriggerToast('error', 'Missing Information', 'Please provide rider name and mobile phone.');
      return;
    }
    const targetBranch = branches.find((b) => b.id === riderBranchId) || branches[0];
    if (onCreateStaff) {
      try {
        await onCreateStaff({
          name: riderName.trim(),
          email: riderEmail.trim() || `rider.${Date.now()}@vaairoliquor.co.ke`,
          phone: riderPhone.trim(),
          role: 'Delivery Rider',
          authMethod: 'pin',
          pin: riderPin,
          branchId: targetBranch.id,
          branchName: targetBranch.name,
          status: 'Active',
          createdBy: currentUser.name,
          createdByRole: currentUser.role,
        });
        onTriggerToast('success', 'Rider Employed', `Successfully employed rider ${riderName.trim()} and assigned to ${targetBranch.name}.`);
        setRiderName('');
        setRiderEmail('');
        setRiderPhone('');
        setIsEmployRiderModalOpen(false);
      } catch (err: any) {
        onTriggerToast('error', 'Employment Failed', err?.message || 'Could not save rider record.');
      }
    }
  };

  const filteredOrders = useMemo(() => {
    return unifiedCustomerOrders.filter((ord) => {
      const effectiveStatus =
        ord.deliveryStatus || (ord.status === 'Fulfilled' ? 'Delivered' : 'Pending Dispatch');
      const matchStatus = statusFilter === 'ALL' || effectiveStatus === statusFilter;
      const matchBranch = selectedBranchFilter === 'ALL' || ord.branchId === selectedBranchFilter;
      const q = orderSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        ord.docNumber.toLowerCase().includes(q) ||
        ord.customerName.toLowerCase().includes(q) ||
        (ord.customerPhone || '').includes(q) ||
        (ord.deliveryAddress || ord.regionName || '').toLowerCase().includes(q);

      return matchStatus && matchBranch && matchSearch;
    });
  }, [unifiedCustomerOrders, statusFilter, selectedBranchFilter, orderSearchQuery]);

  const handleQuickAssignRider = async (ord: TransactionDoc, rider: StaffMember) => {
    const phone =
      rider.phone ||
      (rider.email?.includes('@') ? '+254 700 000000' : rider.email || '+254 700 000000');
    if (ord.id.startsWith('tx-') && onProcessDeliveryUpdate) {
      await onProcessDeliveryUpdate(ord.id, {
        assignedRiderId: rider.id,
        assignedRiderName: rider.name,
        assignedRiderPhone: phone,
      });
    } else {
      assignRiderToWebsiteDeliveryOrder(ord.id, rider.name, phone);
      onTriggerToast('success', 'Rider Assigned', `Assigned ${rider.name} to order ${ord.docNumber}.`);
    }
  };

  const handleQuickStatusChange = async (
    ord: TransactionDoc,
    nextStatus: 'Out for Delivery' | 'Delivered'
  ) => {
    if (ord.id.startsWith('tx-') && onProcessDeliveryUpdate) {
      await onProcessDeliveryUpdate(ord.id, {
        deliveryStatus: nextStatus,
        status: nextStatus === 'Delivered' ? 'Fulfilled' : ord.status === 'Issued' ? 'Approved' : ord.status,
        dispatchedAt: nextStatus === 'Out for Delivery' ? new Date().toISOString() : ord.dispatchedAt,
        deliveredAt: nextStatus === 'Delivered' ? new Date().toISOString() : ord.deliveredAt,
      });
    } else {
      updateWebsiteDeliveryOrderStatus(
        ord.id,
        nextStatus === 'Delivered' ? 'COMPLETED_AND_PAID' : 'OUT_FOR_DELIVERY'
      );
      onTriggerToast(
        'success',
        nextStatus === 'Delivered' ? 'Order Delivered' : 'Order Dispatched',
        `Order ${ord.docNumber} updated to ${nextStatus}.`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Delivery & Customer Order Control Banner */}
      <div className="bg-gradient-to-r from-[#0A006E] via-[#15078a] to-[#1E3A8A] text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-montserrat font-black bg-[#FFDE00] text-[#0A006E] mb-2">
            <Truck className="w-4 h-4" />
            Customer Order Details &amp; Delivery Fulfillment Hub
          </div>
          <h1 className="text-2xl md:text-3xl font-montserrat font-black tracking-tight text-white">
            Inspect Customer Orders, Assign Riders &amp; Process Deliveries
          </h1>
          <p className="text-xs md:text-sm text-slate-200 mt-1 max-w-2xl font-medium">
            View complete itemized customer orders, street delivery addresses, contact phones, M-Pesa payment statuses, and dispatch riders in real time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onCreateStaff && (
            <button
              type="button"
              onClick={() => setIsEmployRiderModalOpen(true)}
              className="px-4 py-3 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl text-xs font-montserrat font-black flex items-center gap-2 cursor-pointer shadow-lg transition active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              Employ New Rider
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'orders', label: `Customer Delivery Queue (${unifiedCustomerOrders.length})`, icon: Truck },
          { id: 'riders', label: `Dispatch Team / Riders (${activeRiders.length})`, icon: Users },
          { id: 'mpesa_payments', label: `Order Payments Audit`, icon: Smartphone },
          { id: 'transactions', label: `Fulfillment History`, icon: Activity },
        ].map((tab) => {
          const IconC = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-montserrat font-bold flex items-center gap-2 whitespace-nowrap cursor-pointer transition ${
                active
                  ? 'bg-[#0A006E] text-[#FFDE00] shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <IconC className={`w-4 h-4 ${active ? 'text-[#FFDE00]' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Customer Orders Queue */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search customer orders by order #, customer name, phone, or delivery address..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-montserrat font-semibold text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Delivery Statuses</option>
                <option value="Pending Dispatch">Pending Dispatch</option>
                <option value="Out for Delivery">Out for Delivery</option>
                <option value="Delivered">Delivered &amp; Fulfilled</option>
              </select>

              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-montserrat font-semibold text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
              <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-montserrat font-bold text-slate-800">No Customer Delivery Orders Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Orders placed by customers on the Online Storefront Portal automatically appear here with full itemized details and delivery addresses for Admin processing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((ord) => {
                let items: LineItem[] = [];
                try {
                  items = JSON.parse(ord.itemsSummary || '[]');
                } catch {}
                const totalUnits = items.reduce((s, i) => s + (i.totalBottles || i.quantityUnits || 0), 0);
                const effectiveStatus =
                  ord.deliveryStatus || (ord.status === 'Fulfilled' ? 'Delivered' : 'Pending Dispatch');

                return (
                  <div key={ord.id} className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-[#0A006E]/50 transition">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-3 py-1 bg-[#0A006E] text-[#FFDE00] font-jakarta font-black text-xs rounded-lg font-mono-tabular">
                          {ord.docNumber}
                        </span>
                        <span
                          className={`px-2.5 py-1 text-[11px] font-montserrat font-black rounded-lg ${
                            effectiveStatus === 'Delivered'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : effectiveStatus === 'Out for Delivery'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-sky-100 text-sky-900 border border-sky-300'
                          }`}
                        >
                          {effectiveStatus}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md">
                          {ord.paymentMethod}
                        </span>
                        <span className="text-xs text-slate-500 font-jakarta font-mono-tabular">
                          {new Date(ord.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">Order Total</div>
                        <div className="text-lg font-jakarta font-black text-[#0A006E] font-mono-tabular">
                          {formatKes(ord.totalAmount)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                      <div>
                        <strong className="text-slate-400 block text-[10px] uppercase">Customer Contact</strong>
                        <div className="font-bold text-slate-900">{ord.customerName}</div>
                        <div className="font-jakarta font-bold text-[#0A006E] font-mono-tabular">
                          {ord.customerPhone || 'No phone'}
                        </div>
                        {ord.customerEmail && (
                          <div className="text-[11px] text-slate-500 truncate">{ord.customerEmail}</div>
                        )}
                      </div>
                      <div>
                        <strong className="text-slate-400 block text-[10px] uppercase">Delivery Address / Zone</strong>
                        <span className="font-bold text-slate-900 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{ord.deliveryAddress || ord.regionName}</span>
                        </span>
                        {ord.deliveryNotes && (
                          <div className="text-[11px] text-amber-800 mt-0.5">Note: {ord.deliveryNotes}</div>
                        )}
                      </div>
                      <div>
                        <strong className="text-slate-400 block text-[10px] uppercase">Fulfilling Depot</strong>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                          {ord.branchName}
                        </span>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <strong className="text-[#0A006E] inline-flex items-center gap-1 mr-1.5">
                          <Package className="w-3.5 h-3.5" />
                          Items ({totalUnits} Bottles):
                        </strong>
                        {items.length > 0
                          ? items.map((i) => `${i.quantityUnits || i.totalBottles}x ${i.name}`).join(' · ')
                          : 'View details for itemized list'}
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-slate-500 font-bold">Assigned Rider:</span>
                        {ord.assignedRiderName ? (
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-indigo-600" />
                            {ord.assignedRiderName}{' '}
                            {ord.assignedRiderPhone ? `(${ord.assignedRiderPhone})` : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                            Awaiting Rider Assignment
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {onInspectCustomerOrder && (
                          <button
                            type="button"
                            onClick={() => onInspectCustomerOrder(ord)}
                            className="px-3.5 py-2 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Order Details &amp; Process Delivery
                          </button>
                        )}

                        {activeRiders.length > 0 && effectiveStatus !== 'Delivered' && (
                          <select
                            onChange={(e) => {
                              const rId = e.target.value;
                              const r = activeRiders.find((x) => x.id === rId);
                              if (r) handleQuickAssignRider(ord, r);
                            }}
                            value={ord.assignedRiderId || ''}
                            className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-montserrat font-semibold cursor-pointer"
                          >
                            <option value="">-- Quick Assign Rider --</option>
                            {activeRiders.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.branchName})
                              </option>
                            ))}
                          </select>
                        )}

                        {effectiveStatus === 'Pending Dispatch' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(ord, 'Out for Delivery')}
                            className="px-3.5 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Dispatch Rider
                          </button>
                        )}

                        {effectiveStatus === 'Out for Delivery' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusChange(ord, 'Delivered')}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Delivered
                          </button>
                        )}

                        {onPreviewDoc && (
                          <button
                            type="button"
                            onClick={() => onPreviewDoc(ord)}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Dispatch Team / Riders */}
      {activeTab === 'riders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-montserrat font-black text-sm text-[#0A006E]">Employed Dispatch Team &amp; Geo-Branch Assignments</h3>
              <p className="text-xs text-slate-500 mt-0.5">Manage delivery riders, view their assigned branches, and deploy new team members.</p>
            </div>
            {onCreateStaff && (
              <button
                type="button"
                onClick={() => setIsEmployRiderModalOpen(true)}
                className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-[#FFDE00]" />
                Employ Rider
              </button>
            )}
          </div>

          {activeRiders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-montserrat font-bold text-slate-800">No Dedicated Riders Registered Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Click &ldquo;Employ New Rider&rdquo; above or assign custom rider details directly inside any customer&apos;s Order Details modal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeRiders.map((rider) => (
                <div key={rider.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#0A006E] text-[#FFDE00] font-montserrat font-black flex items-center justify-center text-sm">
                      {rider.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-montserrat font-bold text-slate-900 text-sm">{rider.name}</h4>
                      {rider.phone && (
                        <div className="text-xs font-jakarta font-bold font-mono-tabular text-[#0A006E] flex items-center gap-1 mt-0.5">
                          <Smartphone className="w-3 h-3 text-[#0A006E]" />
                          {rider.phone}
                        </div>
                      )}
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-slate-400" />
                        {rider.email}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Assigned Branch:</span>
                      <span className="font-bold text-[#0A006E] flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[#0A006E]" />
                        {rider.branchName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Status:</span>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                        {rider.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Order Payments Audit */}
      {activeTab === 'mpesa_payments' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-montserrat font-black text-sm text-[#0A006E]">Customer Order Payments &amp; M-Pesa Reconciliation</h3>
              <p className="text-xs text-slate-500 mt-0.5">Payment tender and fulfillment clearing status for all online customer orders.</p>
            </div>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                  <th className="py-3 px-4 font-black">Order #</th>
                  <th className="py-3 px-4 font-black">Customer</th>
                  <th className="py-3 px-4 font-black">Phone</th>
                  <th className="py-3 px-4 font-black">Method</th>
                  <th className="py-3 px-4 font-black text-right">Amount (KES)</th>
                  <th className="py-3 px-4 font-black">Order Status</th>
                  <th className="py-3 px-4 font-black text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {unifiedCustomerOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-montserrat">
                      No customer order payment records yet.
                    </td>
                  </tr>
                ) : (
                  unifiedCustomerOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-jakarta font-bold text-[#0A006E] font-mono-tabular">{ord.docNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{ord.customerName}</td>
                      <td className="py-3 px-4 font-jakarta font-mono-tabular text-slate-700">{ord.customerPhone || '—'}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{ord.paymentMethod}</td>
                      <td className="py-3 px-4 font-jakarta font-black text-emerald-700 text-right font-mono-tabular">
                        {formatKes(ord.totalAmount)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          ord.status === 'Fulfilled' || ord.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {onInspectCustomerOrder && (
                          <button
                            type="button"
                            onClick={() => onInspectCustomerOrder(ord)}
                            className="px-3 py-1 bg-[#0A006E] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-black cursor-pointer"
                          >
                            View Order
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Fulfillment History */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-montserrat font-black text-sm text-[#0A006E]">Customer &amp; Rider Delivery Ledger</h3>
            <p className="text-xs text-slate-500 mt-0.5">Complete trace of customer orders, delivery addresses, and assigned riders.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {unifiedCustomerOrders.map((ord) => (
              <div key={ord.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-jakarta font-bold text-[#0A006E] font-mono-tabular">{ord.docNumber}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-slate-900">{ord.customerName} ({ord.customerPhone || 'No phone'})</span>
                  </div>
                  <div className="text-slate-500">
                    Address: {ord.deliveryAddress || ord.regionName} · Rider: <strong className="text-slate-800">{ord.assignedRiderName || 'Unassigned'}</strong>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-jakarta font-black text-emerald-700 text-sm font-mono-tabular">{formatKes(ord.totalAmount)}</div>
                    <div className="text-[10px] text-slate-400">{new Date(ord.createdAt).toLocaleDateString()}</div>
                  </div>
                  {onInspectCustomerOrder && (
                    <button
                      type="button"
                      onClick={() => onInspectCustomerOrder(ord)}
                      className="px-3 py-1.5 bg-[#FFDE00] text-[#0A006E] border border-[#0A006E] rounded-lg text-[11px] font-montserrat font-black cursor-pointer"
                    >
                      Details
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Employ Rider Modal */}
      {isEmployRiderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-montserrat font-black text-base text-[#0A006E] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0A006E]" />
                Employ &amp; Assign New Dispatch Rider
              </h3>
              <button
                type="button"
                onClick={() => setIsEmployRiderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmployRider} className="space-y-4 text-xs">
              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">Rider Full Name</label>
                <input
                  type="text"
                  value={riderName}
                  onChange={(e) => setRiderName(e.target.value)}
                  placeholder="e.g. Brian Ochieng"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">Mobile Phone Number</label>
                <input
                  type="tel"
                  value={riderPhone}
                  onChange={(e) => setRiderPhone(e.target.value)}
                  placeholder="e.g. +254 712 345678"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={riderEmail}
                  onChange={(e) => setRiderEmail(e.target.value)}
                  placeholder="e.g. brian.ochieng@vaairoliquor.co.ke"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">Assign Geo-Location / Branch</label>
                <select
                  value={riderBranchId}
                  onChange={(e) => setRiderBranchId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-montserrat font-bold text-[#0A006E] cursor-pointer"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.regionName})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">6-Digit Secure POS PIN</label>
                <input
                  type="text"
                  value={riderPin}
                  onChange={(e) => setRiderPin(e.target.value)}
                  maxLength={6}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEmployRiderModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-montserrat font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs cursor-pointer shadow-md"
                >
                  Confirm Employment &amp; Assign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
