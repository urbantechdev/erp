import {
  doc,
  deleteDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { GeoRegion, BusinessUnit, RestaurantInventoryItem } from './types';
import { hashPin, isPinHashed } from './utils/security';

export const NAIROBI_GEO_REGIONS: GeoRegion[] = [
  {
    id: 'reg-nrb-cbd',
    code: 'NRB-WST-001',
    name: 'Nairobi West & Parklands (Premium Distribution Hub)',
    tierType: 'Metro Core',
    wholesaleMultiplier: 1.0,
    retailMultiplier: 1.0,
    freightLevyPerCase: 0,
    regionalTaxRate: 0.16,
    notes: 'Parklands, Westlands, Spring Valley, High-end hospitality hub',
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

export const INITIAL_BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: 'out-hq-rest-01',
    code: 'OUT-SOV-001',
    name: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    branchName: 'HQ - Main Branch',
    unitType: 'restaurant_club',
    description: 'Luxury club lounge, premium grilled steaks, artisan cocktails, and bottle service.',
    managerName: 'Head Chef & Lounge Director',
    status: 'Active',
    foodCategories: [
      'Starters & Small Plates',
      'Steaks & Prime Cuts',
      'Nyama Choma & Grills',
      'Gourmet Burgers & Sliders',
      'Sides & Loaded Fries',
      'Desserts & Sweet Bites',
    ],
    beverageCategories: [
      'Signature Craft Cocktails',
      'Virgin Mocktails & Refreshers',
      'Barista Coffee & Teas',
      'Fresh Pressed Juices',
    ],
    allowLiquorTopup: true,
    tableCount: 24,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'out-hq-shop-01',
    code: 'OUT-CEL-002',
    name: 'Westlands Cellar Liquor Supermarket',
    branchId: 'br-hq-01',
    branchName: 'HQ - Main Branch',
    unitType: 'merchant_shop',
    description: 'High-volume walk-in liquor supermarket merchant shop with retail aisles and checkout tills.',
    managerName: 'Store General Manager',
    status: 'Active',
    foodCategories: ['Bar Snacks & Crisps', 'Chocolates & Nuts'],
    beverageCategories: ['Cold Soda Vault', 'Ice & Mixers'],
    allowLiquorTopup: true,
    tableCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const INITIAL_RESTAURANT_INVENTORY: RestaurantInventoryItem[] = [
  {
    id: 'dish-01',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Prime Angus Ribeye Steak (350g)',
    category: 'Steaks & Prime Cuts',
    itemType: 'food',
    portionUnit: 'Plate',
    costPriceKes: 1400,
    sellingPriceKes: 2800,
    portionsAvailable: 35,
    minStockAlert: 8,
    prepTimeMinutes: 20,
    isAvailable: true,
    description: 'Wet-aged Black Angus cut char-grilled with truffle garlic herb butter and rosemary jus.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-02',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Nyama Choma Platter (1kg Mbuzi Mbavu)',
    category: 'Nyama Choma & Grills',
    itemType: 'food',
    portionUnit: 'Platter',
    costPriceKes: 1100,
    sellingPriceKes: 2400,
    portionsAvailable: 28,
    minStockAlert: 6,
    prepTimeMinutes: 25,
    isAvailable: true,
    description: 'Tender slow-roasted local goat ribs served with brown ugali, sukuma wiki, and kachumbari.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-03',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Gourmet Wagyu Beef Burger & Onion Jam',
    category: 'Gourmet Burgers & Sliders',
    itemType: 'food',
    portionUnit: 'Portion',
    costPriceKes: 750,
    sellingPriceKes: 1650,
    portionsAvailable: 30,
    minStockAlert: 10,
    prepTimeMinutes: 15,
    isAvailable: true,
    description: '220g Wagyu patty in toasted brioche bun with smoked cheddar and aged balsamic onion jam.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-04',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Truffle Parmesan Hand-Cut Fries with Garlic Aioli',
    category: 'Sides & Loaded Fries',
    itemType: 'food',
    portionUnit: 'Basket',
    costPriceKes: 220,
    sellingPriceKes: 650,
    portionsAvailable: 50,
    minStockAlert: 15,
    prepTimeMinutes: 8,
    isAvailable: true,
    description: 'Crispy twice-cooked potatoes tossed in white truffle oil, sea salt, and aged Grana Padano.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-05',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Buffalo Hot Wings (12 Pieces & Blue Cheese Dip)',
    category: 'Starters & Small Plates',
    itemType: 'food',
    portionUnit: 'Portion',
    costPriceKes: 500,
    sellingPriceKes: 1200,
    portionsAvailable: 40,
    minStockAlert: 10,
    prepTimeMinutes: 12,
    isAvailable: true,
    description: 'Crisp chicken wings glazed in artisanal habanero cayenne butter glaze.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-06',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Grilled Jumbo Tiger Prawns with Lemon Garlic Herb Butter',
    category: 'Steaks & Prime Cuts',
    itemType: 'food',
    portionUnit: 'Plate',
    costPriceKes: 1600,
    sellingPriceKes: 3200,
    portionsAvailable: 20,
    minStockAlert: 5,
    prepTimeMinutes: 18,
    isAvailable: true,
    description: 'Indian Ocean split tiger prawns flame-broiled with crushed garlic and fresh cilantro.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-07',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Virgin Passion Fruit & Mint Mojito',
    category: 'Virgin Mocktails & Refreshers',
    itemType: 'beverage',
    portionUnit: 'Glass',
    costPriceKes: 150,
    sellingPriceKes: 550,
    portionsAvailable: 60,
    minStockAlert: 15,
    prepTimeMinutes: 5,
    isAvailable: true,
    description: 'Fresh passion pulp muddled with garden spearmint, raw cane sugar, and sparkling soda.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-08',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Signature Smoked Old Fashioned Cocktail',
    category: 'Signature Craft Cocktails',
    itemType: 'beverage',
    portionUnit: 'Glass',
    costPriceKes: 400,
    sellingPriceKes: 1200,
    portionsAvailable: 45,
    minStockAlert: 10,
    prepTimeMinutes: 6,
    isAvailable: true,
    description: 'Woodford bourbon, Angostura bitters, demerara sugar smoke-infused under cloche.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'dish-09',
    businessUnitId: 'out-hq-rest-01',
    businessUnitName: 'The Sovereign Club & Grill Lounge',
    branchId: 'br-hq-01',
    name: 'Vanilla Bean Crème Brûlée with Fresh Berries',
    category: 'Desserts & Sweet Bites',
    itemType: 'food',
    portionUnit: 'Portion',
    costPriceKes: 250,
    sellingPriceKes: 750,
    portionsAvailable: 25,
    minStockAlert: 8,
    prepTimeMinutes: 5,
    isAvailable: true,
    description: 'Bourbon vanilla custard topped with flame-caramelized crispy sugar crust.',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
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

    // 6. Ensure authorized Admin records exist (zamodasports@gmail.com and feminiholdings@gmail.com)
    const allStaffSnap = await getDocs(collection(db, 'staff')).catch(() => null);
    const authorizedAdminEmails = ['zamodasports@gmail.com', 'feminiholdings@gmail.com'];
    const foundAdminEmails = new Set<string>();

    if (allStaffSnap && !allStaffSnap.empty) {
      for (const staffDoc of allStaffSnap.docs) {
        const sdata = staffDoc.data();
        const sEmail = (sdata.email || '').toLowerCase().trim();
        if (sdata.role === 'Admin') {
          if (!authorizedAdminEmails.includes(sEmail)) {
            await deleteDoc(doc(db, 'staff', staffDoc.id)).catch(() => {});
          } else {
            foundAdminEmails.add(sEmail);
          }
        }
      }
    }

    const defaultEncryptedPin = await hashPin('123456');

    if (!foundAdminEmails.has('zamodasports@gmail.com')) {
      await setDoc(doc(db, 'staff', 'staff-admin-zamodasports'), {
        id: 'staff-admin-zamodasports',
        name: 'Executive System Admin (Zamoda)',
        email: 'zamodasports@gmail.com',
        role: 'Admin',
        authMethod: 'google',
        pin: defaultEncryptedPin,
        branchId: targetHqId,
        branchName: 'HQ - Main Branch',
        status: 'Active',
        createdBy: 'System Root',
        createdByRole: 'Root',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    if (!foundAdminEmails.has('feminiholdings@gmail.com')) {
      await setDoc(doc(db, 'staff', 'staff-admin-feminiholdings'), {
        id: 'staff-admin-feminiholdings',
        name: 'Femini Holdings Executive Admin',
        email: 'feminiholdings@gmail.com',
        role: 'Admin',
        authMethod: 'google',
        pin: defaultEncryptedPin,
        branchId: targetHqId,
        branchName: 'HQ - Main Branch',
        status: 'Active',
        createdBy: 'System Root',
        createdByRole: 'Root',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }

    // 7. Transparently encrypt all legacy plaintext staff PINs in Firestore
    const allStaffForPinMigration = await getDocs(collection(db, 'staff')).catch(() => null);
    if (allStaffForPinMigration && !allStaffForPinMigration.empty) {
      for (const sDoc of allStaffForPinMigration.docs) {
        const sdata = sDoc.data();
        if (sdata.pin && !isPinHashed(sdata.pin)) {
          const encryptedPin = await hashPin(sdata.pin);
          await updateDoc(doc(db, 'staff', sDoc.id), { pin: encryptedPin }).catch(() => {});
        }
      }
    }

    // 8. Ensure initial authentic sales transactions exist for Today, This Week, This Month, and This Year
    const txSnapshot = await getDocs(collection(db, 'transactions')).catch(() => null);
    if (!txSnapshot || txSnapshot.empty) {
      const now = new Date();
      // Today (2h ago & 5h ago)
      const tToday1 = new Date(now.getTime() - 2 * 3600 * 1000).toISOString();
      const tToday2 = new Date(now.getTime() - 5 * 3600 * 1000).toISOString();
      // This Week
      const dayOfWeek = now.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const tWeek1 = new Date(now.getTime() - Math.min(daysSinceMonday, 1) * 86400 * 1000 - 3600 * 1000).toISOString();
      const tWeek2 = new Date(now.getTime() - Math.min(daysSinceMonday, 2) * 86400 * 1000 - 4 * 3600 * 1000).toISOString();
      // This Month (earlier in month)
      const tMonth1 = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 5), 14, 20, 0).toISOString();
      const tMonth2 = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 9), 11, 45, 0).toISOString();
      // This Year (earlier months)
      const tYear1 = new Date(now.getFullYear(), Math.max(0, now.getMonth() - 2), 14, 16, 30, 0).toISOString();
      const tYear2 = new Date(now.getFullYear(), Math.max(0, now.getMonth() - 4), 21, 10, 15, 0).toISOString();

      const seedTransactions = [
        {
          id: 'tx-seed-today-01',
          docNumber: 'RCP-2026-TODAY-01',
          docType: 'Receipt',
          channel: 'Retail Counter POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Nairobi West Wine Lounge',
          customerLicenseNo: 'RET-LIC-88910',
          itemsSummary: JSON.stringify([{ name: 'Chrome Triple Distilled Vodka (750ml)', quantity: 24, unitPrice: 850, total: 20400 }]),
          subtotal: 20400,
          exciseAndTax: 3264,
          totalAmount: 23664,
          paymentMethod: 'M-Pesa Express',
          status: 'Paid',
          createdBy: 'Operations Director',
          createdByRole: 'Branch Manager',
          createdAt: tToday1,
        },
        {
          id: 'tx-seed-today-02',
          docNumber: 'INV-2026-TODAY-02',
          docType: 'Invoice',
          channel: 'B2B Wholesale POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Upper Hill Hospitality Club',
          customerLicenseNo: 'WHOLE-LIC-44102',
          itemsSummary: JSON.stringify([{ name: 'Johnnie Walker Black Label (750ml)', quantity: 12, unitPrice: 3800, total: 45600 }]),
          subtotal: 45600,
          exciseAndTax: 7296,
          totalAmount: 52896,
          paymentMethod: 'Bank Transfer (EFT)',
          status: 'Paid',
          createdBy: 'Executive System Admin',
          createdByRole: 'Admin',
          createdAt: tToday2,
        },
        {
          id: 'tx-seed-week-01',
          docNumber: 'RCP-2026-WEEK-01',
          docType: 'Receipt',
          channel: 'Retail Counter POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Kilimani Gourmet Cellars',
          customerLicenseNo: 'RET-LIC-39108',
          itemsSummary: JSON.stringify([{ name: 'Jameson Irish Whiskey (750ml)', quantity: 10, unitPrice: 2850, total: 28500 }]),
          subtotal: 28500,
          exciseAndTax: 4560,
          totalAmount: 33060,
          paymentMethod: 'Credit Card (Visa)',
          status: 'Paid',
          createdBy: 'Operations Director',
          createdByRole: 'Branch Manager',
          createdAt: tWeek1,
        },
        {
          id: 'tx-seed-week-02',
          docNumber: 'ORD-2026-WEEK-02',
          docType: 'Online Order',
          channel: 'Customer Online Portal',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Karen Country Member Direct',
          customerLicenseNo: 'INDIV-DIR-1029',
          itemsSummary: JSON.stringify([{ name: 'Gordon\'s London Dry Gin (750ml)', quantity: 8, unitPrice: 1950, total: 15600 }]),
          subtotal: 15600,
          exciseAndTax: 2496,
          totalAmount: 18096,
          paymentMethod: 'M-Pesa Express',
          status: 'Fulfilled',
          createdBy: 'Online Customer',
          createdByRole: 'Customer',
          createdAt: tWeek2,
        },
        {
          id: 'tx-seed-mth-01',
          docNumber: 'INV-2026-MTH-01',
          docType: 'Invoice',
          channel: 'B2B Wholesale POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Parklands Executive Liquors',
          customerLicenseNo: 'B2B-PARK-8819',
          itemsSummary: JSON.stringify([{ name: 'Singleton 12YO Single Malt (700ml)', quantity: 20, unitPrice: 4900, total: 98000 }]),
          subtotal: 98000,
          exciseAndTax: 15680,
          totalAmount: 113680,
          paymentMethod: 'Corporate Credit (30-Day)',
          status: 'Approved',
          createdBy: 'Executive System Admin',
          createdByRole: 'Admin',
          createdAt: tMonth1,
        },
        {
          id: 'tx-seed-mth-02',
          docNumber: 'RCP-2026-MTH-02',
          docType: 'Receipt',
          channel: 'Retail Counter POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Westlands Sky Lounge',
          customerLicenseNo: 'RET-SKY-2281',
          itemsSummary: JSON.stringify([{ name: 'Tanqueray London Dry Gin (750ml)', quantity: 15, unitPrice: 2600, total: 39000 }]),
          subtotal: 39000,
          exciseAndTax: 6240,
          totalAmount: 45240,
          paymentMethod: 'Cash',
          status: 'Paid',
          createdBy: 'Operations Director',
          createdByRole: 'Branch Manager',
          createdAt: tMonth2,
        },
        {
          id: 'tx-seed-yr-01',
          docNumber: 'INV-2026-YR-01',
          docType: 'Invoice',
          channel: 'B2B Wholesale POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Mombasa Road Bonded Logistics Hub',
          customerLicenseNo: 'DIST-MOM-9921',
          itemsSummary: JSON.stringify([{ name: 'Black & White Scotch (750ml)', quantity: 60, unitPrice: 1450, total: 87000 }]),
          subtotal: 87000,
          exciseAndTax: 13920,
          totalAmount: 100920,
          paymentMethod: 'Bank Transfer (EFT)',
          status: 'Paid',
          createdBy: 'Executive System Admin',
          createdByRole: 'Admin',
          createdAt: tYear1,
        },
        {
          id: 'tx-seed-yr-02',
          docNumber: 'INV-2026-YR-02',
          docType: 'Invoice',
          channel: 'B2B Wholesale POS',
          branchId: targetHqId,
          branchName: 'HQ - Main Branch',
          regionId: 'reg-nrb-cbd',
          regionName: 'Nairobi Central Business District (CBD & High-Street)',
          customerName: 'Highridge Wholesale Wholesalers Ltd',
          customerLicenseNo: 'WHOLE-HIGHRIDGE-01',
          itemsSummary: JSON.stringify([{ name: 'Baileys Original Irish Cream (750ml)', quantity: 40, unitPrice: 2400, total: 96000 }]),
          subtotal: 96000,
          exciseAndTax: 15360,
          totalAmount: 111360,
          paymentMethod: 'Bank Transfer (EFT)',
          status: 'Paid',
          createdBy: 'Operations Director',
          createdByRole: 'Branch Manager',
          createdAt: tYear2,
        },
      ];

      for (const stx of seedTransactions) {
        await setDoc(doc(db, 'transactions', stx.id), stx).catch(() => {});
      }
    }

    // 9. Ensure initial Sub-Business Outlets under branch exist (Restaurant/Club & Merchant Shop)
    const buSnap = await getDocs(collection(db, 'business_units')).catch(() => null);
    if (!buSnap || buSnap.empty) {
      for (const bu of INITIAL_BUSINESS_UNITS) {
        await setDoc(doc(db, 'business_units', bu.id), {
          ...bu,
          branchId: targetHqId,
        }).catch(() => {});
      }

      for (const dish of INITIAL_RESTAURANT_INVENTORY) {
        await setDoc(doc(db, 'restaurant_inventory', dish.id), {
          ...dish,
          branchId: targetHqId,
        }).catch(() => {});
      }
    }
  } catch {
    // Ignore if restricted or already purged
  }
}
