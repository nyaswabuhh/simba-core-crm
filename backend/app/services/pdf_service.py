from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML, CSS
from datetime import datetime
from pathlib import Path
import base64
import os


# Get template directory
TEMPLATE_DIR = Path(__file__).parent.parent / "templates"
STATIC_DIR = Path(__file__).parent.parent / "static"

# Initialize Jinja2 environment
env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)


def format_currency(value):
    """Format decimal as currency."""
    return f"{value:,.2f}"


def format_datetime(value):
    """Format datetime with date and time."""
    if isinstance(value, datetime):
        return value.strftime("%B %d, %Y at %I:%M %p")
    return value


def format_date(value):
    """Format datetime as date only."""
    if isinstance(value, datetime):
        return value.strftime("%B %d, %Y")
    return value


# Add custom filters
env.filters['currency'] = format_currency
env.filters['date'] = format_date
env.filters['datetime'] = format_datetime


def get_logo_base64() -> str:
    """
    Get the company logo as a base64 data URI.
    This ensures the logo is embedded directly in the HTML for reliable PDF rendering.
    
    Returns:
        Base64 data URI string or empty string if logo not found
    """
    logo_path = STATIC_DIR / "images" / "simbalogo.png"
    
    if not logo_path.exists():
        print(f"Warning: Logo not found at {logo_path}")
        return ""
    
    try:
        with open(logo_path, "rb") as f:
            logo_data = f.read()
        
        base64_data = base64.b64encode(logo_data).decode("utf-8")
        return f"data:image/png;base64,{base64_data}"
    except Exception as e:
        print(f"Error loading logo: {e}")
        return ""


def get_company_info() -> dict:
    """
    Get standard company information.
    Centralizes company details for consistency across all documents.
    """
    return {
        'name': 'SimbaPOS',
        'trade': 'T/A JESATON SYSTEMS LTD',
        'address': 'Contrust House, 6th Floor',
        'city': 'Moi Avenue, Nairobi-Kenya',
        'phone': '+254 700 001779',
        'email': 'sales@simbapos.co.ke',
        'website': 'www.simbapos.co.ke',
        'tax_id': 'N/A',
        'logo_url': get_logo_base64()
    }


def generate_quote_pdf(quote) -> bytes:
    """
    Generate PDF for a quote.
    
    Args:
        quote: Quote model instance with all relationships loaded
        
    Returns:
        PDF file as bytes
    """
    template = env.get_template('quote_template.html')
    
    # Prepare context
    context = {
        'quote': quote,
        'company': get_company_info(),
        'generated_date': datetime.now()
    }
    
    # Render HTML
    html_content = template.render(context)
    
    # Generate PDF
    pdf = HTML(string=html_content).write_pdf()
    
    return pdf  # type: ignore


def generate_invoice_pdf(invoice) -> bytes:
    """
    Generate PDF for an invoice.
    
    Args:
        invoice: Invoice model instance with all relationships loaded
        
    Returns:
        PDF file as bytes
    """
    template = env.get_template('invoice_template.html')
    
    # Calculate payment summary
    total_paid = sum([payment.amount for payment in invoice.payments])
    
    # Prepare context
    context = {
        'invoice': invoice,
        'total_paid': total_paid,
        'company': get_company_info(),
        'generated_date': datetime.now()
    }
    
    # Render HTML
    html_content = template.render(context)
    
    # Generate PDF
    pdf = HTML(string=html_content).write_pdf()
    
    return pdf  # type: ignore


def generate_receipt_pdf(payment) -> bytes:
    """
    Generate PDF receipt for a payment.
    
    Args:
        payment: Payment model instance with all relationships loaded
        
    Returns:
        PDF file as bytes
    """
    template = env.get_template('receipt_template.html')
    
    # Prepare context
    context = {
        'payment': payment,
        'invoice': payment.invoice,
        'company': get_company_info(),
        'generated_date': datetime.now()
    }
    
    # Render HTML
    html_content = template.render(context)
    
    # Generate PDF
    pdf = HTML(string=html_content).write_pdf()
    
    return pdf  # type: ignore