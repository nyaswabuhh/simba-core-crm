from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.base import get_db
from app.models.user import User
from app.api.dependencies import get_current_active_user
from app.services import analytics_service

router = APIRouter()


@router.get("/dashboard")
def get_dashboard_analytics(
    user_filter: Optional[bool] = Query(False, description="Filter by current user"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get overall dashboard analytics.
    Includes key metrics, conversion rates, and growth indicators.
    """
    user_id = str(current_user.id) if user_filter else None
    return analytics_service.get_dashboard_stats(db, user_id)


@router.get("/sales-pipeline")
def get_sales_pipeline(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get sales pipeline analytics by stage.
    Includes opportunity counts, values, and weighted pipeline.
    """
    return analytics_service.get_sales_pipeline_analytics(db)


@router.get("/leads")
def get_lead_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get lead analytics by source and status.
    Includes conversion rates and value analysis.
    """
    return analytics_service.get_lead_analytics(db)


@router.get("/revenue")
def get_revenue_analytics(
    months: int = Query(12, ge=1, le=24, description="Number of months to analyze"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get revenue analytics over time.
    Includes monthly breakdown, trends, and YTD revenue.
    """
    return analytics_service.get_revenue_analytics(db, months)


@router.get("/invoices")
def get_invoice_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get invoice analytics by status.
    Includes overdue tracking and value distribution.
    """
    return analytics_service.get_invoice_analytics(db)


@router.get("/payments")
def get_payment_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get payment analytics by method.
    Includes payment timing and distribution analysis.
    """
    return analytics_service.get_payment_analytics(db)


@router.get("/top-accounts")
def get_top_accounts(
    limit: int = Query(10, ge=1, le=50, description="Number of top accounts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get top accounts by revenue.
    """
    return analytics_service.get_top_accounts(db, limit)


@router.get("/top-products")
def get_top_products(
    limit: int = Query(10, ge=1, le=50, description="Number of top products"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get top products by sales volume and revenue.
    """
    return analytics_service.get_top_products(db, limit)


@router.get("/conversion-funnel")
def get_conversion_funnel(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get sales conversion funnel metrics.
    Tracks: Leads → Accounts → Opportunities → Quotes → Invoices → Payments
    """
    from app.models.crm import Lead, Account, Opportunity
    from app.models.billing import Quote, Invoice, Payment
    
    total_leads = db.query(Lead).filter(Lead.is_deleted == False).count()
    converted_accounts = db.query(Account).filter(Account.is_deleted == False).count()
    total_opportunities = db.query(Opportunity).filter(Opportunity.is_deleted == False).count()
    total_quotes = db.query(Quote).filter(Quote.is_deleted == False).count()
    total_invoices = db.query(Invoice).filter(Invoice.is_deleted == False).count()
    total_payments = db.query(Payment).count()
    
    return {
        "funnel_stages": [
            {
                "stage": "Leads",
                "count": total_leads,
                "conversion_rate": 100.0
            },
            {
                "stage": "Accounts",
                "count": converted_accounts,
                "conversion_rate": round((converted_accounts / total_leads * 100) if total_leads > 0 else 0, 2)
            },
            {
                "stage": "Opportunities",
                "count": total_opportunities,
                "conversion_rate": round((total_opportunities / converted_accounts * 100) if converted_accounts > 0 else 0, 2)
            },
            {
                "stage": "Quotes",
                "count": total_quotes,
                "conversion_rate": round((total_quotes / total_opportunities * 100) if total_opportunities > 0 else 0, 2)
            },
            {
                "stage": "Invoices",
                "count": total_invoices,
                "conversion_rate": round((total_invoices / total_quotes * 100) if total_quotes > 0 else 0, 2)
            },
            {
                "stage": "Payments",
                "count": total_payments,
                "conversion_rate": round((total_payments / total_invoices * 100) if total_invoices > 0 else 0, 2)
            }
        ],
        "overall_conversion": round((total_payments / total_leads * 100) if total_leads > 0 else 0, 2)
    }


@router.get("/performance/users")
def get_user_performance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get performance metrics by user (sales team).
    """
    from app.models.crm import Lead, Opportunity
    from app.models.billing import Quote, Invoice
    from sqlalchemy import func
    
    users = db.query(User).filter(
        User.is_deleted == False,
        User.role.in_(['Admin', 'Sales'])
    ).all()
    
    user_performance = []
    
    for user in users:
        leads_created = db.query(Lead).filter(Lead.owner_id == user.id).count()
        opps_created = db.query(Opportunity).filter(Opportunity.owner_id == user.id).count()
        quotes_created = db.query(Quote).filter(Quote.owner_id == user.id).count()
        
        revenue = db.query(func.sum(Invoice.amount_paid)).filter(
            Invoice.owner_id == user.id
        ).scalar() or 0
        
        converted_leads = db.query(Lead).filter(
            Lead.owner_id == user.id,
            Lead.is_converted == True
        ).count()
        
        conversion_rate = (converted_leads / leads_created * 100) if leads_created > 0 else 0
        
        user_performance.append({
            "user_id": str(user.id),
            "user_name": user.full_name,
            "leads_created": leads_created,
            "opportunities_created": opps_created,
            "quotes_created": quotes_created,
            "total_revenue": float(revenue),
            "conversion_rate": round(conversion_rate, 2)
        })
    
    total_revenue = sum(u['total_revenue'] for u in user_performance)
    avg_revenue = total_revenue / len(user_performance) if user_performance else 0
    
    return {
        "sales_team": user_performance,
        "total_team_revenue": total_revenue,
        "avg_revenue_per_user": round(avg_revenue, 2)
    }