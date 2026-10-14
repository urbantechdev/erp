/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth, cleanFirestoreData, handleFirestoreError, OperationType } from '../firebase';
import { Product, RestaurantInventoryItem } from '../types';
import { ClubTopupItem } from '../data/clubTopupsData';

export interface PosCartItem {
  id: string;
  kind: 'bonded_product' | 'restaurant_food' | 'topup_item';
  product?: Product;
  restaurantItem?: RestaurantInventoryItem;
  topupItem?: ClubTopupItem;
  unitMode: 'Bottle' | 'Case' | 'Portion' | 'Plate' | 'Platter' | 'Glass' | 'Cup' | 'Stick' | 'Head' | 'Serving' | 'Basket';
  quantityUnits: number;
  unitPrice: number;
  name: string;
  category: string;
}

export interface ActivePosCartPayload {
  staffId: string;
  staffName: string;
  staffEmail: string;
  staffRole: string;
  branchId: string;
  cart: PosCartItem[];
  activatedProductIds: string[];
  totalUnits: number;
  subtotal: number;
  exciseAndTax: number;
  grandTotal: number;
  lastScannedBarcode?: string;
  lastScannedProductName?: string;
  lastScannedUnitMode?: string;
  sourceDevice?: 'phone' | 'desktop';
}

export function getPosCartDocId(staffIdOrEmail?: string): string {
  const val = (staffIdOrEmail || '').toLowerCase().trim();
  if (!val || val.includes('cashier')) {
    return 'pos_cart_cashier_main';
  }
  const sanitized = val.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
  return `pos_cart_${sanitized}`;
}

const SYNC_CHANNEL_NAME = 'aegis_pos_cart_sync';

/**
 * Broadcasts cart changes locally via BroadcastChannel and localStorage
 * to ensure 0-latency instant cross-tab / cross-window synchronization between
 * cashier phone scanner companion and desktop POS register.
 */
function broadcastLocalCart(docId: string, data: any) {
  try {
    if (typeof window !== 'undefined') {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
        bc.postMessage({ docId, channel: 'cashier_main', data, timestamp: Date.now() });
        bc.close();
      }
      const serialized = JSON.stringify({ data, timestamp: Date.now() });
      localStorage.setItem(`pos_cart_sync_${docId}`, serialized);
      if (docId !== 'pos_cart_cashier_main') {
        localStorage.setItem(`pos_cart_sync_pos_cart_cashier_main`, serialized);
      }
    }
  } catch (e) {
    console.warn('[POS Sync] Local broadcast error:', e);
  }
}

/**
 * Pushes active cart state to both local cross-tab bus and Firestore
 * for real-time synchronization between cashier phone and desktop under the cashier's account.
 */
export async function syncPosCartToFirestore(payload: ActivePosCartPayload): Promise<void> {
  const docId = getPosCartDocId(payload.staffId || payload.staffEmail);
  const now = new Date().toISOString();

  // Compress cart items to essentials to stay well within limits
  const cleanCart: PosCartItem[] = payload.cart.map((item) => ({
    id: item.id,
    kind: item.kind,
    product: item.product
      ? ({
          ...item.product,
          packSize: item.product.packSize || item.product.bottlesPerCase || 12,
        } as Product)
      : undefined,
    restaurantItem: item.restaurantItem,
    topupItem: item.topupItem,
    unitMode: item.unitMode,
    quantityUnits: item.quantityUnits,
    unitPrice: item.unitPrice,
    name: item.name,
    category: item.category,
  }));

  const cartJson = JSON.stringify(cleanCart);
  const activatedProductIdsJson = JSON.stringify(payload.activatedProductIds || []);

  const normalizedData = {
    cart: cleanCart,
    activatedProductIds: payload.activatedProductIds || [],
    totalUnits: payload.totalUnits || 0,
    subtotal: payload.subtotal || 0,
    exciseAndTax: payload.exciseAndTax || 0,
    grandTotal: payload.grandTotal || 0,
    lastScannedBarcode: payload.lastScannedBarcode || '',
    lastScannedProductName: payload.lastScannedProductName || '',
    lastScannedUnitMode: payload.lastScannedUnitMode || 'Bottle',
    updatedAt: now,
  };

  // 1. Instant local broadcast (0ms latency between tabs and windows)
  broadcastLocalCart(docId, normalizedData);

  // 2. Persist to Firestore for instant wireless cross-device syncing
  try {
    const firestoreData = cleanFirestoreData({
      staffId: payload.staffId || 'staff_cashier',
      staffName: payload.staffName || 'Counter Cashier',
      staffEmail: payload.staffEmail || '',
      staffRole: payload.staffRole || 'Counter Cashier',
      branchId: payload.branchId || '',
      cartJson,
      activatedProductIdsJson,
      totalUnits: payload.totalUnits || 0,
      subtotal: payload.subtotal || 0,
      exciseAndTax: payload.exciseAndTax || 0,
      grandTotal: payload.grandTotal || 0,
      lastScannedBarcode: payload.lastScannedBarcode || '',
      lastScannedProductName: payload.lastScannedProductName || '',
      lastScannedUnitMode: payload.lastScannedUnitMode || 'Bottle',
      lastScannedAt: payload.lastScannedBarcode ? now : '',
      updatedAt: now,
      createdAt: now,
    });

    await setDoc(doc(db, 'active_pos_carts', docId), firestoreData, { merge: true });
    if (docId !== 'pos_cart_cashier_main') {
      await setDoc(doc(db, 'active_pos_carts', 'pos_cart_cashier_main'), firestoreData, { merge: true }).catch(() => {});
    }
  } catch (err) {
    console.warn('[POS Sync] Firestore write warning:', err);
  }
}

