import { useState, useEffect } from 'react';
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
  StarOff
} from 'lucide-react';
import ContactCreateModal from '../../components/modals/ContactCreateModal';
import ContactEditModal from '../../components/modals/ContactEditModal';

function ContactsList() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [primaryFilter, setPrimaryFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    loadContacts();
    loadAccounts();
  }, [accountFilter]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (accountFilter) {
        params.append('account_id', accountFilter);
      }

      const response = await apiClient.get(`/contacts?${params.toString()}`);
      // Sort by created_at (latest first)
      const sortedContacts = response.data.sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
      });
      setContacts(sortedContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load contacts');
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
    toast.success('Contact updated successfully');
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPrimary = 
      primaryFilter === '' || 
      (primaryFilter === 'primary' && contact.is_primary) ||
      (primaryFilter === 'not_primary' && !contact.is_primary);
    
    return matchesSearch && matchesPrimary;
  });

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
        <button 
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center"
        >
          <Plus size={18} className="mr-2" />
          New Contact
        </button>
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

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Primary Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
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
        </div>
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
                  Phone
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
              {filteredContacts.length > 0 ? (
                filteredContacts.map((contact) => (
                  <tr 
                    key={contact.id}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
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
                      <Link
                        to={`/accounts/${contact.account_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <Building2 size={14} className="mr-1" />
                        Account
                      </Link>
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {contact.phone || contact.mobile ? (
                        <a
                          href={`tel:${contact.phone || contact.mobile}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-gray-900 hover:text-blue-600 flex items-center"
                        >
                          <Phone size={14} className="mr-1 text-gray-400" />
                          {contact.phone || contact.mobile}
                        </a>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
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
                      {searchTerm || accountFilter || primaryFilter
                        ? 'Try adjusting your filters'
                        : 'Get started by creating your first contact'}
                    </p>
                    {!searchTerm && !accountFilter && !primaryFilter && (
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
        {filteredContacts.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{filteredContacts.length}</span> of{' '}
                <span className="font-medium">{contacts.length}</span> contacts
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