import { Product, InventoryItem } from '../types';
import { executeCatalogBarcodeQualityPipeline } from '../utils/barcodeQualityPipeline';

export type NairobiDrinksSubCategory =
  | 'Whisky'
  | 'Cognac & Brandy'
  | 'Gin'
  | 'Vodka'
  | 'Rum'
  | 'White Rum'
  | 'Spiced & Dark Rum'
  | 'Tequila'
  | 'Liqueur & Cream'
  | 'Cream Liqueur'
  | 'Champagne & Wine'
  | 'Beer & Cider';

export const NAIROBI_DRINKS_SUB_CATEGORIES: NairobiDrinksSubCategory[] = [
  'Whisky',
  'Cognac & Brandy',
  'Gin',
  'Vodka',
  'Rum',
  'White Rum',
  'Spiced & Dark Rum',
  'Tequila',
  'Liqueur & Cream',
  'Cream Liqueur',
  'Champagne & Wine',
  'Beer & Cider',
];

export function isWhiteSilverRumProduct(product: {
  sku?: string;
  name?: string;
  subCategory?: string;
}): boolean {
  const sku = (product.sku || '').toUpperCase();
  const name = (product.name || '').toLowerCase();
  const sub = (product.subCategory || '').toLowerCase();
  if (sub === 'white rum') return true;
  if (sku.includes('-RUM-WHT-')) return true;
  if (
    sub.includes('rum') &&
    (name.includes('carta blanca') ||
      name.includes('white rum') ||
      name.includes('white spiced') ||
      name.includes('3 years cuban white'))
  ) {
    return true;
  }
  return false;
}

export function isCreamLiqueurProduct(product: {
  sku?: string;
  name?: string;
  brand?: string;
  subCategory?: string;
  isCreamBased?: boolean;
}): boolean {
  if (product.isCreamBased) return true;
  const sku = (product.sku || '').toUpperCase();
  const text = `${product.name || ''} ${product.brand || ''} ${product.subCategory || ''}`.toLowerCase();
  if (sku.includes('-LIQ-CRM-') || (product.subCategory || '').toLowerCase() === 'cream liqueur') {
    return true;
  }
  if (
    text.includes('baileys') ||
    text.includes('amarula') ||
    text.includes('sheridan') ||
    text.includes('tequila rose') ||
    text.includes('strawberry lips') ||
    text.includes('best marula') ||
    text.includes('cream liqueur') ||
    text.includes('irish cream')
  ) {
    return true;
  }
  return false;
}

export const CATALOG_BARCODE_QUALITY_AUDIT = executeCatalogBarcodeQualityPipeline([]);

export const NAIROBI_DRINKS_PRODUCTS: Product[] = [];

export function buildInitialNairobiDrinksInventory(_products: Product[]): InventoryItem[] {
  return [];
}
