from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

from app.db.base import get_db
from app.models.user import User
from app.models.crm import Lead, Account, Opportunity
from app.models.billing import Quote, Invoice, Payment
from app.api.dependencies import get_current_active_user
from app.services import analytics_service
from app.utils.date_utils import (
    validate_date_range,
    apply_date_filter,
    build_date_filters,
    format_date_range,
    get_date_range_for_period,
    DateRangeError
)

router = APIRouter()


def parse_period_to_dates(
    period: Optional[str],
    start_date: Optional[date],
    end_date: Optional[date]
) -> tuple[Optional[date], Optional[date]]:
    """
    Parse period preset or use provided dates.
    Period takes precedence if both are provided.
    """
    if period:
        try:
            return get_date_range_for_period(period)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    return start_date, end_date


def validate_dates(start_date: Optional[date], end_date: Optional[date]) -> None:
    """Validate date range and raise HTTP exception if invalid."""
    try:
        validate_date_range(start_date, end_date)
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/dashboard")
def get_dashboard_analytics(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period: last_7_days, last_30_days, this_month, etc."),
    user_filter: Optional[bool] = Query(False, description="Filter by current user"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get overall dashboard analytics.
    Includes key metrics, conversion rates, and growth indicators.
    
    Period options: today, yesterday, this_week, last_week, this_month, last_month,
    this_quarter, last_quarter, this_year, last_year, last_7_days, last_30_days,
    last_90_days, last_365_days
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    user_id = str(current_user.id) if user_filter else None
    return analytics_service.get_dashboard_stats(db, user_id, start_date, end_date)


@router.get("/sales-pipeline")
def get_sales_pipeline(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get sales pipeline analytics by stage.
    Includes opportunity counts, values, and weighted pipeline.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_sales_pipeline_analytics(db, start_date, end_date)


@router.get("/leads")
def get_lead_analytics(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get lead analytics by source and status.
    Includes conversion rates and value analysis.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_lead_analytics(db, start_date, end_date)


@router.get("/revenue")
def get_revenue_analytics(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    months: int = Query(12, ge=1, le=24, description="Number of months to analyze (used if no date range)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get revenue analytics over time.
    Includes monthly breakdown, trends, and YTD revenue.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_revenue_analytics(db, months, start_date, end_date)


@router.get("/invoices")
def get_invoice_analytics(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get invoice analytics by status.
    Includes overdue tracking and value distribution.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_invoice_analytics(db, start_date, end_date)


@router.get("/payments")
def get_payment_analytics(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get payment analytics by method.
    Includes payment timing and distribution analysis.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_payment_analytics(db, start_date, end_date)


@router.get("/top-accounts")
def get_top_accounts(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    limit: int = Query(10, ge=1, le=50, description="Number of top accounts"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get top accounts by revenue.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_top_accounts(db, limit, start_date, end_date)


@router.get("/top-products")
def get_top_products(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    limit: int = Query(10, ge=1, le=50, description="Number of top products"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get top products by sales volume and revenue.
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    return analytics_service.get_top_products(db, limit, start_date, end_date)


@router.get("/conversion-funnel")
def get_conversion_funnel(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get sales conversion funnel metrics.
    Tracks: Leads → Accounts → Opportunities → Quotes → Invoices → Payments
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    # Build date filters for each model
    lead_filters = [Lead.is_deleted == False]
    lead_filters.extend(build_date_filters(Lead, start_date, end_date))
    
    account_filters = [Account.is_deleted == False]
    account_filters.extend(build_date_filters(Account, start_date, end_date))
    
    opp_filters = [Opportunity.is_deleted == False]
    opp_filters.extend(build_date_filters(Opportunity, start_date, end_date))
    
    quote_filters = [Quote.is_deleted == False]
    quote_filters.extend(build_date_filters(Quote, start_date, end_date))
    
    invoice_filters = [Invoice.is_deleted == False]
    invoice_filters.extend(build_date_filters(Invoice, start_date, end_date))
    
    payment_filters = build_date_filters(Payment, start_date, end_date)
    
    # Get counts
    total_leads = db.query(Lead).filter(*lead_filters).count()
    converted_accounts = db.query(Account).filter(*account_filters).count()
    total_opportunities = db.query(Opportunity).filter(*opp_filters).count()
    total_quotes = db.query(Quote).filter(*quote_filters).count()
    total_invoices = db.query(Invoice).filter(*invoice_filters).count()
    
    payment_query = db.query(Payment)
    if payment_filters:
        payment_query = payment_query.filter(*payment_filters)
    total_payments = payment_query.count()
    
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
        "overall_conversion": round((total_payments / total_leads * 100) if total_leads > 0 else 0, 2),
        "date_range": format_date_range(start_date, end_date)
    }


@router.get("/performance/users")
def get_user_performance(
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get performance metrics by user (sales team).
    """
    start_date, end_date = parse_period_to_dates(period, start_date, end_date)
    validate_dates(start_date, end_date)
    
    users = db.query(User).filter(
        User.is_deleted == False,
        User.role.in_(['Admin', 'Sales'])
    ).all()
    
    user_performance = []
    
    for user in users:
        # Build base filters for this user
        lead_filters = [Lead.owner_id == user.id]
        lead_filters.extend(build_date_filters(Lead, start_date, end_date))
        
        opp_filters = [Opportunity.owner_id == user.id]
        opp_filters.extend(build_date_filters(Opportunity, start_date, end_date))
        
        quote_filters = [Quote.owner_id == user.id]
        quote_filters.extend(build_date_filters(Quote, start_date, end_date))
        
        invoice_filters = [Invoice.owner_id == user.id]
        invoice_filters.extend(build_date_filters(Invoice, start_date, end_date))
        
        # Converted leads - filter on converted_date
        converted_filters = [Lead.owner_id == user.id, Lead.is_converted == True]
        converted_filters.extend(build_date_filters(Lead, start_date, end_date, date_field='converted_date'))
        
        # Get counts and revenue
        leads_created = db.query(Lead).filter(*lead_filters).count()
        opps_created = db.query(Opportunity).filter(*opp_filters).count()
        quotes_created = db.query(Quote).filter(*quote_filters).count()
        
        revenue = db.query(func.sum(Invoice.amount_paid)).filter(*invoice_filters).scalar() or Decimal(0)
        converted_leads = db.query(Lead).filter(*converted_filters).count()
        
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
    
    # Sort by revenue descending
    user_performance.sort(key=lambda x: x['total_revenue'], reverse=True)
    
    total_revenue = sum(u['total_revenue'] for u in user_performance)
    avg_revenue = total_revenue / len(user_performance) if user_performance else 0
    
    return {
        "sales_team": user_performance,
        "total_team_revenue": total_revenue,
        "avg_revenue_per_user": round(avg_revenue, 2),
        "team_size": len(user_performance),
        "date_range": format_date_range(start_date, end_date)
    }


@router.get("/summary")
def get_analytics_summary(
    period: str = Query("last_30_days", description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get a comprehensive analytics summary in a single call.
    Useful for dashboard widgets.
    """
    start_date, end_date = parse_period_to_dates(period, None, None)
    
    # Get key metrics
    dashboard = analytics_service.get_dashboard_stats(db, None, start_date, end_date)
    pipeline = analytics_service.get_sales_pipeline_analytics(db, start_date, end_date)
    top_accounts = analytics_service.get_top_accounts(db, 5, start_date, end_date)
    
    return {
        "period": period,
        "date_range": format_date_range(start_date, end_date),
        "key_metrics": {
            "total_leads": dashboard['total_leads'],
            "total_accounts": dashboard['total_accounts'],
            "total_revenue": dashboard['total_revenue'],
            "outstanding_amount": dashboard['outstanding_amount'],
            "lead_conversion_rate": dashboard['lead_conversion_rate'],
            "revenue_growth": dashboard['revenue_growth']
        },
        "pipeline": {
            "total_value": pipeline['total_pipeline_value'],
            "weighted_value": pipeline['weighted_pipeline_value'],
            "total_opportunities": pipeline['total_opportunities'],
            "avg_deal_size": pipeline['avg_deal_size']
        },
        "top_accounts": top_accounts
    }