import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Building2, 
  Users, 
  DollarSign, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Filter,
  X,
  RefreshCw
} from 'lucide-react';
import CreateAccountModal from '../../components/modals/CreateAccountModal';

// Date period presets - matches backend get_date_range_for_period()
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
  { value: 'updated_at', label: 'Updated Date' }
];

const INDUSTRIES = [
  { value: '', label: 'All Industries' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail', label: 'Retail' },
  { value: 'Education', label: 'Education' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Other', label: 'Other' }
];

function AccountList() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  
  // Owner stats
  const [ownerStats, setOwnerStats] = useState([]);
  
  // Date filtering state
  const [datePeriod, setDatePeriod] = useState('');
  const [dateField, setDateField] = useState('created_at');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    loadAccounts();
    loadOwnerStats();
  }, [industryFilter, ownerFilter, datePeriod, dateField, startDate, endDate]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, industryFilter, ownerFilter, datePeriod, startDate, endDate]);

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
      
      const url = `/accounts/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      if (response.data?.by_owner && response.data.by_owner.length > 0) {
        setOwnerStats(response.data.by_owner);
      }
    } catch (error) {
      console.error('Error loading owner stats:', error);
    }
  };

  // Derive owner options from stats or accounts
  const ownerOptions = useMemo(() => {
    // If we have owner stats, use those
    if (ownerStats.length > 0) {
      return ownerStats;
    }
    
    // Otherwise, extract unique owners from accounts
    const ownerMap = new Map();
    accounts.forEach(account => {
      if (account.owner_id && account.owner_name && !ownerMap.has(account.owner_id)) {
        ownerMap.set(account.owner_id, {
          owner_id: account.owner_id,
          owner_name: account.owner_name,
          count: 0
        });
      }
    });
    
    // Count accounts per owner
    accounts.forEach(account => {
      if (account.owner_id && ownerMap.has(account.owner_id)) {
        const owner = ownerMap.get(account.owner_id);
        owner.count++;
      }
    });
    
    return Array.from(ownerMap.values());
  }, [ownerStats, accounts]);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (industryFilter) {
        params.append('industry', industryFilter);
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
        if (startDate || endDate) {
          params.append('date_field', dateField);
        }
      }
      
      const url = `/accounts${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      // Sort accounts by created_at descending (most recent first)
      const sortedAccounts = response.data.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setAccounts(sortedAccounts);
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Invalid filter parameters');
      } else {
        toast.error('Failed to load accounts');
      }
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setIndustryFilter('');
    setOwnerFilter('');
    setDatePeriod('');
    setDateField('created_at');
    setStartDate('');
    setEndDate('');
    setShowCustomDates(false);
  };

  const hasActiveFilters = searchTerm || industryFilter || ownerFilter || datePeriod || startDate || endDate;

  const filteredAccounts = accounts.filter(account => {
    const searchLower = searchTerm.toLowerCase();
    return (
      account.name?.toLowerCase().includes(searchLower) ||
      account.industry?.toLowerCase().includes(searchLower) ||
      account.phone?.toLowerCase().includes(searchLower) ||
      account.description?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAccounts = filteredAccounts.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Calculate stats
  const stats = {
    total: filteredAccounts.length,
    contacts: accounts.reduce((sum, acc) => sum + (acc.contacts?.length || acc.contacts_count || 0), 0),
    opportunities: accounts.reduce((sum, acc) => sum + (acc.opportunities?.length || acc.opportunities_count || 0), 0)
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-600 mt-1">Manage your customer accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadAccounts();
              loadOwnerStats();
            }}
            className="btn btn-secondary flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center justify-center"
          >
            <Plus size={20} className="mr-2" />
            Create Account
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Building2 className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Accounts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.contacts}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{stats.opportunities}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Summary Cards */}
      {ownerOptions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="mr-2 text-indigo-500" size={20} />
            Accounts by Owner
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ownerOptions.map((owner) => {
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
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 truncate">{owner.owner_name}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        <span className="text-xl font-bold text-gray-900">{owner.count}</span> accounts
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-4">
        {/* Row 1: Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="relative md:w-48">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="input pl-10"
            >
              {INDUSTRIES.map(industry => (
                <option key={industry.value} value={industry.value}>
                  {industry.label}
                </option>
              ))}
            </select>
          </div>
          <div className="relative md:w-48">
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
            {industryFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Industry: {industryFilter}
                <button onClick={() => setIndustryFilter('')} className="ml-1 hover:text-purple-600">
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

      {/* Accounts Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Industry
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedAccounts.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium">No accounts found</p>
                      <p className="text-sm mt-1">
                        {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first account to get started'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/accounts/${account.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition flex items-center"
                      >
                        <Building2 size={16} className="mr-2 text-gray-400" />
                        {account.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.industry || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {account.phone || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {account.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(account.annual_revenue || account.revenue)
                        ? `Ksh ${parseFloat(account.annual_revenue || account.revenue).toLocaleString()}`
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(account.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Results info */}
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, filteredAccounts.length)}</span> of{' '}
                <span className="font-medium">{filteredAccounts.length}</span> accounts
                {accounts.length !== filteredAccounts.length && (
                  <span className="text-gray-500"> (filtered from {accounts.length} total)</span>
                )}
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-2">
                {/* Previous button */}
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Desktop: Page numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {getPageNumbers().map((page, index) => (
                    <button
                      key={index}
                      onClick={() => typeof page === 'number' && goToPage(page)}
                      disabled={page === '...'}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : page === '...'
                          ? 'bg-white text-gray-400 cursor-default'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                {/* Mobile: Page indicator */}
                <div className="sm:hidden text-sm text-gray-700 px-3 py-2">
                  Page {currentPage} of {totalPages}
                </div>

                {/* Next button */}
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }`}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateAccountModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadAccounts();
            loadOwnerStats();
          }}
        />
      )}
    </div>
  );
}

export default AccountList;