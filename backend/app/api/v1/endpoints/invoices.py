from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_
from typing import List, Optional
from uuid import UUID
from datetime import date

from app.db.base import get_db
from app.models.user import User, UserRole
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, Quote
from app.schemas.billing import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, QuoteToInvoiceConvert
)
from app.services.invoice_service import (
    create_invoice_from_quote,
    update_invoice_status,
    check_overdue_invoices,
    get_invoices_by_status,
    get_invoices_due_in_range,
    get_payment_forecast,
    get_aging_report
)
from app.services.pdf_service import generate_invoice_pdf
from app.api.dependencies import get_current_active_user, require_sales, require_finance, require_admin
from app.utils.date_utils import (
    DateValidationError,
    DateRangeError,
    apply_date_filter,
    get_date_range_for_period
)

router = APIRouter()


@router.post("/from-quote/{quote_id}", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice_from_quote_endpoint(
    quote_id: UUID,
    conversion_data: QuoteToInvoiceConvert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Create invoice from an approved quote.
    This converts the quote to an immutable invoice.
    """
    quote = db.query(Quote).options(
        joinedload(Quote.items)
    ).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    try:
        invoice = create_invoice_from_quote(
            quote=quote,
            issue_date=conversion_data.issue_date,
            due_date=conversion_data.due_date,
            notes=conversion_data.notes,
            terms_conditions=conversion_data.terms_conditions,
            owner_id=current_user.id,  # type: ignore
            db=db
        )
        
        db.commit()
        db.refresh(invoice)
        
        return invoice
    
    except DateValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating invoice: {str(e)}"
        )


def parse_invoice_status(status_str: str) -> Optional[InvoiceStatus]:
    """Parse status string to InvoiceStatus enum, case-insensitive."""
    if not status_str:
        return None
    
    # Try exact match first
    try:
        return InvoiceStatus(status_str)
    except ValueError:
        pass
    
    # Try case-insensitive match on enum names
    status_upper = status_str.upper()
    for status_enum in InvoiceStatus:
        if status_enum.name == status_upper:
            return status_enum
        # Also check value (e.g., "Overdue" vs "OVERDUE")
        if status_enum.value.upper() == status_upper:
            return status_enum
    
    return None


@router.get("/")
def list_invoices(
    skip: int = 0,
    limit: int = 1000,
    status_filter: Optional[str] = Query(None, alias="status"),
    account_id: Optional[UUID] = Query(None),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    start_date: Optional[date] = Query(None, description="Filter invoices created on or after this date"),
    end_date: Optional[date] = Query(None, description="Filter invoices created on or before this date"),
    date_field: str = Query("created_at", description="Date field to filter on", regex="^(created_at|issue_date|due_date)$"),
    period: Optional[str] = Query(None, description="Preset period: last_7_days, last_30_days, this_month, etc."),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all invoices with optional filters.
    
    Date filtering options:
    - Use `start_date` and `end_date` for custom range
    - Or use `period` for presets: today, yesterday, this_week, last_week,
      this_month, last_month, this_quarter, last_quarter, this_year, last_year,
      last_7_days, last_30_days, last_90_days, last_365_days
    - Use `date_field` to specify which date to filter (created_at, issue_date, due_date)
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
    
    query = db.query(Invoice).filter(Invoice.is_deleted == False)
    
    # Parse and apply status filter
    if status_filter:
        parsed_status = parse_invoice_status(status_filter)
        if not parsed_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}. Valid values: {[s.value for s in InvoiceStatus]}"
            )
        
        # Special handling for "Overdue" - include invoices that ARE overdue
        # even if their status hasn't been updated yet
        if parsed_status == InvoiceStatus.OVERDUE:
            from datetime import datetime
            now = datetime.utcnow()
            query = query.filter(
                or_(
                    Invoice.status == InvoiceStatus.OVERDUE,
                    and_(
                        Invoice.status.in_([
                            InvoiceStatus.SENT,
                            InvoiceStatus.UNPAID,
                            InvoiceStatus.PARTIAL
                        ]),
                        Invoice.due_date < now
                    )
                )
            )
        else:
            query = query.filter(Invoice.status == parsed_status)
    
    if account_id:
        query = query.filter(Invoice.account_id == account_id)
    
    if owner_id:
        query = query.filter(Invoice.owner_id == owner_id)
    
    # Apply date filtering
    query = apply_date_filter(query, Invoice, start_date, end_date, date_field)
    
    invoices = query.options(
        joinedload(Invoice.items).joinedload(InvoiceItem.product),
        joinedload(Invoice.owner)
    ).order_by(Invoice.created_at.desc()).offset(skip).limit(limit).all()
    
    # Return with owner_name
    return [
        {
            **InvoiceResponse.model_validate(invoice).model_dump(),
            "owner_name": invoice.owner.full_name if invoice.owner else None
        }
        for invoice in invoices
    ]


@router.get("/reports/analytics")
def get_invoice_analytics(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None, description="Preset period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get invoice analytics with stats by status and owner.
    """
    from sqlalchemy import func, case
    from app.utils.date_utils import build_date_filters, format_date_range
    
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
    
    base_filter = [Invoice.is_deleted == False]
    base_filter.extend(build_date_filters(Invoice, start_date, end_date))
    
    # Total counts
    total_invoices = db.query(Invoice).filter(*base_filter).count()
    total_amount = db.query(func.sum(Invoice.total_amount)).filter(*base_filter).scalar() or 0
    total_paid = db.query(func.sum(Invoice.amount_paid)).filter(*base_filter).scalar() or 0
    total_due = db.query(func.sum(Invoice.amount_due)).filter(*base_filter).scalar() or 0
    
    # By status
    by_status = db.query(
        Invoice.status,
        func.count(Invoice.id).label('count'),
        func.sum(Invoice.total_amount).label('total_amount'),
        func.sum(Invoice.amount_paid).label('amount_paid')
    ).filter(*base_filter).group_by(Invoice.status).all()
    
    # By owner
    by_owner = db.query(
        Invoice.owner_id,
        User.first_name,
        User.last_name,
        func.count(Invoice.id).label('count'),
        func.sum(Invoice.total_amount).label('total_amount'),
        func.sum(Invoice.amount_paid).label('paid_amount'),
        func.sum(case(
            (Invoice.status == InvoiceStatus.PAID, 1),
            else_=0
        )).label('paid_count')
    ).join(User, Invoice.owner_id == User.id).filter(
        *base_filter
    ).group_by(Invoice.owner_id, User.first_name, User.last_name).all()
    
    collection_rate = (float(total_paid) / float(total_amount) * 100) if total_amount > 0 else 0
    
    return {
        'total_invoices': total_invoices,
        'total_amount': float(total_amount),
        'total_paid': float(total_paid),
        'total_due': float(total_due),
        'collection_rate': round(collection_rate, 2),
        'by_status': [
            {
                'status': s.status.value if s.status else 'Unknown',
                'count': s.count,
                'total_amount': float(s.total_amount or 0),
                'amount_paid': float(s.amount_paid or 0)
            }
            for s in by_status
        ],
        'by_owner': [
            {
                'owner_id': str(o.owner_id),
                'owner_name': f"{o.first_name} {o.last_name}",
                'count': o.count,
                'total_amount': float(o.total_amount or 0),
                'paid_amount': float(o.paid_amount or 0),
                'paid_count': o.paid_count or 0
            }
            for o in by_owner
        ],
        'date_range': format_date_range(start_date, end_date)
    }


@router.get("/reports/aging")
def get_aging_report_endpoint(
    as_of_date: Optional[date] = Query(None, description="Date to calculate aging from (default: today)"),
    account_id: Optional[UUID] = Query(None, description="Filter by specific account"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Get accounts receivable aging report.
    
    Returns invoices grouped by aging buckets:
    - current (not yet due)
    - 1-30 days overdue
    - 31-60 days overdue
    - 61-90 days overdue
    - over 90 days overdue
    """
    return get_aging_report(db, as_of_date, account_id)


@router.get("/reports/forecast")
def get_payment_forecast_endpoint(
    start_date: date = Query(..., description="Start of forecast period"),
    end_date: date = Query(..., description="End of forecast period"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Get expected payments for a date range based on invoice due dates.
    
    Useful for cash flow forecasting.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date"
        )
    
    return get_payment_forecast(db, start_date, end_date)


@router.get("/reports/due-soon")
def get_invoices_due_soon(
    start_date: Optional[date] = Query(None, description="Start of due date range (default: today)"),
    end_date: Optional[date] = Query(None, description="End of due date range (default: 30 days from now)"),
    days_ahead: int = Query(30, description="Days ahead to look (used if end_date not specified)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> List[InvoiceResponse]:
    """
    Get invoices with due dates coming up.
    
    Useful for payment reminders and collections.
    """
    if start_date is None:
        start_date = date.today()
    
    if end_date is None:
        from datetime import timedelta
        end_date = start_date + timedelta(days=days_ahead)
    
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="start_date cannot be after end_date"
        )
    
    return get_invoices_due_in_range(db, start_date, end_date) # type: ignore


@router.post("/admin/check-overdue")
def trigger_overdue_check(
    start_date: Optional[date] = Query(None, description="Only check invoices created after this date"),
    end_date: Optional[date] = Query(None, description="Only check invoices created before this date"),
    account_id: Optional[UUID] = Query(None, description="Only check invoices for this account"),
    update_status: bool = Query(True, description="Whether to update invoice statuses in database"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Manually trigger overdue invoice check.
    
    Normally runs automatically via scheduler, but can be triggered manually.
    Returns list of invoices that were marked as overdue.
    
    Note: The scheduler runs this automatically every hour and at midnight UTC.
    """
    try:
        overdue_invoices = check_overdue_invoices(
            db=db,
            start_date=start_date,
            end_date=end_date,
            account_id=account_id,
            auto_commit=update_status
        )
        
        return {
            "message": f"Found {len(overdue_invoices)} overdue invoice(s)" + 
                       (f", updated statuses" if update_status else ", statuses not updated"),
            "count": len(overdue_invoices),
            "updated": update_status,
            "invoices": [
                {
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "due_date": inv.due_date.isoformat() if inv.due_date else None, # type: ignore
                    "amount_due": float(inv.amount_due) if inv.amount_due else 0 # type: ignore
                }
                for inv in overdue_invoices
            ]
        }
    
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get invoice by ID with all items and payments.
    """
    invoice = db.query(Invoice).options(
        joinedload(Invoice.items).joinedload(InvoiceItem.product),
        joinedload(Invoice.payments),
        joinedload(Invoice.owner)
    ).filter(
        Invoice.id == invoice_id,
        Invoice.is_deleted == False
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    return {
        **InvoiceResponse.model_validate(invoice).model_dump(),
        "owner_name": invoice.owner.full_name if invoice.owner else None
    }


@router.put("/{invoice_id}", response_model=InvoiceResponse)
def update_invoice(
    invoice_id: UUID,
    invoice_update: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Update invoice. Only status and notes can be updated.
    Financial fields are IMMUTABLE.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.is_deleted == False
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    if invoice_update.notes is not None:
        invoice.notes = invoice_update.notes  # type: ignore
    
    if invoice_update.status is not None:
        if invoice_update.status in [InvoiceStatus.CANCELLED, InvoiceStatus.SENT]:
            invoice.status = invoice_update.status  # type: ignore
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status can only be manually set to Cancelled or Sent. Other statuses are managed by payments."
            )
    
    db.commit()
    db.refresh(invoice)
    
    return invoice


@router.get("/{invoice_id}/pdf")
def download_invoice_pdf(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Download invoice as PDF.
    """
    invoice = db.query(Invoice).options(
        joinedload(Invoice.items).joinedload(InvoiceItem.product),
        joinedload(Invoice.account),
        joinedload(Invoice.contact),
        joinedload(Invoice.owner),
        joinedload(Invoice.payments)
    ).filter(
        Invoice.id == invoice_id,
        Invoice.is_deleted == False
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    pdf_bytes = generate_invoice_pdf(invoice)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={invoice.invoice_number}.pdf"
        }
    )


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_invoice(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Soft delete invoice. Only Finance can delete invoices.
    Cannot delete paid invoices.
    """
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.is_deleted == False
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    if invoice.status == InvoiceStatus.PAID:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete paid invoices"
        )
    
    if invoice.amount_paid > 0:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete invoices with payments. Cancel payments first."
        )
    
    invoice.is_deleted = True  # type: ignore
    db.commit()
    
    return None