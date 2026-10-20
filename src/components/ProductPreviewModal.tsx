import React from 'react';
import { X, ShoppingCart, Tag, Info, Package } from 'lucide-react';
import { ProductImage } from './ProductImage';
import { formatKes } from '../erpUtils';

interface ProductPreviewModalProps {
  product: any;
  onClose: () => void;
  onAddToCart: (product: any, mode: 'Bottle' | 'Case') => void;
  stock: number;
}

export const ProductPreviewModal: React.FC<ProductPreviewModalProps> = ({
  product,
  onClose,
  onAddToCart,
  stock,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-3xl border-2 border-[#0A006E] shadow-2xl overflow-hidden my-auto p-6 space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-2xl overflow-hidden border border-slate-200">
            <ProductImage product={product} size="full" />
          </div>
          <div>
            <h2 className="text-lg font-montserrat font-black text-[#0A006E]">{product.name}</h2>
            <p className="text-sm text-slate-500 font-medium">{product.brand} · {product.subCategory}</p>
            <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-montserrat font-black ${stock > 0 ? 'bg-[#34D186] text-[#0A006E]' : 'bg-rose-500 text-white'}`}>
                    {stock > 0 ? `${stock} in stock` : 'Out of stock'}
                </span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-slate-700">
            <p><span className="font-bold">Description:</span> {product.description || 'No description available.'}</p>
            <p><span className="font-bold">Alcohol:</span> {product.alcoholPercentage}%</p>
            <p><span className="font-bold">Volume:</span> {product.volumeMl}ml</p>
        </div>

        <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={() => onAddToCart(product, 'Bottle')}
            disabled={stock <= 0}
            className="px-4 py-2 bg-[#FFDE00] text-[#0A006E] rounded-xl font-bold font-montserrat text-sm disabled:opacity-50"
          >
            Add Bottle
          </button>
          <button
            onClick={() => onAddToCart(product, 'Case')}
            disabled={stock <= 0}
            className="px-4 py-2 bg-[#0A006E] text-white rounded-xl font-bold font-montserrat text-sm disabled:opacity-50"
          >
            Add Case
          </button>
        </div>
      </div>
    </div>
  );
};
