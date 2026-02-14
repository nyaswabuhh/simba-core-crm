import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Filter,
  FileText,
  Download,
  Calendar,
  DollarSign,
  Building2,
  Eye,
  AlertCircle,
  X,
  RefreshCw,
  Users
} from 'lucide-react';

// Date period presets
const DATE_PERIODS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' }
];

const DATE_FIELDS = [
  { value: 'created_at', label: 'Created Date' },
  { value: 'issue_date', label: 'Issue Date' },
  { value: 'due_date', label: 'Due Date' }
];

function InvoiceList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [accounts, setAccounts] = useState([]);
  
  // Owner stats
  const [ownerStats, setOwnerStats] = useState([]);
  
  // Date filtering state
  const [datePeriod, setDatePeriod] = useState('');
  const [dateField, setDateField] = useState('issue_date');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    loadInvoices();
    loadAccounts();
    loadOwnerStats();
  }, [statusFilter, accountFilter, ownerFilter, datePeriod, dateField, startDate, endDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, accountFilter, ownerFilter, datePeriod, startDate, endDate]);

  // Handle period change
  useEffect(() => {
    if (datePeriod === 'custom') {
      setShowCustomDates(true);
    } else {
      setShowCustomDates(false);
      setStartDate('');
      setEndDate('');
    }
  }, [datePeriod]);

  const loadOwnerStats = async () => {
    try {
      const params = new URLSearchParams();
      
      // Apply same date filters (but not owner filter, so we see all owners)
      if (datePeriod && datePeriod !== 'custom') {
        params.append('period', datePeriod);
      } else if (datePeriod === 'custom') {
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
      }
      
      const url = `/invoices/reports/analytics${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      if (response.data?.by_owner && response.data.by_owner.length > 0) {
        setOwnerStats(response.data.by_owner);
      }
    } catch (error) {
      console.error('Error loading owner stats:', error);
    }
  };

  // Derive owner options from stats or invoices
  const ownerOptions = useMemo(() => {
    // If we have owner stats, use those
    if (ownerStats.length > 0) {
      return ownerStats;
    }
    
    // Otherwise, extract unique owners from invoices
    const ownerMap = new Map();
    invoices.forEach(invoice => {
      if (invoice.owner_id && invoice.owner_name && !ownerMap.has(invoice.owner_id)) {
        ownerMap.set(invoice.owner_id, {
          owner_id: invoice.owner_id,
          owner_name: invoice.owner_name,
          count: 0,
          total_amount: 0,
          paid_amount: 0
        });
      }
    });
    
    // Count invoices per owner
    invoices.forEach(invoice => {
      if (invoice.owner_id && ownerMap.has(invoice.owner_id)) {
        const owner = ownerMap.get(invoice.owner_id);
        owner.count++;
        owner.total_amount += parseFloat(invoice.total_amount || 0);
        owner.paid_amount += parseFloat(invoice.amount_paid || 0);
      }
    });
    
    return Array.from(ownerMap.values());
  }, [ownerStats, invoices]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      if (accountFilter) {
        params.append('account_id', accountFilter);
      }
      if (ownerFilter) {
        params.append('owner_id', ownerFilter);
      }
      
      // Date filtering
      if (datePeriod && datePeriod !== 'custom') {
        params.append('period', datePeriod);
        params.append('date_field', dateField);
      } else if (datePeriod === 'custom') {
        if (startDate) {
          params.append('start_date', startDate);
        }
        if (endDate) {
          params.append('end_date', endDate);
        }
        params.append('date_field', dateField);
      }

      const response = await apiClient.get(`/invoices?${params.toString()}`);
      // Backend now handles sorting, but we can still sort client-side if needed
      const sortedInvoices = response.data.sort((a, b) => {
        const dateA = new Date(a.issue_date || a.created_at);
        const dateB = new Date(b.issue_date || b.created_at);
        return dateB - dateA;
      });
      setInvoices(sortedInvoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Invalid date range');
      } else {
        toast.error('Failed to load invoices');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await apiClient.get('/accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    }
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account?.name || 'Unknown Account';
  };

  const handleDownloadPDF = async (invoice, e) => {
    e.stopPropagation();
    try {
      const response = await apiClient.get(`/invoices/${invoice.id}/pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setAccountFilter('');
    setOwnerFilter('');
    setDatePeriod('');
    setDateField('issue_date');
    setStartDate('');
    setEndDate('');
    setShowCustomDates(false);
  };

  const hasActiveFilters = searchTerm || statusFilter || accountFilter || ownerFilter || datePeriod || startDate || endDate;

  const getStatusBadgeClass = (status) => {
    const classes = {
      'Draft': 'badge badge-gray',
      'Sent': 'badge badge-info',
      'Unpaid': 'badge badge-warning',
      'Partial': 'badge badge-warning',
      'Paid': 'badge badge-success',
      'Overdue': 'badge badge-danger',
      'Cancelled': 'badge badge-gray',
    };
    return classes[status] || 'badge badge-gray';
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

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'Ksh 0.00';
    return `Ksh ${Number(value).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const isOverdue = (invoice) => {
    if (invoice.status === 'Paid' || invoice.status === 'Cancelled') {
      return false;
    }
    return new Date(invoice.due_date) < new Date();
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      
      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);
      
      if (startPage > 2) {
        pages.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'Draft').length,
    unpaid: invoices.filter(i => i.status === 'Unpaid' || i.status === 'Sent').length,
    overdue: invoices.filter(i => i.status === 'Overdue').length,
    paid: invoices.filter(i => i.status === 'Paid').length,
    totalAmount: invoices.reduce((sum, i) => sum + parseFloat(i.total_amount || 0), 0),
    totalPaid: invoices.reduce((sum, i) => sum + parseFloat(i.amount_paid || 0), 0),
    totalDue: invoices.reduce((sum, i) => sum + parseFloat(i.amount_due || 0), 0),
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600 mt-1">Manage and track customer invoices</p>
        </div>
        <button
          onClick={() => {
            loadInvoices();
            loadOwnerStats();
          }}
          className="btn btn-secondary flex items-center gap-2"
          title="Refresh"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
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
              <p className="text-sm text-gray-600">Amount Paid</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {formatCurrency(stats.totalPaid)}
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
              <p className="text-sm text-gray-600">Amount Due</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {formatCurrency(stats.totalDue)}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="card">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="badge badge-gray">{stats.draft}</span>
            <span className="text-sm text-gray-600">Draft</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="badge badge-warning">{stats.unpaid}</span>
            <span className="text-sm text-gray-600">Unpaid</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="badge badge-danger">{stats.overdue}</span>
            <span className="text-sm text-gray-600">Overdue</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="badge badge-success">{stats.paid}</span>
            <span className="text-sm text-gray-600">Paid</span>
          </div>
        </div>
      </div>

      {/* Owner Summary Cards */}
      {ownerOptions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="mr-2 text-indigo-500" size={20} />
            Invoices by Owner
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ownerOptions.map((owner) => {
              const collectionRate = owner.total_amount > 0 
                ? ((owner.paid_amount / owner.total_amount) * 100).toFixed(1) 
                : 0;
              const isSelected = ownerFilter === owner.owner_id;
              
              return (
                <div
                  key={owner.owner_id}
                  onClick={() => setOwnerFilter(isSelected ? '' : owner.owner_id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 truncate">{owner.owner_name}</h3>
                    {isSelected && (
                      <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xl font-bold text-gray-900">{owner.count}</p>
                      <p className="text-xs text-gray-500">Invoices</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-600">
                        {owner.paid_count || Math.round(owner.count * (collectionRate / 100))}
                      </p>
                      <p className="text-xs text-gray-500">Paid</p>
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${
                        collectionRate >= 80 ? 'text-green-600' : 
                        collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {collectionRate}%
                      </p>
                      <p className="text-xs text-gray-500">Collected</p>
                    </div>
                  </div>
                  {owner.total_amount > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-sm font-semibold text-gray-700">
                          {formatCurrency(owner.total_amount)}
                        </p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(owner.paid_amount)}
                        </p>
                        <p className="text-xs text-gray-500">Collected</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-4">
        {/* Row 1: Search, Status, Account, Owner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search invoices..."
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
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partial">Partial</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Account Filter */}
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="">All Accounts</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Owner Filter */}
          <div className="relative">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="">All Owners</option>
              {ownerOptions.map(owner => (
                <option key={owner.owner_id} value={owner.owner_id}>
                  {owner.owner_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2: Date Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date Period */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={datePeriod}
              onChange={(e) => setDatePeriod(e.target.value)}
              className="input pl-10"
            >
              {DATE_PERIODS.map(period => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date Field */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={dateField}
              onChange={(e) => setDateField(e.target.value)}
              className="input pl-10"
              disabled={!datePeriod}
            >
              {DATE_FIELDS.map(field => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="btn btn-secondary flex items-center justify-center gap-2"
            >
              <X size={16} />
              Clear Filters
            </button>
          )}
        </div>

        {/* Row 3: Custom Date Range (conditional) */}
        {showCustomDates && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input"
                max={endDate || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input"
                min={startDate || undefined}
              />
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
            <span className="text-sm text-gray-500">Active filters:</span>
            {searchTerm && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: "{searchTerm}"
                <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-blue-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {statusFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('')} className="ml-1 hover:text-purple-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {accountFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Account: {getAccountName(accountFilter)}
                <button onClick={() => setAccountFilter('')} className="ml-1 hover:text-green-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {ownerFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Owner: {ownerOptions.find(o => o.owner_id === ownerFilter)?.owner_name || ownerFilter}
                <button onClick={() => setOwnerFilter('')} className="ml-1 hover:text-indigo-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {datePeriod && datePeriod !== 'custom' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Period: {DATE_PERIODS.find(p => p.value === datePeriod)?.label}
                <button onClick={() => setDatePeriod('')} className="ml-1 hover:text-orange-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {datePeriod === 'custom' && (startDate || endDate) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Date: {startDate || '...'} to {endDate || '...'}
                <button onClick={() => { setDatePeriod(''); setStartDate(''); setEndDate(''); }} className="ml-1 hover:text-orange-600">
                  <X size={12} />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedInvoices.length > 0 ? (
                paginatedInvoices.map((invoice) => (
                  <tr 
                    key={invoice.id}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="text-gray-400 mr-2" size={16} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {invoice.invoice_number}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(invoice.issue_date)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/accounts/${invoice.account_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Building2 size={14} className="mr-1" />
                        {getAccountName(invoice.account_id)}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span className={getStatusBadgeClass(invoice.status)}>
                          {invoice.status}
                        </span>
                        {isOverdue(invoice) && invoice.status !== 'Overdue' && (
                          <span className="text-xs text-red-600 flex items-center">
                            <AlertCircle size={12} className="mr-1" />
                            Past Due
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {invoice.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${isOverdue(invoice) ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                        {formatDate(invoice.due_date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(invoice.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                      {formatCurrency(invoice.amount_paid)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={invoice.amount_due > 0 ? 'text-red-600' : 'text-gray-400'}>
                        {formatCurrency(invoice.amount_due)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/invoices/${invoice.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={(e) => handleDownloadPDF(invoice, e)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center">
                    <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-500 text-lg">No invoices found</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {hasActiveFilters
                        ? 'Try adjusting your filters'
                        : 'Invoices will be created from approved quotes'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Clear all filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredInvoices.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Info */}
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, filteredInvoices.length)}</span> of{' '}
                <span className="font-medium">{filteredInvoices.length}</span> invoices
                {filteredInvoices.length !== invoices.length && (
                  <span className="text-gray-500"> (filtered from {invoices.length} total)</span>
                )}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center space-x-2">
                  {/* Previous Button */}
                  <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Previous
                  </button>

                  {/* Page Numbers */}
                  <div className="hidden sm:flex items-center space-x-1">
                    {getPageNumbers().map((page, index) => (
                      page === '...' ? (
                        <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                          ...
                        </span>
                      ) : (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    ))}
                  </div>

                  {/* Mobile Page Indicator */}
                  <div className="sm:hidden px-3 py-2 text-sm font-medium text-gray-700">
                    Page {currentPage} of {totalPages}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Items Per Page Info */}
            <div className="mt-3 sm:mt-0 text-xs text-gray-500 text-center sm:text-left">
              Showing {itemsPerPage} items per page
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default InvoiceList;