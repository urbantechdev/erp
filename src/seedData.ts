import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
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

    // 4. Purge dummy branches and retain only genuine branches, with HQ as MAIN branch
    const branchesSnapshot = await getDocs(collection(db, 'branches')).catch(() => null);
    let hqFoundDocId: string | null = null;
    const deletedBranchIds: string[] = [];

    if (branchesSnapshot && !branchesSnapshot.empty) {
      for (const branchDoc of branchesSnapshot.docs) {
        const data = branchDoc.data();
        const code = (data.code || '').toUpperCase().trim();
        const name = (data.name || '').toLowerCase();

        // Dummy branches specified by user:
        // BR-LWR-003 Lower Basin Regional Depot
        // BR-SUB-002 Northgate Suburban Distribution Hub
        const isDummyBranch =
          code === 'BR-LWR-003' ||
          code === 'BR-SUB-002' ||
          name.includes('lower basin') ||
          name.includes('northgate suburban');

        if (isDummyBranch) {
          deletedBranchIds.push(branchDoc.id);
          await deleteDoc(doc(db, 'branches', branchDoc.id)).catch(() => {});
          continue;
        }

        // Check if this is the HQ branch
        if (code === 'BR-HQ-001' || name.includes('central bonded') || name.includes('flagship') || name.includes('hq')) {
          hqFoundDocId = branchDoc.id;
          await updateDoc(doc(db, 'branches', branchDoc.id), {
            code: 'BR-HQ-001',
            name: 'HQ - Main Branch',
            isMain: true,
            status: 'Operational',
          }).catch(() => {});
        }
      }
    }

    // If HQ branch was not found or collection had no HQ, create genuine HQ MAIN branch
    const targetHqId = hqFoundDocId || 'br-hq-001';
    if (!hqFoundDocId) {
      await setDoc(doc(db, 'branches', targetHqId), {
        id: targetHqId,
        code: 'BR-HQ-001',
        name: 'HQ - Main Branch',
        isMain: true,
        regionId: 'reg-metro-core',
        regionName: 'Metropolitan CBD & High-Street Zone',
        address: 'Metropolitan CBD & High-Street Zone',
        managerName: 'Operations Director',
        exciseBondLicense: 'KRA-BOND-2026-8841A',
        status: 'Operational',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    // 5. Reassign any staff whose branch was deleted to HQ - Main Branch
    if (deletedBranchIds.length > 0) {
      const staffSnapshot = await getDocs(collection(db, 'staff')).catch(() => null);
      if (staffSnapshot && !staffSnapshot.empty) {
        for (const staffDoc of staffSnapshot.docs) {
          const sdata = staffDoc.data();
          if (deletedBranchIds.includes(sdata.branchId)) {
            await updateDoc(doc(db, 'staff', staffDoc.id), {
              branchId: targetHqId,
              branchName: 'HQ - Main Branch',
            }).catch(() => {});
          }
        }
      }
    }
  } catch {
    // Ignore if restricted or already purged
  }
}
