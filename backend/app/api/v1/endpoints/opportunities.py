from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.db.base import get_db
from app.models.user import User
from app.models.crm import Opportunity, Account, OpportunityStage
from app.schemas.crm import OpportunityCreate, OpportunityUpdate, OpportunityResponse
from app.api.dependencies import get_current_active_user, require_sales

router = APIRouter()


@router.post("/", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    opportunity_data: OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Create a new opportunity.
    """
    # Verify account exists
    account = db.query(Account).filter(
        Account.id == opportunity_data.account_id,
        Account.is_deleted == False
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found"
        )
    
    db_opportunity = Opportunity(
        **opportunity_data.model_dump(),
        owner_id=current_user.id
    )
    
    db.add(db_opportunity)
    db.commit()
    db.refresh(db_opportunity)
    
    return db_opportunity


@router.get("/", response_model=List[OpportunityResponse])
def list_opportunities(
    skip: int = 0,
    limit: int = 100,
    account_id: Optional[UUID] = Query(None),
    stage: Optional[OpportunityStage] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all opportunities with optional filters.
    """
    query = db.query(Opportunity).filter(Opportunity.is_deleted == False)
    
    if account_id:
        query = query.filter(Opportunity.account_id == account_id)
    
    if stage:
        query = query.filter(Opportunity.stage == stage)
    
    opportunities = query.offset(skip).limit(limit).all()
    return opportunities


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
def get_opportunity(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get opportunity by ID.
    """
    opportunity = db.query(Opportunity).filter(
        Opportunity.id == opportunity_id,
        Opportunity.is_deleted == False
    ).first()
    
    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )
    
    return opportunity


@router.put("/{opportunity_id}", response_model=OpportunityResponse)
def update_opportunity(
    opportunity_id: UUID,
    opportunity_update: OpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update opportunity.
    """
    opportunity = db.query(Opportunity).filter(
        Opportunity.id == opportunity_id,
        Opportunity.is_deleted == False
    ).first()
    
    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )
    
    # If updating account_id, verify new account exists
    update_data = opportunity_update.model_dump(exclude_unset=True)
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
    
    # If stage is being changed to closed won or lost, set closed_date
    if "stage" in update_data:
        new_stage = update_data["stage"]
        if new_stage in [OpportunityStage.CLOSED_WON, OpportunityStage.CLOSED_LOST]:
            if not opportunity.closed_date: # type: ignore
                opportunity.closed_date = datetime.utcnow() # type: ignore
        else:
            # If reopening, clear closed_date
            opportunity.closed_date = None # type: ignore
    
    # Update fields
    for field, value in update_data.items():
        setattr(opportunity, field, value)
    
    db.commit()
    db.refresh(opportunity)
    
    return opportunity


@router.delete("/{opportunity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity(
    opportunity_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Soft delete opportunity.
    """
    opportunity = db.query(Opportunity).filter(
        Opportunity.id == opportunity_id,
        Opportunity.is_deleted == False
    ).first()
    
    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opportunity not found"
        )
    
    opportunity.is_deleted = True # type: ignore
    db.commit()
    
    return None