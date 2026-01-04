import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  FileText, 
  Building2, 
  Calendar,
  User,
  Send,
  CheckCircle
} from 'lucide-react';
import EditQuoteModal from '../../components/modals/EditQuoteModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';
import EditQuoteItemsModal from '../../components/modals/EditQuoteItemsModal';
import ConvertToInvoiceModal from '../../components/modals/ConvertToInvoiceModal';

function QuoteDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [account, setAccount] = useState(null);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditItemsModal, setShowEditItemsModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadQuote();
    }
  }, [id]);

  const loadQuote = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/quotes/${id}`);
      setQuote(response.data);
      
      // Load associated account
      if (response.data.account_id) {
        try {
          const accountResponse = await apiClient.get(`/accounts/${response.data.account_id}`);
          setAccount(accountResponse.data);
        } catch (error) {
          console.warn('Could not load account:', error);
        }
      }
      
      // Load associated contact
      if (response.data.contact_id) {
        try {
          const contactResponse = await apiClient.get(`/contacts/${response.data.contact_id}`);
          setContact(contactResponse.data);
        } catch (error) {
          console.warn('Could not load contact:', error);
        }
      }
    } catch (error) {
      toast.error('Failed to load quote details');
      console.error('Error loading quote:', error);
      // Optionally navigate back if quote not found
      if (error.response?.status === 404) {
        setTimeout(() => navigate('/quotes'), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/quotes/${id}`);
      toast.success('Quote deleted successfully');
      navigate('/quotes');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete quote');
      console.error('Error deleting quote:', error);
    }
  };

  const handleSendQuote = async () => {
    try {
      setActionLoading(true);
      await apiClient.post(`/quotes/${id}/send`);
      toast.success('Quote sent successfully');
      await loadQuote(); // Reload to get updated status
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send quote');
      console.error('Error sending quote:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveQuote = async () => {
    try {
      setActionLoading(true);
      await apiClient.post(`/quotes/${id}/approve`);
      toast.success('Quote approved successfully');
      await loadQuote(); // Reload to get updated status
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve quote');
      console.error('Error approving quote:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setActionLoading(true);
      const response = await apiClient.get(`/quotes/${id}/pdf`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${quote.quote_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url); // Clean up
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download PDF');
      console.error('Error downloading PDF:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConvertToInvoice = () => {
    if (!quote) {
      toast.error('Quote data not available');
      return;
    }
    
    // Show conversion modal
    setShowConvertModal(true);
  };

  const handleConvertSuccess = (invoiceId) => {
    setShowConvertModal(false);
    toast.success('Invoice created successfully');
    navigate(`/invoices/${invoiceId}`);
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Draft': 'badge badge-gray',
      'Sent': 'badge badge-info',
      'Approved': 'badge badge-success',
      'Rejected': 'badge badge-danger',
      'Expired': 'badge badge-warning',
      'Converted': 'badge badge-success',
    };
    return classes[status] || 'badge badge-gray';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return '-';
    }
  };


  const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'Ksh 0.00';

  return `Ksh ${Number(value).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};


  const canEdit = quote?.status === 'Draft';
  const canSend = quote?.status === 'Draft';
  const canApprove = quote?.status === 'Sent';
  const canConvert = quote?.status === 'Approved';
  const canDelete = quote?.status === 'Draft' || quote?.status === 'Sent';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Quote not found</p>
        <Link to="/quotes" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Quotes
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
            to="/quotes"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quote.quote_number}</h1>
            {account && (
              <Link 
                to={`/accounts/${quote.account_id}`}
                className="text-gray-600 hover:text-blue-600 mt-1 flex items-center"
              >
                <Building2 size={16} className="mr-1" />
                {account.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-wrap">
          {canEdit && (
            <>
              <button
                onClick={() => setShowEditModal(true)}
                className="btn btn-secondary flex items-center"
                disabled={actionLoading}
              >
                <Edit size={18} className="mr-2" />
                Edit
              </button>
              <button
                onClick={() => setShowEditItemsModal(true)}
                className="btn btn-secondary flex items-center"
                disabled={actionLoading}
              >
                <Edit size={18} className="mr-2" />
                Edit Items
              </button>
            </>
          )}
          <button
            onClick={handleDownloadPDF}
            disabled={actionLoading}
            className="btn btn-secondary flex items-center"
          >
            <FileText size={18} className="mr-2" />
            {actionLoading ? 'Downloading...' : 'Download PDF'}
          </button>
          {canSend && (
            <button 
              onClick={handleSendQuote}
              disabled={actionLoading}
              className="btn btn-primary flex items-center"
            >
              <Send size={18} className="mr-2" />
              {actionLoading ? 'Sending...' : 'Send Quote'}
            </button>
          )}
          {canApprove && (
            <button 
              onClick={handleApproveQuote}
              disabled={actionLoading}
              className="btn btn-primary bg-green-600 hover:bg-green-700 flex items-center"
            >
              <CheckCircle size={18} className="mr-2" />
              {actionLoading ? 'Approving...' : 'Approve Quote'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-danger flex items-center"
              disabled={actionLoading}
            >
              <Trash2 size={18} className="mr-2" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center space-x-3">
        <span className={getStatusBadgeClass(quote.status)}>
          {quote.status}
        </span>
        {quote.approved_date && (
          <span className="text-sm text-gray-600">
            Approved on {formatDate(quote.approved_date)}
          </span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Quote Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quote Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Building2 className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Account</p>
                  <Link
                    to={`/accounts/${quote.account_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {account?.name || 'Loading...'}
                  </Link>
                </div>
              </div>

              {contact && (
                <div className="flex items-start space-x-3">
                  <User className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Contact</p>
                    <Link
                      to={`/contacts/${quote.contact_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Valid Until</p>
                  <p className="text-gray-900">{formatDate(quote.valid_until)}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-gray-900">{formatDate(quote.created_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quote Items */}
          <div className="card p-0">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Quote Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {quote.items && quote.items.length > 0 ? (
                    quote.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.product?.name || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {item.description || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {item.discount_percentage || 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                        No items added yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">{formatCurrency(quote.subtotal)}</span>
                  </div>
                  {quote.discount_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Discount 
                        {quote.discount_type === 'percentage' && quote.discount_value 
                          ? ` (${quote.discount_value}%)` 
                          : ''}:
                      </span>
                      <span className="text-red-600">-{formatCurrency(quote.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax ({quote.tax_rate || 0}%):</span>
                    <span className="text-gray-900">{formatCurrency(quote.tax_amount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-green-600">{formatCurrency(quote.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(quote.notes || quote.terms_conditions) && (
            <div className="card">
              {quote.notes && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
                </div>
              )}
              {quote.terms_conditions && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Terms & Conditions</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{quote.terms_conditions}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Actions & Info */}
        <div className="space-y-6">
          {/* Quick Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-gray-900 font-medium mt-1">{quote.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {formatCurrency(quote.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Valid Until</p>
                <p className="text-gray-900 mt-1">{formatDate(quote.valid_until)}</p>
              </div>
            </div>
          </div>

          {/* Convert to Invoice Action */}
          {canConvert && (
            <div className="card bg-green-50 border-green-200">
              <h3 className="text-sm font-semibold text-green-900 mb-2">Convert to Invoice</h3>
              <p className="text-sm text-green-800 mb-3">
                This quote has been approved and can be converted to an invoice.
              </p>
              <button 
                onClick={handleConvertToInvoice}
                className="btn btn-primary w-full bg-green-600 hover:bg-green-700"
              >
                Create Invoice
              </button>
            </div>
          )}

          {/* Quote Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Quote ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1 break-all">{quote.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Quote Number</p>
                <p className="text-gray-900 mt-1">{quote.quote_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">{formatDate(quote.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900 mt-1">{formatDate(quote.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditQuoteModal
          quote={quote}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadQuote();
          }}
        />
      )}

      {/* Edit Items Modal */}
      {showEditItemsModal && (
        <EditQuoteItemsModal
          quote={quote}
          onClose={() => setShowEditItemsModal(false)}
          onSuccess={() => {
            setShowEditItemsModal(false);
            loadQuote();
          }}
        />
      )}

      {/* Convert to Invoice Modal */}
      {showConvertModal && (
        <ConvertToInvoiceModal
          quote={quote}
          onClose={() => setShowConvertModal(false)}
          onSuccess={handleConvertSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Quote"
          message={`Are you sure you want to delete quote ${quote.quote_number}? This action cannot be undone.`}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default QuoteDetails;