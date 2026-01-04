from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.db.base import get_db
from app.models.user import User
from app.models.crm import Account, Contact, Opportunity
from app.models.billing import Quote, QuoteItem, QuoteStatus
from app.schemas.billing import (
    QuoteCreate, QuoteUpdate, QuoteResponse, QuoteItemUpdate
)
from app.services.quote_service import (
    generate_quote_number, calculate_quote_totals, 
    create_quote_items, update_quote_items as update_items_service
)
from app.services.pdf_service import generate_quote_pdf
from app.api.dependencies import get_current_active_user, require_sales

router = APIRouter()


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
    create_quote_items(db_quote.id, quote_data.items, db) # type: ignore
    
    db.commit()
    db.refresh(db_quote)
    
    return db_quote


@router.get("/", response_model=List[QuoteResponse])
def list_quotes(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[QuoteStatus] = Query(None, alias="status"),
    account_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all quotes with optional filters.
    """
    query = db.query(Quote).filter(Quote.is_deleted == False)
    
    if status_filter:
        query = query.filter(Quote.status == status_filter)
    
    if account_id:
        query = query.filter(Quote.account_id == account_id)
    
    quotes = query.options(
        joinedload(Quote.items).joinedload(QuoteItem.product)
    ).offset(skip).limit(limit).all()
    
    return quotes


@router.get("/{quote_id}", response_model=QuoteResponse)
def get_quote(
    quote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get quote by ID with all items.
    """
    quote = db.query(Quote).options(
        joinedload(Quote.items).joinedload(QuoteItem.product)
    ).filter(
        Quote.id == quote_id,
        Quote.is_deleted == False
    ).first()
    
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Quote not found"
        )
    
    return quote


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
    
    if quote.status != QuoteStatus.SENT: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only sent quotes can be approved"
        )
    
    quote.status = QuoteStatus.APPROVED # type: ignore
    quote.approved_date = datetime.utcnow() # type: ignore
    
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
    
    if quote.status != QuoteStatus.DRAFT: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft quotes can be sent"
        )
    
    quote.status = QuoteStatus.SENT # type: ignore
    
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
    
    quote.is_deleted = True # type: ignore
    db.commit()
    
    return None