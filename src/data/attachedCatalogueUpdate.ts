import { Product } from '../types';

export interface AttachedCatalogueRow {
  sku: string;
  category: string;
  subcategory: string;
  productName: string;
  brand: string;
  packSize: string;
  retailPriceKes: number;
  priceSource: string;
  observationDate: string;
  imageFilename: string;
}

export const ATTACHED_CATALOGUE_CSV_ROWS: AttachedCatalogueRow[] = [];

export function mergeAttachedCatalogueWithExistingProducts(baseProducts: Product[]): Product[] {
  return [...baseProducts];
}
