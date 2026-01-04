import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Target, 
  Building2, 
  DollarSign, 
  Calendar,
  TrendingUp,
  FileText,
  CheckCircle,
  XCircle
} from 'lucide-react';
import EditOpportunityModal from '../../components/modals/EditOpportunityModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';

function OpportunityDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [opportunity, setOpportunity] = useState(null);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadOpportunity();
  }, [id]);

  const loadOpportunity = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/opportunities/${id}`);
      setOpportunity(response.data);
      
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
      toast.error('Failed to load opportunity details');
      console.error('Error loading opportunity:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/opportunities/${id}`);
      toast.success('Opportunity deleted successfully');
      navigate('/opportunities');
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Opportunity not found');
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to delete this opportunity');
      } else {
        toast.error(error.response?.data?.detail || 'Failed to delete opportunity');
      }
      console.error('Error deleting opportunity:', error);
    }
  };

  const getStageClass = (stage) => {
    const classes = {
      'Prospecting': 'badge badge-gray',
      'Qualification': 'badge badge-info',
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
      month: 'long',
      day: 'numeric'
    });
  };

  const getWeightedValue = () => {
    if (!opportunity) return 0;
    const amount = parseFloat(opportunity.amount || 0);
    const probability = parseFloat(opportunity.probability || 0) / 100;
    return amount * probability;
  };

  const isClosed = opportunity?.stage === 'Closed Won' || opportunity?.stage === 'Closed Lost';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Opportunity not found</p>
        <Link to="/opportunities" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Opportunities
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
            to="/opportunities"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Target className="text-blue-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{opportunity.name}</h1>
              <Link 
                to={`/accounts/${opportunity.account_id}`}
                className="text-gray-600 hover:text-blue-600 mt-1 flex items-center"
              >
                <Building2 size={16} className="mr-1" />
                {account?.name || 'Loading...'}
              </Link>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {!isClosed && (
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

      {/* Status and Stage */}
      <div className="flex items-center space-x-3">
        <span className={getStageClass(opportunity.stage)}>
          {opportunity.stage}
        </span>
        {isClosed && opportunity.closed_date && (
          <span className="text-sm text-gray-600">
            Closed on {formatDate(opportunity.closed_date)}
          </span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Opportunity Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Opportunity Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <DollarSign className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-2xl font-bold text-gray-900">
                    Ksh{parseFloat(opportunity.amount).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <TrendingUp className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Probability</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {opportunity.probability}%
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Expected Close Date</p>
                  <p className="text-gray-900">
                    {formatDate(opportunity.expected_close_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <DollarSign className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Weighted Value</p>
                  <p className="text-gray-900 font-semibold">
                    Ksh{getWeightedValue().toLocaleString(undefined, {
                      maximumFractionDigits: 0
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          {opportunity.description && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText size={20} className="mr-2" />
                Description
              </h2>
              <p className="text-gray-700 whitespace-pre-wrap">{opportunity.description}</p>
            </div>
          )}

          {/* Next Step */}
          {opportunity.next_step && (
            <div className="card bg-blue-50 border-blue-200">
              <h2 className="text-lg font-semibold text-blue-900 mb-2 flex items-center">
                <CheckCircle size={20} className="mr-2" />
                Next Step
              </h2>
              <p className="text-blue-800">{opportunity.next_step}</p>
            </div>
          )}
        </div>

        {/* Right Column - Metadata & Actions */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Stage</p>
                <p className="text-gray-900 font-medium mt-1">{opportunity.stage}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className="text-gray-900 font-semibold mt-1">
                  Ksh{parseFloat(opportunity.amount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Win Probability</p>
                <div className="mt-2">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-900">{opportunity.probability}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${opportunity.probability}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Expected Revenue</p>
                <p className="text-gray-900 font-semibold mt-1">
                  Ksh{getWeightedValue().toLocaleString(undefined, {
                    maximumFractionDigits: 0
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Opportunity Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Opportunity ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1">{opportunity.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Account</p>
                <Link
                  to={`/accounts/${opportunity.account_id}`}
                  className="text-blue-600 hover:text-blue-800 mt-1 inline-block"
                >
                  {account?.name || 'View Account'}
                </Link>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">{formatDate(opportunity.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Last Updated</p>
                <p className="text-gray-900 mt-1">{formatDate(opportunity.updated_at)}</p>
              </div>
              {opportunity.closed_date && (
                <div>
                  <p className="text-sm text-gray-600">Closed Date</p>
                  <p className="text-gray-900 mt-1">{formatDate(opportunity.closed_date)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Status Actions */}
          {!isClosed && (
            <div className="card bg-green-50 border-green-200">
              <h3 className="text-sm font-semibold text-green-900 mb-2">Ready to close?</h3>
              <p className="text-sm text-green-800 mb-3">
                Mark this opportunity as won or lost
              </p>
              <div className="space-y-2">
                <button className="btn btn-primary w-full bg-green-600 hover:bg-green-700 flex items-center justify-center">
                  <CheckCircle size={18} className="mr-2" />
                  Mark as Won
                </button>
                <button className="btn btn-secondary w-full flex items-center justify-center">
                  <XCircle size={18} className="mr-2" />
                  Mark as Lost
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditOpportunityModal
          opportunity={opportunity}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadOpportunity();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete Opportunity"
          message={`Are you sure you want to delete "${opportunity.name}"? This action cannot be undone.`}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default OpportunityDetails;