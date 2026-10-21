import React, { useState, useMemo } from 'react';
import { StaffMember, Branch, WebsiteDeliveryOrder } from '../types';
import { useErp } from '../context/ErpContext';
import { formatKes } from '../erpUtils';
import {
  Truck,
  Users,
  MapPin,
  Smartphone,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  ShieldCheck,
  Building2,
  DollarSign,
  Activity,
  UserPlus,
  Phone,
  Mail
} from 'lucide-react';

interface DeliveryManagementModuleProps {
  currentUser: StaffMember;
  branches: Branch[];
  staffList: StaffMember[];
  onCreateStaff?: (newStaff: Omit<StaffMember, 'id' | 'createdAt'>) => Promise<void>;
  onTriggerToast: (type: 'success' | 'error', title: string, message: string) => void;
}

export const DeliveryManagementModule: React.FC<DeliveryManagementModuleProps> = ({
  currentUser,
  branches,
  staffList,
  onCreateStaff,
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

  // Active riders list (staff with role 'Delivery Rider' or matching rider criteria)
  const activeRiders = useMemo(() => {
    return staffList.filter(
      (s) => s.role === 'Delivery Rider' || (s.role as string).toLowerCase().includes('rider')
    );
  }, [staffList]);

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
    return websiteDeliveryOrders.filter((ord) => {
      const matchStatus =
        statusFilter === 'ALL' || ord.deliveryStatus === statusFilter;
      const matchBranch =
        selectedBranchFilter === 'ALL' || ord.branchId === selectedBranchFilter;
      const q = orderSearchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        ord.orderNumber.toLowerCase().includes(q) ||
        ord.customerName.toLowerCase().includes(q) ||
        ord.customerPhone.includes(q) ||
        ord.deliveryLocation.toLowerCase().includes(q);

      return matchStatus && matchBranch && matchSearch;
    });
  }, [websiteDeliveryOrders, statusFilter, selectedBranchFilter, orderSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Delivery Manager Header Banner */}
      <div className="bg-gradient-to-r from-[#0A006E] via-[#15078a] to-[#1E3A8A] text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-montserrat font-black bg-[#FFDE00] text-[#0A006E] mb-2">
            <Truck className="w-4 h-4" />
            Delivery Manager & Dispatch Control Hub
          </div>
          <h1 className="text-2xl md:text-3xl font-montserrat font-black tracking-tight text-white">
            Online Orders, Rider Dispatch & M-Pesa Verification
          </h1>
          <p className="text-xs md:text-sm text-slate-200 mt-1 max-w-2xl font-medium">
            Manage incoming online delivery orders, employ and geo-assign dispatch riders to regional branches, and monitor M-Pesa payments in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsEmployRiderModalOpen(true)}
            className="px-4 py-3 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-2xl text-xs font-montserrat font-black flex items-center gap-2 cursor-pointer shadow-lg transition hover:scale-105"
          >
            <UserPlus className="w-4 h-4" />
            Employ New Rider
          </button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {[
          { id: 'orders', label: `Online Dispatch Queue (${websiteDeliveryOrders.length})`, icon: Truck },
          { id: 'riders', label: `Dispatch Team / Riders (${activeRiders.length})`, icon: Users },
          { id: 'mpesa_payments', label: `M-Pesa Payments Audit`, icon: Smartphone },
          { id: 'transactions', label: `Customer / Rider Transactions`, icon: Activity },
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

      {/* Tab 1: Online Orders Queue */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearchQuery}
                onChange={(e) => setOrderSearchQuery(e.target.value)}
                placeholder="Search orders by order #, customer name, phone, or location..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-montserrat font-semibold text-slate-700 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="ON_HOLD_PENDING_DELIVERY">Pending Dispatch</option>
                <option value="OUT_FOR_DELIVERY">Out For Delivery</option>
                <option value="COMPLETED_AND_PAID">Completed & Paid</option>
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
              <h3 className="text-base font-montserrat font-bold text-slate-800">No Online Orders Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Online orders placed on the customer portal storefront website will automatically queue here for dispatch assignment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((ord) => (
                <div key={ord.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 hover:border-indigo-300 transition">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-3 py-1 bg-[#0A006E] text-[#FFDE00] font-mono font-black text-xs rounded-lg">
                        {ord.orderNumber}
                      </span>
                      <span className={`px-2.5 py-1 text-[11px] font-montserrat font-bold rounded-lg ${
                        ord.deliveryStatus === 'COMPLETED_AND_PAID' ? 'bg-emerald-100 text-emerald-800' :
                        ord.deliveryStatus === 'OUT_FOR_DELIVERY' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {ord.deliveryStatus}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{new Date(ord.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-semibold uppercase">Order Total</div>
                      <div className="text-base font-montserrat font-black text-[#0A006E]">{formatKes(ord.totalCompanyPriceKes)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                    <div>
                      <strong className="text-slate-400 block text-[10px] uppercase">Customer</strong>
                      <span className="font-bold text-slate-900">{ord.customerName}</span> ({ord.customerPhone})
                    </div>
                    <div>
                      <strong className="text-slate-400 block text-[10px] uppercase">Delivery Location</strong>
                      <span className="font-medium text-slate-900 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        {ord.deliveryLocation}
                      </span>
                    </div>
                    <div>
                      <strong className="text-slate-400 block text-[10px] uppercase">Fulfilling Branch</strong>
                      <span className="font-semibold text-slate-800 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-[#0A006E] shrink-0" />
                        {ord.branchName}
                      </span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <strong className="text-slate-500">Items ({ord.items.reduce((s, i) => s + i.quantity, 0)}):</strong>{' '}
                    {ord.items.map((i) => `${i.quantity}x ${i.product.name}`).join(', ')}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-bold">Assigned Rider:</span>
                      {ord.riderName ? (
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-bold flex items-center gap-1">
                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                          {ord.riderName} ({ord.riderPhone})
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 font-bold italic">⚠️ Unassigned</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        onChange={(e) => {
                          const rId = e.target.value;
                          const r = activeRiders.find((x) => x.id === rId);
                          if (r) {
                            assignRiderToWebsiteDeliveryOrder(ord.id, r.name, r.email || '+254 700 000000');
                            onTriggerToast('success', 'Rider Assigned', `Assigned ${r.name} to order ${ord.orderNumber}.`);
                          }
                        }}
                        defaultValue=""
                        className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-montserrat font-semibold cursor-pointer"
                      >
                        <option value="" disabled>-- Assign Dispatch Rider --</option>
                        {activeRiders.map((r) => (
                          <option key={r.id} value={r.id}>{r.name} ({r.branchName})</option>
                        ))}
                      </select>

                      {ord.deliveryStatus !== 'OUT_FOR_DELIVERY' && ord.deliveryStatus !== 'COMPLETED_AND_PAID' && (
                        <button
                          type="button"
                          onClick={() => {
                            updateWebsiteDeliveryOrderStatus(ord.id, 'OUT_FOR_DELIVERY');
                            onTriggerToast('success', 'Dispatched', `Order ${ord.orderNumber} is now Out for Delivery.`);
                          }}
                          className="px-4 py-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs"
                        >
                          Dispatch Rider
                        </button>
                      )}

                      {ord.deliveryStatus === 'OUT_FOR_DELIVERY' && (
                        <button
                          type="button"
                          onClick={() => {
                            updateWebsiteDeliveryOrderStatus(ord.id, 'COMPLETED_AND_PAID');
                            onTriggerToast('success', 'Delivered & Paid', `Order ${ord.orderNumber} marked as completed and paid.`);
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs"
                        >
                          Mark Delivered
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
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
            <button
              type="button"
              onClick={() => setIsEmployRiderModalOpen(true)}
              className="px-4 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-[#FFDE00]" />
              Employ Rider
            </button>
          </div>

          {activeRiders.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-xs">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-montserrat font-bold text-slate-800">No Riders Employed Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Click "Employ New Rider" above or use HR &amp; Role Provisioning to create delivery rider accounts.
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

      {/* Tab 3: M-Pesa Payments Audit */}
      {activeTab === 'mpesa_payments' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <h3 className="font-montserrat font-black text-sm text-[#0A006E]">M-Pesa Till &amp; Online Payment Transactions</h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time M-Pesa payment clearing and reconciliation for online orders.</p>
            </div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-montserrat font-black rounded-lg">
              Daraja API Connected
            </span>
          </div>

          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                  <th className="py-3 px-4 font-black">Order #</th>
                  <th className="py-3 px-4 font-black">Customer</th>
                  <th className="py-3 px-4 font-black">M-Pesa Phone</th>
                  <th className="py-3 px-4 font-black text-right">Amount (KES)</th>
                  <th className="py-3 px-4 font-black">Payment Status</th>
                  <th className="py-3 px-4 font-black">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {websiteDeliveryOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-montserrat">
                      No M-Pesa payment transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  websiteDeliveryOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-[#0A006E]">{ord.orderNumber}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{ord.customerName}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{ord.customerPhone}</td>
                      <td className="py-3 px-4 font-mono-tabular font-bold text-emerald-700 text-right">
                        {formatKes(ord.totalCompanyPriceKes)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          ord.deliveryStatus === 'COMPLETED_AND_PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {ord.deliveryStatus === 'COMPLETED_AND_PAID' ? 'Verified & Cleared' : 'Pending Verification'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(ord.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Customer / Rider Transactions */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <h3 className="font-montserrat font-black text-sm text-[#0A006E]">Recent Transactions by Customer &amp; Rider</h3>
            <p className="text-xs text-slate-500 mt-0.5">Audit trail of all deliveries fulfilled by specific riders and ordered by customers.</p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {websiteDeliveryOrders.map((ord) => (
              <div key={ord.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0A006E]">{ord.orderNumber}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-bold text-slate-900">{ord.customerName} ({ord.customerPhone})</span>
                  </div>
                  <div className="text-slate-500">
                    Location: {ord.deliveryLocation} · Rider: <strong className="text-slate-800">{ord.riderName || 'Unassigned'}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-tabular font-black text-emerald-700 text-sm">{formatKes(ord.totalCompanyPriceKes)}</div>
                  <div className="text-[10px] text-slate-400">{new Date(ord.createdAt).toLocaleDateString()}</div>
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
                className="text-slate-400 hover:text-slate-600 font-bold"
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
