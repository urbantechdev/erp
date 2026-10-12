import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
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
  Menu,
  X,
  Wine,
} from 'lucide-react';
import {
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  testFirestoreConnection,
  handleFirestoreError,
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
} from './types';
import {
  getDeviceFingerprint,
  ROLE_PERMISSIONS,
  MASTER_IMPORTED_INVENTORY,
  formatKes,
} from './erpUtils';
import { ensureOperationalFoundationSeeded } from './seedData';
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
import { DocumentPrintModal } from './components/DocumentPrintModal';
import { StatusFeedbackToast } from './components/AnimatedFeedback';

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
};

export default function App() {
  // Real-time Firestore state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [regions, setRegions] = useState<GeoRegion[]>([]);
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [transactions, setTransactions] = useState<TransactionDoc[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<ComplianceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Active User Session State
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [standaloneCustomerPortal, setStandaloneCustomerPortal] = useState(false);
  const [activeModule, setActiveModule] = useState<ERPModuleId>('overview');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<TransactionDoc | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
        return { ...baseItem, ...override };
      }
      return baseItem;
    });

    // Prepend any brand-new products created via the Auto-SKU generator in Firestore
    const customCreated = Array.from(overrideMap.values());
    return [...customCreated, ...merged];
  }, [firestoreProducts]);

  // Boot connection test & operational seed (with zero staff)
  useEffect(() => {
    testFirestoreConnection();
    ensureOperationalFoundationSeeded();
  }, []);

  // Auto Full Screen the system on reload or first tap/click/touch interaction
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        const docEl = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
          msRequestFullscreen?: () => Promise<void>;
        };
        const fsDoc = document as Document & {
          webkitFullscreenElement?: Element | null;
        };

        if (!document.fullscreenElement && !fsDoc.webkitFullscreenElement) {
          if (docEl.requestFullscreen) {
            await docEl.requestFullscreen();
          } else if (docEl.webkitRequestFullscreen) {
            await docEl.webkitRequestFullscreen();
          } else if (docEl.msRequestFullscreen) {
            await docEl.msRequestFullscreen();
          }
        }
      } catch {
        // Browsers require a user gesture if triggered on initial reload;
        // the pointerdown/touchstart/click listeners will immediately engage fullscreen on first tap.
      }
    };

    // Attempt immediately on reload
    enterFullscreen();

    // Ensure any tap, click, or touch anywhere on screen enters fullscreen if not already active
    const handleUserGesture = () => {
      enterFullscreen();
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('touchstart', handleUserGesture, { passive: true });
    window.addEventListener('click', handleUserGesture, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
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
    branchName: string,
    severity: AuditLog['severity'] = 'Info'
  ) => {
    const logId = `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: AuditLog = {
      id: logId,
      actorName,
      actorRole,
      actorEmailOrPinId,
      action,
      module: moduleName,
      details: details.slice(0, 490),
      deviceFingerprint: getDeviceFingerprint(),
      branchName,
      severity,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'audit_logs', logId), entry);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'audit_logs');
    }
  };

  // Helper to persist any product update safely (even if product was only in the imported catalog so far)
  const persistProductState = async (
    productId: string,
    patch: Partial<Product>
  ) => {
    const baseProd = products.find((p) => p.id === productId);
    if (!baseProd) return;
    const now = new Date().toISOString();
    const docPayload: Product = {
      ...baseProd,
      ...patch,
      id: productId,
      createdAt: baseProd.createdAt || now,
    };
    await setDoc(doc(db, 'products', productId), docPayload, { merge: true });
  };

  // Google Sign-In strictly for Admin and Accountant
  const handleGoogleLogin = async (targetRole: 'Admin' | 'Accountant') => {
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
        const adminId = `staff-admin-${cred.user.uid.slice(0, 8)}`;
        const defaultBranch = branches[0] || {
          id: 'br-hq-metro',
          name: 'Main Branch (Head Office — Nairobi CBD)',
        };
        const newAdmin: StaffMember = {
          id: adminId,
          name: userName,
          email: userEmail,
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
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Google Sign-In failed or popup was closed.';
      setAuthError(msg);
      triggerToast('error', 'Authentication Error', msg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 6-Digit PIN Sign-In for HR, Sales Manager, Branch Manager, Inventory Controller, Counter Cashier, Affiliate Sales Rep
  const handlePinLogin = async (pin: string, selectedRole?: StaffMember['role']) => {
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const matched = staffList.find(
        (s) =>
          s.authMethod === 'pin' &&
          s.pin === pin &&
          s.status === 'Active' &&
          (!selectedRole || s.role === selectedRole)
      );
      if (!matched) {
        const msg = selectedRole
          ? `Invalid 6-Digit PIN for ${selectedRole} department, or no active ${selectedRole} provisioned yet.`
          : 'Invalid 6-Digit PIN or no PIN staff provisioned yet. Sign in as Admin via Google to create HR first.';
        setAuthError(msg);
        triggerToast('error', 'Invalid 6-Digit PIN', msg);
        await recordAuditLog(
          'Unknown Terminal User',
          selectedRole || 'Unverified PIN',
          `PINAttempt:${pin.slice(0, 2)}****`,
          'Failed 6-Digit PIN Attempt',
          'Authentication',
          `Rejected invalid 6-digit PIN entry for department ${selectedRole || 'All'}`,
          'Terminal Gateway',
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

  // Allowed modules for the currently logged in role
  const allowedModules = useMemo<ERPModuleId[]>(() => {
    if (!currentUser) return [];
    return ROLE_PERMISSIONS[currentUser.role].allowedModules;
  }, [currentUser]);

  const handleSelectModule = (modId: ERPModuleId) => {
    if (!allowedModules.includes(modId)) return;
    setActiveModule(modId);
    setMobileDrawerOpen(false);
  };

  // Mutation Handlers with full Firestore persistence & Audit Logging
  const handleCommitTransaction = async (
    txDraft: Omit<TransactionDoc, 'id' | 'createdAt'>,
    updatedProducts: { productId: string; newTotal: number; newBranchStockJson: string }[]
  ): Promise<TransactionDoc | null> => {
    const id = `tx-${Date.now()}`;
    const fullTx: TransactionDoc = {
      ...txDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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
    const fullProd: Product = {
      ...prodDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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

  const handleCreateBranch = async (branchDraft: Omit<Branch, 'id' | 'createdAt'>) => {
    const id = `br-${Date.now()}`;
    const fullBranch: Branch = {
      ...branchDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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

  const handleCreateStockTransfer = async (
    trDraft: Omit<StockTransfer, 'id' | 'createdAt'>,
    updatedProd: { productId: string; newBranchStockJson: string }
  ) => {
    const id = `trf-${Date.now()}`;
    const fullTr: StockTransfer = {
      ...trDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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
    const fullReg: GeoRegion = {
      ...regDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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
    const fullPartner: Partner = {
      ...partDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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
    const fullComp: ComplianceRecord = {
      ...compDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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
    const fullStaff: StaffMember = {
      ...staffDraft,
      id,
      createdAt: new Date().toISOString(),
    };
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

  // If Customer Online Portal is opened directly from the login gateway
  if (!currentUser && standaloneCustomerPortal) {
    return (
      <>
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

  // If not authenticated, render the Dual Auth Gateway (Google for Admin/Accountant, 6-Digit PIN for operational roles)
  if (!currentUser) {
    return (
      <>
        <StatusFeedbackToast status={toastStatus} onDismiss={() => setToastStatus(null)} />
        <AuthGateway
          staffList={staffList}
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
          <div className="w-13 h-13 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md border-2 border-white">
            <Wine className="w-7 h-7 stroke-[2.5]" />
          </div>
          <span className="font-montserrat font-black italic text-2xl sm:text-3xl lg:text-4xl tracking-tighter text-white">
            VAAIRO <span className="text-[#FFDE00] not-italic text-xs sm:text-sm font-black px-2.5 py-0.5 bg-white/10 rounded-xl ml-1.5 align-middle">ERP</span>
          </span>
        </a>

        {/* Zone 3: Sign Out Action */}
        <div className="flex items-center gap-2 shrink-0 relative z-10">
          <button
            onClick={handleLogout}
            className="px-3.5 py-2 bg-[#FFDE00] hover:bg-amber-400 text-[#0A006E] font-montserrat font-black text-xs rounded-xl transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out ({currentUser.role})
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
          </div>

          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-[11px] text-slate-600 space-y-1 relative z-10 mt-4">
            <div className="font-montserrat font-black text-[#0A006E]">Device Telemetry Active</div>
            <div className="font-mono-tabular text-[10px] truncate">
              {getDeviceFingerprint()}
            </div>
          </div>
        </aside>

        {/* Main Content Area (Vast White Background #FFFFFF with Bright Grey #F0F2F0 Blocks) */}
        <main className="flex-1 bg-white p-4 sm:p-6 lg:p-8 pb-24 md:pb-10 overflow-y-auto max-w-7xl mx-auto w-full">
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
              onPreviewDoc={(d) => setPreviewDoc(d)}
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
              onCommitTransaction={handleCommitTransaction}
              onPreviewDoc={(d) => setPreviewDoc(d)}
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
              onCommitTransaction={handleCommitTransaction}
              onPreviewDoc={(d) => setPreviewDoc(d)}
            />
          )}

          {activeModule === 'inventory' && (
            <InventoryModule
              products={products}
              branches={branches}
              onCreateProduct={handleCreateProduct}
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
              onCreateStockTransfer={handleCreateStockTransfer}
            />
          )}

          {activeModule === 'geo_pricing' && (
            <GeoPricingModule
              regions={regions}
              products={products}
              onCreateRegion={handleCreateRegion}
              onUpdateProductGeoOverride={handleUpdateProductGeoOverride}
            />
          )}

          {activeModule === 'partners' && (
            <PartnersOnboardingModule
              partners={partners}
              regions={regions}
              onCreatePartner={handleCreatePartner}
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
              onCreateStaff={handleCreateStaff}
            />
          )}

          {activeModule === 'audit_security' && (
            <AuditAndSecurityModule auditLogs={auditLogs} staffList={staffList} />
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
        </main>
      </div>

      {/* Mobile Native-App Bottom Tab Bar (<768px) with 44x44px+ ergonomic hitboxes */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#0A006E] text-white border-t-2 border-[#FFDE00] grid grid-cols-5 items-center px-1">
        {primaryMobileModules.map((modId) => {
          const IconComp = MODULE_META[modId].icon;
          const isActive = activeModule === modId;
          return (
            <button
              key={modId}
              onClick={() => handleSelectModule(modId)}
              className={`min-h-[48px] flex flex-col items-center justify-center rounded-xl transition-colors cursor-pointer ${
                isActive ? 'text-[#FFDE00] font-black' : 'text-slate-200'
              }`}
            >
              <IconComp className="w-5 h-5" />
              <span className="text-[10px] font-montserrat font-bold tracking-tight mt-1 truncate max-w-[64px]">
                {MODULE_META[modId].shortMobileLabel}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="min-h-[48px] flex flex-col items-center justify-center text-slate-200 cursor-pointer"
        >
          <Menu className="w-5 h-5 text-[#FFDE00]" />
          <span className="text-[10px] font-montserrat font-bold tracking-tight mt-1">All Modules</span>
        </button>
      </nav>

      {/* Mobile Bottom Sheet Action Drawer for full module list */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto space-y-4 border-t-3 border-[#FFDE00]">
            <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-montserrat font-black text-[#0A006E]">
                  {currentUser.role}
                </div>
                <div className="text-sm font-montserrat font-bold text-slate-900">
                  {currentUser.name} · {currentUser.branchName}
                </div>
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {allowedModules.map((modId) => {
                const IconComp = MODULE_META[modId].icon;
                const isActive = activeModule === modId;
                return (
                  <button
                    key={modId}
                    onClick={() => handleSelectModule(modId)}
                    className={`min-h-[48px] p-3 rounded-xl border text-left flex items-center gap-2.5 text-xs font-montserrat font-bold ${
                      isActive
                        ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                        : 'bg-[#F0F2F0] text-slate-800 border-slate-200'
                    }`}
                  >
                    <IconComp
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#FFDE00]' : 'text-[#0A006E]'
                      }`}
                    />
                    <span className="truncate">{MODULE_META[modId].shortMobileLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Commercial Print & PDF Modal */}
      <DocumentPrintModal docData={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
