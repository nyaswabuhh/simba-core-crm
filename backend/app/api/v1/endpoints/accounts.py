from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case
from typing import List, Optional
from uuid import UUID
from datetime import date

from app.db.base import get_db
from app.models.user import User
from app.models.crm import Account
from app.schemas.crm import AccountCreate, AccountUpdate, AccountResponse
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


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    account_data: AccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Create a new account.
    """
    db_account = Account(
        **account_data.model_dump(),
        owner_id=current_user.id
    )
    
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    
    return db_account


@router.get("/")
def list_accounts(
    skip: int = 0,
    limit: int = 100,
    industry: Optional[str] = Query(None, description="Filter by industry"),
    account_type: Optional[str] = Query(None, alias="type", description="Filter by account type"),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    start_date: Optional[date] = Query(None, description="Filter accounts created on or after this date"),
    end_date: Optional[date] = Query(None, description="Filter accounts created on or before this date"),
    date_field: str = Query("created_at", description="Date field to filter on", regex="^(created_at|updated_at)$"),
    period: Optional[str] = Query(None, description="Preset period: last_7_days, last_30_days, this_month, etc."),
    search: Optional[str] = Query(None, description="Search by name, website, or phone"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all accounts with optional filters.
    
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
    
    query = db.query(Account).filter(Account.is_deleted == False)
    
    # Apply filters
    if industry:
        query = query.filter(Account.industry == industry)
    
    if account_type:
        query = query.filter(Account.type == account_type)
    
    if owner_id:
        query = query.filter(Account.owner_id == owner_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Account.name.ilike(search_term)) |
            (Account.website.ilike(search_term)) |
            (Account.phone.ilike(search_term))
        )
    
    # Apply date filtering
    query = apply_date_filter(query, Account, start_date, end_date, date_field)
    
    # Include owner relationship
    query = query.options(joinedload(Account.owner))
    
    accounts = query.order_by(Account.created_at.desc()).offset(skip).limit(limit).all()
    
    # Format response with owner name
    return [
        {
            **AccountResponse.model_validate(account).model_dump(),
            "owner_name": account.owner.full_name if account.owner else None
        }
        for account in accounts
    ]


@router.get("/stats")
def get_account_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None, description="Preset period"),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get account statistics summary.
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
    
    base_filter = [Account.is_deleted == False]
    base_filter.extend(build_date_filters(Account, start_date, end_date))
    
    if owner_id:
        base_filter.append(Account.owner_id == owner_id)
    
    # Total count
    total_accounts = db.query(Account).filter(*base_filter).count()
    
    # By industry
    by_industry = db.query(
        Account.industry,
        func.count(Account.id).label('count')
    ).filter(*base_filter).group_by(Account.industry).all()
    
    # By type
    by_type = db.query(
        Account.type,
        func.count(Account.id).label('count')
    ).filter(*base_filter).group_by(Account.type).all()
    
    # By owner
    by_owner = db.query(
        Account.owner_id,
        User.first_name,
        User.last_name,
        func.count(Account.id).label('count')
    ).join(User, Account.owner_id == User.id).filter(
        *base_filter
    ).group_by(Account.owner_id, User.first_name, User.last_name).all()
    
    return {
        'total_accounts': total_accounts,
        'by_industry': [
            {'industry': i.industry or 'Unknown', 'count': i.count} 
            for i in by_industry
        ],
        'by_type': [
            {'type': t.type or 'Unknown', 'count': t.count} 
            for t in by_type
        ],
        'by_owner': [
            {
                'owner_id': str(o.owner_id),
                'owner_name': f"{o.first_name} {o.last_name}",
                'count': o.count
            }
            for o in by_owner
        ],
        'date_range': format_date_range(start_date, end_date)
    }


@router.get("/{account_id}")
def get_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get account by ID.
    """
    account = db.query(Account).options(
        joinedload(Account.owner)
    ).filter(
        Account.id == account_id,
        Account.is_deleted == False
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    return {
        **AccountResponse.model_validate(account).model_dump(),
        "owner_name": account.owner.full_name if account.owner else None
    }


@router.put("/{account_id}")
def update_account(
    account_id: UUID,
    account_update: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update account.
    """
    account = db.query(Account).options(
        joinedload(Account.owner)
    ).filter(
        Account.id == account_id,
        Account.is_deleted == False
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    # Update fields
    update_data = account_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    
    db.commit()
    db.refresh(account)
    
    return {
        **AccountResponse.model_validate(account).model_dump(),
        "owner_name": account.owner.full_name if account.owner else None
    }


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Soft delete account.
    """
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.is_deleted == False
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    account.is_deleted = True  # type: ignore
    db.commit()
        
    return None