from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date

from app.db.base import get_db
from app.models.user import User
from app.models.crm import Account, Contact, Opportunity
from app.models.billing import Quote, QuoteItem, QuoteStatus
from app.schemas.billing import (
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteItemUpdate
)
from app.services.quote_service import (
    generate_quote_number, calculate_quote_totals, 
    create_quote_items, update_quote_items as update_items_service,
    check_expired_quotes, get_quote_analytics, get_quote_pipeline,
    get_expiring_quotes, get_quotes_expiring_report
)
from app.services.pdf_service import generate_quote_pdf
from app.api.dependencies import get_current_active_user, require_sales, require_admin
from app.utils.date_utils import (
    apply_date_filter,
    get_date_range_for_period,
    DateRangeError
)

router = APIRouter()


def parse_quote_status(status_str: str) -> Optional[QuoteStatus]:
    """Parse status string to QuoteStatus enum, case-insensitive."""
    if not status_str:
        return None
    
    try:
        return QuoteStatus(status_str)
    except ValueError:
        pass
    
    status_upper = status_str.upper()
    for status_enum in QuoteStatus:
        if status_enum.name == status_upper:
            return status_enum
        if status_enum.value.upper() == status_upper:
            return status_enum
    
    return None


@router.post("/", response_model=QuoteResponse, status_code=status.HTTP_201_CREATED)
def create_quote(
    quote_data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Create a new quote with line items.
    """
    # Verify account exists
    account = db.query(Account).filter(
        Account.id == quote_data.account_id,
        Account.is_deleted == False
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Verify contact if provided
    if quote_data.contact_id:
        contact = db.query(Contact).filter(
            Contact.id == quote_data.contact_id,
            Contact.is_deleted == False
        ).first()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact not found"
            )
    
    # Verify opportunity if provided
    if quote_data.opportunity_id:
        opportunity = db.query(Opportunity).filter(
            Opportunity.id == quote_data.opportunity_id,
            Opportunity.is_deleted == False
        ).first()
        if not opportunity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found"
            )
    
    # Calculate totals
    totals = calculate_quote_totals(
        quote_data.items,
        quote_data.tax_rate,
        quote_data.discount_type or "flat",
        quote_data.discount_value,
        db
    )
    
    # Create quote
    db_quote = Quote(
        quote_number=generate_quote_number(db),
        account_id=quote_data.account_id,
        contact_id=quote_data.contact_id,
        opportunity_id=quote_data.opportunity_id,
        status=QuoteStatus.DRAFT,
        tax_rate=quote_data.tax_rate,
        discount_type=quote_data.discount_type,
        discount_value=quote_data.discount_value,
        subtotal=totals["subtotal"],
        discount_amount=totals["discount_amount"],
        tax_amount=totals["tax_amount"],
        total_amount=totals["total_amount"],
        valid_until=quote_data.valid_until,
        notes=quote_data.notes,
        terms_conditions=quote_data.terms_conditions,
        owner_id=current_user.id
    )
    
    db.add(db_quote)
    db.flush()
    
    # Create quote items
    create_quote_items(db_quote.id, quote_data.items, db)  # type: ignore
    
    db.commit()
    db.refresh(db_quote)
    
    return db_quote


@router.get("/")
def list_quotes(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    account_id: Optional[UUID] = Query(None),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    start_date: Optional[date] = Query(None, description="Filter quotes on or after this date"),
    end_date: Optional[date] = Query(None, description="Filter quotes on or before this date"),
    date_field: str = Query("created_at", description="Date field to filter on", regex="^(created_at|valid_until)$"),
    period: Optional[str] = Query(None, description="Preset period: last_7_days, last_30_days, this_month, etc."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all quotes with optional filters.
    
    Date filtering options:
    - Use `start_date` and `end_date` for custom range
    - Or use `period` for presets: today, yesterday, this_week, last_week,
      this_month, last_month, this_quarter, last_quarter, this_year, last_year,
      last_7_days, last_30_days, last_90_days, last_365_days
    - Use `date_field` to specify which date to filter (created_at, valid_until)
    """
    # Handle period preset
    if period:
        try:
            start_date, end_date = get_date_range_for_period(period)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    # Validate date range
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date"
        )
    
    query = db.query(Quote).filter(Quote.is_deleted == False)
    
    # Parse and apply status filter
    if status_filter:
        parsed_status = parse_quote_status(status_filter)
        if parsed_status:
            query = query.filter(Quote.status == parsed_status)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}. Valid values: {[s.value for s in QuoteStatus]}"
            )
    
    if account_id:
        query = query.filter(Quote.account_id == account_id)
    
    if owner_id:
        query = query.filter(Quote.owner_id == owner_id)
    
    # Apply date filtering
    query = apply_date_filter(query, Quote, start_date, end_date, date_field)
    
    quotes = query.options(
        joinedload(Quote.items).joinedload(QuoteItem.product),
        joinedload(Quote.owner)
    ).order_by(Quote.created_at.desc()).offset(skip).limit(limit).all()
    
    # Return with owner_name
    return [
        {
            **QuoteResponse.model_validate(quote).model_dump(),
            "owner_name": quote.owner.full_name if quote.owner else None
        }
        for quote in quotes
    ]


