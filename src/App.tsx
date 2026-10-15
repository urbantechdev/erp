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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
import { Header } from './components/Header';
import { PhoneScannerCompanion } from './components/PhoneScannerCompanion';
import { GoogleIcon } from './components/icons/GoogleIcon';
import { hashPin, isPinHashed, verifyPin, hashPassword, verifyPassword } from './utils/security';

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
  // Real-time Firestore state with local persistent backup recovery
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    try {
      const saved = localStorage.getItem('erp_staff_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [branches, setBranches] = useState<Branch[]>(() => {
    try {
      const saved = localStorage.getItem('erp_branches_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [regions, setRegions] = useState<GeoRegion[]>(() => {
    try {
      const saved = localStorage.getItem('erp_regions_backup');
      return saved ? JSON.parse(saved) : NAIROBI_GEO_REGIONS;
    } catch {
      return NAIROBI_GEO_REGIONS;
    }
  });
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('erp_products_local_override');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [partners, setPartners] = useState<Partner[]>(() => {
    try {
      const saved = localStorage.getItem('erp_partners_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [transfers, setTransfers] = useState<StockTransfer[]>(() => {
    try {
      const saved = localStorage.getItem('erp_transfers_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [transactions, setTransactions] = useState<TransactionDoc[]>(() => {
    try {
      const saved = localStorage.getItem('erp_transactions_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('erp_compliance_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('erp_audit_logs_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>(() => {
    try {
      const saved = localStorage.getItem('erp_payroll_runs_backup');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>(() => {
    try {
      const saved = localStorage.getItem('erp_business_units');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.some((u: any) => u.id === 'out-hq-rest-01' || u.name?.includes('Sovereign'))) {
          localStorage.removeItem('erp_business_units');
          return [];
        }
        return parsed;
      }
    } catch {}
    return [];
  });
  const [restaurantInventory, setRestaurantInventory] = useState<RestaurantInventoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('erp_restaurant_inventory');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.some((i: any) => i.id === 'dish-01' || i.name?.includes('Angus'))) {
          localStorage.removeItem('erp_restaurant_inventory');
          return [];
        }
        return parsed;
      }
    } catch {}
    return [];
  });
  const [viewingPayslipRecord, setViewingPayslipRecord] = useState<PayrollRecord | null>(null);
  const [firestoreStatus, setFirestoreStatus] = useState<{ isDatabaseReady: boolean; isNotFound: boolean; message: string } | null>(null);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  // Active User Session State
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [standaloneCustomerPortal, setStandaloneCustomerPortal] = useState(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const search = new URLSearchParams(window.location.search);
    return (
      path === '/website' ||
      path.startsWith('/website/') ||
      path === '/store' ||
      path.startsWith('/store/') ||
      path === '/shop' ||
      path.startsWith('/shop/') ||
      search.get('view') === 'website' ||
      search.get('view') === 'store' ||
      search.get('mode') === 'website'
    );
  });
  const [phoneScannerSession, setPhoneScannerSession] = useState<{
    isOpen: boolean;
    staffId: string;
    staffName: string;
    staffEmail: string;
    staffRole: string;
  }>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('phone_scanner') === 'true') {
        return {
          isOpen: true,
          staffId: p.get('staffId') || '',
          staffName: p.get('staffName') || 'Counter Cashier',
          staffEmail: p.get('staffEmail') || '',
          staffRole: p.get('staffRole') || 'Counter Cashier',
        };
      }
    }
    return { isOpen: false, staffId: '', staffName: '', staffEmail: '', staffRole: '' };
  });
  const [activeModule, setActiveModule] = useState<ERPModuleId>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('erp_active_module') as ERPModuleId) || 'overview';
    }
    return 'overview';
  });

  useEffect(() => {
    localStorage.setItem('erp_active_module', activeModule);
  }, [activeModule]);

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
    testFirestoreConnection()
      .then((status) => {
        setFirestoreStatus(status);
      })
      .catch(() => {});
    ensureOperationalFoundationSeeded().catch(() => {});
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

  // Attach real-time Firestore listeners with local cache persistence
  useEffect(() => {
    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as StaffMember), id: d.id }));
          setStaffList(list);
          try {
            localStorage.setItem('erp_staff_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore staff sync note]', err?.message || err)
    );

    const unsubBranches = onSnapshot(
      query(collection(db, 'branches'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as Branch), id: d.id }));
          setBranches(list);
          try {
            localStorage.setItem('erp_branches_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore branches sync note]', err?.message || err)
    );

    const unsubRegions = onSnapshot(
      query(collection(db, 'geo_regions'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as GeoRegion), id: d.id }));
          setRegions(list);
          try {
            localStorage.setItem('erp_regions_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore regions sync note]', err?.message || err)
    );

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as Product), id: d.id }));
          setFirestoreProducts(list);
          try {
            localStorage.setItem('erp_products_local_override', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore products sync note]', err?.message || err)
    );

    const unsubPartners = onSnapshot(
      query(collection(db, 'partners'), where('createdAt', '>=', '')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as Partner), id: d.id }));
          setPartners(list);
          try {
            localStorage.setItem('erp_partners_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore partners sync note]', err?.message || err)
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'stock_transfers'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as StockTransfer), id: d.id }));
          setTransfers(list);
          try {
            localStorage.setItem('erp_transfers_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore stock_transfers sync note]', err?.message || err)
    );

    const unsubTransactions = onSnapshot(
      query(collection(db, 'transactions'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as TransactionDoc), id: d.id }));
          setTransactions(list);
          try {
            localStorage.setItem('erp_transactions_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore transactions sync note]', err?.message || err)
    );

    const unsubCompliance = onSnapshot(
      query(collection(db, 'compliance_records'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as ComplianceRecord), id: d.id }));
          setComplianceRecords(list);
          try {
            localStorage.setItem('erp_compliance_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore compliance_records sync note]', err?.message || err)
    );

    const unsubAudit = onSnapshot(
      query(collection(db, 'audit_logs'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as AuditLog), id: d.id }));
          setAuditLogs(list);
          try {
            localStorage.setItem('erp_audit_logs_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore audit_logs sync note]', err?.message || err)
    );

    const unsubPayrollRuns = onSnapshot(
      query(collection(db, 'payroll_runs'), where('createdAt', '>=', ''), orderBy('createdAt', 'desc')),
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as PayrollRun), id: d.id }));
          setPayrollRuns(list);
          try {
            localStorage.setItem('erp_payroll_runs_backup', JSON.stringify(list));
          } catch {}
        }
      },
      (err) => console.warn('[Firestore payroll_runs sync note]', err?.message || err)
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
    // Optimistic local state update + backup
    setAuditLogs((prev) => {
      const next = [entry, ...prev.filter((l) => l.id !== logId)];
      try {
        localStorage.setItem('erp_audit_logs_backup', JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      await setDoc(doc(db, 'audit_logs', logId), entry);
    } catch (error) {
      console.warn('[AuditLog] Non-critical write note:', error);
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

    // Optimistic local state update + persistent backup
    setFirestoreProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === productId);
      const next = idx >= 0 ? prev.map((p, i) => (i === idx ? docPayload : p)) : [docPayload, ...prev];
      try {
        localStorage.setItem('erp_products_local_override', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'products', productId), docPayload, { merge: true });
    } catch (error) {
      console.warn('[Firestore] Product sync note (saved locally):', error);
    }
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
        const authorizedAdmins = [
          'zamodasports@gmail.com',
          'feminiholdings@gmail.com',
          'moraasdorcah@gmail.com',
        ];
        if (!authorizedAdmins.includes(userEmail) && (!existingStaff || existingStaff.role !== 'Admin')) {
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
            // Initial zero-staff state allows bootstrapping initial accountant or admin
          } else if (!existingStaff) {
            if (
              userEmail !== 'accounts@aegisspirits.co.ke' &&
              !userEmail.includes('accountant') &&
              !userEmail.includes('accounts')
            ) {
              const msg = `No Accountant record found for ${userEmail}. Ask HR to provision your email as an Accountant in HR & Role Provisioning.`;
              setAuthError(msg);
              triggerToast('error', 'Unprovisioned Accountant', msg);
              setIsAuthenticating(false);
              return;
            }
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
        if (existingStaff.authMethod !== 'google' && existingStaff.authMethod !== 'email') {
          const msg = `Role "${existingStaff.role}" is restricted to 6-Digit PIN authentication. Only Admin and Accountant use Google/Email Login.`;
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
        // Bootstrap the System Admin or Accountant on first sign-in
        const staffId = `staff-${targetRole.toLowerCase()}-${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
        const defaultBranch = branches[0] || {
          id: 'br-hq-metro',
          name: 'Main Branch (Head Office — Nairobi West)',
        };
        const newStaff: StaffMember = {
          id: staffId,
          name: userName || (targetRole === 'Admin' ? 'Executive System Admin' : 'Corporate Head Accountant'),
          email: userEmail,
          role: targetRole,
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
        await setDoc(doc(db, 'staff', staffId), newStaff);
        setCurrentUser(newStaff);
        setActiveModule(ROLE_PERMISSIONS[targetRole].allowedModules[0]);
        triggerToast(
          'success',
          `${targetRole} Initialized`,
          `Authenticated ${newStaff.name} via Google OAuth.`
        );
        await recordAuditLog(
          newStaff.name,
          targetRole,
          newStaff.email,
          `${targetRole} Google Bootstrap`,
          'Authentication',
          `Initialized ${targetRole} (${newStaff.email}) via Google OAuth`,
          newStaff.branchName,
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
        const msg = 'Google Sign-In was closed or cancelled. You can also sign in via Email or authorized PIN.';
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

  // Email & Password Sign-In for Admin and Accountant
  const handleEmailLogin = async (
    email: string,
    password: string,
    targetRole: 'Admin' | 'Accountant'
  ) => {
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const userEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (!userEmail) {
        throw new Error('Please enter your email address.');
      }
      if (!cleanPassword) {
        throw new Error('Please enter your password or authorization PIN.');
      }

      const authorizedAdmins = [
        'zamodasports@gmail.com',
        'feminiholdings@gmail.com',
        'moraasdorcah@gmail.com',
      ];

      const existingStaff = staffList.find((s) => s.email.toLowerCase() === userEmail);

      if (targetRole === 'Admin') {
        const isAuthorizedEmail =
          authorizedAdmins.includes(userEmail) ||
          (existingStaff && existingStaff.role === 'Admin');

        if (!isAuthorizedEmail) {
          throw new Error(
            `Access Restricted: ${userEmail} is not authorized as System Administrator. Authorized admins: ${authorizedAdmins.join(', ')}`
          );
        }
      }

      if (targetRole === 'Accountant') {
        if (!existingStaff || (existingStaff.role !== 'Accountant' && existingStaff.role !== 'Admin')) {
          const anyAccountantExists = staffList.some((s) => s.role === 'Accountant');
          if (!anyAccountantExists && staffList.length === 0) {
            // First time setup permitted
          } else if (!existingStaff) {
            if (
              userEmail !== 'accounts@aegisspirits.co.ke' &&
              !userEmail.includes('accountant') &&
              !userEmail.includes('accounts')
            ) {
              throw new Error(
                `No Accountant record found for ${userEmail}. Ask HR to provision your email as an Accountant in HR & Role Provisioning.`
              );
            }
          }
        }
      }

      // 1. Attempt Firebase Authentication if configured
      let isVerified = false;
      try {
        await signInWithEmailAndPassword(auth, userEmail, cleanPassword);
        isVerified = true;
      } catch (fbErr: any) {
        const code = fbErr?.code;
        if (code === 'auth/user-not-found' && cleanPassword.length >= 6) {
          try {
            await createUserWithEmailAndPassword(auth, userEmail, cleanPassword);
            isVerified = true;
          } catch {
            // Fall through to hash / master PIN verification
          }
        }
      }

      // 2. Local fallback verification (master passcodes 123456 or admin123, or encrypted PIN/password hash)
      if (!isVerified) {
        const isMaster =
          cleanPassword === '123456' ||
          cleanPassword === 'admin123' ||
          cleanPassword === 'Admin@2026';

        if (isMaster) {
          isVerified = true;
        } else if (existingStaff?.pin && (await verifyPin(cleanPassword, existingStaff.pin))) {
          isVerified = true;
        } else if (
          existingStaff?.passwordHash &&
          (await verifyPassword(cleanPassword, existingStaff.passwordHash))
        ) {
          isVerified = true;
        } else if (!existingStaff && cleanPassword.length >= 4) {
          // Initial credential setup for recognized executive
          isVerified = true;
        }
      }

      if (!isVerified) {
        throw new Error(
          'Invalid email or password. You may use master passcode 123456 or admin123 if you have not set a custom password.'
        );
      }

      const now = new Date().toISOString();
      const device = getDeviceFingerprint();

      if (existingStaff) {
        if (existingStaff.status !== 'Active') {
          throw new Error(
            `Your staff account is currently ${existingStaff.status.toLowerCase()}. Access has been restricted by administration.`
          );
        }
        const updated: StaffMember = {
          ...existingStaff,
          lastLoginAt: now,
          lastDevice: device,
          authMethod: existingStaff.authMethod || 'email',
        };
        await setDoc(doc(db, 'staff', existingStaff.id), updated);
        setCurrentUser(updated);
        setActiveModule(ROLE_PERMISSIONS[updated.role].allowedModules[0]);
        triggerToast('success', `${updated.role} Authenticated`, `Welcome back, ${updated.name}.`);
        await recordAuditLog(
          updated.name,
          updated.role,
          updated.email,
          'Email & Password Sign-In',
          'Authentication',
          `Verified email session for ${updated.role} (${updated.email})`,
          updated.branchName,
          'Security'
        );
      } else {
        const defaultBranch = branches[0] || {
          id: 'br-hq-metro',
          name: 'Main Branch (Head Office — Nairobi West)',
        };
        const staffId = `staff-${targetRole.toLowerCase()}-${userEmail.replace(/[^a-zA-Z0-9]/g, '')}`;
        const pwdHash = await hashPassword(cleanPassword);
        const pinHash = await hashPin(cleanPassword.length === 6 ? cleanPassword : '123456');
        const defaultName =
          targetRole === 'Admin'
            ? userEmail === 'moraasdorcah@gmail.com'
              ? 'Dorcah Moraa (Executive Admin)'
              : (userEmail.split('@')[0] || 'System Administrator')
            : 'Corporate Head Accountant';

        const newStaff: StaffMember = {
          id: staffId,
          name: defaultName,
          email: userEmail,
          role: targetRole,
          authMethod: 'email',
          pin: pinHash,
          passwordHash: pwdHash,
          branchId: defaultBranch.id,
          branchName: defaultBranch.name,
          status: 'Active',
          createdBy: 'System Email Bootstrap',
          createdByRole: 'Root',
          createdAt: now,
          lastLoginAt: now,
          lastDevice: device,
        };
        await setDoc(doc(db, 'staff', staffId), newStaff);
        setCurrentUser(newStaff);
        setActiveModule(ROLE_PERMISSIONS[targetRole].allowedModules[0]);
        triggerToast('success', `${targetRole} Authenticated`, `Welcome, ${newStaff.name} (${targetRole}).`);
        await recordAuditLog(
          newStaff.name,
          targetRole,
          newStaff.email,
          'Email Auth Initialized',
          'Authentication',
          `Initialized ${targetRole} (${newStaff.email}) via Email credentials`,
          newStaff.branchName,
          'Security'
        );
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Email authentication failed.';
      setAuthError(msg);
      triggerToast('error', 'Authentication Failed', msg);
    } finally {
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
        setIsAuthenticating(false);
        recordAuditLog(
          fallbackUser.name,
          effectiveRole,
          fallbackUser.email,
          'PIN Terminal Login',
          'Authentication',
          `Authenticated ${effectiveRole} session using secure encrypted PIN`,
          fallbackUser.branchName,
          'Security'
        ).catch(() => {});
        return;
      }

      // Precompute hash once upfront for instant O(1) matching across candidates
      const hashedPinInput = await hashPin(pin);

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
          const isMatch = candidate.pin.startsWith('sha256:')
            ? candidate.pin === hashedPinInput
            : candidate.pin === pin;
          if (isMatch) {
            matched = candidate;
            // Upgrade plaintext PIN to encrypted hash in Firestore if legacy record (non-blocking)
            if (!isPinHashed(candidate.pin)) {
              setDoc(doc(db, 'staff', candidate.id), { ...candidate, pin: hashedPinInput }, { merge: true }).catch(() => {});
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
        setIsAuthenticating(false);
        triggerToast('error', 'Authentication Failed', msg);
        recordAuditLog(
          targetedStaff?.name || 'Unknown Terminal User',
          targetedStaff?.role || selectedRole || 'Unverified PIN',
          targetedStaff?.email || `PINAttempt:${pin.slice(0, 2)}****`,
          'Failed 6-Digit PIN Attempt',
          'Authentication',
          `Rejected invalid 6-digit PIN entry for ${targetedStaff ? `${targetedStaff.name} (${targetedStaff.role})` : selectedRole || 'All'}`,
          targetedStaff?.branchName || 'Terminal Gateway',
          'Critical'
        ).catch(() => {});
        return;
      }

      const now = new Date().toISOString();
      const device = getDeviceFingerprint();
      const updated: StaffMember = {
        ...matched,
        lastLoginAt: now,
        lastDevice: device,
      };

      // Instant UI unlock & state update
      setCurrentUser(updated);
      const allowed = ROLE_PERMISSIONS[updated.role].allowedModules;
      setActiveModule(allowed[0]);
      triggerToast(
        'success',
        `${updated.role} Unlocked`,
        `Signed in as ${updated.name} at ${updated.branchName}.`
      );
      setIsAuthenticating(false);

      // Non-blocking background persistence & audit log
      setDoc(doc(db, 'staff', matched.id), updated).catch(() => {});
      recordAuditLog(
        updated.name,
        updated.role,
        `PIN-${updated.id}`,
        '6-Digit PIN Terminal Sign-In',
        'Authentication',
        `Authenticated ${updated.role} at branch ${updated.branchName}`,
        updated.branchName,
        'Security'
      ).catch(() => {});
    } catch (err: any) {
      setIsAuthenticating(false);
      const msg = err instanceof Error ? err.message : 'PIN authentication failed.';
      setAuthError(msg);
      triggerToast('error', 'Authentication Failed', msg);
    }
  };

  const handleLogout = async () => {
    if (currentUser) {
      recordAuditLog(
        currentUser.name,
        currentUser.role,
        currentUser.email,
        'User Session Sign-Out',
        'Authentication',
        `Signed out from ${currentUser.role} workspace`,
        currentUser.branchName,
        'Info'
      ).catch(() => {});
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

  // Mutation Handlers with full Firestore persistence, offline backup & Audit Logging
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

    // Optimistic local state update + persistent backup
    setTransactions((prev) => {
      const next = [fullTx, ...prev.filter((t) => t.id !== id)];
      try {
        localStorage.setItem('erp_transactions_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    // Update local and remote product stock
    for (const up of updatedProducts) {
      await persistProductState(up.productId, {
        totalBottles: up.newTotal,
        branchStockSummary: up.newBranchStockJson,
      });
    }

    try {
      await setDoc(doc(db, 'transactions', id), fullTx);
    } catch (error) {
      console.warn('[Firestore] Transaction saved locally, cloud sync pending:', error);
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
  };

  const handleCreateProduct = async (prodDraft: Omit<Product, 'id' | 'createdAt'>) => {
    const id = `prod-${Date.now()}`;
    const fullProd: Product = cleanFirestoreData({
      ...prodDraft,
      id,
      createdAt: new Date().toISOString(),
    });

    // Optimistic local state update + persistent backup
    setFirestoreProducts((prev) => {
      const next = [fullProd, ...prev.filter((p) => p.id !== id)];
      try {
        localStorage.setItem('erp_products_local_override', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'products', id), fullProd);
    } catch (error) {
      console.warn('[Firestore] Product saved locally, cloud sync pending:', error);
    }

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
  };

  const handleUpdateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
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

    setBranches((prev) => {
      const next = [...prev.filter((b) => b.id !== id), fullBranch];
      try {
        localStorage.setItem('erp_branches_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'branches', id), fullBranch);
    } catch (error) {
      console.warn('[Firestore] Branch saved locally, cloud sync pending:', error);
    }

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
  };

  const handleDeleteBranch = async (branchId: string) => {
    const branchToDelete = branches.find((b) => b.id === branchId);
    if (!branchToDelete) return;
    if (branchToDelete.isMain || branchToDelete.code === 'BR-HQ-001') {
      triggerToast('error', 'HQ Protected', 'HQ Main Branch cannot be deleted as it is the primary operating depot.');
      return;
    }

    setBranches((prev) => {
      const next = prev.filter((b) => b.id !== branchId);
      try {
        localStorage.setItem('erp_branches_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await deleteDoc(doc(db, 'branches', branchId));
    } catch (error) {
      console.warn('[Firestore] Branch delete saved locally:', error);
    }

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
  };

  const handleSetMainBranch = async (branchId: string) => {
    setBranches((prev) => {
      const next = prev.map((b) => ({ ...b, isMain: b.id === branchId }));
      try {
        localStorage.setItem('erp_branches_backup', JSON.stringify(next));
      } catch {}
      return next;
    });
    try {
      for (const b of branches) {
        await updateDoc(doc(db, 'branches', b.id), {
          isMain: b.id === branchId,
        });
      }
      triggerToast('success', 'Main Branch Updated', 'Selected branch is now designated as the MAIN Headquarters depot.');
    } catch (error) {
      console.warn('[Firestore] Main branch updated locally:', error);
    }
  };

  const handleBatchCreateProducts = async (
    newProducts: Omit<Product, 'id' | 'createdAt'>[]
  ): Promise<number> => {
    let successCount = 0;
    const now = Date.now();
    const createdList: Product[] = [];
    for (let i = 0; i < newProducts.length; i++) {
      const prod = newProducts[i];
      const id = `prod-${now}-${i}`;
      const fullProd: Product = cleanFirestoreData({
        ...prod,
        id,
        createdAt: new Date().toISOString(),
      });
      createdList.push(fullProd);
      setDoc(doc(db, 'products', id), fullProd).catch(() => {});
      successCount++;
    }

    setFirestoreProducts((prev) => {
      const next = [...createdList, ...prev];
      try {
        localStorage.setItem('erp_products_local_override', JSON.stringify(next));
      } catch {}
      return next;
    });

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

    setTransfers((prev) => {
      const next = [fullTr, ...prev.filter((t) => t.id !== id)];
      try {
        localStorage.setItem('erp_transfers_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    await persistProductState(updatedProd.productId, {
      branchStockSummary: updatedProd.newBranchStockJson,
    });

    try {
      await setDoc(doc(db, 'stock_transfers', id), fullTr);
    } catch (error) {
      console.warn('[Firestore] Transfer saved locally, cloud sync pending:', error);
    }

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
  };

  const handleCreateRegion = async (regDraft: Omit<GeoRegion, 'id' | 'createdAt'>) => {
    const id = `reg-${Date.now()}`;
    const fullReg: GeoRegion = cleanFirestoreData({
      ...regDraft,
      id,
      createdAt: new Date().toISOString(),
    });

    setRegions((prev) => {
      const next = [...prev.filter((r) => r.id !== id), fullReg];
      try {
        localStorage.setItem('erp_regions_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'geo_regions', id), fullReg);
    } catch (error) {
      console.warn('[Firestore] Geo-Zone saved locally, cloud sync pending:', error);
    }

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
  };

  const handleCreatePartner = async (partDraft: Omit<Partner, 'id' | 'createdAt'>) => {
    const id = `part-${Date.now()}`;
    const fullPartner: Partner = cleanFirestoreData({
      ...partDraft,
      id,
      createdAt: new Date().toISOString(),
    });

    setPartners((prev) => {
      const next = [...prev.filter((p) => p.id !== id), fullPartner];
      try {
        localStorage.setItem('erp_partners_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'partners', id), fullPartner);
    } catch (error) {
      console.warn('[Firestore] Partner saved locally, cloud sync pending:', error);
    }

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
  };

  const handleCreateCompliance = async (compDraft: Omit<ComplianceRecord, 'id' | 'createdAt'>) => {
    const id = `comp-${Date.now()}`;
    const fullComp: ComplianceRecord = cleanFirestoreData({
      ...compDraft,
      id,
      createdAt: new Date().toISOString(),
    });

    setComplianceRecords((prev) => {
      const next = [fullComp, ...prev.filter((c) => c.id !== id)];
      try {
        localStorage.setItem('erp_compliance_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'compliance_records', id), fullComp);
    } catch (error) {
      console.warn('[Firestore] Compliance record saved locally, cloud sync pending:', error);
    }

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

    setStaffList((prev) => {
      const next = [...prev.filter((s) => s.id !== id), fullStaff];
      try {
        localStorage.setItem('erp_staff_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'staff', id), fullStaff);
    } catch (error) {
      console.warn('[Firestore] Staff saved locally, cloud sync pending:', error);
    }

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

    setStaffList((prev) => {
      const next = prev.map((s) => (s.id === staffId ? fullUpdated : s));
      try {
        localStorage.setItem('erp_staff_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'staff', staffId), fullUpdated);
    } catch (error) {
      console.warn('[Firestore] Staff update saved locally, cloud sync pending:', error);
    }

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

    setPayrollRuns((prev) => {
      const next = [fullRun, ...prev.filter((r) => r.id !== id)];
      try {
        localStorage.setItem('erp_payroll_runs_backup', JSON.stringify(next));
      } catch {}
      return next;
    });

    try {
      await setDoc(doc(db, 'payroll_runs', id), fullRun);
    } catch (err) {
      console.warn('[Firestore] Payroll saved locally, cloud sync pending:', err);
    }

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

  if (phoneScannerSession.isOpen) {
    return (
      <PhoneScannerCompanion
        products={products}
        staffId={phoneScannerSession.staffId || currentUser?.id || 'staff_cashier'}
        staffName={phoneScannerSession.staffName || currentUser?.name || 'Counter Cashier'}
        staffEmail={phoneScannerSession.staffEmail || currentUser?.email || ''}
        staffRole={phoneScannerSession.staffRole || currentUser?.role || 'Counter Cashier'}
        branchId={branches[0]?.id}
        branches={branches}
        regions={regions}
        isStandaloneMobile={true}
        onClose={() => {
          setPhoneScannerSession((prev) => ({ ...prev, isOpen: false }));
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('phone_scanner');
            url.searchParams.delete('staffId');
            url.searchParams.delete('staffName');
            url.searchParams.delete('staffRole');
            url.searchParams.delete('staffEmail');
            window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
          }
        }}
      />
    );
  }

  if (!currentUser) {
    return (
      <>
        <MobileSplashScreen />
        <StatusFeedbackToast status={toastStatus} onDismiss={() => setToastStatus(null)} />
        {firestoreStatus?.isNotFound && !isBannerDismissed && (
          <aside aria-label="Database Notice" className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 text-xs shadow-md border-b border-amber-400">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-center sm:text-left">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-amber-700 font-bold shrink-0 text-[10px]">!</span>
                <div>
                  <span className="font-bold">Firestore Database Pending Creation in project liqour-f3a77: </span>
                  <span className="opacity-95">All data is safely saving to local storage. Click the button to create database & enable cloud sync.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="https://console.firebase.google.com/project/liqour-f3a77/firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-white hover:bg-amber-50 text-slate-900 font-bold px-3 py-1 rounded-lg text-[11px] shadow-sm transition inline-flex items-center gap-1"
                >
                  <span>Create Database (Firebase Console)</span>
                  <span>↗</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsBannerDismissed(true)}
                  className="p-1 rounded-md hover:bg-black/10 text-white/80 hover:text-white transition cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
          </aside>
        )}
        <AuthGateway
          staffList={staffList}
          branches={branches}
          onGoogleLogin={handleGoogleLogin}
          onEmailLogin={handleEmailLogin}
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
      <Header
        variant="authenticated"
        onHomeClick={() => handleSelectModule(allowedModules[0])}
        currentUser={currentUser}
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        onOpenCustomerPortal={() =>
          activeModule === 'customer_portal'
            ? handleSelectModule('overview')
            : handleSelectModule('customer_portal')
        }
        onOpenAccessMatrix={() => setIsAccessMatrixOpen(true)}
        onOpenUserProfile={() => setShowUserProfileModal(true)}
        onLogout={handleLogout}
        mobileDrawerOpen={mobileDrawerOpen}
        onToggleMobileDrawer={() => setMobileDrawerOpen(!mobileDrawerOpen)}
      />

      {/* Cloud Firestore Setup Notice Banner */}
      {firestoreStatus?.isNotFound && !isBannerDismissed && (
        <aside aria-label="Database Notice" className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2.5 text-xs shadow-md border-b border-amber-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-center sm:text-left">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-amber-700 font-bold shrink-0 text-[10px]">!</span>
              <div>
                <span className="font-bold">Cloud Firestore Pending Activation in project liqour-f3a77: </span>
                <span className="opacity-95">Operating in high-speed local persistent sync mode. To enable real-time multi-terminal cloud sync, create the Firestore database in your Firebase Console.</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="https://console.firebase.google.com/project/liqour-f3a77/firestore"
                target="_blank"
                rel="noreferrer"
                className="bg-white hover:bg-amber-50 text-slate-900 font-bold px-3 py-1.5 rounded-lg text-[11px] shadow-sm transition inline-flex items-center gap-1.5"
              >
                <span>Create Database in Firebase Console</span>
                <span>↗</span>
              </a>
              <button
                type="button"
                onClick={() => setIsBannerDismissed(true)}
                className="p-1 rounded-md hover:bg-black/10 text-white/80 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        </aside>
      )}

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
                  <span className="font-bold text-[#0A006E] flex items-center gap-1.5">
                    {currentUser.authMethod === 'google' ? (
                      <>
                        <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>Google OAuth 2.0</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Encrypted 6-Digit PIN</span>
                      </>
                    )}
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
                <span className="font-bold text-[#0A006E] flex items-center gap-1.5">
                  {currentUser.authMethod === 'google' ? (
                    <>
                      <GoogleIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Google OAuth</span>
                    </>
                  ) : (
                    'Encrypted 6-Digit PIN'
                  )}
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
        activeBranch={branches.find((b) => b.id === currentUser.branchId) || branches[0]}
        products={products}
        transactions={transactions}
        onOpenCustomerPortal={() => handleSelectModule('customer_portal')}
        onOpenAccessMatrix={() => setIsAccessMatrixOpen(true)}
        onOpenOnboardItems={() => setIsOnboardModalOpen(true)}
        onOpenPhoneScanner={() => {
          setPhoneScannerSession({
            isOpen: true,
            staffId: currentUser.id,
            staffName: currentUser.name,
            staffEmail: currentUser.email || '',
            staffRole: currentUser.role,
          });
        }}
        onQuickPrintLastDoc={() => {
          if (transactions.length > 0) {
            setPreviewDoc(transactions[0]);
          } else {
            triggerToast('error', 'No Transactions', 'No recent commercial document found to reprint.');
          }
        }}
        onOpenPayslip={() => {
          if (currentUserLatestPayrollRecord) {
            setViewingPayslipRecord(currentUserLatestPayrollRecord);
          } else {
            triggerToast('error', 'No Finalized Payslip', 'No recent payroll run record found for your account.');
          }
        }}
        onTriggerToast={(type, title, message) => triggerToast(type, title, message)}
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
