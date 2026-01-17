import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Mail, 
  Shield, 
  Calendar,
  Key,
  CheckCircle,
  XCircle
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import EditUserModal from '../../components/modals/EditUserModal';
import ChangePasswordModal from '../../components/modals/ChangePasswordModal';
import DeleteConfirmModal from '../../components/modals/DeleteUserConfirmModal';

function UserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isAdmin = currentUser?.role === 'Admin';
  const isCurrentUser = currentUser?.id === id;

  useEffect(() => {
    loadUser();
  }, [id]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/users/${id}`);
      setUser(response.data);
    } catch (error) {
      toast.error('Failed to load user details');
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiClient.delete(`/users/${id}`);
      toast.success('User deleted successfully');
      navigate('/users');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
      console.error('Error deleting user:', error);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">User not found</p>
        <Link to="/users" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
          Back to Users
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
            to="/users"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div className="flex items-center space-x-3">
            <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-2xl">
                {user.first_name?.[0]}{user.last_name?.[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.first_name} {user.last_name}
              </h1>
              <p className="text-gray-600 mt-1">{user.role}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn btn-secondary flex items-center"
          >
            <Key size={18} className="mr-2" />
            {isCurrentUser ? 'Change Password' : 'Reset Password'}
          </button>
          {(isAdmin || isCurrentUser) && (
            <button
              onClick={() => setShowEditModal(true)}
              className="btn btn-secondary flex items-center"
            >
              <Edit size={18} className="mr-2" />
              Edit
            </button>
          )}
          {isAdmin && !isCurrentUser && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="btn btn-danger flex items-center"
            >
              <Trash2 size={18} className="mr-2" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span className={user.is_active ? 'badge badge-success' : 'badge badge-gray'}>
          {user.is_active ? 'Active' : 'Inactive'}
        </span>
        {isCurrentUser && (
          <span className="ml-2 badge badge-info">Current User</span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - User Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* User Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">User Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Mail className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <a href={`mailto:${user.email}`} className="text-blue-600 hover:text-blue-800">
                    {user.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Shield className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Role</p>
                  <p className="text-gray-900 font-medium">{user.role}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="text-gray-900">{formatDate(user.created_at)}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Last Updated</p>
                  <p className="text-gray-900">{formatDate(user.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Role Description */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Role Permissions</h2>
            <div className="space-y-3">
              {user.role === 'Admin' && (
                <>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Full system access
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    User management
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    All CRM modules access
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Financial management
                  </div>
                </>
              )}
              {user.role === 'Sales' && (
                <>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Leads and opportunities management
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Account and contact management
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Quote creation and management
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <XCircle size={16} className="text-red-600 mr-2" />
                    Invoice and payment management
                  </div>
                </>
              )}
              {user.role === 'Finance' && (
                <>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Invoice and payment management
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Financial reports and analytics
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <CheckCircle size={16} className="text-green-600 mr-2" />
                    Quote management (view only)
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <XCircle size={16} className="text-red-600 mr-2" />
                    Lead and opportunity management
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Quick Info */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Status</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <div className="flex items-center mt-1">
                  {user.is_active ? (
                    <>
                      <CheckCircle className="text-green-600 mr-2" size={18} />
                      <span className="text-green-600 font-medium">Active</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="text-gray-400 mr-2" size={18} />
                      <span className="text-gray-600 font-medium">Inactive</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">User ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1">{user.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Full Name</p>
                <p className="text-gray-900 mt-1">{user.first_name} {user.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-gray-900 mt-1">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Role</p>
                <p className="text-gray-900 mt-1">{user.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <EditUserModal
          user={user}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            loadUser();
          }}
        />
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          userId={user.id}
          isCurrentUser={isCurrentUser}
          onClose={() => setShowPasswordModal(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          title="Delete User"
          message={`Are you sure you want to delete ${user.first_name} ${user.last_name}? This action cannot be undone.`}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

export default UserDetails;