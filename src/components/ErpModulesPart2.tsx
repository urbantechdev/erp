import React, { useState, useMemo } from 'react';
import {
  UserPlus,
  Download,
  Plus,
  Lock,
  CheckCircle2,
  Pencil,
  Trash2,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  XCircle,
  X,
  Users,
  Printer,
  Receipt,
  DollarSign,
  Calculator,
  Calendar,
  History,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Coins,
  Eye,
  Building2,
  Tag,
  Package,
  FileText,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import {
  StaffMember,
  StaffRole,
  Branch,
  GeoRegion,
  Partner,
  TransactionDoc,
  ComplianceRecord,
  AuditLog,
  Product,
  PayrollRun,
  PayrollRecord,
  BusinessUnit,
} from '../types';
import { GoogleIcon } from './icons/GoogleIcon';
import {
  ROLE_PERMISSIONS,
  exportToCSV,
  exportReportToPDF,
  exportCommercialDocumentPDF,
  formatKes,
  isUserFeaturePermitted,
} from '../erpUtils';
import { hashPassword } from '../utils/security';
import { cleanFirestoreData } from '../firebase';
import { AnimatedSuccessTickIcon, StatusFeedbackToast } from './AnimatedFeedback';
import { ConfirmationModal } from './common/ConfirmationModal';

// ---------------------------------------------------------------------------
// 5. SUPPLIERS, LICENSED RETAILERS & LOGISTICS ONBOARDING MODULE
// ---------------------------------------------------------------------------
export const PartnersOnboardingModule: React.FC<{
  currentUser: StaffMember;
  partners: Partner[];
  regions: GeoRegion[];
  onCreatePartner: (p: Omit<Partner, 'id' | 'createdAt'>) => Promise<void>;
  onUpdatePartner?: (partnerId: string, updates: Partial<Partner>) => Promise<void>;
  onDeletePartner?: (partnerId: string) => Promise<void>;
}> = ({ currentUser, partners, regions, onCreatePartner, onUpdatePartner, onDeletePartner }) => {
  const isAccountant = currentUser.role === 'Accountant';
  const isBranchManager = currentUser.role === 'Branch Manager';
  const canManagePartners = currentUser.role === 'Admin' || currentUser.role === 'Sales Manager' || currentUser.role === 'Inventory Controller' || isBranchManager;

  const [partnerType, setPartnerType] = useState<Partner['partnerType']>('Supplier');
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [regionId, setRegionId] = useState(regions[0]?.id || '');
  const [liquorLicenseNo, setLiquorLicenseNo] = useState('');
  const [taxPin, setTaxPin] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [creditLimit, setCreditLimit] = useState<number>(0);
  const [fleetCapacity, setFleetCapacity] = useState('');
  const [filterType, setFilterType] = useState<string>('All');

  // Edit / Delete Partner Modals
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editContactPerson, setEditContactPerson] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLicenseNo, setEditLicenseNo] = useState('');
  const [editTaxPin, setEditTaxPin] = useState('');
  const [editCreditLimit, setEditCreditLimit] = useState<number>(0);
  const [editFleet, setEditFleet] = useState('');
  const [editStatus, setEditStatus] = useState<'Verified' | 'Pending Review' | 'Expired'>('Verified');

  const [deletingPartner, setDeletingPartner] = useState<Partner | null>(null);
  const [isDeletingPartner, setIsDeletingPartner] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<{ type: 'success' | 'error'; title: string; message: string; } | null>(null);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !liquorLicenseNo.trim()) return;
    const reg = regions.find((r) => r.id === regionId) || regions[0];
    const prefix = partnerType === 'Supplier' ? 'SUP' : partnerType === 'Retailer' ? 'RET' : 'LOG';
    await onCreatePartner({
      partnerType,
      code: `${prefix}-${Date.now().toString().slice(-4)}`,
      companyName: companyName.trim(),
      contactPerson: contactPerson.trim() || 'General Contact',
      phone: phone.trim(),
      email: email.trim(),
      regionId: reg?.id || '',
      regionName: reg?.name || '',
      liquorLicenseNo: liquorLicenseNo.trim(),
      taxPin: taxPin.trim(),
      licenseExpiry,
      creditLimit: Number(creditLimit) || 0,
      fleetCapacity: partnerType === 'Logistics' ? (fleetCapacity.trim() || undefined) : undefined,
      complianceStatus: 'Verified',
    });
    setCompanyName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setLiquorLicenseNo('');
    setTaxPin('');
    setCreditLimit(0);
    setFleetCapacity('');
    setFeedbackToast({
      type: 'success',
      title: 'Partner Onboarded',
      message: `Successfully onboarded the trade partner: ${companyName.trim()}.`,
    });
  };

  const handleOpenEditPartner = (p: Partner) => {
    setEditingPartner(p);
    setEditCompanyName(p.companyName);
    setEditContactPerson(p.contactPerson || '');
    setEditPhone(p.phone || '');
    setEditEmail(p.email || '');
    setEditLicenseNo(p.liquorLicenseNo);
    setEditTaxPin(p.taxPin || '');
    setEditCreditLimit(p.creditLimit || 0);
    setEditFleet(p.fleetCapacity || '');
    setEditStatus(p.complianceStatus);
  };

  const handleSaveEditPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner || !onUpdatePartner) return;
    await onUpdatePartner(editingPartner.id, {
      companyName: editCompanyName.trim(),
      contactPerson: editContactPerson.trim(),
      phone: editPhone.trim(),
      email: editEmail.trim(),
      liquorLicenseNo: editLicenseNo.trim(),
      taxPin: editTaxPin.trim(),
      creditLimit: Number(editCreditLimit) || 0,
      fleetCapacity: editingPartner.partnerType === 'Logistics' ? editFleet.trim() : undefined,
      complianceStatus: editStatus,
    });
    setEditingPartner(null);
    setFeedbackToast({
      type: 'success',
      title: 'Partner Updated',
      message: `Successfully updated the trade partner: ${editCompanyName.trim()}.`,
    });
  };

  const handleConfirmDeletePartner = async () => {
    if (!deletingPartner || !onDeletePartner) return;
    setIsDeletingPartner(true);
    try {
      await onDeletePartner(deletingPartner.id);
      setDeletingPartner(null);
    } finally {
      setIsDeletingPartner(false);
    }
  };

  const filtered = useMemo(
    () =>
      filterType === 'All'
        ? partners
        : partners.filter((p) => p.partnerType === filterType),
    [partners, filterType]
  );

  return (
    <div className="space-y-6">
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            B2B Ecosystem & Regulatory Vetting
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            Supplier, Licensed Retailer & Bonded Logistics Onboarding
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Verify excise licenses, KRA PINs, regional tariff zones, credit limits, and bonded carrier fleets prior to trading.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={() =>
              exportReportToPDF(
                'Onboarded Suppliers, Retailers & Logistics Directory',
                'Verified Liquor Licenses & Credit Limits',
                ['Code', 'Type', 'Company Name', 'Contact', 'Geo-Zone', 'Liquor / Bond License', 'Credit Limit / Fleet', 'Status'],
                filtered.map((p) => [
                  p.code,
                  p.partnerType,
                  p.companyName,
                  p.contactPerson,
                  p.regionName,
                  p.liquorLicenseNo,
                  p.partnerType === 'Logistics' ? p.fleetCapacity || 'Bonded Fleet' : formatKes(p.creditLimit),
                  p.complianceStatus,
                ]),
                'Vaairo_Partners_Directory'
              )
            }
            className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            Export PDF
          </button>
          <button
            onClick={() =>
              exportToCSV(
                'Vaairo_Partners_Directory',
                ['Code', 'Type', 'Company Name', 'Contact', 'Phone', 'Email', 'Geo-Zone', 'License No', 'Tax PIN', 'Expiry', 'Status'],
                filtered.map((p) => [
                  p.code,
                  p.partnerType,
                  p.companyName,
                  p.contactPerson,
                  p.phone,
                  p.email,
                  p.regionName,
                  p.liquorLicenseNo,
                  p.taxPin,
                  p.licenseExpiry,
                  p.complianceStatus,
                ])
              )
            }
            className="px-3.5 py-2 bg-white border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#0A006E]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Role Boundary Callout Banner */}
      {isAccountant ? (
        <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-indigo-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-indigo-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-indigo-900">
                Chief Financial Accountant Oversight · Credit Limits &amp; Receivables Monitoring
              </div>
              <p className="text-xs text-indigo-800">
                Financial access permitted to audit trade partner credit ceilings, tax compliance PINs, and accounts receivables. Onboarding and contract terms modifications are governed by Commercial Sales and Inventory Management.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-200/80 text-indigo-900 text-[11px] font-bold shrink-0">
            Financial View Only
          </span>
        </div>
      ) : isBranchManager ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-amber-900">
                Branch Manager Scope · Partners in {currentUser.branchName}
              </div>
              <p className="text-xs text-amber-800">
                Managing local commercial retailers and regional logistics carriers within your branch territory.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-amber-200/80 text-amber-900 text-[11px] font-bold shrink-0">
            Branch Scope
          </span>
        </div>
      ) : null}

      {/* Onboarding Form (Hidden for Accountant) */}
      {!isAccountant && canManagePartners && (
      <form
        onSubmit={handleAddPartner}
        className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
      >
        <h3 className="text-sm font-montserrat font-black text-[#0A006E] border-b border-slate-200 pb-3">
          Onboard New Trade Partner (Supplier, Retailer, or Logistics Provider)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          <div>
            <label className="font-montserrat font-bold text-slate-700">Partner Classification</label>
            <select
              value={partnerType}
              onChange={(e) => setPartnerType(e.target.value as Partner['partnerType'])}
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-montserrat font-black text-[#0A006E]"
            >
              <option value="Retailer">Licensed Liquor Retailer / Bar / Hotel</option>
              <option value="Supplier">Overseas Importer / Distillery Supplier</option>
              <option value="Logistics">Bonded Freight & Fleet Logistics Provider</option>
            </select>
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Company / Entity Name *</label>
            <input
              required
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Westlands Wine & Spirits Ltd"
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Liquor / Customs Bond License *</label>
            <input
              required
              type="text"
              value={liquorLicenseNo}
              onChange={(e) => setLiquorLicenseNo(e.target.value)}
              placeholder="e.g. LIQ-2026-SUB-8812"
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Operating Geo-Pricing Zone</label>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">Primary Contact Person</label>
            <input
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Full Name"
              className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="font-montserrat font-bold text-slate-700">KRA PIN & License Expiry</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <input
                type="text"
                value={taxPin}
                onChange={(e) => setTaxPin(e.target.value)}
                placeholder="P0519281K"
                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
              <input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                className="px-2 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          </div>

          {partnerType === 'Logistics' ? (
            <div className="sm:col-span-2">
              <label className="font-montserrat font-bold text-slate-700">Bonded Fleet Capacity & GPS Seal Spec</label>
              <input
                type="text"
                value={fleetCapacity}
                onChange={(e) => setFleetCapacity(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label className="font-montserrat font-bold text-slate-700">Approved Trade Credit Limit (KES)</label>
              <input
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Verify License & Onboard {partnerType}
        </button>
      </form>
      )}

      {/* Directory Table */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          {['All', 'Supplier', 'Retailer', 'Logistics'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-black cursor-pointer ${
                filterType === t
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Partner Code</th>
                <th className="py-2.5 px-3 font-black">Type</th>
                <th className="py-2.5 px-3 font-black">Company Name</th>
                <th className="py-2.5 px-3 font-black">Geo-Zone</th>
                <th className="py-2.5 px-3 font-black">Liquor / Customs License</th>
                <th className="py-2.5 px-3 font-black">Credit / Fleet</th>
                <th className="py-2.5 px-3 font-black">Compliance</th>
                <th className="py-2.5 px-3 font-black text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                    No trade partners onboarded in this category yet.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">{p.code}</td>
                    <td className="py-2.5 px-3 font-montserrat font-bold text-slate-800">{p.partnerType}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {p.companyName}
                      {p.contactPerson && <span className="text-slate-500 font-normal"> · {p.contactPerson}</span>}
                      {p.phone && <div className="text-[11px] text-slate-500 font-mono-tabular">{p.phone}</div>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{p.regionName || '-'}</td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-700">
                      {p.liquorLicenseNo} {p.licenseExpiry && <span className="text-slate-500 text-[11px]">(Exp: {p.licenseExpiry})</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular">
                      {p.partnerType === 'Logistics' ? p.fleetCapacity || '-' : formatKes(p.creditLimit)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        p.complianceStatus === 'Verified'
                          ? 'bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/40'
                          : p.complianceStatus === 'Expired'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-amber-100 text-amber-800 border border-amber-300'
                      }`}>
                        {p.complianceStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {!isAccountant ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPartner(p)}
                            className="p-1.5 bg-slate-100 hover:bg-[#0A006E] hover:text-[#FFDE00] text-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Edit Partner"
                            aria-label="Edit Partner"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPartner(p)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg transition-colors cursor-pointer"
                            title="Delete Partner"
                            aria-label="Delete Partner"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Audited</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Partner Modal */}
      {editingPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-lg w-full h-full sm:h-auto overflow-y-auto p-5 sm:p-6 space-y-4 flex flex-col justify-between sm:justify-start">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-montserrat font-black text-[#0A006E]">
                Edit {editingPartner.partnerType}: {editingPartner.code}
              </h3>
              <button
                type="button"
                onClick={() => setEditingPartner(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditPartner} className="space-y-3.5 text-xs">
              <div>
                <label className="font-montserrat font-bold text-slate-700">Company Name *</label>
                <input
                  required
                  type="text"
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Contact Person</label>
                  <input
                    type="text"
                    value={editContactPerson}
                    onChange={(e) => setEditContactPerson(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-montserrat font-bold text-slate-700">License No</label>
                  <input
                    type="text"
                    value={editLicenseNo}
                    onChange={(e) => setEditLicenseNo(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-mono-tabular"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Compliance Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Partner['complianceStatus'])}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-montserrat font-bold"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="font-montserrat font-bold text-slate-700">
                    {editingPartner.partnerType === 'Logistics' ? 'Fleet Capacity' : 'Credit Limit (KES)'}
                  </label>
                  {editingPartner.partnerType === 'Logistics' ? (
                    <input
                      type="text"
                      value={editFleet}
                      onChange={(e) => setEditFleet(e.target.value)}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                    />
                  ) : (
                    <input
                      type="number"
                      value={editCreditLimit}
                      onChange={(e) => setEditCreditLimit(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-mono-tabular"
                    />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingPartner(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black cursor-pointer shadow-md"
                >
                  Save Partner Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Partner Confirmation Modal */}
      {deletingPartner && (
        <ConfirmationModal
          isOpen={true}
          title="Delete Trade Partner Permanently?"
          message={`Are you sure you want to delete ${deletingPartner.companyName} (${deletingPartner.code})? This action is permanent and cannot be undone.`}
          onConfirm={handleConfirmDeletePartner}
          onCancel={() => setDeletingPartner(null)}
          isConfirming={isDeletingPartner}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 6. COMMERCIAL DOCUMENTS & CREDIT NOTES MODULE
// ---------------------------------------------------------------------------
export const DocumentsAndCreditNotesModule: React.FC<{
  currentUser: StaffMember;
  transactions: TransactionDoc[];
  branches: Branch[];
  regions: GeoRegion[];
  products: Product[];
  onIssueCreditNote: (cn: Omit<TransactionDoc, 'id' | 'createdAt'>) => Promise<TransactionDoc | null>;
  onPreviewDoc: (doc: TransactionDoc) => void;
}> = ({
  currentUser,
  transactions,
  branches,
  regions,
  products,
  onIssueCreditNote,
  onPreviewDoc,
}) => {
  const [filterDocType, setFilterDocType] = useState<string>('All');
  const [refInvoiceNo, setRefInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [creditReason, setCreditReason] = useState('Breakage in Bonded Transit / Short-Landed Case');
  const [selectedProdId, setSelectedProdId] = useState(products[0]?.id || '');
  const [creditBottles, setCreditBottles] = useState<number>(1);
  const [creditUnitPrice, setCreditUnitPrice] = useState<number>(
    products[0]?.wholesalePriceKes || products[0]?.baseWholesalePrice || 0
  );

  const canIssueCreditNote =
    (currentUser.role === 'Admin' ||
      currentUser.role === 'Accountant' ||
      currentUser.role === 'Branch Manager') &&
    isUserFeaturePermitted(currentUser, 'issue_credit_notes');

  // Role-scoped documents based on Target Access Model
  const visibleDocs = useMemo(() => {
    let docs = transactions;
    const role = currentUser.role;

    if (role === 'Accountant') {
      // Financial documents: invoices, credit notes, receipts
      docs = docs.filter(
        (t) =>
          t.docType === 'Invoice' ||
          t.docType === 'Credit Note' ||
          t.docType === 'Receipt'
      );
    } else if (role === 'Sales Manager') {
      // Commercial sales documents
      docs = docs.filter(
        (t) =>
          t.channel.includes('Wholesale') ||
          t.channel.includes('Sales') ||
          t.docType === 'Invoice' ||
          t.docType === 'Quote'
      );
    } else if (role === 'Branch Manager') {
      // Branch scoped documents
      docs = docs.filter(
        (t) =>
          t.branchName === currentUser.branchName ||
          t.branchId === currentUser.branchId
      );
    } else if (role === 'Inventory Controller') {
      // Delivery documents: Delivery Notes, Packing Lists, Credit returns
      docs = docs.filter(
        (t) =>
          t.docType === 'Delivery Note' ||
          t.docType === 'Packing List' ||
          t.docType === 'Credit Note'
      );
    } else if (role === 'Counter Cashier') {
      // Own POS docs
      docs = docs.filter(
        (t) =>
          t.createdBy === currentUser.name ||
          (t.channel === 'Retail Counter POS' && t.branchName === currentUser.branchName)
      );
    } else if (role === 'Affiliate Sales Representative') {
      // Own sales docs
      docs = docs.filter(
        (t) =>
          t.createdBy === currentUser.name ||
          t.docNumber.includes('AFF')
      );
    }
    // Admin has Full access to all docs

    return filterDocType === 'All'
      ? docs
      : docs.filter((t) => t.docType === filterDocType);
  }, [transactions, filterDocType, currentUser]);

  const handleCreateCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === selectedProdId) || products[0];
    const br = branches[0];
    const reg = regions[0];
    if (!prod || !br || !reg) return;

    const packSize = prod.packSize || prod.bottlesPerCase || 12;
    const subtotal = Math.round(creditBottles * creditUnitPrice);
    const tax = Math.round(subtotal * 0.16);
    const totalAmount = subtotal + tax;

    const created = await onIssueCreditNote({
      docNumber: `CRN-${Date.now().toString().slice(-6)}`,
      docType: 'Credit Note',
      channel: 'B2B Wholesale POS',
      branchId: br.id,
      branchName: br.name,
      regionId: reg.id,
      regionName: reg.name,
      customerName: customerName.trim() || 'Direct Trade Account',
      customerLicenseNo: '',
      itemsSummary: JSON.stringify([
        {
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          unitMode: 'Bottle',
          bottlesPerCase: packSize,
          quantityUnits: creditBottles,
          totalBottles: creditBottles,
          unitPrice: creditUnitPrice,
          lineTotal: subtotal,
        },
      ]),
      subtotal,
      exciseAndTax: tax,
      totalAmount,
      paymentMethod: 'Ledger Credit Offset',
      status: 'Credited',
      relatedInvoiceNo: refInvoiceNo.trim() || '',
      creditReason,
      createdBy: currentUser.name,
      createdByRole: currentUser.role,
    });

    if (created) {
      onPreviewDoc(created);
    }
    setRefInvoiceNo('');
    setCustomerName('');
  };

  const handlePrintDerivedDoc = (
    baseTx: TransactionDoc,
    targetType: 'Packing List' | 'Delivery Note' | 'Quote' | 'Invoice' | 'Receipt'
  ) => {
    const derived: TransactionDoc = {
      ...baseTx,
      docType: targetType,
      docNumber: `${targetType.slice(0, 3).toUpperCase()}-${baseTx.docNumber.split('-')[1] || '101'}`,
    };
    onPreviewDoc(derived);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            Commercial Document Center & Returns Ledger
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            Print Receipts, Invoices, Quotes, Packing Lists, Delivery Notes & Credit Notes
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Download any statement or commercial document in PDF or CSV format, or issue formal Credit Notes against B2B invoices.
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <button
            onClick={() =>
              exportReportToPDF(
                'Commercial Ledger: Invoices, Receipts, Quotes & Credit Notes',
                `Exported by ${currentUser.name}`,
                ['Doc No', 'Type', 'Branch', 'Geo-Zone', 'Customer', 'Subtotal (KES)', 'Tax (KES)', 'Total (KES)', 'Status'],
                visibleDocs.map((d) => [
                  d.docNumber,
                  d.docType,
                  d.branchName,
                  d.regionName,
                  d.customerName,
                  Math.round(d.subtotal).toLocaleString(),
                  Math.round(d.exciseAndTax).toLocaleString(),
                  Math.round(d.totalAmount).toLocaleString(),
                  d.status,
                ]),
                'Vaairo_Commercial_Documents_Statement'
              )
            }
            className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
            Statement PDF
          </button>
          <button
            onClick={() =>
              exportToCSV(
                'Vaairo_Commercial_Documents_Statement',
                ['Doc No', 'Type', 'Channel', 'Branch', 'Geo-Zone', 'Customer', 'Subtotal (KES)', 'Excise/Tax (KES)', 'Total (KES)', 'Status', 'Issued By', 'Created At'],
                visibleDocs.map((d) => [
                  d.docNumber,
                  d.docType,
                  d.channel,
                  d.branchName,
                  d.regionName,
                  d.customerName,
                  d.subtotal,
                  d.exciseAndTax,
                  d.totalAmount,
                  d.status,
                  d.createdBy,
                  d.createdAt,
                ])
              )
            }
            className="px-3.5 py-2 bg-white border-2 border-[#0A006E] text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#0A006E]" />
            Statement CSV
          </button>
        </div>
      </div>

      {/* Issue Credit Note Form / RBAC Boundary Banner */}
      {canIssueCreditNote ? (
        <form
          onSubmit={handleCreateCreditNote}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 flex-wrap gap-2">
            <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
              Issue Official Credit Note (Breakage, Excise Return, or Regional Tariff Rebate)
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-black bg-[#0A006E] text-[#FFDE00]">
              Authorized: {currentUser.role} Scope
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Ref Invoice Number *</label>
              <input
                required
                type="text"
                value={refInvoiceNo}
                onChange={(e) => setRefInvoiceNo(e.target.value)}
                placeholder="e.g. INV-849201"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Customer / Retailer *</label>
              <input
                required
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Kilimani Sapphire Lounge"
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Liquor Auto-SKU</label>
              <select
                value={selectedProdId}
                onChange={(e) => setSelectedProdId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
              >
                {products.slice(0, 120).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Bottles & Unit Credit (KES)</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="number"
                  min={1}
                  value={creditBottles}
                  onChange={(e) => setCreditBottles(Number(e.target.value))}
                  className="px-2 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
                <input
                  type="number"
                  value={creditUnitPrice}
                  onChange={(e) => setCreditUnitPrice(Number(e.target.value))}
                  className="px-2 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
              </div>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Credit Reason</label>
              <input
                type="text"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Issue & Print Official Credit Note
          </button>
        </form>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-amber-900">
                Credit Note Issuance Restricted · {currentUser.role} Scope
              </div>
              <p className="text-xs text-amber-800">
                In accordance with ERP security boundaries, issuing credit notes and financial offsets requires approved Accounting, Branch Manager, or Administrator authorization. You have read/print access to documents in your authorized scope below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document Filter & Table */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {['All', 'Receipt', 'Invoice', 'Quote', 'Packing List', 'Delivery Note', 'Credit Note', 'Online Order'].map(
            (dt) => (
              <button
                key={dt}
                onClick={() => setFilterDocType(dt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-black cursor-pointer ${
                  filterDocType === dt
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {dt}
              </button>
            )
          )}
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Doc No</th>
                <th className="py-2.5 px-3 font-black">Type</th>
                <th className="py-2.5 px-3 font-black">Customer & Geo-Zone</th>
                <th className="py-2.5 px-3 font-black text-right">Total (KES)</th>
                <th className="py-2.5 px-3 font-black">Issued By</th>
                <th className="py-2.5 px-3 font-black text-right">
                  Print / Convert Document (PDF)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No documents found for filter "{filterDocType}".
                  </td>
                </tr>
              ) : (
                visibleDocs.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                      {tx.docNumber}
                    </td>
                    <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">
                      {tx.docType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {tx.customerName} · <span className="text-slate-500">{tx.regionName}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                      {formatKes(tx.totalAmount)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {tx.createdBy} ({tx.createdByRole})
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => onPreviewDoc(tx)}
                          className="px-2.5 py-1 bg-[#0A006E] text-[#FFDE00] rounded-lg text-[11px] font-montserrat font-black cursor-pointer"
                        >
                          Print {tx.docType}
                        </button>
                        <button
                          onClick={() => handlePrintDerivedDoc(tx, 'Packing List')}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Packing List
                        </button>
                        <button
                          onClick={() => handlePrintDerivedDoc(tx, 'Delivery Note')}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                        >
                          Delivery Note
                        </button>
                        <button
                          onClick={() => exportCommercialDocumentPDF(tx)}
                          className="px-2 py-1 bg-[#FFDE00] text-[#0A006E] rounded-lg text-[11px] font-montserrat font-black cursor-pointer"
                        >
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 7. REGULATORY COMPLIANCE & EXCISE STAMP TRACKING MODULE
// ---------------------------------------------------------------------------
export const ComplianceModule: React.FC<{
  currentUser: StaffMember;
  records: ComplianceRecord[];
  branches: Branch[];
  products: Product[];
  onCreateCompliance: (rec: Omit<ComplianceRecord, 'id' | 'createdAt'>) => Promise<void>;
}> = ({ currentUser, records, branches, products, onCreateCompliance }) => {
  const isBranchManager = currentUser.role === 'Branch Manager';
  const isAccountant = currentUser.role === 'Accountant';
  const isSalesManager = currentUser.role === 'Sales Manager';
  const canManageCompliance = currentUser.role === 'Admin' || currentUser.role === 'Inventory Controller';

  const visibleRecords = useMemo(() => {
    if (isBranchManager) {
      return records.filter((r) => r.branchName === currentUser.branchName);
    }
    return records;
  }, [records, isBranchManager, currentUser.branchName]);

  const [certificateNo, setCertificateNo] = useState(`EX-CERT-${Date.now().toString().slice(-5)}`);
  const [recordType, setRecordType] = useState<ComplianceRecord['recordType']>(
    'Digital Excise Stamp Batch'
  );
  const [skuRef, setSkuRef] = useState(products[0]?.sku || '');
  const [branchName, setBranchName] = useState(
    isBranchManager ? currentUser.branchName : branches[0]?.name || ''
  );
  const [stampStart, setStampStart] = useState('');
  const [stampEnd, setStampEnd] = useState('');
  const [dutyPaid, setDutyPaid] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  });
  const [inspectorName, setInspectorName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCompliance) return;
    await onCreateCompliance({
      certificateNo,
      recordType,
      skuRef,
      branchName: isBranchManager ? currentUser.branchName : branchName,
      stampRangeStart: stampStart,
      stampRangeEnd: stampEnd,
      dutyPaidAmount: Number(dutyPaid),
      expiryDate,
      status: 'Active',
      inspectorName,
    });
    setCertificateNo(`EX-CERT-${Date.now().toString().slice(-5)}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            Customs Bond, Digital Excise Stamps & Bureau Clearance
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            Regulatory Compliance & Excise Stamp Roll Tracking
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Target Access Model: {currentUser.role} Scope · {visibleRecords.length} Active Records
          </p>
        </div>
        <button
          onClick={() =>
            exportReportToPDF(
              'Regulatory Compliance & Excise Stamp Audit Statement',
              `Customs Bonds & Excise Stamp Serial Ranges (${currentUser.role} Scope)`,
              ['Certificate No', 'Type', 'SKU Ref', 'Branch', 'Stamp Range', 'Duty Paid (KES)', 'Expiry', 'Status'],
              visibleRecords.map((r) => [
                r.certificateNo,
                r.recordType,
                r.skuRef,
                r.branchName,
                `${r.stampRangeStart} -> ${r.stampRangeEnd}`,
                Math.round(r.dutyPaidAmount).toLocaleString(),
                r.expiryDate,
                r.status,
              ]),
              'Vaairo_Regulatory_Compliance'
            )
          }
          className="px-3.5 py-2 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer relative z-10"
        >
          <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
          Download Compliance PDF
        </button>
      </div>

      {/* Role Notice Banner */}
      {isAccountant && (
        <div className="bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-indigo-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-indigo-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-indigo-900">
                Tax & Excise Compliance Oversight · Accounting Financial View
              </div>
              <p className="text-xs text-indigo-800">
                Full tax reports, duty payments, and KRA eTIMS fiscalization data are available for financial reporting and auditing. Digital excise physical roll registration is managed by Inventory Controllers and System Administrators.
              </p>
            </div>
          </div>
        </div>
      )}

      {(isSalesManager || isBranchManager) && !canManageCompliance && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-3 text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <div className="text-xs font-montserrat font-black uppercase text-amber-900">
                {isBranchManager ? `Branch Compliance View · ${currentUser.branchName}` : 'Sales Management Compliance View'}
              </div>
              <p className="text-xs text-amber-800">
                {isBranchManager
                  ? `Viewing bonded customs clearances and digital excise stamp batches allocated to ${currentUser.branchName}.`
                  : 'Viewing regulatory customs clearances and excise verification registers across distribution channels.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Register New Batch Form (Inventory Controller & Admin Only) */}
      {canManageCompliance && (
        <form
          onSubmit={handleAdd}
          className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <h3 className="text-sm font-montserrat font-black text-[#0A006E] border-b border-slate-200 pb-3">
            Log New Customs Bond Entry or Digital Excise Stamp Batch
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="font-montserrat font-bold text-slate-700">Certificate / Entry No *</label>
              <input
                required
                type="text"
                value={certificateNo}
                onChange={(e) => setCertificateNo(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Compliance Instrument</label>
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value as ComplianceRecord['recordType'])}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
              >
                <option value="Digital Excise Stamp Batch">Digital Excise Stamp Batch</option>
                <option value="Customs Import Bond">Customs Import Bond</option>
                <option value="Standard Bureau Certificate">Standard Bureau Certificate</option>
                <option value="Distributor Liquor Permit">Distributor Liquor Permit</option>
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Target Auto-SKU</label>
              <select
                value={skuRef}
                onChange={(e) => setSkuRef(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              >
                {products.slice(0, 120).map((p) => (
                  <option key={p.id} value={p.sku}>
                    {p.sku}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Assigned Bonded Branch</label>
              <select
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Stamp Start & End Serial</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <input
                  type="text"
                  value={stampStart}
                  onChange={(e) => setStampStart(e.target.value)}
                  className="px-2 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
                <input
                  type="text"
                  value={stampEnd}
                  onChange={(e) => setStampEnd(e.target.value)}
                  className="px-2 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
                />
              </div>
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Excise Duty Paid (KES)</label>
              <input
                type="number"
                value={dutyPaid}
                onChange={(e) => setDutyPaid(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Permit Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular"
              />
            </div>
            <div>
              <label className="font-montserrat font-bold text-slate-700">Verifying Inspector</label>
              <input
                type="text"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-xs rounded-xl cursor-pointer"
          >
            Register Compliance Batch
          </button>
        </form>
      )}

      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5">
        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Certificate No</th>
                <th className="py-2.5 px-3 font-black">Instrument</th>
                <th className="py-2.5 px-3 font-black">Auto SKU</th>
                <th className="py-2.5 px-3 font-black">Stamp Serial Range</th>
                <th className="py-2.5 px-3 font-black text-right">Duty Paid (KES)</th>
                <th className="py-2.5 px-3 font-black">Expiry</th>
                <th className="py-2.5 px-3 font-black">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRecords.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono-tabular font-bold text-[#0A006E]">
                    {r.certificateNo}
                  </td>
                  <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">
                    {r.recordType}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular">{r.skuRef}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-slate-600">
                    {r.stampRangeStart} → {r.stampRangeEnd}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono-tabular font-bold">
                    {formatKes(r.dutyPaidAmount)}
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular">{r.expiryDate}</td>
                  <td className="py-2.5 px-3 text-[#1E9E60] font-bold">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 8. HR & HIERARCHICAL ROLE-BASED ACCESS PROVISIONING MODULE
// ---------------------------------------------------------------------------
export const HrAndRbacModule: React.FC<{
  currentUser: StaffMember;
  staffList: StaffMember[];
  branches: Branch[];
  payrollRuns?: PayrollRun[];
  onCreateStaff: (newStaff: Omit<StaffMember, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateStaff?: (staffId: string, updates: Partial<StaffMember>) => Promise<void>;
  onSetStaffStatus?: (staffId: string, status: 'Active' | 'Suspended' | 'Terminated') => Promise<void>;
  onDeleteStaff?: (staffId: string) => Promise<void>;
  onExecutePayrollRun?: (runDraft: Omit<PayrollRun, 'id' | 'createdAt'>) => Promise<void>;
  onOpenPayslip?: (record: PayrollRecord) => void;
  onOpenAccessMatrix?: () => void;
  onOpenUserFeatureModal?: (staff: StaffMember) => void;
  onTriggerToast: (type: 'success' | 'error', title: string, message: string) => void;
}> = ({
  currentUser,
  staffList,
  branches,
  payrollRuns = [],
  onCreateStaff,
  onUpdateStaff,
  onSetStaffStatus,
  onDeleteStaff,
  onExecutePayrollRun,
  onOpenPayslip,
  onOpenAccessMatrix,
  onOpenUserFeatureModal,
  onTriggerToast,
}) => {
  const creatableRoles = ROLE_PERMISSIONS[currentUser.role].canCreateRoles;
  const canManagePayroll =
    (currentUser.role === 'HR' || currentUser.role === 'Admin') &&
    isUserFeaturePermitted(currentUser, 'manage_staff_salaries');

  const [activeTab, setActiveTab] = useState<'roster' | 'payroll' | 'master_security'>('roster');
  const [newMasterPasscode, setNewMasterPasscode] = useState('');
  const [confirmMasterPasscode, setConfirmMasterPasscode] = useState('');
  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);

  const handleUpdateMasterPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentUser.role !== 'Admin') {
      onTriggerToast('error', 'Unauthorized', 'Only Administrators can change the master security passcode.');
      return;
    }
    if (!newMasterPasscode || newMasterPasscode.length < 6) {
      onTriggerToast('error', 'Invalid Passcode', 'Master passcode must be at least 6 characters long.');
      return;
    }
    if (newMasterPasscode !== confirmMasterPasscode) {
      onTriggerToast('error', 'Mismatch', 'New master passcode and confirmation do not match.');
      return;
    }
    setIsUpdatingMaster(true);
    try {
      const hashed = await hashPassword(newMasterPasscode);
      localStorage.setItem('erp_master_passcode_hash', hashed);
      setNewMasterPasscode('');
      setConfirmMasterPasscode('');
      setFeedback('Master security passcode successfully updated and secured.');
      onTriggerToast('success', 'Master Passcode Updated', 'Administrator master security passcode has been securely updated.');
    } catch (err: any) {
      onTriggerToast('error', 'Update Failed', err?.message || 'Could not update master passcode.');
    } finally {
      setIsUpdatingMaster(false);
    }
  };

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<StaffRole>(
    creatableRoles[0] || 'HR'
  );
  const [pin, setPin] = useState(() =>
    String(Math.floor(100000 + Math.random() * 900000))
  );
  const [branchId, setBranchId] = useState(
    currentUser.role === 'Branch Manager' ? currentUser.branchId : branches[0]?.id || ''
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  // Default salary & deductions fields for new staff
  const [baseSalary, setBaseSalary] = useState<number>(65000);
  const [deductions, setDeductions] = useState<number>(12500);
  const [penalties, setPenalties] = useState<number>(0);
  const [deductionsBreakdown, setDeductionsBreakdown] = useState<string>('PAYE: KES 8,500, SHIF: KES 1,800, NSSF: KES 1,080, Housing Levy: KES 1,120');
  const [penaltiesReason, setPenaltiesReason] = useState<string>('');
  const [kraPin, setKraPin] = useState<string>('A009182741Z');
  const [nssfNo, setNssfNo] = useState<string>('092837192');
  const [nhifNo, setNhifNo] = useState<string>('88392019');
  const [agreedCommissionPct, setAgreedCommissionPct] = useState<number>(8.0);
  const [isCasual, setIsCasual] = useState<boolean>(true);

  // Edit Staff Modal State
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('HR');
  const [editBranchId, setEditBranchId] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Suspended' | 'Terminated'>('Active');
  const [editPin, setEditPin] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState<number>(65000);
  const [editDeductions, setEditDeductions] = useState<number>(12500);
  const [editPenalties, setEditPenalties] = useState<number>(0);
  const [editDeductionsBreakdown, setEditDeductionsBreakdown] = useState<string>('');
  const [editPenaltiesReason, setEditPenaltiesReason] = useState<string>('');
  const [editKraPin, setEditKraPin] = useState<string>('');
  const [editNssfNo, setEditNssfNo] = useState<string>('');
  const [editNhifNo, setEditNhifNo] = useState<string>('');
  const [editIsCasual, setEditIsCasual] = useState<boolean>(false);
  const [editAgreedCommissionPct, setEditAgreedCommissionPct] = useState<number>(8.0);

  // Quick Compensation & Penalties Adjustment Modal State
  const [compStaff, setCompStaff] = useState<StaffMember | null>(null);
  const [compBase, setCompBase] = useState<number>(65000);
  const [compDed, setCompDed] = useState<number>(12500);
  const [compPen, setCompPen] = useState<number>(0);
  const [compBreakdown, setCompBreakdown] = useState<string>('');
  const [compReason, setCompReason] = useState<string>('');
  const [compKra, setCompKra] = useState<string>('');
  const [compNssf, setCompNssf] = useState<string>('');
  const [compNhif, setCompNhif] = useState<string>('');
  const [compCommissionPct, setCompCommissionPct] = useState<number>(8.0);
  const [compIsCasual, setCompIsCasual] = useState<boolean>(false);
  const [isSavingComp, setIsSavingComp] = useState<boolean>(false);

  // Payroll Run execution state
  const [payrollPeriod, setPayrollPeriod] = useState<string>('October 2026');
  const [isRunningPayroll, setIsRunningPayroll] = useState<boolean>(false);

  // Delete Staff Modal State (Requirement 3: Prompt question if they are sure they want to delete because it is permanent)
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null);
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);

  const isGoogleRole = selectedRole === 'Admin' || selectedRole === 'Accountant';

  const autoCalculateKenyanStatutory = (salary: number) => {
    const nssf = Math.min(Math.round(salary * 0.06), 2160);
    const shif = Math.round(salary * 0.0275);
    const housing = Math.round(salary * 0.015);
    const taxable = Math.max(0, salary - nssf);
    let paye = 0;
    if (taxable > 24000) {
      paye = Math.round((taxable - 24000) * 0.25 - 2400);
      if (paye < 0) paye = 0;
    }
    const totalDeds = nssf + shif + housing + paye;
    const breakdown = `PAYE: KES ${paye.toLocaleString()}, SHIF: KES ${shif.toLocaleString()}, NSSF: KES ${nssf.toLocaleString()}, Housing Levy: KES ${housing.toLocaleString()}`;
    return { totalDeds, breakdown };
  };

  const handleRandomizePin = () => {
    setPin(String(Math.floor(100000 + Math.random() * 900000)));
  };

  const handleRandomizeEditPin = () => {
    setEditPin(String(Math.floor(100000 + Math.random() * 900000)));
  };

  const canManageStaff = (staff: StaffMember): boolean => {
    // Current user cannot delete or suspend self
    if (staff.id === currentUser.id) return false;
    if (currentUser.role === 'Admin') return true;
    if (currentUser.role === 'HR') {
      return staff.role !== 'Admin';
    }
    if (currentUser.role === 'Branch Manager') {
      return (
        staff.branchId === currentUser.branchId &&
        (staff.role === 'Counter Cashier' || staff.role === 'Affiliate Sales Representative')
      );
    }
    return false;
  };

  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatableRoles.length === 0) return;

    const effectiveRole = creatableRoles.includes(selectedRole)
      ? selectedRole
      : creatableRoles[0];

    if (effectiveRole === 'Admin' && email.trim().toLowerCase() !== 'feminiholdings@gmail.com') {
      onTriggerToast('error', 'Provisioning Failed', 'Restriction: Only feminiholdings@gmail.com is authorized as System Administrator.');
      return;
    }

    const effectiveAuthMethod =
      effectiveRole === 'Admin' || effectiveRole === 'Accountant' ? 'google' : 'pin';

    const assignedBranch =
      currentUser.role === 'Branch Manager'
        ? branches.find((b) => b.id === currentUser.branchId) || branches[0]
        : branches.find((b) => b.id === branchId) || branches[0];

    const isCasualSalesRep = effectiveRole === 'Affiliate Sales Representative';

    try {
      await onCreateStaff(
        cleanFirestoreData({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: effectiveRole,
          authMethod: effectiveAuthMethod,
          pin: effectiveAuthMethod === 'pin' ? pin : undefined,
          branchId: assignedBranch?.id || '',
          branchName: assignedBranch?.name || 'Main Branch',
          status: 'Active',
          createdBy: currentUser.name,
          createdByRole: currentUser.role,
          baseSalaryKes: Number(baseSalary),
          deductionsKes: Number(deductions),
          penaltiesKes: Number(penalties),
          deductionsBreakdown: deductionsBreakdown.trim(),
          penaltiesReason: penaltiesReason.trim(),
          kraPin: kraPin.trim(),
          nssfNo: nssfNo.trim(),
          nhifNo: nhifNo.trim(),
          isCasual: isCasualSalesRep || isCasual,
          agreedCommissionPct: isCasualSalesRep ? Number(agreedCommissionPct) : undefined,
        })
      );
    } catch(e) {
      onTriggerToast('error', 'Provisioning Failed', 'An unexpected error occurred while creating staff member.');
      return;
    }

    onTriggerToast('success', 'Staff Provisioned', isCasualSalesRep
        ? `Provisioned Casual Sales Rep "${name}" with 6-Digit PIN: ${pin}, Base Pay KES ${Number(baseSalary).toLocaleString()} & Agreed Commission: ${agreedCommissionPct}%.`
        : effectiveAuthMethod === 'pin'
        ? `Provisioned ${effectiveRole} "${name}" with 6-Digit PIN: ${pin} & Monthly Salary KES ${Number(baseSalary).toLocaleString()}.`
        : `Provisioned ${effectiveRole} "${name}" (${email}) for Google Authentication & Monthly Salary KES ${Number(baseSalary).toLocaleString()}.`);
    setName('');
    setEmail('');
    handleRandomizePin();
  };

  const handleOpenEdit = (staff: StaffMember) => {
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditEmail(staff.email);
    setEditRole(staff.role);
    setEditBranchId(staff.branchId);
    setEditStatus(staff.status);
    setEditPin(staff.pin && staff.pin.length === 6 ? staff.pin : '');
    setEditBaseSalary(staff.baseSalaryKes ?? (staff.role === 'Admin' ? 180000 : staff.role === 'Accountant' ? 120000 : staff.role === 'Branch Manager' ? 95000 : 65000));
    setEditDeductions(staff.deductionsKes ?? 12500);
    setEditPenalties(staff.penaltiesKes ?? 0);
    setEditDeductionsBreakdown(staff.deductionsBreakdown || 'PAYE: KES 8,500, SHIF: KES 1,800, NSSF: KES 1,080, Housing Levy: KES 1,120');
    setEditPenaltiesReason(staff.penaltiesReason || '');
    setEditKraPin(staff.kraPin || 'A009182741Z');
    setEditNssfNo(staff.nssfNo || '092837192');
    setEditNhifNo(staff.nhifNo || '88392019');
    setEditIsCasual(Boolean(staff.isCasual || staff.role === 'Affiliate Sales Representative'));
    setEditAgreedCommissionPct(staff.agreedCommissionPct ?? 8.0);
  };

  const handleOpenCompensation = (staff: StaffMember) => {
    setCompStaff(staff);
    const defSalary = staff.baseSalaryKes ?? (staff.role === 'Admin' ? 180000 : staff.role === 'Accountant' ? 120000 : staff.role === 'Branch Manager' ? 95000 : 65000);
    setCompBase(defSalary);
    setCompDed(staff.deductionsKes ?? 12500);
    setCompPen(staff.penaltiesKes ?? 0);
    setCompBreakdown(staff.deductionsBreakdown || 'PAYE: KES 8,500, SHIF: KES 1,800, NSSF: KES 1,080, Housing Levy: KES 1,120');
    setCompReason(staff.penaltiesReason || '');
    setCompKra(staff.kraPin || 'A009182741Z');
    setCompNssf(staff.nssfNo || '092837192');
    setCompNhif(staff.nhifNo || '88392019');
    setCompCommissionPct(staff.agreedCommissionPct ?? 8.0);
    setCompIsCasual(Boolean(staff.isCasual || staff.role === 'Affiliate Sales Representative'));
  };

  const handleSaveCompensation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compStaff || !onUpdateStaff) return;
    setIsSavingComp(true);
    try {
      await onUpdateStaff(compStaff.id, {
        baseSalaryKes: Number(compBase),
        deductionsKes: Number(compDed),
        penaltiesKes: Number(compPen),
        deductionsBreakdown: compBreakdown.trim(),
        penaltiesReason: compReason.trim(),
        kraPin: compKra.trim(),
        nssfNo: compNssf.trim(),
        nhifNo: compNhif.trim(),
        isCasual: compIsCasual,
        agreedCommissionPct: compIsCasual ? Number(compCommissionPct) : undefined,
      });
      onTriggerToast('success', 'Compensation Updated', `Compensation details updated for ${compStaff.name}. Net take-home: KES ${(compBase - compDed - compPen).toLocaleString()}`);
      setCompStaff(null);
    } catch(e) {
      onTriggerToast('error', 'Compensation Update Failed', 'Unable to update compensation.');
    } finally {
      setIsSavingComp(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff || !onUpdateStaff) return;

    if (editRole === 'Admin' && editEmail.trim().toLowerCase() !== 'feminiholdings@gmail.com') {
      onTriggerToast('error', 'Update Failed', 'Restriction: Only feminiholdings@gmail.com is authorized as System Administrator.');
      return;
    }

    const branch = branches.find((b) => b.id === editBranchId) || branches[0];
    const effectiveAuth = editRole === 'Admin' || editRole === 'Accountant' ? 'google' : 'pin';

    await onUpdateStaff(
      editingStaff.id,
      cleanFirestoreData({
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        role: editRole,
        authMethod: effectiveAuth,
        branchId: branch?.id || editingStaff.branchId,
        branchName: branch?.name || editingStaff.branchName,
        status: editStatus,
        pin: effectiveAuth === 'pin' ? (editPin.length === 6 ? editPin : editingStaff.pin) : undefined,
        baseSalaryKes: Number(editBaseSalary),
        deductionsKes: Number(editDeductions),
        penaltiesKes: Number(editPenalties),
        deductionsBreakdown: editDeductionsBreakdown.trim(),
        penaltiesReason: editPenaltiesReason.trim(),
        kraPin: editKraPin.trim(),
        nssfNo: editNssfNo.trim(),
        nhifNo: editNhifNo.trim(),
        isCasual: editIsCasual || editRole === 'Affiliate Sales Representative',
        agreedCommissionPct: (editIsCasual || editRole === 'Affiliate Sales Representative') ? Number(editAgreedCommissionPct) : undefined,
      })
    );

    onTriggerToast('success', 'Staff Updated', `Updated staff account for ${editName.trim()} successfully.`);
    setEditingStaff(null);
  };

  const handleExecutePayroll = async () => {
    if (!onExecutePayrollRun) return;
    const activeStaff = staffList.filter((s) => s.status === 'Active');
    if (activeStaff.length === 0) {
      setFeedback('Error: No active staff members found to run payroll.');
      return;
    }
    setIsRunningPayroll(true);
    try {
      const records: PayrollRecord[] = activeStaff.map((s) => {
        const bSalary = s.baseSalaryKes ?? (s.role === 'Admin' ? 180000 : s.role === 'Accountant' ? 120000 : s.role === 'Branch Manager' ? 95000 : 65000);
        const ded = s.deductionsKes ?? Math.round(bSalary * 0.18);
        const pen = s.penaltiesKes ?? 0;
        const net = Math.max(0, bSalary - ded - pen);
        return {
          staffId: s.id,
          staffName: s.name,
          staffEmail: s.email,
          staffRole: s.role,
          branchName: s.branchName,
          period: payrollPeriod,
          baseSalary: bSalary,
          deductions: ded,
          penalties: pen,
          netSalary: net,
          deductionsBreakdown: s.deductionsBreakdown || 'PAYE / SHIF / NSSF / Affordable Housing Levy',
          penaltiesReason: s.penaltiesReason || '',
          kraPin: s.kraPin || 'A009182741Z',
          nssfNo: s.nssfNo || '092837192',
          nhifNo: s.nhifNo || '88392019',
          runDate: new Date().toISOString(),
          payrollRunId: `PR-${payrollPeriod.replace(/\s+/g, '-').toUpperCase()}`,
        };
      });

      const totalNet = records.reduce((acc, r) => acc + r.netSalary, 0);

      await onExecutePayrollRun({
        period: payrollPeriod,
        runDate: new Date().toISOString(),
        runBy: currentUser.name,
        runByRole: currentUser.role,
        totalDisbursed: totalNet,
        totalEmployees: records.length,
        status: 'Paid',
        recordsJson: JSON.stringify(records),
      });

      setFeedback(`Payroll for ${payrollPeriod} successfully executed! ${records.length} employees can now download their thermal payslips from their own dashboard.`);
    } finally {
      setIsRunningPayroll(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStaff || !onDeleteStaff) return;
    setIsDeletingStaff(true);
    try {
      await onDeleteStaff(deletingStaff.id);
      setFeedback(`Permanently deleted staff member ${deletingStaff.name}.`);
      setDeletingStaff(null);
    } finally {
      setIsDeletingStaff(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#FFDE00] hover-card-lift border-2 border-[#0A006E] rounded-2xl p-5 relative overflow-hidden">
        <div className="silent-scanner-beam-dark" />
        <div className="relative z-10">
          <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
            Strict Hierarchical Role Provisioning & Staff Governance
          </span>
          <h2 className="text-xl font-montserrat font-black italic text-[#0A006E] mt-1">
            HR & Organizational Staff Directory & Access Control
          </h2>
          <p className="text-xs font-medium text-slate-900 mt-0.5">
            Enforce role onboarding, edit details, suspend/terminate access, or permanently remove staff records with full audit logging.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-[#34D186] text-xs text-emerald-950 font-montserrat font-bold flex items-center justify-between gap-3 animate-success-pop shadow-md">
          <div className="flex items-center gap-3">
            <AnimatedSuccessTickIcon size="sm" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Switcher: Staff Directory vs HR Payroll */}
      <div className="flex items-center gap-2 border-b border-slate-300 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2.5 rounded-xl text-xs font-montserrat font-black flex items-center gap-2 cursor-pointer transition ${
            activeTab === 'roster'
              ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff Directory & Roles ({staffList.length})
        </button>

        {canManagePayroll && (
          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2.5 rounded-xl text-xs font-montserrat font-black flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'payroll'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4 text-[#34D186]" />
            HR Payroll, Salaries & Penalties Engine
            {payrollRuns.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-[#34D186] text-[#0A006E]">
                {payrollRuns.length} Runs
              </span>
            )}
          </button>
        )}

        {currentUser.role === 'Admin' && (
          <button
            type="button"
            onClick={() => setActiveTab('master_security')}
            className={`px-4 py-2.5 rounded-xl text-xs font-montserrat font-black flex items-center gap-2 cursor-pointer transition ${
              activeTab === 'master_security'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#FFDE00]" />
            Master Passcode & Security Settings
          </button>
        )}

        {onOpenAccessMatrix && (
          <button
            type="button"
            onClick={onOpenAccessMatrix}
            className="ml-auto px-3.5 py-2 rounded-xl text-xs font-montserrat font-black bg-[#FFDE00] text-[#0A006E] border-2 border-[#0A006E] hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer shadow-xs transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0A006E]" />
            8-Role Access Matrix
          </button>
        )}
      </div>

      {activeTab === 'master_security' && currentUser.role === 'Admin' && (
        <div className="bg-white border-2 border-[#0A006E]/20 rounded-2xl p-6 shadow-sm space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
            <div className="p-3 bg-[#0A006E] text-[#FFDE00] rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-montserrat font-black text-[#0A006E]">
                Administrator Master Passcode & Security Settings
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Change the system master passcode used for emergency access and fallback authentication. For maximum security, passcodes are hashed and never revealed or displayed in plaintext.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateMasterPasscode} className="space-y-4">
            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                New Master Passcode (Minimum 6 characters)
              </label>
              <input
                type="password"
                required
                value={newMasterPasscode}
                onChange={(e) => setNewMasterPasscode(e.target.value)}
                placeholder="Enter new secure master passcode..."
                className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-[#0A006E] rounded-xl text-sm font-montserrat font-medium text-slate-900 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Confirm New Master Passcode
              </label>
              <input
                type="password"
                required
                value={confirmMasterPasscode}
                onChange={(e) => setConfirmMasterPasscode(e.target.value)}
                placeholder="Confirm new master passcode..."
                className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 focus:border-[#0A006E] rounded-xl text-sm font-montserrat font-medium text-slate-900 outline-none transition"
              />
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 font-medium">
                Security Policy: Changing the master passcode updates executive override and recovery authentication. Keep your passcode secure and confidential.
              </p>
            </div>

            <button
              type="submit"
              disabled={isUpdatingMaster}
              className="w-full py-3 px-4 rounded-xl bg-[#0A006E] hover:bg-[#12009E] disabled:opacity-50 text-[#FFDE00] font-montserrat font-black text-sm tracking-wide shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isUpdatingMaster ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#FFDE00]" />
                  <span>Securing & Updating Master Passcode...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#FFDE00]" />
                  <span>Save New Master Passcode</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'roster' && (
        <>
          {creatableRoles.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
              Your current role (<strong>{currentUser.role}</strong>) has read-only visibility into the organizational directory and cannot provision new staff accounts.
            </div>
          ) : (
            <form
              onSubmit={handleProvisionStaff}
              className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#0A006E]" />
                  Provision New Staff Account (Authorized for {currentUser.role})
                </h3>
                <span className="text-xs text-slate-600">
                  Allowed Roles: <strong>{creatableRoles.join(', ')}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Full Legal Name *</label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Brenda Wanjiku"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Corporate Email *</label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@vaairo.co.ke"
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Target ERP Role</label>
                  <select
                    value={creatableRoles.includes(selectedRole) ? selectedRole : creatableRoles[0]}
                    onChange={(e) => setSelectedRole(e.target.value as StaffRole)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-montserrat font-black text-[#0A006E]"
                  >
                    {creatableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r} ({r === 'Accountant' || r === 'Admin' ? 'Google Login' : '6-Digit PIN'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Assigned Branch</label>
                  <select
                    disabled={currentUser.role === 'Branch Manager'}
                    value={
                      currentUser.role === 'Branch Manager' ? currentUser.branchId : branchId
                    }
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} · {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Initial Compensation Fields */}
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Basic Monthly Salary (KES)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setBaseSalary(val);
                      const calc = autoCalculateKenyanStatutory(val);
                      setDeductions(calc.totalDeds);
                      setDeductionsBreakdown(calc.breakdown);
                    }}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular font-bold"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Statutory Deductions (KES)</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={(e) => setDeductions(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular text-rose-600"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">KRA Tax PIN</label>
                  <input
                    type="text"
                    value={kraPin}
                    onChange={(e) => setKraPin(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono-tabular uppercase"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Estimated Net Pay</label>
                  <div className="w-full mt-1 px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl font-mono-tabular font-black text-[#0A006E]">
                    KES {Math.max(0, baseSalary - deductions - penalties).toLocaleString()}
                  </div>
                </div>

                {/* Casual Sales Representative Agreement Section */}
                {(selectedRole === 'Affiliate Sales Representative' || currentUser.role === 'Branch Manager') && (
                  <div className="sm:col-span-2 lg:col-span-4 bg-[#FFDE00]/25 border-2 border-[#0A006E]/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-montserrat font-black bg-[#0A006E] text-[#FFDE00]">
                          Casual Sales Representative Agreement
                        </span>
                        <span className="text-xs text-slate-700 font-semibold">
                          Branch casual employment: base pay + agreed commission %
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="font-montserrat font-bold text-slate-800">
                          Agreed Base Pay (KES) *
                        </label>
                        <input
                          type="number"
                          value={baseSalary}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setBaseSalary(val);
                            const calc = autoCalculateKenyanStatutory(val);
                            setDeductions(calc.totalDeds);
                            setDeductionsBreakdown(calc.breakdown);
                          }}
                          className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-bold text-[#0A006E]"
                          placeholder="e.g. 25000"
                        />
                        <span className="text-[11px] text-slate-600 mt-1 block">
                          Casual base stipend / retainer negotiated for this branch.
                        </span>
                      </div>
                      <div>
                        <label className="font-montserrat font-bold text-slate-800">
                          Agreed Sales Commission (%) *
                        </label>
                        <div className="relative mt-1">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={agreedCommissionPct}
                            onChange={(e) => setAgreedCommissionPct(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono-tabular font-black text-[#0A006E] pr-8"
                            placeholder="e.g. 8.0"
                          />
                          <span className="absolute right-3 top-2.5 font-montserrat font-bold text-slate-500">%</span>
                        </div>
                        <span className="text-[11px] text-slate-600 mt-1 block">
                          Earns {agreedCommissionPct}% commission on all verified beverage dispatch volume.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!isGoogleRole ? (
                  <div className="sm:col-span-2 lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2">
                    <label className="font-montserrat font-bold text-slate-700">
                      Assigned 6-Digit Authentication PIN (Enlarged Digits)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        required
                        type="text"
                        maxLength={6}
                        pattern="\d{6}"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-52 h-12 px-4 bg-white border-2 border-[#0A006E] rounded-xl font-mono-tabular font-black text-2xl tracking-widest text-[#0A006E] shadow-xs text-center"
                      />
                      <button
                        type="button"
                        onClick={handleRandomizePin}
                        className="px-4 py-2.5 bg-slate-50 hover:bg-[#FFDE00] border border-slate-300 hover:border-[#0A006E] rounded-xl text-xs font-montserrat font-bold text-[#0A006E] cursor-pointer transition-colors"
                      >
                        Generate New PIN
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sm:col-span-2 lg:col-span-4 flex items-center text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                    <Lock className="w-4 h-4 text-[#0A006E] mr-2 shrink-0" />
                    Accountant & Admin authenticate strictly via Google OAuth using their corporate email address.
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 border-2 border-[#0A006E] text-[#0A006E] font-montserrat font-black text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Create Staff Account & Activate Role Permissions
              </button>
            </form>
          )}

          {/* Organization Staff Directory Table */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                Provisioned Organization Directory ({staffList.length} Staff)
              </h3>
              <button
                onClick={() =>
                  exportReportToPDF(
                    'HR Staff & Role-Based Access Directory',
                    `Exported by ${currentUser.name}`,
                    ['Name', 'Email', 'Role', 'Status', 'Auth Method', 'Branch', 'Created By', 'Last Login'],
                    staffList.map((s) => [
                      s.name,
                      s.email,
                      s.role,
                      s.status,
                      s.authMethod === 'google' ? 'Google OAuth' : `6-Digit PIN (${s.pin || '******'})`,
                      s.branchName,
                      `${s.createdBy} (${s.createdByRole})`,
                      s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never',
                    ]),
                    'Vaairo_HR_Staff_Directory'
                  )
                }
                className="px-3.5 py-1.5 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-[#FFDE00]" />
                Export HR PDF
              </button>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">Staff Name & Email</th>
                    <th className="py-2.5 px-3 font-black">Role & Status</th>
                    <th className="py-2.5 px-3 font-black">Auth Mode & PIN</th>
                    <th className="py-2.5 px-3 font-black">Assigned Branch</th>
                    <th className="py-2.5 px-3 font-black text-right">Net Monthly Salary</th>
                    <th className="py-2.5 px-3 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffList.map((s) => {
                    const canManage = canManageStaff(s);
                    const bSal = s.baseSalaryKes ?? (s.role === 'Admin' ? 180000 : s.role === 'Accountant' ? 120000 : s.role === 'Branch Manager' ? 95000 : 65000);
                    const ded = s.deductionsKes ?? Math.round(bSal * 0.18);
                    const pen = s.penaltiesKes ?? 0;
                    const net = Math.max(0, bSal - ded - pen);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{s.name}</div>
                          <div className="text-slate-500 font-normal text-[11px]">{s.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-montserrat font-black text-[#0A006E]">{s.role}</div>
                          {(s.role === 'Affiliate Sales Representative' || s.isCasual) && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-montserrat font-bold bg-[#FFDE00] text-[#0A006E] border border-amber-400">
                              Casual · {s.agreedCommissionPct ?? 8}% Commission
                            </span>
                          )}
                          <div>
                            <span className={`inline-flex items-center px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'Active'
                                ? 'bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/40'
                                : s.status === 'Suspended'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-300'
                            }`}>
                              {s.status}
                            </span>
                          </div>
                          {s.strippedFeatures && s.strippedFeatures.length > 0 && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-montserrat font-black bg-rose-100 text-rose-800 border border-rose-300">
                              {s.strippedFeatures.length} Feature{s.strippedFeatures.length > 1 ? 's' : ''} Stripped
                            </span>
                          )}
                          {s.grantedFeatures && s.grantedFeatures.length > 0 && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-montserrat font-black bg-blue-100 text-blue-800 border border-blue-300">
                              +{s.grantedFeatures.length} Custom
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono-tabular">
                          {s.authMethod === 'google' ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0A006E] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                              <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                              Google OAuth
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Encrypted PIN
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{s.branchName}</td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="font-mono-tabular font-bold text-[#0A006E]">
                            KES {net.toLocaleString()}
                          </div>
                          {(s.role === 'Affiliate Sales Representative' || s.isCasual) && (
                            <div className="text-[10px] text-slate-500 font-semibold font-mono-tabular">
                              Base KES {bSal.toLocaleString()} + {s.agreedCommissionPct ?? 8}%
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {currentUser.role === 'Admin' && onOpenUserFeatureModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenUserFeatureModal(s)}
                                  className="px-2 py-1 bg-purple-50 hover:bg-[#0A006E] hover:text-[#FFDE00] text-purple-800 border border-purple-200 rounded-lg font-montserrat font-black text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                  title="Control Access Model & Strip Features from User"
                                >
                                  <Sliders className="w-3 h-3 text-purple-600" />
                                  Features
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenCompensation(s)}
                                className="px-2 py-1 bg-amber-50 hover:bg-[#FFDE00] text-[#0A006E] border border-amber-300 rounded-lg font-montserrat font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                title="Set Salary, Deductions & Penalties"
                              >
                                <DollarSign className="w-3 h-3 text-[#1E9E60]" />
                                Compensation
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenEdit(s)}
                                className="px-2 py-1 bg-slate-100 hover:bg-[#0A006E] hover:text-[#FFDE00] text-slate-700 rounded-lg font-montserrat font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                title="Edit Staff Member"
                              >
                                <Pencil className="w-3 h-3" />
                                Edit
                              </button>

                              {s.status === 'Active' && (
                                <button
                                  type="button"
                                  onClick={() => onSetStaffStatus?.(s.id, 'Suspended')}
                                  className="px-2 py-1 bg-amber-50 hover:bg-amber-500 hover:text-white text-amber-700 rounded-lg font-montserrat font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                  title="Suspend Staff Access"
                                >
                                  <PauseCircle className="w-3 h-3" />
                                  Suspend
                                </button>
                              )}

                              {s.status === 'Suspended' && (
                                <button
                                  type="button"
                                  onClick={() => onSetStaffStatus?.(s.id, 'Active')}
                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 rounded-lg font-montserrat font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                  title="Reactivate Staff Account"
                                >
                                  <PlayCircle className="w-3 h-3" />
                                  Activate
                                </button>
                              )}

                              {s.status !== 'Terminated' && (
                                <button
                                  type="button"
                                  onClick={() => onSetStaffStatus?.(s.id, 'Terminated')}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-700 rounded-lg font-montserrat font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                                  title="Terminate Staff Account"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Terminate
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setDeletingStaff(s)}
                                className="p-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 rounded-lg transition-colors cursor-pointer"
                                title="Permanently Delete Staff"
                                aria-label={`Permanently Delete ${s.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              {s.id === currentUser.id ? 'Current User' : 'Restricted'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* PAYROLL & COMPENSATION ENGINE TAB */}
      {activeTab === 'payroll' && canManagePayroll && (
        <div className="space-y-6">
          {/* Top KPI Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-montserrat font-bold text-slate-600">
                Total Monthly Net Disbursement
              </div>
              <div className="text-2xl font-montserrat font-black text-[#0A006E] font-mono-tabular mt-1">
                KES {staffList.filter((s) => s.status === 'Active').reduce((sum, s) => {
                  const bSal = s.baseSalaryKes ?? (s.role === 'Admin' ? 180000 : s.role === 'Accountant' ? 120000 : s.role === 'Branch Manager' ? 95000 : 65000);
                  const ded = s.deductionsKes ?? Math.round(bSal * 0.18);
                  const pen = s.penaltiesKes ?? 0;
                  return sum + Math.max(0, bSal - ded - pen);
                }, 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                For {staffList.filter((s) => s.status === 'Active').length} active employees on roster
              </div>
            </div>

            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-montserrat font-bold text-slate-600">
                Total Gross Monthly Salaries
              </div>
              <div className="text-2xl font-montserrat font-black text-slate-800 font-mono-tabular mt-1">
                KES {staffList.filter((s) => s.status === 'Active').reduce((sum, s) => {
                  return sum + (s.baseSalaryKes ?? (s.role === 'Admin' ? 180000 : s.role === 'Accountant' ? 120000 : s.role === 'Branch Manager' ? 95000 : 65000));
                }, 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Base contracted remuneration
              </div>
            </div>

            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-montserrat font-bold text-slate-600">
                Total Statutory Deductions
              </div>
              <div className="text-2xl font-montserrat font-black text-rose-600 font-mono-tabular mt-1">
                KES {staffList.filter((s) => s.status === 'Active').reduce((sum, s) => {
                  const bSal = s.baseSalaryKes ?? (s.role === 'Admin' ? 180000 : s.role === 'Accountant' ? 120000 : s.role === 'Branch Manager' ? 95000 : 65000);
                  return sum + (s.deductionsKes ?? Math.round(bSal * 0.18));
                }, 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                KRA PAYE · SHIF · NSSF · Housing Levy
              </div>
            </div>

            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-4">
              <div className="text-xs font-montserrat font-bold text-slate-600">
                Total Disciplinary Penalties
              </div>
              <div className="text-2xl font-montserrat font-black text-amber-600 font-mono-tabular mt-1">
                KES {staffList.filter((s) => s.status === 'Active').reduce((sum, s) => sum + (s.penaltiesKes ?? 0), 0).toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Shift variances & disciplinary fines
              </div>
            </div>
          </div>

          {/* Run Payroll Execution Control Panel */}
          <div className="bg-[#FFDE00] border-2 border-[#0A006E] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#0A006E]/20 pb-3">
              <div>
                <span className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                  HR Corporate Disbursement Engine
                </span>
                <h3 className="text-base font-montserrat font-black text-[#0A006E]">
                  Execute & Publish Payroll Disbursement
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Pay Period:</span>
                <input
                  type="text"
                  value={payrollPeriod}
                  onChange={(e) => setPayrollPeriod(e.target.value)}
                  placeholder="e.g. October 2026"
                  className="px-3 py-1.5 bg-white border-2 border-[#0A006E] rounded-xl font-montserrat font-black text-xs text-[#0A006E]"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-slate-900 space-y-1">
                <p className="font-semibold">
                  Executing payroll locks the ledger for <strong>{payrollPeriod}</strong> and generates serialized thermal payslips for all <strong>{staffList.filter((s) => s.status === 'Active').length}</strong> active staff.
                </p>
                <p className="text-[11px] text-slate-800">
                  <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-[#0A006E]" />
                  Employees will immediately be able to download their 80mm/58mm POS thermal receipt payslip from their own dashboard.
                </p>
              </div>

              <button
                type="button"
                disabled={isRunningPayroll || staffList.filter((s) => s.status === 'Active').length === 0}
                onClick={handleExecutePayroll}
                className="px-6 py-3 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] rounded-xl font-montserrat font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg transition disabled:opacity-50 shrink-0"
              >
                {isRunningPayroll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#FFDE00]" />
                    Processing Ledger...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-[#FFDE00]" />
                    Run Payroll for {payrollPeriod}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Staff Compensation, Penalties & Net Pay Configuration Table */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
                  Staff Remuneration, Deductions & Penalties Roster ({staffList.length} Staff)
                </h3>
                <p className="text-xs text-slate-600">
                  Configure monthly salaries, statutory tax deductions, and disciplinary penalties for each employee.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                    <th className="py-2.5 px-3 font-black">Staff Member</th>
                    <th className="py-2.5 px-3 font-black">Role & Branch Depot</th>
                    <th className="py-2.5 px-3 font-black text-right">Basic Salary (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Deductions (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Penalties (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Net Take-Home (KES)</th>
                    <th className="py-2.5 px-3 font-black text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffList.map((s) => {
                    const bSal = s.baseSalaryKes ?? (s.role === 'Admin' ? 180000 : s.role === 'Accountant' ? 120000 : s.role === 'Branch Manager' ? 95000 : 65000);
                    const ded = s.deductionsKes ?? Math.round(bSal * 0.18);
                    const pen = s.penaltiesKes ?? 0;
                    const net = Math.max(0, bSal - ded - pen);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{s.name}</div>
                          <div className="text-slate-500 font-normal text-[11px]">{s.email}</div>
                          {s.kraPin && (
                            <div className="text-[10px] text-slate-400 font-mono">PIN: {s.kraPin}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-montserrat font-bold text-[#0A006E]">{s.role}</div>
                          <div className="text-[11px] text-slate-600">{s.branchName}</div>
                          <span className={`inline-flex items-center px-2 py-0.2 mt-0.5 rounded-full text-[9px] font-bold ${
                            s.status === 'Active' ? 'bg-[#34D186]/20 text-[#1E9E60]' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-slate-900">
                          KES {bSal.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-rose-600">
                          -KES {ded.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-amber-600">
                          {pen > 0 ? `-KES ${pen.toLocaleString()}` : 'KES 0'}
                          {s.penaltiesReason && (
                            <div className="text-[9px] text-amber-800 truncate max-w-[120px] ml-auto">
                              {s.penaltiesReason}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular font-black text-[#0A006E]">
                          KES {net.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenCompensation(s)}
                            className="px-2.5 py-1 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-lg font-montserrat font-bold text-[11px] cursor-pointer shadow-xs transition ml-auto flex items-center gap-1"
                          >
                            <DollarSign className="w-3 h-3 text-[#FFDE00]" />
                            Adjust Salary & Penalties
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historical Payroll Runs & Generated Thermal Payslips */}
          <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-2">
                  <History className="w-4 h-4 text-[#0A006E]" />
                  Historical Payroll Execution Batches ({payrollRuns.length} Runs)
                </h3>
                <p className="text-xs text-slate-600">
                  Executed payroll batches. Individual employee thermal payslips are available for download.
                </p>
              </div>
            </div>

            {payrollRuns.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
                <Receipt className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="font-montserrat font-bold text-slate-700 text-sm">
                  No Payroll Runs Finalized Yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click the <strong>"Run Payroll for {payrollPeriod}"</strong> button above to finalize your first disbursement cycle and generate employee thermal payslips.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {payrollRuns.map((run) => {
                  let runRecords: PayrollRecord[] = [];
                  try {
                    runRecords = JSON.parse(run.recordsJson);
                  } catch {
                    runRecords = [];
                  }

                  return (
                    <div key={run.id} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-[#34D186]/20 text-[#1E9E60] rounded-xl font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-montserrat font-black text-slate-900 text-sm">
                              Payroll Run: {run.period}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Executed by {run.runBy} on {new Date(run.runDate).toLocaleString()} · Batch ID: {run.id}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-slate-500">Total Net Disbursed:</div>
                            <div className="font-mono-tabular font-black text-[#0A006E] text-sm">
                              KES {run.totalDisbursed.toLocaleString()}
                            </div>
                          </div>
                          <span className="px-2.5 py-1 bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/40 rounded-xl text-xs font-bold">
                            PAID & CLEARED
                          </span>
                        </div>
                      </div>

                      {/* Employee payslip list inside this run */}
                      <div className="space-y-1.5 pt-1">
                        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                          Employee Payslips in this Batch ({runRecords.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {runRecords.map((rec) => (
                            <div
                              key={rec.staffId}
                              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="truncate">
                                <div className="font-montserrat font-bold text-slate-900 truncate">
                                  {rec.staffName}
                                </div>
                                <div className="text-[10px] text-slate-500 font-mono-tabular">
                                  {rec.staffRole} · KES {rec.netSalary.toLocaleString()}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onOpenPayslip?.(rec)}
                                className="px-2 py-1 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-lg font-montserrat font-black text-[10px] flex items-center gap-1 cursor-pointer transition shrink-0"
                              >
                                <Printer className="w-3 h-3" />
                                Payslip
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Compensation Adjustment Modal */}
      {compStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-lg w-full h-full sm:h-auto overflow-y-auto p-5 sm:p-6 space-y-4 flex flex-col justify-between sm:justify-start">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-montserrat font-black text-[#0A006E]">
                  Configure Remuneration & Penalties
                </h3>
                <p className="text-xs text-slate-500">
                  {compStaff.name} ({compStaff.role} · {compStaff.branchName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompensation} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="font-montserrat font-bold text-slate-700">Basic Monthly Salary (KES) *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const calc = autoCalculateKenyanStatutory(compBase);
                        setCompDed(calc.totalDeds);
                        setCompBreakdown(calc.breakdown);
                      }}
                      className="text-[11px] font-montserrat font-bold text-[#0A006E] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Calculator className="w-3 h-3" />
                      Auto-Calculate Statutory (KRA eTIMS)
                    </button>
                  </div>
                  <input
                    required
                    type="number"
                    value={compBase}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCompBase(val);
                      const calc = autoCalculateKenyanStatutory(val);
                      setCompDed(calc.totalDeds);
                      setCompBreakdown(calc.breakdown);
                    }}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-mono-tabular font-bold text-slate-900 text-sm"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Statutory Deductions (KES)</label>
                  <input
                    required
                    type="number"
                    value={compDed}
                    onChange={(e) => setCompDed(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-mono-tabular font-bold text-rose-600"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Disciplinary Penalties (KES)</label>
                  <input
                    type="number"
                    value={compPen}
                    onChange={(e) => setCompPen(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-mono-tabular font-bold text-amber-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-montserrat font-bold text-slate-700">Deductions Itemized Breakdown</label>
                  <input
                    type="text"
                    value={compBreakdown}
                    onChange={(e) => setCompBreakdown(e.target.value)}
                    placeholder="e.g. PAYE: KES 8,500, SHIF: KES 1,800, NSSF: KES 1,080, Housing Levy: KES 1,120"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-[11px]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-montserrat font-bold text-slate-700">Reason for Penalties / Fines</label>
                  <input
                    type="text"
                    value={compReason}
                    onChange={(e) => setCompReason(e.target.value)}
                    placeholder="e.g. Stock variance on POS batch #12 or Shift tardiness"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl text-[11px]"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">KRA Tax PIN</label>
                  <input
                    type="text"
                    value={compKra}
                    onChange={(e) => setCompKra(e.target.value.toUpperCase())}
                    placeholder="A009182741Z"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-mono-tabular uppercase"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">NSSF Number</label>
                  <input
                    type="text"
                    value={compNssf}
                    onChange={(e) => setCompNssf(e.target.value)}
                    placeholder="092837192"
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-xl font-mono-tabular"
                  />
                </div>
              </div>

              {/* Net Pay Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Calculated Net Take-Home Pay</div>
                  <div className="text-lg font-black text-[#0A006E] font-mono-tabular">
                    KES {Math.max(0, compBase - compDed - compPen).toLocaleString()}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  Gross KES {compBase.toLocaleString()} − KES {(compDed + compPen).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompStaff(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingComp}
                  className="px-5 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] border-2 border-[#0A006E] rounded-xl font-montserrat font-black cursor-pointer shadow-md transition disabled:opacity-50"
                >
                  {isSavingComp ? 'Saving...' : 'Save Remuneration & Penalties'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-lg w-full h-full sm:h-auto overflow-y-auto p-5 sm:p-6 space-y-4 flex flex-col justify-between sm:justify-start">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-montserrat font-black text-[#0A006E]">
                Edit Staff Account: {editingStaff.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-montserrat font-bold text-slate-700">Full Legal Name *</label>
                  <input
                    required
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Corporate Email *</label>
                  <input
                    required
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">ERP Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as StaffRole)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-montserrat font-black text-[#0A006E]"
                  >
                    {creatableRoles.includes(editRole) ? (
                      creatableRoles.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value={editRole}>{editRole}</option>
                        {creatableRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-montserrat font-bold text-slate-700">Account Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as 'Active' | 'Suspended' | 'Terminated')
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl font-montserrat font-bold"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="font-montserrat font-bold text-slate-700">Assigned Branch</label>
                  <select
                    value={editBranchId}
                    onChange={(e) => setEditBranchId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-xl"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.code} · {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {editRole !== 'Admin' && editRole !== 'Accountant' && (
                  <div className="sm:col-span-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                    <label className="font-montserrat font-bold text-slate-700">
                      Assigned 6-Digit PIN (Enlarged Digits)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        maxLength={6}
                        pattern="\d{6}"
                        value={editPin}
                        onChange={(e) => setEditPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={editingStaff?.pin ? '•••••• (Encrypted)' : '6 Digits'}
                        className="w-56 h-12 px-3 bg-white border-2 border-[#0A006E] rounded-xl font-mono-tabular font-black text-xl tracking-widest text-[#0A006E] text-center"
                      />
                      <button
                        type="button"
                        onClick={handleRandomizeEditPin}
                        className="px-3.5 py-2.5 bg-white hover:bg-[#FFDE00] border border-slate-300 rounded-xl font-montserrat font-bold text-xs text-[#0A006E] cursor-pointer"
                      >
                        Generate New PIN
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-montserrat font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0A006E] hover:bg-[#070050] text-[#FFDE00] rounded-xl font-montserrat font-black cursor-pointer shadow-md"
                >
                  Save Staff Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Permanent Confirmation Modal (Prompting Question per Requirement 3) */}
      {deletingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-rose-600 shadow-2xl max-w-none sm:max-w-md w-full h-full sm:h-auto overflow-y-auto p-5 sm:p-6 space-y-4 flex flex-col justify-between sm:justify-start">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border-2 border-rose-200 shadow-xs">
              <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="text-center space-y-1.5">
              <span className="text-[11px] font-montserrat font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                Permanent Removal Notice
              </span>
              <h3 className="text-lg sm:text-xl font-montserrat font-black text-slate-900">
                Are you sure you want to permanently delete this staff member?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                This action is <strong>permanent</strong> and cannot be undone. All login credentials, authentication PIN codes, and role assignments will be permanently eradicated.
              </p>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 space-y-1.5 text-xs">
              <div className="font-montserrat font-black text-slate-900 text-sm">{deletingStaff.name}</div>
              <div className="text-slate-600">
                Email: <span className="font-medium text-slate-800">{deletingStaff.email}</span>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="font-montserrat font-black text-[#0A006E]">{deletingStaff.role}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{deletingStaff.branchName}</span>
                <span className="text-slate-400">·</span>
                <span className="font-mono text-slate-500 font-bold">{deletingStaff.status}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={() => setDeletingStaff(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition-colors"
              >
                Cancel / Keep Staff
              </button>
              <button
                type="button"
                disabled={isDeletingStaff}
                onClick={handleConfirmDelete}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {isDeletingStaff ? 'Deleting...' : 'Permanently Delete Staff'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 9. USER MONITORING, DEVICE FINGERPRINT & SECURITY AUDIT LOGS MODULE
// ---------------------------------------------------------------------------
export const AuditAndSecurityModule: React.FC<{
  currentUser: StaffMember;
  auditLogs: AuditLog[];
  staffList: StaffMember[];
  onOpenAccessMatrix?: () => void;
  onOpenUserFeatureModal?: (staff: StaffMember) => void;
}> = ({ currentUser, auditLogs, staffList, onOpenAccessMatrix, onOpenUserFeatureModal }) => {
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [feedbackToast, setFeedbackToast] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Role-scoped audit telemetry matching Target Access Model:
  // Admin: Full
  // Accountant: Finance audit
  // HR: HR audit
  // Sales Mgr: Sales scope
  // Branch Mgr: Branch scope
  // Inventory: Stock scope
  // Cashier: Own activity
  // Affiliate: Own activity
  const scopedLogs = useMemo(() => {
    const role = currentUser.role;
    if (role === 'Admin') return auditLogs;

    if (role === 'Accountant') {
      return auditLogs.filter(
        (l) =>
          l.module === 'Financial' ||
          l.module === 'Compliance' ||
          l.module.toLowerCase().includes('accounting') ||
          l.action.toLowerCase().includes('transaction') ||
          l.action.toLowerCase().includes('credit') ||
          l.action.toLowerCase().includes('invoice') ||
          l.action.toLowerCase().includes('payment')
      );
    }

    if (role === 'HR') {
      return auditLogs.filter(
        (l) =>
          l.module.toLowerCase().includes('hr') ||
          l.module.toLowerCase().includes('staff') ||
          l.module.toLowerCase().includes('payroll') ||
          l.action.toLowerCase().includes('role') ||
          l.action.toLowerCase().includes('pin') ||
          l.action.toLowerCase().includes('session') ||
          l.action.toLowerCase().includes('login')
      );
    }

    if (role === 'Sales Manager') {
      return auditLogs.filter(
        (l) =>
          l.module.toLowerCase().includes('sales') ||
          l.module.toLowerCase().includes('pos') ||
          l.module.toLowerCase().includes('retail') ||
          l.module.toLowerCase().includes('quote') ||
          l.action.toLowerCase().includes('wholesale') ||
          l.action.toLowerCase().includes('order')
      );
    }

    if (role === 'Branch Manager') {
      return auditLogs.filter(
        (l) =>
          l.branchName === currentUser.branchName ||
          l.details.toLowerCase().includes(currentUser.branchName.toLowerCase())
      );
    }

    if (role === 'Inventory Controller') {
      return auditLogs.filter(
        (l) =>
          l.module.toLowerCase().includes('inventory') ||
          l.module.toLowerCase().includes('transfer') ||
          l.action.toLowerCase().includes('sku') ||
          l.action.toLowerCase().includes('damage') ||
          l.action.toLowerCase().includes('stock') ||
          l.action.toLowerCase().includes('spoilage') ||
          l.action.toLowerCase().includes('barcode')
      );
    }

    if (role === 'Counter Cashier') {
      return auditLogs.filter(
        (l) =>
          l.actorName === currentUser.name ||
          l.actorEmailOrPinId === currentUser.email ||
          l.actorRole === 'Counter Cashier'
      );
    }

    if (role === 'Affiliate Sales Representative') {
      return auditLogs.filter(
        (l) =>
          l.actorName === currentUser.name ||
          l.actorEmailOrPinId === currentUser.email
      );
    }

    return auditLogs;
  }, [auditLogs, currentUser]);

  const filteredLogs = useMemo(
    () =>
      severityFilter === 'All'
        ? scopedLogs
        : scopedLogs.filter((l) => l.severity === severityFilter),
    [scopedLogs, severityFilter]
  );

  return (
    <div className="space-y-6">
      {/* Zero-Trust Telemetry & Activity Surveillance Banner */}
      <div className="bg-[#F8FAFC] border-2 border-slate-300 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A006E] text-[#FFDE00] text-[11px] font-montserrat font-black uppercase tracking-wider shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Zero-Trust Telemetry &amp; Activity Surveillance · {currentUser.role} Scope
          </div>
          <h2 className="text-xl sm:text-2xl font-montserrat font-black text-[#0A006E] tracking-tight">
            User Monitoring, Device Fingerprints, Last Login Status &amp; Security Audit Trail
          </h2>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
              <Users className="w-3.5 h-3.5 text-[#0A006E]" />
              Audit Scope: <strong className="text-[#0A006E]">{currentUser.role}</strong> ({filteredLogs.length} Scoped Records)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1E9E60]" />
              Device Fingerprints &amp; Verification
            </span>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
          {onOpenAccessMatrix && (
            <button
              type="button"
              onClick={onOpenAccessMatrix}
              className="h-10 px-4 inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-[#0A006E]" />
              8-Role Access Matrix
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              exportReportToPDF(
                'Security Audit & User Device Monitoring Log',
                'Immutable Activity & Device Fingerprint Statement',
                ['Timestamp', 'Actor', 'Role', 'Action', 'Module', 'Device Used', 'Severity'],
                filteredLogs.map((l) => [
                  new Date(l.createdAt).toLocaleString(),
                  l.actorName,
                  l.actorRole,
                  l.action,
                  l.module,
                  l.deviceFingerprint,
                  l.severity,
                ]),
                'Vaairo_Security_Audit_Logs'
              )
            }
            className="h-10 px-4 inline-flex items-center justify-center gap-2 bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition active:scale-95 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#FFDE00]" />
            Export Security PDF
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                'Vaairo_Security_Audit_Logs',
                ['Timestamp', 'Actor', 'Role', 'Identifier', 'Action', 'Module', 'Details', 'Device Fingerprint', 'Branch', 'Severity'],
                filteredLogs.map((l) => [
                  l.createdAt,
                  l.actorName,
                  l.actorRole,
                  l.actorEmailOrPinId,
                  l.action,
                  l.module,
                  l.details,
                  l.deviceFingerprint,
                  l.branchName,
                  l.severity,
                ])
              )
            }
            className="h-10 px-4 inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-xs transition active:scale-95 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-[#0A006E]" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Active User Session & Device Monitoring Grid */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-montserrat font-black text-[#0A006E]">
          Live Staff Session & Device Monitoring Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {staffList.map((s) => (
            <div
              key={s.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-montserrat font-black text-[#0A006E]">{s.name}</span>
                <span className="font-mono-tabular text-[11px] text-[#1E9E60] font-bold">
                  {s.status}
                </span>
              </div>
              <div className="text-slate-600">
                Role: <strong>{s.role}</strong> · {s.branchName}
              </div>
              <div className="text-[11px] text-slate-500 font-mono-tabular">
                Auth: {s.authMethod === 'google' ? 'Google OAuth' : '6-Digit PIN'}
              </div>
              <div className="text-[11px] text-slate-600 font-mono-tabular pt-1 border-t border-slate-100">
                <div>
                  Last Login:{' '}
                  {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Awaiting first login'}
                </div>
                <div className="truncate" title={s.lastDevice}>
                  Device: {s.lastDevice || 'Unregistered Terminal'}
                </div>
              </div>
              {s.strippedFeatures && s.strippedFeatures.length > 0 && (
                <div className="pt-1">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-montserrat font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                    <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                    {s.strippedFeatures.length} Feature{s.strippedFeatures.length > 1 ? 's' : ''} Stripped
                  </span>
                </div>
              )}
              {currentUser.role === 'Admin' && onOpenUserFeatureModal && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenUserFeatureModal(s)}
                    className="w-full py-1.5 bg-purple-50 hover:bg-[#0A006E] hover:text-[#FFDE00] text-purple-800 border border-purple-200 rounded-lg font-montserrat font-black text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                    title="Control features or strip access from this user"
                  >
                    <Sliders className="w-3 h-3 text-purple-600" />
                    Control Feature Access
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Audit Trail Table */}
      <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {['All', 'Info', 'Security', 'Financial', 'Critical'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-black cursor-pointer ${
                  severityFilter === sev
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono-tabular font-bold text-[#0A006E]">
            {filteredLogs.length} Logged Events
          </span>
        </div>

        <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#0A006E] text-[#FFDE00] font-montserrat">
                <th className="py-2.5 px-3 font-black">Timestamp</th>
                <th className="py-2.5 px-3 font-black">User & Role</th>
                <th className="py-2.5 px-3 font-black">Action & Module</th>
                <th className="py-2.5 px-3 font-black">Transaction / Activity Details</th>
                <th className="py-2.5 px-3 font-black">Device Used</th>
                <th className="py-2.5 px-3 font-black">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-mono-tabular text-slate-600 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-montserrat font-bold text-slate-900">{log.actorName}</div>
                    <div className="text-[11px] text-slate-500">{log.actorRole}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-[#0A006E]">{log.action}</div>
                    <div className="text-[11px] text-slate-500">{log.module}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 max-w-xs">{log.details}</td>
                  <td className="py-2.5 px-3 font-mono-tabular text-[11px] text-slate-600">
                    {log.deviceFingerprint}
                  </td>
                  <td className="py-2.5 px-3 font-montserrat font-bold text-slate-900">
                    {log.severity}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <StatusFeedbackToast status={feedbackToast} onDismiss={() => setFeedbackToast(null)} />
    </div>
  );
};
