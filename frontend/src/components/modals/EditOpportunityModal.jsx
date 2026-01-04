import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function EditOpportunityModal({ opportunity, onClose, onSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  
  // Format the date properly for input field
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  };
  
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      name: opportunity.name || '',
      account_id: opportunity.account_id || '',
      stage: opportunity.stage || 'Prospecting',
      amount: opportunity.amount || '',
      probability: opportunity.probability || 0,
      expected_close_date: formatDateForInput(opportunity.expected_close_date),
      description: opportunity.description || '',
      next_step: opportunity.next_step || ''
    }
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    // Reset form values when accounts are loaded to ensure account_id is properly set
    if (!loadingAccounts && accounts.length > 0) {
      reset({
        name: opportunity.name || '',
        account_id: opportunity.account_id || '',
        stage: opportunity.stage || 'Prospecting',
        amount: opportunity.amount || '',
        probability: opportunity.probability || 0,
        expected_close_date: formatDateForInput(opportunity.expected_close_date),
        description: opportunity.description || '',
        next_step: opportunity.next_step || ''
      });
    }
  }, [loadingAccounts, accounts, opportunity, reset]);

  const loadAccounts = async () => {
    try {
      const response = await apiClient.get('/accounts');
      setAccounts(response.data);
      console.log('Loaded accounts:', response.data);
      console.log('Current account_id:', opportunity.account_id);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      toast.error('Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        amount: parseFloat(data.amount),
        probability: parseFloat(data.probability),
        expected_close_date: data.expected_close_date ? new Date(data.expected_close_date).toISOString() : null
      };
      
      await apiClient.put(`/opportunities/${opportunity.id}`, payload);
      toast.success('Opportunity updated successfully');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update opportunity');
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
            <h3 className="text-lg font-semibold text-gray-900">Edit Opportunity</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <X size={24} />
            </button>
          </div>

          {/* Form Content */}
          <div className="px-6 py-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Opportunity Name */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Opportunity Name *
                </label>
                <input
                  {...register('name', { required: 'Opportunity name is required' })}
                  className={inputClass}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              {/* Account */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account *
                </label>
                {loadingAccounts ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                    Loading accounts...
                  </div>
                ) : (
                  <select
                    {...register('account_id', { required: 'Account is required' })}
                    className={inputClass}
                  >
                    <option value="">Select an account...</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                )}
                {errors.account_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.account_id.message}</p>
                )}
              </div>

              {/* Stage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stage *
                </label>
                <select
                  {...register('stage', { required: 'Stage is required' })}
                  className={inputClass}
                >
                  <option value="Prospecting">Prospecting</option>
                  <option value="Qualification">Qualification</option>
                  <option value="Proposal">Proposal</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Closed Won">Closed Won</option>
                  <option value="Closed Lost">Closed Lost</option>
                </select>
                {errors.stage && (
                  <p className="mt-1 text-sm text-red-600">{errors.stage.message}</p>
                )}
              </div>

              {/* Probability */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Probability (%) *
                </label>
                <input
                  {...register('probability', { 
                    required: 'Probability is required',
                    min: { value: 0, message: 'Minimum is 0%' },
                    max: { value: 100, message: 'Maximum is 100%' }
                  })}
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  className={inputClass}
                />
                {errors.probability && (
                  <p className="mt-1 text-sm text-red-600">{errors.probability.message}</p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <input
                  {...register('amount', { 
                    required: 'Amount is required',
                    min: { value: 0, message: 'Amount must be positive' }
                  })}
                  type="number"
                  step="0.01"
                  className={inputClass}
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
                )}
              </div>

              {/* Expected Close Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Close Date
                </label>
                <input
                  {...register('expected_close_date')}
                  type="date"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  {...register('description')}
                  rows="3"
                  className={inputClass}
                />
              </div>

              {/* Next Step */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Step
                </label>
                <textarea
                  {...register('next_step')}
                  rows="2"
                  className={inputClass}
                />
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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition flex items-center"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Update Opportunity'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditOpportunityModal;