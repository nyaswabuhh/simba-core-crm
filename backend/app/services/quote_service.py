from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from decimal import Decimal
from uuid import UUID
from datetime import datetime, date
from typing import List, Optional

from app.models.billing import Quote, QuoteItem, QuoteStatus, Product
from app.schemas.billing import QuoteItemCreate
from app.utils.date_utils import (
    validate_date_range,
    validate_date_order,
    apply_date_filter,
    build_date_filters,
    format_date_range,
    DateValidationError,
    DateRangeError
)


def generate_quote_number(db: Session) -> str:
    """Generate a unique quote number."""
    last_quote = db.query(Quote).order_by(Quote.created_at.desc()).first()
    
    if not last_quote:
        return "QT-2026-0001"
    
    try:
        parts = last_quote.quote_number.split("-")
        year = datetime.now().year
        number = int(parts[-1]) + 1
        return f"QT-{year}-{number:04d}"
    except:
        return f"QT-{datetime.now().year}-0001"


def calculate_quote_totals(
    items: List[QuoteItemCreate],
    tax_rate: Decimal,
    discount_type: str,
    discount_value: Decimal,
    db: Session
) -> dict:
    """Calculate quote totals from items."""
    subtotal = Decimal(0)
    
    for item in items:
        product = db.query(Product).filter(
            Product.id == item.product_id,
            Product.is_deleted == False
        ).first()
        
        if not product:
            raise ValueError(f"Product {item.product_id} not found")
        
        item_subtotal = item.unit_price * item.quantity
        item_discount = item_subtotal * (item.discount_percentage / 100)
        item_total = item_subtotal - item_discount
        subtotal += item_total
    
    # Calculate discount
    discount_amount = Decimal(0)
    if discount_type == "percentage":
        discount_amount = subtotal * (discount_value / 100)
    elif discount_type == "flat":
        discount_amount = discount_value
    
    amount_after_discount = subtotal - discount_amount
    tax_amount = amount_after_discount * (tax_rate / 100)
    total_amount = amount_after_discount + tax_amount
    
    return {
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount
    }


def create_quote_items(
    quote_id: UUID,
    items: List[QuoteItemCreate],
    db: Session
) -> List[QuoteItem]:
    """Create quote items."""
    quote_items = []
    
    for item_data in items:
        item_subtotal = item_data.unit_price * item_data.quantity
        item_discount = item_subtotal * (item_data.discount_percentage / 100)
        item_total = item_subtotal - item_discount
        
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        description = item_data.description or (product.description if product else None) or (product.name if product else "")
        
        quote_item = QuoteItem(
            quote_id=quote_id,
            product_id=item_data.product_id,
            description=description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            discount_percentage=item_data.discount_percentage,
            total=item_total
        )
        
        db.add(quote_item)
        quote_items.append(quote_item)
    
    return quote_items


def update_quote_items(
    quote: Quote,
    items: List[QuoteItemCreate],
    db: Session
) -> None:
    """Update quote items by replacing all items and recalculating totals."""
    db.query(QuoteItem).filter(QuoteItem.quote_id == quote.id).delete()
    
    create_quote_items(quote.id, items, db)  # type: ignore
    
    totals = calculate_quote_totals(
        items,
        quote.tax_rate,  # type: ignore
        quote.discount_type or "flat",  # type: ignore
        quote.discount_value or Decimal(0),  # type: ignore
        db
    )
    
    quote.subtotal = totals["subtotal"]  # type: ignore
    quote.discount_amount = totals["discount_amount"]  # type: ignore
    quote.tax_amount = totals["tax_amount"]  # type: ignore
    quote.total_amount = totals["total_amount"]  # type: ignore


# ============================================================
# Query functions with date filtering
# ============================================================

