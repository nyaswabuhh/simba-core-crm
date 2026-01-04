import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Auth
import Login from './pages/auth/Login';
import ProtectedRoute from './components/ProtectedRoute';

// Layout
import DashboardLayout from './components/layout/DashboardLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import LeadList from './pages/leads/LeadList';
import TestModal from './pages/leads/TestModal';
import LeadDetails from './pages/leads/LeadDetails';

import AccountList from './pages/accounts/AccountList';
import AccountDetails from './pages/accounts/AccountDetails';
import OpportunityList from './pages/opportunities/OpportunityList';
import OpportunityDetails from './pages/opportunities/OpportunityDetails';
import ProductList from './pages/products/ProductList';
import ProductDetails from './pages/products/ProductDetails';
import QuoteList from './pages/quotes/QuoteList';
import QuoteDetails from './pages/quotes/QuoteDetails';
import InvoiceList from './pages/invoices/InvoiceList';
import InvoiceDetails from './pages/invoices/InvoiceDetails';
import PaymentsList from './pages/payments/PaymentsList';
import PaymentDetails from './pages/payments/PaymentDetails';
import ContactsList from './pages/contacts/ContactList';
import ContactDetails from './pages/contacts/ContactDetail';
function App() {
  const { checkAuth, isLoading } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                
                {/* Leads */}
                <Route path="/leads" element={<LeadList />} />
                <Route path='/leads/:id' element={<LeadDetails />} />

                <Route path='/test' element={<TestModal />} />

                {/* Accounts */}
                <Route path="/accounts" element={<AccountList />} />
                <Route path="/accounts/:id" element={<AccountDetails />} />

                {/* Contacts */}
                <Route path='/contacts'  element={<ContactsList />} />
                <Route path='/contacts/:id' element={<ContactDetails />} />

                {/* Opportunities */}
                <Route path="/opportunities" element={<OpportunityList />} />
                <Route path="/opportunities/:id" element={<OpportunityDetails />} />

                {/* Products */}
                <Route path="/products"  element={<ProductList />} />
                <Route path="/products/:id"  element={<ProductDetails />}/>

                {/* Quotes */}
                <Route path='/quotes' element={<QuoteList />} />
                <Route path='/quotes/:id' element={<QuoteDetails />} />

                {/* Invoices */}
                <Route path='/invoices'  element={<InvoiceList />} />
                <Route path='/invoices/:id' element={<InvoiceDetails />} />

                {/* Payments */}
                <Route path='/payments' element={<PaymentsList />} />
                <Route path="/payments/:id" element={<PaymentDetails />} />
                
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;