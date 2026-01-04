import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  CreditCard, 
  FileText, 
  Calendar,
  User,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Hash,
  Building2,
  Edit,
  Trash2
} from 'lucide-react';
import UpdatePaymentStatusModal from '../../components/modals/UpdatePaymentStatusModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';

function PaymentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateStatusModal, setShowUpdateStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadPayment();
    }
  }, [id]);

  const loadPayment = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/payments/${id}`);
      setPayment(response.data);
      
      // Load invoice details
      if (response.data.invoice_id) {
        try {
          const invoiceResponse = await apiClient.get(`/invoices/${response.data.invoice_id}`);
          setInvoice(invoiceResponse.data);
        } catch (error) {
          console.warn('Could not load invoice:', error);
        }
      }
    } catch (error) {
      console.error('Error loading payment:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view payment details');
        setTimeout(() => navigate('/payments'), 2000);
      } else if (error.response?.status === 404) {
        toast.error('Payment not found');
        setTimeout(() => navigate('/payments'), 2000);
      } else {
        toast.error('Failed to load payment details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/payments/${id}`);
      toast.success('Payment deleted successfully. Invoice has been updated.');
      navigate('/payments');
    } catch (error) {
      console.error('Error deleting payment:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete payment');
    }
  };

  const handleUpdateSuccess = () => {
    setShowUpdateStatusModal(false);
    loadPayment();
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Completed': 'badge badge-success',
      'Pending': 'badge badge-warning',
      'Failed': 'badge badge-danger',
      'Refunded': 'badge badge-gray',
    };
    return classes[status] || 'badge badge-gray';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'Failed':
        return <XCircle className="text-red-600" size={20} />;
      case 'Pending':
        return <AlertCircle className="text-yellow-600" size={20} />;
      case 'Refunded':
        return <AlertCircle className="text-gray-600" size={20} />;
      default:
        return <AlertCircle className="text-gray-600" size={20} />;
    }
  };

  const getMethodIcon = () => {
    if (!payment) return <CreditCard size={20} />;
    
    switch (payment.payment_method) {
      case 'Credit Card':
        return <CreditCard className="text-blue-600" size={20} />;
      case 'Cash':
        return <DollarSign className="text-green-600" size={20} />;
      default:
        return <CreditCard className="text-gray-600" size={20} />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${parseFloat(value).toFixed(2)}`;
  };

  const canUpdateStatus = payment?.status !== 'Completed';
  const canDelete = true; // Finance users can always delete (with caution)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Payment not found</p>
        <Link to="/payments" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Payments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Link
            to="/payments"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{payment.payment_number}</h1>
            {invoice && (
              <Link 
                to={`/invoices/${payment.invoice_id}`}
                className="text-gray-600 hover:text-blue-600 mt-1 flex items-center"
              >
                <FileText size={16} className="mr-1" />
                {invoice.invoice_number}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-wrap">
          {canUpdateStatus && (
            <button
              onClick={() => setShowUpdateStatusModal(true)}
              className="btn btn-secondary flex items-center"
            >
              <Edit size={18} className="mr-2" />
              Update Status
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-danger flex items-center"
            >
              <Trash2 size={18} className="mr-2" />
              Delete Payment
            </button>
          )}
        </div>
      </div>

      {/* Status & Warnings */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon(payment.status)}
          <span className={getStatusBadgeClass(payment.status)}>
            {payment.status}
          </span>
        </div>

        {payment.status === 'Refunded' && (
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-yellow-900">Refunded Payment</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  This payment has been refunded. The amount has been deducted from the invoice's paid total.
                </p>
              </div>
            </div>
          </div>
        )}

        {payment.status === 'Failed' && (
          <div className="card bg-red-50 border-red-200">
            <div className="flex items-start space-x-3">
              <XCircle className="text-red-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-red-900">Failed Payment</h3>
                <p className="text-sm text-red-700 mt-1">
                  This payment failed to process. Please verify the details or contact the customer.
                </p>
              </div>
            </div>
          </div>
        )}

        {payment.status === 'Pending' && (
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-yellow-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-yellow-900">Pending Payment</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  This payment is pending confirmation. Invoice will be updated once completed.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Payment Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payment Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start space-x-3">
                <FileText className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Invoice</p>
                  {invoice ? (
                    <Link
                      to={`/invoices/${payment.invoice_id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {invoice.invoice_number}
                    </Link>
                  ) : (
                    <p className="text-gray-900 mt-1">Loading...</p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                {getMethodIcon()}
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="text-gray-900 font-medium mt-1">{payment.payment_method}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Payment Date</p>
                  <p className="text-gray-900 mt-1">{formatDate(payment.payment_date)}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <DollarSign className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className={`text-2xl font-bold mt-1 ${payment.status === 'Refunded' ? 'text-red-600' : 'text-green-600'}`}>
                    {payment.status === 'Refunded' && '-'}
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
              </div>

              {payment.reference_number && (
                <div className="flex items-start space-x-3">
                  <Hash className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Reference Number</p>
                    <p className="text-gray-900 font-mono mt-1">{payment.reference_number}</p>
                  </div>
                </div>
              )}

              {payment.processor_user && (
                <div className="flex items-start space-x-3">
                  <User className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Processed By</p>
                    <p className="text-gray-900 mt-1">
                      {payment.processor_user.first_name} {payment.processor_user.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{payment.processor_user.email}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transaction Details */}
          {(payment.transaction_id || payment.processor) && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h2>
              <div className="space-y-4">
                {payment.transaction_id && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Transaction ID</p>
                    <p className="text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border border-gray-200 break-all">
                      {payment.transaction_id}
                    </p>
                  </div>
                )}
                {payment.processor && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Payment Processor</p>
                    <p className="text-gray-900">{payment.processor}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {payment.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{payment.notes}</p>
            </div>
          )}

          {/* Related Invoice Details */}
          {invoice && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Related Invoice</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Invoice Number</span>
                  <Link
                    to={`/invoices/${invoice.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {invoice.invoice_number}
                  </Link>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Invoice Status</span>
                  <span className={`badge ${invoice.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                    {invoice.status}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(invoice.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Amount Paid</span>
                  <span className="font-semibold text-green-600">{formatCurrency(invoice.amount_paid)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Amount Due</span>
                  <span className={`font-semibold ${invoice.amount_due > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {formatCurrency(invoice.amount_due)}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/invoices/${invoice.id}`}
                  className="btn btn-secondary w-full flex items-center justify-center"
                >
                  <FileText size={18} className="mr-2" />
                  View Full Invoice
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary & Actions */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Payment Number</p>
                <p className="text-gray-900 font-medium mt-1">{payment.payment_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <div className="mt-1">
                  <span className={getStatusBadgeClass(payment.status)}>
                    {payment.status}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className={`text-3xl font-bold mt-1 ${payment.status === 'Refunded' ? 'text-red-600' : 'text-green-600'}`}>
                  {payment.status === 'Refunded' && '-'}
                  {formatCurrency(payment.amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="text-gray-900 mt-1">{payment.payment_method}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Payment Date</p>
                <p className="text-gray-900 mt-1">{formatDate(payment.payment_date)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">{formatDateTime(payment.created_at)}</p>
              </div>
              {payment.updated_at && (
                <div>
                  <p className="text-sm text-gray-600">Last Updated</p>
                  <p className="text-gray-900 mt-1">{formatDateTime(payment.updated_at)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Payment ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1 break-all">{payment.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoice ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1 break-all">{payment.invoice_id}</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card bg-red-50 border-red-200">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-red-700 mb-3">
              Deleting this payment will reverse it on the invoice and update the invoice status accordingly.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-danger w-full flex items-center justify-center"
            >
              <Trash2 size={18} className="mr-2" />
              Delete Payment
            </button>
          </div>
        </div>
      </div>

      {/* Update Status Modal */}
      {showUpdateStatusModal && (
        <UpdatePaymentStatusModal
          payment={payment}
          onClose={() => setShowUpdateStatusModal(false)}
          onSuccess={handleUpdateSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Payment"
          message={
            <div>
              <p className="mb-2">Are you sure you want to delete payment <strong>{payment.payment_number}</strong>?</p>
              <p className="text-sm text-red-600 mb-2">This action will:</p>
              <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                <li>Permanently delete the payment record</li>
                <li>Deduct {formatCurrency(payment.amount)} from invoice's paid amount</li>
                <li>Update the invoice status accordingly</li>
                <li>Cannot be undone</li>
              </ul>
            </div>
          }
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default PaymentDetails;