from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from app.db.base import get_db
from app.models.user import User, UserRole
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, Quote
from app.schemas.billing import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse, QuoteToInvoiceConvert
)
from app.services.invoice_service import (
    create_invoice_from_quote, update_invoice_status
)
from app.services.pdf_service import generate_invoice_pdf
from app.api.dependencies import get_current_active_user, require_sales, require_finance

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
    # Get quote with items
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
            owner_id=current_user.id, # type: ignore
            db=db
        )
        
        db.commit()
        db.refresh(invoice)
        
        return invoice
        
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


@router.get("/", response_model=List[InvoiceResponse])
def list_invoices(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[InvoiceStatus] = Query(None, alias="status"),
    account_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    List all invoices with optional filters.
    Sales can view all, Finance can view all.
    """
    query = db.query(Invoice).filter(Invoice.is_deleted == False)
    
    if status_filter:
        query = query.filter(Invoice.status == status_filter)
    
    if account_id:
        query = query.filter(Invoice.account_id == account_id)
    
    invoices = query.options(
        joinedload(Invoice.items).joinedload(InvoiceItem.product)
    ).offset(skip).limit(limit).all()
    
    return invoices


@router.get("/{invoice_id}", response_model=InvoiceResponse)
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
    
    return invoice


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
    
    # Only allow updating notes and status
    if invoice_update.notes is not None:
        invoice.notes = invoice_update.notes # type: ignore
    
    if invoice_update.status is not None:
        # Only allow certain status transitions manually
        if invoice_update.status in [InvoiceStatus.CANCELLED, InvoiceStatus.SENT]:
            invoice.status = invoice_update.status # type: ignore
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
    
    # Generate PDF
    pdf_bytes = generate_invoice_pdf(invoice)
    
    # Return PDF response
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
    
    if invoice.status == InvoiceStatus.PAID: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete paid invoices"
        )
    
    if invoice.amount_paid > 0: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete invoices with payments. Cancel payments first."
        )
    
    invoice.is_deleted = True # type: ignore
    db.commit()
    
    return None