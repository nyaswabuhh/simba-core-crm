from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from decimal import Decimal
from app.models.billing import (
    ProductType, QuoteStatus, InvoiceStatus, PaymentMethod, PaymentStatus
)
from app.schemas.user import UserSummary


# ==================== PRODUCT SCHEMAS ====================

class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    product_type: ProductType = ProductType.PRODUCT
    unit_price: Decimal = Field(..., ge=0)
    cost: Optional[Decimal] = Field(None, ge=0)
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    sku: Optional[str] = None
    description: Optional[str] = None
    product_type: Optional[ProductType] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    cost: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== QUOTE ITEM SCHEMAS ====================

class QuoteItemBase(BaseModel):
    product_id: UUID
    description: Optional[str] = None
    quantity: int = Field(..., ge=1)
    unit_price: Decimal = Field(..., ge=0)
    discount_percentage: Decimal = Field(Decimal("0"), ge=0, le=100)


class QuoteItemCreate(QuoteItemBase):
    pass


class QuoteItemResponse(QuoteItemBase):
    id: UUID
    quote_id: UUID
    total: Decimal
    product: ProductResponse
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== QUOTE SCHEMAS ====================

class QuoteBase(BaseModel):
    account_id: UUID
    contact_id: Optional[UUID] = None
    opportunity_id: Optional[UUID] = None
    tax_rate: Decimal = Field(Decimal("0"), ge=0, le=100)
    discount_type: Optional[str] = Field(None, pattern="^(percentage|flat)$")
    discount_value: Decimal = Field(Decimal("0"), ge=0)
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None


class QuoteCreate(QuoteBase):
    items: List[QuoteItemCreate] = Field(..., min_length=1)


class QuoteUpdate(BaseModel):
    account_id: Optional[UUID] = None
    contact_id: Optional[UUID] = None
    opportunity_id: Optional[UUID] = None
    status: Optional[QuoteStatus] = None
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=100)
    discount_type: Optional[str] = Field(None, pattern="^(percentage|flat)$")
    discount_value: Optional[Decimal] = Field(None, ge=0)
    valid_until: Optional[datetime] = None
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None


class QuoteItemUpdate(BaseModel):
    items: List[QuoteItemCreate] = Field(..., min_length=1)


class QuoteResponse(QuoteBase):
    id: UUID
    quote_number: str
    status: QuoteStatus
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    owner_id: UUID
    owner: UserSummary
    items: List[QuoteItemResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_date: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== INVOICE ITEM SCHEMAS ====================

class InvoiceItemBase(BaseModel):
    product_id: UUID
    description: str
    quantity: int = Field(..., ge=1)
    unit_price: Decimal = Field(..., ge=0)
    discount_percentage: Decimal = Field(Decimal("0"), ge=0, le=100)
    total: Decimal


class InvoiceItemResponse(InvoiceItemBase):
    id: UUID
    invoice_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== INVOICE SCHEMAS ====================

class InvoiceBase(BaseModel):
    account_id: UUID
    contact_id: Optional[UUID] = None
    issue_date: datetime
    due_date: datetime
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None


class InvoiceCreate(BaseModel):
    quote_id: Optional[UUID] = None
    account_id: UUID
    contact_id: Optional[UUID] = None
    issue_date: datetime
    due_date: datetime
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None
    items: Optional[List[InvoiceItemBase]] = None  # If creating without quote


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    notes: Optional[str] = None


class InvoiceResponse(InvoiceBase):
    id: UUID
    invoice_number: str
    quote_id: Optional[UUID] = None
    status: InvoiceStatus
    subtotal: Decimal
    tax_rate: Decimal
    tax_amount: Decimal
    discount_type: Optional[str] = None
    discount_value: Optional[Decimal] = None
    discount_amount: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    paid_date: Optional[datetime] = None
    owner_id: UUID
    owner: UserSummary
    items: List[InvoiceItemResponse]
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== PAYMENT SCHEMAS ====================

class PaymentBase(BaseModel):
    invoice_id: UUID
    amount: Decimal = Field(..., gt=0)
    payment_method: PaymentMethod
    payment_date: datetime
    reference_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    transaction_id: Optional[str] = Field(None, max_length=255)
    processor: Optional[str] = Field(None, max_length=50)


class PaymentCreate(PaymentBase):
    pass


class PaymentUpdate(BaseModel):
    status: PaymentStatus
    notes: Optional[str] = None


class PaymentResponse(PaymentBase):
    id: UUID
    payment_number: str
    status: PaymentStatus
    processed_by: UUID
    processor_user: UserSummary
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ==================== CONVERSION SCHEMAS ====================

class QuoteToInvoiceConvert(BaseModel):
    issue_date: datetime
    due_date: datetime
    notes: Optional[str] = None
    terms_conditions: Optional[str] = None