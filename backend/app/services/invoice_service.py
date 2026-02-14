from sqlalchemy.orm import Session
from decimal import Decimal
from uuid import UUID
from datetime import datetime, date
from typing import Optional, List

from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, Quote, QuoteStatus
from app.utils.date_utils import (
    validate_date_order,
    DateValidationError,
    apply_date_filter,
    build_date_filters,
    to_start_of_day,
    to_end_of_day
)


def generate_invoice_number(db: Session) -> str:
    """Generate a unique invoice number."""
    last_invoice = db.query(Invoice).order_by(Invoice.created_at.desc()).first()
    
    if not last_invoice:
        return "INV-2026-0001"
    
    try:
        parts = last_invoice.invoice_number.split("-")
        year = datetime.now().year
        number = int(parts[-1]) + 1
        return f"INV-{year}-{number:04d}"
    except:
        return f"INV-{datetime.now().year}-0001"


def generate_payment_number(db: Session) -> str:
    """Generate a unique payment number."""
    from app.models.billing import Payment
    
    last_payment = db.query(Payment).order_by(Payment.created_at.desc()).first()
    
    if not last_payment:
        return "PAY-2026-0001"
    
    try:
        parts = last_payment.payment_number.split("-")
        year = datetime.now().year
        number = int(parts[-1]) + 1
        return f"PAY-{year}-{number:04d}"
    except:
        return f"PAY-{datetime.now().year}-0001"


def create_invoice_from_quote(
    quote: Quote,
    issue_date: datetime,
    due_date: datetime,
    notes: Optional[str],
    terms_conditions: Optional[str],
    owner_id: UUID,
    db: Session
) -> Invoice:
    """
    Create an invoice from an approved quote.
    This makes the quote data immutable in the invoice.
    
    Args:
        quote: The approved quote to convert
        issue_date: Invoice issue date
        due_date: Invoice due date (must be >= issue_date)
        notes: Optional notes for the invoice
        terms_conditions: Optional terms and conditions
        owner_id: UUID of the invoice owner
        db: Database session
        
    Returns:
        Created Invoice object
        
    Raises:
        ValueError: If quote is not approved or already converted
        DateValidationError: If due_date < issue_date
    """
    # Validate quote status
    if quote.status != QuoteStatus.APPROVED:  # type: ignore
        raise ValueError(
            f"Only approved quotes can be converted to invoices. "
            f"Current status: {quote.status.value}"
        )
    
    # Check if quote has already been converted
    existing_invoice = db.query(Invoice).filter(
        Invoice.quote_id == quote.id,
        Invoice.is_deleted == False
    ).first()
    
    if existing_invoice:
        raise ValueError(
            f"Quote {quote.quote_number} has already been converted to "
            f"invoice {existing_invoice.invoice_number}"
        )
    
    # Validate dates using shared utility
    validate_date_order(issue_date, due_date, "issue date", "due date")
    
    # Create invoice with immutable data from quote
    invoice = Invoice(
        invoice_number=generate_invoice_number(db),
        quote_id=quote.id,
        account_id=quote.account_id,
        contact_id=quote.contact_id,
        status=InvoiceStatus.DRAFT,
        subtotal=quote.subtotal,
        tax_rate=quote.tax_rate,
        tax_amount=quote.tax_amount,
        discount_type=quote.discount_type,
        discount_value=quote.discount_value,
        discount_amount=quote.discount_amount,
        total_amount=quote.total_amount,
        amount_paid=Decimal(0),
        amount_due=quote.total_amount,
        issue_date=issue_date,
        due_date=due_date,
        notes=notes or quote.notes,
        terms_conditions=terms_conditions or quote.terms_conditions,
        owner_id=owner_id
    )
    
    db.add(invoice)
    db.flush()
    
    # Copy quote items to invoice items (immutable)
    for quote_item in quote.items:
        invoice_item = InvoiceItem(
            invoice_id=invoice.id,
            product_id=quote_item.product_id,
            description=quote_item.description,
            quantity=quote_item.quantity,
            unit_price=quote_item.unit_price,
            discount_percentage=quote_item.discount_percentage,
            total=quote_item.total
        )
        db.add(invoice_item)
    
    # Update quote status to converted
    quote.status = QuoteStatus.CONVERTED  # type: ignore
    
    return invoice


def update_invoice_status(invoice: Invoice, db: Session) -> None:
    """
    Update invoice status based on payment amount and due date.
    This is the ONLY way invoice status should change after creation.
    """
    current_time = datetime.utcnow()
    
    # Check payment status first
    if invoice.amount_paid >= invoice.total_amount:  # type: ignore
        invoice.status = InvoiceStatus.PAID  # type: ignore
        if not invoice.paid_date:  # type: ignore
            invoice.paid_date = current_time  # type: ignore
    elif invoice.amount_paid > 0:  # type: ignore
        invoice.status = InvoiceStatus.PARTIAL  # type: ignore
    else:
        # No payments made - check if overdue
        if current_time > invoice.due_date and invoice.status in [InvoiceStatus.UNPAID, InvoiceStatus.SENT]:  # type: ignore
            invoice.status = InvoiceStatus.OVERDUE  # type: ignore
        elif invoice.status == InvoiceStatus.DRAFT:  # type: ignore
            pass
        else:
            invoice.status = InvoiceStatus.UNPAID  # type: ignore


def send_invoice(invoice: Invoice, db: Session) -> None:
    """
    Mark invoice as sent. Can only send DRAFT invoices.
    
    Raises:
        ValueError: If invoice is not in DRAFT status
    """
    if invoice.status != InvoiceStatus.DRAFT:  # type: ignore
        raise ValueError(
            f"Only DRAFT invoices can be sent. Current status: {invoice.status.value}"
        )
    
    invoice.status = InvoiceStatus.SENT  # type: ignore
    
    # Check if already overdue
    if datetime.utcnow() > invoice.due_date:  # type: ignore
        invoice.status = InvoiceStatus.OVERDUE  # type: ignore


def cancel_invoice(invoice: Invoice, db: Session) -> None:
    """
    Cancel an invoice. Cannot cancel PAID invoices or invoices with payments.
    
    Raises:
        ValueError: If invoice is PAID or has payments
    """
    if invoice.status == InvoiceStatus.PAID:  # type: ignore
        raise ValueError("Cannot cancel a PAID invoice")
    
    if invoice.amount_paid > 0:  # type: ignore
        raise ValueError("Cannot cancel an invoice with payments. Refund payments first.")
    
    invoice.status = InvoiceStatus.CANCELLED  # type: ignore


def process_payment(
    invoice: Invoice,
    payment_amount: Decimal,
    db: Session
) -> None:
    """
    Process a payment and update invoice accordingly.
    This should be called after a Payment record is created.
    
    Raises:
        ValueError: If payment amount is invalid
    """
    if payment_amount <= 0:
        raise ValueError("Payment amount must be positive")
    
    if payment_amount > invoice.amount_due:  # type: ignore
        raise ValueError(
            f"Payment amount ({payment_amount}) exceeds amount due ({invoice.amount_due})"
        )
    
    invoice.amount_paid += payment_amount  # type: ignore
    invoice.amount_due = invoice.total_amount - invoice.amount_paid  # type: ignore
    
    # Ensure amount_due doesn't go negative due to rounding
    if invoice.amount_due < 0:  # type: ignore
        invoice.amount_due = Decimal(0)  # type: ignore
    
    update_invoice_status(invoice, db)


def refund_payment(
    invoice: Invoice,
    refund_amount: Decimal,
    db: Session
) -> None:
    """
    Process a payment refund and update invoice accordingly.
    This should be called when a Payment status changes to REFUNDED.
    
    Raises:
        ValueError: If refund amount is invalid
    """
    if refund_amount <= 0:
        raise ValueError("Refund amount must be positive")
    
    if refund_amount > invoice.amount_paid:  # type: ignore
        raise ValueError(
            f"Refund amount ({refund_amount}) exceeds amount paid ({invoice.amount_paid})"
        )
    
    invoice.amount_paid -= refund_amount  # type: ignore
    invoice.amount_due = invoice.total_amount - invoice.amount_paid  # type: ignore
    
    if invoice.amount_paid == 0:  # type: ignore
        invoice.paid_date = None  # type: ignore
    
    update_invoice_status(invoice, db)


def check_overdue_invoices(
    db: Session,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_id: Optional[UUID] = None,
    auto_commit: bool = True
) -> List[Invoice]:
    """
    Check invoices and mark overdue ones.
    This should be run periodically (e.g., daily cron job).
    
    Args:
        db: Database session
        start_date: Only check invoices created on or after this date
        end_date: Only check invoices created on or before this date
        account_id: Only check invoices for a specific account
        auto_commit: Whether to commit changes (default True)
        
    Returns:
        List of invoices that were marked as overdue
    """
    current_time = datetime.utcnow()
    
    # Build base query
    query = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.UNPAID]),
        Invoice.due_date < current_time,
        Invoice.is_deleted == False
    )
    
    # Apply optional date filters
    query = apply_date_filter(query, Invoice, start_date, end_date)
    
    # Filter by account if specified
    if account_id:
        query = query.filter(Invoice.account_id == account_id)
    
    overdue_invoices = query.all()
    
    for invoice in overdue_invoices:
        invoice.status = InvoiceStatus.OVERDUE  # type: ignore
    
    if overdue_invoices and auto_commit:
        db.commit()
    
    return overdue_invoices


