from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from app.db.base import get_db
from app.models.user import User
from app.models.billing import Payment, Invoice, InvoiceStatus
from app.schemas.billing import PaymentCreate, PaymentUpdate, PaymentResponse
from app.services.invoice_service import (
    generate_payment_number, process_payment
)
from app.api.dependencies import get_current_active_user, require_finance

router = APIRouter()


@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Record a payment against an invoice.
    Only Finance can create payments.
    """
    # Get invoice
    invoice = db.query(Invoice).filter(
        Invoice.id == payment_data.invoice_id,
        Invoice.is_deleted == False
    ).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found"
        )
    
    # Validate invoice is not cancelled
    if invoice.status == InvoiceStatus.CANCELLED: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot add payment to cancelled invoice"
        )
    
    # Validate payment amount
    if payment_data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be positive"
        )
    
    if payment_data.amount > invoice.amount_due: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({payment_data.amount}) exceeds amount due ({invoice.amount_due})"
        )
    
    try:
        # Create payment
        db_payment = Payment(
            payment_number=generate_payment_number(db),
            invoice_id=payment_data.invoice_id,
            amount=payment_data.amount,
            payment_method=payment_data.payment_method,
            payment_date=payment_data.payment_date,
            reference_number=payment_data.reference_number,
            notes=payment_data.notes,
            transaction_id=payment_data.transaction_id,
            processor=payment_data.processor,
            processed_by=current_user.id
        )
        
        db.add(db_payment)
        db.flush()
        
        # Update invoice
        process_payment(invoice, payment_data.amount, db)
        
        db.commit()
        db.refresh(db_payment)
        
        return db_payment
        
    except ValueError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing payment: {str(e)}"
        )


@router.get("/", response_model=List[PaymentResponse])
def list_payments(
    skip: int = 0,
    limit: int = 100,
    invoice_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    List all payments with optional filters.
    Only Finance can view payments.
    """
    query = db.query(Payment)
    
    if invoice_id:
        query = query.filter(Payment.invoice_id == invoice_id)
    
    payments = query.options(
        joinedload(Payment.processor_user)
    ).offset(skip).limit(limit).all()
    
    return payments


@router.get("/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Get payment by ID.
    Only Finance can view payments.
    """
    payment = db.query(Payment).options(
        joinedload(Payment.processor_user),
        joinedload(Payment.invoice)
    ).filter(
        Payment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    return payment


@router.put("/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: UUID,
    payment_update: PaymentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Update payment status or notes.
    Amount and other financial details are IMMUTABLE.
    Only Finance can update payments.
    """
    payment = db.query(Payment).filter(
        Payment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Update allowed fields
    if payment_update.status is not None:
        # If refunding, need to update invoice
        if payment_update.status == "Refunded" and payment.status != "Refunded": # type: ignore
            invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
            if invoice:
                # Reverse the payment
                invoice.amount_paid -= payment.amount # type: ignore
                invoice.amount_due = invoice.total_amount - invoice.amount_paid # type: ignore
                
                # Update invoice status
                from app.services.invoice_service import update_invoice_status
                update_invoice_status(invoice, db)
        
        payment.status = payment_update.status # pyright: ignore[reportAttributeAccessIssue]
    
    if payment_update.notes is not None:
        payment.notes = payment_update.notes # type: ignore
    
    db.commit()
    db.refresh(payment)
    
    return payment


@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(
    payment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_finance)
):
    """
    Delete a payment (hard delete).
    This reverses the payment on the invoice.
    Only Finance can delete payments.
    USE WITH CAUTION - this is a destructive operation.
    """
    payment = db.query(Payment).filter(
        Payment.id == payment_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Get invoice
    invoice = db.query(Invoice).filter(Invoice.id == payment.invoice_id).first()
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated invoice not found"
        )
    
    try:
        # Reverse payment on invoice
        invoice.amount_paid -= payment.amount # type: ignore
        invoice.amount_due = invoice.total_amount - invoice.amount_paid # type: ignore
        
        # Update invoice status
        from app.services.invoice_service import update_invoice_status
        update_invoice_status(invoice, db)
        
        # Delete payment
        db.delete(payment)
        db.commit()
        
        return None
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting payment: {str(e)}"
        )