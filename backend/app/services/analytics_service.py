from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract, and_, or_
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional, List
from app.models.crm import Lead, Account, Opportunity, OpportunityStage, LeadStatus
from app.models.billing import Quote, Invoice, Payment, InvoiceStatus, QuoteStatus
from app.models.user import User


def get_dashboard_stats(db: Session, user_id: Optional[str] = None) -> dict:
    """Get overall dashboard statistics"""
    
    # Lead stats
    lead_query = db.query(Lead).filter(Lead.is_deleted == False)
    if user_id:
        lead_query = lead_query.filter(Lead.owner_id == user_id)
    
    total_leads = lead_query.count()
    converted_leads = lead_query.filter(Lead.is_converted == True).count()
    
    # Account stats
    account_query = db.query(Account).filter(Account.is_deleted == False)
    if user_id:
        account_query = account_query.filter(Account.owner_id == user_id)
    total_accounts = account_query.count()
    
    # Opportunity stats
    opp_query = db.query(Opportunity).filter(Opportunity.is_deleted == False)
    if user_id:
        opp_query = opp_query.filter(Opportunity.owner_id == user_id)
    total_opportunities = opp_query.count()
    
    # Quote stats
    quote_query = db.query(Quote).filter(Quote.is_deleted == False)
    if user_id:
        quote_query = quote_query.filter(Quote.owner_id == user_id)
    total_quotes = quote_query.count()
    approved_quotes = quote_query.filter(Quote.status == QuoteStatus.APPROVED).count()
    
    # Invoice stats
    invoice_query = db.query(Invoice).filter(Invoice.is_deleted == False)
    if user_id:
        invoice_query = invoice_query.filter(Invoice.owner_id == user_id)
    
    total_invoices = invoice_query.count()
    
    # Financial metrics
    total_revenue = db.query(func.sum(Invoice.amount_paid)).filter(
        Invoice.is_deleted == False
    ).scalar() or Decimal(0)
    
    outstanding_amount = db.query(func.sum(Invoice.amount_due)).filter(
        Invoice.is_deleted == False,
        Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL])
    ).scalar() or Decimal(0)
    
    paid_amount = db.query(func.sum(Invoice.amount_paid)).filter(
        Invoice.is_deleted == False,
        Invoice.status == InvoiceStatus.PAID
    ).scalar() or Decimal(0)
    
    # Conversion rates
    lead_conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0
    quote_to_invoice_rate = (total_invoices / total_quotes * 100) if total_quotes > 0 else 0
    
    # Period comparison (last 30 days vs previous 30 days)
    today = datetime.utcnow()
    last_30_days = today - timedelta(days=30)
    previous_60_days = today - timedelta(days=60)
    
    current_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_date >= last_30_days
    ).scalar() or Decimal(0)
    
    previous_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.payment_date >= previous_60_days,
        Payment.payment_date < last_30_days
    ).scalar() or Decimal(0)
    
    revenue_growth = None
    if previous_revenue > 0:
        revenue_growth = float((current_revenue - previous_revenue) / previous_revenue * 100)
    
    current_leads = db.query(Lead).filter(
        Lead.created_at >= last_30_days
    ).count()
    
    previous_leads = db.query(Lead).filter(
        Lead.created_at >= previous_60_days,
        Lead.created_at < last_30_days
    ).count()
    
    leads_growth = None
    if previous_leads > 0:
        leads_growth = float((current_leads - previous_leads) / previous_leads * 100)
    
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
        'leads_growth': round(leads_growth, 2) if leads_growth else None
    }


def get_sales_pipeline_analytics(db: Session) -> dict:
    """Get sales pipeline analytics by stage"""
    
    stages = db.query(
        Opportunity.stage,
        func.count(Opportunity.id).label('count'),
        func.sum(Opportunity.amount).label('total_value'),
        func.avg(Opportunity.amount).label('avg_value')
    ).filter(
        Opportunity.is_deleted == False
    ).group_by(Opportunity.stage).all()
    
    stage_data = []
    total_value = Decimal(0)
    weighted_value = Decimal(0)
    
    for stage in stages:
        stage_total = stage.total_value or Decimal(0)
        stage_avg = stage.avg_value or Decimal(0)
        total_value += stage_total
        
        # Calculate weighted value based on stage probability
        probability_map = {
            OpportunityStage.PROSPECTING: 0.10,
            OpportunityStage.QUALIFICATION: 0.25,
            OpportunityStage.PROPOSAL: 0.50,
            OpportunityStage.NEGOTIATION: 0.75,
            OpportunityStage.CLOSED_WON: 1.0,
            OpportunityStage.CLOSED_LOST: 0.0
        }
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
        'weighted_pipeline_value': float(weighted_value)
    }


def get_lead_analytics(db: Session) -> dict:
    """Get lead analytics by source and status"""
    
    # By source
    by_source = db.query(
        Lead.source,
        func.count(Lead.id).label('count'),
        func.sum(case((Lead.is_converted == True, 1), else_=0)).label('converted'),
        func.avg(Lead.estimated_value).label('avg_value')
    ).filter(
        Lead.is_deleted == False
    ).group_by(Lead.source).all()
    
    source_data = []
    for source in by_source:
        conversion_rate = (source.converted / source.count * 100) if source.count > 0 else 0 # type: ignore
        source_data.append({
            'source': source.source.value,
            'count': source.count,
            'conversion_rate': round(conversion_rate, 2),
            'avg_value': float(source.avg_value or 0)
        })
    
    # By status
    by_status = db.query(
        Lead.status,
        func.count(Lead.id).label('count')
    ).filter(
        Lead.is_deleted == False
    ).group_by(Lead.status).all()
    
    status_data = [{'status': s.status.value, 'count': s.count} for s in by_status]
    
    total_leads = db.query(Lead).filter(Lead.is_deleted == False).count()
    converted = db.query(Lead).filter(Lead.is_deleted == False, Lead.is_converted == True).count()
    
    return {
        'by_source': source_data,
        'by_status': status_data,
        'total_leads': total_leads,
        'converted_leads': converted,
        'conversion_rate': round((converted / total_leads * 100) if total_leads > 0 else 0, 2)
    }


