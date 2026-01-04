import { useForm } from 'react-hook-form';
import { X, CheckCircle, Building, User, Target } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

function ConvertLeadModal({ lead, onClose, onSuccess }) {
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      create_opportunity: true,
      opportunity_name: `Opportunity from ${lead.first_name} ${lead.last_name}`,
      opportunity_amount: lead.estimated_value || '',
      opportunity_close_date: ''
    }
  });

  const createOpportunity = watch('create_opportunity');

  const onSubmit = async (data) => {
    try {
      const payload = {
        create_opportunity: data.create_opportunity,
        opportunity_name: data.create_opportunity ? data.opportunity_name : null,
        opportunity_amount: data.create_opportunity && data.opportunity_amount ? parseFloat(data.opportunity_amount) : null,
        opportunity_close_date: data.create_opportunity && data.opportunity_close_date ? data.opportunity_close_date : null
      };

      const response = await apiClient.post(`/leads/${lead.id}/convert`, payload);
      
      toast.success(response.data.message || 'Lead converted successfully');
      
      // Navigate to the new account page if available
      if (response.data.account_id) {
        navigate(`/accounts/${response.data.account_id}`);
      } else {
        onSuccess();
      }
      
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to convert lead');
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <CheckCircle className="text-green-600" size={24} />
              <h3 className="text-lg font-semibold text-gray-900">Convert Lead</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>

          {/* Info Banner */}
          <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
            <p className="text-sm text-blue-800">
              Converting this lead will create:
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex items-center text-sm text-blue-700">
                <Building size={16} className="mr-2" />
                <span>An <strong>Account</strong> for {lead.company || `${lead.first_name} ${lead.last_name}`}</span>
              </div>
              <div className="flex items-center text-sm text-blue-700">
                <User size={16} className="mr-2" />
                <span>A <strong>Contact</strong> for {lead.first_name} {lead.last_name}</span>
              </div>
              {createOpportunity && (
                <div className="flex items-center text-sm text-blue-700">
                  <Target size={16} className="mr-2" />
                  <span>An <strong>Opportunity</strong> (optional)</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 max-h-[calc(100vh-300px)] overflow-y-auto">
            <div className="space-y-4">
              {/* Lead Info Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Lead Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="text-gray-900 ml-2">{lead.first_name} {lead.last_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="text-gray-900 ml-2">{lead.email}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Company:</span>
                    <span className="text-gray-900 ml-2">{lead.company || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Value:</span>
                    <span className="text-gray-900 ml-2">
                      {lead.estimated_value ? `$${parseFloat(lead.estimated_value).toLocaleString()}` : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Create Opportunity Option */}
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start">
                  <input
                    type="checkbox"
                    {...register('create_opportunity')}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="ml-3 flex-1">
                    <label className="text-sm font-medium text-gray-900">
                      Create an Opportunity
                    </label>
                    <p className="text-xs text-gray-600 mt-1">
                      Start tracking a sales opportunity for this account
                    </p>
                  </div>
                </div>

                {/* Opportunity Fields */}
                {createOpportunity && (
                  <div className="mt-4 space-y-4 pl-7">
                    {/* Opportunity Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Opportunity Name
                      </label>
                      <input
                        {...register('opportunity_name')}
                        className={inputClass}
                        placeholder="e.g., Q1 2024 Deal"
                      />
                    </div>

                    {/* Opportunity Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount
                      </label>
                      <input
                        {...register('opportunity_amount')}
                        type="number"
                        step="0.01"
                        className={inputClass}
                        placeholder="10000.00"
                      />
                    </div>

                    {/* Expected Close Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Close Date
                      </label>
                      <input
                        {...register('opportunity_close_date')}
                        type="date"
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Once converted, this lead cannot be edited. The lead status will be changed to "Converted" and all information will be transferred to the new Account and Contact records.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-white transition"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting} 
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Converting...
                </>
              ) : (
                <>
                  <CheckCircle size={18} className="mr-2" />
                  Convert Lead
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConvertLeadModal;