import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import useAuthStore from '../store/authStore';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Target, 
  DollarSign, 
  Award, 
  Download, 
  Calendar, 
  ChevronDown, 
  RefreshCw,
  X 
} from 'lucide-react';

// Date period presets - matches backend get_date_range_for_period()
const DATE_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_year', label: 'Last Year' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_365_days', label: 'Last 365 Days' },
  { value: 'custom', label: 'Custom Range' },
];

function Analytics() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState({
    revenue: null,
    pipeline: null,
    funnel: null,
    topAccounts: null,
    topProducts: null,
    userPerformance: null,
    payments: null
  });
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Date filtering state
  const [dateFilter, setDateFilter] = useState({
    period: 'this_year',
    startDate: '',
    endDate: '',
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDatePicker && !event.target.closest('.date-picker-container')) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDatePicker]);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handlePresetChange = (preset) => {
    if (preset === 'custom') {
      setDateFilter(prev => ({ ...prev, period: 'custom' }));
    } else {
      setDateFilter({ period: preset, startDate: '', endDate: '' });
    }
  };

  const handleDateChange = (field, value) => {
    setDateFilter(prev => ({
      ...prev,
      period: 'custom',
      [field]: value,
    }));
  };

  const applyDateFilter = () => {
    setShowDatePicker(false);
    loadAnalytics();
  };

  const buildApiParams = () => {
    // If using a preset period, just pass the period parameter
    if (dateFilter.period && dateFilter.period !== 'custom') {
      return { period: dateFilter.period };
    }
    
    // For custom range, pass start_date and end_date
    const params = {};
    if (dateFilter.startDate) {
      params.start_date = dateFilter.startDate;
    }
    if (dateFilter.endDate) {
      params.end_date = dateFilter.endDate;
    }
    return params;
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const params = buildApiParams();
      
      const promises = [
        apiClient.get('/analytics/revenue', { params }),
        apiClient.get('/analytics/sales-pipeline', { params }),
        apiClient.get('/analytics/conversion-funnel', { params }),
        apiClient.get('/analytics/top-accounts', { params: { ...params, limit: 10 } }),
        apiClient.get('/analytics/top-products', { params: { ...params, limit: 10 } }),
        apiClient.get('/analytics/payments', { params })
      ];

      if (['Admin', 'Sales'].includes(user?.role)) {
        promises.push(apiClient.get('/analytics/performance/users', { params }));
      }

      const results = await Promise.all(promises);

      setAnalytics({
        revenue: results[0].data,
        pipeline: results[1].data,
        funnel: results[2].data,
        topAccounts: results[3].data,
        topProducts: results[4].data,
        payments: results[5].data,
        userPerformance: results[6]?.data || null
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSelectedPresetLabel = () => {
    if (dateFilter.period === 'custom') {
      if (dateFilter.startDate && dateFilter.endDate) {
        return `${formatDateDisplay(dateFilter.startDate)} - ${formatDateDisplay(dateFilter.endDate)}`;
      }
      return 'Custom Range';
    }
    const preset = DATE_PERIODS.find((p) => p.value === dateFilter.period);
    return preset?.label || 'Select Date Range';
  };

  // Get date range from API response for display
  const getDateRangeDisplay = () => {
    const dateRange = analytics.revenue?.date_range;
    if (dateRange?.start_date && dateRange?.end_date) {
      return `${formatDateDisplay(dateRange.start_date)} to ${formatDateDisplay(dateRange.end_date)}`;
    }
    return getSelectedPresetLabel();
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-600 mt-1">Comprehensive business insights and metrics</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Date Filter Dropdown */}
          <div className="relative date-picker-container">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="btn btn-secondary flex items-center"
            >
              <Calendar size={18} className="mr-2" />
              {getSelectedPresetLabel()}
              <ChevronDown size={18} className="ml-2" />
            </button>

            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900">Filter by Date</h3>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Preset Options */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Select
                    </label>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                      {DATE_PERIODS.filter((p) => p.value !== 'custom').map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handlePresetChange(preset.value)}
                          className={`px-3 py-2 text-sm rounded-lg border transition ${
                            dateFilter.period === preset.value
                              ? 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Date Range */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Custom Range
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={dateFilter.startDate}
                          onChange={(e) => handleDateChange('startDate', e.target.value)}
                          max={dateFilter.endDate || undefined}
                          className="input w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={dateFilter.endDate}
                          onChange={(e) => handleDateChange('endDate', e.target.value)}
                          min={dateFilter.startDate || undefined}
                          className="input w-full text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-2 mt-4 pt-4 border-t">
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="btn btn-secondary text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={applyDateFilter}
                      className="btn btn-primary text-sm"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={loadAnalytics}
            className="btn btn-secondary"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          
          <button className="btn btn-primary flex items-center">
            <Download size={16} className="mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Date Range Display */}
      <div className="flex items-center text-sm text-gray-600">
        <Calendar size={16} className="mr-2" />
        <span>Showing data: </span>
        <span className="font-medium ml-1">{getDateRangeDisplay()}</span>
      </div>

      {/* Revenue Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <h2 className="text-lg font-semibold text-gray-900">Revenue Overview</h2>
          <div className="flex items-center space-x-4 text-sm">
            <div>
              <span className="text-gray-600">Total: </span>
              <span className="font-bold text-gray-900">
                {formatCurrency(analytics.revenue?.total_revenue || 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">YTD: </span>
              <span className="font-bold text-gray-900">
                {formatCurrency(analytics.revenue?.ytd_revenue || 0)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Avg/Month: </span>
              <span className="font-bold text-gray-900">
                {formatCurrency(analytics.revenue?.avg_monthly_revenue || 0)}
              </span>
            </div>
            {analytics.revenue?.revenue_trend && (
              <div className={`flex items-center ${
                analytics.revenue.revenue_trend === 'up' ? 'text-green-600' : 
                analytics.revenue.revenue_trend === 'down' ? 'text-red-600' : 'text-gray-600'
              }`}>
                <TrendingUp size={16} className="mr-1" />
                <span className="capitalize">{analytics.revenue.revenue_trend}</span>
              </div>
            )}
          </div>
        </div>
        {analytics.revenue?.monthly_revenue?.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={analytics.revenue.monthly_revenue}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#3b82f6" 
                fillOpacity={1}
                fill="url(#colorRevenue)"
                name="Revenue"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No revenue data for selected period
          </div>
        )}
      </div>

      {/* Conversion Funnel */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Sales Conversion Funnel</h2>
        {analytics.funnel?.funnel_stages?.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analytics.funnel.funnel_stages} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="stage" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="#3b82f6" name="Count">
                  <LabelList dataKey="count" position="right" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center space-y-4">
              {analytics.funnel.funnel_stages.map((stage, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{stage.stage}</p>
                    <p className="text-sm text-gray-600">{stage.count} records</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">{stage.conversion_rate}%</p>
                    <p className="text-xs text-gray-500">conversion</p>
                  </div>
                </div>
              ))}
              <div className="p-4 bg-primary-50 rounded-lg border-2 border-primary-200">
                <p className="text-sm text-gray-600">Overall Conversion Rate</p>
                <p className="text-3xl font-bold text-primary-700">
                  {analytics.funnel.overall_conversion || 0}%
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            No funnel data for selected period
          </div>
        )}
      </div>

      {/* Pipeline Summary */}
      {analytics.pipeline && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
            <p className="text-sm font-medium text-blue-700">Total Opportunities</p>
            <p className="text-3xl font-bold text-blue-900 mt-2">
              {analytics.pipeline.total_opportunities}
            </p>
          </div>
          <div className="card bg-gradient-to-br from-green-50 to-green-100">
            <p className="text-sm font-medium text-green-700">Pipeline Value</p>
            <p className="text-3xl font-bold text-green-900 mt-2">
              {formatCurrency(analytics.pipeline.total_pipeline_value)}
            </p>
          </div>
          <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
            <p className="text-sm font-medium text-purple-700">Weighted Value</p>
            <p className="text-3xl font-bold text-purple-900 mt-2">
              {formatCurrency(analytics.pipeline.weighted_pipeline_value)}
            </p>
          </div>
          <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
            <p className="text-sm font-medium text-orange-700">Avg Deal Size</p>
            <p className="text-3xl font-bold text-orange-900 mt-2">
              {formatCurrency(analytics.pipeline.avg_deal_size)}
            </p>
          </div>
        </div>
      )}

      {/* Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Accounts */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Award className="mr-2 text-yellow-500" size={20} />
            Top Accounts by Revenue
          </h2>
          {analytics.topAccounts?.length > 0 ? (
            <div className="space-y-3">
              {analytics.topAccounts.slice(0, 10).map((account, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{account.account_name}</p>
                      <p className="text-sm text-gray-600">{account.invoice_count} invoices</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(account.total_revenue)}</p>
                    <p className="text-sm text-gray-600">avg: {formatCurrency(account.avg_invoice)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500">
              No account data for selected period
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="mr-2 text-blue-500" size={20} />
            Top Products by Sales
          </h2>
          {analytics.topProducts?.length > 0 ? (
            <div className="space-y-3">
              {analytics.topProducts.slice(0, 10).map((product, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                      index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-blue-400' : index === 2 ? 'bg-blue-300' : 'bg-gray-300'
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{product.product_name}</p>
                      <p className="text-sm text-gray-600">{product.quantity_sold} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatCurrency(product.revenue)}</p>
                    <p className="text-sm text-gray-600">{product.invoice_count} orders</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500">
              No product data for selected period
            </div>
          )}
        </div>
      </div>

      {/* Payment Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h2>
          {analytics.payments?.by_method?.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.payments.by_method}
                    dataKey="total_amount"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.method} (${entry.percentage.toFixed(1)}%)`}
                  >
                    {analytics.payments.by_method.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {analytics.payments.by_method.map((method, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-gray-700">{method.method}</span>
                    </div>
                    <span className="font-semibold text-gray-900">{formatCurrency(method.total_amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No payment data for selected period
            </div>
          )}
        </div>

        {/* Payment Stats */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Statistics</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Payments</p>
              <p className="text-3xl font-bold text-blue-700">{analytics.payments?.total_payments || 0}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Amount</p>
              <p className="text-3xl font-bold text-green-700">
                {formatCurrency(analytics.payments?.total_amount || 0)}
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Average Payment</p>
              <p className="text-3xl font-bold text-purple-700">
                {formatCurrency(analytics.payments?.avg_payment || 0)}
              </p>
            </div>
            {analytics.payments?.avg_days_to_payment && (
              <div className="p-4 bg-orange-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Avg Days to Payment</p>
                <p className="text-3xl font-bold text-orange-700">
                  {analytics.payments.avg_days_to_payment} days
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Performance */}
      {analytics.userPerformance && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="mr-2 text-green-500" size={20} />
              Team Performance
            </h2>
            <div className="text-sm text-gray-600">
              {analytics.userPerformance.team_size} team members
            </div>
          </div>
          {analytics.userPerformance.sales_team?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Leads</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Opportunities</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quotes</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Conversion</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.userPerformance.sales_team.map((user, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {index < 3 && (
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 ${
                              index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-600'
                            }`}>
                              {index + 1}
                            </div>
                          )}
                          <span className="font-medium text-gray-900">{user.user_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                        {user.leads_created}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                        {user.opportunities_created}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">
                        {user.quotes_created}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-gray-900">
                        {formatCurrency(user.total_revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          user.conversion_rate >= 20 ? 'bg-green-100 text-green-800' :
                          user.conversion_rate >= 10 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {user.conversion_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-4 font-bold text-gray-900">Team Total</td>
                    <td colSpan="3"></td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {formatCurrency(analytics.userPerformance.total_team_revenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-600">
                      Avg: {formatCurrency(analytics.userPerformance.avg_revenue_per_user)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500">
              No team performance data for selected period
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Analytics;