# ============================================================
# Report endpoints (must come before /{quote_id} routes)
# ============================================================

@router.get("/reports/analytics")
def get_quote_analytics_endpoint(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get quote analytics by status and owner.
    Returns counts, totals, and conversion rates.
    """
    from sqlalchemy import func, case
    from app.utils.date_utils import build_date_filters, format_date_range
    
    if period:
        try:
            start_date, end_date = get_date_range_for_period(period)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    # Validate date range
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date"
        )
    
    base_filter = [Quote.is_deleted == False]
    base_filter.extend(build_date_filters(Quote, start_date, end_date))
    
    # Total counts
    total_quotes = db.query(Quote).filter(*base_filter).count()
    total_value = db.query(func.sum(Quote.total_amount)).filter(*base_filter).scalar() or 0
    
    # By status
    by_status = db.query(
        Quote.status,
        func.count(Quote.id).label('count'),
        func.sum(Quote.total_amount).label('total_value')
    ).filter(*base_filter).group_by(Quote.status).all()
    
    # Calculate rates
    approved_count = sum(s.count for s in by_status if s.status in [QuoteStatus.APPROVED, QuoteStatus.CONVERTED]) # type: ignore
    sent_count = sum(s.count for s in by_status if s.status != QuoteStatus.DRAFT) # type: ignore
    
    approval_rate = (approved_count / sent_count * 100) if sent_count > 0 else 0
    conversion_rate = (
        sum(s.count for s in by_status if s.status == QuoteStatus.CONVERTED) / total_quotes * 100 # type: ignore
    ) if total_quotes > 0 else 0
    
    # By owner
    by_owner = db.query(
        Quote.owner_id,
        User.first_name,
        User.last_name,
        func.count(Quote.id).label('count'),
        func.sum(Quote.total_amount).label('total_value'),
        func.sum(case(
            (Quote.status.in_([QuoteStatus.APPROVED, QuoteStatus.CONVERTED]), 1),
            else_=0
        )).label('approved')
    ).join(User, Quote.owner_id == User.id).filter(
        *base_filter
    ).group_by(Quote.owner_id, User.first_name, User.last_name).all()
    
    return {
        'total_quotes': total_quotes,
        'total_value': float(total_value),
        'approval_rate': round(approval_rate, 2),
        'conversion_rate': round(conversion_rate, 2),
        'by_status': [
            {
                'status': s.status.value if s.status else 'Unknown',
                'count': s.count,
                'total_value': float(s.total_value or 0)
            }
            for s in by_status
        ],
        'by_owner': [
            {
                'owner_id': str(o.owner_id),
                'owner_name': f"{o.first_name} {o.last_name}",
                'count': o.count,
                'total_value': float(o.total_value or 0),
                'approved': o.approved or 0
            }
            for o in by_owner
        ],
        'date_range': format_date_range(start_date, end_date)
    }


@router.get("/reports/pipeline")
def get_quote_pipeline_endpoint(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get quote pipeline summary.
    Shows quotes in active states with weighted values.
    """
    if period:
        try:
            start_date, end_date = get_date_range_for_period(period)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )
    
    try:
        return get_quote_pipeline(db, start_date, end_date)
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/reports/expiring")
def get_expiring_quotes_report(
    days_ahead: int = Query(30, description="Days ahead to look"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get report of quotes expiring soon, grouped by time buckets.
    """
    return get_quotes_expiring_report(db, days_ahead)


@router.get("/expiring", response_model=List[QuoteResponse])
def get_expiring_quotes_list(
    start_date: Optional[date] = Query(None, description="Start of expiry range (default: today)"),
    end_date: Optional[date] = Query(None, description="End of expiry range"),
    days_ahead: int = Query(7, description="Days ahead if end_date not specified"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get list of quotes expiring within a date range.
    """
    try:
        return get_expiring_quotes(db, start_date, end_date, days_ahead)
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/admin/check-expired")
def trigger_expired_check(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    account_id: Optional[UUID] = Query(None),
    update_status: bool = Query(True, description="Whether to update statuses"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Manually trigger expired quote check.
    Marks quotes past their valid_until date as expired.
    """
    try:
        expired_quotes = check_expired_quotes(
            db=db,
            start_date=start_date,
            end_date=end_date,
            account_id=account_id,
            auto_commit=update_status
        )
        
        return {
            "message": f"Found {len(expired_quotes)} expired quote(s)" + 
                       (", updated statuses" if update_status else ""),
            "count": len(expired_quotes),
            "updated": update_status,
            "quotes": [
                {
                    "id": str(q.id),
                    "quote_number": q.quote_number,
                    "valid_until": q.valid_until.isoformat() if q.valid_until else None, # type: ignore
                    "total_amount": float(q.total_amount) if q.total_amount else 0 # type: ignore
                }
                for q in expired_quotes
            ]
        }
    
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================================
# Individual quote endpoints
# ============================================================

@router.get("/{quote_id}")
def get_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get quote by ID with all items.
    """
    quote = db.query(Quote).options(
        joinedload(Quote.items).joinedload(QuoteItem.product),
        joinedload(Quote.owner)
    ).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    return {
        **QuoteResponse.model_validate(quote).model_dump(),
        "owner_name": quote.owner.full_name if quote.owner else None
    }


@router.put("/{quote_id}", response_model=QuoteResponse)
def update_quote(
    quote_id: UUID,
    quote_update: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update quote. Cannot update if approved or converted.
    """
    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    # Check if quote can be edited
    if quote.status in [QuoteStatus.APPROVED, QuoteStatus.CONVERTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update quote with status {quote.status.value}"
        )
    
    # Update fields
    update_data = quote_update.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(quote, field, value)
    
    db.commit()
    db.refresh(quote)
    
    return quote


@router.put("/{quote_id}/items", response_model=QuoteResponse)
def update_quote_items(
    quote_id: UUID,
    items_update: QuoteItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update quote items. Replaces all items and recalculates totals.
    """
    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    # Check if quote can be edited
    if quote.status in [QuoteStatus.APPROVED, QuoteStatus.CONVERTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot update items for quote with status {quote.status.value}"
        )
    
    # Update items and recalculate
    update_items_service(quote, items_update.items, db)
    
    db.commit()
    db.refresh(quote)
    
    return quote


@router.post("/{quote_id}/approve", response_model=QuoteResponse)
def approve_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Approve a quote. Changes status to Approved.
    """
    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    if quote.status != QuoteStatus.SENT:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only sent quotes can be approved"
        )
    
    quote.status = QuoteStatus.APPROVED  # type: ignore
    quote.approved_date = datetime.utcnow()  # type: ignore
    
    db.commit()
    db.refresh(quote)
    
    return quote


@router.post("/{quote_id}/send", response_model=QuoteResponse)
def send_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Mark quote as sent.
    """
    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    if quote.status != QuoteStatus.DRAFT:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft quotes can be sent"
        )
    
    quote.status = QuoteStatus.SENT  # type: ignore
    
    db.commit()
    db.refresh(quote)
    
    return quote


@router.get("/{quote_id}/pdf")
def download_quote_pdf(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Download quote as PDF.
    """
    quote = db.query(Quote).options(
        joinedload(Quote.items).joinedload(QuoteItem.product),
        joinedload(Quote.account),
        joinedload(Quote.contact),
        joinedload(Quote.owner)
    ).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    # Generate PDF
    pdf_bytes = generate_quote_pdf(quote)
    
    # Return PDF response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={quote.quote_number}.pdf"
        }
    )


@router.delete("/{quote_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Soft delete quote. Cannot delete approved or converted quotes.
    """
    quote = db.query(Quote).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    if quote.status in [QuoteStatus.APPROVED, QuoteStatus.CONVERTED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete quote with status {quote.status.value}"
        )
    
    quote.is_deleted = True  # type: ignore
    db.commit()
    
    return None