import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';
import { Plus, Search, Target, DollarSign, TrendingUp } from 'lucide-react';
import CreateOpportunityModal from '../../components/modals/CreateOpportunityModal';

function OpportunityList() {
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [accounts, setAccounts] = useState({});

  useEffect(() => {
    loadData();
  }, [stageFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load opportunities
      const params = new URLSearchParams();
      if (stageFilter) {
        params.append('stage', stageFilter);
      }
      
      const url = `/opportunities${params.toString() ? `?${params.toString()}` : ''}`;
      const [oppsResponse, accountsResponse] = await Promise.all([
        apiClient.get(url),
        apiClient.get('/accounts')
      ]);
      
      // Create account lookup map
      const accountMap = {};
      accountsResponse.data.forEach(account => {
        accountMap[account.id] = account;
      });
      
      setAccounts(accountMap);
      setOpportunities(oppsResponse.data);
    } catch (error) {
      toast.error('Failed to load opportunities');
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
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

  const filteredOpportunities = opportunities.filter(opp => {
    const searchLower = searchTerm.toLowerCase();
    const accountName = accounts[opp.account_id]?.name || '';
    return (
      opp.name?.toLowerCase().includes(searchLower) ||
      accountName.toLowerCase().includes(searchLower) ||
      opp.description?.toLowerCase().includes(searchLower)
    );
  });

  const getTotalValue = () => {
    return filteredOpportunities.reduce((sum, opp) => sum + parseFloat(opp.amount || 0), 0);
  };

  const getWeightedValue = () => {
    return filteredOpportunities.reduce((sum, opp) => {
      const amount = parseFloat(opp.amount || 0);
      const probability = parseFloat(opp.probability || 0) / 100;
      return sum + (amount * probability);
    }, 0);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-600 mt-1">Track and manage your sales pipeline</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" />
          Create Opportunity
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search opportunities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="input md:w-48"
          >
            <option value="">All Stages</option>
            <option value="Prospecting">Prospecting</option>
            <option value="Qualification">Qualification</option>
            <option value="Proposal">Proposal</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closed Won">Closed Won</option>
            <option value="Closed Lost">Closed Lost</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Target className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Opportunities</p>
              <p className="text-2xl font-bold text-gray-900">{filteredOpportunities.length}</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pipeline Value</p>
              <p className="text-2xl font-bold text-gray-900">
                Ksh{getTotalValue().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Weighted Value</p>
              <p className="text-2xl font-bold text-gray-900">
                Ksh{getWeightedValue().toLocaleString(undefined, {
                  maximumFractionDigits: 0
                })}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center space-x-3">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Target className="text-yellow-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">Won</p>
              <p className="text-2xl font-bold text-gray-900">
                {opportunities.filter(o => o.stage === 'Closed Won').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Opportunities Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opportunity Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Probability
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Close Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOpportunities.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="text-gray-500">
                      <Target className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-lg font-medium">No opportunities found</p>
                      <p className="text-sm mt-1">
                        {searchTerm ? 'Try adjusting your search' : 'Create your first opportunity to get started'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOpportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/opportunities/${opp.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                      >
                        {opp.name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {accounts[opp.account_id] ? (
                        <Link
                          to={`/accounts/${opp.account_id}`}
                          className="text-gray-900 hover:text-blue-600 transition"
                        >
                          {accounts[opp.account_id].name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">Loading...</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStageClass(opp.stage)}>
                        {opp.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                      Ksh{parseFloat(opp.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {opp.probability}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(opp.expected_close_date)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateOpportunityModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

export default OpportunityList;