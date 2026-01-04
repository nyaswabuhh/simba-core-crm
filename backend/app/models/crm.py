from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base

class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    address = Column(Text)
    city = Column(String(100))
    phone = Column(String(50))
    email = Column(String(255))
    website = Column(String(255))
    logo_url = Column(String(500))  # URL to logo image
    payment_details = Column(Text)  # Bank details, etc.


class LeadStatus(str, enum.Enum):
    NEW = "New"
    CONTACTED = "Contacted"
    QUALIFIED = "Qualified"
    UNQUALIFIED = "Unqualified"
    CONVERTED = "Converted"


class LeadSource(str, enum.Enum):
    WEBSITE = "Website"
    REFERRAL = "Referral"
    SOCIAL_MEDIA = "Social Media"
    EMAIL_CAMPAIGN = "Email Campaign"
    COLD_CALL = "Cold Call"
    TRADE_SHOW = "Trade Show"
    OTHER = "Other"


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50))
    company = Column(String(255))
    job_title = Column(String(100))
    industry = Column(String(100))
    website = Column(String(255))
    
    status = Column(SQLEnum(LeadStatus), nullable=False, default=LeadStatus.NEW)
    source = Column(SQLEnum(LeadSource), nullable=False, default=LeadSource.WEBSITE)
    
    estimated_value = Column(Numeric(10, 2))
    notes = Column(Text)
    
    # Conversion tracking
    is_converted = Column(Boolean, default=False, nullable=False)
    converted_date = Column(DateTime(timezone=True))
    converted_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    converted_contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    
    # Owner
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", backref="leads")
    converted_account = relationship("Account", foreign_keys=[converted_account_id])
    converted_contact = relationship("Contact", foreign_keys=[converted_contact_id])

    def __repr__(self):
        return f"<Lead {self.first_name} {self.last_name}>"


class Account(Base):
    __tablename__ = "accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100))
    website = Column(String(255))
    phone = Column(String(50))
    billing_address = Column(Text)
    shipping_address = Column(Text)
    description = Column(Text)
    
    # Owner
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", backref="accounts")
    contacts = relationship("Contact", back_populates="account", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="account", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Account {self.name}>"


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50))
    mobile = Column(String(50))
    job_title = Column(String(100))
    department = Column(String(100))
    
    is_primary = Column(Boolean, default=False, nullable=False)
    notes = Column(Text)
    
    # Owner
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    account = relationship("Account", back_populates="contacts")
    owner = relationship("User", backref="contacts")

    def __repr__(self):
        return f"<Contact {self.first_name} {self.last_name}>"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class OpportunityStage(str, enum.Enum):
    PROSPECTING = "Prospecting"
    QUALIFICATION = "Qualification"
    PROPOSAL = "Proposal"
    NEGOTIATION = "Negotiation"
    CLOSED_WON = "Closed Won"
    CLOSED_LOST = "Closed Lost"


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    
    name = Column(String(255), nullable=False)
    stage = Column(SQLEnum(OpportunityStage), nullable=False, default=OpportunityStage.PROSPECTING)
    amount = Column(Numeric(10, 2), nullable=False)
    probability = Column(Numeric(5, 2), default=0)  # 0-100
    expected_close_date = Column(DateTime(timezone=True))
    
    description = Column(Text)
    next_step = Column(Text)
    
    # Owner
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    closed_date = Column(DateTime(timezone=True))
    
    # Relationships
    account = relationship("Account", back_populates="opportunities")
    owner = relationship("User", backref="opportunities")

    def __repr__(self):
        return f"<Opportunity {self.name}>"