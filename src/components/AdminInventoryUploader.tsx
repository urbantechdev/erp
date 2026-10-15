import React, { useState } from 'react';
import { INVENTORY_DATA_1 } from '../data/inventory1'; // Need to create inventory1.ts
import { Product } from '../types';

interface AdminInventoryUploaderProps {
  onBatchImport: (products: Omit<Product, 'id' | 'createdAt'>[]) => Promise<number>;
}

export const AdminInventoryUploader: React.FC<AdminInventoryUploaderProps> = ({ onBatchImport }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    setIsUploading(true);
    try {
      await onBatchImport(INVENTORY_DATA_1);
      alert('Batch 1 uploaded successfully!');
    } catch (error) {
      console.error('Batch upload failed:', error);
      alert('Batch upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <button
        onClick={handleUpload}
        disabled={isUploading}
        className="px-4 py-2 bg-red-600 text-white rounded-lg shadow-lg font-bold"
      >
        {isUploading ? 'Uploading...' : 'Upload Inventory Batch 1'}
      </button>
    </div>
  );
};
