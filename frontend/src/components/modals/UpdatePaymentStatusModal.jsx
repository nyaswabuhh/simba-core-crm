import { useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function UpdatePaymentStatusModal({ payment, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: payment.status,
    notes: payment.notes || ''
  });

  const paymentStatuses = [
    { value: 'Completed', label: 'Completed', disabled: payment.status === 'Completed' },
    { value: 'Pending', label: 'Pending', disabled: false },
    { value: 'Failed', label: 'Failed', disabled: false },
    { value: 'Refunded', label: 'Refunded', disabled: false }
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${parseFloat(value).toFixed(2)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.status === payment.status && formData.notes === payment.notes) {
      toast.error('No changes to save');
      return;
    }

    try {
      setLoading(true);

      const updateData = {
        status: formData.status,
        notes: formData.notes || null
      };

      await apiClient.put(`/payments/${payment.id}`, updateData);

      toast.success('Payment updated successfully');
      onSuccess();
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error(error.response?.data?.detail || 'Failed to update payment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusImpact = () => {
    if (formData.status === payment.status) {
      return null;
    }

    if (formData.status === 'Refunded' && payment.status !== 'Refunded') {
      return {
        type: 'warning',
        title: 'Refund Warning',
        message: `This will mark the payment as refunded and deduct ${formatCurrency(payment.amount)} from the invoice's paid amount.`
      };
    }

    if (formData.status === 'Failed') {
      return {
        type: 'warning',
        title: 'Mark as Failed',
        message: 'This payment will be marked as failed. The invoice will not be affected.'
      };
    }

    if (formData.status === 'Pending') {
      return {
        type: 'info',
        title: 'Mark as Pending',
        message: 'This payment will be marked as pending confirmation.'
      };
    }

    return null;
  };

  const impact = getStatusImpact();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Update Payment Status</h2>
            <p className="text-sm text-gray-600 mt-1">
              Payment {payment.payment_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Payment Summary */}
        <div className="p-6 bg-blue-50 border-b border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Payment Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Amount:</p>
              <p className="text-blue-900 font-medium text-lg">{formatCurrency(payment.amount)}</p>
            </div>
            <div>
              <p className="text-blue-700">Current Status:</p>
              <p className="text-blue-900 font-medium">{payment.status}</p>
            </div>
            <div>
              <p className="text-blue-700">Method:</p>
              <p className="text-blue-900 font-medium">{payment.payment_method}</p>
            </div>
            <div>
              <p className="text-blue-700">Reference:</p>
              <p className="text-blue-900 font-medium">{payment.reference_number || '-'}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Status *
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              className="input"
              required
            >
              {paymentStatuses.map(status => (
                <option 
                  key={status.value} 
                  value={status.value}
                  disabled={status.disabled}
                >
                  {status.label}
                  {status.disabled && status.value === payment.status && ' (Current)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Select the new status for this payment
            </p>
          </div>

          {/* Status Impact Warning */}
          {impact && (
            <div className={`rounded-lg p-4 ${
              impact.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' : 
              impact.type === 'error' ? 'bg-red-50 border border-red-200' :
              'bg-blue-50 border border-blue-200'
            }`}>
              <h4 className={`text-sm font-semibold mb-2 ${
                impact.type === 'warning' ? 'text-yellow-900' : 
                impact.type === 'error' ? 'text-red-900' :
                'text-blue-900'
              }`}>
                {impact.title}
              </h4>
              <p className={`text-sm ${
                impact.type === 'warning' ? 'text-yellow-800' : 
                impact.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {impact.message}
              </p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
              className="input"
              placeholder="Add notes about this status change (optional)"
            />
            <p className="text-xs text-gray-500 mt-1">
              These notes will replace any existing notes
            </p>
          </div>

          {/* Important Notice */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Important:</h4>
            <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
              <li>Status changes are tracked and logged</li>
              <li>Changing to "Refunded" will update the invoice</li>
              <li>Some status changes cannot be reversed</li>
              <li>Notes are visible to all finance users</li>
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
              className="btn btn-primary"
              disabled={loading || (formData.status === payment.status && formData.notes === payment.notes)}
            >
              {loading ? 'Updating...' : 'Update Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdatePaymentStatusModal;