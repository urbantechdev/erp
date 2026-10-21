import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Lock,
  Unlock,
  Building2,
  User,
  Info,
  Search,
} from 'lucide-react';
import { StaffMember, StaffRole, ERPModuleId } from '../types';
import { ERP_FEATURE_CATALOG, ROLE_PERMISSIONS, isUserFeaturePermitted } from '../erpUtils';

interface UserFeatureAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: StaffMember | null;
  currentUser: StaffMember;
  customRoleMatrix?: Record<StaffRole, ERPModuleId[]>;
  onSavePermissions: (
    staffId: string,
    updates: {
      strippedFeatures: string[];
      grantedFeatures: string[];
      customPermissionsNote?: string;
    }
  ) => Promise<void>;
}

export const UserFeatureAccessModal: React.FC<UserFeatureAccessModalProps> = ({
  isOpen,
  onClose,
  staff,
  currentUser,
  customRoleMatrix,
  onSavePermissions,
}) => {
  if (!isOpen || !staff) return null;

  const [stripped, setStripped] = useState<string[]>(() => staff.strippedFeatures || []);
  const [granted, setGranted] = useState<string[]>(() => staff.grantedFeatures || []);
  const [note, setNote] = useState<string>(() => staff.customPermissionsNote || '');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Baseline modules from user's role
  const roleBaseModules =
    (customRoleMatrix && customRoleMatrix[staff.role]) ||
    ROLE_PERMISSIONS[staff.role]?.allowedModules ||
    [];

  // Helper to determine if a feature is enabled by default for this user's role
  const isDefaultEnabledForRole = (featureKey: string, isModule: boolean, moduleId?: ERPModuleId): boolean => {
    if (isModule && moduleId) {
      return roleBaseModules.includes(moduleId);
    }
    // Sub-feature baseline
    if (staff.role === 'Admin') return true;
    if (staff.role === 'Accountant') {
      return !['pos_discounts', 'pos_voids', 'inventory_damage_logging', 'manage_staff_salaries'].includes(featureKey);
    }
    if (staff.role === 'HR') {
      return ['manage_staff_salaries'].includes(featureKey);
    }
    if (staff.role === 'Branch Manager' || staff.role === 'Sales Manager') {
      return ['pos_discounts', 'pos_voids', 'inventory_damage_logging', 'issue_credit_notes'].includes(featureKey);
    }
    if (staff.role === 'Inventory Controller') {
      return ['inventory_damage_logging'].includes(featureKey);
    }
    return false;
  };

  // Toggle state of a feature
  const handleToggleFeature = (featureKey: string, isModule: boolean, moduleId?: ERPModuleId) => {
    const defaultAllowed = isDefaultEnabledForRole(featureKey, isModule, moduleId);
    const isCurrentlyStripped = stripped.includes(featureKey);
    const isCurrentlyGranted = granted.includes(featureKey);

    if (defaultAllowed) {
      if (isCurrentlyStripped) {
        // Un-strip: restore default
        setStripped((prev) => prev.filter((k) => k !== featureKey));
      } else {
        // Strip off this feature
        setStripped((prev) => [...prev, featureKey]);
      }
    } else {
      if (isCurrentlyGranted) {
        // Remove explicit grant
        setGranted((prev) => prev.filter((k) => k !== featureKey));
      } else {
        // Grant this feature
        setGranted((prev) => [...prev, featureKey]);
      }
    }
  };

  // Quick preset actions
  const handleResetToDefaults = () => {
    setStripped([]);
    setGranted([]);
  };

  const handleStripPosAndSales = () => {
    const posKeys = ['retail_pos', 'sales_pos', 'pos_discounts', 'pos_voids'];
    setStripped((prev) => Array.from(new Set([...prev, ...posKeys])));
    setGranted((prev) => prev.filter((k) => !posKeys.includes(k)));
  };

  const handleStripFinancials = () => {
    const finKeys = ['documents_credit', 'issue_credit_notes', 'export_financial_pdf', 'manage_staff_salaries'];
    setStripped((prev) => Array.from(new Set([...prev, ...finKeys])));
    setGranted((prev) => prev.filter((k) => !finKeys.includes(k)));
  };

  const handleStripInventoryAdjustments = () => {
    const invKeys = ['inventory', 'inventory_damage_logging', 'branches_transfers'];
    setStripped((prev) => Array.from(new Set([...prev, ...invKeys])));
    setGranted((prev) => prev.filter((k) => !invKeys.includes(k)));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSavePermissions(staff.id, {
        strippedFeatures: stripped,
        grantedFeatures: granted,
        customPermissionsNote: note.trim() || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } finally {
      setIsSaving(false);
    }
  };

  const categories = [
    'All',
    'Core Modules',
    'POS & Sales Operations',
    'Inventory & Stock Governance',
    'Finance, Credit & Invoicing',
    'HR, Access & Administration',
  ];

  const filteredFeatures = ERP_FEATURE_CATALOG.filter((f) => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch =
      f.label.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
      f.key.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="px-6 py-4 bg-[#0A006E] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-xs">
              <Sliders className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-montserrat font-black text-[#FFDE00] uppercase tracking-wider">
                  Admin Security Governor
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  User Feature Stripping
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-montserrat font-black text-white">
                Access Controls for {staff.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Summary Pill */}
        <div className="px-6 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 font-montserrat font-bold text-slate-800">
              <User className="w-3.5 h-3.5 text-[#0A006E]" />
              <span>{staff.name}</span>
              <span className="text-slate-400">({staff.email})</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>{staff.branchName}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[11px]">
              {staff.role}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {stripped.length > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-rose-100 border border-rose-300 text-rose-800 font-montserrat font-black text-xs flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                {stripped.length} Feature{stripped.length > 1 ? 's' : ''} Stripped
              </span>
            )}
            {granted.length > 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-blue-100 border border-blue-300 text-blue-800 font-montserrat font-black text-xs flex items-center gap-1">
                <Unlock className="w-3.5 h-3.5 text-blue-700" />
                +{granted.length} Custom Granted
              </span>
            )}
            {stripped.length === 0 && granted.length === 0 && (
              <span className="px-2.5 py-1 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 font-montserrat font-bold text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Standard Role Permissions
              </span>
            )}
          </div>
        </div>

        {/* Quick Strip Actions Bar */}
        <div className="px-6 py-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1 text-amber-900 font-montserrat font-bold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>Admin Quick Stripping Presets:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleStripPosAndSales}
              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-montserrat font-bold text-[11px] transition cursor-pointer"
            >
              Strip POS &amp; Sales
            </button>
            <button
              type="button"
              onClick={handleStripFinancials}
              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-montserrat font-bold text-[11px] transition cursor-pointer"
            >
              Strip Invoicing &amp; Credit
            </button>
            <button
              type="button"
              onClick={handleStripInventoryAdjustments}
              className="px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-montserrat font-bold text-[11px] transition cursor-pointer"
            >
              Strip Warehouse Edits
            </button>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-montserrat font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              Reset Role Defaults
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search ERP features or modules..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold whitespace-nowrap cursor-pointer transition ${
                  selectedCategory === cat
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Feature List Body */}
        <div className="p-6 space-y-3 overflow-y-auto flex-1 bg-slate-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFeatures.map((feat) => {
              const defaultAllowed = isDefaultEnabledForRole(feat.key, feat.isModule, feat.moduleId);
              const isStripped = stripped.includes(feat.key);
              const isGranted = granted.includes(feat.key);
              const isCurrentlyActive = (defaultAllowed && !isStripped) || isGranted;

              return (
                <div
                  key={feat.key}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    isStripped
                      ? 'bg-rose-50/80 border-rose-300 shadow-2xs'
                      : isGranted
                      ? 'bg-blue-50/80 border-blue-300 shadow-2xs'
                      : isCurrentlyActive
                      ? 'bg-white border-slate-200'
                      : 'bg-slate-100/70 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-montserrat font-black text-xs text-slate-900">
                          {feat.label}
                        </span>
                        {feat.isModule ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#0A006E]/10 text-[#0A006E]">
                            Module
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-200 text-slate-700">
                            Action
                          </span>
                        )}
                        {isStripped && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                            STRIPPED OFF
                          </span>
                        )}
                        {isGranted && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">
                            CUSTOM GRANTED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {feat.description}
                      </p>
                      <div className="mt-2 text-[10px] font-semibold text-slate-400">
                        Role Default:{' '}
                        <strong className={defaultAllowed ? 'text-emerald-700' : 'text-slate-500'}>
                          {defaultAllowed ? 'Allowed' : 'Not Included'}
                        </strong>
                      </div>
                    </div>

                    {/* Toggle Button */}
                    <div className="shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleToggleFeature(feat.key, feat.isModule, feat.moduleId)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                          isCurrentlyActive ? 'bg-[#34D186]' : 'bg-rose-500'
                        }`}
                        title={
                          isCurrentlyActive
                            ? 'Click to strip this feature from user'
                            : 'Click to grant this feature to user'
                        }
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            isCurrentlyActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Audit Note & Reason */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 mt-4">
            <label className="block text-xs font-montserrat font-bold text-slate-800">
              Audit Justification / Restriction Reason (Logged for Compliance)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Temporary cash register probation; inventory write-offs revoked pending quarterly stock audit."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
            {staff.permissionsModifiedAt && (
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-400" />
                <span>
                  Last modified on {new Date(staff.permissionsModifiedAt).toLocaleString()} by{' '}
                  {staff.permissionsModifiedBy || 'Administrator'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {stripped.length > 0
              ? `${stripped.length} feature(s) will be blocked from ${staff.name}'s account upon saving.`
              : 'User has full standard access for their role.'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-montserrat font-bold text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-5 py-2 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-md transition ${
                saveSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00]'
              }`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Permissions Saved!
                </>
              ) : isSaving ? (
                'Saving Access Policy...'
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#FFDE00]" />
                  Save &amp; Apply Access Controls
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
