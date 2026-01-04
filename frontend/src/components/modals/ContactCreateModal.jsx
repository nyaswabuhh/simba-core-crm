import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function ContactCreateModal({ onClose, onSuccess, preSelectedAccountId = null }) {
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [formData, setFormData] = useState({
    account_id: preSelectedAccountId || '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    mobile: '',
    job_title: '',
    department: '',
    is_primary: false,
    notes: ''
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await apiClient.get('/accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast.error('Failed to load accounts');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.account_id) {
      toast.error('Please select an account');
      return;
    }

    if (!formData.first_name.trim()) {
      toast.error('First name is required');
      return;
    }

    if (!formData.last_name.trim()) {
      toast.error('Last name is required');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);

      // Prepare contact data
      const contactData = {
        account_id: formData.account_id,
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        mobile: formData.mobile.trim() || null,
        job_title: formData.job_title.trim() || null,
        department: formData.department.trim() || null,
        is_primary: formData.is_primary,
        notes: formData.notes.trim() || null
      };

      const response = await apiClient.post('/contacts', contactData);

      toast.success('Contact created successfully');
      onSuccess(response.data);
    } catch (error) {
      console.error('Error creating contact:', error);
      if (error.response?.status === 400) {
        toast.error(error.response?.data?.detail || 'Invalid contact data');
      } else if (error.response?.status === 404) {
        toast.error('Selected account not found');
      } else {
        toast.error('Failed to create contact');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Contact</h2>
            <p className="text-sm text-gray-600 mt-1">Add a new contact to your CRM</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account *
            </label>
            <select
              name="account_id"
              value={formData.account_id}
              onChange={handleInputChange}
              className="input"
              required
              disabled={!!preSelectedAccountId}
            >
              <option value="">Select an account...</option>
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              The account this contact belongs to
            </p>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                className="input"
                placeholder="John"
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                className="input"
                placeholder="Doe"
                required
                maxLength={100}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="input"
              placeholder="john.doe@example.com"
              required
              maxLength={255}
            />
          </div>

          {/* Phone Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="input"
                placeholder="+1 (555) 123-4567"
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mobile
              </label>
              <input
                type="tel"
                name="mobile"
                value={formData.mobile}
                onChange={handleInputChange}
                className="input"
                placeholder="+1 (555) 987-6543"
                maxLength={50}
              />
            </div>
          </div>

          {/* Job Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title
              </label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleInputChange}
                className="input"
                placeholder="CEO, Manager, etc."
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="input"
                placeholder="Sales, Engineering, etc."
                maxLength={100}
              />
            </div>
          </div>

          {/* Primary Contact Checkbox */}
          <div className="flex items-start space-x-3">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                name="is_primary"
                checked={formData.is_primary}
                onChange={handleInputChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700">
                Set as Primary Contact
              </label>
              <p className="text-xs text-gray-500 mt-1">
                This will be the main point of contact for the account. Any existing primary contact will be updated.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows="4"
              className="input"
              placeholder="Additional information about this contact..."
            />
          </div>

          {/* Important Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Note:</h4>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Fields marked with * are required</li>
              <li>Email must be unique and valid</li>
              <li>Only one primary contact per account is allowed</li>
              <li>You can add additional details after creation</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating Contact...' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ContactCreateModal;