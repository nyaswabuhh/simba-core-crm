"""
Initialize database with default admin user.
Run this script after setting up the database.
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from decimal import Decimal
from app.db.base import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.models.billing import Product, ProductType
from app.core.security import get_password_hash


def init_db():
    """Initialize database with default data."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Check if admin user already exists
        admin = db.query(User).filter(User.email == "admin@crm.com").first()
        
        if not admin:
            print("Creating default admin user...")
            admin = User(
                email="admin@crm.com",
                hashed_password=get_password_hash("admin123"),
                first_name="Admin",
                last_name="Admin",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✓ Admin user created: admin@crm.com / admin123")
        else:
            print("✓ Admin user already exists")
        
        # Create sample sales user
        sales = db.query(User).filter(User.email == "sales@crm.com").first()
        if not sales:
            print("Creating sample sales user...")
            sales = User(
                email="sales@crm.com",
                hashed_password=get_password_hash("sales123"),
                first_name="Sales",
                last_name="User",
                role=UserRole.SALES,
                is_active=True
            )
            db.add(sales)
            db.commit()
            print("✓ Sales user created: sales@crm.com / sales123")
        else:
            print("✓ Sales user already exists")
        
        # Create sample finance user
        finance = db.query(User).filter(User.email == "finance@crm.com").first()
        if not finance:
            print("Creating sample finance user...")
            finance = User(
                email="finance@crm.com",
                hashed_password=get_password_hash("finance123"),
                first_name="Finance",
                last_name="User",
                role=UserRole.FINANCE,
                is_active=True
            )
            db.add(finance)
            db.commit()
            print("✓ Finance user created: finance@crm.com / finance123")
        else:
            print("✓ Finance user already exists")
        
        # Create sample products
        print("\nCreating sample products...")
        sample_products = [
            {
                "name": "Professional Services - Consulting",
                "sku": "SRV-CONS-001",
                "description": "Professional consulting services - hourly rate",
                "product_type": ProductType.SERVICE,
                "unit_price": Decimal("150.00"),
                "cost": Decimal("75.00")
            },
            {
                "name": "Software License - Enterprise",
                "sku": "LIC-ENT-001",
                "description": "Enterprise software license - annual",
                "product_type": ProductType.PRODUCT,
                "unit_price": Decimal("5000.00"),
                "cost": Decimal("1000.00")
            },
            {
                "name": "Training Workshop",
                "sku": "SRV-TRN-001",
                "description": "Full-day training workshop",
                "product_type": ProductType.SERVICE,
                "unit_price": Decimal("2500.00"),
                "cost": Decimal("800.00")
            },
            {
                "name": "Cloud Hosting - Monthly",
                "sku": "SRV-HOST-001",
                "description": "Cloud hosting service - per month",
                "product_type": ProductType.SERVICE,
                "unit_price": Decimal("299.00"),
                "cost": Decimal("150.00")
            }
        ]
        
        for prod_data in sample_products:
            existing = db.query(Product).filter(Product.sku == prod_data["sku"]).first()
            if not existing:
                product = Product(**prod_data)
                db.add(product)
        
        db.commit()
        print("✓ Sample products created")
        
        print("\n" + "="*50)
        print("Database initialized successfully!")
        print("="*50)
        print("\nDefault Users:")
        print("1. Admin:   admin@crm.com / admin123")
        print("2. Sales:   sales@crm.com / sales123")
        print("3. Finance: finance@crm.com / finance123")
        print("\n4 Sample products created")
        print("\nYou can now start the server with: uvicorn app.main:app --reload")
        print("API Documentation: http://localhost:8000/api/v1/docs")
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()