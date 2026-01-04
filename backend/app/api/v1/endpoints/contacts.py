from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from app.db.base import get_db
from app.models.user import User
from app.models.crm import Contact, Account
from app.schemas.crm import ContactCreate, ContactUpdate, ContactResponse
from app.api.dependencies import get_current_active_user, require_sales

router = APIRouter()


@router.post("/", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
def create_contact(
    contact_data: ContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Create a new contact.
    """
    # Verify account exists
    account = db.query(Account).filter(
        Account.id == contact_data.account_id,
        Account.is_deleted == False
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # If setting as primary, unset other primary contacts for this account
    if contact_data.is_primary:
        db.query(Contact).filter(
            Contact.account_id == contact_data.account_id,
            Contact.is_primary == True
        ).update({"is_primary": False})
    
    db_contact = Contact(
        **contact_data.model_dump(),
        owner_id=current_user.id
    )
    
    db.add(db_contact)
    db.commit()
    db.refresh(db_contact)
    
    return db_contact


@router.get("/", response_model=List[ContactResponse])
def list_contacts(
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all contacts, optionally filtered by account.
    """
    query = db.query(Contact).filter(Contact.is_deleted == False)
    
    if account_id:
        query = query.filter(Contact.account_id == account_id)
    
    contacts = query.offset(skip).limit(limit).all()
    return contacts


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get contact by ID.
    """
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.is_deleted == False
    ).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: UUID,
    contact_update: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update contact.
    """
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.is_deleted == False
    ).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    # If updating account_id, verify new account exists
    update_data = contact_update.model_dump(exclude_unset=True)
    if "account_id" in update_data:
        account = db.query(Account).filter(
            Account.id == update_data["account_id"],
            Account.is_deleted == False
        ).first()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found"
            )
    
    # If setting as primary, unset other primary contacts
    if update_data.get("is_primary") == True:
        account_id = update_data.get("account_id", contact.account_id)
        db.query(Contact).filter(
            Contact.account_id == account_id,
            Contact.is_primary == True,
            Contact.id != contact_id
        ).update({"is_primary": False})
    
    # Update fields
    for field, value in update_data.items():
        setattr(contact, field, value)
    
    db.commit()
    db.refresh(contact)
    
    return contact


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Soft delete contact.
    """
    contact = db.query(Contact).filter(
        Contact.id == contact_id,
        Contact.is_deleted == False
    ).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    contact.is_deleted = True # type: ignore
    db.commit()
    
    return None