def get_quotes(
    db: Session,
    status: Optional[QuoteStatus] = None,
    account_id: Optional[UUID] = None,
    owner_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    date_field: str = 'created_at',
    skip: int = 0,
    limit: int = 100
) -> List[Quote]:
    """
    Get quotes with optional filters.
    
    Args:
        db: Database session
        status: Filter by quote status
        account_id: Filter by account
        owner_id: Filter by owner
        start_date: Filter quotes on or after this date
        end_date: Filter quotes on or before this date
        date_field: Date field to filter on ('created_at', 'valid_from', 'valid_until')
        skip: Number of records to skip
        limit: Maximum records to return
        
    Returns:
        List of matching quotes
    """
    validate_date_range(start_date, end_date)
    
    query = db.query(Quote).filter(Quote.is_deleted == False)
    
    if status:
        query = query.filter(Quote.status == status)
    
    if account_id:
        query = query.filter(Quote.account_id == account_id)
    
    if owner_id:
        query = query.filter(Quote.owner_id == owner_id)
    
    query = apply_date_filter(query, Quote, start_date, end_date, date_field)
    
    return query.order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()


def get_quotes_by_status(
    db: Session,
    status: QuoteStatus,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_id: Optional[UUID] = None,
    date_field: str = 'created_at'
) -> List[Quote]:
    """
    Get quotes filtered by status and optional date range.
    
    Args:
        db: Database session
        status: Quote status to filter by
        start_date: Filter quotes on or after this date
        end_date: Filter quotes on or before this date
        account_id: Filter by specific account
        date_field: Which date field to filter on
        
    Returns:
        List of matching quotes
    """
    validate_date_range(start_date, end_date)
    
    query = db.query(Quote).filter(
        Quote.status == status,
        Quote.is_deleted == False
    )
    
    query = apply_date_filter(query, Quote, start_date, end_date, date_field)
    
    if account_id:
        query = query.filter(Quote.account_id == account_id)
    
    return query.order_by(Quote.created_at.desc()).all()


def get_expiring_quotes(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    days_until_expiry: int = 7,
    include_statuses: Optional[List[QuoteStatus]] = None
) -> List[Quote]:
    """
    Get quotes that are expiring within a date range.
    
    Useful for sending reminders to follow up on quotes before they expire.
    
    Args:
        db: Database session
        start_date: Start of expiry range (default: today)
        end_date: End of expiry range (default: X days from now)
        days_until_expiry: Days ahead to look if end_date not specified
        include_statuses: Only include these statuses (default: DRAFT, SENT, PENDING)
        
    Returns:
        List of quotes expiring in the specified range
    """
    from datetime import timedelta
    
    if start_date is None:
        start_date = date.today()
    
    if end_date is None:
        end_date = start_date + timedelta(days=days_until_expiry)
    
    validate_date_range(start_date, end_date)
    
    if include_statuses is None:
        include_statuses = [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.PENDING]
    
    query = db.query(Quote).filter(
        Quote.status.in_(include_statuses),
        Quote.is_deleted == False
    )
    
    # Filter by valid_until (expiry date)
    query = apply_date_filter(query, Quote, start_date, end_date, date_field='valid_until')
    
    return query.order_by(Quote.valid_until.asc()).all()


def check_expired_quotes(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_id: Optional[UUID] = None,
    auto_commit: bool = True
) -> List[Quote]:
    """
    Check quotes and mark expired ones.
    Similar to check_overdue_invoices but for quotes.
    
    Args:
        db: Database session
        start_date: Only check quotes created on or after this date
        end_date: Only check quotes created on or before this date
        account_id: Only check quotes for a specific account
        auto_commit: Whether to commit changes (default True)
        
    Returns:
        List of quotes that were marked as expired
    """
    validate_date_range(start_date, end_date)
    
    current_date = date.today()
    
    # Find quotes that are past their valid_until date and still active
    query = db.query(Quote).filter(
        Quote.status.in_([QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.PENDING]),
        Quote.valid_until < current_date,
        Quote.is_deleted == False
    )
    
    # Apply optional date filters on created_at
    query = apply_date_filter(query, Quote, start_date, end_date)
    
    if account_id:
        query = query.filter(Quote.account_id == account_id)
    
    expired_quotes = query.all()
    
    for quote in expired_quotes:
        quote.status = QuoteStatus.EXPIRED  # type: ignore
    
    if expired_quotes and auto_commit:
        db.commit()
    
    return expired_quotes


