import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function EditProductModal({ product, onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: product.name || '',
      sku: product.sku || '',
      product_type: product.product_type || 'Product',
      unit_price: product.unit_price || '',
      cost: product.cost || '',
      is_active: product.is_active ?? true,
      description: product.description || ''
    }
  });

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        unit_price: parseFloat(data.unit_price),
        cost: data.cost ? parseFloat(data.cost) : null
      };
      
      await apiClient.put(`/products/${product.id}`, payload);
      toast.success('Product updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update product');
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name *
                </label>
                <input
                  {...register('name', { required: 'Product name is required' })}
                  className={inputClass}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU *
                </label>
                <input
                  {...register('sku', { required: 'SKU is required' })}
                  className={inputClass}
                />
                {errors.sku && (
                  <p className="mt-1 text-sm text-red-600">{errors.sku.message}</p>
                )}
              </div>

              {/* Product Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type *
                </label>
                <select
                  {...register('product_type', { required: 'Type is required' })}
                  className={inputClass}
                >
                  <option value="Product">Product</option>
                  <option value="Service">Service</option>
                </select>
                {errors.product_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.product_type.message}</p>
                )}
              </div>

              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price *
                </label>
                <input
                  {...register('unit_price', { 
                    required: 'Unit price is required',
                    min: { value: 0, message: 'Price must be positive' }
                  })}
                  type="number"
                  step="0.01"
                  className={inputClass}
                />
                {errors.unit_price && (
                  <p className="mt-1 text-sm text-red-600">{errors.unit_price.message}</p>
                )}
              </div>

              {/* Quantity in Stock */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost
                </label>
                <input
                  {...register('cost')}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                />
              </div>

              {/* Is Active */}
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register('is_active')}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active (available for sale)
                  </span>
                </label>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows="4"
                  className={inputClass}
                />
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
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Update Product'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditProductModal;