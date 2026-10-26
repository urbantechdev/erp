import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Truck,
  MapPin,
  Phone,
  Mail,
  User,
  Building2,
  Package,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  CreditCard,
  Copy,
  Check,
  Navigation,
  ShieldCheck,
} from 'lucide-react';
import { TransactionDoc, StaffMember, LineItem, OrderDeliveryStatus } from '../types';
import { formatKes } from '../erpUtils';

interface CustomerOrderDetailsModalProps {
  order: TransactionDoc | null;
  onClose: () => void;
  staffList: StaffMember[];
  currentUser: StaffMember;
  onProcessDeliveryUpdate: (
    txId: string,
    updates: Partial<TransactionDoc>
  ) => Promise<boolean>;
  onPreviewDoc: (doc: TransactionDoc) => void;
}

export const CustomerOrderDetailsModal: React.FC<CustomerOrderDetailsModalProps> = ({
  order,
  onClose,
  staffList,
  currentUser,
  onProcessDeliveryUpdate,
  onPreviewDoc,
}) => {
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [customRiderName, setCustomRiderName] = useState<string>('');
  const [customRiderPhone, setCustomRiderPhone] = useState<string>('');
  const [dispatchNote, setDispatchNote] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [copiedPhone, setCopiedPhone] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setSelectedRiderId(order.assignedRiderId || '');
      setCustomRiderName(order.assignedRiderName || '');
      setCustomRiderPhone(order.assignedRiderPhone || '');
      setDispatchNote(order.deliveryNotes || '');
    }
  }, [order?.id]);

  const parsedItems = useMemo<LineItem[]>(() => {
    if (!order?.itemsSummary) return [];
    try {
      const parsed = JSON.parse(order.itemsSummary);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [order?.itemsSummary]);

  const availableRiders = useMemo(() => {
    return staffList.filter(
      (s) =>
        s.status === 'Active' &&
        (s.role === 'Delivery Rider' ||
          s.role === 'Delivery Manager' ||
          (s.role as string).toLowerCase().includes('rider'))
    );
  }, [staffList]);

  if (!order) return null;

  const effectiveDeliveryStatus: OrderDeliveryStatus =
    order.deliveryStatus ||
    (order.status === 'Fulfilled' ? 'Delivered' : 'Pending Dispatch');

  const totalBottles = parsedItems.reduce(
    (sum, item) => sum + (item.totalBottles || item.quantityUnits || 0),
    0
  );

  const handleSelectRiderPreset = (riderId: string) => {
    setSelectedRiderId(riderId);
    const rider = availableRiders.find((r) => r.id === riderId);
    if (rider) {
      setCustomRiderName(rider.name);
      setCustomRiderPhone(
        rider.phone ||
          (rider.email?.includes('@') ? '+254 700 000000' : rider.email || '+254 700 000000')
      );
    }
  };

  const handleDispatchOrder = async () => {
    setIsUpdating(true);
    try {
      const riderNameFinal = customRiderName.trim() || 'Assigned Dispatch Rider';
      const riderPhoneFinal = customRiderPhone.trim() || 'Branch Fleet';
      await onProcessDeliveryUpdate(order.id, {
        deliveryStatus: 'Out for Delivery',
        assignedRiderId: selectedRiderId || undefined,
        assignedRiderName: riderNameFinal,
        assignedRiderPhone: riderPhoneFinal,
        deliveryNotes: dispatchNote.trim() || order.deliveryNotes,
        dispatchedAt: new Date().toISOString(),
        status: order.status === 'Issued' ? 'Approved' : order.status,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelivered = async () => {
    setIsUpdating(true);
    try {
      await onProcessDeliveryUpdate(order.id, {
        deliveryStatus: 'Delivered',
        status: 'Fulfilled',
        deliveredAt: new Date().toISOString(),
        assignedRiderName: customRiderName.trim() || order.assignedRiderName || currentUser.name,
        assignedRiderPhone: customRiderPhone.trim() || order.assignedRiderPhone,
        deliveryNotes: dispatchNote.trim() || order.deliveryNotes,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrintDeliveryNote = () => {
    const derivedDeliveryNote: TransactionDoc = {
      ...order,
      docType: 'Delivery Note',
      docNumber: order.docNumber.startsWith('DN-')
        ? order.docNumber
        : `DN-${order.docNumber.replace(/^[A-Z]+-/, '')}`,
    };
    onPreviewDoc(derivedDeliveryNote);
  };

  const handleCopyPhone = () => {
    if (!order.customerPhone) return;
    navigator.clipboard?.writeText(order.customerPhone).catch(() => {});
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl max-w-4xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-[#0A006E] text-white px-5 py-4 sm:px-6 sm:py-5 flex items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-[#FFDE00] text-[#0A006E] font-jakarta font-black text-xs font-mono-tabular">
                {order.docNumber}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-white text-[11px] font-montserrat font-bold">
                {order.docType} · {order.channel}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-montserrat font-black ${
                  effectiveDeliveryStatus === 'Delivered'
                    ? 'bg-[#34D186] text-[#0A006E]'
                    : effectiveDeliveryStatus === 'Out for Delivery'
                    ? 'bg-amber-400 text-[#0A006E]'
                    : 'bg-sky-400 text-[#0A006E]'
                }`}
              >
                {effectiveDeliveryStatus}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-montserrat font-black text-white">
              Customer Order Details &amp; Delivery Fulfillment Control
            </h3>
            <p className="text-[11px] text-slate-300 font-jakarta">
              Placed {new Date(order.createdAt).toLocaleString()} · Fulfilling Hub: {order.branchName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* 3-Step Delivery Pipeline */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  step: '1',
                  title: 'Order Received',
                  desc: 'Verified & queued for packing',
                  done: true,
                  active: effectiveDeliveryStatus === 'Pending Dispatch',
                },
                {
                  step: '2',
                  title: 'Out for Delivery',
                  desc: order.assignedRiderName
                    ? `Rider: ${order.assignedRiderName}`
                    : 'Assign rider & dispatch',
                  done:
                    effectiveDeliveryStatus === 'Out for Delivery' ||
                    effectiveDeliveryStatus === 'Delivered',
                  active: effectiveDeliveryStatus === 'Out for Delivery',
                },
                {
                  step: '3',
                  title: 'Delivered & Fulfilled',
                  desc: order.deliveredAt
                    ? `Completed ${new Date(order.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Customer handover confirmed',
                  done: effectiveDeliveryStatus === 'Delivered',
                  active: effectiveDeliveryStatus === 'Delivered',
                },
              ].map((st) => (
                <div
                  key={st.step}
                  className={`p-3 rounded-xl border-2 flex items-center gap-3 ${
                    st.active
                      ? 'bg-white border-[#0A006E] shadow-xs'
                      : st.done
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-white/60 border-slate-200 opacity-75'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-jakarta font-black text-xs shrink-0 ${
                      st.done
                        ? 'bg-[#1E9E60] text-white'
                        : st.active
                        ? 'bg-[#0A006E] text-[#FFDE00]'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {st.done ? <Check className="w-4 h-4 stroke-[2.8]" /> : st.step}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-montserrat font-black text-slate-900 truncate">
                      {st.title}
                    </div>
                    <div className="text-[11px] text-slate-600 truncate">{st.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Contact, Delivery Destination & Payment Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer & Delivery Address */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <User className="w-4 h-4 text-[#0A006E]" />
                <h4 className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                  Customer &amp; Delivery Destination
                </h4>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-500 font-semibold">Customer Name:</span>
                  <span className="font-montserrat font-black text-slate-900 text-right">
                    {order.customerName || 'Walk-in / Online Customer'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone / M-Pesa:
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-jakarta font-black text-[#0A006E] font-mono-tabular">
                      {order.customerPhone || 'Not provided'}
                    </span>
                    {order.customerPhone && (
                      <button
                        type="button"
                        onClick={handleCopyPhone}
                        className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        title="Copy Phone Number"
                      >
                        {copiedPhone ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {order.customerEmail && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Verified Email:
                    </span>
                    <span className="font-semibold text-slate-800 truncate max-w-[220px]">
                      {order.customerEmail}
                    </span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-montserrat font-black text-rose-700 uppercase tracking-wider flex items-center gap-1 mb-1">
                    <MapPin className="w-3.5 h-3.5 text-rose-600" /> Delivery Street Address / Landmark
                  </span>
                  <div className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200 text-xs font-bold text-slate-900">
                    {order.deliveryAddress || order.regionName || 'Direct Branch Collection / Standard Zone'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-slate-500 font-semibold">Geo-Pricing Zone:</span>
                  <span className="font-semibold text-slate-800 text-right">{order.regionName}</span>
                </div>

                {order.deliveryNotes && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                    <strong>Delivery Instructions:</strong> {order.deliveryNotes}
                  </div>
                )}
              </div>
            </div>

            {/* Financial & Fulfillment Depot Summary */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <CreditCard className="w-4 h-4 text-[#0A006E]" />
                  <h4 className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                    Payment &amp; Fulfillment Summary
                  </h4>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Fulfilling Branch:</span>
                    <span className="font-montserrat font-bold text-[#0A006E] flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {order.branchName}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Payment Tender:</span>
                    <span className="px-2 py-0.5 rounded-md bg-[#F0F2F0] border border-slate-300 font-bold text-slate-900">
                      {order.paymentMethod || 'M-Pesa STK'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Commercial Status:</span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold">
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">Total Pack Count:</span>
                    <span className="font-jakarta font-black text-slate-900 font-mono-tabular">
                      {parsedItems.length} Line SKUs ({totalBottles} Units/Bottles)
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-[#F0F2F0] rounded-xl p-3.5 space-y-1.5 border border-slate-200 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Order Subtotal</span>
                  <span className="font-jakarta font-bold font-mono-tabular">
                    {formatKes(order.subtotal || order.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VAT &amp; Excise Tax</span>
                  <span className="font-jakarta font-bold font-mono-tabular">
                    {formatKes(order.exciseAndTax || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-300">
                  <span className="font-montserrat font-black text-slate-900 uppercase">Total Order Value</span>
                  <span className="text-lg font-jakarta font-black text-[#0A006E] font-mono-tabular">
                    {formatKes(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Order Picking & Packing Manifest */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-[#F0F2F0] border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0A006E]" />
                <h4 className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                  Itemized Customer Order Manifest ({parsedItems.length} Items)
                </h4>
              </div>
              <span className="text-xs font-jakarta font-black text-[#0A006E] font-mono-tabular">
                Total Qty: {totalBottles} Bottles
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">SKU</th>
                    <th className="py-2.5 px-3 font-black">Product Description</th>
                    <th className="py-2.5 px-3 font-black">Unit</th>
                    <th className="py-2.5 px-3 font-black text-right">Qty</th>
                    <th className="py-2.5 px-3 font-black text-right">Unit Price</th>
                    <th className="py-2.5 px-3 font-black text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parsedItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No itemized SKU lines recorded on this document.
                      </td>
                    </tr>
                  ) : (
                    parsedItems.map((item, idx) => (
                      <tr key={`${item.productId || item.sku}-${idx}`} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-jakarta font-bold text-[#0A006E] font-mono-tabular">
                          {item.sku || 'SKU'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{item.name}</td>
                        <td className="py-2.5 px-3 text-slate-600">{item.unitMode || 'Bottle'}</td>
                        <td className="py-2.5 px-3 text-right font-jakarta font-black text-[#0A006E] font-mono-tabular">
                          {item.quantityUnits || item.totalBottles || 1}
                        </td>
                        <td className="py-2.5 px-3 text-right font-jakarta font-bold text-slate-700 font-mono-tabular">
                          {formatKes(item.unitPrice || 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-jakarta font-black text-slate-900 font-mono-tabular">
                          {formatKes(
                            item.lineTotal ||
                              (item.quantityUnits || item.totalBottles || 1) * (item.unitPrice || 0)
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery Rider Assignment & Dispatch Execution */}
          <div className="bg-[#F0F2F0] border-2 border-[#0A006E]/20 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#0A006E]" />
                <h4 className="text-xs sm:text-sm font-montserrat font-black text-[#0A006E]">
                  Process Delivery · Rider Assignment &amp; Dispatch Sign-Off
                </h4>
              </div>
              {order.assignedRiderName && (
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-900 text-[11px] font-bold">
                  Assigned Rider: {order.assignedRiderName}{' '}
                  {order.assignedRiderPhone ? `(${order.assignedRiderPhone})` : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="font-montserrat font-bold text-slate-700 block mb-1">
                  Select Registered Fleet Rider
                </label>
                <select
                  value={selectedRiderId}
                  onChange={(e) => handleSelectRiderPreset(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800"
                >
                  <option value="">-- Choose Rider or Enter Custom --</option>
                  {availableRiders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.branchName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-montserrat font-bold text-slate-700 block mb-1">
                  Dispatch Rider / Courier Name *
                </label>
                <input
                  type="text"
                  value={customRiderName}
                  onChange={(e) => setCustomRiderName(e.target.value)}
                  placeholder="e.g. Peter Kamau (Bike KMF 412Z)"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="font-montserrat font-bold text-slate-700 block mb-1">
                  Rider Contact Phone
                </label>
                <input
                  type="text"
                  value={customRiderPhone}
                  onChange={(e) => setCustomRiderPhone(e.target.value)}
                  placeholder="e.g. 0722 000 111"
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl font-jakarta font-bold font-mono-tabular text-slate-900"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="font-montserrat font-bold text-slate-700 block mb-1">
                Dispatch Instructions / Gate Pass / Rider Notes
              </label>
              <input
                type="text"
                value={dispatchNote}
                onChange={(e) => setDispatchNote(e.target.value)}
                placeholder="e.g. Call customer on arrival at main gate, verify ID & M-Pesa confirmation..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintDeliveryNote}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer transition"
                >
                  <FileText className="w-4 h-4" />
                  Print Delivery Note
                </button>
                <button
                  type="button"
                  onClick={() => onPreviewDoc(order)}
                  className="px-3.5 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Printer className="w-4 h-4" />
                  Print {order.docType}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {effectiveDeliveryStatus !== 'Delivered' && (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={handleDispatchOrder}
                    className="px-4 py-2.5 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition disabled:opacity-50"
                  >
                    <Navigation className="w-4 h-4" />
                    {effectiveDeliveryStatus === 'Out for Delivery'
                      ? 'Update Assigned Rider'
                      : 'Assign Rider & Dispatch Delivery'}
                  </button>
                )}

                {effectiveDeliveryStatus !== 'Delivered' ? (
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={handleConfirmDelivered}
                    className="px-4 py-2.5 bg-[#1E9E60] hover:bg-emerald-700 text-white rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark Delivered &amp; Fulfilled
                  </button>
                ) : (
                  <span className="px-4 py-2.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    Delivery Fulfilled
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