def get_quote_analytics(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    owner_id: Optional[UUID] = None
) -> dict:
    """
    Get quote analytics by status with optional date filtering.
    
    Args:
        db: Database session
        start_date: Filter quotes created on or after this date
        end_date: Filter quotes created on or before this date
        owner_id: Filter by owner
        
    Returns:
        Dict with quote statistics
    """
    validate_date_range(start_date, end_date)
    
    base_filter = [Quote.is_deleted == False]
    base_filter.extend(build_date_filters(Quote, start_date, end_date))
    
    if owner_id:
        base_filter.append(Quote.owner_id == owner_id)
    
    # By status
    by_status = db.query(
        Quote.status,
        func.count(Quote.id).label('count'),
        func.sum(Quote.total_amount).label('total_value'),
        func.avg(Quote.total_amount).label('avg_value')
    ).filter(*base_filter).group_by(Quote.status).all()
    
    status_data = []
    total_quotes = 0
    total_value = Decimal(0)
    
    for status in by_status:
        status_value = status.total_value or Decimal(0)
        status_avg = status.avg_value or Decimal(0)
        total_quotes += status.count
        total_value += status_value
        
        status_data.append({
            'status': status.status.value,
            'count': status.count,
            'total_value': float(status_value),
            'avg_value': float(status_avg)
        })
    
    # Conversion metrics
    approved = db.query(Quote).filter(
        *base_filter,
        Quote.status == QuoteStatus.APPROVED
    ).count()
    
    converted = db.query(Quote).filter(
        *base_filter,
        Quote.status == QuoteStatus.CONVERTED
    ).count()
    
    rejected = db.query(Quote).filter(
        *base_filter,
        Quote.status == QuoteStatus.REJECTED
    ).count()
    
    expired = db.query(Quote).filter(
        *base_filter,
        Quote.status == QuoteStatus.EXPIRED
    ).count()
    
    # Calculate rates
    completed = approved + converted + rejected + expired
    approval_rate = ((approved + converted) / completed * 100) if completed > 0 else 0
    conversion_rate = (converted / (approved + converted) * 100) if (approved + converted) > 0 else 0
    
    avg_quote_value = float(total_value / total_quotes) if total_quotes > 0 else 0
    
    return {
        'by_status': status_data,
        'total_quotes': total_quotes,
        'total_value': float(total_value),
        'avg_quote_value': round(avg_quote_value, 2),
        'approval_rate': round(approval_rate, 2),
        'conversion_rate': round(conversion_rate, 2),
        'date_range': format_date_range(start_date, end_date)
    }


