from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, users, leads, accounts, contacts, opportunities,
    products, quotes, invoices, payments, analytics
)

api_router = APIRouter()

# Authentication
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# User Management
api_router.include_router(users.router, prefix="/users", tags=["Users"])

# CRM
api_router.include_router(leads.router, prefix="/leads", tags=["Leads"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["Contacts"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["Opportunities"])

# Products & Services
api_router.include_router(products.router, prefix="/products", tags=["Products"])

# Sales & Billing
api_router.include_router(quotes.router, prefix="/quotes", tags=["Quotes"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["Invoices"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])

# Analytics & Reporting
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])