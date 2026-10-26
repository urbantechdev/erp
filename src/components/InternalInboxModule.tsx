import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  Inbox,
  Send,
  Search,
  Building2,
  Users,
  FileText,
  Package,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Truck,
  ShieldCheck,
  UserCheck,
  ArrowLeft,
  Plus,
  X,
  CornerDownRight,
  Coins,
  Briefcase,
  Hash,
  MessageSquare,
  Filter,
} from 'lucide-react';
import {
  StaffMember,
  StaffRole,
  Branch,
  Product,
  TransactionDoc,
  StockTransfer,
  InternalChatMessage,
  InternalChatTypingSignal,
  InvoiceTransferPurpose,
  InvoiceTransferStatus,
  StockRequestUrgency,
} from '../types';
import { formatKes } from '../erpUtils';
import { db, cleanFirestoreData, handleFirestoreError, OperationType } from '../firebase';

export interface DepartmentChannelDef {
  id: string;
  name: string;
  shortLabel: string;
  departmentTag: string;
  description: string;
  primaryRoles: StaffRole[];
  icon: React.ComponentType<{ className?: string }>;
}

export const INTERNAL_DEPARTMENT_CHANNELS: DepartmentChannelDef[] = [
  {
    id: 'dept-all-hands',
    name: 'All Departments · General Desk',
    shortLabel: 'General Desk',
    departmentTag: 'All Departments',
    description: 'Company-wide operational coordination, shift handovers, and cross-branch notices.',
    primaryRoles: [
      'Admin',
      'Accountant',
      'HR',
      'Sales Manager',
      'Branch Manager',
      'Inventory Controller',
      'Counter Cashier',
      'Affiliate Sales Representative',
      'Delivery Manager',
      'Delivery Rider',
    ],
    icon: Building2,
  },
  {
    id: 'dept-finance-accounts',
    name: 'Finance, Accounts & Invoicing',
    shortLabel: 'Finance & Invoices',
    departmentTag: 'Finance & Accounts',
    description: 'Transfer customer invoices for payment verification, credit notes, and KRA reconciliation.',
    primaryRoles: ['Accountant', 'Admin', 'Sales Manager', 'Branch Manager'],
    icon: Coins,
  },
  {
    id: 'dept-inventory-warehouse',
    name: 'Inventory & Bonded Warehouse',
    shortLabel: 'Inventory & Stock',
    departmentTag: 'Inventory & Warehouse',
    description: 'Request inter-branch SKU stock transfers, barcode activations, and bonded stock checks.',
    primaryRoles: ['Inventory Controller', 'Branch Manager', 'Admin'],
    icon: Package,
  },
  {
    id: 'dept-sales-commercial',
    name: 'Sales, B2B & Counter POS',
    shortLabel: 'Sales & POS',
    departmentTag: 'Sales & Commercial',
    description: 'Wholesale quotes, retail counter invoice handovers, and client credit approvals.',
    primaryRoles: ['Sales Manager', 'Counter Cashier', 'Affiliate Sales Representative', 'Admin'],
    icon: Briefcase,
  },
  {
    id: 'dept-branch-operations',
    name: 'Branch Operations & Authorizations',
    shortLabel: 'Branch Ops',
    departmentTag: 'Branch Operations',
    description: 'Depot transfer authorizations, branch float checks, and manager escalations.',
    primaryRoles: ['Branch Manager', 'Inventory Controller', 'Admin'],
    icon: ShieldCheck,
  },
  {
    id: 'dept-delivery-dispatch',
    name: 'Logistics, Fleet & Delivery Dispatch',
    shortLabel: 'Delivery & Fleet',
    departmentTag: 'Delivery & Dispatch',
    description: 'Transfer paid invoices & online orders for rider assignment and dispatch confirmation.',
    primaryRoles: ['Delivery Manager', 'Delivery Rider', 'Branch Manager', 'Sales Manager'],
    icon: Truck,
  },
  {
    id: 'dept-hr-governance',
    name: 'HR, Payroll & Staff Governance',
    shortLabel: 'HR & Payroll',
    departmentTag: 'HR & Governance',
    description: 'Staff onboarding requests, payroll deduction clarifications, and role access notices.',
    primaryRoles: ['HR', 'Admin', 'Accountant'],
    icon: Users,
  },
];

export function buildDirectThreadId(staffIdA: string, staffIdB: string): string {
  const sorted = [staffIdA.trim(), staffIdB.trim()].sort();
  return `dm__${sorted[0]}__${sorted[1]}`;
}

export function isDirectThreadParticipant(threadId: string, staffId: string): boolean {
  if (!threadId.startsWith('dm__')) return false;
  const parts = threadId.split('__');
  return parts[1] === staffId || parts[2] === staffId;
}

export function getLastReadMapForUser(userId: string): Record<string, string> {
  if (typeof window === 'undefined' || !userId) return {};
  try {
    const raw = localStorage.getItem(`vaairo_inbox_last_read_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLastReadForThread(userId: string, threadId: string, isoTimestamp?: string): void {
  if (typeof window === 'undefined' || !userId || !threadId) return;
  try {
    const current = getLastReadMapForUser(userId);
    current[threadId] = isoTimestamp || new Date().toISOString();
    localStorage.setItem(`vaairo_inbox_last_read_${userId}`, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('vaairo-inbox-read-updated'));
  } catch {
    // ignore storage quota errors
  }
}

export function computeUnreadInboxSummary(
  messages: InternalChatMessage[],
  currentUser: StaffMember | null
): { totalBadgeCount: number; unreadMessagesCount: number; actionableForMeCount: number } {
  if (!currentUser) {
    return { totalBadgeCount: 0, unreadMessagesCount: 0, actionableForMeCount: 0 };
  }
  const readMap = getLastReadMapForUser(currentUser.id);
  let unreadMessagesCount = 0;
  let actionableForMeCount = 0;

  for (const msg of messages) {
    const isVisibleThread =
      msg.threadType === 'department' || isDirectThreadParticipant(msg.threadId, currentUser.id);
    if (!isVisibleThread) continue;

    // Count unread messages sent by other staff
    if (msg.senderId !== currentUser.id) {
      const lastReadIso = readMap[msg.threadId];
      if (!lastReadIso || msg.createdAt > lastReadIso) {
        unreadMessagesCount++;
      }
    }

    // Count pending actionable invoice transfers or stock transfer requests assigned directly to currentUser
    if (
      msg.messageType === 'INVOICE_TRANSFER' &&
      msg.invoiceTransfer &&
      msg.invoiceTransfer.transferStatus === 'Pending Acceptance' &&
      msg.invoiceTransfer.assignedToStaffId === currentUser.id
    ) {
      actionableForMeCount++;
    }

    if (
      msg.messageType === 'STOCK_TRANSFER_REQUEST' &&
      msg.stockTransferRequest &&
      msg.stockTransferRequest.requestStatus === 'Pending Review' &&
      msg.stockTransferRequest.requestedToStaffId === currentUser.id
    ) {
      actionableForMeCount++;
    }
  }

  const totalBadgeCount = Math.max(unreadMessagesCount, actionableForMeCount);
  return { totalBadgeCount, unreadMessagesCount, actionableForMeCount };
}

interface InternalInboxModuleProps {
  currentUser: StaffMember;
  staffList: StaffMember[];
  branches: Branch[];
  products: Product[];
  transactions: TransactionDoc[];
  transfers: StockTransfer[];
  messages: InternalChatMessage[];
  externalSelectedThreadId?: string | null;
  onExternalThreadHandled?: () => void;
  onActiveThreadChange?: (threadId: string) => void;
  onSendMessage: (draft: Omit<InternalChatMessage, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateMessage: (messageId: string, updates: Partial<InternalChatMessage>) => Promise<void>;
  onCreateStockTransfer: (
    trDraft: Omit<StockTransfer, 'id' | 'createdAt'>,
    updatedProd?: { productId: string; newBranchStockJson: string }
  ) => Promise<StockTransfer | void>;
  onAuthorizeStockTransfer: (transferId: string) => Promise<void>;
  onRejectStockTransfer: (transferId: string) => Promise<void>;
  onUpdateTransaction?: (txId: string, updates: Partial<TransactionDoc>) => Promise<boolean>;
  onPreviewDoc: (doc: TransactionDoc) => void;
  onInspectOrder?: (doc: TransactionDoc) => void;
  onTriggerToast: (type: 'success' | 'error', title: string, message: string) => void;
}

const INVOICE_PURPOSES: InvoiceTransferPurpose[] = [
  'Payment Verification',
  'Manager Approval',
  'Dispatch & Delivery',
  'Account Reconciliation',
  'Credit Note / Reversal',
  'Department Handover',
];

const STOCK_URGENCIES: StockRequestUrgency[] = [
  'Standard',
  'Urgent Replenishment',
  'Customer Waiting',
];

const TYPING_STALE_MS = 6500;
const TYPING_THROTTLE_MS = 2200;
const TYPING_IDLE_TIMEOUT_MS = 3600;

const AnimatedTypingDots: React.FC<{ dotClassName?: string }> = ({
  dotClassName = 'bg-emerald-600',
}) => (
  <span className="inline-flex items-center gap-0.5 align-middle" aria-hidden="true">
    {[0, 1, 2].map((idx) => (
      <motion.span
        key={idx}
        className={`w-1.5 h-1.5 rounded-full ${dotClassName}`}
        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
        transition={{
          duration: 0.9,
          repeat: Infinity,
          delay: idx * 0.16,
          ease: 'easeInOut',
        }}
      />
    ))}
  </span>
);

function formatTypingSentence(typers: InternalChatTypingSignal[], includeRole = true): string {
  if (typers.length === 0) return '';
  if (typers.length === 1) {
    const t = typers[0];
    return includeRole ? `${t.staffName} (${t.staffRole}) is typing` : `${t.staffName} is typing`;
  }
  if (typers.length === 2) {
    return `${typers[0].staffName.split(' ')[0]} and ${typers[1].staffName.split(' ')[0]} are typing`;
  }
  return `${typers[0].staffName.split(' ')[0]} and ${typers.length - 1} others are typing`;
}

export const InternalInboxModule: React.FC<InternalInboxModuleProps> = ({
  currentUser,
  staffList,
  branches,
  products,
  transactions,
  transfers,
  messages,
  externalSelectedThreadId,
  onExternalThreadHandled,
  onActiveThreadChange,
  onSendMessage,
  onUpdateMessage,
  onCreateStockTransfer,
  onAuthorizeStockTransfer,
  onRejectStockTransfer,
  onUpdateTransaction,
  onPreviewDoc,
  onInspectOrder,
  onTriggerToast,
}) => {
  // Default to the user's primary department channel or general desk
  const defaultChannelId = useMemo(() => {
    if (currentUser.role === 'Accountant') return 'dept-finance-accounts';
    if (currentUser.role === 'Inventory Controller') return 'dept-inventory-warehouse';
    if (currentUser.role === 'Delivery Manager' || currentUser.role === 'Delivery Rider') {
      return 'dept-delivery-dispatch';
    }
    if (currentUser.role === 'HR') return 'dept-hr-governance';
    if (
      currentUser.role === 'Sales Manager' ||
      currentUser.role === 'Counter Cashier' ||
      currentUser.role === 'Affiliate Sales Representative'
    ) {
      return 'dept-sales-commercial';
    }
    if (currentUser.role === 'Branch Manager') return 'dept-branch-operations';
    return 'dept-all-hands';
  }, [currentUser.role]);

  const [selectedThreadId, setSelectedThreadId] = useState<string>(
    () => externalSelectedThreadId || defaultChannelId
  );
  const [mobileShowConversation, setMobileShowConversation] = useState<boolean>(
    () => Boolean(externalSelectedThreadId)
  );

  const onActiveThreadChangeRef = useRef(onActiveThreadChange);
  onActiveThreadChangeRef.current = onActiveThreadChange;

  const onExternalThreadHandledRef = useRef(onExternalThreadHandled);
  onExternalThreadHandledRef.current = onExternalThreadHandled;

  useEffect(() => {
    if (externalSelectedThreadId) {
      setSelectedThreadId(externalSelectedThreadId);
      setMobileShowConversation(true);
      onExternalThreadHandledRef.current?.();
    }
  }, [externalSelectedThreadId]);

  useEffect(() => {
    onActiveThreadChangeRef.current?.(selectedThreadId);
  }, [selectedThreadId]);
  const [sidebarTab, setSidebarTab] = useState<'all' | 'departments' | 'direct' | 'actionable'>('all');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [threadFilter, setThreadFilter] = useState<'all' | 'transfers_only'>('all');
  const [threadSearch, setThreadSearch] = useState('');

  // Composer state
  const [messageText, setMessageText] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Urgent'>('Normal');
  const [taggedStaffId, setTaggedStaffId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);

  // Invoice Transfer Modal State
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [selectedTxId, setSelectedTxId] = useState('');
  const [invoicePurpose, setInvoicePurpose] = useState<InvoiceTransferPurpose>('Payment Verification');
  const [invoiceTargetStaffId, setInvoiceTargetStaffId] = useState('');
  const [invoiceNote, setInvoiceNote] = useState('');

  // Stock Transfer Request Modal State
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [stockSearch, setStockSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [manualSkuCode, setManualSkuCode] = useState('');
  const [manualProductName, setManualProductName] = useState('');
  const [stockUnitMode, setStockUnitMode] = useState<'Bottle' | 'Case'>('Bottle');
  const [stockQtyInput, setStockQtyInput] = useState<number>(12);
  const [fromBranchId, setFromBranchId] = useState<string>(() => branches[0]?.id || '');
  const [toBranchId, setToBranchId] = useState<string>(() => branches[1]?.id || branches[0]?.id || '');
  const [stockTargetStaffId, setStockTargetStaffId] = useState<string>('');
  const [stockUrgency, setStockUrgency] = useState<StockRequestUrgency>('Standard');
  const [stockNote, setStockNote] = useState('');

  // Inline note state for returning invoice or declining stock request (avoids window.prompt)
  const [inlineActionBox, setInlineActionBox] = useState<{
    messageId: string;
    mode: 'RETURN_INVOICE' | 'DECLINE_STOCK';
    note: string;
  } | null>(null);

  const [readTick, setReadTick] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Real-time Typing Signal State & Synchronization (Firestore + BroadcastChannel)
  const [typingSignalsMap, setTypingSignalsMap] = useState<
    Record<string, InternalChatTypingSignal>
  >({});
  const [typingClockMs, setTypingClockMs] = useState<number>(() => Date.now());

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const selectedThreadIdRef = useRef(selectedThreadId);
  selectedThreadIdRef.current = selectedThreadId;

  const typingChannelRef = useRef<BroadcastChannel | null>(null);
  const isSignalingTypingRef = useRef<boolean>(false);
  const lastSignaledThreadRef = useRef<string>('');
  const lastTypingWriteMsRef = useRef<number>(0);
  const typingIdleTimerRef = useRef<number | null>(null);

  const publishTypingPresence = (isTypingNow: boolean, explicitThreadId?: string) => {
    const user = currentUserRef.current;
    const targetThreadId = explicitThreadId || selectedThreadIdRef.current;
    if (!user || !targetThreadId) return;

    const safeDocId =
      user.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'staff_typing';
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const threadType = targetThreadId.startsWith('dm__') ? 'direct' : 'department';

    const fullSignal: InternalChatTypingSignal = {
      id: safeDocId,
      staffId: user.id,
      staffName: user.name,
      staffRole: user.role,
      branchName: user.branchName,
      threadId: targetThreadId,
      threadType,
      isTyping: isTypingNow,
      updatedAtMs: nowMs,
      updatedAt: nowIso,
    };

    try {
      typingChannelRef.current?.postMessage(fullSignal);
    } catch {
      // ignore broadcast errors
    }

    const { id: _omitId, ...firestoreDoc } = fullSignal;
    setDoc(doc(db, 'internal_chat_typing', safeDocId), cleanFirestoreData(firestoreDoc)).catch(
      (err) => {
        handleFirestoreError(err, OperationType.WRITE, `internal_chat_typing/${safeDocId}`);
      }
    );
  };

  const clearLocalTypingActivity = (explicitThreadId?: string) => {
    if (typingIdleTimerRef.current !== null) {
      window.clearTimeout(typingIdleTimerRef.current);
      typingIdleTimerRef.current = null;
    }
    if (isSignalingTypingRef.current) {
      const prevThread = explicitThreadId || lastSignaledThreadRef.current || selectedThreadIdRef.current;
      isSignalingTypingRef.current = false;
      lastTypingWriteMsRef.current = 0;
      publishTypingPresence(false, prevThread);
    }
  };

  const emitLocalTypingActivity = (draftValue: string) => {
    if (!draftValue.trim()) {
      clearLocalTypingActivity();
      return;
    }

    if (typingIdleTimerRef.current !== null) {
      window.clearTimeout(typingIdleTimerRef.current);
    }
    typingIdleTimerRef.current = window.setTimeout(() => {
      typingIdleTimerRef.current = null;
      if (isSignalingTypingRef.current) {
        isSignalingTypingRef.current = false;
        lastTypingWriteMsRef.current = 0;
        publishTypingPresence(false, lastSignaledThreadRef.current || selectedThreadIdRef.current);
      }
    }, TYPING_IDLE_TIMEOUT_MS);

    const nowMs = Date.now();
    const activeTid = selectedThreadIdRef.current;
    const threadChanged =
      isSignalingTypingRef.current &&
      lastSignaledThreadRef.current &&
      lastSignaledThreadRef.current !== activeTid;

    if (threadChanged) {
      publishTypingPresence(false, lastSignaledThreadRef.current);
    }

    if (
      !isSignalingTypingRef.current ||
      threadChanged ||
      nowMs - lastTypingWriteMsRef.current >= TYPING_THROTTLE_MS
    ) {
      isSignalingTypingRef.current = true;
      lastSignaledThreadRef.current = activeTid;
      lastTypingWriteMsRef.current = nowMs;
      publishTypingPresence(true, activeTid);
    }
  };

  // Subscribe to Firestore internal_chat_typing + instant BroadcastChannel
  useEffect(() => {
    let isUnmounted = false;

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('vaairo_internal_chat_typing');
        typingChannelRef.current = bc;
        bc.onmessage = (ev: MessageEvent<InternalChatTypingSignal>) => {
          if (isUnmounted || !ev.data || !ev.data.id) return;
          setTypingClockMs(Date.now());
          setTypingSignalsMap((prev) => ({
            ...prev,
            [ev.data.id]: ev.data,
          }));
        };
      } catch {
        typingChannelRef.current = null;
      }
    }

    let unsubFirestore: (() => void) | null = null;
    try {
      const colRef = collection(db, 'internal_chat_typing');
      unsubFirestore = onSnapshot(
        colRef,
        (snap) => {
          if (isUnmounted) return;
          const nextMap: Record<string, InternalChatTypingSignal> = {};
          snap.docs.forEach((d) => {
            const data = d.data() as Omit<InternalChatTypingSignal, 'id'>;
            nextMap[d.id] = { ...data, id: d.id };
          });
          setTypingClockMs(Date.now());
          setTypingSignalsMap(nextMap);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'internal_chat_typing');
        }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'internal_chat_typing');
    }

    const handleBeforeUnload = () => {
      if (isSignalingTypingRef.current) {
        isSignalingTypingRef.current = false;
        publishTypingPresence(false, lastSignaledThreadRef.current || selectedThreadIdRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isUnmounted = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (typingIdleTimerRef.current !== null) {
        window.clearTimeout(typingIdleTimerRef.current);
        typingIdleTimerRef.current = null;
      }
      if (isSignalingTypingRef.current) {
        isSignalingTypingRef.current = false;
        publishTypingPresence(false, lastSignaledThreadRef.current || selectedThreadIdRef.current);
      }
      unsubFirestore?.();
      try {
        typingChannelRef.current?.close();
      } catch {
        // ignore
      }
      typingChannelRef.current = null;
    };
  }, []);

  // Clear previous thread typing signal when user switches threads
  useEffect(() => {
    if (
      isSignalingTypingRef.current &&
      lastSignaledThreadRef.current &&
      lastSignaledThreadRef.current !== selectedThreadId
    ) {
      clearLocalTypingActivity(lastSignaledThreadRef.current);
    }
  }, [selectedThreadId]);

  const hasAnyRawTyping = useMemo(
    () =>
      Object.values(typingSignalsMap).some(
        (sig) => sig.isTyping && sig.staffId !== currentUser.id
      ),
    [typingSignalsMap, currentUser.id]
  );

  // Lightweight 1-second expiry ticker strictly while someone is actively typing
  useEffect(() => {
    if (!hasAnyRawTyping) return;
    const interval = window.setInterval(() => {
      setTypingClockMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, [hasAnyRawTyping]);

  // Active colleagues list (excluding currentUser for DMs)
  const activeColleagues = useMemo(() => {
    const others = staffList.filter((s) => s.id !== currentUser.id && s.status === 'Active');
    return others.sort((a, b) => {
      if (Boolean(a.isOnline) !== Boolean(b.isOnline)) {
        return a.isOnline ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [staffList, currentUser.id]);

  // Prioritized stock controllers/managers for Stock Transfer Requests
  const stockApproverCandidates = useMemo(() => {
    const priorityOrder: Record<string, number> = {
      'Inventory Controller': 1,
      'Branch Manager': 2,
      Admin: 3,
      'Delivery Manager': 4,
    };
    return [...activeColleagues].sort((a, b) => {
      const pa = priorityOrder[a.role] || 99;
      const pb = priorityOrder[b.role] || 99;
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  }, [activeColleagues]);

  // Resolve current thread metadata
  const activeChannelDef = useMemo(
    () => INTERNAL_DEPARTMENT_CHANNELS.find((c) => c.id === selectedThreadId) || null,
    [selectedThreadId]
  );

  const activeDirectPeer = useMemo(() => {
    if (!selectedThreadId.startsWith('dm__')) return null;
    const parts = selectedThreadId.split('__');
    const peerId = parts[1] === currentUser.id ? parts[2] : parts[1];
    return staffList.find((s) => s.id === peerId) || null;
  }, [selectedThreadId, currentUser.id, staffList]);

  // Latest message timestamp per thread+sender so typing clears the instant a message arrives
  const latestMsgMsByThreadSender = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of messages) {
      const key = `${m.threadId}::${m.senderId}`;
      const ts = Date.parse(m.createdAt || '');
      if (!Number.isNaN(ts) && (!map[key] || ts > map[key])) {
        map[key] = ts;
      }
    }
    return map;
  }, [messages]);

  // Live active typers grouped by threadId
  const activeTypersByThread = useMemo(() => {
    const grouped: Record<string, InternalChatTypingSignal[]> = {};
    for (const sig of Object.values(typingSignalsMap)) {
      if (!sig.isTyping) continue;
      if (sig.staffId === currentUser.id) continue;
      if (typingClockMs - sig.updatedAtMs >= TYPING_STALE_MS) continue;

      const isVisible =
        sig.threadType === 'department' || isDirectThreadParticipant(sig.threadId, currentUser.id);
      if (!isVisible) continue;

      const lastMsgMs = latestMsgMsByThreadSender[`${sig.threadId}::${sig.staffId}`] || 0;
      if (lastMsgMs >= sig.updatedAtMs - 250) continue;

      if (!grouped[sig.threadId]) {
        grouped[sig.threadId] = [];
      }
      grouped[sig.threadId].push(sig);
    }

    for (const tid of Object.keys(grouped)) {
      grouped[tid].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    }
    return grouped;
  }, [typingSignalsMap, currentUser.id, typingClockMs, latestMsgMsByThreadSender]);

  const currentThreadTypers = activeTypersByThread[selectedThreadId] || [];

  // Mark active thread as read whenever viewed or new messages arrive in it
  const currentThreadMessages = useMemo(() => {
    return messages
      .filter((m) => m.threadId === selectedThreadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [messages, selectedThreadId]);

  useEffect(() => {
    const latestTs =
      currentThreadMessages.length > 0
        ? currentThreadMessages[currentThreadMessages.length - 1].createdAt
        : new Date().toISOString();
    saveLastReadForThread(currentUser.id, selectedThreadId, latestTs);
    setReadTick((t) => t + 1);
  }, [selectedThreadId, currentThreadMessages.length, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadId, currentThreadMessages.length, currentThreadTypers.length]);

  const readMap = useMemo(() => {
    void readTick;
    return getLastReadMapForUser(currentUser.id);
  }, [currentUser.id, readTick]);

  // Per-thread stats (unread count, last message, pending actions)
  const threadStats = useMemo(() => {
    const stats: Record<
      string,
      {
        unread: number;
        actionable: number;
        lastMessage?: InternalChatMessage;
      }
    > = {};

    const sortedAsc = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const msg of sortedAsc) {
      if (!stats[msg.threadId]) {
        stats[msg.threadId] = { unread: 0, actionable: 0 };
      }
      stats[msg.threadId].lastMessage = msg;

      if (msg.senderId !== currentUser.id) {
        const lr = readMap[msg.threadId];
        if (!lr || msg.createdAt > lr) {
          stats[msg.threadId].unread++;
        }
      }

      const isPendingInvoice =
        msg.messageType === 'INVOICE_TRANSFER' &&
        msg.invoiceTransfer?.transferStatus === 'Pending Acceptance';
      const isPendingStock =
        msg.messageType === 'STOCK_TRANSFER_REQUEST' &&
        (msg.stockTransferRequest?.requestStatus === 'Pending Review' ||
          msg.stockTransferRequest?.requestStatus === 'Transfer Initiated');

      if (isPendingInvoice || isPendingStock) {
        stats[msg.threadId].actionable++;
      }
    }

    return stats;
  }, [messages, currentUser.id, readMap]);

  // Filtered Department Channels for left pane
  const visibleChannels = useMemo(() => {
    if (sidebarTab === 'direct') return [];
    const q = sidebarSearch.trim().toLowerCase();
    return INTERNAL_DEPARTMENT_CHANNELS.filter((ch) => {
      if (sidebarTab === 'actionable' && (threadStats[ch.id]?.actionable || 0) === 0) {
        return false;
      }
      if (!q) return true;
      return (
        ch.name.toLowerCase().includes(q) ||
        ch.departmentTag.toLowerCase().includes(q) ||
        ch.description.toLowerCase().includes(q)
      );
    });
  }, [sidebarTab, sidebarSearch, threadStats]);

  // Filtered Direct Colleagues for left pane
  const visibleColleagues = useMemo(() => {
    if (sidebarTab === 'departments') return [];
    const q = sidebarSearch.trim().toLowerCase();
    return activeColleagues.filter((col) => {
      const dmId = buildDirectThreadId(currentUser.id, col.id);
      if (sidebarTab === 'actionable' && (threadStats[dmId]?.actionable || 0) === 0) {
        return false;
      }
      if (!q) return true;
      return (
        col.name.toLowerCase().includes(q) ||
        col.role.toLowerCase().includes(q) ||
        col.branchName.toLowerCase().includes(q) ||
        (col.email || '').toLowerCase().includes(q)
      );
    });
  }, [sidebarTab, sidebarSearch, activeColleagues, currentUser.id, threadStats]);

  // Filtered messages inside active thread
  const displayedMessages = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    return currentThreadMessages.filter((msg) => {
      if (threadFilter === 'transfers_only' && msg.messageType === 'TEXT') {
        return false;
      }
      if (!q) return true;
      return (
        msg.body.toLowerCase().includes(q) ||
        msg.senderName.toLowerCase().includes(q) ||
        (msg.recipientStaffName || '').toLowerCase().includes(q) ||
        (msg.invoiceTransfer?.docNumber || '').toLowerCase().includes(q) ||
        (msg.invoiceTransfer?.customerName || '').toLowerCase().includes(q) ||
        (msg.stockTransferRequest?.sku || '').toLowerCase().includes(q) ||
        (msg.stockTransferRequest?.productName || '').toLowerCase().includes(q)
      );
    });
  }, [currentThreadMessages, threadFilter, threadSearch]);

  const handleOpenThread = (threadId: string) => {
    if (threadId !== selectedThreadId) {
      clearLocalTypingActivity(selectedThreadId);
    }
    setSelectedThreadId(threadId);
    setMobileShowConversation(true);
    saveLastReadForThread(currentUser.id, threadId);
    setReadTick((t) => t + 1);
  };

  // Pre-populate recipient when opening modals from a direct thread
  const openInvoiceTransferModal = () => {
    if (activeDirectPeer) {
      setInvoiceTargetStaffId(activeDirectPeer.id);
    } else if (taggedStaffId) {
      setInvoiceTargetStaffId(taggedStaffId);
    } else {
      const accountant = activeColleagues.find((s) => s.role === 'Accountant');
      setInvoiceTargetStaffId(accountant?.id || '');
    }
    if (!selectedTxId && transactions.length > 0) {
      setSelectedTxId(transactions[0].id);
    }
    setIsInvoiceModalOpen(true);
  };

  const openStockRequestModal = () => {
    if (activeDirectPeer) {
      setStockTargetStaffId(activeDirectPeer.id);
    } else if (taggedStaffId) {
      setStockTargetStaffId(taggedStaffId);
    } else if (stockApproverCandidates.length > 0) {
      setStockTargetStaffId(stockApproverCandidates[0].id);
    }
    if (!selectedProductId && products.length > 0) {
      setSelectedProductId(products[0].id);
    }
    if (branches.length >= 2) {
      const userBr = branches.find((b) => b.id === currentUser.branchId) || branches[0];
      const otherBr = branches.find((b) => b.id !== userBr.id) || branches[0];
      setToBranchId(userBr.id);
      setFromBranchId(otherBr.id);
    } else if (branches.length === 1) {
      setFromBranchId(branches[0].id);
      setToBranchId(branches[0].id);
    }
    setIsStockModalOpen(true);
  };

  // Send standard text message
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = messageText.trim();
    if (!cleanText || isSending) return;

    clearLocalTypingActivity(selectedThreadId);

    const recipient = activeDirectPeer || staffList.find((s) => s.id === taggedStaffId);
    const channelLabel = activeChannelDef
      ? activeChannelDef.name
      : activeDirectPeer
        ? `Direct: ${currentUser.name} & ${activeDirectPeer.name}`
        : 'Internal Inbox';

    setIsSending(true);
    try {
      await onSendMessage({
        threadId: selectedThreadId,
        threadType: activeDirectPeer ? 'direct' : 'department',
        channelName: channelLabel,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderBranchName: currentUser.branchName,
        recipientStaffId: recipient?.id,
        recipientStaffName: recipient?.name,
        recipientStaffRole: recipient?.role,
        recipientDepartment: activeChannelDef?.departmentTag,
        messageType: 'TEXT',
        body: cleanText,
        priority,
      });
      setMessageText('');
      setPriority('Normal');
    } finally {
      setIsSending(false);
    }
  };

  // Submit Invoice Transfer inside Chat
  const handleSubmitInvoiceTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const tx = transactions.find((t) => t.id === selectedTxId);
    if (!tx) {
      onTriggerToast('error', 'Select Document', 'Please choose an invoice or commercial document to transfer.');
      return;
    }

    const assignedPerson = staffList.find((s) => s.id === invoiceTargetStaffId) || activeDirectPeer || undefined;
    const channelLabel = activeChannelDef
      ? activeChannelDef.name
      : activeDirectPeer
        ? `Direct: ${currentUser.name} & ${activeDirectPeer.name}`
        : 'Internal Inbox';

    const summaryBody =
      invoiceNote.trim() ||
      `Transferred ${tx.docType} ${tx.docNumber} (${formatKes(tx.totalAmount)}) for ${invoicePurpose}${
        assignedPerson ? ` to ${assignedPerson.name}` : ''
      }.`;

    setIsSending(true);
    try {
      await onSendMessage({
        threadId: selectedThreadId,
        threadType: activeDirectPeer ? 'direct' : 'department',
        channelName: channelLabel,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderBranchName: currentUser.branchName,
        recipientStaffId: assignedPerson?.id,
        recipientStaffName: assignedPerson?.name,
        recipientStaffRole: assignedPerson?.role,
        recipientDepartment: activeChannelDef?.departmentTag,
        messageType: 'INVOICE_TRANSFER',
        body: summaryBody,
        priority: invoicePurpose === 'Manager Approval' || invoicePurpose === 'Payment Verification' ? 'Urgent' : 'Normal',
        invoiceTransfer: {
          transactionId: tx.id,
          docNumber: tx.docNumber,
          docType: tx.docType,
          customerName: tx.customerName,
          branchName: tx.branchName,
          totalAmount: tx.totalAmount,
          paymentMethod: tx.paymentMethod,
          docStatus: tx.status,
          transferPurpose: invoicePurpose,
          transferStatus: 'Pending Acceptance',
          assignedToStaffId: assignedPerson?.id,
          assignedToStaffName: assignedPerson?.name,
          assignedToRole: assignedPerson?.role,
        },
      });
      clearLocalTypingActivity(selectedThreadId);
      setIsInvoiceModalOpen(false);
      setInvoiceNote('');
      onTriggerToast(
        'success',
        `${tx.docType} Transferred in Chat`,
        `${tx.docNumber} sent${assignedPerson ? ` to ${assignedPerson.name}` : ''} for ${invoicePurpose}.`
      );
    } finally {
      setIsSending(false);
    }
  };

  // Submit Stock Transfer Request inside Chat
  const handleSubmitStockRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPerson = staffList.find((s) => s.id === stockTargetStaffId) || activeDirectPeer;
    if (!targetPerson) {
      onTriggerToast('error', 'Select Recipient', 'Please select the specific staff member to receive this stock request.');
      return;
    }

    const fromBr = branches.find((b) => b.id === fromBranchId);
    const toBr = branches.find((b) => b.id === toBranchId);
    if (!fromBr || !toBr) {
      onTriggerToast('error', 'Select Branches', 'Please select both source and destination branches.');
      return;
    }
    if (branches.length > 1 && fromBr.id === toBr.id) {
      onTriggerToast('error', 'Same Branch Selected', 'Source depot and destination depot must be different branches.');
      return;
    }

    const selectedProd = products.find((p) => p.id === selectedProductId);
    const sku = selectedProd ? selectedProd.sku : manualSkuCode.trim().toUpperCase();
    const prodName = selectedProd ? selectedProd.name : manualProductName.trim();
    const prodId = selectedProd ? selectedProd.id : `req-sku-${Date.now()}`;
    const packSize = selectedProd?.packSize || selectedProd?.bottlesPerCase || 12;

    if (!sku || !prodName) {
      onTriggerToast('error', 'Select Product SKU', 'Please select an inventory SKU or specify the requested product.');
      return;
    }

    const cleanUnits = Math.max(1, Math.round(Number(stockQtyInput) || 1));
    const totalBottles = stockUnitMode === 'Case' ? cleanUnits * packSize : cleanUnits;

    const channelLabel = activeChannelDef
      ? activeChannelDef.name
      : activeDirectPeer
        ? `Direct: ${currentUser.name} & ${activeDirectPeer.name}`
        : 'Internal Inbox';

    const summaryBody =
      stockNote.trim() ||
      `Stock transfer request to ${targetPerson.name}: ${totalBottles} btls of ${prodName} (${sku}) from ${fromBr.name} → ${toBr.name}.`;

    setIsSending(true);
    try {
      await onSendMessage({
        threadId: selectedThreadId,
        threadType: activeDirectPeer ? 'direct' : 'department',
        channelName: channelLabel,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderBranchName: currentUser.branchName,
        recipientStaffId: targetPerson.id,
        recipientStaffName: targetPerson.name,
        recipientStaffRole: targetPerson.role,
        recipientDepartment: activeChannelDef?.departmentTag || 'Inventory & Warehouse',
        messageType: 'STOCK_TRANSFER_REQUEST',
        body: summaryBody,
        priority: stockUrgency !== 'Standard' ? 'Urgent' : 'Normal',
        stockTransferRequest: {
          productId: prodId,
          sku,
          productName: prodName,
          quantityBottles: totalBottles,
          bottlesPerCase: packSize,
          fromBranchId: fromBr.id,
          fromBranchName: fromBr.name,
          toBranchId: toBr.id,
          toBranchName: toBr.name,
          requestedToStaffId: targetPerson.id,
          requestedToStaffName: targetPerson.name,
          requestedToRole: targetPerson.role,
          urgency: stockUrgency,
          requestStatus: 'Pending Review',
        },
      });
      clearLocalTypingActivity(selectedThreadId);
      setIsStockModalOpen(false);
      setStockNote('');
      setManualSkuCode('');
      setManualProductName('');
      onTriggerToast(
        'success',
        'Stock Request Sent in Chat',
        `Requested ${totalBottles} btls of ${sku} from ${targetPerson.name} (${targetPerson.role}).`
      );
    } finally {
      setIsSending(false);
    }
  };

  // Action on Invoice Transfer Card
  const handleInvoiceCardAction = async (
    msg: InternalChatMessage,
    nextStatus: InvoiceTransferStatus,
    note?: string
  ) => {
    if (!msg.invoiceTransfer) return;
    const nowIso = new Date().toISOString();
    const updatedPayload = {
      ...msg.invoiceTransfer,
      transferStatus: nextStatus,
      handledBy: currentUser.name,
      handledByRole: currentUser.role,
      handledAt: nowIso,
      ...(note ? { resolutionNote: note } : {}),
    };

    // If Accountant/Admin/Manager marks a Pending Verification invoice as Processed, update live doc status
    if (
      nextStatus === 'Processed' &&
      onUpdateTransaction &&
      (currentUser.role === 'Admin' ||
        currentUser.role === 'Accountant' ||
        currentUser.role === 'Branch Manager')
    ) {
      const liveTx = transactions.find((t) => t.id === msg.invoiceTransfer!.transactionId);
      if (liveTx && liveTx.status === 'Pending Verification') {
        await onUpdateTransaction(liveTx.id, { status: 'Approved' });
        updatedPayload.docStatus = 'Approved';
      }
    }

    await onUpdateMessage(msg.id, {
      invoiceTransfer: updatedPayload,
      updatedAt: nowIso,
    });
    setInlineActionBox(null);
    onTriggerToast(
      'success',
      `Invoice ${nextStatus}`,
      `${msg.invoiceTransfer.docNumber} marked as ${nextStatus} by ${currentUser.name}.`
    );
  };

  // Action on Stock Transfer Request Card -> Creates Official ERP StockTransfer
  const handleConvertStockRequestToTransfer = async (msg: InternalChatMessage) => {
    const req = msg.stockTransferRequest;
    if (!req) return;

    const isDirectApprover =
      currentUser.role === 'Admin' || currentUser.role === 'Branch Manager';

    const matchedProd = products.find((p) => p.id === req.productId || p.sku === req.sku);
    let updatedProdPayload: { productId: string; newBranchStockJson: string } | undefined;

    if (isDirectApprover && matchedProd) {
      let branchStock: Record<string, number> = {};
      try {
        branchStock = matchedProd.branchStockSummary ? JSON.parse(matchedProd.branchStockSummary) : {};
      } catch {
        branchStock = {};
      }
      const currentFrom =
        branchStock[req.fromBranchId] ??
        Math.floor((matchedProd.totalBottles || 0) / Math.max(1, branches.length));
      const actualDeduct = Math.min(Math.max(0, currentFrom), req.quantityBottles);
      branchStock[req.fromBranchId] = Math.max(0, currentFrom - actualDeduct);
      updatedProdPayload = {
        productId: matchedProd.id,
        newBranchStockJson: JSON.stringify(branchStock),
      };
    }

    const transferNo = `TRF-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const nowIso = new Date().toISOString();

    const created = await onCreateStockTransfer(
      {
        transferNo,
        fromBranchId: req.fromBranchId,
        fromBranchName: req.fromBranchName,
        toBranchId: req.toBranchId,
        toBranchName: req.toBranchName,
        productId: matchedProd?.id || req.productId,
        sku: req.sku,
        productName: req.productName,
        quantityBottles: req.quantityBottles,
        logisticsPartnerName: 'Internal Fleet Dispatch',
        vehicleReg: 'KDK-440T',
        excisePermitNo: `KRA-TR-${String(Date.now()).slice(-6)}`,
        status: isDirectApprover ? 'Dispatched' : 'Pending Authorization',
        initiatedBy: `${currentUser.name} (via Inbox Request from ${msg.senderName})`,
        initiatedByRole: currentUser.role,
        ...(isDirectApprover
          ? {
              authorizedBy: currentUser.name,
              authorizedByRole: currentUser.role,
              authorizedAt: nowIso,
            }
          : {}),
      },
      updatedProdPayload
    );

    await onUpdateMessage(msg.id, {
      stockTransferRequest: {
        ...req,
        requestStatus: isDirectApprover ? 'Authorized & Dispatched' : 'Transfer Initiated',
        linkedTransferId: created && 'id' in created ? created.id : undefined,
        linkedTransferNo: created && 'transferNo' in created ? created.transferNo : transferNo,
        actionedBy: currentUser.name,
        actionedByRole: currentUser.role,
        actionedAt: nowIso,
      },
      updatedAt: nowIso,
    });
  };

  // Authorize an already-initiated Pending Authorization StockTransfer directly from Chat Card
  const handleAuthorizeLinkedTransferInChat = async (
    msg: InternalChatMessage,
    linkedTransfer: StockTransfer
  ) => {
    if (!msg.stockTransferRequest) return;
    await onAuthorizeStockTransfer(linkedTransfer.id);
    const nowIso = new Date().toISOString();
    await onUpdateMessage(msg.id, {
      stockTransferRequest: {
        ...msg.stockTransferRequest,
        requestStatus: 'Authorized & Dispatched',
        actionedBy: currentUser.name,
        actionedByRole: currentUser.role,
        actionedAt: nowIso,
      },
      updatedAt: nowIso,
    });
  };

  // Decline Stock Transfer Request in Chat
  const handleDeclineStockRequest = async (msg: InternalChatMessage, note: string) => {
    const req = msg.stockTransferRequest;
    if (!req) return;

    if (req.linkedTransferId) {
      const linked = transfers.find((t) => t.id === req.linkedTransferId);
      if (linked && linked.status === 'Pending Authorization') {
        await onRejectStockTransfer(linked.id);
      }
    }

    const nowIso = new Date().toISOString();
    await onUpdateMessage(msg.id, {
      stockTransferRequest: {
        ...req,
        requestStatus: 'Declined',
        actionedBy: currentUser.name,
        actionedByRole: currentUser.role,
        actionedAt: nowIso,
        actionNote: note.trim() || 'Declined in department inbox',
      },
      updatedAt: nowIso,
    });
    setInlineActionBox(null);
    onTriggerToast(
      'success',
      'Stock Request Declined',
      `Declined stock request for ${req.quantityBottles} btls of ${req.sku}.`
    );
  };

  // Filtered invoices for modal
  const filteredTransactions = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    const list = [...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!q) return list.slice(0, 40);
    return list
      .filter(
        (t) =>
          t.docNumber.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.docType.toLowerCase().includes(q) ||
          t.branchName.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [transactions, invoiceSearch]);

  // Filtered products for modal
  const filteredProducts = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.includes(q))
      )
      .slice(0, 40);
  }, [products, stockSearch]);

  const selectedProductObj = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const getBranchStockForProduct = (prod: Product | null, branchId: string): number => {
    if (!prod) return 0;
    try {
      const map = prod.branchStockSummary ? JSON.parse(prod.branchStockSummary) : {};
      if (typeof map[branchId] === 'number') return map[branchId];
    } catch {
      // ignore
    }
    return prod.totalBottles || 0;
  };

  return (
    <div className="space-y-4">
      {/* Top Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 border-2 border-[#FFDE00]/40">
            <Inbox className="w-5 h-5 stroke-[2.3]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-montserrat font-black text-lg sm:text-xl text-[#0A006E] tracking-tight">
                Internal Inbox &amp; Department Chat
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-montserrat font-black uppercase tracking-wider bg-[#0A006E] text-[#FFDE00]">
                {currentUser.role}
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Transfer invoices across departments &amp; send targeted stock transfer requests to specific staff in real time.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openInvoiceTransferModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-[#0A006E] border-2 border-[#0A006E] text-xs font-montserrat font-black transition cursor-pointer whitespace-nowrap"
          >
            <FileText className="w-4 h-4 text-[#0A006E]" />
            <span>Transfer Invoice</span>
          </button>

          <button
            type="button"
            onClick={openStockRequestModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#150099] text-[#FFDE00] border-2 border-[#0A006E] text-xs font-montserrat font-black transition cursor-pointer whitespace-nowrap"
          >
            <ArrowRightLeft className="w-4 h-4 text-[#FFDE00]" />
            <span>Request Stock Transfer</span>
          </button>
        </div>
      </div>

      {/* Main Split Inbox Shell */}
      <div className="border border-slate-200 rounded-2xl bg-white overflow-hidden grid grid-cols-1 lg:grid-cols-12 h-[calc(100vh-130px)] sm:h-[calc(100vh-200px)] min-h-[520px] max-h-[860px]">
        {/* LEFT PANE: Department Channels & Direct People Directory */}
        <aside
          className={`lg:col-span-4 xl:col-span-4 border-r border-slate-200 bg-slate-50/70 flex flex-col min-h-0 ${
            mobileShowConversation ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search & Segmented Filter */}
          <div className="p-3.5 bg-white border-b border-slate-200 space-y-2.5 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search department or staff name..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-[#0A006E] focus:bg-white text-xs font-montserrat font-semibold text-slate-900 outline-none transition"
              />
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'departments', label: 'Depts' },
                  { id: 'direct', label: 'People' },
                  { id: 'actionable', label: 'Pending' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSidebarTab(tab.id)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-montserrat font-bold transition cursor-pointer text-center ${
                    sidebarTab === tab.id
                      ? 'bg-[#0A006E] text-[#FFDE00]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Thread List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-200/70">
            {/* Department Channels Section */}
            {visibleChannels.length > 0 && (
              <div className="py-2">
                <div className="px-3.5 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-slate-500">
                    Department Channels ({visibleChannels.length})
                  </span>
                </div>
                <div className="space-y-0.5 px-2">
                  {visibleChannels.map((ch) => {
                    const isSelected = selectedThreadId === ch.id;
                    const st = threadStats[ch.id];
                    const IconComp = ch.icon;
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleOpenThread(ch.id)}
                        className={`w-full p-2.5 rounded-xl text-left flex items-start gap-2.5 transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[#0A006E] text-white border-[#0A006E]'
                            : st?.unread
                              ? 'bg-red-50/80 hover:bg-red-50 text-slate-900 border-red-300'
                              : 'bg-transparent hover:bg-white text-slate-900 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-[#FFDE00] text-[#0A006E]'
                              : st?.unread
                                ? 'bg-red-600 text-white'
                                : 'bg-white border border-slate-200 text-[#0A006E]'
                          }`}
                        >
                          <IconComp className="w-4 h-4 stroke-[2.2]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-xs font-montserrat font-black truncate ${
                                isSelected
                                  ? 'text-white'
                                  : st?.unread
                                    ? 'text-red-700'
                                    : 'text-slate-900'
                              }`}
                            >
                              {ch.shortLabel}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {st?.actionable ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-black ${
                                    isSelected
                                      ? 'bg-[#FFDE00] text-[#0A006E]'
                                      : 'bg-amber-100 text-amber-900'
                                  }`}
                                  title={`${st.actionable} open invoice/stock action(s)`}
                                >
                                  {st.actionable} act
                                </span>
                              ) : null}
                              {st?.unread ? (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono-tabular font-black flex items-center justify-center">
                                  {st.unread}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {activeTypersByThread[ch.id]?.length ? (
                            <div
                              className={`text-[11px] font-montserrat font-bold truncate pt-0.5 flex items-center gap-1.5 ${
                                isSelected ? 'text-[#FFDE00]' : 'text-emerald-700'
                              }`}
                            >
                              <AnimatedTypingDots
                                dotClassName={isSelected ? 'bg-[#FFDE00]' : 'bg-emerald-600'}
                              />
                              <span className="truncate">
                                {formatTypingSentence(activeTypersByThread[ch.id], false)}...
                              </span>
                            </div>
                          ) : (
                            <p
                              className={`text-[11px] truncate pt-0.5 ${
                                isSelected ? 'text-slate-200' : 'text-slate-500'
                              }`}
                            >
                              {st?.lastMessage
                                ? `${st.lastMessage.senderName.split(' ')[0]}: ${st.lastMessage.body}`
                                : ch.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct Staff Directory Section */}
            {visibleColleagues.length > 0 && (
              <div className="py-2">
                <div className="px-3.5 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-montserrat font-black uppercase tracking-wider text-slate-500">
                    Direct Staff &amp; Approvers ({visibleColleagues.length})
                  </span>
                </div>
                <div className="space-y-0.5 px-2">
                  {visibleColleagues.map((person) => {
                    const dmId = buildDirectThreadId(currentUser.id, person.id);
                    const isSelected = selectedThreadId === dmId;
                    const st = threadStats[dmId];
                    const isPersonTyping = Boolean(activeTypersByThread[dmId]?.length);
                    const initials = person.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => handleOpenThread(dmId)}
                        className={`w-full p-2.5 rounded-xl text-left flex items-center gap-2.5 transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[#0A006E] text-white border-[#0A006E]'
                            : st?.unread
                              ? 'bg-red-50/80 hover:bg-red-50 text-slate-900 border-red-300'
                              : 'bg-transparent hover:bg-white text-slate-900 border-transparent hover:border-slate-200'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-montserrat font-black text-xs ${
                              isSelected
                                ? 'bg-[#FFDE00] text-[#0A006E]'
                                : st?.unread
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-200 text-[#0A006E]'
                            }`}
                          >
                            {initials}
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full border-2 border-white absolute -bottom-0.5 -right-0.5 ${
                              isPersonTyping
                                ? 'bg-emerald-500 ring-2 ring-emerald-300 animate-pulse'
                                : person.isOnline
                                  ? 'bg-emerald-500'
                                  : 'bg-slate-400'
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`text-xs font-montserrat font-bold truncate ${
                                isSelected
                                  ? 'text-white'
                                  : st?.unread
                                    ? 'text-red-700'
                                    : 'text-slate-900'
                              }`}
                            >
                              {person.name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {st?.actionable ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tabular font-black ${
                                    isSelected
                                      ? 'bg-[#FFDE00] text-[#0A006E]'
                                      : 'bg-amber-100 text-amber-900'
                                  }`}
                                >
                                  {st.actionable}
                                </span>
                              ) : null}
                              {st?.unread ? (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-mono-tabular font-black flex items-center justify-center">
                                  {st.unread}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {isPersonTyping ? (
                            <div
                              className={`text-[10px] font-montserrat font-bold truncate flex items-center gap-1.5 ${
                                isSelected ? 'text-[#FFDE00]' : 'text-emerald-700'
                              }`}
                            >
                              <AnimatedTypingDots
                                dotClassName={isSelected ? 'bg-[#FFDE00]' : 'bg-emerald-600'}
                              />
                              <span>Typing...</span>
                            </div>
                          ) : (
                            <div
                              className={`text-[10px] truncate flex items-center gap-1 ${
                                isSelected ? 'text-[#FFDE00]' : 'text-slate-500'
                              }`}
                            >
                              <span className="font-semibold">{person.role}</span>
                              <span>·</span>
                              <span className="truncate">{person.branchName}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {visibleChannels.length === 0 && visibleColleagues.length === 0 && (
              <div className="p-8 text-center text-slate-500 space-y-1">
                <MessageSquare className="w-7 h-7 mx-auto text-slate-300" />
                <div className="text-xs font-montserrat font-bold text-slate-700">
                  No matching channels or staff
                </div>
                <p className="text-[11px] text-slate-500">
                  Clear your search or switch filter tabs above.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* RIGHT PANE: Active Conversation & Transfer Action Stream */}
        <section
          className={`lg:col-span-8 xl:col-span-8 flex flex-col min-h-0 bg-white ${
            !mobileShowConversation ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Conversation Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileShowConversation(false)}
                className="lg:hidden w-10 h-10 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[#0A006E] flex items-center justify-center shrink-0 cursor-pointer transition shadow-xs"
                aria-label="Back to inbox list"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>

              <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0 font-montserrat font-black text-xs">
                {activeChannelDef ? (
                  <Hash className="w-4 h-4" />
                ) : (
                  (activeDirectPeer?.name || 'DM').slice(0, 2).toUpperCase()
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-montserrat font-black text-sm text-slate-900 truncate">
                    {activeChannelDef
                      ? activeChannelDef.name
                      : activeDirectPeer
                        ? activeDirectPeer.name
                        : 'Department Thread'}
                  </h2>
                  {activeDirectPeer && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-montserrat font-bold bg-slate-100 text-[#0A006E] shrink-0">
                      {activeDirectPeer.role}
                    </span>
                  )}
                </div>
                {currentThreadTypers.length > 0 ? (
                  <div
                    aria-live="polite"
                    className="text-[11px] font-montserrat font-bold text-emerald-700 truncate flex items-center gap-1.5"
                  >
                    <AnimatedTypingDots dotClassName="bg-emerald-600" />
                    <span className="truncate">
                      {activeDirectPeer
                        ? 'Typing a message...'
                        : `${formatTypingSentence(currentThreadTypers, true)}...`}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 truncate">
                    {activeChannelDef
                      ? activeChannelDef.description
                      : activeDirectPeer
                        ? `${activeDirectPeer.branchName} · Direct 1-on-1 Invoice & Stock Desk`
                        : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Thread Filter & Search */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="Filter messages / doc #..."
                  className="w-36 sm:w-44 pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 focus:border-[#0A006E] text-[11px] font-montserrat text-slate-800 outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setThreadFilter((prev) => (prev === 'all' ? 'transfers_only' : 'all'))
                }
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition ${
                  threadFilter === 'transfers_only'
                    ? 'bg-[#0A006E] text-[#FFDE00] border-[#0A006E]'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title="Show only Invoice Transfers & Stock Transfer Requests"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Transfers</span>
              </button>
            </div>
          </div>

          {/* Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/40">
            {displayedMessages.length === 0 ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-2xl bg-[#0A006E]/10 text-[#0A006E] flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <h3 className="font-montserrat font-black text-sm text-slate-900">
                  {threadFilter === 'transfers_only'
                    ? 'No Invoice or Stock Transfers in This Thread Yet'
                    : 'Start Inter-Department Coordination'}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                  Send a direct note, transfer an invoice for verification or dispatch, or request an inter-branch stock transfer addressed to a specific team member.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={openInvoiceTransferModal}
                    className="px-3.5 py-2 rounded-xl border border-[#0A006E] bg-white hover:bg-slate-50 text-[#0A006E] text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Transfer an Invoice</span>
                  </button>
                  <button
                    type="button"
                    onClick={openStockRequestModal}
                    className="px-3.5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#150099] text-[#FFDE00] text-xs font-montserrat font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>Request Stock Transfer</span>
                  </button>
                </div>
              </div>
            ) : (
              displayedMessages.map((msg) => {
                const isMine = msg.senderId === currentUser.id;
                const inv = msg.invoiceTransfer;
                const stk = msg.stockTransferRequest;
                const linkedLiveTx = inv
                  ? transactions.find((t) => t.id === inv.transactionId)
                  : undefined;
                const linkedLiveTransfer = stk?.linkedTransferId
                  ? transfers.find((t) => t.id === stk.linkedTransferId)
                  : stk?.linkedTransferNo
                    ? transfers.find((t) => t.transferNo === stk.linkedTransferNo)
                    : undefined;

                const canActOnStockRequest =
                  Boolean(stk) &&
                  (currentUser.id === stk?.requestedToStaffId ||
                    currentUser.role === 'Inventory Controller' ||
                    currentUser.role === 'Branch Manager' ||
                    currentUser.role === 'Admin');

                const canManagerAuthorizeStock =
                  currentUser.role === 'Admin' || currentUser.role === 'Branch Manager';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    {/* Sender & Timestamp Meta */}
                    <div className="flex items-center gap-2 px-1 mb-1 text-[11px]">
                      <span className="font-montserrat font-black text-slate-800">
                        {isMine ? 'You' : msg.senderName}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 text-[10px] font-montserrat font-bold">
                        {msg.senderRole}
                      </span>
                      {msg.recipientStaffName && msg.threadType === 'department' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#0A006E]/10 text-[#0A006E] text-[10px] font-montserrat font-bold">
                          <CornerDownRight className="w-3 h-3" />@{msg.recipientStaffName}
                        </span>
                      )}
                      {msg.priority === 'Urgent' && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-montserrat font-black uppercase">
                          Urgent
                        </span>
                      )}
                      <span className="font-mono-tabular text-[10px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Message Body / Interactive Card */}
                    <div
                      className={`max-w-full sm:max-w-[86%] rounded-2xl border p-3.5 space-y-2.5 ${
                        msg.messageType !== 'TEXT'
                          ? 'bg-white border-slate-300 w-full sm:w-[540px]'
                          : isMine
                            ? 'bg-[#0A006E] text-white border-[#0A006E]'
                            : 'bg-white text-slate-900 border-slate-200'
                      }`}
                    >
                      {/* 1. INVOICE TRANSFER INTERACTIVE CARD */}
                      {msg.messageType === 'INVOICE_TRANSFER' && inv && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-[10px] font-montserrat font-black uppercase tracking-wider text-[#0A006E]">
                                  Transferred {inv.docType} · {inv.transferPurpose}
                                </div>
                                <div className="font-mono-tabular font-black text-sm text-slate-900">
                                  {inv.docNumber}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-1 rounded-lg text-[10px] font-montserrat font-black uppercase shrink-0 ${
                                inv.transferStatus === 'Processed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.transferStatus === 'Accepted'
                                    ? 'bg-blue-100 text-blue-800'
                                    : inv.transferStatus === 'Returned'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {inv.transferStatus}
                            </span>
                          </div>

                          {/* Invoice Metadata Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold">Amount</div>
                              <div className="font-mono-tabular font-black text-[#0A006E]">
                                {formatKes(inv.totalAmount)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold">Customer</div>
                              <div className="font-montserrat font-bold text-slate-900 truncate">
                                {inv.customerName}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold">Payment / Doc</div>
                              <div className="font-montserrat font-semibold text-slate-700 truncate">
                                {inv.paymentMethod} ({linkedLiveTx?.status || inv.docStatus})
                              </div>
                            </div>
                          </div>

                          {inv.assignedToStaffName && (
                            <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[#0A006E]/5 text-[#0A006E] font-montserrat font-bold">
                              <span className="flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5" />
                                Assigned To: {inv.assignedToStaffName}
                                {inv.assignedToRole ? ` (${inv.assignedToRole})` : ''}
                              </span>
                              <span className="text-[10px] text-slate-500">{inv.branchName}</span>
                            </div>
                          )}

                          {msg.body && (
                            <p className="text-xs text-slate-700 leading-relaxed">{msg.body}</p>
                          )}

                          {inv.handledBy && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                              <span className="font-bold text-slate-800">{inv.transferStatus}</span> by{' '}
                              <span className="font-semibold">{inv.handledBy}</span> ({inv.handledByRole})
                              {inv.resolutionNote ? ` — "${inv.resolutionNote}"` : ''}
                            </div>
                          )}

                          {/* Inline Return Note Input */}
                          {inlineActionBox?.messageId === msg.id &&
                            inlineActionBox.mode === 'RETURN_INVOICE' && (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  value={inlineActionBox.note}
                                  onChange={(e) =>
                                    setInlineActionBox({ ...inlineActionBox, note: e.target.value })
                                  }
                                  placeholder="Reason for returning / flagging invoice..."
                                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-[#0A006E]"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInvoiceCardAction(msg, 'Returned', inlineActionBox.note)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-montserrat font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineActionBox(null)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                          {/* Action Bar */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {linkedLiveTx && (
                              <button
                                type="button"
                                onClick={() => onPreviewDoc(linkedLiveTx)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-[#0A006E] bg-white text-slate-800 text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#0A006E]" />
                                <span>View / Print {inv.docType}</span>
                              </button>
                            )}

                            {linkedLiveTx &&
                              onInspectOrder &&
                              (linkedLiveTx.docType === 'Online Order' ||
                                Boolean(linkedLiveTx.deliveryAddress)) && (
                                <button
                                  type="button"
                                  onClick={() => onInspectOrder(linkedLiveTx)}
                                  className="px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-[#0A006E] text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  <span>Order Delivery</span>
                                </button>
                              )}

                            {inv.transferStatus === 'Pending Acceptance' && (
                              <button
                                type="button"
                                onClick={() => handleInvoiceCardAction(msg, 'Accepted')}
                                className="px-2.5 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#150099] text-[#FFDE00] text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Accept Invoice</span>
                              </button>
                            )}

                            {(inv.transferStatus === 'Pending Acceptance' ||
                              inv.transferStatus === 'Accepted') && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleInvoiceCardAction(msg, 'Processed')}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#1E9E60] hover:bg-emerald-700 text-white text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Mark Processed</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineActionBox({
                                      messageId: msg.id,
                                      mode: 'RETURN_INVOICE',
                                      note: '',
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Return</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 2. STOCK TRANSFER REQUEST INTERACTIVE CARD */}
                      {msg.messageType === 'STOCK_TRANSFER_REQUEST' && stk && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                                <ArrowRightLeft className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-[10px] font-montserrat font-black uppercase tracking-wider text-emerald-800">
                                  Stock Transfer Request · {stk.urgency}
                                </div>
                                <div className="font-montserrat font-black text-sm text-slate-900">
                                  {stk.productName}{' '}
                                  <span className="font-mono-tabular text-xs text-slate-500">
                                    ({stk.sku})
                                  </span>
                                </div>
                              </div>
                            </div>

                            <span
                              className={`px-2 py-1 rounded-lg text-[10px] font-montserrat font-black uppercase shrink-0 ${
                                linkedLiveTransfer?.status === 'Received' ||
                                stk.requestStatus === 'Authorized & Dispatched' ||
                                linkedLiveTransfer?.status === 'Dispatched'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : stk.requestStatus === 'Transfer Initiated'
                                    ? 'bg-blue-100 text-blue-800'
                                    : stk.requestStatus === 'Declined' ||
                                        linkedLiveTransfer?.status === 'Rejected'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {linkedLiveTransfer?.status === 'Received'
                                ? 'Received at Branch'
                                : linkedLiveTransfer?.status === 'Dispatched'
                                  ? 'Authorized & Dispatched'
                                  : linkedLiveTransfer?.status === 'Rejected'
                                    ? 'Rejected'
                                    : stk.requestStatus}
                            </span>
                          </div>

                          {/* Quantity & Route Summary */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                            <div>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                Requested Qty
                              </div>
                              <div className="font-mono-tabular font-black text-[#0A006E]">
                                {stk.quantityBottles} btls
                                {stk.bottlesPerCase
                                  ? ` (${(stk.quantityBottles / stk.bottlesPerCase).toFixed(1)} cs)`
                                  : ''}
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="text-[10px] text-slate-500 font-semibold">
                                Inter-Branch Route
                              </div>
                              <div className="font-montserrat font-bold text-slate-900 truncate">
                                {stk.fromBranchName} → {stk.toBranchName}
                              </div>
                            </div>
                          </div>

                          {/* Specific Person Addressed Banner */}
                          <div className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-[#0A006E]/5 text-[#0A006E] font-montserrat font-bold">
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 shrink-0" />
                              Requested To: {stk.requestedToStaffName} ({stk.requestedToRole})
                            </span>
                            {stk.linkedTransferNo && (
                              <span className="font-mono-tabular text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                                {stk.linkedTransferNo}
                              </span>
                            )}
                          </div>

                          {msg.body && (
                            <p className="text-xs text-slate-700 leading-relaxed">{msg.body}</p>
                          )}

                          {stk.actionedBy && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                              Actioned by <span className="font-bold text-slate-800">{stk.actionedBy}</span> (
                              {stk.actionedByRole})
                              {stk.actionNote ? ` — "${stk.actionNote}"` : ''}
                            </div>
                          )}

                          {/* Inline Decline Reason */}
                          {inlineActionBox?.messageId === msg.id &&
                            inlineActionBox.mode === 'DECLINE_STOCK' && (
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="text"
                                  value={inlineActionBox.note}
                                  onChange={(e) =>
                                    setInlineActionBox({ ...inlineActionBox, note: e.target.value })
                                  }
                                  placeholder="Reason for declining stock request..."
                                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs outline-none focus:border-[#0A006E]"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeclineStockRequest(msg, inlineActionBox.note)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-montserrat font-bold cursor-pointer"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setInlineActionBox(null)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {stk.requestStatus === 'Pending Review' && canActOnStockRequest && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleConvertStockRequestToTransfer(msg)}
                                  className="px-3 py-1.5 rounded-lg bg-[#1E9E60] hover:bg-emerald-700 text-white text-[11px] font-montserrat font-bold flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>
                                    {canManagerAuthorizeStock
                                      ? 'Authorize & Dispatch Stock'
                                      : 'Initiate Transfer (Queue Manager Auth)'}
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setInlineActionBox({
                                      messageId: msg.id,
                                      mode: 'DECLINE_STOCK',
                                      note: '',
                                    })
                                  }
                                  className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Decline</span>
                                </button>
                              </>
                            )}

                            {/* If Inventory Controller already initiated it, allow Manager/Admin to authorize right here */}
                            {stk.requestStatus === 'Transfer Initiated' &&
                              linkedLiveTransfer?.status === 'Pending Authorization' &&
                              canManagerAuthorizeStock && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAuthorizeLinkedTransferInChat(msg, linkedLiveTransfer)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#150099] text-[#FFDE00] text-[11px] font-montserrat font-black flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Authorize Dispatch ({linkedLiveTransfer.transferNo})</span>
                                </button>
                              )}

                            {stk.requestStatus === 'Transfer Initiated' &&
                              linkedLiveTransfer?.status === 'Pending Authorization' &&
                              !canManagerAuthorizeStock && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-montserrat font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                                  <Clock className="w-3.5 h-3.5" />
                                  Awaiting Branch Manager / Admin Authorization
                                </span>
                              )}
                          </div>
                        </div>
                      )}

                      {/* 3. STANDARD TEXT MESSAGE */}
                      {msg.messageType === 'TEXT' && (
                        <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {/* Live Typing Bubble in Conversation Stream */}
            <AnimatePresence initial={false}>
              {currentThreadTypers.length > 0 && (
                <motion.div
                  key="live-typing-indicator"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  aria-live="polite"
                  className="flex items-center gap-2.5 pt-1"
                >
                  <div className="flex -space-x-1.5 shrink-0">
                    {currentThreadTypers.slice(0, 2).map((typer) => {
                      const initials = typer.staffName
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <div
                          key={typer.staffId}
                          className="w-7 h-7 rounded-xl bg-[#0A006E] text-[#FFDE00] border-2 border-white flex items-center justify-center text-[10px] font-montserrat font-black"
                        >
                          {initials}
                        </div>
                      );
                    })}
                  </div>

                  <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl rounded-bl-sm bg-white border border-emerald-200 shadow-xs">
                    <AnimatedTypingDots dotClassName="bg-emerald-600" />
                    <span className="text-xs font-montserrat font-bold text-slate-700">
                      {formatTypingSentence(currentThreadTypers, true)}...
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Composer Footer */}
          <form
            onSubmit={handleSendText}
            className="p-3 border-t border-slate-200 bg-white space-y-2 shrink-0"
          >
            {/* Quick Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={openInvoiceTransferModal}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0A006E] text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Attach / Transfer Invoice</span>
                </button>

                <button
                  type="button"
                  onClick={openStockRequestModal}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer transition"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Request Stock Transfer</span>
                </button>

                {/* Optional @Person Tag when posting in a Department channel */}
                {activeChannelDef && activeColleagues.length > 0 && (
                  <select
                    value={taggedStaffId}
                    onChange={(e) => setTaggedStaffId(e.target.value)}
                    aria-label="Direct to specific person in channel"
                    className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-[11px] font-montserrat font-semibold text-slate-700 outline-none focus:border-[#0A006E]"
                  >
                    <option value="">@ Everyone in Channel</option>
                    {activeColleagues.map((s) => (
                      <option key={s.id} value={s.id}>
                        @{s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={() => setPriority((p) => (p === 'Normal' ? 'Urgent' : 'Normal'))}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold flex items-center gap-1 cursor-pointer border transition ${
                  priority === 'Urgent'
                    ? 'bg-rose-50 text-rose-700 border-rose-300'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>{priority === 'Urgent' ? 'Urgent Priority' : 'Normal'}</span>
              </button>
            </div>

            {/* Text Input + Send */}
            <div className="flex items-end gap-2">
              <textarea
                rows={2}
                value={messageText}
                onChange={(e) => {
                  const val = e.target.value;
                  setMessageText(val);
                  emitLocalTypingActivity(val);
                }}
                onBlur={() => clearLocalTypingActivity()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText(e);
                  }
                }}
                placeholder={
                  activeDirectPeer
                    ? `Message ${activeDirectPeer.name} (${activeDirectPeer.role})...`
                    : `Write to ${activeChannelDef?.shortLabel || 'department'}... (Enter to send)`
                }
                className="flex-1 resize-none rounded-xl border border-slate-300 focus:border-[#0A006E] px-3 py-2 text-xs sm:text-sm font-montserrat text-slate-900 outline-none transition"
              />
              <button
                type="submit"
                disabled={!messageText.trim() || isSending}
                className="h-10 px-4 rounded-xl bg-[#0A006E] hover:bg-[#150099] disabled:opacity-40 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer transition shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* =====================================================================
          MODAL 1: TRANSFER INVOICE / COMMERCIAL DOCUMENT INSIDE CHAT
          ===================================================================== */}
      {isInvoiceModalOpen && (
        <div
          onClick={() => setIsInvoiceModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border-2 border-[#0A006E] max-w-xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 bg-[#0A006E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#FFDE00]" />
                <div>
                  <h3 className="font-montserrat font-black text-sm text-white">
                    Transfer Invoice / Document in Chat
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Posting to:{' '}
                    {activeChannelDef ? activeChannelDef.shortLabel : activeDirectPeer?.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInvoiceModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitInvoiceTransfer} className="p-5 overflow-y-auto space-y-4">
              {/* Search & Select Invoice */}
              <div className="space-y-2">
                <label className="block text-xs font-montserrat font-black text-slate-800">
                  1. Select Commercial Invoice / Document
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    placeholder="Search invoice #, customer, receipt, or branch..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat outline-none"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No commercial invoices or receipts recorded yet. Issue an invoice or receipt in POS first.
                    </div>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const active = selectedTxId === tx.id;
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => setSelectedTxId(tx.id)}
                          className={`w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                            active ? 'bg-[#0A006E] text-white' : 'hover:bg-white text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono-tabular font-black text-xs ${
                                  active ? 'text-[#FFDE00]' : 'text-[#0A006E]'
                                }`}
                              >
                                {tx.docNumber}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  active
                                    ? 'bg-white/15 text-white'
                                    : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {tx.docType}
                              </span>
                            </div>
                            <div
                              className={`text-[11px] truncate ${
                                active ? 'text-slate-200' : 'text-slate-500'
                              }`}
                            >
                              {tx.customerName} · {tx.branchName}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className={`font-mono-tabular font-black text-xs ${
                                active ? 'text-white' : 'text-slate-900'
                              }`}
                            >
                              {formatKes(tx.totalAmount)}
                            </div>
                            <div
                              className={`text-[10px] ${
                                active ? 'text-[#FFDE00]' : 'text-slate-500'
                              }`}
                            >
                              {tx.status}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Purpose & Specific Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    2. Transfer Action / Purpose
                  </label>
                  <select
                    value={invoicePurpose}
                    onChange={(e) => setInvoicePurpose(e.target.value as InvoiceTransferPurpose)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-semibold bg-white outline-none"
                  >
                    {INVOICE_PURPOSES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    3. Assign to Specific Person
                  </label>
                  <select
                    value={invoiceTargetStaffId}
                    onChange={(e) => setInvoiceTargetStaffId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-semibold bg-white outline-none"
                  >
                    <option value="">Any Available Department Officer</option>
                    {activeColleagues.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Handover Note */}
              <div>
                <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                  4. Handover Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  value={invoiceNote}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInvoiceNote(val);
                    emitLocalTypingActivity(val);
                  }}
                  onBlur={() => clearLocalTypingActivity()}
                  placeholder="e.g., Confirm M-Pesa settlement code before releasing rider dispatch..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-montserrat font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedTxId || isSending}
                  className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#150099] disabled:opacity-40 text-[#FFDE00] text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Transfer Invoice in Chat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: REQUEST STOCK TRANSFER TO SPECIFIC PERSON INSIDE CHAT
          ===================================================================== */}
      {isStockModalOpen && (
        <div
          onClick={() => setIsStockModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl border-2 border-[#0A006E] max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="px-5 py-4 bg-[#0A006E] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="w-5 h-5 text-[#FFDE00]" />
                <div>
                  <h3 className="font-montserrat font-black text-sm text-white">
                    Request Inter-Branch Stock Transfer
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Address directly to an Inventory Controller, Branch Manager, or specific colleague
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitStockRequest} className="p-5 overflow-y-auto space-y-4">
              {/* 1. Specific Recipient Person */}
              <div>
                <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                  1. Request To (Specific Person)
                </label>
                <select
                  value={stockTargetStaffId}
                  onChange={(e) => setStockTargetStaffId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-bold bg-white outline-none"
                >
                  <option value="">-- Select Staff Member --</option>
                  {stockApproverCandidates.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.role} ({s.branchName})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Product Selection (or manual SKU if catalog has 0 items) */}
              {products.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-xs font-montserrat font-black text-slate-800">
                    2. Select Liquor SKU
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      placeholder="Search product name, SKU, or barcode..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat outline-none"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
                    {filteredProducts.map((prod) => {
                      const active = selectedProductId === prod.id;
                      const srcStock = getBranchStockForProduct(prod, fromBranchId);
                      return (
                        <button
                          key={prod.id}
                          type="button"
                          onClick={() => setSelectedProductId(prod.id)}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 transition cursor-pointer ${
                            active ? 'bg-[#0A006E] text-white' : 'hover:bg-white text-slate-800'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-montserrat font-bold truncate">
                              {prod.name}
                            </div>
                            <div
                              className={`text-[10px] font-mono-tabular ${
                                active ? 'text-[#FFDE00]' : 'text-slate-500'
                              }`}
                            >
                              {prod.sku} · {prod.volumeMl}ml
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-[11px] font-mono-tabular font-bold ${
                                active ? 'text-white' : 'text-emerald-700'
                              }`}
                            >
                              {srcStock} btls
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="sm:col-span-2 text-[11px] text-amber-900 font-medium">
                    No active SKUs in catalog yet — enter the requested SKU code &amp; product name to send a requisition to Inventory:
                  </div>
                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                      SKU Code
                    </label>
                    <input
                      type="text"
                      required
                      value={manualSkuCode}
                      onChange={(e) => setManualSkuCode(e.target.value)}
                      placeholder="e.g. IPS-WHS-750-01"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-mono-tabular outline-none focus:border-[#0A006E]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-montserrat font-bold text-slate-700 mb-1">
                      Product Name
                    </label>
                    <input
                      type="text"
                      required
                      value={manualProductName}
                      onChange={(e) => setManualProductName(e.target.value)}
                      placeholder="e.g. Single Malt 12YO 750ml"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-montserrat outline-none focus:border-[#0A006E]"
                    />
                  </div>
                </div>
              )}

              {/* 3. Source & Destination Branches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    3. Source Depot (From)
                  </label>
                  <select
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-semibold bg-white outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    4. Destination Depot (To)
                  </label>
                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-semibold bg-white outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Quantity & Urgency */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    Unit Mode
                  </label>
                  <select
                    value={stockUnitMode}
                    onChange={(e) => setStockUnitMode(e.target.value as 'Bottle' | 'Case')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-semibold bg-white outline-none"
                  >
                    <option value="Bottle">Bottles</option>
                    <option value="Case">
                      Cases ({selectedProductObj?.packSize || selectedProductObj?.bottlesPerCase || 12}/cs)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={stockQtyInput}
                    onChange={(e) => setStockQtyInput(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-mono-tabular font-bold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                    Urgency
                  </label>
                  <select
                    value={stockUrgency}
                    onChange={(e) => setStockUrgency(e.target.value as StockRequestUrgency)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat font-semibold bg-white outline-none"
                  >
                    {STOCK_URGENCIES.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Request Note */}
              <div>
                <label className="block text-xs font-montserrat font-black text-slate-800 mb-1">
                  Reason / Dispatch Note
                </label>
                <textarea
                  rows={2}
                  value={stockNote}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStockNote(val);
                    emitLocalTypingActivity(val);
                  }}
                  onBlur={() => clearLocalTypingActivity()}
                  placeholder="e.g., Needed for B2B wholesale client pickup at 3:00 PM..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:border-[#0A006E] text-xs font-montserrat outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-montserrat font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!stockTargetStaffId || isSending}
                  className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#150099] disabled:opacity-40 text-[#FFDE00] text-xs font-montserrat font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Send Stock Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
