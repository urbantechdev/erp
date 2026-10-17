import React, { useState, useMemo } from 'react';
import { ExternalCustomer } from '../types';
import { Plus, User, Search, Trash2 } from 'lucide-react';

interface ExternalCustomersModuleProps {
  customers: ExternalCustomer[];
  onCreateCustomer: (customer: Omit<ExternalCustomer, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteCustomer: (customerId: string) => Promise<void>;
}

export const ExternalCustomersModule: React.FC<ExternalCustomersModuleProps> = ({
  customers,
  onCreateCustomer,
  onDeleteCustomer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const filtered = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
    );
  }, [customers, searchQuery]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;
    await onCreateCustomer({
      customerNumber: `CUST-${Date.now().toString().slice(-4)}`,
      name,
      customerType: 'Retail Walk-in / Individual',
      phone,
      paymentTerms: 'Cash / M-Pesa on Delivery',
      creditLimitKes: 0,
      status: 'Active',
      createdAt: new Date().toISOString(),
    });
    setName('');
    setPhone('');
    setIsAdding(false);
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">External Customers</h2>
        <button onClick={() => setIsAdding(!isAdding)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Add Customer
        </button>
      </div>
      
      {isAdding && (
        <form onSubmit={handleAdd} className="mb-6 p-4 bg-slate-50 rounded-lg flex gap-4">
          <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="border p-2 rounded" />
          <input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} className="border p-2 rounded" />
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Save</button>
        </form>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
        <input placeholder="Search customers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
      </div>

      <div className="space-y-2">
        {filtered.map(c => (
          <div key={c.id} className="flex justify-between items-center p-3 border rounded-lg">
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-blue-100 text-blue-600 rounded-full'><User className='w-5 h-5'/></div>
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-slate-500">{c.phone}</p>
              </div>
            </div>
            <button onClick={() => onDeleteCustomer(c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};
