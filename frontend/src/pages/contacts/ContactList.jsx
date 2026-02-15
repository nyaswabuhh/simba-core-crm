import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Search, 
  Filter,
  Users,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Eye,
  Edit,
  Star,
  StarOff,
  ChevronLeft,
  ChevronRight,
  Calendar,
  X,
  RefreshCw
} from 'lucide-react';
import ContactCreateModal from '../../components/modals/ContactCreateModal';
import ContactEditModal from '../../components/modals/ContactEditModal';

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
  { value: 'updated_at', label: 'Updated Date' }
];

function ContactsList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [primaryFilter, setPrimaryFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  
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
    loadContacts();
    loadAccounts();
    loadOwnerStats();
  }, [accountFilter, ownerFilter, datePeriod, dateField, startDate, endDate]);

  useEffect(() => {
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [searchTerm, accountFilter, primaryFilter, ownerFilter, datePeriod, startDate, endDate]);

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
      
      if (accountFilter) {
        params.append('account_id', accountFilter);
      }
      
      const url = `/contacts/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get(url);
      
      if (response.data?.by_owner && response.data.by_owner.length > 0) {
        setOwnerStats(response.data.by_owner);
      }
    } catch (error) {
      console.error('Error loading owner stats:', error);
    }
  };

  // Derive owner options from stats or contacts
  const ownerOptions = useMemo(() => {
    // If we have owner stats, use those
    if (ownerStats.length > 0) {
      return ownerStats;
    }
    
    // Otherwise, extract unique owners from contacts
    const ownerMap = new Map();
    contacts.forEach(contact => {
      if (contact.owner_id && contact.owner_name && !ownerMap.has(contact.owner_id)) {
        ownerMap.set(contact.owner_id, {
          owner_id: contact.owner_id,
          owner_name: contact.owner_name,
          count: 0,
          primary_count: 0
        });
      }
    });
    
    // Count contacts per owner
    contacts.forEach(contact => {
      if (contact.owner_id && ownerMap.has(contact.owner_id)) {
        const owner = ownerMap.get(contact.owner_id);
        owner.count++;
        if (contact.is_primary) {
          owner.primary_count++;
        }
      }
    });
    
    return Array.from(ownerMap.values());
  }, [ownerStats, contacts]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
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
        if (startDate || endDate) {
          params.append('date_field', dateField);
        }
      }

      const response = await apiClient.get(`/contacts?${params.toString()}`);
      // Sort by created_at (latest first)
      const sortedContacts = response.data.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setContacts(sortedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Invalid filter parameters');
      } else {
        toast.error('Failed to load contacts');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await apiClient.get('/accounts');
      // Create account lookup map for easy access
      const accountMap = {};
      response.data.forEach(account => {
        accountMap[account.id] = account;
      });
      setAccounts(accountMap);
    } catch (error) {
      console.error('Error loading accounts:', error);
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

  const handleCreateSuccess = (newContact) => {
    setShowCreateModal(false);
    loadContacts();
    loadOwnerStats();
    toast.success('Contact created successfully');
    navigate(`/contacts/${newContact.id}`);
  };

  const handleEditClick = (contact, e) => {
    e.stopPropagation();
    setSelectedContact(contact);
    setShowEditModal(true);
  };

  const handleEditSuccess = (updatedContact) => {
    setShowEditModal(false);
    setSelectedContact(null);
    loadContacts();
    loadOwnerStats();
    toast.success('Contact updated successfully');
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setAccountFilter('');
    setPrimaryFilter('');
    setOwnerFilter('');
    setDatePeriod('');
    setDateField('created_at');
    setStartDate('');
    setEndDate('');
    setShowCustomDates(false);
  };

  const hasActiveFilters = searchTerm || accountFilter || primaryFilter || ownerFilter || datePeriod || startDate || endDate;

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.department?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (contact.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPrimary = 
      primaryFilter === '' || 
      (primaryFilter === 'primary' && contact.is_primary) ||
      (primaryFilter === 'not_primary' && !contact.is_primary);
    
    return matchesSearch && matchesPrimary;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

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

  const stats = {
    total: contacts.length,
    primary: contacts.filter(c => c.is_primary).length,
    withPhone: contacts.filter(c => c.phone || c.mobile).length,
    withEmail: contacts.filter(c => c.email).length,
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
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-1">Manage your business contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadContacts();
              loadOwnerStats();
            }}
            className="btn btn-secondary flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary flex items-center"
          >
            <Plus size={18} className="mr-2" />
            New Contact
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Primary Contacts</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.primary}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Star className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Phone</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.withPhone}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Phone className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">With Email</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.withEmail}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Mail className="text-purple-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Owner Summary Cards */}
      {ownerOptions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="mr-2 text-indigo-500" size={20} />
            Contacts by Owner
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ownerOptions.map((owner) => {
              const primaryRate = owner.count > 0 
                ? ((owner.primary_count / owner.count) * 100).toFixed(1) 
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
                      <p className="text-xs text-gray-500">Contacts</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-yellow-600">{owner.primary_count || 0}</p>
                      <p className="text-xs text-gray-500">Primary</p>
                    </div>
                    <div>
                      <p className={`text-xl font-bold ${
                        primaryRate >= 30 ? 'text-green-600' : 
                        primaryRate >= 15 ? 'text-yellow-600' : 'text-gray-600'
                      }`}>
                        {primaryRate}%
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
        {/* Row 1: Search, Account, Primary, Owner */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
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
              {Object.values(accounts).map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Filter */}
          <div className="relative">
            <Star className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <select
              value={primaryFilter}
              onChange={(e) => setPrimaryFilter(e.target.value)}
              className="input pl-10"
            >
              <option value="">All Contacts</option>
              <option value="primary">Primary Contacts</option>
              <option value="not_primary">Non-Primary Contacts</option>
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
            {accountFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Account: {accounts[accountFilter]?.name || accountFilter}
                <button onClick={() => setAccountFilter('')} className="ml-1 hover:text-green-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {primaryFilter && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                {primaryFilter === 'primary' ? 'Primary Only' : 'Non-Primary Only'}
                <button onClick={() => setPrimaryFilter('')} className="ml-1 hover:text-yellow-600">
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

      {/* Contacts Table */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedContacts.length > 0 ? (
                paginatedContacts.map((contact) => (
                  <tr 
                    key={contact.id}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {contact.first_name} {contact.last_name}
                            {contact.is_primary && (
                              <Star className="ml-2 text-yellow-500" size={14} fill="currentColor" />
                            )}
                          </div>
                          {contact.department && (
                            <div className="text-xs text-gray-500">{contact.department}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {accounts[contact.account_id] ? (
                        <Link
                          to={`/accounts/${contact.account_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          <Building2 size={14} className="mr-1" />
                          {accounts[contact.account_id].name}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        {contact.job_title ? (
                          <>
                            <Briefcase size={14} className="mr-1 text-gray-400" />
                            {contact.job_title}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`mailto:${contact.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-gray-900 hover:text-blue-600 flex items-center"
                      >
                        <Mail size={14} className="mr-1 text-gray-400" />
                        {contact.email}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {contact.owner_name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.is_primary ? (
                        <span className="badge badge-warning flex items-center w-fit">
                          <Star size={12} className="mr-1" />
                          Primary
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">Contact</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(contact.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/contacts/${contact.id}`);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={(e) => handleEditClick(contact, e)}
                          className="text-gray-600 hover:text-gray-800"
                          title="Edit Contact"
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <Users className="mx-auto text-gray-400 mb-4" size={48} />
                    <p className="text-gray-500 text-lg">No contacts found</p>
                    <p className="text-gray-400 text-sm mt-2">
                      {hasActiveFilters
                        ? 'Try adjusting your filters'
                        : 'Get started by creating your first contact'}
                    </p>
                    {hasActiveFilters && (
                      <button
                        onClick={clearAllFilters}
                        className="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Clear all filters
                      </button>
                    )}
                    {!hasActiveFilters && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="inline-flex items-center mt-4 btn btn-primary"
                      >
                        <Plus size={18} className="mr-2" />
                        New Contact
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Results info */}
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                <span className="font-medium">{Math.min(endIndex, filteredContacts.length)}</span> of{' '}
                <span className="font-medium">{filteredContacts.length}</span> contacts
                {contacts.length !== filteredContacts.length && (
                  <span className="text-gray-500"> (filtered from {contacts.length} total)</span>
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

      {/* Create Contact Modal */}
      {showCreateModal && (
        <ContactCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* Edit Contact Modal */}
      {showEditModal && selectedContact && (
        <ContactEditModal
          contact={selectedContact}
          onClose={() => {
            setShowEditModal(false);
            setSelectedContact(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default ContactsList;