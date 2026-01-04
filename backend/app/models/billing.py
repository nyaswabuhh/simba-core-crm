from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Numeric, Enum as SQLEnum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.db.base import Base


class ProductType(str, enum.Enum):
    PRODUCT = "Product"
    SERVICE = "Service"


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    sku = Column(String(100), unique=True, index=True)
    description = Column(Text)
    product_type = Column(SQLEnum(ProductType), nullable=False, default=ProductType.PRODUCT)
    
    unit_price = Column(Numeric(10, 2), nullable=False)
    cost = Column(Numeric(10, 2))
    
    is_active = Column(Boolean, default=True, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Product {self.name}>"


class QuoteStatus(str, enum.Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    APPROVED = "Approved"
    REJECTED = "Rejected"
    EXPIRED = "Expired"
    CONVERTED = "Converted"


class Quote(Base):
    __tablename__ = "quotes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_number = Column(String(50), unique=True, nullable=False, index=True)
    
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id"))
    
    status = Column(SQLEnum(QuoteStatus), nullable=False, default=QuoteStatus.DRAFT)
    
    # Financial fields
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    tax_rate = Column(Numeric(5, 2), default=0)  # Percentage
    tax_amount = Column(Numeric(10, 2), default=0)
    discount_type = Column(String(20))  # 'percentage' or 'flat'
    discount_value = Column(Numeric(10, 2), default=0)
    discount_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), nullable=False, default=0)
    
    # Dates
    valid_until = Column(DateTime(timezone=True))
    
    # Additional info
    notes = Column(Text)
    terms_conditions = Column(Text)
    
    # Owner
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    approved_date = Column(DateTime(timezone=True))
    
    # Relationships
    account = relationship("Account", backref="quotes")
    contact = relationship("Contact", backref="quotes")
    opportunity = relationship("Opportunity", backref="quotes")
    owner = relationship("User", backref="quotes")
    items = relationship("QuoteItem", back_populates="quote", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Quote {self.quote_number}>"


class QuoteItem(Base):
    __tablename__ = "quote_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    quote_id = Column(UUID(as_uuid=True), ForeignKey("quotes.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    description = Column(Text)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    quote = relationship("Quote", back_populates="items")
    product = relationship("Product", backref="quote_items")

    def __repr__(self):
        return f"<QuoteItem {self.product_id}>"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "Draft"
    SENT = "Sent"
    UNPAID = "Unpaid"
    PARTIAL = "Partial"
    PAID = "Paid"
    OVERDUE = "Overdue"
    CANCELLED = "Cancelled"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    
    quote_id = Column(UUID(as_uuid=True), ForeignKey("quotes.id"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=False)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    
    status = Column(SQLEnum(InvoiceStatus), nullable=False, default=InvoiceStatus.DRAFT)
    
    # Financial fields - IMMUTABLE after creation
    subtotal = Column(Numeric(10, 2), nullable=False)
    tax_rate = Column(Numeric(5, 2), nullable=False)
    tax_amount = Column(Numeric(10, 2), nullable=False)
    discount_type = Column(String(20))
    discount_value = Column(Numeric(10, 2))
    discount_amount = Column(Numeric(10, 2), nullable=False)
    total_amount = Column(Numeric(10, 2), nullable=False)
    
    # Payment tracking
    amount_paid = Column(Numeric(10, 2), default=0, nullable=False)
    amount_due = Column(Numeric(10, 2), nullable=False)
    
    # Dates
    issue_date = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_date = Column(DateTime(timezone=True))
    
    # Additional info
    notes = Column(Text)
    terms_conditions = Column(Text)
    
    # Owner
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    quote = relationship("Quote", backref="invoices")
    account = relationship("Account", backref="invoices")
    contact = relationship("Contact", backref="invoices")
    owner = relationship("User", backref="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Invoice {self.invoice_number}>"


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    description = Column(Text, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    discount_percentage = Column(Numeric(5, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Relationships
    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product", backref="invoice_items")

    def __repr__(self):
        return f"<InvoiceItem {self.product_id}>"


class PaymentMethod(str, enum.Enum):
    CASH = "Cash"
    MPESA="MPESA"
    CHECK = "Check"
    CREDIT_CARD = "Credit Card"
    BANK_TRANSFER = "Bank Transfer"
    PAYPAL = "PayPal"
    STRIPE = "Stripe"
    OTHER = "Other"


class PaymentStatus(str, enum.Enum):
    PENDING = "Pending"
    COMPLETED = "Completed"
    FAILED = "Failed"
    REFUNDED = "Refunded"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    payment_number = Column(String(50), unique=True, nullable=False, index=True)
    
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=False)
    status = Column(SQLEnum(PaymentStatus), nullable=False, default=PaymentStatus.COMPLETED)
    
    payment_date = Column(DateTime(timezone=True), nullable=False)
    
    # Payment details
    reference_number = Column(String(100))
    notes = Column(Text)
    
    # Processor info (for Stripe, PayPal, etc.)
    transaction_id = Column(String(255))
    processor = Column(String(50))
    
    # Owner
    processed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    invoice = relationship("Invoice", back_populates="payments")
    processor_user = relationship("User", backref="processed_payments")

    def __repr__(self):
        return f"<Payment {self.payment_number}>"