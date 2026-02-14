from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date

from app.db.base import get_db
from app.models.user import User
from app.models.crm import Lead, LeadStatus, Account, Contact, Opportunity, OpportunityStage
from app.schemas.crm import (
    LeadCreate, LeadUpdate, LeadResponse, LeadConvert, LeadConversionResponse
)
from app.api.dependencies import get_current_active_user, require_sales
from app.utils.date_utils import (
    apply_date_filter,
    get_date_range_for_period,
    validate_date_range,
    DateRangeError
)

router = APIRouter()


def parse_lead_status(status_str: str) -> Optional[LeadStatus]:
    """Parse status string to LeadStatus enum, case-insensitive."""
    if not status_str:
        return None
    
    try:
        return LeadStatus(status_str)
    except ValueError:
        pass
    
    status_upper = status_str.upper()
    for status_enum in LeadStatus:
        if status_enum.name == status_upper:
            return status_enum
        if status_enum.value.upper() == status_upper:
            return status_enum
    
    return None


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


@router.get("/")
def list_leads(
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = Query(None, alias="status"),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    source: Optional[str] = Query(None, description="Filter by lead source"),
    start_date: Optional[date] = Query(None, description="Filter leads on or after this date"),
    end_date: Optional[date] = Query(None, description="Filter leads on or before this date"),
    date_field: str = Query("created_at", description="Date field to filter on", regex="^(created_at|converted_date)$"),
    period: Optional[str] = Query(None, description="Preset period: last_7_days, last_30_days, this_month, etc."),
    is_converted: Optional[bool] = Query(None, description="Filter by conversion status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    List all leads with optional filters.
    
    Date filtering options:
    - Use `start_date` and `end_date` for custom range
    - Or use `period` for presets: today, yesterday, this_week, last_week,
      this_month, last_month, this_quarter, last_quarter, this_year, last_year,
      last_7_days, last_30_days, last_90_days, last_365_days
    - Use `date_field` to specify which date to filter (created_at, converted_date)
    """
    from sqlalchemy.orm import joinedload
    
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
    
    query = db.query(Lead).filter(Lead.is_deleted == False)
    
    # Parse and apply status filter
    if status_filter:
        parsed_status = parse_lead_status(status_filter)
        if parsed_status:
            query = query.filter(Lead.status == parsed_status)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}. Valid values: {[s.value for s in LeadStatus]}"
            )
    
    if owner_id:
        query = query.filter(Lead.owner_id == owner_id)
    
    if source:
        query = query.filter(Lead.source == source)
    
    if is_converted is not None:
        query = query.filter(Lead.is_converted == is_converted)
    
    # Apply date filtering
    query = apply_date_filter(query, Lead, start_date, end_date, date_field)
    
    # Include owner relationship
    query = query.options(joinedload(Lead.owner))
    
    leads = query.order_by(Lead.created_at.desc()).offset(skip).limit(limit).all()
    
    # Format response with owner name
    return [
        {
            **LeadResponse.model_validate(lead).model_dump(),
            "owner_name": lead.owner.full_name if lead.owner else None
        }
        for lead in leads
    ]


@router.get("/stats")
def get_lead_stats(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    period: Optional[str] = Query(None, description="Preset period"),
    owner_id: Optional[UUID] = Query(None, description="Filter by owner"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get lead statistics summary.
    """
    from sqlalchemy import func, case
    from sqlalchemy.orm import joinedload
    from app.utils.date_utils import build_date_filters, format_date_range
    
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
    
    base_filter = [Lead.is_deleted == False]
    base_filter.extend(build_date_filters(Lead, start_date, end_date))
    
    if owner_id:
        base_filter.append(Lead.owner_id == owner_id)
    
    # Total counts
    total_leads = db.query(Lead).filter(*base_filter).count()
    converted = db.query(Lead).filter(*base_filter, Lead.is_converted == True).count()
    
    # By status
    by_status = db.query(
        Lead.status,
        func.count(Lead.id).label('count')
    ).filter(*base_filter).group_by(Lead.status).all()
    
    # By source
    by_source = db.query(
        Lead.source,
        func.count(Lead.id).label('count')
    ).filter(*base_filter).group_by(Lead.source).all()
    
    # By owner
    by_owner = db.query(
        Lead.owner_id,
        User.first_name,
        User.last_name,
        func.count(Lead.id).label('count'),
        func.sum(func.case((Lead.is_converted == True, 1), else_=0)).label('converted')
    ).join(User, Lead.owner_id == User.id).filter(
        *base_filter
    ).group_by(Lead.owner_id, User.first_name, User.last_name).all()
    
    conversion_rate = (converted / total_leads * 100) if total_leads > 0 else 0
    
    return {
        'total_leads': total_leads,
        'converted_leads': converted,
        'conversion_rate': round(conversion_rate, 2),
        'by_status': [{'status': s.status.value if s.status else 'Unknown', 'count': s.count} for s in by_status],
        'by_source': [{'source': s.source.value if s.source else 'Unknown', 'count': s.count} for s in by_source],
        'by_owner': [
            {
                'owner_id': str(o.owner_id),
                'owner_name': f"{o.first_name} {o.last_name}",
                'count': o.count,
                'converted': o.converted or 0
            }
            for o in by_owner
        ],
        'date_range': format_date_range(start_date, end_date)
    }


@router.get("/{lead_id}")
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_sales)
):
    """
    Get lead by ID.
    """
    from sqlalchemy.orm import joinedload
    
    lead = db.query(Lead).options(
        joinedload(Lead.owner)
    ).filter(
        Lead.id == lead_id,
        Lead.is_deleted == False
    ).first()
    
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found"
        )
    
    return {
        **LeadResponse.model_validate(lead).model_dump(),
        "owner_name": lead.owner.full_name if lead.owner else None
    }


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
    if lead.is_converted:  # type: ignore
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
    
    if lead.is_converted:  # type: ignore
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
        lead.is_converted = True  # type: ignore
        lead.converted_date = datetime.utcnow()  # type: ignore
        lead.converted_account_id = account.id
        lead.converted_contact_id = contact.id
        lead.status = LeadStatus.CONVERTED  # type: ignore
        
        db.commit()
        
        return LeadConversionResponse(
            account_id=account.id,  # type: ignore
            contact_id=contact.id,  # type: ignore
            opportunity_id=opportunity_id,  # type: ignore
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
    
    lead.is_deleted = True  # type: ignore
    db.commit()
    
    return None