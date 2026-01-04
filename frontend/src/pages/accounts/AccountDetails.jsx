import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Building2, 
  Phone, 
  Globe, 
  MapPin, 
  DollarSign,
  Users,
  Target,
  Plus,
  Mail
} from 'lucide-react';
import EditAccountModal from '../../components/modals/EditAccountModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';

function AccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadAccountData();
  }, [id]);

  const loadAccountData = async () => {
    try {
      setLoading(true);
      
      // Load account first
      const accountRes = await apiClient.get(`/accounts/${id}`);
      setAccount(accountRes.data);
      
      // Try to load contacts and opportunities (may fail if endpoints don't exist yet)
      try {
        const contactsRes = await apiClient.get(`/contacts?account_id=${id}`);
        setContacts(contactsRes.data || []);
      } catch (err) {
        console.warn('Could not load contacts:', err);
        setContacts([]);
      }
      
      try {
        const opportunitiesRes = await apiClient.get(`/opportunities?account_id=${id}`);
        setOpportunities(opportunitiesRes.data || []);
      } catch (err) {
        console.warn('Could not load opportunities:', err);
        setOpportunities([]);
      }
    } catch (error) {
      toast.error('Failed to load account details');
      console.error('Error loading account:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await apiClient.delete(`/accounts/${id}`);
      toast.success('Account deleted successfully');
      navigate('/accounts');
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Account not found');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to delete this account');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to delete account');
      }
      console.error('Error deleting account:', error);
    }
  };

  const getOpportunityStageClass = (stage) => {
    const classes = {
      'Qualification': 'badge badge-info',
      'Needs Analysis': 'badge badge-info',
      'Proposal': 'badge badge-warning',
      'Negotiation': 'badge badge-warning',
      'Closed Won': 'badge badge-success',
      'Closed Lost': 'badge badge-danger',
    };
    return classes[stage] || 'badge badge-gray';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Account not found</p>
        <Link to="/accounts" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Accounts
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/accounts"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Building2 className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
              <p className="text-gray-600 mt-1">{account.industry || 'No industry specified'}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Edit size={18} className="mr-2" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-danger flex items-center"
          >
            <Trash2 size={18} className="mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Account Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Phone className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <a href={`tel:${account.phone}`} className="text-gray-900">
                    {account.phone || '-'}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Globe className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Website</p>
                  {account.website ? (
                    <a
                      href={account.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {account.website}
                    </a>
                  ) : (
                    <p className="text-gray-900">-</p>
                  )}
                </div>
              </div>

              {account.billing_address && (
                <div className="flex items-start space-x-3 md:col-span-2">
                  <MapPin className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Billing Address</p>
                    <p className="text-gray-900">{account.billing_address}</p>
                  </div>
                </div>
              )}

              {account.shipping_address && (
                <div className="flex items-start space-x-3 md:col-span-2">
                  <MapPin className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Shipping Address</p>
                    <p className="text-gray-900">{account.shipping_address}</p>
                  </div>
                </div>
              )}

              {account.description && (
                <div className="flex items-start space-x-3 md:col-span-2">
                  <Building2 className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="text-gray-900">{account.description}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users size={20} className="mr-2" />
                Contacts ({contacts.length})
              </h2>
              <button className="btn btn-secondary text-sm flex items-center">
                <Plus size={16} className="mr-1" />
                Add Contact
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No contacts yet</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <Users size={16} className="text-blue-600" />
                      </div>
                      <div>
                        <Link
                          to={`/contacts/${contact.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600"
                        >
                          {contact.first_name} {contact.last_name}
                        </Link>
                        <p className="text-sm text-gray-600">{contact.job_title || 'No title'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <Mail size={18} />
                      </a>
                      {contact.is_primary && (
                        <span className="badge badge-info text-xs">Primary</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Opportunities */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Target size={20} className="mr-2" />
                Opportunities ({opportunities.length})
              </h2>
              <button className="btn btn-secondary text-sm flex items-center">
                <Plus size={16} className="mr-1" />
                Add Opportunity
              </button>
            </div>
            {opportunities.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No opportunities yet</p>
            ) : (
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Link
                        to={`/opportunities/${opp.id}`}
                        className="font-medium text-gray-900 hover:text-blue-600"
                      >
                        {opp.name}
                      </Link>
                      <span className={getOpportunityStageClass(opp.stage)}>
                        {opp.stage}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">
                        Amount: <span className="font-semibold text-gray-900">
                          Ksh{parseFloat(opp.amount).toLocaleString()}
                        </span>
                      </span>
                      <span className="text-gray-600">
                        Close: {formatDate(opp.expected_close_date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Total Opportunities</p>
                <p className="text-2xl font-bold text-gray-900">{opportunities.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pipeline Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  Ksh{opportunities.reduce((sum, opp) => sum + parseFloat(opp.amount || 0), 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Contacts</p>
                <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Account ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1">{account.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">{formatDate(account.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900 mt-1">{formatDate(account.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditAccountModal
          account={account}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadAccountData();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Account"
          message={`Are you sure you want to delete ${account.name}? This will also delete all associated contacts and opportunities. This action cannot be undone.`}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default AccountDetails;