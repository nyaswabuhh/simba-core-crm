from sqlalchemy.orm import Session
from decimal import Decimal
from uuid import UUID
from datetime import datetime
from app.models.billing import Quote, QuoteItem, QuoteStatus, Product
from app.schemas.billing import QuoteItemCreate
from typing import List


def generate_quote_number(db: Session) -> str:
    """Generate a unique quote number."""
    # Get the latest quote number
    last_quote = db.query(Quote).order_by(Quote.created_at.desc()).first()
    
    if not last_quote:
        return "QT-2026-0001"
    
    # Extract number and increment
    try:
        parts = last_quote.quote_number.split("-")
        year = datetime.now().year
        number = int(parts[-1]) + 1
        return f"QT-{year}-{number:04d}"
    except:
        return f"QT-{datetime.now().year}-0001"


def calculate_quote_totals(
    items: List[QuoteItemCreate],
    tax_rate: Decimal,
    discount_type: str,
    discount_value: Decimal,
    db: Session
) -> dict:
    """Calculate quote totals from items."""
    subtotal = Decimal(0)
    
    # Calculate subtotal from items
    for item in items:
        # Get product to verify it exists
        product = db.query(Product).filter(
            Product.id == item.product_id,
            Product.is_deleted == False
        ).first()
        
        if not product:
            raise ValueError(f"Product {item.product_id} not found")
        
        # Calculate item total with discount
        item_subtotal = item.unit_price * item.quantity
        item_discount = item_subtotal * (item.discount_percentage / 100)
        item_total = item_subtotal - item_discount
        subtotal += item_total
    
    # Calculate discount
    discount_amount = Decimal(0)
    if discount_type == "percentage":
        discount_amount = subtotal * (discount_value / 100)
    elif discount_type == "flat":
        discount_amount = discount_value
    
    # Calculate after discount
    amount_after_discount = subtotal - discount_amount
    
    # Calculate tax
    tax_amount = amount_after_discount * (tax_rate / 100)
    
    # Calculate total
    total_amount = amount_after_discount + tax_amount
    
    return {
        "subtotal": subtotal,
        "discount_amount": discount_amount,
        "tax_amount": tax_amount,
        "total_amount": total_amount
    }


def create_quote_items(
    quote_id: UUID,
    items: List[QuoteItemCreate],
    db: Session
) -> List[QuoteItem]:
    """Create quote items."""
    quote_items = []
    
    for item_data in items:
        # Calculate item total
        item_subtotal = item_data.unit_price * item_data.quantity
        item_discount = item_subtotal * (item_data.discount_percentage / 100)
        item_total = item_subtotal - item_discount
        
        # Get product for description if not provided
        product = db.query(Product).filter(Product.id == item_data.product_id).first()
        description = item_data.description or (product.description if product else None) or (product.name if product else "")
        
        quote_item = QuoteItem(
            quote_id=quote_id,
            product_id=item_data.product_id,
            description=description,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            discount_percentage=item_data.discount_percentage,
            total=item_total
        )
        
        db.add(quote_item)
        quote_items.append(quote_item)
    
    return quote_items


def update_quote_items(
    quote: Quote,
    items: List[QuoteItemCreate],
    db: Session
) -> None:
    """Update quote items by replacing all items and recalculating totals."""
    # Delete existing items
    db.query(QuoteItem).filter(QuoteItem.quote_id == quote.id).delete()
    
    # Create new items
    create_quote_items(quote.id, items, db) # type: ignore
    
    # Recalculate totals
    totals = calculate_quote_totals(
        items,
        quote.tax_rate, # type: ignore
        quote.discount_type or "flat", # type: ignore
        quote.discount_value or Decimal(0), # type: ignore
        db
    )
    
    # Update quote totals
    quote.subtotal = totals["subtotal"]
    quote.discount_amount = totals["discount_amount"]
    quote.tax_amount = totals["tax_amount"]
    quote.total_amount = totals["total_amount"]