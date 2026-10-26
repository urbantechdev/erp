import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Mail,
  FileText,
  ArrowRightLeft,
  X,
  CornerDownRight,
  ExternalLink,
} from 'lucide-react';
import { InternalChatMessage, StaffMember } from '../types';
import { formatKes } from '../erpUtils';
import { isDirectThreadParticipant } from './InternalInboxModule';
import { playPosBeep } from '../utils/audioBeep';

export interface DesktopEmailNotificationItem {
  popupId: string;
  message: InternalChatMessage;
  kind: 'NEW_MESSAGE' | 'INVOICE_TRANSFER' | 'STOCK_REQUEST' | 'STATUS_UPDATE';
  arrivedAt: number;
}

interface DesktopInboxArrivalPopupProps {
  currentUser: StaffMember;
  messages: InternalChatMessage[];
  activeModule: string;
  activeInboxThreadId?: string | null;
  onOpenThread: (threadId: string) => void;
}

function getSignature(msg: InternalChatMessage): string {
  return [
    msg.createdAt || '',
    msg.updatedAt || '',
    msg.invoiceTransfer?.transferStatus || '',
    msg.stockTransferRequest?.requestStatus || '',
  ].join('|');
}

export const DesktopInboxArrivalPopup: React.FC<DesktopInboxArrivalPopupProps> = ({
  currentUser,
  messages,
  activeModule,
  activeInboxThreadId,
  onOpenThread,
}) => {
  const [queue, setQueue] = useState<DesktopEmailNotificationItem[]>([]);
  const [hoveredPopupId, setHoveredPopupId] = useState<string | null>(null);

  const seenMapRef = useRef<Map<string, string>>(new Map());
  const mountedUserIdRef = useRef<string>('');
  const mountTimestampRef = useRef<number>(Date.now());

  // Reset baseline tracker when logged-in user changes
  useEffect(() => {
    if (mountedUserIdRef.current !== currentUser.id) {
      mountedUserIdRef.current = currentUser.id;
      mountTimestampRef.current = Date.now();
      const initial = new Map<string, string>();
      for (const m of messages) {
        initial.set(m.id, getSignature(m));
      }
      seenMapRef.current = initial;
      setQueue([]);
    }
  }, [currentUser.id, messages]);

  // Watch real-time message arrivals & workflow updates (strictly desktop >= 768px)
  useEffect(() => {
    if (!currentUser) return;

    const isInitialHydrationWindow = Date.now() - mountTimestampRef.current < 1400;
    const isDesktopViewport =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

    const newlyArrived: DesktopEmailNotificationItem[] = [];

    for (const msg of messages) {
      const nextSig = getSignature(msg);
      const prevSig = seenMapRef.current.get(msg.id);

      // Always record signature so we never re-fire for the same state
      seenMapRef.current.set(msg.id, nextSig);

      // During initial Firestore snapshot load, skip historical records older than 6 seconds
      if (prevSig === undefined && isInitialHydrationWindow) {
        const msgTime = Date.parse(msg.createdAt || '');
        const isJustCreated = !Number.isNaN(msgTime) && Date.now() - msgTime < 6000;
        if (!isJustCreated) {
          continue;
        }
      }

      const isVisibleToUser =
        msg.threadType === 'department' || isDirectThreadParticipant(msg.threadId, currentUser.id);
      if (!isVisibleToUser) continue;

      // Skip if user is already looking at this exact thread inside Internal Inbox
      if (activeModule === 'internal_inbox' && activeInboxThreadId === msg.threadId) {
        continue;
      }

      if (prevSig === undefined) {
        // Brand-new message arrived from another colleague
        if (msg.senderId === currentUser.id) continue;

        const kind: DesktopEmailNotificationItem['kind'] =
          msg.messageType === 'INVOICE_TRANSFER'
            ? 'INVOICE_TRANSFER'
            : msg.messageType === 'STOCK_TRANSFER_REQUEST'
              ? 'STOCK_REQUEST'
              : 'NEW_MESSAGE';

        newlyArrived.push({
          popupId: `${msg.id}-${Date.now()}`,
          message: msg,
          kind,
          arrivedAt: Date.now(),
        });
      } else if (prevSig !== nextSig) {
        // Workflow status update on an invoice transfer or stock request not performed by currentUser
        const lastActor =
          msg.invoiceTransfer?.handledBy || msg.stockTransferRequest?.actionedBy || '';
        if (lastActor && lastActor !== currentUser.name) {
          newlyArrived.push({
            popupId: `${msg.id}-upd-${Date.now()}`,
            message: msg,
            kind: 'STATUS_UPDATE',
            arrivedAt: Date.now(),
          });
        }
      }
    }

    if (newlyArrived.length > 0 && isDesktopViewport) {
      playPosBeep('success');
      setQueue((prev) => {
        const combined = [...prev, ...newlyArrived];
        return combined.slice(-3); // Show at most 3 stacked email cards at bottom-right
      });
    }
  }, [messages, currentUser, activeModule, activeInboxThreadId]);

  // Auto-dismiss cards after 9 seconds unless hovered
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setQueue((prev) =>
        prev.filter((item) => {
          if (hoveredPopupId === item.popupId) return true;
          return now - item.arrivedAt < 9000;
        })
      );
    }, 1000);
    return () => window.clearInterval(timer);
  }, [queue.length, hoveredPopupId]);

  const dismissPopup = (popupId: string) => {
    setQueue((prev) => prev.filter((p) => p.popupId !== popupId));
  };

  return (
    <div
      aria-live="polite"
      aria-label="Desktop Inbox Arrival Notifications"
      className="hidden md:flex fixed bottom-24 right-6 z-40 flex-col gap-3 w-[388px] max-w-[calc(100vw-3rem)] pointer-events-none"
    >
      <AnimatePresence initial={false}>
        {queue.map((item) => {
          const { message: msg, kind } = item;
          const inv = msg.invoiceTransfer;
          const stk = msg.stockTransferRequest;

          const headerLabel =
            kind === 'INVOICE_TRANSFER'
              ? 'New Invoice Transferred'
              : kind === 'STOCK_REQUEST'
                ? 'New Stock Transfer Request'
                : kind === 'STATUS_UPDATE'
                  ? 'Inbox Action Updated'
                  : 'New Department Inbox Mail';

          const subjectLine = inv
            ? `${inv.docType} ${inv.docNumber} · ${formatKes(inv.totalAmount)} (${inv.transferPurpose})`
            : stk
              ? `${stk.quantityBottles} btls ${stk.sku} · ${stk.fromBranchName} → ${stk.toBranchName}`
              : msg.threadType === 'direct'
                ? `Direct Message from ${msg.senderName}`
                : msg.channelName;

          return (
            <motion.div
              key={item.popupId}
              initial={{ opacity: 0, y: 36, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onMouseEnter={() => setHoveredPopupId(item.popupId)}
              onMouseLeave={() =>
                setHoveredPopupId((prev) => (prev === item.popupId ? null : prev))
              }
              className="pointer-events-auto bg-white rounded-2xl border-2 border-red-600 shadow-[0_14px_34px_rgba(15,23,42,0.22)] overflow-hidden"
            >
              {/* Email Toast Top Red Strip */}
              <div className="px-3.5 py-2 bg-red-600 text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {kind === 'INVOICE_TRANSFER' ? (
                    <FileText className="w-4 h-4 shrink-0" />
                  ) : kind === 'STOCK_REQUEST' ? (
                    <ArrowRightLeft className="w-4 h-4 shrink-0" />
                  ) : (
                    <Mail className="w-4 h-4 shrink-0" />
                  )}
                  <span className="text-[11px] font-montserrat font-black uppercase tracking-wider truncate">
                    {headerLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono-tabular text-red-100">Just now</span>
                  <button
                    type="button"
                    onClick={() => dismissPopup(item.popupId)}
                    aria-label="Dismiss notification"
                    className="w-6 h-6 rounded-lg bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Email Envelope Body */}
              <div
                onClick={() => {
                  dismissPopup(item.popupId);
                  onOpenThread(msg.threadId);
                }}
                className="p-3.5 space-y-2 cursor-pointer hover:bg-red-50/30 transition"
              >
                {/* From Row */}
                <div className="flex items-center gap-1.5 text-xs min-w-0 truncate">
                  <span className="text-slate-400 font-semibold">From:</span>
                  <span className="font-montserrat font-black text-slate-900 truncate">
                    {msg.senderName}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-[11px] font-montserrat font-semibold text-slate-500 shrink-0">
                    {msg.senderRole}
                  </span>
                </div>

                {/* Subject Row */}
                <div className="text-xs font-montserrat font-bold text-[#0A006E] truncate flex items-center gap-1.5">
                  <CornerDownRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="truncate">{subjectLine}</span>
                </div>

                {/* Snippet */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {msg.body}
                </p>
              </div>

              {/* Footer Actions */}
              <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 font-montserrat truncate">
                  {msg.senderBranchName}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => dismissPopup(item.popupId)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold text-slate-600 hover:bg-slate-200/70 cursor-pointer transition"
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dismissPopup(item.popupId);
                      onOpenThread(msg.threadId);
                    }}
                    className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-montserrat font-black flex items-center gap-1 cursor-pointer transition"
                  >
                    <span>Open Mail</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
