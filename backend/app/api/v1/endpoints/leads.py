from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.db.base import get_db
from app.models.user import User
from app.models.crm import Lead, LeadStatus, Account, Contact, Opportunity, OpportunityStage
from app.schemas.crm import (
    LeadCreate, LeadUpdate, LeadResponse, LeadConvert, LeadConversionResponse
)
from app.api.dependencies import get_current_active_user, require_sales

router = APIRouter()


@router.post("/", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(
    lead_data: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Create a new lead.
    """
    db_lead = Lead(
        **lead_data.model_dump(),
        owner_id=current_user.id
    )
    
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)
    
    return db_lead


@router.get("/", response_model=List[LeadResponse])
def list_leads(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[LeadStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all leads with optional status filter.
    """
    query = db.query(Lead).filter(Lead.is_deleted == False)
    
    if status_filter:
        query = query.filter(Lead.status == status_filter)
    
    leads = query.offset(skip).limit(limit).all()
    return leads


@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get lead by ID.
    """
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.is_deleted == False
    ).first()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    return lead


@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: UUID,
    lead_update: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Update lead.
    """
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.is_deleted == False
    ).first()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    # Check if lead is already converted
    if lead.is_converted: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot update a converted lead"
        )
    
    # Update fields
    update_data = lead_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)
    
    db.commit()
    db.refresh(lead)
    
    return lead


@router.post("/{lead_id}/convert", response_model=LeadConversionResponse)
def convert_lead(
    lead_id: UUID,
    conversion_data: LeadConvert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Convert lead to Account, Contact, and optionally Opportunity.
    This is a transactional operation.
    """
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.is_deleted == False
    ).first()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    if lead.is_converted: # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead is already converted"
        )
    
    try:
        # Create Account
        account = Account(
            name=lead.company or f"{lead.first_name} {lead.last_name}",
            industry=lead.industry,
            website=lead.website,
            phone=lead.phone,
            owner_id=current_user.id
        )
        db.add(account)
        db.flush()  # Get account ID without committing
        
        # Create Contact
        contact = Contact(
            account_id=account.id,
            first_name=lead.first_name,
            last_name=lead.last_name,
            email=lead.email,
            phone=lead.phone,
            job_title=lead.job_title,
            is_primary=True,
            notes=lead.notes,
            owner_id=current_user.id
        )
        db.add(contact)
        db.flush()
        
        opportunity_id = None
        
        # Create Opportunity if requested
        if conversion_data.create_opportunity:
            opp_name = conversion_data.opportunity_name or f"Opportunity from {lead.first_name} {lead.last_name}"
            opp_amount = conversion_data.opportunity_amount or lead.estimated_value or 0
            
            opportunity = Opportunity(
                account_id=account.id,
                name=opp_name,
                stage=OpportunityStage.QUALIFICATION,
                amount=opp_amount,
                probability=25,
                expected_close_date=conversion_data.opportunity_close_date,
                description=f"Converted from lead: {lead.first_name} {lead.last_name}",
                owner_id=current_user.id
            )
            db.add(opportunity)
            db.flush()
            opportunity_id = opportunity.id
        
        # Update lead as converted
        lead.is_converted = True # type: ignore
        lead.converted_date = datetime.utcnow() # type: ignore
        lead.converted_account_id = account.id
        lead.converted_contact_id = contact.id
        lead.status = LeadStatus.CONVERTED # type: ignore
        
        db.commit()
        
        return LeadConversionResponse(
            account_id=account.id, # type: ignore
            contact_id=contact.id, # type: ignore
            opportunity_id=opportunity_id, # type: ignore
            message="Lead converted successfully"
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error converting lead: {str(e)}"
        )


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Soft delete lead.
    """
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.is_deleted == False
    ).first()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    lead.is_deleted = True # type: ignore
    db.commit()
    
    return None