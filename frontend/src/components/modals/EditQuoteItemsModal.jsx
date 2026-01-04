import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function EditQuoteItemsModal({ quote, onClose, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const productsRes = await apiClient.get('/products');
      setProducts(productsRes.data.filter(p => p.is_active));
      
      // Initialize items from quote
      if (quote.items && quote.items.length > 0) {
        setItems(quote.items.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price),
          discount_percentage: parseFloat(item.discount_percentage || 0),
          description: item.description || ''
        })));
      } else {
        setItems([{ product_id: '', quantity: 1, unit_price: 0, discount_percentage: 0, description: '' }]);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      toast.error('Failed to load products');
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

  const calculateTotal = (item) => {
    return item.quantity * item.unit_price * (1 - item.discount_percentage / 100);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + calculateTotal(item), 0);
  };

  const handleSubmit = async () => {
    try {
      // Validate that at least one item has a product selected
      const validItems = items.filter(item => item.product_id);
      if (validItems.length === 0) {
        toast.error('Please add at least one product');
        return;
      }

      setIsSubmitting(true);

      const payload = {
        items: validItems.map(item => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          unit_price: parseFloat(item.unit_price),
          discount_percentage: parseFloat(item.discount_percentage || 0),
          description: item.description || ''
        }))
      };

      await apiClient.put(`/quotes/${quote.id}/items`, payload);
      toast.success('Quote items updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update quote items');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={onClose}></div>

      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Edit Quote Items - {quote.quote_number}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto flex-1">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">
                Modify the line items for this quote. Totals will be recalculated automatically.
              </p>
              <button 
                type="button" 
                onClick={addItem} 
                className="btn btn-secondary text-sm flex items-center"
              >
                <Plus size={16} className="mr-1" />
                Add Item
              </button>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disc%</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <select
                          value={item.product_id}
                          onChange={(e) => updateItem(index, 'product_id', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select product...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                          placeholder="Description..."
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          className="w-28 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discount_percentage}
                          onChange={(e) => updateItem(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold">
                        ${calculateTotal(item).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeItem(index)} 
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Subtotal */}
            <div className="flex justify-end">
              <div className="w-64 bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-semibold">${calculateSubtotal().toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Tax and discounts will be applied based on the quote settings.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSubmit}
              disabled={isSubmitting} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              {isSubmitting ? 'Saving...' : 'Save Items'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditQuoteItemsModal;