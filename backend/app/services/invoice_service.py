from sqlalchemy.orm import Session
from decimal import Decimal
from uuid import UUID
from datetime import datetime
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, Quote, QuoteStatus
from typing import Optional


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
    """
    # Validate quote status
    if quote.status != QuoteStatus.APPROVED: # type: ignore
        raise ValueError(f"Only approved quotes can be converted to invoices. Current status: {quote.status.value}")
    
    # Check if quote has already been converted
    existing_invoice = db.query(Invoice).filter(
        Invoice.quote_id == quote.id,
        Invoice.is_deleted == False
    ).first()
    
    if existing_invoice:
        raise ValueError(f"Quote {quote.quote_number} has already been converted to invoice {existing_invoice.invoice_number}")
    
    # Validate dates
    if due_date < issue_date:
        raise ValueError("Due date must be on or after issue date")
    
    # Create invoice with immutable data from quote
    invoice = Invoice(
        invoice_number=generate_invoice_number(db),
        quote_id=quote.id,
        account_id=quote.account_id,
        contact_id=quote.contact_id,
        status=InvoiceStatus.DRAFT,  # Start as DRAFT, not UNPAID
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
    db.flush()  # Get invoice ID
    
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
    quote.status = QuoteStatus.CONVERTED # type: ignore
    
    return invoice


def update_invoice_status(invoice: Invoice, db: Session) -> None:
    """
    Update invoice status based on payment amount and due date.
    This is the ONLY way invoice status should change after creation.
    """
    current_time = datetime.utcnow()
    
    # Check payment status first
    if invoice.amount_paid >= invoice.total_amount: # type: ignore
        invoice.status = InvoiceStatus.PAID # type: ignore
        if not invoice.paid_date: # type: ignore
            invoice.paid_date = current_time # type: ignore
    elif invoice.amount_paid > 0: # type: ignore
        invoice.status = InvoiceStatus.PARTIAL # type: ignore
    else:
        # No payments made - check if overdue
        if current_time > invoice.due_date and invoice.status in [InvoiceStatus.UNPAID, InvoiceStatus.SENT]: # type: ignore
            invoice.status = InvoiceStatus.OVERDUE # type: ignore
        elif invoice.status == InvoiceStatus.DRAFT: # type: ignore
            # Keep as DRAFT if not sent yet
            pass
        else:
            # Sent but not paid
            invoice.status = InvoiceStatus.UNPAID # type: ignore


def send_invoice(invoice: Invoice, db: Session) -> None:
    """
    Mark invoice as sent. Can only send DRAFT invoices.
    """
    if invoice.status != InvoiceStatus.DRAFT: # type: ignore
        raise ValueError(f"Only DRAFT invoices can be sent. Current status: {invoice.status.value}")
    
    invoice.status = InvoiceStatus.SENT # type: ignore
    
    # Check if already overdue
    if datetime.utcnow() > invoice.due_date: # type: ignore
        invoice.status = InvoiceStatus.OVERDUE # type: ignore


def cancel_invoice(invoice: Invoice, db: Session) -> None:
    """
    Cancel an invoice. Cannot cancel PAID invoices.
    """
    if invoice.status == InvoiceStatus.PAID: # type: ignore
        raise ValueError("Cannot cancel a PAID invoice")
    
    if invoice.amount_paid > 0: # type: ignore
        raise ValueError("Cannot cancel an invoice with payments. Refund payments first.")
    
    invoice.status = InvoiceStatus.CANCELLED # type: ignore


def process_payment(
    invoice: Invoice,
    payment_amount: Decimal,
    db: Session
) -> None:
    """
    Process a payment and update invoice accordingly.
    This should be called after a Payment record is created.
    """
    # Validate payment amount
    if payment_amount <= 0:
        raise ValueError("Payment amount must be positive")
    
    if payment_amount > invoice.amount_due: # type: ignore
        raise ValueError(f"Payment amount ({payment_amount}) exceeds amount due ({invoice.amount_due})")
    
    # Update invoice payment tracking
    invoice.amount_paid += payment_amount # type: ignore
    invoice.amount_due = invoice.total_amount - invoice.amount_paid # type: ignore
    
    # Ensure amount_due doesn't go negative due to rounding
    if invoice.amount_due < 0: # type: ignore
        invoice.amount_due = Decimal(0) # type: ignore
    
    # Update status based on new payment
    update_invoice_status(invoice, db)


def refund_payment(
    invoice: Invoice,
    refund_amount: Decimal,
    db: Session
) -> None:
    """
    Process a payment refund and update invoice accordingly.
    This should be called when a Payment status changes to REFUNDED.
    """
    # Validate refund amount
    if refund_amount <= 0:
        raise ValueError("Refund amount must be positive")
    
    if refund_amount > invoice.amount_paid: # type: ignore
        raise ValueError(f"Refund amount ({refund_amount}) exceeds amount paid ({invoice.amount_paid})")
    
    # Update invoice payment tracking
    invoice.amount_paid -= refund_amount # type: ignore
    invoice.amount_due = invoice.total_amount - invoice.amount_paid # type: ignore
    
    # Clear paid_date if fully refunded
    if invoice.amount_paid == 0: # type: ignore
        invoice.paid_date = None # type: ignore
    
    # Update status based on refund
    update_invoice_status(invoice, db)


def check_overdue_invoices(db: Session) -> int:
    """
    Check all sent/unpaid invoices and mark overdue ones.
    This should be run periodically (e.g., daily cron job).
    Returns the number of invoices marked as overdue.
    """
    current_time = datetime.utcnow()
    
    overdue_invoices = db.query(Invoice).filter(
        Invoice.status.in_([InvoiceStatus.SENT, InvoiceStatus.UNPAID]),
        Invoice.due_date < current_time,
        Invoice.is_deleted == False
    ).all()
    
    count = 0
    for invoice in overdue_invoices:
        invoice.status = InvoiceStatus.OVERDUE # type: ignore
        count += 1
    
    if count > 0:
        db.commit()
    
    return count