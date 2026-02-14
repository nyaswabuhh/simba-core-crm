from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Optional, List

from app.models.crm import Lead, Account, Opportunity, OpportunityStage, LeadStatus
from app.models.billing import Quote, Invoice, Payment, InvoiceStatus, QuoteStatus
from app.models.user import User
from app.utils.date_utils import (
    validate_date_range,
    to_datetime_range,
    apply_date_filter,
    apply_date_filter_raw,
    build_date_filters,
    get_comparison_periods,
    calculate_growth_rate,
    format_date_range,
    DateRangeError
)


def get_dashboard_stats(
    db: Session, 
    user_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get overall dashboard statistics"""
    validate_date_range(start_date, end_date)
    
    # Lead stats
    lead_query = db.query(Lead).filter(Lead.is_deleted == False)
    if user_id:
        lead_query = lead_query.filter(Lead.owner_id == user_id)
    lead_query = apply_date_filter(lead_query, Lead, start_date, end_date)
    
    total_leads = lead_query.count()
    converted_leads = lead_query.filter(Lead.is_converted == True).count()
    
    # Account stats
    account_query = db.query(Account).filter(Account.is_deleted == False)
    if user_id:
        account_query = account_query.filter(Account.owner_id == user_id)
    account_query = apply_date_filter(account_query, Account, start_date, end_date)
    total_accounts = account_query.count()
    
    # Opportunity stats
    opp_query = db.query(Opportunity).filter(Opportunity.is_deleted == False)
    if user_id:
        opp_query = opp_query.filter(Opportunity.owner_id == user_id)
    opp_query = apply_date_filter(opp_query, Opportunity, start_date, end_date)
    total_opportunities = opp_query.count()
    
    # Quote stats
    quote_query = db.query(Quote).filter(Quote.is_deleted == False)
    if user_id:
        quote_query = quote_query.filter(Quote.owner_id == user_id)
    quote_query = apply_date_filter(quote_query, Quote, start_date, end_date)
    total_quotes = quote_query.count()
    approved_quotes = quote_query.filter(Quote.status == QuoteStatus.APPROVED).count()
    
    # Invoice stats
    invoice_query = db.query(Invoice).filter(Invoice.is_deleted == False)
    if user_id:
        invoice_query = invoice_query.filter(Invoice.owner_id == user_id)
    invoice_query = apply_date_filter(invoice_query, Invoice, start_date, end_date)
    total_invoices = invoice_query.count()
    
    # Financial metrics
    revenue_query = db.query(func.sum(Invoice.amount_paid)).filter(Invoice.is_deleted == False)
    revenue_query = apply_date_filter(revenue_query, Invoice, start_date, end_date)
    total_revenue = revenue_query.scalar() or Decimal(0)
    
    outstanding_query = db.query(func.sum(Invoice.amount_due)).filter(
        Invoice.is_deleted == False,
        Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL, InvoiceStatus.DRAFT])
    )
    outstanding_query = apply_date_filter(outstanding_query, Invoice, start_date, end_date)
    outstanding_amount = outstanding_query.scalar() or Decimal(0)
    
    paid_query = db.query(func.sum(Invoice.amount_paid)).filter(
        Invoice.is_deleted == False,
        Invoice.status == InvoiceStatus.PAID
    )
    paid_query = apply_date_filter(paid_query, Invoice, start_date, end_date)
    paid_amount = paid_query.scalar() or Decimal(0)
    
    # Conversion rates
    lead_conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0
    quote_to_invoice_rate = (total_invoices / total_quotes * 100) if total_quotes > 0 else 0
    
    # Period comparison
    periods = get_comparison_periods(start_date, end_date)
    
    current_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_date >= periods['current']['start'],
        Payment.payment_date <= periods['current']['end']
    ).scalar() or Decimal(0)
    
    previous_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_date >= periods['previous']['start'],
        Payment.payment_date <= periods['previous']['end']
    ).scalar() or Decimal(0)
    
    current_leads_count = db.query(Lead).filter(
        Lead.created_at >= periods['current']['start'],
        Lead.created_at <= periods['current']['end']
    ).count()
    
    previous_leads_count = db.query(Lead).filter(
        Lead.created_at >= periods['previous']['start'],
        Lead.created_at <= periods['previous']['end']
    ).count()
    
    revenue_growth = calculate_growth_rate(current_revenue, previous_revenue)
    leads_growth = calculate_growth_rate(Decimal(current_leads_count), Decimal(previous_leads_count))
    
    return {
        'total_leads': total_leads,
        'total_accounts': total_accounts,
        'total_opportunities': total_opportunities,
        'total_quotes': total_quotes,
        'total_invoices': total_invoices,
        'total_revenue': float(total_revenue),
        'outstanding_amount': float(outstanding_amount),
        'paid_amount': float(paid_amount),
        'lead_conversion_rate': round(lead_conversion_rate, 2),
        'quote_to_invoice_rate': round(quote_to_invoice_rate, 2),
        'revenue_growth': round(revenue_growth, 2) if revenue_growth else None,
        'leads_growth': round(leads_growth, 2) if leads_growth else None,
        'date_range': format_date_range(start_date, end_date)
    }


def get_sales_pipeline_analytics(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get sales pipeline analytics by stage"""
    validate_date_range(start_date, end_date)
    
    query = db.query(
        Opportunity.stage,
        func.count(Opportunity.id).label('count'),
        func.sum(Opportunity.amount).label('total_value'),
        func.avg(Opportunity.amount).label('avg_value')
    ).filter(Opportunity.is_deleted == False)
    
    query = apply_date_filter(query, Opportunity, start_date, end_date)
    stages = query.group_by(Opportunity.stage).all()
    
    stage_data = []
    total_value = Decimal(0)
    weighted_value = Decimal(0)
    
    probability_map = {
        OpportunityStage.PROSPECTING: 0.10,
        OpportunityStage.QUALIFICATION: 0.25,
        OpportunityStage.PROPOSAL: 0.50,
        OpportunityStage.NEGOTIATION: 0.75,
        OpportunityStage.CLOSED_WON: 1.0,
        OpportunityStage.CLOSED_LOST: 0.0
    }
    
    for stage in stages:
        stage_total = stage.total_value or Decimal(0)
        stage_avg = stage.avg_value or Decimal(0)
        total_value += stage_total
        
        probability = probability_map.get(stage.stage, 0.25)
        weighted_value += stage_total * Decimal(probability)
        
        stage_data.append({
            'stage': stage.stage.value,
            'count': stage.count,
            'total_value': float(stage_total),
            'avg_value': float(stage_avg)
        })
    
    total_opps = sum(s['count'] for s in stage_data)
    avg_deal = float(total_value / total_opps) if total_opps > 0 else 0
    
    return {
        'stages': stage_data,
        'total_opportunities': total_opps,
        'total_pipeline_value': float(total_value),
        'avg_deal_size': round(avg_deal, 2),
        'weighted_pipeline_value': float(weighted_value),
        'date_range': format_date_range(start_date, end_date)
    }


def get_lead_analytics(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get lead analytics by source and status"""
    validate_date_range(start_date, end_date)
    
    base_filter = [Lead.is_deleted == False]
    base_filter.extend(build_date_filters(Lead, start_date, end_date))
    
    # By source
    by_source = db.query(
        Lead.source,
        func.count(Lead.id).label('count'),
        func.sum(case((Lead.is_converted == True, 1), else_=0)).label('converted'),
        func.avg(Lead.estimated_value).label('avg_value')
    ).filter(*base_filter).group_by(Lead.source).all()
    
    source_data = []
    for source in by_source:
        conversion_rate = (source.converted / source.count * 100) if source.count > 0 else 0  # type: ignore
        source_data.append({
            'source': source.source.value if source.source else 'Unknown',
            'count': source.count,
            'conversion_rate': round(conversion_rate, 2),
            'avg_value': float(source.avg_value or 0)
        })
    
    # By status
    by_status = db.query(
        Lead.status,
        func.count(Lead.id).label('count')
    ).filter(*base_filter).group_by(Lead.status).all()
    
    status_data = [{'status': s.status.value, 'count': s.count} for s in by_status]
    
    total_leads = db.query(Lead).filter(*base_filter).count()
    converted = db.query(Lead).filter(*base_filter, Lead.is_converted == True).count()
    
    return {
        'by_source': source_data,
        'by_status': status_data,
        'total_leads': total_leads,
        'converted_leads': converted,
        'conversion_rate': round((converted / total_leads * 100) if total_leads > 0 else 0, 2),
        'date_range': format_date_range(start_date, end_date)
    }


def get_revenue_analytics(
    db: Session, 
    months: int = 12,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get revenue analytics over time"""
    validate_date_range(start_date, end_date)
    
    # Use provided dates or default to last N months
    if start_date and end_date:
        query_start, query_end = to_datetime_range(start_date, end_date)
    else:
        query_end = datetime.utcnow()
        query_start = query_end - timedelta(days=months * 30)
    
    # Monthly revenue
    monthly_data = db.query(
        func.to_char(Invoice.issue_date, 'YYYY-MM').label('month'),
        func.sum(Invoice.total_amount).label('revenue'),
        func.count(Invoice.id).label('count'),
        func.sum(case((Invoice.status == InvoiceStatus.PAID, 1), else_=0)).label('paid')
    ).filter(Invoice.is_deleted == False)
    
    monthly_data = apply_date_filter_raw(
        monthly_data, 
        Invoice.issue_date,
        query_start.date() if isinstance(query_start, datetime) else query_start,
        query_end.date() if isinstance(query_end, datetime) else query_end
    )
    
    monthly_data = monthly_data.group_by('month').order_by('month').all()
    
    monthly_revenue = []
    total_revenue = Decimal(0)
    
    for month in monthly_data:
        revenue = month.revenue or Decimal(0)
        total_revenue += revenue
        avg_invoice = float(revenue / month.count) if month.count > 0 else 0  # type: ignore
        
        monthly_revenue.append({
            'month': month.month,
            'revenue': float(revenue),
            'invoices_count': month.count,
            'paid_invoices': month.paid,
            'average_invoice': round(avg_invoice, 2)
        })
    
    # Calculate trend
    if len(monthly_revenue) >= 2:
        last_month = monthly_revenue[-1]['revenue']
        prev_month = monthly_revenue[-2]['revenue']
        if last_month > prev_month * 1.05:
            trend = "up"
        elif last_month < prev_month * 0.95:
            trend = "down"
        else:
            trend = "stable"
    else:
        trend = "stable"
    
    # YTD revenue
    if start_date and end_date:
        ytd_revenue = total_revenue
    else:
        ytd_revenue = db.query(func.sum(Invoice.total_amount)).filter(
            Invoice.is_deleted == False,
            extract('year', Invoice.issue_date) == datetime.utcnow().year
        ).scalar() or Decimal(0)
    
    avg_monthly = float(total_revenue / len(monthly_revenue)) if monthly_revenue else 0
    
    # Determine actual date range used
    actual_start = start_date if start_date else (query_start.date() if isinstance(query_start, datetime) else query_start)
    actual_end = end_date if end_date else (query_end.date() if isinstance(query_end, datetime) else query_end)
    
    return {
        'monthly_revenue': monthly_revenue,
        'total_revenue': float(total_revenue),
        'ytd_revenue': float(ytd_revenue),
        'avg_monthly_revenue': round(avg_monthly, 2),
        'revenue_trend': trend,
        'date_range': format_date_range(actual_start, actual_end)
    }


def get_invoice_analytics(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get invoice analytics by status"""
    validate_date_range(start_date, end_date)
    
    base_filter = [Invoice.is_deleted == False]
    base_filter.extend(build_date_filters(Invoice, start_date, end_date))
    
    by_status = db.query(
        Invoice.status,
        func.count(Invoice.id).label('count'),
        func.sum(Invoice.total_amount).label('total')
    ).filter(*base_filter).group_by(Invoice.status).all()
    
    total_invoices = sum(s.count for s in by_status)  # type: ignore
    total_value = sum(s.total or Decimal(0) for s in by_status)
    
    status_data = []
    for status in by_status:
        amount = status.total or Decimal(0)
        percentage = (status.count / total_invoices * 100) if total_invoices > 0 else 0
        status_data.append({
            'status': status.status.value,
            'count': status.count,
            'total_amount': float(amount),
            'percentage': round(percentage, 2)
        })
    
    # Overdue invoices
    today = datetime.utcnow()
    overdue_filter = base_filter + [
        Invoice.due_date < today,
        Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL])
    ]
    overdue = db.query(
        func.count(Invoice.id).label('count'),
        func.sum(Invoice.amount_due).label('amount')
    ).filter(*overdue_filter).first()
    
    avg_value = float(total_value / total_invoices) if total_invoices > 0 else 0
    
    return {
        'by_status': status_data,
        'total_invoices': total_invoices,
        'total_value': float(total_value),
        'avg_invoice_value': round(avg_value, 2),
        'overdue_count': overdue.count or 0,  # type: ignore
        'overdue_amount': float(overdue.amount or 0),  # type: ignore
        'date_range': format_date_range(start_date, end_date)
    }


def get_payment_analytics(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """Get payment analytics"""
    validate_date_range(start_date, end_date)
    
    date_filters = build_date_filters(Payment, start_date, end_date, date_field='payment_date')
    
    query = db.query(
        Payment.payment_method,
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('total')
    )
    
    if date_filters:
        query = query.filter(*date_filters)
    
    by_method = query.group_by(Payment.payment_method).all()
    
    total_payments = sum(m.count for m in by_method)  # type: ignore
    total_amount = sum(m.total or Decimal(0) for m in by_method)
    
    method_data = []
    for method in by_method:
        amount = method.total or Decimal(0)
        percentage = (amount / total_amount * 100) if total_amount > 0 else 0
        method_data.append({
            'method': method.payment_method.value,
            'count': method.count,
            'total_amount': float(amount),
            'percentage': round(percentage, 2)
        })
    
    avg_payment = float(total_amount / total_payments) if total_payments > 0 else 0
    
    # Average days to payment
    avg_days_query = db.query(
        func.avg(func.extract('day', Payment.payment_date - Invoice.issue_date))
    ).join(Invoice).filter(Payment.status == 'Completed')
    
    if date_filters:
        avg_days_query = avg_days_query.filter(*date_filters)
    
    avg_days = avg_days_query.scalar()
    
    return {
        'by_method': method_data,
        'total_payments': total_payments,
        'total_amount': float(total_amount),
        'avg_payment': round(avg_payment, 2),
        'avg_days_to_payment': round(float(avg_days), 1) if avg_days else None,
        'date_range': format_date_range(start_date, end_date)
    }


def get_top_accounts(
    db: Session, 
    limit: int = 10,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[dict]:
    """Get top accounts by revenue"""
    validate_date_range(start_date, end_date)
    
    query = db.query(
        Account.id,
        Account.name,
        func.sum(Invoice.amount_paid).label('revenue'),
        func.count(Invoice.id).label('invoice_count'),
        func.avg(Invoice.total_amount).label('avg_invoice')
    ).join(Invoice, Invoice.account_id == Account.id).filter(
        Account.is_deleted == False,
        Invoice.is_deleted == False
    )
    
    query = apply_date_filter(query, Invoice, start_date, end_date)
    
    top_accounts = query.group_by(Account.id, Account.name).order_by(
        func.sum(Invoice.amount_paid).desc()
    ).limit(limit).all()
    
    return [{
        'account_id': str(acc.id),
        'account_name': acc.name,
        'total_revenue': float(acc.revenue or 0),
        'invoice_count': acc.invoice_count,
        'avg_invoice': float(acc.avg_invoice or 0)
    } for acc in top_accounts]


def get_top_products(
    db: Session, 
    limit: int = 10,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> List[dict]:
    """Get top products by sales"""
    from app.models.billing import Product, InvoiceItem
    
    validate_date_range(start_date, end_date)
    
    query = db.query(
        Product.id,
        Product.name,
        func.sum(InvoiceItem.quantity).label('quantity'),
        func.sum(InvoiceItem.total).label('revenue'),
        func.count(func.distinct(InvoiceItem.invoice_id)).label('invoice_count')
    ).join(InvoiceItem).filter(Product.is_deleted == False)
    
    # Apply date filters via invoice
    if start_date or end_date:
        query = query.join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        query = apply_date_filter(query, Invoice, start_date, end_date)
    
    top_products = query.group_by(Product.id, Product.name).order_by(
        func.sum(InvoiceItem.total).desc()
    ).limit(limit).all()
    
    return [{
        'product_id': str(prod.id),
        'product_name': prod.name,
        'quantity_sold': int(prod.quantity or 0),
        'revenue': float(prod.revenue or 0),
        'invoice_count': prod.invoice_count
    } for prod in top_products]