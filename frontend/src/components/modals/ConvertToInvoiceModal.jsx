import { useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function ConvertToInvoiceModal({ quote, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    issue_date: new Date().toISOString().split('T')[0],
    due_date: (() => {
      const date = new Date();
      date.setDate(date.getDate()); // Default due today
      return date.toISOString().split('T')[0];
    })(),
    notes: quote.notes || '',
    terms_conditions: quote.terms_conditions || ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.issue_date) {
      toast.error('Please select an issue date');
      return;
    }

    if (!formData.due_date) {
      toast.error('Please select a due date');
      return;
    }

    // Validate due date is after issue date
    if (new Date(formData.due_date) < new Date(formData.issue_date)) {
      toast.error('Due date must be after issue date');
      return;
    }

    try {
      setLoading(true);

      const response = await apiClient.post(`/invoices/from-quote/${quote.id}`, {
        issue_date: formData.issue_date,
        due_date: formData.due_date,
        notes: formData.notes || null,
        terms_conditions: formData.terms_conditions || null
      });

      onSuccess(response.data.id);
    } catch (error) {
      console.error('Error converting quote to invoice:', error);
      toast.error(error.response?.data?.detail || 'Failed to create invoice from quote');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${parseFloat(value).toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Convert Quote to Invoice</h2>
            <p className="text-sm text-gray-600 mt-1">
              Quote {quote.quote_number} will be converted to an invoice
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Quote Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Quote Summary</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-blue-700">Quote Number:</p>
                <p className="text-blue-900 font-medium">{quote.quote_number}</p>
              </div>
              <div>
                <p className="text-blue-700">Total Amount:</p>
                <p className="text-blue-900 font-medium">{formatCurrency(quote.total_amount)}</p>
              </div>
              <div>
                <p className="text-blue-700">Items:</p>
                <p className="text-blue-900 font-medium">{quote.items?.length || 0} items</p>
              </div>
              <div>
                <p className="text-blue-700">Tax Rate:</p>
                <p className="text-blue-900 font-medium">{quote.tax_rate}%</p>
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Invoice Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Issue Date *
                </label>
                <input
                  type="date"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleInputChange}
                  className="input"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Date the invoice is issued</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  name="due_date"
                  value={formData.due_date}
                  onChange={handleInputChange}
                  className="input"
                  required
                  min={formData.issue_date}
                />
                <p className="text-xs text-gray-500 mt-1">Payment due date</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="3"
                className="input"
                placeholder="Internal notes about this invoice (optional)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Terms & Conditions
              </label>
              <textarea
                name="terms_conditions"
                value={formData.terms_conditions}
                onChange={handleInputChange}
                rows="3"
                className="input"
                placeholder="Payment terms and conditions (optional)"
              />
            </div>
          </div>

          {/* What will happen */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">What will happen:</h3>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>A new invoice will be created with all quote items</li>
              <li>The quote will be marked as "Converted"</li>
              <li>All financial amounts will be copied to the invoice</li>
              <li>The invoice will be in "Draft" status initially</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary bg-green-600 hover:bg-green-700"
              disabled={loading}
            >
              {loading ? 'Creating Invoice...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConvertToInvoiceModal;