export interface ClubTopupItem {
  id: string;
  name: string;
  category: 'liquor' | 'sigger' | 'shisha' | 'amenity';
  portionUnit: string;
  priceKes: number;
  costKes: number;
  description: string;
  inStock: boolean;
  brand?: string;
  origin?: string;
}

// Authentic Cigars ("Sigger") & Premium Tobacco for Club/Lounge Service
export const PRESET_SIGGER_ITEMS: ClubTopupItem[] = [
  {
    id: 'topup-sig-01',
    name: 'Cohiba Siglo VI (Handmade Cuban Cigar)',
    category: 'sigger',
    portionUnit: 'Stick',
    priceKes: 4800,
    costKes: 2400,
    description: 'Iconic Grand Corona, medium-full body, rich notes of cedar, cocoa, and fine leather.',
    inStock: true,
    brand: 'Cohiba',
    origin: 'Havana, Cuba',
  },
  {
    id: 'topup-sig-02',
    name: 'Montecristo No. 4 (Classic Cuban Petit Corona)',
    category: 'sigger',
    portionUnit: 'Stick',
    priceKes: 3400,
    costKes: 1700,
    description: 'World-renowned Cuban classic with notes of roasted coffee, cinnamon, and toasted wood.',
    inStock: true,
    brand: 'Montecristo',
    origin: 'Havana, Cuba',
  },
  {
    id: 'topup-sig-03',
    name: 'Romeo y Julieta No. 2 (Aluminium Tube)',
    category: 'sigger',
    portionUnit: 'Stick',
    priceKes: 2900,
    costKes: 1450,
    description: 'Balanced Petit Corona in protective cedar-lined tubos, smooth nutty finish.',
    inStock: true,
    brand: 'Romeo y Julieta',
    origin: 'Havana, Cuba',
  },
  {
    id: 'topup-sig-04',
    name: 'Partagás Serie D No. 4 (Robusto)',
    category: 'sigger',
    portionUnit: 'Stick',
    priceKes: 4200,
    costKes: 2100,
    description: 'Full-bodied powerhouse, spicy earthiness and oak, ideal after red meat and aged single malts.',
    inStock: true,
    brand: 'Partagás',
    origin: 'Havana, Cuba',
  },
  {
    id: 'topup-sig-05',
    name: 'Dunhill Switch Green Pack (20 Sticks)',
    category: 'sigger',
    portionUnit: 'Pack',
    priceKes: 650,
    costKes: 420,
    description: 'Crush-ball menthol capsule premium blend king size cigarette pack.',
    inStock: true,
    brand: 'Dunhill',
    origin: 'UK / Bonded',
  },
  {
    id: 'topup-sig-06',
    name: 'Marlboro Gold Selected Reserve Pack (20 Sticks)',
    category: 'sigger',
    portionUnit: 'Pack',
    priceKes: 550,
    costKes: 360,
    description: 'Smooth American Virginia blend gold filter cigarettes.',
    inStock: true,
    brand: 'Marlboro',
    origin: 'Bonded Transit',
  },
  {
    id: 'topup-sig-07',
    name: 'Sobranie Black Russian Cocktail Pack (20 Sticks)',
    category: 'sigger',
    portionUnit: 'Pack',
    priceKes: 1200,
    costKes: 750,
    description: 'Luxury black paper with gold foil tip cigarettes, aromatic rich roast.',
    inStock: true,
    brand: 'Sobranie',
    origin: 'UK Bonded',
  },
];

