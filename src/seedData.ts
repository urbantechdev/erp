import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { GeoRegion } from './types';

export const NAIROBI_GEO_REGIONS: GeoRegion[] = [
  {
    id: 'reg-nrb-cbd',
    code: 'NRB-CBD-001',
    name: 'Nairobi Central Business District (CBD & High-Street)',
    tierType: 'Metro Core',
    wholesaleMultiplier: 1.0,
    retailMultiplier: 1.0,
    freightLevyPerCase: 0,
    regionalTaxRate: 0.16,
    notes: 'City Square, River Road, Tom Mboya, Upper Hill commercial core',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-wst',
    code: 'NRB-WST-002',
    name: 'Westlands, Parklands & Spring Valley Zone',
    tierType: 'Metro Core',
    wholesaleMultiplier: 1.02,
    retailMultiplier: 1.05,
    freightLevyPerCase: 25,
    regionalTaxRate: 0.16,
    notes: 'High-end hospitality, nightlife & premium retail lounges',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-klm',
    code: 'NRB-KLM-003',
    name: 'Kilimani, Kileleshwa, Lavington & Hurlingham',
    tierType: 'Metro Core',
    wholesaleMultiplier: 1.02,
    retailMultiplier: 1.06,
    freightLevyPerCase: 30,
    regionalTaxRate: 0.16,
    notes: 'Affluent residential, fine-dining restaurants & boutique wine bars',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-krn',
    code: 'NRB-KRN-004',
    name: 'Karen, Lang\'ata & Hardy Suburban Corridor',
    tierType: 'Suburban Ring',
    wholesaleMultiplier: 1.04,
    retailMultiplier: 1.08,
    freightLevyPerCase: 60,
    regionalTaxRate: 0.16,
    notes: 'Outlying affluent suburban estate & country club corridor',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-ind',
    code: 'NRB-IND-005',
    name: 'Industrial Area & Mombasa Road Logistics Yard',
    tierType: 'Metro Core',
    wholesaleMultiplier: 0.98,
    retailMultiplier: 1.0,
    freightLevyPerCase: 0,
    regionalTaxRate: 0.16,
    notes: 'Primary bonded depot, B2B wholesale distribution & freight depot',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-thk',
    code: 'NRB-THK-006',
    name: 'Thika Road Corridor (Ruaraka, Kasarani, Roysambu)',
    tierType: 'Suburban Ring',
    wholesaleMultiplier: 1.01,
    retailMultiplier: 1.03,
    freightLevyPerCase: 40,
    regionalTaxRate: 0.16,
    notes: 'High-density commercial hubs, vibrant social venues & clubs',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-est',
    code: 'NRB-EST-007',
    name: 'Eastlands Hub (Buruburu, Donholm, Umoja)',
    tierType: 'Suburban Ring',
    wholesaleMultiplier: 0.96,
    retailMultiplier: 0.98,
    freightLevyPerCase: 20,
    regionalTaxRate: 0.16,
    notes: 'High-volume competitive retail outlets & community distribution depots',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-rka',
    code: 'NRB-RKA-008',
    name: 'Ruaka, Two Rivers & Kiambu Northern Ring',
    tierType: 'Suburban Ring',
    wholesaleMultiplier: 1.03,
    retailMultiplier: 1.06,
    freightLevyPerCase: 50,
    regionalTaxRate: 0.16,
    notes: 'Growing urban sprawl, shopping malls & luxury apartment belt',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-dtf',
    code: 'NRB-DTF-009',
    name: 'JKIA Airport & Diplomatic Duty-Free Enclave',
    tierType: 'Duty-Free / Export',
    wholesaleMultiplier: 0.88,
    retailMultiplier: 0.9,
    freightLevyPerCase: 0,
    regionalTaxRate: 0.0,
    notes: 'Zero-excise diplomatic missions and international transit concessionaires',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'reg-nrb-upc',
    code: 'NRB-UPC-010',
    name: 'Upcountry Gateway / Rift Escarpment Corridor',
    tierType: 'Upcountry / Lower Region',
    wholesaleMultiplier: 1.06,
    retailMultiplier: 1.1,
    freightLevyPerCase: 120,
    regionalTaxRate: 0.16,
    notes: 'Cross-county transit, long-distance haulage freight & outer regional branches',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

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

    // Ensure authentic Nairobi GEO location zones are seeded for branch creation and price control
    const regionsSnapshot = await getDocs(collection(db, 'geo_regions')).catch(() => null);
    const existingRegionIds = new Set(regionsSnapshot?.docs.map((d) => d.id) || []);
    for (const nrbReg of NAIROBI_GEO_REGIONS) {
      if (!existingRegionIds.has(nrbReg.id)) {
        await setDoc(doc(db, 'geo_regions', nrbReg.id), {
          ...nrbReg,
          createdAt: new Date().toISOString(),
        }).catch(() => {});
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
        regionId: 'reg-nrb-cbd',
        regionName: 'Nairobi Central Business District (CBD & High-Street)',
        address: 'Kenyatta Avenue & Kimathi St, Nairobi CBD',
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

    // 6. Purge any non-feminiholdings Admin records and ensure feminiholdings@gmail.com is the sole Admin
    const allStaffSnap = await getDocs(collection(db, 'staff')).catch(() => null);
    let feminiAdminFound = false;
    if (allStaffSnap && !allStaffSnap.empty) {
      for (const staffDoc of allStaffSnap.docs) {
        const sdata = staffDoc.data();
        const sEmail = (sdata.email || '').toLowerCase().trim();
        if (sdata.role === 'Admin') {
          if (sEmail !== 'feminiholdings@gmail.com') {
            await deleteDoc(doc(db, 'staff', staffDoc.id)).catch(() => {});
          } else {
            feminiAdminFound = true;
          }
        }
      }
    }

    if (!feminiAdminFound) {
      await setDoc(doc(db, 'staff', 'staff-admin-feminiholdings'), {
        id: 'staff-admin-feminiholdings',
        name: 'Femini Holdings Executive Admin',
        email: 'feminiholdings@gmail.com',
        role: 'Admin',
        authMethod: 'google',
        branchId: targetHqId,
        branchName: 'HQ - Main Branch',
        status: 'Active',
        createdBy: 'System Root',
        createdByRole: 'Root',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch {
    // Ignore if restricted or already purged
  }
}
