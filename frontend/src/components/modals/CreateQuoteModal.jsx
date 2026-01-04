import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function CreateQuoteModal({ onClose, onSuccess, preselectedAccountId = null }) {
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState(preselectedAccountId || '');
  const [items, setItems] = useState([
    { product_id: '', quantity: 1, unit_price: 0, discount_percentage: 0, description: '' }
  ]);
  
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      account_id: preselectedAccountId || '',
      tax_rate: 0,
      discount_value: 0,
      discount_type: 'flat'
    }
  });

  const taxRate = watch('tax_rate', 0);
  const discountType = watch('discount_type', 'flat');
  const discountValue = watch('discount_value', 0);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedAccountId) {
      loadContacts(selectedAccountId);
      loadOpportunities(selectedAccountId);
    } else {
      setContacts([]);
      setOpportunities([]);
    }
  }, [selectedAccountId]);

  const loadData = async () => {
    try {
      const [accountsRes, productsRes] = await Promise.all([
        apiClient.get('/accounts'),
        apiClient.get('/products')
      ]);
      setAccounts(accountsRes.data);
      setProducts(productsRes.data.filter(p => p.is_active));
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoadingData(false);
    }
  };

  const loadContacts = async (accountId) => {
    try {
      const response = await apiClient.get(`/contacts?account_id=${accountId}`);
      setContacts(response.data);
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setContacts([]);
    }
  };

  const loadOpportunities = async (accountId) => {
    try {
      const response = await apiClient.get(`/opportunities?account_id=${accountId}`);
      setOpportunities(response.data);
    } catch (error) {
      console.error('Failed to load opportunities:', error);
      setOpportunities([]);
    }
  };

  const addItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0, discount_percentage: 0, description: '' }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    // Auto-fill unit price when product is selected
    if (field === 'product_id' && value) {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].unit_price = parseFloat(product.unit_price);
        newItems[index].description = product.description || product.name;
      }
    }
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percentage / 100);
      return sum + itemTotal;
    }, 0);

    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = subtotal * (discountValue / 100);
    } else {
      discountAmount = parseFloat(discountValue || 0);
    }

    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (parseFloat(taxRate || 0) / 100);
    const total = afterDiscount + taxAmount;

    return { subtotal, discountAmount, taxAmount, total };
  };

  const totals = calculateTotals();

  const onSubmit = async (data) => {
    try {
      // Validate that at least one item has a product selected
      const validItems = items.filter(item => item.product_id);
      if (validItems.length === 0) {
        toast.error('Please add at least one product');
        return;
      }

      const payload = {
        account_id: data.account_id,
        contact_id: data.contact_id || null,
        opportunity_id: data.opportunity_id || null,
        tax_rate: parseFloat(data.tax_rate || 0),
        discount_type: data.discount_type || 'flat',
        discount_value: parseFloat(data.discount_value || 0),
        valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : null,
        notes: data.notes || null,
        terms_conditions: data.terms_conditions || null,
        items: validItems.map(item => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
          discount_percentage: parseFloat(item.discount_percentage || 0),
          description: item.description || ''
        }))
      };
      
      await apiClient.post('/quotes', payload);
      toast.success('Quote created successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create quote');
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={onClose}></div>

      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Create New Quote</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>

          {/* Form Content - Scrollable */}
          <div className="px-6 py-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
              {/* Account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account *</label>
                <select
                  {...register('account_id', { required: 'Account is required' })}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    setValue('account_id', e.target.value);
                    setValue('contact_id', '');
                    setValue('opportunity_id', '');
                  }}
                  className={inputClass}
                  disabled={loadingData}
                >
                  <option value="">Select account...</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                {errors.account_id && <p className="mt-1 text-sm text-red-600">{errors.account_id.message}</p>}
              </div>

              {/* Contact */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact</label>
                <select {...register('contact_id')} className={inputClass} disabled={!selectedAccountId}>
                  <option value="">Select contact...</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                      {c.is_primary && ' (Primary)'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {!selectedAccountId ? 'Select an account first' : 'Optional'}
                </p>
              </div>

              {/* Valid Until */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                <input {...register('valid_until')} type="date" className={inputClass} />
              </div>
            </div>

            {/* Opportunity Selection - NEW */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Opportunity
              </label>
              <select 
                {...register('opportunity_id')} 
                className={inputClass}
                disabled={!selectedAccountId}
              >
                <option value="">Select opportunity (optional)...</option>
                {opportunities.map(opp => (
                  <option key={opp.id} value={opp.id}>
                    {opp.name} - {opp.stage}
                    {opp.amount && ` ($${parseFloat(opp.amount).toFixed(2)})`}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {!selectedAccountId 
                  ? 'Select an account first' 
                  : opportunities.length === 0
                  ? 'No opportunities found for this account'
                  : 'Link this quote to an existing opportunity'}
              </p>
            </div>

            {/* Quote Items */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Quote Items</h4>
                <button type="button" onClick={addItem} className="btn btn-secondary text-sm flex items-center">
                  <Plus size={16} className="mr-1" />
                  Add Item
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Disc%</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => {
                      const itemTotal = item.quantity * item.unit_price * (1 - item.discount_percentage / 100);
                      return (
                        <tr key={index}>
                          <td className="px-3 py-2">
                            <select
                              value={item.product_id}
                              onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                            >
                              <option value="">Select...</option>
                              {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discount_percentage}
                              onChange={(e) => updateItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-semibold">${itemTotal.toFixed(2)}</td>
                          <td className="px-3 py-2">
                            {items.length > 1 && (
                              <button type="button" onClick={() => removeItem(index)} className="text-red-600 hover:text-red-800">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Details & Totals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                    <input {...register('tax_rate')} type="number" step="0.01" min="0" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                    <select {...register('discount_type')} className={inputClass}>
                      <option value="flat">Flat Amount</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
                  <input {...register('discount_value')} type="number" step="0.01" min="0" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea {...register('notes')} rows="2" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
                  <textarea {...register('terms_conditions')} rows="2" className={inputClass} placeholder="Payment terms, delivery terms, etc..." />
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Quote Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-semibold">${totals.subtotal.toFixed(2)}</span>
                  </div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Discount:</span>
                      <span className="text-red-600">-${totals.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({taxRate}%):</span>
                    <span className="font-semibold">${totals.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-green-600">${totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              {isSubmitting ? 'Creating...' : 'Create Quote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateQuoteModal;