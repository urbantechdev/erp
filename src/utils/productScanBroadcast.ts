/**
 * Universal Real-Time Barcode & Scanned Product Broadcast System
 * Enables instant zero-latency cross-tab and cross-component updates
 * across Inventory, Cashier POS, Sales Representative, and Customer Portals.
 */

import { Product } from '../types';

export interface ProductScanBroadcastData {
  productId: string;
  barcode: string;
  name: string;
  sku: string;
  category?: string;
  price?: number;
  totalBottles?: number;
  sourceModule: 'inventory' | 'pos_cashier' | 'sales_rep' | 'phone_companion';
  scannedAt: string;
}

const BROADCAST_CHANNEL_NAME = 'vaairo_product_scans_channel_v1';
const WINDOW_EVENT_NAME = 'erp:product-scanned-live';

// Singleton broadcast channel instance
let broadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel not supported in older or sandboxed contexts
}

/**
 * Broadcast an instant product scan event to all active dashboards and tabs
 */
export function broadcastProductScanned(payload: ProductScanBroadcastData): void {
  // 1. Send across browser tabs via BroadcastChannel
  try {
    if (broadcastChannel) {
      broadcastChannel.postMessage(payload);
    }
  } catch (err) {
    console.warn('[BroadcastChannel] Post failed:', err);
  }

  // 2. Dispatch custom event within the current window/document
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent(WINDOW_EVENT_NAME, {
          detail: payload,
        })
      );
    } catch (err) {
      console.warn('[CustomEvent] Dispatch failed:', err);
    }
  }
}

/**
 * Subscribe to product scan broadcasts from any dashboard or tab
 */
export function subscribeToProductScans(
  callback: (payload: ProductScanBroadcastData) => void
): () => void {
  // Handler for BroadcastChannel
  const handleBroadcastMessage = (event: MessageEvent<ProductScanBroadcastData>) => {
    if (event.data && event.data.productId) {
      callback(event.data);
    }
  };

  // Handler for Window CustomEvent
  const handleWindowEvent = (event: Event) => {
    const customEvt = event as CustomEvent<ProductScanBroadcastData>;
    if (customEvt.detail && customEvt.detail.productId) {
      callback(customEvt.detail);
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener(WINDOW_EVENT_NAME, handleWindowEvent);
  }

  // Cleanup unsubscriber
  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener(WINDOW_EVENT_NAME, handleWindowEvent);
    }
  };
}
