from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from decimal import Decimal


# ==================== DASHBOARD ANALYTICS ====================

class DashboardStats(BaseModel):
    """Overall dashboard statistics"""
    total_leads: int
    total_accounts: int
    total_opportunities: int
    total_quotes: int
    total_invoices: int
    
    # Financial metrics
    total_revenue: Decimal
    outstanding_amount: Decimal
    paid_amount: Decimal
    
    # Conversion rates
    lead_conversion_rate: float
    quote_to_invoice_rate: float
    
    # Period comparison
    revenue_growth: Optional[float] = None
    leads_growth: Optional[float] = None


class PipelineStageData(BaseModel):
    """Sales pipeline by stage"""
    stage: str
    count: int
    total_value: Decimal
    avg_value: Decimal


class SalesPipelineAnalytics(BaseModel):
    """Sales pipeline analytics"""
    stages: List[PipelineStageData]
    total_opportunities: int
    total_pipeline_value: Decimal
    avg_deal_size: Decimal
    weighted_pipeline_value: Decimal


class LeadSourceData(BaseModel):
    """Lead source analytics"""
    source: str
    count: int
    conversion_rate: float
    avg_value: Decimal


class LeadAnalytics(BaseModel):
    """Lead analytics"""
    by_source: List[LeadSourceData]
    by_status: List[dict]
    total_leads: int
    converted_leads: int
    conversion_rate: float


# ==================== FINANCIAL ANALYTICS ====================

class RevenueByMonth(BaseModel):
    """Monthly revenue breakdown"""
    month: str
    revenue: Decimal
    invoices_count: int
    paid_invoices: int
    average_invoice: Decimal


class RevenueAnalytics(BaseModel):
    """Revenue analytics"""
    monthly_revenue: List[RevenueByMonth]
    total_revenue: Decimal
    ytd_revenue: Decimal
    avg_monthly_revenue: Decimal
    revenue_trend: str  # "up", "down", "stable"


class InvoiceStatusData(BaseModel):
    """Invoice status breakdown"""
    status: str
    count: int
    total_amount: Decimal
    percentage: float


class InvoiceAnalytics(BaseModel):
    """Invoice analytics"""
    by_status: List[InvoiceStatusData]
    total_invoices: int
    total_value: Decimal
    avg_invoice_value: Decimal
    overdue_count: int
    overdue_amount: Decimal


class PaymentMethodData(BaseModel):
    """Payment method analytics"""
    method: str
    count: int
    total_amount: Decimal
    percentage: float


class PaymentAnalytics(BaseModel):
    """Payment analytics"""
    by_method: List[PaymentMethodData]
    total_payments: int
    total_amount: Decimal
    avg_payment: Decimal
    avg_days_to_payment: Optional[float] = None


# ==================== PERFORMANCE ANALYTICS ====================

class TopAccount(BaseModel):
    """Top account by revenue"""
    account_id: str
    account_name: str
    total_revenue: Decimal
    invoice_count: int
    avg_invoice: Decimal


class TopProduct(BaseModel):
    """Top product by sales"""
    product_id: str
    product_name: str
    quantity_sold: int
    revenue: Decimal
    invoice_count: int


class PerformanceAnalytics(BaseModel):
    """Performance analytics"""
    top_accounts: List[TopAccount]
    top_products: List[TopProduct]
    avg_sales_cycle_days: Optional[float] = None
    win_rate: float


class UserPerformance(BaseModel):
    """User performance metrics"""
    user_id: str
    user_name: str
    leads_created: int
    opportunities_created: int
    quotes_created: int
    total_revenue: Decimal
    conversion_rate: float


class TeamPerformance(BaseModel):
    """Team performance analytics"""
    sales_team: List[UserPerformance]
    total_team_revenue: Decimal
    avg_revenue_per_user: Decimal


# ==================== TIME-BASED ANALYTICS ====================

class DateRangeQuery(BaseModel):
    """Date range query parameters"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    period: Optional[str] = None  # "week", "month", "quarter", "year"


class TimeSeriesData(BaseModel):
    """Time series data point"""
    date: str
    value: Decimal
    count: int
    label: Optional[str] = None


class TimeSeriesAnalytics(BaseModel):
    """Time series analytics"""
    data: List[TimeSeriesData]
    metric: str
    period: str
    total: Decimal
    average: Decimal
    trend: str


# ==================== FORECAST ANALYTICS ====================

class ForecastData(BaseModel):
    """Revenue forecast data"""
    period: str
    forecasted_revenue: Decimal
    confidence: float
    expected_deals: int


class RevenueForeccast(BaseModel):
    """Revenue forecast"""
    forecast: List[ForecastData]
    total_forecasted: Decimal
    current_pipeline_value: Decimal
    expected_close_rate: float


# ==================== COMPARATIVE ANALYTICS ====================

class PeriodComparison(BaseModel):
    """Period over period comparison"""
    metric: str
    current_period: Decimal
    previous_period: Decimal
    change_amount: Decimal
    change_percentage: float
    trend: str


class ComparativeAnalytics(BaseModel):
    """Comparative analytics"""
    comparisons: List[PeriodComparison]
    period_label: str


# ==================== CUSTOM REPORTS ====================

class ReportFilter(BaseModel):
    """Report filter parameters"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    account_ids: Optional[List[str]] = None
    user_ids: Optional[List[str]] = None
    status: Optional[str] = None
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None


class CustomReport(BaseModel):
    """Custom report response"""
    report_name: str
    generated_at: datetime
    filters: ReportFilter
    data: List[dict]
    summary: dict
    total_records: int