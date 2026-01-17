"""
Startup initialization for creating default users and data
"""
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.billing import Product, ProductType
from app.core.security import get_password_hash
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


def create_default_admin(db: Session) -> None:
    """
    Create default admin user if it doesn't exist.
    This runs automatically on application startup.
    """
    try:
        # Check if admin user already exists
        admin = db.query(User).filter(
            User.email == "admin@crm.com",
            User.is_deleted == False
        ).first()
        
        if not admin:
            logger.info("Creating default admin user...")
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
            logger.info("✓ Default admin user created: admin@crm.com / admin123")
        else:
            logger.info("✓ Admin user already exists")
            
    except Exception as e:
        logger.error(f"Error creating default admin user: {e}")
        db.rollback()


def create_default_users(db: Session) -> None:
    """
    Create default users for all roles if they don't exist.
    """
    default_users = [
        {
            "email": "admin@crm.com",
            "password": "admin123",
            "first_name": "Admin",
            "last_name": "Admin",
            "role": UserRole.ADMIN
        },
        {
            "email": "sales@crm.com",
            "password": "sales123",
            "first_name": "Sales",
            "last_name": "User",
            "role": UserRole.SALES
        },
        {
            "email": "finance@crm.com",
            "password": "finance123",
            "first_name": "Finance",
            "last_name": "User",
            "role": UserRole.FINANCE
        }
    ]
    
    try:
        for user_data in default_users:
            existing = db.query(User).filter(
                User.email == user_data["email"],
                User.is_deleted == False
            ).first()
            
            if not existing:
                logger.info(f"Creating default user: {user_data['email']}")
                user = User(
                    email=user_data["email"],
                    hashed_password=get_password_hash(user_data["password"]),
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    role=user_data["role"],
                    is_active=True
                )
                db.add(user)
        
        db.commit()
        logger.info("✓ Default users created/verified")
        
    except Exception as e:
        logger.error(f"Error creating default users: {e}")
        db.rollback()


def create_sample_products(db: Session) -> None:
    """
    Create sample products if none exist.
    """
    try:
        # Check if any products exist
        existing_count = db.query(Product).filter(
            Product.is_deleted == False
        ).count()
        
        if existing_count == 0:
            logger.info("Creating sample products...")
            
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
                },
                {
                    "name": "Custom Development",
                    "sku": "SRV-DEV-001",
                    "description": "Custom software development - hourly",
                    "product_type": ProductType.SERVICE,
                    "unit_price": Decimal("200.00"),
                    "cost": Decimal("100.00")
                }
            ]
            
            for prod_data in sample_products:
                product = Product(**prod_data)
                db.add(product)
            
            db.commit()
            logger.info(f"✓ {len(sample_products)} sample products created")
        else:
            logger.info(f"✓ Products already exist ({existing_count} products)")
            
    except Exception as e:
        logger.error(f"Error creating sample products: {e}")
        db.rollback()


def initialize_database(db: Session, minimal: bool = False) -> None:
    """
    Initialize database with default data.
    
    Args:
        db: Database session
        minimal: If True, only create admin user. If False, create all defaults.
    """
    logger.info("Initializing database...")
    
    if minimal:
        # Only create admin user
        create_default_admin(db)
    else:
        # Create all default data
        create_default_users(db)
        create_sample_products(db)
    
    logger.info("Database initialization complete!")


def startup_init(db: Session) -> None:
    """
    Run on application startup.
    Creates default admin user if it doesn't exist.
    """
    logger.info("Running startup initialization...")
    
    # Always ensure admin user exists
    create_default_admin(db)
    
    logger.info("Startup initialization complete!")