// Premium Hookah / Shisha Flavors & Service Upgrades
export const PRESET_SHISHA_ITEMS: ClubTopupItem[] = [
  {
    id: 'topup-shisha-01',
    name: 'Double Apple Deluxe Hookah (Classic Al Fakher)',
    category: 'shisha',
    portionUnit: 'Head & Pipe',
    priceKes: 2200,
    costKes: 450,
    description: 'Traditional aniseed & red sweet apple molasses served in German stainless steel pipe.',
    inStock: true,
    brand: 'Al Fakher',
  },
  {
    id: 'topup-shisha-02',
    name: 'Blueberry Freeze & Mint Shisha',
    category: 'shisha',
    portionUnit: 'Head & Pipe',
    priceKes: 2400,
    costKes: 500,
    description: 'Crisp wild blueberries combined with sub-zero glacier mint cool smoke.',
    inStock: true,
    brand: 'Starbuzz',
  },
  {
    id: 'topup-shisha-03',
    name: 'Grape Mint Ice Cloud Shisha',
    category: 'shisha',
    portionUnit: 'Head & Pipe',
    priceKes: 2200,
    costKes: 450,
    description: 'White Muscat grape infusion with natural spearmint leaves and ice chamber.',
    inStock: true,
    brand: 'Al Fakher',
  },
  {
    id: 'topup-shisha-04',
    name: 'Peach Passion Ice Shisha',
    category: 'shisha',
    portionUnit: 'Head & Pipe',
    priceKes: 2400,
    costKes: 500,
    description: 'Juicy tropical yellow peach and passionfruit punch aroma.',
    inStock: true,
    brand: 'Adalya',
  },
  {
    id: 'topup-shisha-05',
    name: 'Fresh Pineapple Fruit Bowl Upgrade',
    category: 'shisha',
    portionUnit: 'Upgrade',
    priceKes: 950,
    costKes: 250,
    description: 'Carved natural pineapple head for smoother pull and enhanced tropical sweet smoke.',
    inStock: true,
  },
  {
    id: 'topup-shisha-06',
    name: 'Ice Hose Chill Wand Tip Topup',
    category: 'shisha',
    portionUnit: 'Attachment',
    priceKes: 500,
    costKes: 100,
    description: 'Gel-frozen mouth tip for icy smoke intake over 90 minutes.',
    inStock: true,
  },
  {
    id: 'topup-shisha-07',
    name: 'Fresh Coconut Briquette Coals Refill (3 Cubes)',
    category: 'shisha',
    portionUnit: 'Refill',
    priceKes: 300,
    costKes: 60,
    description: '100% natural organic smokeless coconut shell charcoal heat management topup.',
    inStock: true,
  },
];

// VIP Club & Lounge Amenities
export const PRESET_AMENITY_ITEMS: ClubTopupItem[] = [
  {
    id: 'topup-amenity-01',
    name: 'VIP Bottle Sparkler Show & Server Presentation',
    category: 'amenity',
    portionUnit: 'Show',
    priceKes: 1500,
    costKes: 300,
    description: 'Dual LED flashing champagne presenter and celebratory indoor cold sparkler show.',
    inStock: true,
  },
  {
    id: 'topup-amenity-02',
    name: 'Red Bull Energy Can Caddy (4 Cans + Ice)',
    category: 'amenity',
    portionUnit: 'Caddy',
    priceKes: 1400,
    costKes: 800,
    description: 'Four chilled 250ml Red Bull cans served in crystal ice caddy for table spirits.',
    inStock: true,
    brand: 'Red Bull',
  },
  {
    id: 'topup-amenity-03',
    name: 'Fever-Tree Premium Tonic Water (4 Cans)',
    category: 'amenity',
    portionUnit: 'Caddy',
    priceKes: 1200,
    costKes: 650,
    description: 'Artisanal Indian tonic water with natural quinine for gin & vodka pairing.',
    inStock: true,
    brand: 'Fever-Tree',
  },
  {
    id: 'topup-amenity-04',
    name: 'Executive Crystal Ice Bucket & Tongs Service',
    category: 'amenity',
    portionUnit: 'Service',
    priceKes: 400,
    costKes: 50,
    description: 'Triple-filtered gourmet clear cocktail ice cubes with insulated bucket.',
    inStock: true,
  },
];

// Default Preset Categories for New Restaurant/Club Outlets
export const DEFAULT_RESTAURANT_FOOD_CATEGORIES = [
  'Starters & Small Plates',
  'Steaks & Prime Cuts',
  'Nyama Choma & Grills',
  'Gourmet Burgers & Sliders',
  'Sharing Platters',
  'Sides & Loaded Fries',
  'Artisan Pizzas',
  'Desserts & Sweet Bites',
];

export const DEFAULT_RESTAURANT_BEVERAGE_CATEGORIES = [
  'Signature Craft Cocktails',
  'Virgin Mocktails & Refreshers',
  'Freshly Squeezed Juices',
  'Gourmet Milkshakes',
  'Barista Coffee & Herbal Tea',
  'Soft Drinks & Mixers',
];
