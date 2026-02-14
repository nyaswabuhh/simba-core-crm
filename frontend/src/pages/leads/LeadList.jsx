import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Filter, 
  X, 
  RefreshCw,
  Users
} from 'lucide-react';
import CreateLeadModal from '../../components/modals/CreateLeadModal';

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
  { value: 'converted_date', label: 'Converted Date' }
];

const LEAD_SOURCES = [
  { value: '', label: 'All Sources' },
  { value: 'Website', label: 'Website' },
  { value: 'Referral', label: 'Referral' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Cold Call', label: 'Cold Call' },
  { value: 'Trade Show', label: 'Trade Show' },
  { value: 'Advertisement', label: 'Advertisement' },
  { value: 'Other', label: 'Other' }
];

function LeadList() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  
  // Owners list for filter dropdown and summary
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
    loadLeads();
    loadOwnerStats();
  }, [statusFilter, sourceFilter, ownerFilter, datePeriod, dateField, startDate, endDate]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sourceFilter, ownerFilter, datePeriod, startDate, endDate]);

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
      
      // Apply same date filters as leads (but not owner filter, so we see all owners)
      if (datePeriod && datePeriod !== 'custom') {
        params.append('period', datePeriod);
      } else if (datePeriod === 'custom') {
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
      }
      
      const url = `/leads/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      if (response.data?.by_owner && response.data.by_owner.length > 0) {
        setOwnerStats(response.data.by_owner);
      }
    } catch (error) {
      console.error('Error loading owner stats:', error);
    }
  };

  // Derive owner options from stats or leads
  const ownerOptions = useMemo(() => {
    // If we have owner stats, use those
    if (ownerStats.length > 0) {
      return ownerStats;
    }
    
    // Otherwise, extract unique owners from leads
    const ownerMap = new Map();
    leads.forEach(lead => {
      if (lead.owner_id && lead.owner_name && !ownerMap.has(lead.owner_id)) {
        ownerMap.set(lead.owner_id, {
          owner_id: lead.owner_id,
          owner_name: lead.owner_name,
          count: 0,
          converted: 0
        });
      }
    });
    
    // Count leads per owner
    leads.forEach(lead => {
      if (lead.owner_id && ownerMap.has(lead.owner_id)) {
        const owner = ownerMap.get(lead.owner_id);
        owner.count++;
        if (lead.status === 'Converted') {
          owner.converted++;
        }
      }
    });
    
    return Array.from(ownerMap.values());
  }, [ownerStats, leads]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }
      
      if (sourceFilter) {
        params.append('source', sourceFilter);
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
      
      const url = `/leads${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      // Sort leads by created_at descending (most recent first)
      const sortedLeads = response.data.sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
      
      setLeads(sortedLeads);
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Invalid filter parameters');
      } else {
        toast.error('Failed to load leads');
      }
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setSourceFilter('');
    setOwnerFilter('');
    setDatePeriod('');
    setDateField('created_at');
    setStartDate('');
    setEndDate('');
    setShowCustomDates(false);
  };

  const hasActiveFilters = searchTerm || statusFilter || sourceFilter || ownerFilter || datePeriod || startDate || endDate;

  const getStatusBadgeClass = (status) => {
    const classes = {
      'New': 'badge badge-info',
      'Contacted': 'badge badge-gray',
      'Qualified': 'badge badge-success',
      'Unqualified': 'badge badge-danger',
      'Converted': 'badge badge-success',
    };
    return classes[status] || 'badge badge-gray';
  };

  const filteredLeads = leads.filter(lead => {
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.first_name?.toLowerCase().includes(searchLower) ||
      lead.last_name?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      (lead.company || '').toLowerCase().includes(searchLower)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

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

  // Calculate stats from current leads
  const stats = {
    total: filteredLeads.length,
    new: leads.filter(l => l.status === 'New').length,
    qualified: leads.filter(l => l.status === 'Qualified').length,
    converted: leads.filter(l => l.status === 'Converted').length,
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
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600 mt-1">Manage and track your sales leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadLeads();
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
            Create Lead
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-100 p-3 rounded-lg">
              <Users className="text-gray-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">New</p>
              <p className="text-2xl font-bold text-blue-600">{stats.new}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <Users className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Qualified</p>
              <p className="text-2xl font-bold text-green-600">{stats.qualified}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Converted</p>
              <p className="text-2xl font-bold text-purple-600">{stats.converted}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Summary Cards */}
      {ownerOptions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="mr-2 text-indigo-500" size={20} />
            Leads by Owner
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ownerOptions.map((owner) => {
              const conversionRate = owner.count > 0 
                ? ((owner.converted / owner.count) * 100).toFixed(1) 
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
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-600">{owner.converted}</p>
                      <p className="text-xs text-gray-500">Converted</p>
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${
                        conversionRate >= 20 ? 'text-green-600' : 
                        conversionRate >= 10 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {conversionRate}%
                      </p>
                      <p className="text-xs text-gray-500">Rate</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-4">
        {/* Row 1: Search and Status */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="relative md:w-48">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="">All Status</option>
              <option value="New">New</option>
              <option value="Contacted">Contacted</option>
              <option value="Qualified">Qualified</option>
              <option value="Unqualified">Unqualified</option>
              <option value="Converted">Converted</option>
            </select>
          </div>
          <div className="relative md:w-48">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="input pl-10"
            >
              {LEAD_SOURCES.map(source => (
                <option key={source.value} value={source.value}>
                  {source.label}
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
            {statusFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter('')} className="ml-1 hover:text-purple-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {sourceFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Source: {sourceFilter}
                <button onClick={() => setSourceFilter('')} className="ml-1 hover:text-green-600">
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

      {/* Leads Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Est. Value
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium">No leads found</p>
                      <p className="text-sm mt-1">
                        {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first lead to get started'}
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
                paginatedLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/leads/${lead.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                      >
                        {lead.first_name} {lead.last_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lead.company || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {lead.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadgeClass(lead.status)}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {lead.source || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {lead.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {lead.estimated_value 
                        ? `Ksh${parseFloat(lead.estimated_value).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                          })}` 
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(lead.created_at)}
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
                <span className="font-medium">{Math.min(endIndex, filteredLeads.length)}</span> of{' '}
                <span className="font-medium">{filteredLeads.length}</span> leads
                {leads.length !== filteredLeads.length && (
                  <span className="text-gray-500"> (filtered from {leads.length} total)</span>
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
        <CreateLeadModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadLeads();
          }}
        />
      )}
    </div>
  );
}

export default LeadList;