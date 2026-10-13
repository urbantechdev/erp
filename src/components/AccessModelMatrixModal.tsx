import React, { useState } from 'react';
import {
  ShieldCheck,
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
} from 'lucide-react';
import { StaffRole, StaffMember, ERPModuleId } from '../types';
import { TARGET_ACCESS_MATRIX, ROLE_DISTINCTIONS, AccessLevel, exportToCSV, exportReportToPDF } from '../erpUtils';

interface AccessModelMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember;
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

export const AccessModelMatrixModal: React.FC<AccessModelMatrixModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<StaffRole>(currentUser.role);

  if (!isOpen) return null;

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
                  8-Role Matrix
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-montserrat font-black text-white italic">
                Target Access Model &amp; Operational Boundaries
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

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50">
          {/* Legend Banner */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#0A006E]" />
                Access Permission Legend
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Active Session: <strong className="text-[#0A006E]">{currentUser.name}</strong> ({currentUser.role})
              </span>
            </div>
            <div className="flex items-center flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-lg border bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                Full = administer
              </span>
              <span className="px-2.5 py-1 rounded-lg border bg-blue-50 text-blue-800 border-blue-300 font-bold">
                Manage = create/update in scope
              </span>
              <span className="px-2.5 py-1 rounded-lg border bg-amber-50 text-amber-800 border-amber-300 font-bold">
                Limited = approved actions
              </span>
              <span className="px-2.5 py-1 rounded-lg border bg-purple-50 text-purple-800 border-purple-300 font-bold">
                Own = own records
              </span>
              <span className="px-2.5 py-1 rounded-lg border bg-slate-100 text-slate-500 border-slate-200 font-medium">
                None = no access
              </span>
              <span className="px-2.5 py-1 rounded-lg border bg-indigo-50 text-indigo-800 border-indigo-300 font-bold">
                Finance / Tax = accounting view
              </span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto bg-white border border-slate-200 rounded-2xl shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0A006E] text-white font-montserrat">
                  <th className="py-3 px-3.5 font-black sticky left-0 bg-[#0A006E] z-10 w-44">
                    Module / function
                  </th>
                  {ROLES_ORDER.map((role) => {
                    const isCurrent = currentUser.role === role;
                    return (
                      <th
                        key={role}
                        onClick={() => setSelectedRoleForDetail(role)}
                        className={`py-3 px-2.5 font-black text-center whitespace-nowrap cursor-pointer transition ${
                          isCurrent ? 'bg-[#FFDE00] text-[#0A006E]' : 'hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {role === 'Sales Manager' ? 'Sales Mgr.' : role === 'Branch Manager' ? 'Branch Mgr.' : role === 'Inventory Controller' ? 'Inventory' : role === 'Counter Cashier' ? 'Cashier' : role === 'Affiliate Sales Representative' ? 'Affiliate' : role}
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#0A006E] shrink-0" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {TARGET_ACCESS_MATRIX.map((item, idx) => (
                  <tr
                    key={item.moduleName}
                    className={idx % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/50 hover:bg-slate-50'}
                  >
                    <td className="py-2.5 px-3.5 font-montserrat font-bold text-slate-900 sticky left-0 bg-white shadow-xs z-10">
                      <div>{item.moduleName}</div>
                      <div className="text-[10px] text-slate-500 font-normal truncate max-w-[180px]">
                        {item.description}
                      </div>
                    </td>
                    {ROLES_ORDER.map((role) => {
                      const perm = item.permissions[role];
                      const isCurrent = currentUser.role === role;
                      return (
                        <td
                          key={role}
                          className={`py-2.5 px-2 text-center whitespace-nowrap ${
                            isCurrent ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border text-[11px] ${getBadgeStyle(
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

          {/* Important Distinctions Callout Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#0A006E]" />
              Architectural Security Distinctions &amp; Boundary Guardrails
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Accountant Card */}
              <div
                onClick={() => setSelectedRoleForDetail('Accountant')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  selectedRoleForDetail === 'Accountant'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Accountant
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                    Financial Oversight
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Financial access does not permit editing inventory, staff, product costs, or transaction histories. Allows approved accounting actions, reconciliation, financial reporting, and credit-note workflows according to policy.
                </p>
              </div>

              {/* HR Card */}
              <div
                onClick={() => setSelectedRoleForDetail('HR')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  selectedRoleForDetail === 'HR'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Human Resources
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                    Personnel &amp; Roles
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Manages employee records, approved role assignments, and payroll calculations. Cannot change financial transaction records or access unrestricted commercial sales data.
                </p>
              </div>

              {/* Branch Manager Card */}
              <div
                onClick={() => setSelectedRoleForDetail('Branch Manager')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  selectedRoleForDetail === 'Branch Manager'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Branch Manager
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    Branch Scoped
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Access is strictly limited to the assigned branch and explicitly assigned business units. Can onboard staff only as Cashiers or Affiliate Reps within their branch.
                </p>
              </div>

              {/* Inventory Controller Card */}
              <div
                onClick={() => setSelectedRoleForDetail('Inventory Controller')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  selectedRoleForDetail === 'Inventory Controller'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Inventory Controller
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Stock &amp; Bonded Warehouses
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Manages stock, batches, expiry, damages, spoilage, barcodes, and transfers according to authorized warehouse scope. Cannot edit sales totals or finalize payroll.
                </p>
              </div>

              {/* Counter Cashier Card */}
              <div
                onClick={() => setSelectedRoleForDetail('Counter Cashier')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  selectedRoleForDetail === 'Counter Cashier'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Counter Cashier
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800">
                    Retail Checkout
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Processes checkout transactions, scans barcodes, issues receipts, and views own shift history. Refunds, voids, and credits require supervisor approval.
                </p>
              </div>

              {/* Affiliate Sales Rep Card */}
              <div
                onClick={() => setSelectedRoleForDetail('Affiliate Sales Representative')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer ${
                  selectedRoleForDetail === 'Affiliate Sales Representative'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Affiliate Sales Rep
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                    Personal Orders Only
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Creates and tracks own permitted sales and orders with approved price catalogue. Cannot access another representative&apos;s customer records or the full customer directory.
                </p>
              </div>

              {/* Admin Card */}
              <div
                onClick={() => setSelectedRoleForDetail('Admin')}
                className={`p-4 rounded-2xl border-2 transition cursor-pointer md:col-span-2 lg:col-span-3 ${
                  selectedRoleForDetail === 'Admin'
                    ? 'border-[#0A006E] bg-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-montserrat font-black text-[#0A006E] uppercase">
                    Executive System Administrator
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFDE00] text-[#0A006E]">
                    Audited Master Access
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Has broad administrative access across all 13 modules, but sensitive actions remain audited in zero-trust logs with Google OAuth session verification and confirmation modals for destructive operations.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="text-xs text-slate-500">
            Current Role: <strong className="text-[#0A006E]">{currentUser.role}</strong> ({currentUser.branchName})
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
