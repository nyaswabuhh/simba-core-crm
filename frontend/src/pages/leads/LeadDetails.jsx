import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Trash2, Building, Mail, Phone, Briefcase, Calendar, DollarSign, FileText } from 'lucide-react';
import EditLeadModal from '../../components/modals/EditLeadModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';
import ConvertLeadModal from '../../components/modals/ConvertLeadModal';

function LeadDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  useEffect(() => {
    loadLead();
  }, [id]);

  const loadLead = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/leads/${id}`);
      setLead(response.data);
    } catch (error) {
      toast.error('Failed to load lead details');
      console.error('Error loading lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/leads/${id}`);
      toast.success('Lead deleted successfully');
      navigate('/leads');
    } catch (error) {
      toast.error('Failed to delete lead');
      console.error('Error deleting lead:', error);
    }
  };

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

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
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

  if (!lead) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Lead not found</p>
        <Link to="/leads" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Leads
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
            to="/leads"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {lead.first_name} {lead.last_name}
            </h1>
            <p className="text-gray-600 mt-1">{lead.company || 'No company'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {!lead.is_converted && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span className={getStatusBadgeClass(lead.status)}>
          {lead.status}
        </span>
        {lead.is_converted && (
          <span className="ml-2 px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
            Converted on {formatDate(lead.converted_date)}
          </span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Mail className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:text-blue-800">
                    {lead.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Phone className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <a href={`tel:${lead.phone}`} className="text-gray-900">
                    {lead.phone || '-'}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Building className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Company</p>
                  <p className="text-gray-900">{lead.company || '-'}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Briefcase className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Job Title</p>
                  <p className="text-gray-900">{lead.job_title || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Lead Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lead Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Industry</p>
                <p className="text-gray-900 mt-1">{lead.industry || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Source</p>
                <p className="text-gray-900 mt-1">{lead.source || '-'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Website</p>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 mt-1 inline-block"
                  >
                    {lead.website}
                  </a>
                ) : (
                  <p className="text-gray-900 mt-1">-</p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-600">Estimated Value</p>
                <p className="text-gray-900 mt-1 font-semibold">
                  {lead.estimated_value
                    ? `Ksh${parseFloat(lead.estimated_value).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}`
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {lead.notes && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText size={20} className="mr-2" />
                Notes
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">{lead.notes}</p>
            </div>
          )}
        </div>

        {/* Right Column - Activity & Metadata */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Lead ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1">{lead.id}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">{formatDate(lead.created_at)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900 mt-1">{formatDate(lead.updated_at)}</p>
              </div>

              {lead.is_converted && (
                <>
                  {lead.converted_account_id && (
                    <div>
                      <p className="text-sm text-gray-600">Account ID</p>
                      <p className="text-xs text-gray-900 font-mono mt-1">
                        {lead.converted_account_id}
                      </p>
                    </div>
                  )}
                  {lead.converted_contact_id && (
                    <div>
                      <p className="text-sm text-gray-600">Contact ID</p>
                      <p className="text-xs text-gray-900 font-mono mt-1">
                        {lead.converted_contact_id}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          {!lead.is_converted && (
            <div className="card bg-blue-50 border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h3>
              <p className="text-sm text-blue-800 mb-3">
                Ready to convert this lead to an account and contact?
              </p>
              <button 
                onClick={() => setShowConvertModal(true)}
                className="btn btn-primary w-full"
              >
                Convert Lead
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadLead();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Lead"
          message={`Are you sure you want to delete ${lead.first_name} ${lead.last_name}? This action cannot be undone.`}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* Convert Lead Modal */}
      {showConvertModal && (
        <ConvertLeadModal
          lead={lead}
          onClose={() => setShowConvertModal(false)}
          onSuccess={() => {
            setShowConvertModal(false);
            loadLead();
          }}
        />
      )}
    </div>
  );
}

export default LeadDetails;