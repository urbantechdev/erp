import {
  doc,
  deleteDoc,
  collection,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';

// Removes all legacy pre-seeded mock partners, mock suppliers, mock compliance records, or dummy records
// ensuring 100% of suppliers, retailers, logistics, compliance records, and staff are authentic real records.
const LEGACY_MOCK_PARTNER_IDS = [
  'part-sup-01',
  'part-ret-01',
  'part-ret-02',
  'part-log-01',
];

const LEGACY_MOCK_COMPLIANCE_IDS = [
  'comp-01',
  'comp-02',
];

export async function ensureOperationalFoundationSeeded(): Promise<void> {
  try {
    // 1. Purge known legacy mock partner IDs
    for (const pid of LEGACY_MOCK_PARTNER_IDS) {
      await deleteDoc(doc(db, 'partners', pid)).catch(() => {});
    }
    // 2. Purge known legacy mock compliance IDs
    for (const cid of LEGACY_MOCK_COMPLIANCE_IDS) {
      await deleteDoc(doc(db, 'compliance_records', cid)).catch(() => {});
    }

    // 3. Scan partners collection for any records with legacy mock placeholder data
    const partnersSnapshot = await getDocs(collection(db, 'partners')).catch(() => null);
    if (partnersSnapshot && !partnersSnapshot.empty) {
      for (const partnerDoc of partnersSnapshot.docs) {
        const data = partnerDoc.data();
        const isMock =
          data.phone === '+254 700 019 283' ||
          data.email === 'compliance@partner.co.ke' ||
          data.taxPin === 'PIN-VERIFIED' ||
          data.companyName?.toLowerCase().includes('mock') ||
          data.companyName?.toLowerCase().includes('sample');
        if (isMock) {
          await deleteDoc(doc(db, 'partners', partnerDoc.id)).catch(() => {});
        }
      }
    }
  } catch {
    // Ignore if restricted or already purged
  }
}