/**
 * Subscribes to real-time cart updates for the cashier's account.
 * Uses BroadcastChannel and window storage events for instant local sync,
 * and attaches Firestore onSnapshot for real-time mobile-to-desktop wireless syncing.
 */
export function subscribeToActivePosCart(
  staffIdOrEmail: string,
  onUpdate: (data: {
    cart: PosCartItem[];
    activatedProductIds: string[];
    grandTotal: number;
    subtotal: number;
    exciseAndTax: number;
    lastScannedBarcode?: string;
    lastScannedProductName?: string;
    lastScannedUnitMode?: string;
    updatedAt: string;
  }) => void
): () => void {
  const docId = getPosCartDocId(staffIdOrEmail);
  let isCleanedUp = false;
  let firestoreUnsub1: (() => void) | null = null;
  let firestoreUnsub2: (() => void) | null = null;
  let lastProcessedUpdateAt = '';

  const processIncomingUpdate = (payload: any) => {
    if (!payload || !Array.isArray(payload.cart)) return;
    if (payload.updatedAt && payload.updatedAt === lastProcessedUpdateAt) return;
    lastProcessedUpdateAt = payload.updatedAt || '';
    onUpdate(payload);
  };

  // 1. Listen via BroadcastChannel (zero-latency in same browser)
  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (isCleanedUp) return;
        if (event.data?.data) {
          if (
            event.data.docId === docId ||
            event.data.docId === 'pos_cart_cashier_main' ||
            event.data.channel === 'cashier_main' ||
            docId === 'pos_cart_cashier_main'
          ) {
            processIncomingUpdate(event.data.data);
          }
        }
      };
    } catch (e) {
      console.warn('[POS Sync] BroadcastChannel init error:', e);
    }
  }

  // 2. Listen via window storage event (cross-tab / cross-window fallback)
  const handleStorageEvent = (e: StorageEvent) => {
    if (isCleanedUp) return;
    if (
      e.key === `pos_cart_sync_${docId}` ||
      e.key === 'pos_cart_sync_pos_cart_cashier_main'
    ) {
      if (e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.data) {
            processIncomingUpdate(parsed.data);
          }
        } catch {}
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  // 3. Attach Firestore onSnapshot for cross-device wireless phone-to-cashier sync
  const parseSnap = (snap: any) => {
    if (!snap.exists()) return;
    const d = snap.data();
    try {
      const cart: PosCartItem[] = d.cartJson ? JSON.parse(d.cartJson) : [];
      const activatedProductIds: string[] = d.activatedProductIdsJson
        ? JSON.parse(d.activatedProductIdsJson)
        : [];

      processIncomingUpdate({
        cart,
        activatedProductIds,
        grandTotal: Number(d.grandTotal || 0),
        subtotal: Number(d.subtotal || 0),
        exciseAndTax: Number(d.exciseAndTax || 0),
        lastScannedBarcode: d.lastScannedBarcode || '',
        lastScannedProductName: d.lastScannedProductName || '',
        lastScannedUnitMode: d.lastScannedUnitMode || '',
        updatedAt: d.updatedAt || '',
      });
    } catch (e) {
      console.warn('Failed to parse active POS cart snapshot:', e);
    }
  };

  try {
    firestoreUnsub1 = onSnapshot(
      doc(db, 'active_pos_carts', docId),
      parseSnap,
      (err) => console.warn('[POS Sync] Firestore snapshot warning:', err)
    );

    if (docId !== 'pos_cart_cashier_main') {
      firestoreUnsub2 = onSnapshot(
        doc(db, 'active_pos_carts', 'pos_cart_cashier_main'),
        parseSnap,
        (err) => console.warn('[POS Sync] Main cashier snapshot warning:', err)
      );
    }
  } catch (e) {
    console.warn('[POS Sync] Firestore listener initialization:', e);
  }

  return () => {
    isCleanedUp = true;
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
    if (firestoreUnsub1) firestoreUnsub1();
    if (firestoreUnsub2) firestoreUnsub2();
  };
}

/**
 * Clears the active cart in Firestore and local broadcast bus when checkout completes or cashier resets the cart.
 */
export async function clearActivePosCart(staffIdOrEmail: string): Promise<void> {
  const docId = getPosCartDocId(staffIdOrEmail);
  const now = new Date().toISOString();

  // 1. Broadcast clear locally immediately
  broadcastLocalCart(docId, {
    cart: [],
    activatedProductIds: [],
    totalUnits: 0,
    subtotal: 0,
    exciseAndTax: 0,
    grandTotal: 0,
    lastScannedBarcode: '',
    lastScannedProductName: '',
    lastScannedUnitMode: '',
    updatedAt: now,
  });

  // 2. Clear in Firestore
  try {
    const clearData = cleanFirestoreData({
      staffId: staffIdOrEmail || 'staff_cashier',
      cartJson: '[]',
      activatedProductIdsJson: '[]',
      totalUnits: 0,
      subtotal: 0,
      exciseAndTax: 0,
      grandTotal: 0,
      lastScannedBarcode: '',
      lastScannedProductName: '',
      updatedAt: now,
      createdAt: now,
    });
    await setDoc(doc(db, 'active_pos_carts', docId), clearData, { merge: true });
    if (docId !== 'pos_cart_cashier_main') {
      await setDoc(doc(db, 'active_pos_carts', 'pos_cart_cashier_main'), clearData, { merge: true }).catch(() => {});
    }
  } catch (err) {
    console.warn('[POS Sync] Error clearing active cart:', err);
  }
}