def get_quote_pipeline(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> dict:
    """
    Get quote pipeline summary - quotes in active states that could convert.
    
    Args:
        db: Database session
        start_date: Filter quotes created on or after this date
        end_date: Filter quotes created on or before this date
        
    Returns:
        Dict with pipeline summary
    """
    validate_date_range(start_date, end_date)
    
    active_statuses = [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.PENDING, QuoteStatus.APPROVED]
    
    base_filter = [
        Quote.is_deleted == False,
        Quote.status.in_(active_statuses)
    ]
    base_filter.extend(build_date_filters(Quote, start_date, end_date))
    
    # Pipeline by status
    pipeline = db.query(
        Quote.status,
        func.count(Quote.id).label('count'),
        func.sum(Quote.total_amount).label('total_value')
    ).filter(*base_filter).group_by(Quote.status).all()
    
    # Probability weights for pipeline value calculation
    probability_map = {
        QuoteStatus.DRAFT: 0.10,
        QuoteStatus.SENT: 0.25,
        QuoteStatus.PENDING: 0.50,
        QuoteStatus.APPROVED: 0.90
    }
    
    pipeline_data = []
    total_value = Decimal(0)
    weighted_value = Decimal(0)
    total_count = 0
    
    for stage in pipeline:
        stage_value = stage.total_value or Decimal(0)
        total_value += stage_value
        total_count += stage.count
        
        probability = probability_map.get(stage.status, 0.25)
        weighted_value += stage_value * Decimal(probability)
        
        pipeline_data.append({
            'status': stage.status.value,
            'count': stage.count,
            'total_value': float(stage_value),
            'probability': probability,
            'weighted_value': float(stage_value * Decimal(probability))
        })
    
    return {
        'stages': pipeline_data,
        'total_quotes': total_count,
        'total_pipeline_value': float(total_value),
        'weighted_pipeline_value': float(weighted_value),
        'date_range': format_date_range(start_date, end_date)
    }


def get_quotes_expiring_report(
    db: Session,
    days_ahead: int = 30
) -> dict:
    """
    Get report of quotes expiring soon, grouped by time buckets.
    
    Args:
        db: Database session
        days_ahead: How many days ahead to look
        
    Returns:
        Dict with expiring quotes summary
    """
    from datetime import timedelta
    
    today = date.today()
    
    active_statuses = [QuoteStatus.DRAFT, QuoteStatus.SENT, QuoteStatus.PENDING]
    
    # Define time buckets
    buckets = {
        'expired': {'start': None, 'end': today - timedelta(days=1), 'count': 0, 'value': Decimal(0)},
        'today': {'start': today, 'end': today, 'count': 0, 'value': Decimal(0)},
        'this_week': {'start': today + timedelta(days=1), 'end': today + timedelta(days=7), 'count': 0, 'value': Decimal(0)},
        'next_week': {'start': today + timedelta(days=8), 'end': today + timedelta(days=14), 'count': 0, 'value': Decimal(0)},
        'this_month': {'start': today + timedelta(days=15), 'end': today + timedelta(days=30), 'count': 0, 'value': Decimal(0)},
        'later': {'start': today + timedelta(days=31), 'end': None, 'count': 0, 'value': Decimal(0)}
    }
    
    # Query all active quotes
    quotes = db.query(Quote).filter(
        Quote.status.in_(active_statuses),
        Quote.is_deleted == False
    ).all()
    
    for quote in quotes:
        valid_until = quote.valid_until  # type: ignore
        if isinstance(valid_until, datetime):
            valid_until = valid_until.date()
        
        total = quote.total_amount or Decimal(0)  # type: ignore
        
        if valid_until < today:
            buckets['expired']['count'] += 1
            buckets['expired']['value'] += total
        elif valid_until == today:
            buckets['today']['count'] += 1
            buckets['today']['value'] += total
        elif valid_until <= today + timedelta(days=7):
            buckets['this_week']['count'] += 1
            buckets['this_week']['value'] += total
        elif valid_until <= today + timedelta(days=14):
            buckets['next_week']['count'] += 1
            buckets['next_week']['value'] += total
        elif valid_until <= today + timedelta(days=30):
            buckets['this_month']['count'] += 1
            buckets['this_month']['value'] += total
        else:
            buckets['later']['count'] += 1
            buckets['later']['value'] += total
    
    # Format output
    result_buckets = {}
    for name, data in buckets.items():
        result_buckets[name] = {
            'count': data['count'],
            'value': float(data['value'])
        }
    
    total_at_risk = (
        buckets['expired']['value'] + 
        buckets['today']['value'] + 
        buckets['this_week']['value']
    )
    
    return {
        'as_of_date': today.isoformat(),
        'buckets': result_buckets,
        'total_quotes': len(quotes),
        'urgent_count': buckets['expired']['count'] + buckets['today']['count'] + buckets['this_week']['count'],
        'value_at_risk': float(total_at_risk)
    }