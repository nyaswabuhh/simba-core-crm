import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function EditQuoteModal({ quote, onClose, onSuccess }) {
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      status: quote.status || 'Draft',
      tax_rate: quote.tax_rate || 0,
      discount_type: quote.discount_type || '',
      discount_value: quote.discount_value || 0,
      valid_until: formatDateForInput(quote.valid_until),
      notes: quote.notes || '',
      terms_conditions: quote.terms_conditions || ''
    }
  });

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        tax_rate: parseFloat(data.tax_rate || 0),
        discount_value: parseFloat(data.discount_value || 0),
        valid_until: data.valid_until ? new Date(data.valid_until).toISOString() : null
      };
      
      await apiClient.put(`/quotes/${quote.id}`, payload);
      toast.success('Quote updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update quote');
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
            <h3 className="text-lg font-semibold text-gray-900">Edit Quote - {quote.quote_number}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Valid Until */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valid Until
                </label>
                <input
                  {...register('valid_until')}
                  type="date"
                  className={inputClass}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  {...register('status', { required: 'Status is required' })}
                  className={inputClass}
                >
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Expired">Expired</option>
                  <option value="Converted">Converted</option>
                </select>
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
                )}
              </div>

              {/* Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  {...register('tax_rate')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className={inputClass}
                />
              </div>

              {/* Discount Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Type
                </label>
                <select
                  {...register('discount_type')}
                  className={inputClass}
                >
                  <option value="">No Discount</option>
                  <option value="percentage">Percentage</option>
                  <option value="flat">Flat Amount</option>
                </select>
              </div>

              {/* Discount Value */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount Value
                </label>
                <input
                  {...register('discount_value')}
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  rows="3"
                  className={inputClass}
                />
              </div>

              {/* Terms & Conditions */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  {...register('terms_conditions')}
                  rows="3"
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
                'Update Quote'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditQuoteModal;