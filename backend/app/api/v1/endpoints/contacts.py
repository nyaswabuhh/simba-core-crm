from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import List, Optional
from uuid import UUID
from datetime import date

from app.db.base import get_db
from app.models.user import User
from app.models.crm import Contact, Account
from app.schemas.crm import ContactCreate, ContactUpdate, ContactResponse
from app.api.dependencies import get_current_active_user, require_sales
from app.utils.date_utils import (
    apply_date_filter,
    get_date_range_for_period,
    validate_date_range,
    build_date_filters,
    format_date_range,
    DateRangeError
)

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


@router.get("/")
def list_contacts(
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[UUID] = Query(None, description="Filter by account"),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    search: Optional[str] = Query(None, description="Search by name, email, phone"),
    is_primary: Optional[bool] = Query(None, description="Filter by primary status"),
    start_date: Optional[date] = Query(None, description="Filter contacts created on or after this date"),
    end_date: Optional[date] = Query(None, description="Filter contacts created on or before this date"),
    date_field: str = Query("created_at", description="Date field to filter on", regex="^(created_at|updated_at)$"),
    period: Optional[str] = Query(None, description="Preset period: last_7_days, last_30_days, this_month, etc."),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all contacts with optional filters.
    
    Date filtering options:
    - Use `start_date` and `end_date` for custom range
    - Or use `period` for presets: today, yesterday, this_week, last_week,
      this_month, last_month, this_quarter, last_quarter, this_year, last_year,
      last_7_days, last_30_days, last_90_days, last_365_days
    - Use `date_field` to specify which date to filter (created_at, updated_at)
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
    try:
        validate_date_range(start_date, end_date)
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    query = db.query(Contact).filter(Contact.is_deleted == False)
    
    if account_id:
        query = query.filter(Contact.account_id == account_id)
    
    if owner_id:
        query = query.filter(Contact.owner_id == owner_id)
    
    if is_primary is not None:
        query = query.filter(Contact.is_primary == is_primary)
    
    # Search filter
    if search:
        search_term = f"%{search}%"
        from sqlalchemy import or_
        query = query.filter(
            or_(
                Contact.first_name.ilike(search_term),
                Contact.last_name.ilike(search_term),
                Contact.email.ilike(search_term),
                Contact.phone.ilike(search_term),
                Contact.title.ilike(search_term)
            )
        )
    
    # Apply date filtering
    query = apply_date_filter(query, Contact, start_date, end_date, date_field)
    
    # Include owner relationship
    query = query.options(joinedload(Contact.owner))
    
    contacts = query.order_by(Contact.created_at.desc()).offset(skip).limit(limit).all()
    
    # Return with owner_name
    return [
        {
            **ContactResponse.model_validate(contact).model_dump(),
            "owner_name": contact.owner.full_name if contact.owner else None
        }
        for contact in contacts
    ]


@router.get("/stats")
def get_contact_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None, description="Preset period"),
    account_id: Optional[UUID] = Query(None, description="Filter by account"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get contact statistics with breakdown by owner.
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
    
    try:
        validate_date_range(start_date, end_date)
    except DateRangeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    base_filter = [Contact.is_deleted == False]
    base_filter.extend(build_date_filters(Contact, start_date, end_date))
    
    if account_id:
        base_filter.append(Contact.account_id == account_id)
    
    # Total counts
    total_contacts = db.query(Contact).filter(*base_filter).count()
    primary_contacts = db.query(Contact).filter(*base_filter, Contact.is_primary == True).count()
    
    # By owner
    by_owner = db.query(
        Contact.owner_id,
        User.first_name,
        User.last_name,
        func.count(Contact.id).label('count'),
        func.sum(case(
            (Contact.is_primary == True, 1),
            else_=0
        )).label('primary_count')
    ).join(User, Contact.owner_id == User.id).filter(
        *base_filter
    ).group_by(Contact.owner_id, User.first_name, User.last_name).all()
    
    # By account (top 10)
    by_account = db.query(
        Contact.account_id,
        Account.name,
        func.count(Contact.id).label('count')
    ).join(Account, Contact.account_id == Account.id).filter(
        *base_filter
    ).group_by(Contact.account_id, Account.name).order_by(
        func.count(Contact.id).desc()
    ).limit(10).all()
    
    return {
        'total_contacts': total_contacts,
        'primary_contacts': primary_contacts,
        'by_owner': [
            {
                'owner_id': str(o.owner_id),
                'owner_name': f"{o.first_name} {o.last_name}",
                'count': o.count,
                'primary_count': o.primary_count or 0
            }
            for o in by_owner
        ],
        'by_account': [
            {
                'account_id': str(a.account_id),
                'account_name': a.name,
                'count': a.count
            }
            for a in by_account
        ],
        'date_range': format_date_range(start_date, end_date)
    }


@router.get("/{contact_id}")
def get_contact(
    contact_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get contact by ID.
    """
    contact = db.query(Contact).options(
        joinedload(Contact.owner)
    ).filter(
        Contact.id == contact_id,
        Contact.is_deleted == False
    ).first()
    
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contact not found"
        )
    
    return {
        **ContactResponse.model_validate(contact).model_dump(),
        "owner_name": contact.owner.full_name if contact.owner else None
    }


@router.put("/{contact_id}")
def update_contact(
    contact_id: UUID,
    contact_update: ContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update contact.
    """
    contact = db.query(Contact).options(
        joinedload(Contact.owner)
    ).filter(
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
    
    return {
        **ContactResponse.model_validate(contact).model_dump(),
        "owner_name": contact.owner.full_name if contact.owner else None
    }


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
    
    contact.is_deleted = True  # type: ignore
    db.commit()
    
    return None