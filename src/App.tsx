import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import {
  LayoutDashboard,
  Store,
  Briefcase,
  Package,
  Building2,
  MapPin,
  Users,
  FileText,
  ShieldCheck,
  UserPlus,
  Activity,
  ShoppingBag,
  LogOut,
  LogIn,
  Wifi,
  RefreshCw,
  CheckCircle2,
  Menu,
  X,
  Wine,
  Globe,
  User,
  Lock,
  AlertTriangle,
  Barcode,
  ChevronRight,
  UtensilsCrossed,
} from 'lucide-react';
import {
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  testFirestoreConnection,
  handleFirestoreError,
  cleanFirestoreData,
  OperationType,
} from './firebase';
import {
  StaffMember,
  Branch,
  GeoRegion,
  Product,
  Partner,
  StockTransfer,
  TransactionDoc,
  ComplianceRecord,
  AuditLog,
  ERPModuleId,
  StaffRole,
  PayrollRun,
  PayrollRecord,
  DamageSpoilageIncident,
  BusinessUnit,
  RestaurantInventoryItem,
} from './types';
import {
  getDeviceFingerprint,
  ROLE_PERMISSIONS,
  MASTER_IMPORTED_INVENTORY,
  formatKes,
  getEffectiveUserModules,
} from './erpUtils';
import {
  ensureOperationalFoundationSeeded,
  NAIROBI_GEO_REGIONS,
  INITIAL_BUSINESS_UNITS,
  INITIAL_RESTAURANT_INVENTORY,
} from './seedData';
import { AuthGateway } from './components/AuthGateway';
import { PosViews } from './components/PosViews';
import { CustomerPortalView } from './components/CustomerPortalView';
import {
  OverviewModule,
  InventoryModule,
  BranchesAndTransfersModule,
  GeoPricingModule,
} from './components/ErpModulesPart1';
import {
  PartnersOnboardingModule,
  DocumentsAndCreditNotesModule,
  ComplianceModule,
  HrAndRbacModule,
  AuditAndSecurityModule,
} from './components/ErpModulesPart2';
import { RestaurantOutletManagement } from './components/RestaurantOutletManagement';
import { DocumentPrintModal } from './components/DocumentPrintModal';
import { ThermalPayslipModal } from './components/ThermalPayslipModal';
import { OnboardItemsModal } from './components/OnboardItemsModal';
import { AccessModelMatrixModal } from './components/AccessModelMatrixModal';
import { UserFeatureAccessModal } from './components/UserFeatureAccessModal';
import { StatusFeedbackToast } from './components/AnimatedFeedback';
import { MobileSplashScreen } from './components/MobileSplashScreen';
import { DesktopBottomNav } from './components/DesktopBottomNav';
import { hashPin, isPinHashed, verifyPin } from './utils/security';

const MODULE_META: Record<
  ERPModuleId,
  { label: string; shortMobileLabel: string; icon: React.ComponentType<{ className?: string }> }
> = {
  overview: { label: 'Executive Overview', shortMobileLabel: 'Overview', icon: LayoutDashboard },
  retail_pos: { label: 'Retail Counter POS', shortMobileLabel: 'Retail POS', icon: Store },
  sales_pos: { label: 'B2B Wholesale & Sales POS', shortMobileLabel: 'Sales POS', icon: Briefcase },
  inventory: { label: 'Inventory & Auto-SKU', shortMobileLabel: 'Inventory', icon: Package },
  branches_transfers: { label: 'Branches & Transfers', shortMobileLabel: 'Branches', icon: Building2 },
  geo_pricing: { label: 'Geo-Location Pricing', shortMobileLabel: 'Geo-Price', icon: MapPin },
  partners: { label: 'Suppliers, Retailers & Logistics', shortMobileLabel: 'Partners', icon: Users },
  documents_credit: { label: 'Docs, Receipts & Credit Notes', shortMobileLabel: 'Docs', icon: FileText },
  compliance: { label: 'Regulatory & Excise Stamps', shortMobileLabel: 'Compliance', icon: ShieldCheck },
  hr_rbac: { label: 'HR & Role Provisioning', shortMobileLabel: 'HR & Roles', icon: UserPlus },
  audit_security: { label: 'User Monitoring & Security Logs', shortMobileLabel: 'Security', icon: Activity },
  customer_portal: { label: 'Customer Online Portal', shortMobileLabel: 'Online Store', icon: ShoppingBag },
  outlets_restaurants: { label: 'Branch Outlets & Restaurants', shortMobileLabel: 'Outlets', icon: UtensilsCrossed },
};

