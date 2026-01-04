import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Mail, 
  Phone,
  Building2,
  Briefcase,
  User,
  Calendar,
  Star,
  MessageSquare,
  Smartphone
} from 'lucide-react';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';
import ContactEditModal from '../../components/modals/ContactEditModal';

function ContactDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contact, setContact] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (id) {
      loadContact();
    }
  }, [id]);

  const loadContact = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/contacts/${id}`);
      setContact(response.data);
      
      // Load associated account
      if (response.data.account_id) {
        try {
          const accountResponse = await apiClient.get(`/accounts/${response.data.account_id}`);
          setAccount(accountResponse.data);
        } catch (error) {
          console.warn('Could not load account:', error);
        }
      }
    } catch (error) {
      console.error('Error loading contact:', error);
      if (error.response?.status === 404) {
        toast.error('Contact not found');
        setTimeout(() => navigate('/contacts'), 2000);
      } else {
        toast.error('Failed to load contact details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/contacts/${id}`);
      toast.success('Contact deleted successfully');
      navigate('/contacts');
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete contact');
    }
  };

  const handleEditSuccess = (updatedContact) => {
    setShowEditModal(false);
    setContact(updatedContact);
    // Reload to get fresh data including account
    loadContact();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Contact not found</p>
        <Link to="/contacts" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Contacts
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
            to="/contacts"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {contact.first_name} {contact.last_name}
              </h1>
              {contact.is_primary && (
                <span className="badge badge-warning flex items-center">
                  <Star size={14} className="mr-1" fill="currentColor" />
                  Primary Contact
                </span>
              )}
            </div>
            {account && (
              <Link 
                to={`/accounts/${contact.account_id}`}
                className="text-gray-600 hover:text-blue-600 mt-1 flex items-center"
              >
                <Building2 size={16} className="mr-1" />
                {account.name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3 flex-wrap">
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
        {/* Left Column - Contact Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div className="flex items-start space-x-3">
                <Mail className="text-gray-400 mt-1" size={20} />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Email</p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-blue-600 hover:text-blue-800 mt-1 break-all"
                  >
                    {contact.email}
                  </a>
                </div>
              </div>

              {/* Phone */}
              {contact.phone && (
                <div className="flex items-start space-x-3">
                  <Phone className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-blue-600 hover:text-blue-800 mt-1"
                    >
                      {contact.phone}
                    </a>
                  </div>
                </div>
              )}

              {/* Mobile */}
              {contact.mobile && (
                <div className="flex items-start space-x-3">
                  <Smartphone className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Mobile</p>
                    <a
                      href={`tel:${contact.mobile}`}
                      className="text-blue-600 hover:text-blue-800 mt-1"
                    >
                      {contact.mobile}
                    </a>
                  </div>
                </div>
              )}

              {/* Job Title */}
              {contact.job_title && (
                <div className="flex items-start space-x-3">
                  <Briefcase className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Job Title</p>
                    <p className="text-gray-900 mt-1">{contact.job_title}</p>
                  </div>
                </div>
              )}

              {/* Department */}
              {contact.department && (
                <div className="flex items-start space-x-3">
                  <Building2 className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Department</p>
                    <p className="text-gray-900 mt-1">{contact.department}</p>
                  </div>
                </div>
              )}

              {/* Account */}
              <div className="flex items-start space-x-3">
                <Building2 className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Account</p>
                  <Link
                    to={`/accounts/${contact.account_id}`}
                    className="text-blue-600 hover:text-blue-800 mt-1"
                  >
                    {account?.name || 'Loading...'}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {contact.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MessageSquare size={20} className="mr-2" />
                Notes
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card bg-blue-50 border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a
                href={`mailto:${contact.email}`}
                className="btn btn-secondary flex items-center justify-center"
              >
                <Mail size={18} className="mr-2" />
                Send Email
              </a>
              {(contact.phone || contact.mobile) && (
                <a
                  href={`tel:${contact.phone || contact.mobile}`}
                  className="btn btn-secondary flex items-center justify-center"
                >
                  <Phone size={18} className="mr-2" />
                  Call
                </a>
              )}
            </div>
          </div>

          {/* Related Account Details */}
          {account && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Details</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                  <span className="text-sm text-gray-600">Account Name</span>
                  <Link
                    to={`/accounts/${account.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {account.name}
                  </Link>
                </div>
                {account.industry && (
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Industry</span>
                    <span className="text-gray-900">{account.industry}</span>
                  </div>
                )}
                {account.website && (
                  <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Website</span>
                    <a
                      href={account.website.startsWith('http') ? account.website : `https://${account.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {account.website}
                    </a>
                  </div>
                )}
                {account.phone && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Phone</span>
                    <a
                      href={`tel:${account.phone}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {account.phone}
                    </a>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  to={`/accounts/${account.id}`}
                  className="btn btn-secondary w-full flex items-center justify-center"
                >
                  <Building2 size={18} className="mr-2" />
                  View Full Account
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Summary & Info */}
        <div className="space-y-6">
          {/* Contact Card */}
          <div className="card">
            <div className="flex items-center justify-center mb-4">
              <div className="h-24 w-24 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-4xl font-bold text-blue-600">
                  {contact.first_name.charAt(0)}{contact.last_name.charAt(0)}
                </span>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {contact.first_name} {contact.last_name}
              </h3>
              {contact.job_title && (
                <p className="text-sm text-gray-600 mt-1">{contact.job_title}</p>
              )}
              {contact.department && (
                <p className="text-xs text-gray-500 mt-1">{contact.department}</p>
              )}
            </div>
          </div>

          {/* Contact Type */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Type</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                {contact.is_primary ? (
                  <span className="badge badge-warning flex items-center">
                    <Star size={12} className="mr-1" fill="currentColor" />
                    Primary
                  </span>
                ) : (
                  <span className="text-gray-900">Contact</span>
                )}
              </div>
              <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
                {contact.is_primary 
                  ? 'This is the primary contact for the account'
                  : 'This is a regular contact for the account'}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={16} />
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-gray-900 text-sm mt-1">{formatDate(contact.created_at)}</p>
                </div>
              </div>
              {contact.updated_at && (
                <div className="flex items-start space-x-3">
                  <Calendar className="text-gray-400 mt-1" size={16} />
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-gray-900 text-sm mt-1">{formatDate(contact.updated_at)}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Owner */}
          {contact.owner && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Owner</h2>
              <div className="flex items-center space-x-3">
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User size={20} className="text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {contact.owner.first_name} {contact.owner.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{contact.owner.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Contact ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1 break-all">{contact.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Account ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1 break-all">{contact.account_id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Contact"
          message={
            <div>
              <p className="mb-2">
                Are you sure you want to delete <strong>{contact.first_name} {contact.last_name}</strong>?
              </p>
              <p className="text-sm text-red-600">This action cannot be undone.</p>
            </div>
          }
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* Edit Contact Modal */}
      {showEditModal && (
        <ContactEditModal
          contact={contact}
          onClose={() => setShowEditModal(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default ContactDetails;