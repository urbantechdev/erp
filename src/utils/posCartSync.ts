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

export function getPosCartDocId(staffIdOrEmail: string): string {
  // Use email as the primary anchor for synchronization
  const sanitized = (staffIdOrEmail || 'default_cashier')
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 100);
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
        bc.postMessage({ docId, data, timestamp: Date.now() });
        bc.close();
      }
      localStorage.setItem(`pos_cart_sync_${docId}`, JSON.stringify({ data, timestamp: Date.now() }));
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

  // 2. Persist to Firestore if user is authenticated
  if (auth.currentUser) {
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

    try {
      await setDoc(doc(db, 'active_pos_carts', docId), firestoreData, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `active_pos_carts/${docId}`);
    }
  }
}

/**
 * Subscribes to real-time cart updates for the cashier's account.
 * Uses BroadcastChannel and window storage events for instant local sync,
 * and attaches Firestore onSnapshot when authenticated.
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
  let firestoreUnsub: (() => void) | null = null;

  // 1. Listen via BroadcastChannel (zero-latency in same browser)
  let bc: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    bc = new BroadcastChannel(SYNC_CHANNEL_NAME);
    bc.onmessage = (event) => {
      if (isCleanedUp) return;
      if (event.data && event.data.docId === docId && event.data.data) {
        onUpdate(event.data.data);
      }
    };
  }

  // 2. Listen via window storage event (cross-tab / cross-window fallback)
  const handleStorageEvent = (e: StorageEvent) => {
    if (isCleanedUp) return;
    if (e.key === `pos_cart_sync_${docId}` && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed?.data) {
          onUpdate(parsed.data);
        }
      } catch {}
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageEvent);
  }

  // 3. Attach Firestore onSnapshot ONLY when user is authenticated (as required by Firestore rules & skill)
  const attachFirestoreListener = () => {
    if (firestoreUnsub || isCleanedUp) return;
    if (!auth.currentUser) return;

    try {
      firestoreUnsub = onSnapshot(
        doc(db, 'active_pos_carts', docId),
        (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          try {
            const cart: PosCartItem[] = d.cartJson ? JSON.parse(d.cartJson) : [];
            const activatedProductIds: string[] = d.activatedProductIdsJson
              ? JSON.parse(d.activatedProductIdsJson)
              : [];

            onUpdate({
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
        },
        (err) => {
          if (auth.currentUser) {
            handleFirestoreError(err, OperationType.GET, `active_pos_carts/${docId}`);
          }
        }
      );
    } catch (e) {
      console.warn('[POS Sync] Firestore listener initialization:', e);
    }
  };

  // If already authenticated, attach immediately
  if (auth.currentUser) {
    attachFirestoreListener();
  }

  // Monitor auth state changes: attach Firestore listener once authenticated, detach on logout
  const unsubAuth = auth.onAuthStateChanged((user) => {
    if (isCleanedUp) return;
    if (user) {
      attachFirestoreListener();
    } else if (firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
  });

  return () => {
    isCleanedUp = true;
    if (bc) {
      bc.close();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageEvent);
    }
    unsubAuth();
    if (firestoreUnsub) {
      firestoreUnsub();
    }
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

  // 2. Clear in Firestore if authenticated
  if (auth.currentUser) {
    try {
      await setDoc(
        doc(db, 'active_pos_carts', docId),
        {
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
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `active_pos_carts/${docId}`);
    }
  }
}
