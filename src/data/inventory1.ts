import { Omit } from 'react';
import { Product } from '../types';

export const INVENTORY_DATA_1: Omit<Product, 'id' | 'createdAt'>[] = [
  {
    sku: 'IPS-WHISKY-002',
    category: 'IPS',
    subCategory: 'Whisky',
    name: 'Johnnie Walker Black Label 12 Years (750ml)',
    brand: 'Johnnie Walker',
    volumeMl: 750,
    abv: 40.0,
    bottlesPerCase: 12.0,
    originCountry: 'Scotland',
    wholesalePriceKes: 3850.0,
    retailPriceKes: 4500.0,
    totalBottles: 360,
  },
  {
    sku: 'IPS-WHISKY-002-1L',
    category: 'IPS',
    subCategory: 'Whisky',
    name: 'Johnnie Walker Black Label 12 Years (1 Litre)',
    brand: 'Johnnie Walker',
    volumeMl: 1000,
    abv: 40.0,
    bottlesPerCase: 12.0,
    originCountry: 'Scotland',
    wholesalePriceKes: 4250.0,
    retailPriceKes: 4999.0,
    totalBottles: 360,
  }
];
