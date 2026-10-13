import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  X,
  Download,
  Info,
  CheckCircle2,
  Lock,
  Building2,
  Users,
  Coins,
  Package,
  ShoppingCart,
  FileText,
  BadgeAlert,
  ArrowRight,
  Sliders,
  RotateCcw,
  Save,
  UserX,
  Sparkles,
} from 'lucide-react';
import { StaffRole, StaffMember, ERPModuleId } from '../types';
import {
  TARGET_ACCESS_MATRIX,
  ROLE_DISTINCTIONS,
  ROLE_PERMISSIONS,
  AccessLevel,
  exportToCSV,
  exportReportToPDF,
  ERP_FEATURE_CATALOG,
} from '../erpUtils';

interface AccessModelMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember;
  staffList?: StaffMember[];
  customRoleMatrix?: Record<StaffRole, ERPModuleId[]>;
  onSaveRoleMatrix?: (newMatrix: Record<StaffRole, ERPModuleId[]>) => Promise<void>;
  onResetRoleMatrix?: () => Promise<void>;
  onOpenUserFeatureModal?: (staff: StaffMember) => void;
}

const ROLES_ORDER: StaffRole[] = [
  'Admin',
  'Accountant',
  'HR',
  'Sales Manager',
  'Branch Manager',
  'Inventory Controller',
  'Counter Cashier',
  'Affiliate Sales Representative',
];

const ALL_MODULES: { id: ERPModuleId; label: string }[] = [
  { id: 'overview', label: 'Executive Overview' },
  { id: 'retail_pos', label: 'Retail Counter POS' },
  { id: 'sales_pos', label: 'Wholesale B2B POS' },
  { id: 'inventory', label: 'Inventory & Auto-SKU' },
  { id: 'branches_transfers', label: 'Branches & Transfers' },
  { id: 'geo_pricing', label: 'Geo-Pricing Multipliers' },
  { id: 'partners', label: 'Suppliers & Logistics' },
  { id: 'documents_credit', label: 'Docs, Receipts & Credit' },
  { id: 'compliance', label: 'Excise & Regulatory Stamps' },
  { id: 'hr_rbac', label: 'HR Provisioning & Roles' },
  { id: 'audit_security', label: 'User Monitoring & Logs' },
  { id: 'customer_portal', label: 'Customer Online Store' },
  { id: 'outlets_restaurants', label: 'Outlets, Bars & Clubs' },
];

