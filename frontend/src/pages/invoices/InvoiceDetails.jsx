import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../../api/client";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  FileText,
  Building2,
  Calendar,
  User,
  Send,
  Download,
  DollarSign,
  AlertCircle,
  CheckCircle,
  XCircle,
  CreditCard,
  Receipt,
} from "lucide-react";
import RecordPaymentModal from "../../components/modals/RecordPaymentModal";

function InvoiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [account, setAccount] = useState(null);
  const [contact, setContact] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadInvoice();
    }
  }, [id]);

  const loadInvoice = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/invoices/${id}`);
      setInvoice(response.data);

      // Load associated account
      if (response.data.account_id) {
        try {
          const accountResponse = await apiClient.get(
            `/accounts/${response.data.account_id}`
          );
          setAccount(accountResponse.data);
        } catch (error) {
          console.warn("Could not load account:", error);
        }
      }

      // Load associated contact
      if (response.data.contact_id) {
        try {
          const contactResponse = await apiClient.get(
            `/contacts/${response.data.contact_id}`
          );
          setContact(contactResponse.data);
        } catch (error) {
          console.warn("Could not load contact:", error);
        }
      }

      // Load associated quote if exists
      if (response.data.quote_id) {
        try {
          const quoteResponse = await apiClient.get(
            `/quotes/${response.data.quote_id}`
          );
          setQuote(quoteResponse.data);
        } catch (error) {
          console.warn("Could not load quote:", error);
        }
      }
    } catch (error) {
      toast.error("Failed to load invoice details");
      console.error("Error loading invoice:", error);
      if (error.response?.status === 404) {
        setTimeout(() => navigate("/invoices"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvoice = async () => {
    try {
      setActionLoading(true);
      await apiClient.post(`/invoices/${id}/send`);
      toast.success("Invoice sent successfully");
      await loadInvoice();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to send invoice");
      console.error("Error sending invoice:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setActionLoading(true);
      const response = await apiClient.get(`/invoices/${id}/pdf`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully");
    } catch (error) {
      toast.error("Failed to download PDF");
      console.error("Error downloading PDF:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    loadInvoice();
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      Draft: "badge badge-gray",
      Sent: "badge badge-info",
      Unpaid: "badge badge-warning",
      Partial: "badge badge-warning",
      Paid: "badge badge-success",
      Overdue: "badge badge-danger",
      Cancelled: "badge badge-gray",
    };
    return classes[status] || "badge badge-gray";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "-";
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return "Ksh 0.00";

    return `Ksh ${Number(value).toLocaleString("en-KE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const isOverdue = () => {
    if (!invoice) return false;
    if (invoice.status === "Paid" || invoice.status === "Cancelled")
      return false;
    return new Date(invoice.due_date) < new Date();
  };

  const canSend = invoice?.status === "Draft";
  const canRecordPayment =
    invoice?.status !== "Paid" &&
    invoice?.status !== "Cancelled" &&
    invoice?.amount_due > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">Invoice not found</p>
        <Link
          to="/invoices"
          className="text-blue-600 hover:text-blue-800 mt-4 inline-block"
        >
          Back to Invoices
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
            to="/invoices"
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {invoice.invoice_number}
            </h1>
            {account && (
              <Link
                to={`/accounts/${invoice.account_id}`}
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
            onClick={handleDownloadPDF}
            disabled={actionLoading}
            className="btn btn-secondary flex items-center"
          >
            <Download size={18} className="mr-2" />
            {actionLoading ? "Downloading..." : "Download PDF"}
          </button>
          {canSend && (
            <button
              onClick={handleSendInvoice}
              disabled={actionLoading}
              className="btn btn-primary flex items-center"
            >
              <Send size={18} className="mr-2" />
              {actionLoading ? "Sending..." : "Send Invoice"}
            </button>
          )}
          {canRecordPayment && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn btn-primary bg-green-600 hover:bg-green-700 flex items-center"
            >
              <CreditCard size={18} className="mr-2" />
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Status & Alert */}
      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          <span className={getStatusBadgeClass(invoice.status)}>
            {invoice.status}
          </span>
          {invoice.paid_date && (
            <span className="text-sm text-gray-600">
              Paid on {formatDate(invoice.paid_date)}
            </span>
          )}
        </div>

        {isOverdue() && (
          <div className="card bg-red-50 border-red-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="text-red-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-red-900">
                  Invoice Overdue
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  This invoice was due on {formatDate(invoice.due_date)}.
                  Outstanding amount: {formatCurrency(invoice.amount_due)}
                </p>
              </div>
            </div>
          </div>
        )}

        {quote && (
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-start space-x-3">
              <Receipt className="text-blue-600 mt-0.5" size={20} />
              <div>
                <h3 className="text-sm font-semibold text-blue-900">
                  Created from Quote
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  This invoice was created from{" "}
                  <Link
                    to={`/quotes/${quote.id}`}
                    className="underline font-medium"
                  >
                    {quote.quote_number}
                  </Link>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Information */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Invoice Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Building2 className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Account</p>
                  <Link
                    to={`/accounts/${invoice.account_id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {account?.name || "Loading..."}
                  </Link>
                </div>
              </div>

              {contact && (
                <div className="flex items-start space-x-3">
                  <User className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-sm text-gray-600">Contact</p>
                    <Link
                      to={`/contacts/${invoice.contact_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {contact.first_name} {contact.last_name}
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Issue Date</p>
                  <p className="text-gray-900">
                    {formatDate(invoice.issue_date)}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="text-gray-400 mt-1" size={20} />
                <div>
                  <p className="text-sm text-gray-600">Due Date</p>
                  <p
                    className={`font-medium ${
                      isOverdue() ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {formatDate(invoice.due_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Items */}
          <div className="card p-0">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Invoice Items
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Discount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {invoice.items && invoice.items.length > 0 ? (
                    invoice.items.map((item, index) => (
                      <tr key={item.id || index}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.description || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                          {item.discount_percentage || 0}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">
                      {formatCurrency(invoice.subtotal)}
                    </span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Discount
                        {invoice.discount_type === "percentage" &&
                        invoice.discount_value
                          ? ` (${invoice.discount_value}%)`
                          : ""}
                        :
                      </span>
                      <span className="text-red-600">
                        -{formatCurrency(invoice.discount_amount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Tax ({invoice.tax_rate || 0}%):
                    </span>
                    <span className="text-gray-900">
                      {formatCurrency(invoice.tax_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-gray-900">
                      {formatCurrency(invoice.total_amount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600 font-semibold">
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(invoice.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Amount Due:</span>
                    <span
                      className={
                        invoice.amount_due > 0
                          ? "text-red-600"
                          : "text-green-600"
                      }
                    >
                      {formatCurrency(invoice.amount_due)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <div className="card p-0">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Payment History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Payment #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Reference
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoice.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(payment.payment_date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {payment.payment_number}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.payment_method}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.reference_number || "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                          {formatCurrency(payment.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`badge ${
                              payment.status === "Completed"
                                ? "badge-success"
                                : "badge-warning"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms_conditions) && (
            <div className="card">
              {invoice.notes && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Notes
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {invoice.notes}
                  </p>
                </div>
              )}
              {invoice.terms_conditions && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Terms & Conditions
                  </h3>
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {invoice.terms_conditions}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Summary & Info */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Payment Summary
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="text-gray-900 font-medium mt-1">
                  {invoice.status}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {formatCurrency(invoice.total_amount)}
                </p>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-gray-600">Paid</span>
                  <span className="text-sm font-semibold text-green-600">
                    {formatCurrency(invoice.amount_paid)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Outstanding</span>
                  <span
                    className={`text-sm font-semibold ${
                      invoice.amount_due > 0 ? "text-red-600" : "text-gray-600"
                    }`}
                  >
                    {formatCurrency(invoice.amount_due)}
                  </span>
                </div>
              </div>
              {invoice.amount_due > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        (invoice.amount_paid / invoice.total_amount) * 100
                      }%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Invoice Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Details
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Invoice ID</p>
                <p className="text-xs text-gray-900 font-mono mt-1 break-all">
                  {invoice.id}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Invoice Number</p>
                <p className="text-gray-900 mt-1">{invoice.invoice_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Issue Date</p>
                <p className="text-gray-900 mt-1">
                  {formatDate(invoice.issue_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due Date</p>
                <p
                  className={`mt-1 ${
                    isOverdue() ? "text-red-600 font-semibold" : "text-gray-900"
                  }`}
                >
                  {formatDate(invoice.due_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="text-gray-900 mt-1">
                  {formatDate(invoice.created_at)}
                </p>
              </div>
              {invoice.updated_at && (
                <div>
                  <p className="text-sm text-gray-600">Last Updated</p>
                  <p className="text-gray-900 mt-1">
                    {formatDate(invoice.updated_at)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

export default InvoiceDetails;
