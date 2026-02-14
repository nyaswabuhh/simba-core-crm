import { useState } from 'react';
import { X, AlertTriangle, FileText, DollarSign } from 'lucide-react';

function DeleteInvoiceModal({ invoice, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);

  const isPaid = invoice?.status === 'Paid';
  const hasPayments = invoice?.amount_paid > 0;
  const canDelete = !isPaid && !hasPayments;

  const handleConfirm = async () => {
    if (!canDelete) return;
    
    try {
      setLoading(true);
      await onConfirm();
    } catch (error) {
      console.error('Error during delete:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-md p-6 my-8 text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-start space-x-4">
            <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${
              canDelete ? 'bg-red-100' : 'bg-amber-100'
            }`}>
              {canDelete ? (
                <AlertTriangle className="text-red-600" size={24} />
              ) : (
                <FileText className="text-amber-600" size={24} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Invoice
                </h3>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={20} />
                </button>
              </div>
              
              {canDelete ? (
                <p className="mt-2 text-sm text-gray-600">
                  Are you sure you want to delete invoice <span className="font-semibold">{invoice?.invoice_number}</span>? This action cannot be undone.
                </p>
              ) : (
                <p className="mt-2 text-sm text-gray-600">
                  This invoice cannot be deleted.
                </p>
              )}
            </div>
          </div>

          {/* Invoice Info */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Invoice Number:</span>
              <span className="font-medium text-gray-900">{invoice?.invoice_number}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Amount:</span>
              <span className="font-medium text-gray-900">
                ${invoice?.total_amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm mt-1">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                invoice?.status === 'Paid' ? 'text-green-600' :
                invoice?.status === 'Overdue' ? 'text-red-600' :
                invoice?.status === 'Partially Paid' ? 'text-amber-600' :
                'text-gray-900'
              }`}>
                {invoice?.status}
              </span>
            </div>
            {hasPayments && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium text-green-600">
                  ${invoice?.amount_paid?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Warnings */}
          {!canDelete && (
            <div className="mt-4 space-y-2">
              {isPaid && (
                <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <DollarSign className="text-red-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-red-700">
                    <span className="font-medium">Cannot delete paid invoices.</span> This invoice has been fully paid and must be kept for accounting records.
                  </p>
                </div>
              )}
              {hasPayments && !isPaid && (
                <div className="flex items-start space-x-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <DollarSign className="text-amber-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-amber-700">
                    <span className="font-medium">This invoice has payments.</span> You must cancel or remove all payments before deleting this invoice.
                  </p>
                </div>
              )}
            </div>
          )}

          {canDelete && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                <span className="font-medium">Warning:</span> Deleting this invoice will remove it from all reports and records. Consider cancelling the invoice instead if you need to keep a record.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              {canDelete ? 'Cancel' : 'Close'}
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={handleConfirm}
                className="btn btn-danger"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </span>
                ) : (
                  'Delete Invoice'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DeleteInvoiceModal;