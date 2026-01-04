from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.db.base import get_db
from app.models.user import User
from app.models.crm import Account
from app.schemas.crm import AccountCreate, AccountUpdate, AccountResponse
from app.api.dependencies import get_current_active_user, require_sales

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


@router.get("/", response_model=List[AccountResponse])
def list_accounts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all accounts.
    """
    accounts = db.query(Account).filter(
        Account.is_deleted == False
    ).offset(skip).limit(limit).all()
    
    return accounts


@router.get("/{account_id}", response_model=AccountResponse)
def get_account(
    account_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get account by ID.
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
    
    return account


@router.put("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: UUID,
    account_update: AccountUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update account.
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
    
    # Update fields
    update_data = account_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(account, field, value)
    
    db.commit()
    db.refresh(account)
    
    return account


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
    
    account.is_deleted = True # type: ignore
    db.commit()
        
    return None