export default function App() {
  // Real-time Firestore state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [regions, setRegions] = useState<GeoRegion[]>(NAIROBI_GEO_REGIONS);
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transactions, setTransactions] = useState<TransactionDoc[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(() => {
    try {
      const saved = localStorage.getItem('erp_business_units');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_BUSINESS_UNITS;
  });
  const [restaurantInventory, setRestaurantInventory] = useState<RestaurantInventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('erp_restaurant_inventory');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_RESTAURANT_INVENTORY;
  });
  const [viewingPayslipRecord, setViewingPayslipRecord] = useState<PayrollRecord | null>(null);

  // Active User Session State
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [standaloneCustomerPortal, setStandaloneCustomerPortal] = useState(false);
  const [activeModule, setActiveModule] = useState<ERPModuleId>('overview');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TransactionDoc | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState(false);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isAccessMatrixOpen, setIsAccessMatrixOpen] = useState(false);
  const [userFeatureModalStaff, setUserFeatureModalStaff] = useState<StaffMember | null>(null);
  const [isUserFeatureModalOpen, setIsUserFeatureModalOpen] = useState(false);
  const [customRoleMatrix, setCustomRoleMatrix] = useState<Record<StaffRole, ERPModuleId[]> | undefined>(() => {
    try {
      const saved = localStorage.getItem('erp_custom_role_matrix');
      if (saved) return JSON.parse(saved);
    } catch {}
    return undefined;
  });
  const isGoogleAuthInProgressRef = useRef(false);
  const [toastStatus, setToastStatus] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const triggerToast = (type: 'success' | 'error', title: string, message: string) => {
    setToastStatus({ type, title, message });
    window.setTimeout(() => {
      setToastStatus((prev) => (prev?.title === title && prev?.message === message ? null : prev));
    }, 4500);
  };

  // Merge the 858+ imported NAIROBI_DRINKS_PRODUCTS catalog with any Firestore overrides or newly created SKUs
  const products = useMemo<Product[]>(() => {
    const overrideMap = new Map<string, Product>();
    firestoreProducts.forEach((p) => {
      overrideMap.set(p.id, p);
    });

    const merged = MASTER_IMPORTED_INVENTORY.map((baseItem) => {
      const override = overrideMap.get(baseItem.id);
      if (override) {
        overrideMap.delete(baseItem.id);
        const isReal = Boolean(override.hasRealBarcode || override.barcode);
        return {
          ...baseItem,
          ...override,
          barcode: override.barcode || (isReal ? baseItem.barcode : undefined),
          caseBarcode: override.caseBarcode || (isReal ? baseItem.caseBarcode : undefined),
          hasRealBarcode: isReal,
        };
      }
      return baseItem;
    });

    // Prepend any brand-new products created via the Auto-SKU generator in Firestore
    const customCreated = Array.from(overrideMap.values()).map((item) => {
      const isReal = Boolean(item.hasRealBarcode || item.barcode);
      return {
        ...item,
        barcode: item.barcode,
        caseBarcode: item.caseBarcode,
        hasRealBarcode: isReal,
      };
    });
    return [...customCreated, ...merged];
  }, [firestoreProducts]);

  // Derive latest finalized payroll record for current user session
  const currentUserLatestPayrollRecord = useMemo<PayrollRecord | null>(() => {
    if (!currentUser || payrollRuns.length === 0) return null;
    for (const run of payrollRuns) {
      try {
        const records: PayrollRecord[] = JSON.parse(run.recordsJson || '[]');
        const match = records.find(
          (r) =>
            r.staffId === currentUser.id ||
            (r.staffEmail && r.staffEmail.toLowerCase() === currentUser.email.toLowerCase())
        );
        if (match) return match;
      } catch {
        // ignore JSON parse error
      }
    }
    return null;
  }, [currentUser, payrollRuns]);

  // Boot connection test & operational seed (with zero staff)
  useEffect(() => {
    testFirestoreConnection();
    ensureOperationalFoundationSeeded();
  }, []);

  // Full Screen helper with iframe and extension safety
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (typeof document === 'undefined') return;
        // If embedded in a preview iframe, skip auto-fullscreen to prevent permissions policy warnings
        const isEmbedded = window.self !== window.top;
        if (isEmbedded) return;

        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        const fsDoc = document as Document & {
          webkitFullscreenElement?: Element | null;
        };

        if (!document.fullscreenElement && !fsDoc.webkitFullscreenElement) {
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen().catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            await docEl.webkitRequestFullscreen();
          } else if (docEl.msRequestFullscreen) {
            await docEl.msRequestFullscreen();
          }
        }
      } catch {
        // Silently catch unsupported environments or blocked gestures
      }
    };

    // Attempt once on user interaction
    const handleUserGesture = () => {
      enterFullscreen();
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('click', handleUserGesture);
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true, once: true });
    window.addEventListener('click', handleUserGesture, { passive: true, once: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('click', handleUserGesture);
    };
  }, []);

  // Attach real-time Firestore listeners
  useEffect(() => {
    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), where('createdAt', '>=', '')),
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as StaffMember), id: d.id }));
        setStaffList(list);
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'staff')
    );

    const unsubBranches = onSnapshot(
      query(collection(db, 'branches'), where('createdAt', '>=', '')),
      (snap) => {
        setBranches(snap.docs.map((d) => ({ ...(d.data() as Branch), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'branches')
    );

    const unsubRegions = onSnapshot(
      query(collection(db, 'geo_regions'), where('createdAt', '>=', '')),
      (snap) => {
        setRegions(snap.docs.map((d) => ({ ...(d.data() as GeoRegion), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'geo_regions')
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('createdAt', '>=', '')),
      (snap) => {
        setFirestoreProducts(snap.docs.map((d) => ({ ...(d.data() as Product), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'products')
    );

    const unsubPartners = onSnapshot(
      query(collection(db, 'partners'), where('createdAt', '>=', '')),
      (snap) => {
        setPartners(snap.docs.map((d) => ({ ...(d.data() as Partner), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'partners')
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'stock_transfers'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        setTransfers(snap.docs.map((d) => ({ ...(d.data() as StockTransfer), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'stock_transfers')
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        setTransactions(snap.docs.map((d) => ({ ...(d.data() as TransactionDoc), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'transactions')
    );

    const unsubCompliance = onSnapshot(
      query(collection(db, 'compliance_records'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        setComplianceRecords(
          snap.docs.map((d) => ({ ...(d.data() as ComplianceRecord), id: d.id }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'compliance_records')
    );

    const unsubAudit = onSnapshot(
      query(collection(db, 'audit_logs'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        setAuditLogs(snap.docs.map((d) => ({ ...(d.data() as AuditLog), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'audit_logs')
    );

    const unsubPayrollRuns = onSnapshot(
      query(collection(db, 'payroll_runs'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        setPayrollRuns(snap.docs.map((d) => ({ ...(d.data() as PayrollRun), id: d.id })));
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'payroll_runs')
    );

    const unsubBusinessUnits = onSnapshot(
      query(collection(db, 'business_units'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as BusinessUnit), id: d.id }));
          setBusinessUnits(list);
          try {
            localStorage.setItem('erp_business_units', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => {
        // Fall back gracefully to local storage when remote collection permissions are restricted
        console.warn('[Firestore] business_units access restricted; using local data:', err?.message || err);
      }
    );

    const unsubRestaurantInventory = onSnapshot(
      query(collection(db, 'restaurant_inventory'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as RestaurantInventoryItem), id: d.id }));
          setRestaurantInventory(list);
          try {
            localStorage.setItem('erp_restaurant_inventory', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => {
        // Fall back gracefully to local storage when remote collection permissions are restricted
        console.warn('[Firestore] restaurant_inventory access restricted; using local data:', err?.message || err);
      }
    );

    return () => {
      unsubStaff();
      unsubBranches();
      unsubRegions();
      unsubProducts();
      unsubPartners();
      unsubTransfers();
      unsubTransactions();
      unsubCompliance();
      unsubAudit();
      unsubPayrollRuns();
      unsubBusinessUnits();
      unsubRestaurantInventory();
    };
  }, []);

  // Helper to write an immutable Audit & Security Log for every action
  const recordAuditLog = async (
    actorName: string,
    actorRole: string,
    actorEmailOrPinId: string,
    action: string,
    moduleName: string,
    details: string,
    branchName?: string,
    severity: AuditLog['severity'] = 'Info'
  ) => {
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: AuditLog = cleanFirestoreData({
      id: logId,
      actorName: actorName || 'System Actor',
      actorRole: actorRole || 'Staff',
      actorEmailOrPinId: actorEmailOrPinId || 'terminal',
      action: action || 'Action',
      module: moduleName || 'General',
      details: (details || '').slice(0, 490),
      deviceFingerprint: getDeviceFingerprint(),
      branchName: branchName || 'Headquarters',
      severity,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'audit_logs', logId), entry);
    } catch (error) {
      console.warn('[AuditLog] Non-critical write error:', error);
    }
  };

  // Helper to persist any product update safely (even if product was only in the imported catalog so far)
  const persistProductState = async (
    productId: string,
    patch: Partial<Product>
  ) => {
    const baseProd =
      products.find((p) => p.id === productId) ||
      MASTER_IMPORTED_INVENTORY.find((p) => p.id === productId) ||
      firestoreProducts.find((p) => p.id === productId);

    const now = new Date().toISOString();
    const docPayload: Product = cleanFirestoreData({
      sku: baseProd?.sku || `SKU-${productId}`,
      name: baseProd?.name || 'Product',
      category: baseProd?.category || 'IPS',
      volumeMl: Number(baseProd?.volumeMl || patch.volumeMl || 750),
      createdAt: (baseProd && baseProd.createdAt) || now,
      ...(baseProd || {}),
      ...patch,
      id: productId,
    });
    await setDoc(doc(db, 'products', productId), docPayload, { merge: true });
  };

  // Google Sign-In strictly for Admin and Accountant
  const handleGoogleLogin = async (targetRole: 'Admin' | 'Accountant') => {
    if (isGoogleAuthInProgressRef.current) return;
    isGoogleAuthInProgressRef.current = true;
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const userEmail = (cred.user.email || '').toLowerCase();
      const userName = cred.user.displayName || userEmail.split('@')[0] || 'Executive Officer';
      const now = new Date().toISOString();
      const device = getDeviceFingerprint();

      // Check if an existing staff profile exists for this email
      const existingStaff = staffList.find((s) => s.email.toLowerCase() === userEmail);

      if (targetRole === 'Admin') {
        const authorizedAdmins = ['zamodasports@gmail.com', 'feminiholdings@gmail.com'];
        if (!authorizedAdmins.includes(userEmail)) {
          const msg = `Access Restricted: ${userEmail} is not authorized as System Administrator. Authorized admins: ${authorizedAdmins.join(', ')}`;
          setAuthError(msg);
          triggerToast('error', 'Unauthorized Admin', msg);
          setIsAuthenticating(false);
          return;
        }
      }

      if (targetRole === 'Accountant') {
        if (!existingStaff || (existingStaff.role !== 'Accountant' && existingStaff.role !== 'Admin')) {
          const anyAccountantExists = staffList.some((s) => s.role === 'Accountant');
          if (!anyAccountantExists && staffList.length === 0) {
            const msg =
              'Zero-Staff Initial State: Please sign in as System Admin first so Admin can create HR, and HR can onboard the Accountant.';
            setAuthError(msg);
            triggerToast('error', 'Accountant Access Locked', msg);
            setIsAuthenticating(false);
            return;
          }
          if (!existingStaff) {
            const msg = `No Accountant record found for ${userEmail}. Ask HR to provision your email as an Accountant in HR & Role Provisioning.`;
            setAuthError(msg);
            triggerToast('error', 'Unprovisioned Accountant', msg);
            setIsAuthenticating(false);
            return;
          }
        }
      }

      if (existingStaff) {
        if (existingStaff.status !== 'Active') {
          const msg = `Your staff account is currently ${existingStaff.status.toLowerCase()}. Access has been restricted by administration.`;
          setAuthError(msg);
          triggerToast('error', 'Account Not Active', msg);
          setIsAuthenticating(false);
          return;
        }
        if (existingStaff.authMethod !== 'google') {
          const msg = `Role "${existingStaff.role}" is restricted to 6-Digit PIN authentication. Only Admin and Accountant use Google Login.`;
          setAuthError(msg);
          triggerToast('error', 'PIN Authentication Required', msg);
          setIsAuthenticating(false);
          return;
        }
        const updated: StaffMember = {
          ...existingStaff,
          lastLoginAt: now,
          lastDevice: device,
        };
        await setDoc(doc(db, 'staff', existingStaff.id), updated);
        setCurrentUser(updated);
        setActiveModule(ROLE_PERMISSIONS[updated.role].allowedModules[0]);
        triggerToast(
          'success',
          `${updated.role} Authenticated`,
          `Welcome back, ${updated.name} (${updated.branchName}).`
        );
        await recordAuditLog(
          updated.name,
          updated.role,
          updated.email,
          'Google OAuth Sign-In',
          'Authentication',
          `Verified Google session for ${updated.role} (${updated.email})`,
          updated.branchName,
          'Security'
        );
      } else {
        // Bootstrap the primary System Admin on first sign-in
        const adminId = 'staff-admin-feminiholdings';
        const defaultBranch = branches[0] || {
          id: 'br-hq-metro',
          name: 'Main Branch (Head Office — Nairobi CBD)',
        };
        const newAdmin: StaffMember = {
          id: adminId,
          name: userName || 'Femini Holdings Admin',
          email: 'feminiholdings@gmail.com',
          role: 'Admin',
          authMethod: 'google',
          branchId: defaultBranch.id,
          branchName: defaultBranch.name,
          status: 'Active',
          createdBy: 'System Bootstrap',
          createdByRole: 'Root',
          lastLoginAt: now,
          lastDevice: device,
          createdAt: now,
        };
        await setDoc(doc(db, 'staff', adminId), newAdmin);
        setCurrentUser(newAdmin);
        setActiveModule('hr_rbac'); // Direct Admin straight to HR creation if fresh
        triggerToast(
          'success',
          'System Admin Initialized',
          `Authenticated ${newAdmin.name} via Google OAuth.`
        );
        await recordAuditLog(
          newAdmin.name,
          'Admin',
          newAdmin.email,
          'Primary Admin Google Bootstrap',
          'Authentication',
          `Initialized primary System Admin (${newAdmin.email}) via Google OAuth`,
          newAdmin.branchName,
          'Security'
        );
      }
    } catch (err: any) {
      const errStr = String(err?.message || err || '');
      console.warn('[Google Auth Error]:', errStr);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        errStr.includes('Pending promise was never set') ||
        errStr.includes('popup was closed')
      ) {
        const msg = 'Google Sign-In was closed or cancelled. You can also sign in via authorized PIN.';
        setAuthError(msg);
        triggerToast('error', 'Sign-In Cancelled', msg);
      } else {
        const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
        setAuthError(msg);
        triggerToast('error', 'Authentication Error', msg);
      }
    } finally {
      isGoogleAuthInProgressRef.current = false;
      setIsAuthenticating(false);
    }
  };

  // 6-Digit PIN Sign-In for all staff (with master PIN 123456 for Admin / Accountant)
  const handlePinLogin = async (
    pin: string,
    selectedRole?: StaffMember['role'],
    selectedStaffId?: string
  ) => {
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      // Master PIN (123456) support for Admin and Accountant
      if (pin === '123456' && (selectedRole === 'Admin' || selectedRole === 'Accountant' || !selectedRole)) {
        const effectiveRole = selectedRole || 'Admin';
        const existing = staffList.find((s) => s.role === effectiveRole && s.status === 'Active');
        const defaultBranch = branches[0] || { id: 'branch-hq-001', name: 'HQ - Main Branch' };
        const now = new Date().toISOString();
        const hashedDefaultPin = await hashPin('123456');
        const fallbackUser: StaffMember = existing || {
          id: effectiveRole === 'Admin' ? 'staff-admin-zamodasports' : 'staff-accountant-default',
          name: effectiveRole === 'Admin' ? 'Executive System Admin' : 'Corporate Head Accountant',
          email: effectiveRole === 'Admin' ? 'zamodasports@gmail.com' : 'accounts@aegisspirits.co.ke',
          role: effectiveRole,
          authMethod: 'pin',
          pin: hashedDefaultPin,
          branchId: defaultBranch.id,
          branchName: defaultBranch.name,
          status: 'Active',
          createdBy: 'System Root',
          createdByRole: 'Root',
          createdAt: now,
          lastLoginAt: now,
          lastDevice: getDeviceFingerprint(),
        };
        setCurrentUser(fallbackUser);
        setActiveModule(ROLE_PERMISSIONS[effectiveRole].allowedModules[0]);
        triggerToast('success', `${effectiveRole} Authenticated`, `Welcome back, ${fallbackUser.name}.`);
        await recordAuditLog(
          fallbackUser.name,
          effectiveRole,
          fallbackUser.email,
          'PIN Terminal Login',
          'Authentication',
          `Authenticated ${effectiveRole} session using secure encrypted PIN`,
          fallbackUser.branchName,
          'Security'
        );
        return;
      }

      // Check candidate staff records by verifying against encrypted PIN hash
      const candidates = selectedStaffId
        ? staffList.filter((s) => s.id === selectedStaffId && s.authMethod === 'pin' && s.status === 'Active')
        : staffList.filter(
            (s) =>
              s.authMethod === 'pin' &&
              s.status === 'Active' &&
              (!selectedRole || s.role === selectedRole)
          );

      let matched: StaffMember | undefined;
      for (const candidate of candidates) {
        if (candidate.pin) {
          const isMatch = await verifyPin(pin, candidate.pin);
          if (isMatch) {
            matched = candidate;
            // Upgrade plaintext PIN to encrypted hash in Firestore if legacy record
            if (!isPinHashed(candidate.pin)) {
              const encrypted = await hashPin(pin);
              setDoc(doc(db, 'staff', candidate.id), { ...candidate, pin: encrypted }, { merge: true }).catch(() => {});
            }
            break;
          }
        }
      }
      if (!matched) {
        const targetedStaff = selectedStaffId
          ? staffList.find((s) => s.id === selectedStaffId)
          : null;
        let msg = '';
        if (targetedStaff && targetedStaff.status !== 'Active') {
          msg = `Staff account for ${targetedStaff.name} is currently ${targetedStaff.status.toLowerCase()}. Access has been revoked.`;
        } else if (targetedStaff) {
          msg = `Incorrect 6-digit PIN entered for ${targetedStaff.name} (${targetedStaff.role}). Please try again.`;
        } else if (selectedRole) {
          msg = `Invalid 6-Digit PIN for ${selectedRole} department, or no active ${selectedRole} provisioned yet.`;
        } else {
          msg = 'Invalid 6-Digit PIN or no PIN staff provisioned yet. Sign in as Admin via Google to create HR first.';
        }
        setAuthError(msg);
        triggerToast('error', 'Authentication Failed', msg);
        await recordAuditLog(
          targetedStaff?.name || 'Unknown Terminal User',
          targetedStaff?.role || selectedRole || 'Unverified PIN',
          targetedStaff?.email || `PINAttempt:${pin.slice(0, 2)}****`,
          'Failed 6-Digit PIN Attempt',
          'Authentication',
          `Rejected invalid 6-digit PIN entry for ${targetedStaff ? `${targetedStaff.name} (${targetedStaff.role})` : selectedRole || 'All'}`,
          targetedStaff?.branchName || 'Terminal Gateway',
          'Critical'
        );
        return;
      }

      const now = new Date().toISOString();
      const device = getDeviceFingerprint();
      const updated: StaffMember = {
        ...matched,
        lastLoginAt: now,
        lastDevice: device,
      };
      await setDoc(doc(db, 'staff', matched.id), updated);
      setCurrentUser(updated);
      const allowed = ROLE_PERMISSIONS[updated.role].allowedModules;
      setActiveModule(allowed[0]);
      triggerToast(
        'success',
        `${updated.role} Unlocked`,
        `Signed in as ${updated.name} at ${updated.branchName}.`
      );

      await recordAuditLog(
        updated.name,
        updated.role,
        `PIN-${updated.id}`,
        '6-Digit PIN Terminal Sign-In',
        'Authentication',
        `Authenticated ${updated.role} at branch ${updated.branchName}`,
        updated.branchName,
        'Security'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      await recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        'User Session Sign-Out',
        'Authentication',
        `Signed out from ${currentUser.role} workspace`,
        currentUser.branchName,
        'Info'
      );
    }
    try {
      await signOut(auth);
    } catch {
      // ignore if PIN session only
    }
    setCurrentUser(null);
    setStandaloneCustomerPortal(false);
  };

  // Keep currentUser in sync with real-time updates to staffList (e.g. when Admin strips a feature)
  useEffect(() => {
    if (!currentUser) return;
    const fresh = staffList.find((s) => s.id === currentUser.id);
    if (fresh) {
      if (
        JSON.stringify(fresh.strippedFeatures) !== JSON.stringify(currentUser.strippedFeatures) ||
        JSON.stringify(fresh.grantedFeatures) !== JSON.stringify(currentUser.grantedFeatures) ||
        fresh.status !== currentUser.status ||
        fresh.role !== currentUser.role
      ) {
        setCurrentUser(fresh);
      }
    }
  }, [staffList, currentUser]);

  // Allowed modules for the currently logged in user (with custom role matrix + stripped features)
  const allowedModules = useMemo<ERPModuleId[]>(() => {
    if (!currentUser) return [];
    return getEffectiveUserModules(currentUser, customRoleMatrix);
  }, [currentUser, customRoleMatrix]);

  // Auto-redirect if activeModule has been stripped or is no longer permitted
  useEffect(() => {
    if (allowedModules.length > 0 && !allowedModules.includes(activeModule)) {
      setActiveModule(allowedModules[0]);
    }
  }, [allowedModules, activeModule]);

  const handleSelectModule = (modId: ERPModuleId) => {
    if (!allowedModules.includes(modId)) return;
    setActiveModule(modId);
    setMobileDrawerOpen(false);
  };

  // Enterprise Access Model Handlers
  const handleSaveRoleMatrix = async (newMatrix: Record<StaffRole, ERPModuleId[]>) => {
    try {
      setCustomRoleMatrix(newMatrix);
      localStorage.setItem('erp_custom_role_matrix', JSON.stringify(newMatrix));
      triggerToast('success', 'Access Model Updated', 'Enterprise role access matrix updated successfully.');
      await recordAuditLog(
        currentUser?.name || 'Admin',
        currentUser?.role || 'Admin',
        currentUser?.email || '',
        'SECURITY_ROLE_MATRIX_UPDATED',
        'Security & RBAC',
        'Admin updated enterprise access model permissions matrix.',
        currentUser?.branchName,
        'Security'
      );
    } catch (err: any) {
      triggerToast('error', 'Update Failed', err.message || 'Could not save access model');
    }
  };

  const handleResetRoleMatrix = async () => {
    try {
      setCustomRoleMatrix(undefined);
      localStorage.removeItem('erp_custom_role_matrix');
      triggerToast('success', 'Access Model Reset', 'Restored default statutory 8-role access baseline matrix.');
      await recordAuditLog(
        currentUser?.name || 'Admin',
        currentUser?.role || 'Admin',
        currentUser?.email || '',
        'SECURITY_ROLE_MATRIX_RESET',
        'Security & RBAC',
        'Admin restored baseline enterprise access model.',
        currentUser?.branchName,
        'Security'
      );
    } catch (err: any) {
      triggerToast('error', 'Reset Failed', err.message || 'Could not reset access model');
    }
  };

  const handleSaveUserPermissions = async (
    staffId: string,
    updates: {
      strippedFeatures: string[];
      grantedFeatures: string[];
      customPermissionsNote?: string;
    }
  ) => {
    try {
      const targetStaff = staffList.find((s) => s.id === staffId);
      const updatedFields: Partial<StaffMember> = {
        strippedFeatures: updates.strippedFeatures,
        grantedFeatures: updates.grantedFeatures,
        customPermissionsNote: updates.customPermissionsNote || '',
        permissionsModifiedAt: new Date().toISOString(),
        permissionsModifiedBy: currentUser?.name || 'Administrator',
      };
      await setDoc(doc(db, 'staff', staffId), cleanFirestoreData(updatedFields), { merge: true });

      setStaffList((prev) =>
        prev.map((s) => (s.id === staffId ? { ...s, ...updatedFields } : s))
      );

      if (currentUser && currentUser.id === staffId) {
        setCurrentUser((prev) => (prev ? { ...prev, ...updatedFields } : null));
      }

      triggerToast(
        'success',
        'Permissions Enforced',
        `Feature access updated for ${targetStaff?.name || 'user'} (${updates.strippedFeatures.length} stripped).`
      );

      await recordAuditLog(
        currentUser?.name || 'Admin',
        currentUser?.role || 'Admin',
        currentUser?.email || '',
        'SECURITY_USER_PERMISSIONS_OVERRIDE',
        'Security & RBAC',
        `Admin modified permissions for ${targetStaff?.name || staffId}: stripped [${updates.strippedFeatures.join(', ')}], granted [${updates.grantedFeatures.join(', ')}]`,
        currentUser?.branchName,
        'Security'
      );
    } catch (err: any) {
      triggerToast('error', 'Permissions Error', err.message || 'Could not update user features');
    }
  };

  // Mutation Handlers with full Firestore persistence & Audit Logging
  const handleCommitTransaction = async (
    txDraft: Omit<TransactionDoc, 'id' | 'createdAt'>,
    updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[]
  ): Promise<TransactionDoc | null> => {
    const id = `tx-${Date.now()}`;
    const fullTx: TransactionDoc = cleanFirestoreData({
      ...txDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'transactions', id), fullTx);
      for (const up of updatedProducts) {
        await persistProductState(up.productId, {
          totalBottles: up.newTotal,
          branchStockSummary: up.newBranchStockJson,
        });
      }
      triggerToast(
        'success',
        `${txDraft.docType} ${txDraft.docNumber} Committed`,
        `${txDraft.customerName} · ${formatKes(txDraft.totalAmount)} recorded.`
      );
      await recordAuditLog(
        txDraft.createdBy,
        txDraft.createdByRole,
        currentUser?.email || 'POS-Terminal',
        `Issued ${txDraft.docType} ${txDraft.docNumber}`,
        txDraft.channel,
        `${txDraft.docType} for ${txDraft.customerName} in ${txDraft.regionName} totaling ${formatKes(txDraft.totalAmount)}`,
        txDraft.branchName,
        'Financial'
      );
      return fullTx;
    } catch (error) {
      triggerToast('error', 'Transaction Failed', 'Could not commit transaction to database.');
      handleFirestoreError(error, OperationType.WRITE, 'transactions');
      return null;
    }
  };

  const handleCreateProduct = async (prodDraft: Omit<Product, 'id' | 'createdAt'>) => {
    const id = `prod-${Date.now()}`;
    const fullProd: Product = cleanFirestoreData({
      ...prodDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'products', id), fullProd);
      triggerToast(
        'success',
        `Auto-SKU ${fullProd.sku} Created`,
        `${fullProd.name} (${fullProd.totalBottles} btls) added to bonded inventory.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Created Auto-SKU ${fullProd.sku}`,
          'Inventory & Auto-SKU',
          `Added ${fullProd.name} (${fullProd.totalBottles} btls) with Excise Series ${fullProd.exciseStampSeries}`,
          currentUser.branchName,
          'Info'
        );
      }
    } catch (error) {
      triggerToast('error', 'SKU Creation Failed', 'Unable to save product to inventory.');
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      setFirestoreProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === productId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...updates };
          return updated;
        } else {
          const baseProd =
            products.find((p) => p.id === productId) ||
            MASTER_IMPORTED_INVENTORY.find((p) => p.id === productId);
          return [{ ...(baseProd || ({} as Product)), ...updates, id: productId }, ...prev];
        }
      });
      await persistProductState(productId, updates);
      triggerToast(
        'success',
        'Product Updated',
        `Updated "${updates.name || 'product'}" specifications & barcode.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Updated Product ${updates.name || productId}`,
          'Inventory & Auto-SKU',
          `Edited product specs & barcode for ${productId}`,
          currentUser.branchName || 'Headquarters',
          'Info'
        );
      }
    } catch (error) {
      console.error('Failed to update product details:', error);
      triggerToast('error', 'Update Failed', 'Unable to update product details.');
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleActivateProductStock = async (
    productId: string,
    branchId: string,
    quantityToAdd: number
  ) => {
    try {
      const prod =
        products.find((p) => p.id === productId) ||
        MASTER_IMPORTED_INVENTORY.find((p) => p.id === productId);
      if (!prod) return { success: false, message: 'Product not found in system.' };

      let branchMap: Record<string, number> = {};
      if (prod.branchStockSummary) {
        try {
          branchMap = JSON.parse(prod.branchStockSummary);
        } catch {}
      }

      const currentBranchQty = branchMap[branchId] || 0;
      const newBranchQty = currentBranchQty + quantityToAdd;
      branchMap[branchId] = newBranchQty;

      const newTotalBottles = (prod.totalBottles || 0) + quantityToAdd;

      const updatedPayload: Partial<Product> = {
        totalBottles: newTotalBottles,
        branchStockSummary: JSON.stringify(branchMap),
        isOnboarded: true,
        status: 'Active',
        onboardedAt: new Date().toISOString(),
        onboardedBy: currentUser?.name || 'Branch Manager',
        onboardedBranchId: branchId,
      };

      await persistProductState(productId, updatedPayload);

      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Activated ${quantityToAdd} btls of ${prod.name}`,
          'Inventory & Stock Onboarding',
          `Branch Manager activated ${quantityToAdd} bottles into available stock for branch ${branchId}.`,
          currentUser.branchName || 'Headquarters',
          'Info'
        );
      }

      return {
        success: true,
        message: `Successfully activated ${quantityToAdd} bottles on available stock.`,
        updatedProduct: { ...prod, ...updatedPayload },
      };
    } catch (err: any) {
      console.error('Stock activation failure:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products');
      return { success: false, message: err?.message || 'Error updating stock in database.' };
    }
  };

  const handleLogStockIncident = async (incident: DamageSpoilageIncident) => {
    try {
      const prod = products.find((p) => p.id === incident.productId);
      if (!prod) return;

      const currentDmg = prod.damagedBottlesCount || 0;
      const currentSpoil = prod.spoiledBottlesCount || 0;
      const newDmg = incident.incidentType === 'DAMAGED' ? currentDmg + incident.quantityBottles : currentDmg;
      const newSpoil = incident.incidentType === 'SPOILED' ? currentSpoil + incident.quantityBottles : currentSpoil;
      const newTotal = Math.max(0, (prod.totalBottles ?? 0) - incident.quantityBottles);

      let updatedBranchSummary = prod.branchStockSummary;
      if (prod.branchStockSummary && incident.branchId) {
        try {
          const map = JSON.parse(prod.branchStockSummary);
          if (map[incident.branchId] !== undefined) {
            map[incident.branchId] = Math.max(0, map[incident.branchId] - incident.quantityBottles);
            updatedBranchSummary = JSON.stringify(map);
          }
        } catch {}
      }

      let incidents: DamageSpoilageIncident[] = [];
      try {
        if (prod.stockIncidentsJson) {
          incidents = JSON.parse(prod.stockIncidentsJson);
        }
      } catch {}
      incidents.unshift(incident);
      if (incidents.length > 50) incidents = incidents.slice(0, 50);

      await handleUpdateProduct(prod.id, {
        totalBottles: newTotal,
        damagedBottlesCount: newDmg,
        spoiledBottlesCount: newSpoil,
        branchStockSummary: updatedBranchSummary,
        stockIncidentsJson: JSON.stringify(incidents),
      });

      triggerToast(
        'success',
        `${incident.incidentType} Stock Recorded`,
        `Quarantined ${incident.quantityBottles} btls of ${incident.sku}. Loss: ${formatKes(incident.lossValueKes)}`
      );

      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Logged ${incident.incidentType} Stock (${incident.sku})`,
          'Inventory & Loss Control',
          `Quarantined ${incident.quantityBottles} btls at ${incident.branchName}. Reason: ${incident.reason}. Loss: ${formatKes(incident.lossValueKes)}`,
          incident.branchName,
          'Financial'
        );
      }
    } catch {
      triggerToast('error', 'Incident Logging Failed', 'Could not record stock incident.');
    }
  };

  const handleCreateBranch = async (branchDraft: Omit<Branch, 'id' | 'createdAt'>) => {
    const id = `br-${Date.now()}`;
    const fullBranch: Branch = cleanFirestoreData({
      ...branchDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'branches', id), fullBranch);
      triggerToast(
        'success',
        `Branch ${fullBranch.code} Commissioned`,
        `${fullBranch.name} activated in ${fullBranch.regionName}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Commissioned Branch ${fullBranch.code}`,
          'Branches & Transfers',
          `Created branch ${fullBranch.name} in Geo-Zone ${fullBranch.regionName}`,
          fullBranch.name,
          'Info'
        );
      }
    } catch (error) {
      triggerToast('error', 'Branch Creation Error', 'Could not save new branch.');
      handleFirestoreError(error, OperationType.WRITE, 'branches');
    }
  };

  const handleDeleteBranch = async (branchId: string) => {
    const branchToDelete = branches.find((b) => b.id === branchId);
    if (!branchToDelete) return;
    if (branchToDelete.isMain || branchToDelete.code === 'BR-HQ-001') {
      triggerToast('error', 'HQ Protected', 'HQ Main Branch cannot be deleted as it is the primary operating depot.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'branches', branchId));
      triggerToast('success', 'Branch Decommissioned', `${branchToDelete.name} (${branchToDelete.code}) has been removed.`);
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Decommissioned Branch ${branchToDelete.code}`,
          'Branches & Transfers',
          `Removed branch ${branchToDelete.name}`,
          branchToDelete.name,
          'Info'
        );
      }
    } catch (error) {
      triggerToast('error', 'Branch Deletion Failed', 'Could not delete branch.');
      handleFirestoreError(error, OperationType.WRITE, 'branches');
    }
  };

  const handleSetMainBranch = async (branchId: string) => {
    try {
      for (const b of branches) {
        await updateDoc(doc(db, 'branches', b.id), {
          isMain: b.id === branchId,
        });
      }
      triggerToast('success', 'Main Branch Updated', 'Selected branch is now designated as the MAIN Headquarters depot.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'branches');
    }
  };

  const handleBatchCreateProducts = async (
    newProducts: Omit<Product, 'id' | 'createdAt'>[]
  ): Promise<number> => {
    let successCount = 0;
    try {
      const now = Date.now();
      for (let i = 0; i < newProducts.length; i++) {
        const prod = newProducts[i];
        const id = `prod-${now}-${i}`;
        const fullProd: Product = cleanFirestoreData({
          ...prod,
          id,
          createdAt: new Date().toISOString(),
        });
        await setDoc(doc(db, 'products', id), fullProd);
        successCount++;
      }
      triggerToast(
        'success',
        'CSV Batch Import Completed',
        `Successfully imported ${successCount} products into bonded inventory.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Bulk Imported ${successCount} SKUs via CSV`,
          'Inventory & Auto-SKU',
          `Imported ${successCount} products with barcodes and prices via CSV file`,
          currentUser.branchName,
          'Info'
        );
      }
    } catch (error) {
      triggerToast('error', 'CSV Import Error', 'Some items could not be saved to database.');
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
    return successCount;
  };

  const handleCreateStockTransfer = async (
    trDraft: Omit<StockTransfer, 'id' | 'createdAt'>,
    updatedProd: { productId: string; newBranchStockJson: string }
  ) => {
    const id = `trf-${Date.now()}`;
    const fullTr: StockTransfer = cleanFirestoreData({
      ...trDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'stock_transfers', id), fullTr);
      await persistProductState(updatedProd.productId, {
        branchStockSummary: updatedProd.newBranchStockJson,
      });
      triggerToast(
        'success',
        `Transfer ${fullTr.transferNo} Dispatched`,
        `${fullTr.quantityBottles} btls of ${fullTr.sku} → ${fullTr.toBranchName}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Stock Transfer ${fullTr.transferNo}`,
          'Branches & Transfers',
          `Transferred ${fullTr.quantityBottles} btls of ${fullTr.sku} from ${fullTr.fromBranchName} to ${fullTr.toBranchName}`,
          fullTr.fromBranchName,
          'Financial'
        );
      }
    } catch (error) {
      triggerToast('error', 'Stock Transfer Error', 'Failed to dispatch inter-branch stock transfer.');
      handleFirestoreError(error, OperationType.WRITE, 'stock_transfers');
    }
  };

  const handleCreateRegion = async (regDraft: Omit<GeoRegion, 'id' | 'createdAt'>) => {
    const id = `reg-${Date.now()}`;
    const fullReg: GeoRegion = cleanFirestoreData({
      ...regDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'geo_regions', id), fullReg);
      triggerToast(
        'success',
        `Geo-Zone ${fullReg.code} Saved`,
        `${fullReg.name} (${fullReg.tierType}) pricing multiplier active.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Created Geo-Pricing Zone ${fullReg.code}`,
          'Geo-Location Pricing',
          `Configured ${fullReg.name} (${fullReg.tierType}) Wholesale ×${fullReg.wholesaleMultiplier}`,
          currentUser.branchName,
          'Financial'
        );
      }
    } catch (error) {
      triggerToast('error', 'Geo-Zone Error', 'Failed to save regional tariff zone.');
      handleFirestoreError(error, OperationType.WRITE, 'geo_regions');
    }
  };

  const handleUpdateProductGeoOverride = async (
    productId: string,
    regionId: string,
    wholesalePrice: number,
    retailPrice: number
  ) => {
    const prod = products.find((p) => p.id === productId);
    const reg = regions.find((r) => r.id === regionId);
    if (!prod || !reg) return;

    let overrides: Record<string, { wholesale: number; retail: number }> = {};
    try {
      overrides = prod.geoPriceOverrides ? JSON.parse(prod.geoPriceOverrides) : {};
    } catch {
      overrides = {};
    }
    overrides[regionId] = { wholesale: wholesalePrice, retail: retailPrice };

    try {
      await persistProductState(productId, {
        geoPriceOverrides: JSON.stringify(overrides),
      });
      triggerToast(
        'success',
        `Geo-Tariff Override Saved`,
        `${prod.sku} in ${reg.name}: Wholesale ${formatKes(wholesalePrice)} · Retail ${formatKes(retailPrice)}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Geo-Tariff Override on ${prod.sku}`,
          'Geo-Location Pricing',
          `Set ${reg.name} price for ${prod.sku} to Wholesale ${formatKes(wholesalePrice)}/btl, Retail ${formatKes(retailPrice)}/btl`,
          currentUser.branchName,
          'Financial'
        );
      }
    } catch (error) {
      triggerToast('error', 'Geo-Override Error', 'Failed to update product regional price.');
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleCreatePartner = async (partDraft: Omit<Partner, 'id' | 'createdAt'>) => {
    const id = `part-${Date.now()}`;
    const fullPartner: Partner = cleanFirestoreData({
      ...partDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'partners', id), fullPartner);
      triggerToast(
        'success',
        `${fullPartner.partnerType} Onboarded`,
        `${fullPartner.companyName} (${fullPartner.code}) verified.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Onboarded ${fullPartner.partnerType} ${fullPartner.code}`,
          'Partners Onboarding',
          `Verified license ${fullPartner.liquorLicenseNo} for ${fullPartner.companyName}`,
          currentUser.branchName,
          'Info'
        );
      }
    } catch (error) {
      triggerToast('error', 'Partner Onboarding Failed', 'Unable to save partner record.');
      handleFirestoreError(error, OperationType.WRITE, 'partners');
    }
  };

  const handleCreateCompliance = async (compDraft: Omit<ComplianceRecord, 'id' | 'createdAt'>) => {
    const id = `comp-${Date.now()}`;
    const fullComp: ComplianceRecord = cleanFirestoreData({
      ...compDraft,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'compliance_records', id), fullComp);
      triggerToast(
        'success',
        `Compliance ${fullComp.certificateNo} Logged`,
        `${fullComp.recordType} verified for SKU ${fullComp.skuRef}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Logged Compliance ${fullComp.certificateNo}`,
          'Regulatory Compliance',
          `${fullComp.recordType} for SKU ${fullComp.skuRef} (${fullComp.stampRangeStart}-${fullComp.stampRangeEnd})`,
          fullComp.branchName,
          'Info'
        );
      }
    } catch (error) {
      triggerToast('error', 'Compliance Log Failed', 'Could not save compliance certificate.');
      handleFirestoreError(error, OperationType.WRITE, 'compliance_records');
    }
  };

  const handleCreateStaff = async (staffDraft: Omit<StaffMember, 'id' | 'createdAt'>) => {
    const id = `staff-${Date.now()}`;
    const encryptedPin = staffDraft.pin
      ? isPinHashed(staffDraft.pin)
        ? staffDraft.pin
        : await hashPin(staffDraft.pin)
      : undefined;
    const fullStaff: StaffMember = cleanFirestoreData({
      ...staffDraft,
      pin: encryptedPin,
      id,
      createdAt: new Date().toISOString(),
    });
    try {
      await setDoc(doc(db, 'staff', id), fullStaff);
      triggerToast(
        'success',
        `${fullStaff.role} Provisioned`,
        `${fullStaff.name} activated at ${fullStaff.branchName}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Provisioned Role: ${fullStaff.role}`,
          'HR & Role Provisioning',
          `${currentUser.role} created ${fullStaff.role} "${fullStaff.name}" (${fullStaff.authMethod.toUpperCase()}) at ${fullStaff.branchName}`,
          currentUser.branchName,
          'Security'
        );
      }
    } catch (error) {
      triggerToast('error', 'Staff Provisioning Error', 'Could not create staff account.');
      handleFirestoreError(error, OperationType.WRITE, 'staff');
    }
  };

  const handleUpdateStaff = async (staffId: string, updates: Partial<StaffMember>) => {
    const existing = staffList.find((s) => s.id === staffId);
    if (!existing) return;
    let encryptedPin = updates.pin !== undefined ? updates.pin : existing.pin;
    if (encryptedPin && !isPinHashed(encryptedPin)) {
      encryptedPin = await hashPin(encryptedPin);
    }
    const fullUpdated: StaffMember = cleanFirestoreData({
      ...existing,
      ...updates,
      pin: encryptedPin,
    });
    try {
      await setDoc(doc(db, 'staff', staffId), fullUpdated);
      triggerToast(
        'success',
        'Staff Profile Updated',
        `Successfully updated account for ${fullUpdated.name}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Updated Staff: ${fullUpdated.name}`,
          'HR & Role Provisioning',
          `${currentUser.name} updated profile of ${fullUpdated.name} (${fullUpdated.role}, Branch: ${fullUpdated.branchName}, Status: ${fullUpdated.status})`,
          currentUser.branchName,
          'Security'
        );
      }
    } catch (error) {
      triggerToast('error', 'Update Failed', 'Could not save staff changes.');
      handleFirestoreError(error, OperationType.WRITE, 'staff');
    }
  };

  const handleSetStaffStatus = async (
    staffId: string,
    newStatus: 'Active' | 'Suspended' | 'Terminated'
  ) => {
    const existing = staffList.find((s) => s.id === staffId);
    if (!existing) return;
    if (existing.id === currentUser?.id && newStatus !== 'Active') {
      triggerToast('error', 'Action Restricted', 'You cannot suspend or terminate your own active account.');
      return;
    }
    const fullUpdated: StaffMember = cleanFirestoreData({
      ...existing,
      status: newStatus,
    });
    try {
      await setDoc(doc(db, 'staff', staffId), fullUpdated);
      const verb = newStatus === 'Suspended' ? 'Suspended' : newStatus === 'Terminated' ? 'Terminated' : 'Re-activated';
      triggerToast('success', `Staff ${verb}`, `${fullUpdated.name} account is now marked as ${newStatus}.`);
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Status Changed: ${newStatus}`,
          'HR & Access Control',
          `${currentUser.name} marked ${fullUpdated.name} (${fullUpdated.role}) as ${newStatus}`,
          currentUser.branchName,
          newStatus === 'Active' ? 'Info' : 'Security'
        );
      }
    } catch (error) {
      triggerToast('error', 'Status Update Error', 'Could not change staff status.');
      handleFirestoreError(error, OperationType.WRITE, 'staff');
    }
  };

  const handleDeleteStaff = async (staffId: string) => {
    const existing = staffList.find((s) => s.id === staffId);
    if (!existing) return;
    if (existing.id === currentUser?.id) {
      triggerToast('error', 'Action Restricted', 'You cannot delete your own active account.');
      return;
    }
    try {
      await deleteDoc(doc(db, 'staff', staffId));
      triggerToast(
        'success',
        'Staff Permanently Deleted',
        `Permanently deleted staff record for ${existing.name}.`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Permanent Staff Deletion: ${existing.name}`,
          'HR & Access Control',
          `${currentUser.name} permanently erased staff record for ${existing.name} (${existing.role}, ID: ${staffId})`,
          currentUser.branchName,
          'Security'
        );
      }
    } catch (error) {
      triggerToast('error', 'Delete Failed', 'Could not delete staff member.');
      handleFirestoreError(error, OperationType.DELETE, 'staff');
    }
  };

  const handleExecutePayrollRun = async (
    runDraft: Omit<PayrollRun, 'id' | 'createdAt'>
  ) => {
    const id = `pr-${Date.now()}`;
    const fullRun: PayrollRun = {
      ...runDraft,
      id,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'payroll_runs', id), fullRun);
      triggerToast(
        'success',
        `Payroll Disbursed (${fullRun.period})`,
        `Finalized ${fullRun.totalEmployees} employee payslips (KES ${fullRun.totalDisbursed.toLocaleString()}).`
      );
      if (currentUser) {
        await recordAuditLog(
          currentUser.name,
          currentUser.role,
          currentUser.email,
          `Executed Payroll Run for ${fullRun.period}`,
          'HR & Access Control',
          `Disbursed net KES ${fullRun.totalDisbursed.toLocaleString()} across ${fullRun.totalEmployees} employees`,
          currentUser.branchName,
          'Financial'
        );
      }
    } catch (err) {
      triggerToast('error', 'Payroll Error', 'Failed to publish payroll disbursement.');
      handleFirestoreError(err, OperationType.WRITE, 'payroll_runs');
    }
  };

  const handleCreateBusinessUnit = async (unitDraft: Omit<BusinessUnit, 'id' | 'createdAt'>) => {
    const id = `bu-${Date.now()}`;
    const newUnit: BusinessUnit = {
      ...unitDraft,
      id,
      createdAt: new Date().toISOString(),
    };
    setBusinessUnits((prev) => {
      const updated = [newUnit, ...prev];
      try {
        localStorage.setItem('erp_business_units', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerToast('success', 'Outlet Created', `Created outlet: ${newUnit.name}`);
    if (currentUser) {
      await recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        `Created Outlet: ${newUnit.name}`,
        'Branch Outlets',
        `Created outlet ${newUnit.name} (${newUnit.unitType}) under branch ${newUnit.branchName}`,
        currentUser.branchName,
        'Info'
      );
    }
    try {
      await setDoc(doc(db, 'business_units', id), newUnit);
    } catch (err) {
      console.warn('[Firestore] Cloud sync for business unit deferred:', err);
    }
  };

  const handleUpdateBusinessUnit = async (unitId: string, updates: Partial<BusinessUnit>) => {
    const existing = businessUnits.find((u) => u.id === unitId);
    const fullUnit: BusinessUnit | null = existing ? { ...existing, ...updates } : null;

    setBusinessUnits((prev) => {
      const updated = prev.map((u) => (u.id === unitId ? { ...u, ...updates } : u));
      try {
        localStorage.setItem('erp_business_units', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerToast('success', 'Outlet Updated', 'Updated sub-business outlet configuration.');
    if (currentUser) {
      await recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        `Updated Sub-Business: ${fullUnit?.name || unitId}`,
        'Branch Outlets',
        `Updated configuration for sub-business outlet ${unitId}`,
        currentUser.branchName,
        'Info'
      );
    }
    try {
      if (fullUnit) {
        await setDoc(doc(db, 'business_units', unitId), fullUnit);
      } else {
        await updateDoc(doc(db, 'business_units', unitId), updates);
      }
    } catch (err) {
      console.warn('[Firestore] Cloud sync for business unit update deferred:', err);
    }
  };

  const handleDeleteBusinessUnit = async (unitId: string) => {
    const target = businessUnits.find((u) => u.id === unitId);
    setBusinessUnits((prev) => {
      const updated = prev.filter((u) => u.id !== unitId);
      try {
        localStorage.setItem('erp_business_units', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    // Unassign staff members from this deleted sub-business
    setStaffList((prev) => {
      const updated = prev.map((s) => (s.businessUnitId === unitId ? { ...s, businessUnitId: '', businessUnitName: '' } : s));
      try {
        localStorage.setItem('erp_staff_list', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerToast('success', 'Sub-Business Deleted', `Deleted sub-business: ${target?.name || unitId}`);
    if (currentUser) {
      await recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        `Deleted Sub-Business: ${target?.name || unitId}`,
        'Branch Outlets',
        `Deleted sub-business outlet record ID ${unitId}`,
        currentUser.branchName,
        'Security'
      );
    }
    try {
      await deleteDoc(doc(db, 'business_units', unitId));
    } catch (err) {
      console.warn('[Firestore] Cloud sync for business unit delete deferred:', err);
    }
  };

  const handleCreateRestaurantItem = async (itemDraft: Omit<RestaurantInventoryItem, 'id' | 'createdAt'>) => {
    const id = `ri-${Date.now()}`;
    const newItem: RestaurantInventoryItem = {
      ...itemDraft,
      id,
      createdAt: new Date().toISOString(),
    };
    setRestaurantInventory((prev) => {
      const updated = [newItem, ...prev];
      try {
        localStorage.setItem('erp_restaurant_inventory', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerToast('success', 'Menu Item Added', `Added ${newItem.name} to kitchen/pantry.`);
    if (currentUser) {
      await recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        `Added Restaurant Item: ${newItem.name}`,
        'Branch Outlets',
        `Added menu/pantry item ${newItem.name} (${newItem.portionUnit}) at KES ${newItem.sellingPriceKes}`,
        currentUser.branchName,
        'Info'
      );
    }
    try {
      await setDoc(doc(db, 'restaurant_inventory', id), newItem);
    } catch (err) {
      console.warn('[Firestore] Cloud sync for restaurant item deferred:', err);
    }
  };

  const handleUpdateRestaurantItem = async (itemId: string, updates: Partial<RestaurantInventoryItem>) => {
    setRestaurantInventory((prev) => {
      const updated = prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item));
      try {
        localStorage.setItem('erp_restaurant_inventory', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerToast('success', 'Item Updated', 'Updated restaurant item.');
    try {
      await updateDoc(doc(db, 'restaurant_inventory', itemId), updates);
    } catch (err) {
      console.warn('[Firestore] Cloud sync for restaurant item update deferred:', err);
    }
  };

  const handleDeleteRestaurantItem = async (itemId: string) => {
    setRestaurantInventory((prev) => {
      const updated = prev.filter((item) => item.id !== itemId);
      try {
        localStorage.setItem('erp_restaurant_inventory', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    triggerToast('success', 'Item Removed', 'Deleted restaurant inventory item.');
    if (currentUser) {
      await recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        `Deleted Restaurant Item: ${itemId}`,
        'Branch Outlets',
        `Removed menu/pantry item ID ${itemId}`,
        currentUser.branchName,
        'Security'
      );
    }
    try {
      await deleteDoc(doc(db, 'restaurant_inventory', itemId));
    } catch (err) {
      console.warn('[Firestore] Cloud sync for restaurant item delete deferred:', err);
    }
  };

  const handleUpdatePartner = async (partnerId: string, updates: Partial<Partner>) => {
    const existing = partners.find((p) => p.id === partnerId);
    if (!existing) return;
    const fullUpdated: Partner = { ...existing, ...updates };
    try {
      await setDoc(doc(db, 'partners', partnerId), fullUpdated);
      triggerToast('success', 'Partner Updated', `Updated trade partner ${fullUpdated.companyName}.`);
    } catch (error) {
      triggerToast('error', 'Partner Update Failed', 'Unable to update partner record.');
      handleFirestoreError(error, OperationType.WRITE, 'partners');
    }
  };

  const handleDeletePartner = async (partnerId: string) => {
    const existing = partners.find((p) => p.id === partnerId);
    try {
      await deleteDoc(doc(db, 'partners', partnerId));
      triggerToast('success', 'Partner Deleted', `Permanently deleted partner ${existing?.companyName || partnerId}.`);
    } catch (error) {
      triggerToast('error', 'Partner Delete Failed', 'Unable to delete partner record.');
      handleFirestoreError(error, OperationType.DELETE, 'partners');
    }
  };

  if (!currentUser && standaloneCustomerPortal) {
    return (
      <>
        <MobileSplashScreen />
        <StatusFeedbackToast status={toastStatus} onDismiss={() => setToastStatus(null)} />
        <CustomerPortalView
          products={products}
          branches={branches}
          regions={regions}
          onPlaceOnlineOrder={(draft) => handleCommitTransaction(draft, [])}
          onPreviewDoc={(d) => setPreviewDoc(d)}
          onBackToErpLogin={() => setStandaloneCustomerPortal(false)}
          isStandalonePortal={true}
        />
        <DocumentPrintModal docData={previewDoc} onClose={() => setPreviewDoc(null)} />
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <MobileSplashScreen />
        <StatusFeedbackToast status={toastStatus} onDismiss={() => setToastStatus(null)} />
        <AuthGateway
          staffList={staffList}
          branches={branches}
          onGoogleLogin={handleGoogleLogin}
          onPinLogin={handlePinLogin}
          onOpenCustomerPortal={() => setStandaloneCustomerPortal(true)}
          authError={authError}
          isSubmitting={isAuthenticating}
        />
      </>
    );
  }

  // Mobile Bottom Bar primary 4 modules + Drawer trigger
  const primaryMobileModules = allowedModules.slice(0, 4);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      <MobileSplashScreen />
      <StatusFeedbackToast status={toastStatus} onDismiss={() => setToastStatus(null)} />
      {/* VAAIRO Signature Deep Navy Header (2x Height) with Curved Single-Wave Bottom Edge */}
      <header className="sticky top-0 z-30 pt-5 pb-12 px-4 sm:px-6 bg-[#0A006E] text-white flex items-center justify-between gap-8 relative overflow-hidden shadow-lg">
        <div className="silent-scanner-beam" />
        {/* Zone 1: VAAIRO Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleSelectModule(allowedModules[0]);
          }}
          className="flex items-center gap-3.5 relative z-10 whitespace-nowrap shrink-0"
        >
          <div className="w-13 h-13 rounded-2xl bg-white text-[#0A006E] flex items-center justify-center shadow-md border-2 border-white">
            <Wine className="w-7 h-7 stroke-[2.5]" />
          </div>
          <span className="font-montserrat font-black italic text-2xl sm:text-3xl lg:text-4xl tracking-tighter text-white">
            VAAIRO <span className="text-[#FFDE00] not-italic text-xs sm:text-sm font-black px-2.5 py-0.5 bg-white/10 rounded-xl ml-1.5 align-middle">ERP</span>
          </span>
        </a>

        {/* Mobile Header: Hamburger Button - White Background */}
        <div className="flex sm:hidden items-center shrink-0 relative z-10">
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="w-11 h-11 rounded-2xl flex items-center justify-center bg-white text-[#0A006E] border-2 border-white shadow-md cursor-pointer transition active:scale-95"
            title={mobileDrawerOpen ? 'Close Menu' : 'Open Navigation Menu'}
            aria-label={mobileDrawerOpen ? 'Close Menu' : 'Open Navigation Menu'}
          >
            {mobileDrawerOpen ? (
              <X className="w-6 h-6 stroke-[2.5]" />
            ) : (
              <Menu className="w-6 h-6 stroke-[2.5]" />
            )}
          </button>
        </div>

        {/* Desktop Header: Header Right Action Icons (White Background) */}
        <div className="hidden sm:flex items-center gap-2.5 sm:gap-3.5 shrink-0 relative z-10">
          {/* 1. Website for client icon */}
          <button
            type="button"
            onClick={() =>
              activeModule === 'customer_portal'
                ? handleSelectModule('overview')
                : handleSelectModule('customer_portal')
            }
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-white text-[#0A006E] hover:bg-slate-100 border-white"
            title="Client Website / Customer Portal"
            aria-label="Client Website / Customer Portal"
          >
            <Globe className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Client Website
            </span>
          </button>

          {/* 1.5 Target Access Model Matrix button */}
          <button
            type="button"
            onClick={() => setIsAccessMatrixOpen(true)}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-[#FFDE00] text-[#0A006E] hover:bg-amber-400 border-white"
            title="Target Access Model & 8-Role RBAC Boundaries"
            aria-label="Target Access Model & RBAC Boundaries"
          >
            <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.4]" />
            <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Access Model (8 Roles)
            </span>
          </button>

          {/* 2. User icon */}
          <button
            type="button"
            onClick={() => setShowUserProfileModal(!showUserProfileModal)}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-white text-[#0A006E] hover:bg-slate-100 border-white"
            title={`${currentUser.name} (${currentUser.role})`}
            aria-label="User Profile"
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              {currentUser.name} ({currentUser.role})
            </span>
          </button>

          {/* 3. Lock icon */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-all cursor-pointer shadow-md relative group bg-white text-[#0A006E] hover:text-rose-600 hover:bg-rose-50 border-white"
            title="Lock Terminal / Sign Out"
            aria-label="Lock Terminal / Sign Out"
          >
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" />
            <span className="absolute -bottom-9 right-0 hidden group-hover:block bg-slate-900 text-white text-[11px] font-montserrat font-bold py-1 px-2.5 rounded-lg whitespace-nowrap shadow-lg z-50 pointer-events-none">
              Lock Terminal
            </span>
          </button>
        </div>

        {/* Single Smooth Curved Wave Bottom Edge */}
        <svg
          className="absolute bottom-0 left-0 w-full h-9 sm:h-11 pointer-events-none block"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
        >
          <path
            d="M0,25 C480,85 960,-15 1440,45 L1440,80 L0,80 Z"
            fill="#FFFFFF"
          />
          <path
            d="M0,25 C480,85 960,-15 1440,45"
            fill="none"
            stroke="#FFDE00"
            strokeWidth="5"
          />
        </svg>
      </header>

      {/* Mobile Full-Screen Hamburger Drawer (Consolidates Client Website, User Profile, Lock Terminal, & All ERP Modules) */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden animate-in fade-in sm:hidden"
        >
          {/* Mobile Drawer Header */}
          <div className="bg-[#0A006E] text-white p-4 flex items-center justify-between border-b-2 border-[#FFDE00] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md border border-white">
                <Wine className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <div className="font-montserrat font-black italic text-lg text-white leading-tight">
                  VAAIRO <span className="text-[#FFDE00] not-italic text-xs font-black">ERP</span>
                </div>
                <div className="text-[10px] text-slate-300 font-medium">Operations Command & System Menu</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-[#FFDE00] hover:text-[#0A006E] text-white flex items-center justify-center cursor-pointer transition active:scale-95"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* 1. User Profile & Live Activity Status Card */}
            <div className="bg-[#0A006E]/5 border-2 border-[#0A006E]/20 rounded-2xl p-4 space-y-3.5 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-13 h-13 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-lg border-2 border-white shadow-md shrink-0">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-montserrat font-black text-slate-900 text-base leading-tight truncate">
                    {currentUser.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-[#0A006E] text-[#FFDE00] font-montserrat uppercase tracking-wider">
                      {currentUser.role}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-bold truncate">
                      {currentUser.branchName}
                    </span>
                  </div>
                </div>
              </div>

              {/* User Account Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Email:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[190px]">{currentUser.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Authentication:</span>
                  <span className="font-bold text-[#0A006E] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {currentUser.authMethod === 'google' ? 'Google OAuth 2.0' : 'Encrypted 6-Digit PIN'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Branch Depot:</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[170px]">{currentUser.branchName}</span>
                </div>
              </div>

              {/* Live Activity Status Section (Moved Inside Hamburger for Mobile) */}
              <div className="bg-[#F0F2F0] border border-slate-300/80 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#0A006E]" />
                    Live Activity Status
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online &amp; Active
                  </span>
                </div>

                <div className="space-y-1 pt-0.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1">
                      <Wifi className="w-3 h-3 text-emerald-600" />
                      Cloud Firestore Sync:
                    </span>
                    <span className="font-bold text-emerald-700">Real-Time Active</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#0A006E]" />
                      Session Security:
                    </span>
                    <span className="font-bold text-slate-800">Encrypted Token</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Active Device:</span>
                    <span className="font-mono text-[10px] text-slate-700 truncate max-w-[160px]">
                      {currentUser.lastDevice || 'Mobile Browser Terminal'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Authentication Actions: Lock Terminal / Logout & Switch User / Login */}
            <div className="space-y-2">
              <div className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider px-1">
                Terminal Access &amp; Authentication
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {/* Logout / Lock Terminal Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    handleLogout();
                  }}
                  className="p-3 rounded-2xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-900 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
                >
                  <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
                    <Lock className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-xs font-montserrat font-black leading-tight text-rose-900">
                    Lock Terminal
                  </span>
                  <span className="text-[10px] text-rose-700 font-medium">Log out securely</span>
                </button>

                {/* Login as Alternate Staff / Switch Account */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileDrawerOpen(false);
                    handleLogout();
                  }}
                  className="p-3 rounded-2xl border-2 border-[#0A006E] bg-white hover:bg-[#FFDE00]/15 active:bg-[#FFDE00]/30 text-[#0A006E] flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer transition shadow-xs active:scale-95"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                    <LogIn className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span className="text-xs font-montserrat font-black leading-tight text-[#0A006E]">
                    Switch Account
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">Login alternate staff</span>
                </button>
              </div>

              {/* Client Website / Customer Store Shortcut */}
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  if (activeModule === 'customer_portal') {
                    handleSelectModule('overview');
                  } else {
                    handleSelectModule('customer_portal');
                  }
                }}
                className={`w-full p-3 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition shadow-xs active:scale-98 ${
                  activeModule === 'customer_portal'
                    ? 'bg-[#FFDE00] border-[#0A006E] text-[#0A006E]'
                    : 'bg-white border-slate-200 hover:border-[#0A006E] text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                    <Globe className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-montserrat font-black leading-tight text-slate-900">
                      {activeModule === 'customer_portal' ? 'Return to ERP Operations' : 'Client Website & Store'}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {activeModule === 'customer_portal' ? 'Back to dashboard' : 'Browse public customer catalog'}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>

              {/* Manage HR Staff Shortcut for Admins */}
              {allowedModules.includes('hr_rbac') && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectModule('hr_rbac');
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full p-3 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#0A006E] flex items-center justify-between cursor-pointer transition shadow-xs active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-xs">
                      <UserPlus className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-montserrat font-black leading-tight text-slate-900">
                        Manage HR &amp; Staff Roles
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Provision employees, commissions &amp; payroll
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              )}

              {/* View Target Access Model (8 Roles) */}
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setIsAccessMatrixOpen(true);
                }}
                className="w-full p-3 rounded-2xl border-2 border-[#0A006E] bg-[#FFDE00]/15 hover:bg-[#FFDE00]/30 flex items-center justify-between cursor-pointer transition shadow-xs active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                    <ShieldCheck className="w-5 h-5 stroke-[2.4]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-montserrat font-black leading-tight text-[#0A006E]">
                      Target Access Model Matrix
                    </div>
                    <div className="text-[10px] text-slate-600">
                      8-Role security boundaries &amp; permissions
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#0A006E]" />
              </button>
            </div>

            {/* Quick Action: Onboard Items & Barcode Scanner for Branch Managers & Admin */}
            {(currentUser.role === 'Branch Manager' || currentUser.role === 'Admin' || currentUser.role === 'Inventory Controller') && (
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setIsOnboardModalOpen(true);
                }}
                className="w-full p-3 rounded-2xl bg-[#34D186] hover:bg-[#28B873] active:bg-[#209A5F] text-[#0A006E] border-2 border-[#0A006E] flex items-center justify-between cursor-pointer shadow-md transition active:scale-98"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-xs">
                    <Barcode className="w-5 h-5 stroke-[2.4]" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-montserrat font-black leading-tight text-[#0A006E]">
                      Onboard Items &amp; Barcode Scanner
                    </div>
                    <div className="text-[10px] text-slate-900 font-medium">
                      Activate available stock &amp; branch assets
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#0A006E]" />
              </button>
            )}

            {/* 3. All ERP Modules Navigation Inside Hamburger */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider px-1">
                Authorized ERP Navigation Modules ({allowedModules.length})
              </div>
              <div className="space-y-1.5">
                {allowedModules.map((modId) => {
                  const IconComp = MODULE_META[modId].icon;
                  const isActive = activeModule === modId;
                  return (
                    <button
                      key={modId}
                      type="button"
                      onClick={() => {
                        handleSelectModule(modId);
                        setMobileDrawerOpen(false);
                      }}
                      className={`w-full p-3 rounded-2xl flex items-center gap-3.5 border-2 text-left cursor-pointer transition ${
                        isActive
                          ? 'bg-[#0A006E] border-[#0A006E] text-white shadow-md'
                          : 'bg-white border-slate-200 hover:border-[#0A006E] text-slate-800'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-[#FFDE00] text-[#0A006E]'
                            : 'bg-[#F0F2F0] text-[#0A006E]'
                        }`}
                      >
                        <IconComp className="w-5 h-5 stroke-[2.2]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-montserrat font-black truncate ${
                          isActive ? 'text-white' : 'text-slate-900'
                        }`}>
                          {MODULE_META[modId].label}
                        </div>
                        <div className={`text-[10px] truncate ${
                          isActive ? 'text-[#FFDE00]' : 'text-slate-500'
                        }`}>
                          {modId === 'overview'
                            ? 'Operations & Real-Time KPIs'
                            : modId === 'retail_pos'
                            ? 'Customer Counter Checkout'
                            : modId === 'sales_pos'
                            ? 'B2B Wholesale Invoicing'
                            : modId === 'inventory'
                            ? 'IPS & LPS Stock Valuation'
                            : modId === 'branches_transfers'
                            ? 'Inter-Depot Stock Transfers'
                            : modId === 'geo_pricing'
                            ? 'Zone Pricing & Currency'
                            : modId === 'partners'
                            ? 'Suppliers & Retail Partners'
                            : modId === 'documents_credit'
                            ? 'Official Invoices & Credit Notes'
                            : modId === 'compliance'
                            ? 'KRA eTIMS & Excise Audit'
                            : modId === 'hr_rbac'
                            ? 'Staff Roles & Payroll Run'
                            : modId === 'audit_security'
                            ? 'Security Logs & Device Trace'
                            : 'Client Shopping Catalog'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Flyout Modal (Full-Screen on Mobile) */}
      {showUserProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center sm:items-start justify-center sm:justify-end p-0 sm:p-4 sm:pt-24 sm:pr-8 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-none sm:rounded-3xl border-0 sm:border-2 border-[#0A006E] shadow-2xl max-w-none sm:max-w-sm w-full h-full sm:h-auto p-5 sm:p-6 space-y-4 animate-scale-in flex flex-col justify-between sm:justify-start overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-montserrat font-black text-sm border-2 border-white shadow-sm">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-montserrat font-black text-slate-900 text-sm leading-tight">
                    {currentUser.name}
                  </h4>
                  <span className="text-xs font-bold text-[#0A006E] font-montserrat">
                    {currentUser.role}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUserProfileModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="Close Profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#F0F2F0] border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Corporate Email:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[180px]">{currentUser.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Branch Depot:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[180px]">{currentUser.branchName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Auth Mode:</span>
                <span className="font-bold text-[#0A006E]">
                  {currentUser.authMethod === 'google' ? 'Google OAuth' : 'Encrypted 6-Digit PIN'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Account Status:</span>
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#34D186]/20 text-[#1E9E60] border border-[#34D186]/40">
                  {currentUser.status}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[11px] text-slate-500">
                <span>Active Session Device:</span>
                <span className="font-mono truncate max-w-[150px]">{currentUser.lastDevice || 'Terminal'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              {allowedModules.includes('hr_rbac') && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectModule('hr_rbac');
                    setShowUserProfileModal(false);
                  }}
                  className="flex-1 py-2.5 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] font-montserrat font-black text-xs rounded-xl cursor-pointer shadow-xs transition-colors"
                >
                  Manage HR Staff
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowUserProfileModal(false);
                  handleLogout();
                }}
                className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 font-montserrat font-bold text-xs rounded-xl cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                Lock Terminal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Body: VAAIRO Desktop Left Sidebar + Main Content Canvas */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar Navigation (Bright Grey #F0F2F0 Background with Big Icons) */}
        <aside className="hidden md:flex w-72 shrink-0 bg-[#F0F2F0] text-slate-900 flex-col justify-between p-4 border-r border-slate-300 relative overflow-hidden">
          <div className="space-y-4 relative z-10">
            {/* Active Role & Branch Summary Box */}
            <div className="p-4 rounded-2xl bg-white border-2 border-[#0A006E]/15 shadow-xs space-y-1">
              <div className="text-[11px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider">
                {currentUser.role}
              </div>
              <div className="text-sm font-montserrat font-black text-[#0A006E] truncate">
                {currentUser.name}
              </div>
              <div className="text-xs text-slate-600 font-semibold truncate">
                {currentUser.branchName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono-tabular pt-1">
                Auth: {currentUser.authMethod === 'google' ? 'Google OAuth' : '6-Digit PIN'} · {products.length} SKUs
              </div>
            </div>

            {/* Role-Filtered Navigation Links with Big Icons */}
            <div className="space-y-2">
              <div className="px-2.5 text-[10px] font-montserrat font-black text-[#0A006E] uppercase tracking-wider mb-1">
                Authorized ERP Modules ({allowedModules.length})
              </div>
              {allowedModules.map((modId) => {
                const IconComp = MODULE_META[modId].icon;
                const isActive = activeModule === modId;
                return (
                  <button
                    key={modId}
                    onClick={() => handleSelectModule(modId)}
                    className={`group w-full min-h-[54px] px-3 py-2 rounded-2xl text-xs font-montserrat flex items-center gap-3.5 transition-all cursor-pointer whitespace-nowrap border-2 ${
                      isActive
                        ? 'bg-[#0A006E] text-white border-[#0A006E] font-black shadow-lg'
                        : 'bg-white text-slate-800 border-slate-200 hover:border-[#0A006E] hover:bg-[#FFDE00]/30 font-bold shadow-2xs'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                        isActive
                          ? 'bg-[#FFDE00] text-[#0A006E] shadow-xs'
                          : 'bg-[#F0F2F0] text-[#0A006E] group-hover:bg-[#0A006E] group-hover:text-[#FFDE00]'
                      }`}
                    >
                      <IconComp className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <span className="truncate text-xs sm:text-[13px]">
                      {MODULE_META[modId].label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Target Access Model Matrix Button */}
            <button
              type="button"
              onClick={() => setIsAccessMatrixOpen(true)}
              className="w-full min-h-[46px] px-3 py-2 rounded-2xl text-xs font-montserrat flex items-center gap-3 transition-all cursor-pointer whitespace-nowrap border-2 border-[#0A006E] bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] font-black shadow-xs mt-3"
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#0A006E] text-[#FFDE00]">
                <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
              </div>
              <span className="truncate text-xs">
                Access Model Matrix
              </span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-[11px] text-slate-600 space-y-1 relative z-10 mt-4">
            <div className="font-montserrat font-black text-[#0A006E]">Device Telemetry Active</div>
            <div className="font-mono-tabular text-[10px] truncate">
              {getDeviceFingerprint()}
            </div>
          </div>
        </aside>

        {/* Main Content Area (Vast White Background #FFFFFF with Bright Grey #F0F2F0 Blocks) */}
        <main className="flex-1 bg-white p-4 sm:p-6 lg:p-8 pb-32 md:pb-16 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeModule === 'overview' && (
            <OverviewModule
              currentUser={currentUser}
              products={products}
              branches={branches}
              regions={regions}
              partners={partners}
              transactions={transactions}
              transfers={transfers}
              staffList={staffList}
              latestPayrollRecord={currentUserLatestPayrollRecord}
              payrollRuns={payrollRuns}
              onOpenPayslip={(record) => setViewingPayslipRecord(record)}
              onPreviewDoc={(d) => setPreviewDoc(d)}
              onOpenOnboardItems={() => setIsOnboardModalOpen(true)}
              onNavigateModule={handleSelectModule}
            />
          )}

          {activeModule === 'retail_pos' && (
            <PosViews
              mode="retail"
              currentUser={currentUser}
              products={products}
              branches={branches}
              regions={regions}
              partners={partners}
              businessUnits={businessUnits}
              restaurantInventory={restaurantInventory}
              onCommitTransaction={handleCommitTransaction}
              onPreviewDoc={(d) => setPreviewDoc(d)}
              onUpdateRestaurantItem={handleUpdateRestaurantItem}
            />
          )}

          {activeModule === 'sales_pos' && (
            <PosViews
              mode="wholesale"
              currentUser={currentUser}
              products={products}
              branches={branches}
              regions={regions}
              partners={partners}
              businessUnits={businessUnits}
              restaurantInventory={restaurantInventory}
              onCommitTransaction={handleCommitTransaction}
              onPreviewDoc={(d) => setPreviewDoc(d)}
              onUpdateRestaurantItem={handleUpdateRestaurantItem}
            />
          )}

          {activeModule === 'inventory' && (
            <InventoryModule
              currentUser={currentUser}
              products={products}
              branches={branches}
              onCreateProduct={handleCreateProduct}
              onBatchCreateProducts={handleBatchCreateProducts}
              onUpdateProduct={handleUpdateProduct}
              onLogStockIncident={handleLogStockIncident}
              onOpenOnboardItems={() => setIsOnboardModalOpen(true)}
            />
          )}

          {activeModule === 'branches_transfers' && (
            <BranchesAndTransfersModule
              currentUser={currentUser}
              branches={branches}
              regions={regions}
              products={products}
              partners={partners}
              transfers={transfers}
              onCreateBranch={handleCreateBranch}
              onDeleteBranch={handleDeleteBranch}
              onSetMainBranch={handleSetMainBranch}
              onCreateStockTransfer={handleCreateStockTransfer}
            />
          )}

          {activeModule === 'geo_pricing' && (
            <GeoPricingModule
              currentUser={currentUser}
              regions={regions}
              products={products}
              onCreateRegion={handleCreateRegion}
              onUpdateProductGeoOverride={handleUpdateProductGeoOverride}
            />
          )}

          {activeModule === 'partners' && (
            <PartnersOnboardingModule
              currentUser={currentUser}
              partners={partners}
              regions={regions}
              onCreatePartner={handleCreatePartner}
              onUpdatePartner={handleUpdatePartner}
              onDeletePartner={handleDeletePartner}
            />
          )}

          {activeModule === 'documents_credit' && (
            <DocumentsAndCreditNotesModule
              currentUser={currentUser}
              transactions={transactions}
              branches={branches}
              regions={regions}
              products={products}
              onIssueCreditNote={(cn) => handleCommitTransaction(cn, [])}
              onPreviewDoc={(d) => setPreviewDoc(d)}
            />
          )}

          {activeModule === 'compliance' && (
            <ComplianceModule
              currentUser={currentUser}
              records={complianceRecords}
              branches={branches}
              products={products}
              onCreateCompliance={handleCreateCompliance}
            />
          )}

          {activeModule === 'hr_rbac' && (
            <HrAndRbacModule
              currentUser={currentUser}
              staffList={staffList}
              branches={branches}
              payrollRuns={payrollRuns}
              onCreateStaff={handleCreateStaff}
              onUpdateStaff={handleUpdateStaff}
              onSetStaffStatus={handleSetStaffStatus}
              onDeleteStaff={handleDeleteStaff}
              onExecutePayrollRun={handleExecutePayrollRun}
              onOpenPayslip={(record) => setViewingPayslipRecord(record)}
              onOpenAccessMatrix={() => setIsAccessMatrixOpen(true)}
              onOpenUserFeatureModal={(staff) => {
                setUserFeatureModalStaff(staff);
                setIsUserFeatureModalOpen(true);
              }}
            />
          )}

          {activeModule === 'audit_security' && (
            <AuditAndSecurityModule
              currentUser={currentUser}
              auditLogs={auditLogs}
              staffList={staffList}
              onOpenAccessMatrix={() => setIsAccessMatrixOpen(true)}
              onOpenUserFeatureModal={(staff) => {
                setUserFeatureModalStaff(staff);
                setIsUserFeatureModalOpen(true);
              }}
            />
          )}

          {activeModule === 'customer_portal' && (
            <CustomerPortalView
              products={products}
              branches={branches}
              regions={regions}
              onPlaceOnlineOrder={(draft) => handleCommitTransaction(draft, [])}
              onPreviewDoc={(d) => setPreviewDoc(d)}
            />
          )}

          {activeModule === 'outlets_restaurants' && (
            <RestaurantOutletManagement
              currentUser={currentUser}
              branches={branches}
              staffList={staffList}
              products={products}
              businessUnits={businessUnits}
              restaurantInventory={restaurantInventory}
              onCreateBusinessUnit={handleCreateBusinessUnit}
              onUpdateBusinessUnit={handleUpdateBusinessUnit}
              onDeleteBusinessUnit={handleDeleteBusinessUnit}
              onCreateRestaurantItem={handleCreateRestaurantItem}
              onUpdateRestaurantItem={handleUpdateRestaurantItem}
              onDeleteRestaurantItem={handleDeleteRestaurantItem}
            />
          )}
        </main>
      </div>

      {/* Universal Desktop Dock & Mobile Ergonomic Bottom Navigation with Wave Top Edge */}
      <DesktopBottomNav
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        allowedModules={allowedModules}
        currentUser={currentUser}
        onOpenCustomerPortal={() => handleSelectModule('customer_portal')}
      />

      {/* Commercial Print & PDF Modal */}
      <DocumentPrintModal docData={previewDoc} onClose={() => setPreviewDoc(null)} />

      {/* Official 80mm/58mm Thermal Payslip Modal */}
      {viewingPayslipRecord && (
        <ThermalPayslipModal
          record={viewingPayslipRecord}
          onClose={() => setViewingPayslipRecord(null)}
        />
      )}

      {/* Branch Onboarding & Stock Activation Modal */}
      {isOnboardModalOpen && currentUser && (
        <OnboardItemsModal
          isOpen={isOnboardModalOpen}
          onClose={() => setIsOnboardModalOpen(false)}
          currentUser={currentUser}
          products={products}
          branches={branches}
          onActivateProductStock={handleActivateProductStock}
          onShowSuccessFeedback={(title, msg) => triggerToast('success', title, msg)}
          onShowErrorFeedback={(title, msg) => triggerToast('error', title, msg)}
        />
      )}

      {/* Target Access Model (8 Roles) Matrix Modal */}
      {isAccessMatrixOpen && currentUser && (
        <AccessModelMatrixModal
          isOpen={isAccessMatrixOpen}
          onClose={() => setIsAccessMatrixOpen(false)}
          currentUser={currentUser}
          staffList={staffList}
          customRoleMatrix={customRoleMatrix}
          onSaveRoleMatrix={handleSaveRoleMatrix}
          onResetRoleMatrix={handleResetRoleMatrix}
          onOpenUserFeatureModal={(staff) => {
            setUserFeatureModalStaff(staff);
            setIsUserFeatureModalOpen(true);
          }}
        />
      )}

      {/* Admin User Feature Access & Feature Stripping Modal */}
      {isUserFeatureModalOpen && userFeatureModalStaff && currentUser && (
        <UserFeatureAccessModal
          isOpen={isUserFeatureModalOpen}
          onClose={() => {
            setIsUserFeatureModalOpen(false);
            setUserFeatureModalStaff(null);
          }}
          staff={userFeatureModalStaff}
          currentUser={currentUser}
          customRoleMatrix={customRoleMatrix}
          onSavePermissions={handleSaveUserPermissions}
        />
      )}
    </div>
  );
}
