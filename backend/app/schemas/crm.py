from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from datetime import datetime
from uuid import UUID
from decimal import Decimal
from app.models.crm import LeadStatus, LeadSource, OpportunityStage
from app.schemas.user import UserSummary


# ==================== LEAD SCHEMAS ====================

class LeadBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=255)
    job_title: Optional[str] = Field(None, max_length=100)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    status: LeadStatus = LeadStatus.NEW
    source: LeadSource = LeadSource.WEBSITE
    estimated_value: Optional[Decimal] = None
    notes: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    status: Optional[LeadStatus] = None
    source: Optional[LeadSource] = None
    estimated_value: Optional[Decimal] = None
    notes: Optional[str] = None


class LeadResponse(LeadBase):
    id: UUID
    is_converted: bool
    converted_date: Optional[datetime] = None
    converted_account_id: Optional[UUID] = None
    converted_contact_id: Optional[UUID] = None
    owner_id: UUID
    owner: UserSummary
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadConvert(BaseModel):
    """Schema for lead conversion"""
    create_opportunity: bool = True
    opportunity_name: Optional[str] = None
    opportunity_amount: Optional[Decimal] = None
    opportunity_close_date: Optional[datetime] = None


class LeadConversionResponse(BaseModel):
    account_id: UUID
    contact_id: UUID
    opportunity_id: Optional[UUID] = None
    message: str


# ==================== ACCOUNT SCHEMAS ====================

class AccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = Field(None, max_length=100)
    website: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    description: Optional[str] = None

class AccountSummary(BaseModel):
    """Simplified account info for nested responses"""
    id: UUID
    name: str
    
    class Config:
        from_attributes = True

class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None
    description: Optional[str] = None


class AccountResponse(AccountBase):
    id: UUID
    owner_id: UUID
    owner: UserSummary
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== CONTACT SCHEMAS ====================

class ContactBase(BaseModel):
    account_id: UUID
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=50)
    mobile: Optional[str] = Field(None, max_length=50)
    job_title: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    is_primary: bool = False
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    account_id: Optional[UUID] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    job_title: Optional[str] = None
    department: Optional[str] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class ContactResponse(ContactBase):
    id: UUID
    owner_id: UUID
    owner: UserSummary
    full_name: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== OPPORTUNITY SCHEMAS ====================

class OpportunityBase(BaseModel):
    account_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    stage: OpportunityStage = OpportunityStage.PROSPECTING
    amount: Decimal = Field(..., ge=0)    
    probability: Decimal = Field(Decimal("0"), ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    description: Optional[str] = None
    next_step: Optional[str] = None


class OpportunityCreate(OpportunityBase):
    pass


class OpportunityUpdate(BaseModel):
    account_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    stage: Optional[OpportunityStage] = None
    amount: Optional[Decimal] = Field(None, ge=0)
    probability: Optional[Decimal] = Field(None, ge=0, le=100)
    expected_close_date: Optional[datetime] = None
    description: Optional[str] = None
    next_step: Optional[str] = None


class OpportunityResponse(OpportunityBase):
    id: UUID
    owner_id: UUID
    owner: UserSummary
    account: Optional[AccountSummary] = None
    closed_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True