import React from 'react';
import { Product, Branch, GeoRegion } from '../types';
import { ShoppingCart } from 'lucide-react';

interface CustomerPortalViewProps {
  products: Product[];
  branches: Branch[];
  regions: GeoRegion[];
  onPlaceOnlineOrder: (draft: any) => void;
  onPreviewDoc: (d: any) => void;
  onBackToErpLogin: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  products,
}) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Customer Online Store</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {products.slice(0, 6).map(product => (
          <div key={product.id} className="border p-4 rounded-lg shadow-sm">
            <h3 className="font-semibold">{product.name}</h3>
            <p className="text-sm text-gray-600">KES {product.retailPriceKes}</p>
            <button className="mt-2 w-full bg-indigo-600 text-white py-2 rounded flex items-center justify-center gap-2">
              <ShoppingCart size={16} /> Add to Cart
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
