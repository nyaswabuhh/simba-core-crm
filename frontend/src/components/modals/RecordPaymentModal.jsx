import { useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function RecordPaymentModal({ invoice, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: invoice.amount_due || 0,
    payment_method: 'Bank Transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: '',
    transaction_id: '',
    processor: ''
  });

  const paymentMethods = [
    'Cash',
    'MPESA',
    'Check',
    'Credit Card',
    'Bank Transfer',
    'PayPal',
    'Stripe',
    'Other'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAmountChange = (e) => {
    const value = parseFloat(e.target.value) || 0;
    // Don't allow amount greater than amount due
    if (value > parseFloat(invoice.amount_due)) {
      toast.error(`Payment amount cannot exceed amount due (${formatCurrency(invoice.amount_due)})`);
      return;
    }
    setFormData(prev => ({
      ...prev,
      amount: value
    }));
  };

  const setFullAmount = () => {
    setFormData(prev => ({
      ...prev,
      amount: parseFloat(invoice.amount_due)
    }));
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${parseFloat(value).toFixed(2)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.amount || formData.amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (formData.amount > parseFloat(invoice.amount_due)) {
      toast.error('Payment amount cannot exceed amount due');
      return;
    }

    if (!formData.payment_method) {
      toast.error('Please select a payment method');
      return;
    }

    if (!formData.payment_date) {
      toast.error('Please select a payment date');
      return;
    }

    try {
      setLoading(true);

      // Prepare payment data
      const paymentData = {
        invoice_id: invoice.id,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method,
        payment_date: new Date(formData.payment_date).toISOString(),
        reference_number: formData.reference_number || null,
        notes: formData.notes || null,
        transaction_id: formData.transaction_id || null,
        processor: formData.processor || null
      };

      // Create payment
      await apiClient.post('/payments', paymentData);

      toast.success('Payment recorded successfully');
      onSuccess();
    } catch (error) {
      console.error('Error recording payment:', error);
      
      // Handle specific error cases
      if (error.response?.status === 403) {
        toast.error('Only Finance users can record payments. Please contact your finance department.');
      } else if (error.response?.status === 400) {
        toast.error(error.response?.data?.detail || 'Invalid payment data');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to record payment');
      }
    } finally {
      setLoading(false);
    }
  };

  const remainingAfterPayment = parseFloat(invoice.amount_due) - parseFloat(formData.amount || 0);
  const willBePaid = remainingAfterPayment <= 0.01; // Account for floating point

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Record Payment</h2>
            <p className="text-sm text-gray-600 mt-1">
              Invoice {invoice.invoice_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Invoice Summary */}
        <div className="p-6 bg-blue-50 border-b border-blue-200">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Invoice Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-blue-700">Total Amount:</p>
              <p className="text-blue-900 font-medium text-lg">{formatCurrency(invoice.total_amount)}</p>
            </div>
            <div>
              <p className="text-blue-700">Amount Paid:</p>
              <p className="text-green-600 font-medium text-lg">{formatCurrency(invoice.amount_paid)}</p>
            </div>
            <div>
              <p className="text-blue-700">Amount Due:</p>
              <p className="text-red-600 font-medium text-lg">{formatCurrency(invoice.amount_due)}</p>
            </div>
            <div>
              <p className="text-blue-700">Status:</p>
              <p className="text-blue-900 font-medium">{invoice.status}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Payment Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount *
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleAmountChange}
                  className="input pl-7"
                  step="0.01"
                  min="0.01"
                  max={invoice.amount_due}
                  required
                />
              </div>
              <button
                type="button"
                onClick={setFullAmount}
                className="btn btn-secondary whitespace-nowrap"
              >
                Full Amount
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Maximum: {formatCurrency(invoice.amount_due)}
            </p>
          </div>

          {/* Payment Preview */}
          {formData.amount > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-900 mb-2">After this payment:</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-green-700">Total Paid:</span>
                  <span className="text-green-900 font-medium">
                    {formatCurrency(parseFloat(invoice.amount_paid) + parseFloat(formData.amount))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Remaining Due:</span>
                  <span className={`font-medium ${willBePaid ? 'text-green-600' : 'text-orange-600'}`}>
                    {formatCurrency(remainingAfterPayment)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-green-300">
                  <span className="text-green-700">New Status:</span>
                  <span className="font-semibold text-green-900">
                    {willBePaid ? 'PAID ✓' : 'PARTIAL'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method *
            </label>
            <select
              name="payment_method"
              value={formData.payment_method}
              onChange={handleInputChange}
              className="input"
              required
            >
              {paymentMethods.map(method => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Date *
            </label>
            <input
              type="date"
              name="payment_date"
              value={formData.payment_date}
              onChange={handleInputChange}
              className="input"
              max={new Date().toISOString().split('T')[0]}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Cannot be a future date
            </p>
          </div>

          {/* Reference Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              name="reference_number"
              value={formData.reference_number}
              onChange={handleInputChange}
              className="input"
              placeholder="Check number, transaction ID, etc."
              maxLength={100}
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional - Check number, confirmation code, etc.
            </p>
          </div>

          {/* Transaction Details (for online payments) */}
          {['Credit Card', 'PayPal', 'Stripe'].includes(formData.payment_method) && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transaction ID
                </label>
                <input
                  type="text"
                  name="transaction_id"
                  value={formData.transaction_id}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="Transaction ID from payment processor"
                  maxLength={255}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Processor
                </label>
                <input
                  type="text"
                  name="processor"
                  value={formData.processor}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="e.g., Stripe, PayPal, Square"
                  maxLength={50}
                />
              </div>
            </>
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
              rows="3"
              className="input"
              placeholder="Additional notes about this payment (optional)"
            />
          </div>

          {/* Important Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-900 mb-2">Important:</h4>
            <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
              <li>This will permanently record the payment</li>
              <li>Invoice status will be automatically updated</li>
              <li>Payment cannot be edited after creation</li>
              <li>To reverse, you'll need to record a refund separately</li>
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
              {loading ? 'Recording Payment...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RecordPaymentModal;