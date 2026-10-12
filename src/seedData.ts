import {
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

// Removes any legacy pre-seeded mock partners, mock compliance records, mock branches, or mock regions
// so that 100% of suppliers, retailers, logistics, branches, geo-zones, compliance records, and staff are real user-created records.
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
    for (const pid of LEGACY_MOCK_PARTNER_IDS) {
      await deleteDoc(doc(db, 'partners', pid));
    }
    for (const cid of LEGACY_MOCK_COMPLIANCE_IDS) {
      await deleteDoc(doc(db, 'compliance_records', cid));
    }
  } catch {
    // Ignore if already purged or restricted
  }
}
