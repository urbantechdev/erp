import React, { useState, useEffect } from 'react';
import { CustomerStorefrontWebsite } from './storefront/CustomerStorefrontWebsite';
import { ErpProvider, useErp } from '../context/ErpContext';
import { Product, Branch, GeoRegion, TransactionDoc, SaleOrder, WebsiteDeliveryOrder, LiveLoggedInCustomer, ProductRatingRecord } from '../types';
import { ShoppingBag, Package, Users, Truck, CheckCircle2, Clock, Phone, MapPin, RefreshCw, Star, ShieldCheck, ArrowLeft, Settings, Globe } from 'lucide-react';
import { formatKes } from '../erpUtils';

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

const AdminWebStoreDashboard: React.FC<{ onSwitchToStorefront: () => void }> = ({ onSwitchToStorefront }) => {
  const { websiteDeliveryOrders, updateWebsiteDeliveryOrderStatus, assignRiderToWebsiteDeliveryOrder, productRatings, branches } = useErp();
  const [activeAdminTab, setActiveAdminTab] = useState<'orders' | 'customers' | 'reviews' | 'sync'>('orders');
  const [riderNameInput, setRiderNameInput] = useState('');
  const [riderPhoneInput, setRiderPhoneInput] = useState('');
  const [selectedOrderIdForRider, setSelectedOrderIdForRider] = useState<string | null>(null);

  // Read live customer sessions from localStorage
  const [liveSessions, setLiveSessions] = useState<LiveLoggedInCustomer[]>([]);
  useEffect(() => {
    const loadSessions = () => {
      try {
        const saved = localStorage.getItem('vaairo_live_customer_sessions_v1');
        if (saved) {
          setLiveSessions(JSON.parse(saved));
        }
      } catch {
        // ignore
      }
    };
    loadSessions();
    const interval = setInterval(loadSessions, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 md:p-8">
      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Settings className="w-4 h-4" /> Platform Administration & Web Store Bridge
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Customer E-Commerce & CRM Control Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">Bi-directional synchronization between the public website storefront and ERP platform administration.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onSwitchToStorefront}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg transition-all"
          >
            <Globe className="w-4 h-4" /> Open Public Storefront
          </button>
        </div>
      </div>

      {/* Admin Sub-Tabs */}
      <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => setActiveAdminTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeAdminTab === 'orders' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" /> Website Orders ({websiteDeliveryOrders.length})
        </button>
        <button
          onClick={() => setActiveAdminTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeAdminTab === 'customers' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" /> Live Customer Sessions ({liveSessions.length})
        </button>
        <button
          onClick={() => setActiveAdminTab('reviews')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeAdminTab === 'reviews' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Star className="w-4 h-4" /> Customer Reviews & Ratings ({productRatings.length})
        </button>
        <button
          onClick={() => setActiveAdminTab('sync')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
            activeAdminTab === 'sync' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <RefreshCw className="w-4 h-4" /> Inventory & Pricing Sync
        </button>
      </div>

      {/* Tab 1: Website Orders */}
      {activeAdminTab === 'orders' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-indigo-400" /> Incoming Website & Delivery Orders
            </h2>
            <span className="text-xs text-slate-400">Auto-syncs with M-Pesa Daraja & ERP Finance</span>
          </div>

          {websiteDeliveryOrders.length === 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-12 text-center">
              <ShoppingBag className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No Website Orders Placed Yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">Orders placed by customers on the public storefront website will instantly appear here for rider dispatch and ERP payment clearing.</p>
              <button
                onClick={onSwitchToStorefront}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
              >
                Place Test Order on Storefront
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {websiteDeliveryOrders.map(ord => (
                <div key={ord.id} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-extrabold rounded-lg border border-indigo-500/30">
                        {ord.orderNumber}
                      </span>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-lg ${
                        ord.deliveryStatus === 'COMPLETED_AND_PAID' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        ord.deliveryStatus === 'OUT_FOR_DELIVERY' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      }`}>
                        {ord.deliveryStatus}
                      </span>
                      <span className="text-xs text-slate-400">{new Date(ord.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-slate-300">
                      <div><strong className="text-slate-400">Customer:</strong> {ord.customerName} ({ord.customerPhone})</div>
                      <div><strong className="text-slate-400">Location:</strong> {ord.deliveryLocation}</div>
                      <div><strong className="text-slate-400">Branch:</strong> {ord.branchName}</div>
                    </div>

                    <div className="text-xs text-slate-400 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">
                      <strong className="text-slate-300">Items ({ord.items.reduce((s, i) => s + i.quantity, 0)}):</strong>{' '}
                      {ord.items.map(i => `${i.quantity}x ${i.product.name}`).join(', ')}
                    </div>

                    {ord.riderName && (
                      <div className="text-xs text-indigo-300 flex items-center gap-1.5 font-medium">
                        <Truck className="w-3.5 h-3.5 text-indigo-400" /> Rider: {ord.riderName} ({ord.riderPhone})
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                    <div className="text-right pr-2">
                      <div className="text-xs text-slate-400">Total Company Price</div>
                      <div className="text-lg font-extrabold text-emerald-400">{formatKes(ord.totalCompanyPriceKes)}</div>
                    </div>

                    {ord.deliveryStatus !== 'COMPLETED_AND_PAID' && (
                      <div className="flex items-center gap-2">
                        {ord.deliveryStatus === 'ON_HOLD_PENDING_DELIVERY' && (
                          <button
                            onClick={() => updateWebsiteDeliveryOrderStatus(ord.id, 'OUT_FOR_DELIVERY')}
                            className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all"
                          >
                            Dispatch Rider
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedOrderIdForRider(selectedOrderIdForRider === ord.id ? null : ord.id);
                            setRiderNameInput(ord.riderName || '');
                            setRiderPhoneInput(ord.riderPhone || '');
                          }}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all"
                        >
                          Assign Rider
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rider Assignment Modal Inline */}
          {selectedOrderIdForRider && (
            <div className="bg-slate-800 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-3">Assign / Update Dispatch Rider</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Rider Name (e.g. James Mwangi)"
                  value={riderNameInput}
                  onChange={e => setRiderNameInput(e.target.value)}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="text"
                  placeholder="Rider Phone (+254...)"
                  value={riderPhoneInput}
                  onChange={e => setRiderPhoneInput(e.target.value)}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setSelectedOrderIdForRider(null)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (riderNameInput.trim()) {
                      assignRiderToWebsiteDeliveryOrder(selectedOrderIdForRider, riderNameInput.trim(), riderPhoneInput.trim());
                      setSelectedOrderIdForRider(null);
                    }
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                >
                  Save Rider Assignment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Customer Sessions */}
      {activeAdminTab === 'customers' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" /> Live Active Storefront Customer Sessions
            </h2>
            <span className="text-xs text-slate-400">Real-time broadcast from Gmail Sign-In & browser activity</span>
          </div>

          {liveSessions.length === 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-12 text-center">
              <Users className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No Active Storefront Sessions</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">When customers sign in with Gmail on the public storefront website, their active sessions appear here instantly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveSessions.map((session, idx) => (
                <div key={idx} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-extrabold text-sm">
                      {session.name ? session.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{session.name}</div>
                      <div className="text-xs text-slate-400">{session.email}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300 border-t border-slate-700/60 pt-3">
                    <div><strong className="text-slate-400">Phone:</strong> {session.phone || 'Not provided'} ({session.carrier})</div>
                    <div><strong className="text-slate-400">Fulfilling Branch:</strong> {session.branchName}</div>
                    <div><strong className="text-slate-400">Cart Status:</strong> {session.cartItemsCount} items ({formatKes(session.cartTotalKes)})</div>
                    <div><strong className="text-slate-400">Status:</strong> <span className="text-emerald-400 font-bold">{session.status}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Customer Reviews */}
      {activeAdminTab === 'reviews' && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-indigo-400" /> Customer Product Reviews & Ratings
            </h2>
            <span className="text-xs text-slate-400">Verified buyer feedback from storefront catalog</span>
          </div>

          {productRatings.length === 0 ? (
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-12 text-center">
              <Star className="w-12 h-12 text-slate-500 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white">No Customer Reviews Yet</h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto mt-1">Customer star ratings and product reviews submitted on the storefront will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {productRatings.map(rate => (
                <div key={rate.id} className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < rate.stars ? 'fill-current' : 'text-slate-600'}`} />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">{new Date(rate.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-sm font-bold text-white">{rate.raterName} {rate.isVerifiedBuyer && <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md">Verified Buyer</span>}</div>
                  <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/50">{rate.comment}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Inventory & Pricing Sync */}
      {activeAdminTab === 'sync' && (
        <div className="mt-6 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" /> Bi-Directional ERP to Storefront Synchronization
            </h2>
            <p className="text-sm text-slate-300">
              Platform administration is fully synchronized with the customer storefront website. Any updates made in ERP Inventory, Geo-Pricing, or Branch Management reflect instantly on the customer storefront.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-700">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700">
                <div className="text-xs text-slate-400">Branches Active</div>
                <div className="text-xl font-extrabold text-white mt-1">{branches.length} Branches</div>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700">
                <div className="text-xs text-slate-400">Order Routing Model</div>
                <div className="text-xl font-extrabold text-indigo-400 mt-1">GPS Haversine / Geofence</div>
              </div>
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700">
                <div className="text-xs text-slate-400">ETIMS & M-Pesa Daraja</div>
                <div className="text-xl font-extrabold text-emerald-400 mt-1">Connected & Active</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  products,
  branches,
  onPlaceOnlineOrder,
  onPreviewDoc,
  onBackToErpLogin,
}) => {
  const [viewMode, setViewMode] = useState<'storefront' | 'admin'>('storefront');

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
        regionId: 'reg-nrb-wst',
        regionName: 'Nairobi West & Parklands',
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
      <div className="w-full min-h-screen relative">
        {/* Floating Admin / Storefront Toggle Bar */}
        <div className="absolute top-3 right-4 z-50 flex items-center gap-2 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-1.5 shadow-2xl">
          <button
            onClick={() => setViewMode('storefront')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'storefront' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Customer Storefront
          </button>
          <button
            onClick={() => setViewMode('admin')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Platform Admin & CRM
          </button>
          {onBackToErpLogin && (
            <button
              onClick={onBackToErpLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all border border-slate-700"
              title="Return to ERP Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> ERP ERP
            </button>
          )}
        </div>

        {viewMode === 'storefront' ? (
          <CustomerStorefrontWebsite onSwitchToErp={onBackToErpLogin || (() => setViewMode('admin'))} />
        ) : (
          <AdminWebStoreDashboard onSwitchToStorefront={() => setViewMode('storefront')} />
        )}
      </div>
    </ErpProvider>
  );
};