def get_invoices_by_status(
    db: Session,
    status: InvoiceStatus,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    account_id: Optional[UUID] = None,
    date_field: str = 'created_at'
) -> List[Invoice]:
    """
    Get invoices filtered by status and optional date range.
    
    Args:
        db: Database session
        status: Invoice status to filter by
        start_date: Filter invoices on or after this date
        end_date: Filter invoices on or before this date
        account_id: Filter by specific account
        date_field: Which date field to filter on ('created_at', 'issue_date', 'due_date')
        
    Returns:
        List of matching invoices
    """
    query = db.query(Invoice).filter(
        Invoice.status == status,
        Invoice.is_deleted == False
    )
    
    query = apply_date_filter(query, Invoice, start_date, end_date, date_field)
    
    if account_id:
        query = query.filter(Invoice.account_id == account_id)
    
    return query.order_by(Invoice.created_at.desc()).all()


def get_invoices_due_in_range(
    db: Session,
    start_date: date,
    end_date: date,
    include_statuses: Optional[List[InvoiceStatus]] = None
) -> List[Invoice]:
    """
    Get invoices with due dates within a specific range.
    
    Useful for forecasting and reminders.
    
    Args:
        db: Database session
        start_date: Start of due date range
        end_date: End of due date range
        include_statuses: Only include these statuses (default: SENT, UNPAID, PARTIAL)
        
    Returns:
        List of invoices due in the specified range
    """
    if include_statuses is None:
        include_statuses = [InvoiceStatus.SENT, InvoiceStatus.UNPAID, InvoiceStatus.PARTIAL]
    
    query = db.query(Invoice).filter(
        Invoice.status.in_(include_statuses),
        Invoice.is_deleted == False
    )
    
    # Filter by due_date range
    query = apply_date_filter(query, Invoice, start_date, end_date, date_field='due_date')
    
    return query.order_by(Invoice.due_date.asc()).all()


def get_payment_forecast(
    db: Session,
    start_date: date,
    end_date: date
) -> dict:
    """
    Get expected payments for a date range based on invoice due dates.
    
    Args:
        db: Database session
        start_date: Start of forecast period
        end_date: End of forecast period
        
    Returns:
        Dict with forecast details
    """
    invoices = get_invoices_due_in_range(db, start_date, end_date)
    
    total_expected = Decimal(0)
    by_status = {}
    
    for invoice in invoices:
        total_expected += invoice.amount_due  # type: ignore
        status_key = invoice.status.value  # type: ignore
        if status_key not in by_status:
            by_status[status_key] = {'count': 0, 'amount': Decimal(0)}
        by_status[status_key]['count'] += 1
        by_status[status_key]['amount'] += invoice.amount_due  # type: ignore
    
    return {
        'period': {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat()
        },
        'total_invoices': len(invoices),
        'total_expected': float(total_expected),
        'by_status': {
            k: {'count': v['count'], 'amount': float(v['amount'])}
            for k, v in by_status.items()
        }
    }


def get_aging_report(
    db: Session,
    as_of_date: Optional[date] = None,
    account_id: Optional[UUID] = None
) -> dict:
    """
    Generate an accounts receivable aging report.
    
    Args:
        db: Database session
        as_of_date: Date to calculate aging from (default: today)
        account_id: Filter by specific account
        
    Returns:
        Dict with aging buckets and totals
    """
    if as_of_date is None:
        as_of_date = date.today()
    
    as_of_datetime = to_end_of_day(as_of_date)
    
    # Get all unpaid/partial invoices
    query = db.query(Invoice).filter(
        Invoice.status.in_([
            InvoiceStatus.SENT,
            InvoiceStatus.UNPAID,
            InvoiceStatus.PARTIAL,
            InvoiceStatus.OVERDUE
        ]),
        Invoice.is_deleted == False
    )
    
    if account_id:
        query = query.filter(Invoice.account_id == account_id)
    
    invoices = query.all()
    
    # Initialize aging buckets
    buckets = {
        'current': {'count': 0, 'amount': Decimal(0)},
        '1_30_days': {'count': 0, 'amount': Decimal(0)},
        '31_60_days': {'count': 0, 'amount': Decimal(0)},
        '61_90_days': {'count': 0, 'amount': Decimal(0)},
        'over_90_days': {'count': 0, 'amount': Decimal(0)}
    }
    
    for invoice in invoices:
        due_date = invoice.due_date  # type: ignore
        if isinstance(due_date, datetime):
            due_date = due_date.date()
        
        days_overdue = (as_of_date - due_date).days
        amount = invoice.amount_due  # type: ignore
        
        if days_overdue <= 0:
            bucket = 'current'
        elif days_overdue <= 30:
            bucket = '1_30_days'
        elif days_overdue <= 60:
            bucket = '31_60_days'
        elif days_overdue <= 90:
            bucket = '61_90_days'
        else:
            bucket = 'over_90_days'
        
        buckets[bucket]['count'] += 1
        buckets[bucket]['amount'] += amount
    
    total_outstanding = sum(b['amount'] for b in buckets.values())
    
    return {
        'as_of_date': as_of_date.isoformat(),
        'buckets': {
            k: {'count': v['count'], 'amount': float(v['amount'])}
            for k, v in buckets.items()
        },
        'total_invoices': len(invoices),
        'total_outstanding': float(total_outstanding)
    }