def get_revenue_analytics(db: Session, months: int = 12) -> dict:
    """Get revenue analytics over time"""
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months * 30)
    
    # Monthly revenue
    monthly_data = db.query(
        func.to_char(Invoice.issue_date, 'YYYY-MM').label('month'),
        func.sum(Invoice.total_amount).label('revenue'),
        func.count(Invoice.id).label('count'),
        func.sum(case((Invoice.status == InvoiceStatus.PAID, 1), else_=0)).label('paid')
    ).filter(
        Invoice.is_deleted == False,
        Invoice.issue_date >= start_date
    ).group_by('month').order_by('month').all()
    
    monthly_revenue = []
    total_revenue = Decimal(0)
    
    for month in monthly_data:
        revenue = month.revenue or Decimal(0)
        total_revenue += revenue
        avg_invoice = float(revenue / month.count) if month.count > 0 else 0 # type: ignore
        
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
    
    ytd_revenue = db.query(func.sum(Invoice.total_amount)).filter(
        Invoice.is_deleted == False,
        extract('year', Invoice.issue_date) == end_date.year
    ).scalar() or Decimal(0)
    
    avg_monthly = float(total_revenue / len(monthly_revenue)) if monthly_revenue else 0
    
    return {
        'monthly_revenue': monthly_revenue,
        'total_revenue': float(total_revenue),
        'ytd_revenue': float(ytd_revenue),
        'avg_monthly_revenue': round(avg_monthly, 2),
        'revenue_trend': trend
    }


def get_invoice_analytics(db: Session) -> dict:
    """Get invoice analytics by status"""
    
    by_status = db.query(
        Invoice.status,
        func.count(Invoice.id).label('count'),
        func.sum(Invoice.total_amount).label('total')
    ).filter(
        Invoice.is_deleted == False
    ).group_by(Invoice.status).all()
    
    total_invoices = sum(s.count for s in by_status) # type: ignore
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
    overdue = db.query(
        func.count(Invoice.id).label('count'),
        func.sum(Invoice.amount_due).label('amount')
    ).filter(
        Invoice.is_deleted == False,
        Invoice.due_date < today,
        Invoice.status.in_([InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL])
    ).first()
    
    avg_value = float(total_value / total_invoices) if total_invoices > 0 else 0
    
    return {
        'by_status': status_data,
        'total_invoices': total_invoices,
        'total_value': float(total_value),
        'avg_invoice_value': round(avg_value, 2),
        'overdue_count': overdue.count or 0, # type: ignore
        'overdue_amount': float(overdue.amount or 0) # type: ignore
    }


def get_payment_analytics(db: Session) -> dict:
    """Get payment analytics"""
    
    by_method = db.query(
        Payment.payment_method,
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('total')
    ).group_by(Payment.payment_method).all()
    
    total_payments = sum(m.count for m in by_method) # type: ignore
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
    avg_days = db.query(
        func.avg(func.extract('day', Payment.payment_date - Invoice.issue_date))
    ).join(Invoice).filter(
        Payment.status == 'Completed'
    ).scalar()
    
    return {
        'by_method': method_data,
        'total_payments': total_payments,
        'total_amount': float(total_amount),
        'avg_payment': round(avg_payment, 2),
        'avg_days_to_payment': round(float(avg_days), 1) if avg_days else None
    }


def get_top_accounts(db: Session, limit: int = 10) -> List[dict]:
    """Get top accounts by revenue"""
    
    top_accounts = db.query(
        Account.id,
        Account.name,
        func.sum(Invoice.amount_paid).label('revenue'),
        func.count(Invoice.id).label('invoice_count'),
        func.avg(Invoice.total_amount).label('avg_invoice')
    ).join(Invoice, Invoice.account_id == Account.id).filter(
        Account.is_deleted == False,
        Invoice.is_deleted == False
    ).group_by(Account.id, Account.name).order_by(
        func.sum(Invoice.amount_paid).desc()
    ).limit(limit).all()
    
    return [{
        'account_id': str(acc.id),
        'account_name': acc.name,
        'total_revenue': float(acc.revenue or 0),
        'invoice_count': acc.invoice_count,
        'avg_invoice': float(acc.avg_invoice or 0)
    } for acc in top_accounts]


def get_top_products(db: Session, limit: int = 10) -> List[dict]:
    """Get top products by sales"""
    from app.models.billing import Product, InvoiceItem
    
    top_products = db.query(
        Product.id,
        Product.name,
        func.sum(InvoiceItem.quantity).label('quantity'),
        func.sum(InvoiceItem.total).label('revenue'),
        func.count(func.distinct(InvoiceItem.invoice_id)).label('invoice_count')
    ).join(InvoiceItem).filter(
        Product.is_deleted == False
    ).group_by(Product.id, Product.name).order_by(
        func.sum(InvoiceItem.total).desc()
    ).limit(limit).all()
    
    return [{
        'product_id': str(prod.id),
        'product_name': prod.name,
        'quantity_sold': int(prod.quantity or 0),
        'revenue': float(prod.revenue or 0),
        'invoice_count': prod.invoice_count
    } for prod in top_products]