export const AccessModelMatrixModal: React.FC<AccessModelMatrixModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  staffList = [],
  customRoleMatrix,
  onSaveRoleMatrix,
  onResetRoleMatrix,
  onOpenUserFeatureModal,
}) => {
  const isAdmin = currentUser.role === 'Admin';
  const [activeTab, setActiveTab] = useState<'matrix' | 'controller' | 'user_stripping'>('matrix');
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<StaffRole>(currentUser.role);

  // Editable Role Matrix state (defaults to passed customRoleMatrix or ROLE_PERMISSIONS)
  const [editableMatrix, setEditableMatrix] = useState<Record<StaffRole, ERPModuleId[]>>(() => {
    if (customRoleMatrix) return { ...customRoleMatrix };
    const initial: Record<string, ERPModuleId[]> = {};
    ROLES_ORDER.forEach((role) => {
      initial[role] = [...ROLE_PERMISSIONS[role].allowedModules];
    });
    return initial as Record<StaffRole, ERPModuleId[]>;
  });

  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleToggleModuleForRole = (role: StaffRole, moduleId: ERPModuleId) => {
    if (!isAdmin) return;
    setEditableMatrix((prev) => {
      const currentList = prev[role] || [];
      const hasModule = currentList.includes(moduleId);
      const updated = hasModule
        ? currentList.filter((m) => m !== moduleId)
        : [...currentList, moduleId];
      return {
        ...prev,
        [role]: updated,
      };
    });
  };

  const handleSaveModel = async () => {
    if (!onSaveRoleMatrix) return;
    setIsSavingMatrix(true);
    try {
      await onSaveRoleMatrix(editableMatrix);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } finally {
      setIsSavingMatrix(false);
    }
  };

  const handleResetModel = async () => {
    const initial: Record<string, ERPModuleId[]> = {};
    ROLES_ORDER.forEach((role) => {
      initial[role] = [...ROLE_PERMISSIONS[role].allowedModules];
    });
    setEditableMatrix(initial as Record<StaffRole, ERPModuleId[]>);
    if (onResetRoleMatrix) {
      await onResetRoleMatrix();
    }
  };

  const getBadgeStyle = (perm: AccessLevel) => {
    if (perm === 'Full') {
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black';
    }
    if (perm === 'Manage') {
      return 'bg-blue-50 text-blue-800 border-blue-300 font-bold';
    }
    if (perm === 'None') {
      return 'bg-slate-100 text-slate-400 border-slate-200 font-medium';
    }
    if (perm.includes('Own')) {
      return 'bg-purple-50 text-purple-800 border-purple-300 font-bold';
    }
    if (perm.includes('Finance') || perm.includes('Tax')) {
      return 'bg-indigo-50 text-indigo-800 border-indigo-300 font-bold';
    }
    if (perm.includes('KPIs')) {
      return 'bg-cyan-50 text-cyan-800 border-cyan-300 font-bold';
    }
    if (perm.includes('Branch') || perm.includes('Limited') || perm.includes('Read-only')) {
      return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
    }
    return 'bg-amber-50 text-amber-800 border-amber-300 font-bold';
  };

  const handleExportMatrixCSV = () => {
    const headers = ['Module / Function', ...ROLES_ORDER];
    const rows = TARGET_ACCESS_MATRIX.map((m) => [
      m.moduleName,
      ...ROLES_ORDER.map((r) => m.permissions[r]),
    ]);
    exportToCSV('Vaairo_ERP_Access_Control_Matrix', headers, rows);
  };

  const handleExportMatrixPDF = () => {
    exportReportToPDF(
      'Target Access Model & RBAC Boundaries Matrix',
      'AEGIS / VAAIRO 8-Role Security Architecture',
      ['Module / Function', 'Admin', 'Accountant', 'HR', 'Sales Mgr', 'Branch Mgr', 'Inventory', 'Cashier', 'Affiliate'],
      TARGET_ACCESS_MATRIX.map((m) => [
        m.moduleName,
        m.permissions['Admin'],
        m.permissions['Accountant'],
        m.permissions['HR'],
        m.permissions['Sales Manager'],
        m.permissions['Branch Manager'],
        m.permissions['Inventory Controller'],
        m.permissions['Counter Cashier'],
        m.permissions['Affiliate Sales Representative'],
      ]),
      'Vaairo_Access_Model_Matrix'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl overflow-hidden my-auto">
        {/* Header Bar */}
        <div className="px-6 py-4.5 bg-[#0A006E] text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-montserrat font-black text-[#FFDE00] uppercase tracking-wider">
                  AEGIS / VAAIRO Enterprise RBAC
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white">
                  {isAdmin ? 'Admin Controlled Model' : '8-Role Architecture'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-montserrat font-black text-white italic">
                Access Model &amp; Operational Boundaries
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportMatrixPDF}
              className="px-3 py-1.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              PDF Audit
            </button>
            <button
              type="button"
              onClick={handleExportMatrixCSV}
              className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition ${
              activeTab === 'matrix'
                ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                : 'bg-white hover:bg-slate-200 text-slate-700'
            }`}
          >
            Access Matrix Overview
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('controller')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'controller'
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'bg-white hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-[#34D186]" />
                Role Access Model Controller
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('user_stripping')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer transition ${
                  activeTab === 'user_stripping'
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'bg-white hover:bg-slate-200 text-slate-700'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                User Feature Stripping Hub
                {staffList.filter((s) => s.strippedFeatures && s.strippedFeatures.length > 0).length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white">
                    {staffList.filter((s) => s.strippedFeatures && s.strippedFeatures.length > 0).length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50">
          {/* TAB 1: Standard Matrix View */}
          {activeTab === 'matrix' && (
            <>
              {/* Legend Banner */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#0A006E]" />
                    Access Permission Legend
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Strict segregation of duties enforced by cryptographic tokens &amp; Firestore Zero-Trust rules
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                    Full / Unrestricted
                  </span>
                  <span className="px-2.5 py-1 rounded-lg border bg-blue-50 text-blue-800 border-blue-300 font-bold">
                    Manage / Provision
                  </span>
                  <span className="px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-800 border-amber-300 font-bold">
                    Branch / Regional Scope
                  </span>
                  <span className="px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-800 border-indigo-300 font-bold">
                    Finance / Audit Scope
                  </span>
                  <span className="px-2.5 py-1 rounded-lg border bg-purple-50 text-purple-800 border-purple-300 font-bold">
                    Personal Orders Only
                  </span>
                  <span className="px-2.5 py-1 rounded-lg border bg-slate-100 text-slate-400 border-slate-200 font-medium">
                    None (Zero Access)
                  </span>
                </div>
              </div>

              {/* Matrix Table */}
              <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0A006E] text-white font-montserrat">
                      <th className="py-3 px-3.5 font-black sticky left-0 bg-[#0A006E] z-10 min-w-[200px]">
                        Module / Function
                      </th>
                      {ROLES_ORDER.map((role) => (
                        <th
                          key={role}
                          className={`py-3 px-3 font-bold text-center whitespace-nowrap min-w-[110px] ${
                            selectedRoleForDetail === role ? 'bg-indigo-900 text-[#FFDE00]' : ''
                          }`}
                        >
                          {role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {TARGET_ACCESS_MATRIX.map((item, idx) => (
                      <tr key={item.moduleId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-3 px-3.5 font-montserrat font-bold text-slate-900 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                          <div>{item.moduleName}</div>
                          <div className="text-[10px] text-slate-500 font-sans font-normal mt-0.5 line-clamp-1">
                            {item.description}
                          </div>
                        </td>
                        {ROLES_ORDER.map((role) => {
                          const perm = item.permissions[role];
                          return (
                            <td key={role} className="py-2.5 px-2 text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] whitespace-nowrap ${getBadgeStyle(
                                  perm
                                )}`}
                              >
                                {perm}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TAB 2: Admin Interactive Access Model Controller */}
          {activeTab === 'controller' && isAdmin && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-[#34D186]" />
                    Interactive System-Wide Role Access Matrix
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Configure which modules are available to each role across the organization. Changes take effect on user navigation immediately.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetModel}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-montserrat font-bold cursor-pointer transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Factory Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModel}
                    disabled={isSavingMatrix}
                    className={`px-4 py-1.5 rounded-xl text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition ${
                      saveSuccess
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00]'
                    }`}
                  >
                    {saveSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        Model Saved!
                      </>
                    ) : isSavingMatrix ? (
                      'Saving Access Model...'
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Access Model
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Role Matrix Toggle Grid */}
              <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0A006E] text-white font-montserrat">
                      <th className="py-3 px-3.5 font-black sticky left-0 bg-[#0A006E] z-10 min-w-[200px]">
                        ERP Module
                      </th>
                      {ROLES_ORDER.map((role) => (
                        <th key={role} className="py-3 px-2 text-center whitespace-nowrap min-w-[100px]">
                          {role}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ALL_MODULES.map((mod, idx) => (
                      <tr key={mod.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="py-3 px-3.5 font-montserrat font-bold text-slate-900 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                          {mod.label}
                        </td>
                        {ROLES_ORDER.map((role) => {
                          const isAllowed = (editableMatrix[role] || []).includes(mod.id);
                          const isProtectedAdmin = role === 'Admin' && mod.id === 'hr_rbac';

                          return (
                            <td key={role} className="py-2 px-2 text-center">
                              <button
                                type="button"
                                disabled={isProtectedAdmin}
                                onClick={() => handleToggleModuleForRole(role, mod.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-black cursor-pointer transition border ${
                                  isAllowed
                                    ? 'bg-[#34D186]/20 text-[#1E9E60] border-[#34D186]/40 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-300'
                                }`}
                                title={
                                  isProtectedAdmin
                                    ? 'Admin must always retain HR/RBAC access'
                                    : isAllowed
                                    ? `Click to strip ${mod.label} from ${role}`
                                    : `Click to grant ${mod.label} to ${role}`
                                }
                              >
                                {isAllowed ? 'ALLOWED' : 'REVOKED'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: User Feature Stripping Hub */}
          {activeTab === 'user_stripping' && isAdmin && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-montserrat font-black text-[#0A006E] flex items-center gap-1.5">
                    <UserX className="w-4 h-4 text-rose-600" />
                    Individual Staff Feature Stripping &amp; Permissions Hub
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Click any staff member below to selectively strip off specific modules, POS features, pricing overrides, or financial permissions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {staffList.map((s) => {
                  const hasStripped = s.strippedFeatures && s.strippedFeatures.length > 0;
                  const hasGranted = s.grantedFeatures && s.grantedFeatures.length > 0;

                  return (
                    <div
                      key={s.id}
                      className={`p-4 rounded-2xl border bg-white transition hover:shadow-md flex flex-col justify-between gap-3 ${
                        hasStripped ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-montserrat font-black text-xs text-slate-900 truncate">
                            {s.name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0A006E] text-[#FFDE00]">
                            {s.role}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">{s.email}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{s.branchName}</div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {hasStripped ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 font-montserrat font-black text-[10px]">
                              {s.strippedFeatures!.length} Feature{s.strippedFeatures!.length > 1 ? 's' : ''} Stripped
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                              Standard Access
                            </span>
                          )}
                          {hasGranted && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-300 font-montserrat font-black text-[10px]">
                              +{s.grantedFeatures!.length} Custom
                            </span>
                          )}
                        </div>

                        {s.customPermissionsNote && (
                          <div className="text-[10px] text-slate-500 italic mt-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100 line-clamp-2">
                            &ldquo;{s.customPermissionsNote}&rdquo;
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenUserFeatureModal?.(s)}
                        className="w-full py-2 bg-slate-50 hover:bg-[#FFDE00] text-[#0A006E] border border-slate-200 hover:border-[#0A006E] rounded-xl text-xs font-montserrat font-black flex items-center justify-center gap-1.5 cursor-pointer transition"
                      >
                        <Sliders className="w-3.5 h-3.5 text-[#0A006E]" />
                        Manage Feature Access
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-500">
            Current Session: <strong className="text-[#0A006E]">{currentUser.name}</strong> ·{' '}
            <span className="font-bold">{currentUser.role}</span> ({currentUser.branchName})
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-[#0A006E] text-[#FFDE00] rounded-xl text-xs font-montserrat font-black cursor-pointer shadow-md transition hover:bg-[#060046]"
          >
            Acknowledge &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
