import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Search, 
  Filter,
  CreditCard,
  Download,
  Calendar,
  DollarSign,
  FileText,
  Building2,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

function PaymentsList() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/payments');
      // Sort by payment_date (latest first), then by created_at if dates are same
      const sortedPayments = response.data.sort((a, b) => {
        const dateA = new Date(a.payment_date || a.created_at);
        const dateB = new Date(b.payment_date || b.created_at);
        return dateB - dateA; // Descending order (latest first)
      });
      setPayments(sortedPayments);
    } catch (error) {
      console.error('Error loading payments:', error);
      if (error.response?.status === 403) {
        toast.error('You do not have permission to view payments');
      } else {
        toast.error('Failed to load payments');
      }
    } finally {
      setLoading(false);
    }
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

  const getMethodIcon = (method) => {
    switch (method) {
      case 'Credit Card':
        return <CreditCard size={16} className="text-blue-600" />;
      case 'Cash':
        return <DollarSign size={16} className="text-green-600" />;
      default:
        return <CreditCard size={16} className="text-gray-600" />;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
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
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '$0.00';
    return `$${parseFloat(value).toFixed(2)}`;
  };

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = 
      payment.payment_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = !statusFilter || payment.status === statusFilter;
    const matchesMethod = !methodFilter || payment.payment_method === methodFilter;
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  const stats = {
    total: payments.length,
    totalAmount: payments
      .filter(p => p.status === 'Completed')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    completed: payments.filter(p => p.status === 'Completed').length,
    pending: payments.filter(p => p.status === 'Pending').length,
    refunded: payments.filter(p => p.status === 'Refunded').length,
    refundedAmount: payments
      .filter(p => p.status === 'Refunded')
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
  };

  const paymentMethods = [...new Set(payments.map(p => p.payment_method))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-1">Track and manage all payment transactions</p>
        </div>
        <button
          onClick={loadPayments}
          className="btn btn-secondary flex items-center"
        >
          <RefreshCw size={18} className="mr-2" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CreditCard className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Received</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(stats.totalAmount)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.completed}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Refunded</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(stats.refundedAmount)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <RefreshCw className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="card">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="badge badge-success">{stats.completed}</span>
            <span className="text-sm text-gray-600">Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="badge badge-warning">{stats.pending}</span>
            <span className="text-sm text-gray-600">Pending</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="badge badge-gray">{stats.refunded}</span>
            <span className="text-sm text-gray-600">Refunded</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search payments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="">All Methods</option>
              {paymentMethods.map(method => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Processed By
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr 
                    key={payment.id}
                    className="hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <CreditCard className="text-gray-400 mr-2" size={16} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.payment_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDateTime(payment.created_at)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.invoice ? (
                        <Link 
                          to={`/invoices/${payment.invoice_id}`}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <FileText size={14} className="mr-1" />
                          {payment.invoice.invoice_number || payment.invoice_id.substring(0, 8) + '...'}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-500">
                          {payment.invoice_id.substring(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getMethodIcon(payment.payment_method)}
                        <span className="text-sm text-gray-900">
                          {payment.payment_method}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(payment.payment_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-right">
                      <span className={payment.status === 'Refunded' ? 'text-red-600' : 'text-green-600'}>
                        {payment.status === 'Refunded' && '-'}
                        {formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadgeClass(payment.status)}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {payment.reference_number || '-'}
                      </div>
                      {payment.transaction_id && (
                        <div className="text-xs text-gray-500 truncate max-w-xs">
                          TXN: {payment.transaction_id}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {payment.processor_user ? (
                        <div className="flex items-center">
                          <User size={14} className="text-gray-400 mr-1" />
                          <span className="text-sm text-gray-900">
                            {payment.processor_user.first_name} {payment.processor_user.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <CreditCard className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-500 text-lg">No payments found</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {searchTerm || statusFilter || methodFilter
                        ? 'Try adjusting your filters'
                        : 'Payments will appear here when recorded'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination/Summary */}
        {filteredPayments.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{filteredPayments.length}</span> of{' '}
                <span className="font-medium">{payments.length}</span> payments
              </div>
              <div className="text-sm text-gray-700">
                Total: <span className="font-medium text-green-600">
                  {formatCurrency(filteredPayments
                    .filter(p => p.status === 'Completed')
                    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payment Methods Breakdown */}
      {payments.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {paymentMethods.map(method => {
              const methodPayments = payments.filter(p => p.payment_method === method && p.status === 'Completed');
              const methodTotal = methodPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
              
              return (
                <div key={method} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    {getMethodIcon(method)}
                    <span className="text-sm font-medium text-gray-900">{method}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    {methodPayments.length} payment{methodPayments.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatCurrency(methodTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentsList;