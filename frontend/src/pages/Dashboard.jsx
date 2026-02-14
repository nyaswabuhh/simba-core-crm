import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/client";
import useAuthStore from "../store/authStore";
import {
  Users,
  Building2,
  Target,
  FileText,
  Receipt,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ChevronDown,
  RefreshCw,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Date period presets - matches backend get_date_range_for_period()
const DATE_PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "custom", label: "Custom Range" },
];

function Dashboard() {
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState({
    dashboard: null,
    pipeline: null,
    revenue: null,
    leads: null,
    invoices: null,
  });
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Simplified date state - use period for presets, dates only for custom
  const [dateFilter, setDateFilter] = useState({
    period: "this_month",
    startDate: "",
    endDate: "",
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
    if (preset === "custom") {
      setDateFilter(prev => ({ ...prev, period: "custom" }));
    } else {
      setDateFilter({ period: preset, startDate: "", endDate: "" });
    }
  };

  const handleDateChange = (field, value) => {
    setDateFilter(prev => ({
      ...prev,
      period: "custom",
      [field]: value,
    }));
  };

  const applyDateFilter = () => {
    setShowDatePicker(false);
    loadAnalytics();
  };

  const buildApiParams = () => {
    // If using a preset period, just pass the period parameter
    // The backend handles all date calculations
    if (dateFilter.period && dateFilter.period !== "custom") {
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

      const [dashboard, pipeline, revenue, leads, invoices] = await Promise.all([
        apiClient.get("/analytics/dashboard", { params }),
        apiClient.get("/analytics/sales-pipeline", { params }),
        apiClient.get("/analytics/revenue", { params: { ...params, months: 6 } }),
        apiClient.get("/analytics/leads", { params }),
        apiClient.get("/analytics/invoices", { params }),
      ]);

      setAnalytics({
        dashboard: dashboard.data,
        pipeline: pipeline.data,
        revenue: revenue.data,
        leads: leads.data,
        invoices: invoices.data,
      });
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSales = ["Admin", "Sales"].includes(user?.role);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "KES",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getSelectedPresetLabel = () => {
    if (dateFilter.period === "custom") {
      if (dateFilter.startDate && dateFilter.endDate) {
        return `${formatDateDisplay(dateFilter.startDate)} - ${formatDateDisplay(dateFilter.endDate)}`;
      }
      return "Custom Range";
    }
    const preset = DATE_PERIODS.find((p) => p.value === dateFilter.period);
    return preset?.label || "Select Date Range";
  };

  // Get date range from API response for display
  const getDateRangeDisplay = () => {
    const dateRange = analytics.dashboard?.date_range;
    if (dateRange?.start_date && dateRange?.end_date) {
      return `${formatDateDisplay(dateRange.start_date)} to ${formatDateDisplay(dateRange.end_date)}`;
    }
    return getSelectedPresetLabel();
  };

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const stats = analytics.dashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.first_name}!
          </h1>
          <p className="text-gray-600 mt-1">Here's your business overview</p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center space-x-3">
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
                      {DATE_PERIODS.filter((p) => p.value !== "custom").map((preset) => (
                        <button
                          key={preset.value}
                          onClick={() => handlePresetChange(preset.value)}
                          className={`px-3 py-2 text-sm rounded-lg border transition ${
                            dateFilter.period === preset.value
                              ? "bg-blue-50 border-blue-500 text-blue-700"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
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
                          onChange={(e) => handleDateChange("startDate", e.target.value)}
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
                          onChange={(e) => handleDateChange("endDate", e.target.value)}
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
        </div>
      </div>

      {/* Date Range Display - Shows actual dates from API response */}
      <div className="flex items-center text-sm text-gray-600">
        <Calendar size={16} className="mr-2" />
        <span>Showing data: </span>
        <span className="font-medium ml-1">{getDateRangeDisplay()}</span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats?.total_revenue || 0)}
              </p>
              {stats?.revenue_growth !== null && (
                <div
                  className={`flex items-center mt-2 text-sm ${
                    stats.revenue_growth >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {stats.revenue_growth >= 0 ? (
                    <TrendingUp size={16} className="mr-1" />
                  ) : (
                    <TrendingDown size={16} className="mr-1" />
                  )}
                  {Math.abs(stats.revenue_growth)}% vs last period
                </div>
              )}
            </div>
            <div className="bg-green-500 p-2 mt-8 ml-2 rounded-lg">
              <DollarSign className="text-white" size={14} />
            </div>
          </div>
        </div>

        {/* Outstanding Amount */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Outstanding</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatCurrency(stats?.outstanding_amount || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-2">Unpaid invoices</p>
            </div>
            <div className="bg-yellow-500 p-2 mt-2 ml-2 rounded-lg">
              <Receipt className="text-white" size={14} />
            </div>
          </div>
        </div>

        {/* Lead Conversion Rate */}
        {isSales && (
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Lead Conversion
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {stats?.lead_conversion_rate || 0}%
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {stats?.total_leads || 0} total leads
                </p>
              </div>
              <div className="bg-blue-500 p-3 rounded-lg">
                <Users className="text-white" size={24} />
              </div>
            </div>
          </div>
        )}

        {/* Quote to Invoice Rate */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Quote → Invoice
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {stats?.quote_to_invoice_rate || 0}%
              </p>
              <p className="text-sm text-gray-500 mt-2">Conversion rate</p>
            </div>
            <div className="bg-purple-500 p-3 rounded-lg">
              <FileText className="text-white" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Revenue Trend
          </h2>
          {analytics.revenue?.monthly_revenue?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.revenue.monthly_revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Revenue"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No revenue data for selected period
            </div>
          )}
        </div>

        {/* Sales Pipeline */}
        {isSales && analytics.pipeline && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Sales Pipeline
            </h2>
            {analytics.pipeline.stages?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.pipeline.stages}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="total_value" fill="#3b82f6" name="Total Value" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No pipeline data for selected period
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lead Sources */}
        {isSales && analytics.leads && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Lead Sources
            </h2>
            {analytics.leads.by_source?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.leads.by_source}
                    dataKey="count"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {analytics.leads.by_source.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No lead data for selected period
              </div>
            )}
          </div>
        )}

        {/* Invoice Status */}
        {analytics.invoices && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Status
            </h2>
            {analytics.invoices.by_status?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.invoices.by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {analytics.invoices.by_status.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                No invoice data for selected period
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Stats */}
        {isSales && analytics.pipeline && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Pipeline Overview
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Total Opportunities
                </span>
                <span className="font-semibold text-gray-900">
                  {analytics.pipeline.total_opportunities}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pipeline Value</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(analytics.pipeline.total_pipeline_value)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Weighted Value</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(analytics.pipeline.weighted_pipeline_value)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Deal Size</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(analytics.pipeline.avg_deal_size)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Summary */}
        {analytics.invoices && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Invoices</span>
                <span className="font-semibold text-gray-900">
                  {analytics.invoices.total_invoices}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Value</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(analytics.invoices.total_value)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Avg Invoice</span>
                <span className="font-semibold text-gray-900">
                  {formatCurrency(analytics.invoices.avg_invoice_value)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-red-600">Overdue</span>
                <span className="font-semibold text-red-900">
                  {analytics.invoices.overdue_count} (
                  {formatCurrency(analytics.invoices.overdue_amount)})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="space-y-2">
            {isSales && (
              <>
                <Link
                  to="/leads"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    Create Lead
                  </span>
                  <ArrowUpRight size={16} className="text-gray-400" />
                </Link>
                <Link
                  to="/quotes"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">
                    New Quote
                  </span>
                  <ArrowUpRight size={16} className="text-gray-400" />
                </Link>
              </>
            )}
            <Link
              to="/invoices"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="text-sm font-medium text-gray-700">
                View Invoices
              </span>
              <ArrowUpRight size={16} className="text-gray-400" />
            </Link>
            {["Admin", "Finance"].includes(user?.role) && (
              <Link
                to="/payments"
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">
                  Record Payment
                </span>
                <ArrowUpRight size={16} className="text-gray-400" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;