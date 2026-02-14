"""
Shared date utilities for filtering, validation, and comparison.

Usage:
    from app.utils.date_utils import (
        validate_date_range,
        apply_date_filter,
        build_date_filters,
        get_comparison_periods
    )
"""

from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Optional, List, Tuple


class DateRangeError(ValueError):
    """Raised when date range is invalid"""
    pass


class DateValidationError(ValueError):
    """Raised when date validation fails"""
    pass


def validate_date_range(start_date: Optional[date], end_date: Optional[date]) -> None:
    """
    Validate that start_date <= end_date if both are provided.
    
    Args:
        start_date: Start of date range
        end_date: End of date range
        
    Raises:
        DateRangeError: If start_date > end_date
    """
    if start_date and end_date and start_date > end_date:
        raise DateRangeError(
            f"start_date ({start_date}) cannot be after end_date ({end_date})"
        )


def validate_date_order(
    earlier_date: datetime,
    later_date: datetime,
    earlier_name: str = "start date",
    later_name: str = "end date"
) -> None:
    """
    Validate that one date comes before or equals another.
    
    Args:
        earlier_date: The date that should come first
        later_date: The date that should come second
        earlier_name: Name for error message
        later_name: Name for error message
        
    Raises:
        DateValidationError: If dates are in wrong order
    """
    if later_date < earlier_date:
        raise DateValidationError(
            f"{later_name.capitalize()} ({later_date.date()}) must be on or after "
            f"{earlier_name} ({earlier_date.date()})"
        )


def to_datetime_range(
    start_date: Optional[date], 
    end_date: Optional[date]
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """
    Convert date objects to datetime range (start of day, end of day).
    
    Args:
        start_date: Start date (will become 00:00:00)
        end_date: End date (will become 23:59:59.999999)
        
    Returns:
        Tuple of (start_datetime, end_datetime)
    """
    start_dt = datetime.combine(start_date, datetime.min.time()) if start_date else None
    end_dt = datetime.combine(end_date, datetime.max.time()) if end_date else None
    return start_dt, end_dt


def to_start_of_day(d: date) -> datetime:
    """Convert date to datetime at start of day (00:00:00)"""
    return datetime.combine(d, datetime.min.time())


def to_end_of_day(d: date) -> datetime:
    """Convert date to datetime at end of day (23:59:59.999999)"""
    return datetime.combine(d, datetime.max.time())


def apply_date_filter(
    query, 
    model, 
    start_date: Optional[date] = None, 
    end_date: Optional[date] = None, 
    date_field: str = 'created_at'
):
    """
    Apply date filters to a SQLAlchemy query.
    
    Args:
        query: SQLAlchemy query object
        model: SQLAlchemy model class
        start_date: Filter records on or after this date
        end_date: Filter records on or before this date
        date_field: Name of the datetime field to filter on
        
    Returns:
        Filtered query
        
    Raises:
        DateRangeError: If start_date > end_date
    """
    validate_date_range(start_date, end_date)
    start_dt, end_dt = to_datetime_range(start_date, end_date)
    
    if start_dt:
        query = query.filter(getattr(model, date_field) >= start_dt)
    if end_dt:
        query = query.filter(getattr(model, date_field) <= end_dt)
    return query


def apply_date_filter_raw(
    query,
    date_column,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
):
    """
    Apply date filters using a direct column reference.
    
    Useful when you have a column reference rather than model + field name,
    e.g., in complex joins or aggregations.
    
    Args:
        query: SQLAlchemy query object
        date_column: SQLAlchemy column object (e.g., Invoice.issue_date)
        start_date: Filter records on or after this date
        end_date: Filter records on or before this date
        
    Returns:
        Filtered query
        
    Raises:
        DateRangeError: If start_date > end_date
    """
    validate_date_range(start_date, end_date)
    start_dt, end_dt = to_datetime_range(start_date, end_date)
    
    if start_dt:
        query = query.filter(date_column >= start_dt)
    if end_dt:
        query = query.filter(date_column <= end_dt)
    return query


def build_date_filters(
    model,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    date_field: str = 'created_at'
) -> List:
    """
    Build a list of date filter conditions for use with filter(*conditions).
    
    Args:
        model: SQLAlchemy model class
        start_date: Filter records on or after this date
        end_date: Filter records on or before this date
        date_field: Name of the datetime field to filter on
        
    Returns:
        List of filter conditions
        
    Raises:
        DateRangeError: If start_date > end_date
    """
    validate_date_range(start_date, end_date)
    start_dt, end_dt = to_datetime_range(start_date, end_date)
    
    filters = []
    if start_dt:
        filters.append(getattr(model, date_field) >= start_dt)
    if end_dt:
        filters.append(getattr(model, date_field) <= end_dt)
    return filters


def get_comparison_periods(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    default_days: int = 30
) -> dict:
    """
    Calculate current and previous period date ranges for comparison.
    
    If start_date and end_date are provided, calculates a previous period
    of the same length. Otherwise, uses last N days vs previous N days.
    
    Args:
        start_date: Start of current period
        end_date: End of current period
        default_days: Number of days to use if no dates provided
        
    Returns:
        Dict with current and previous period datetime ranges:
        {
            'current': {'start': datetime, 'end': datetime},
            'previous': {'start': datetime, 'end': datetime}
        }
        
    Raises:
        DateRangeError: If start_date > end_date
    """
    validate_date_range(start_date, end_date)
    
    if start_date and end_date:
        period_length = (end_date - start_date).days
        current_start = datetime.combine(start_date, datetime.min.time())
        current_end = datetime.combine(end_date, datetime.max.time())
        
        previous_end_date = start_date - timedelta(days=1)
        previous_start_date = previous_end_date - timedelta(days=period_length)
        previous_start = datetime.combine(previous_start_date, datetime.min.time())
        previous_end = datetime.combine(previous_end_date, datetime.max.time())
    else:
        now = datetime.utcnow()
        current_start = now - timedelta(days=default_days)
        current_end = now
        previous_start = now - timedelta(days=default_days * 2)
        previous_end = now - timedelta(days=default_days)
    
    return {
        'current': {'start': current_start, 'end': current_end},
        'previous': {'start': previous_start, 'end': previous_end}
    }


def calculate_growth_rate(current: Decimal, previous: Decimal) -> Optional[float]:
    """
    Calculate percentage growth rate between two values.
    
    Args:
        current: Current period value
        previous: Previous period value
        
    Returns:
        Growth rate as percentage, or None if previous is 0
    """
    if previous > 0:
        return float((current - previous) / previous * 100)
    return None


def format_date_range(
    start_date: Optional[date], 
    end_date: Optional[date]
) -> dict:
    """
    Format date range for API response.
    
    Args:
        start_date: Start date
        end_date: End date
        
    Returns:
        Dict with ISO-formatted dates or None values
    """
    return {
        'start_date': start_date.isoformat() if start_date else None,
        'end_date': end_date.isoformat() if end_date else None
    }


def get_date_range_for_period(
    period: str,
    reference_date: Optional[date] = None
) -> Tuple[date, date]:
    """
    Get start and end dates for common time periods.
    
    Args:
        period: One of 'today', 'yesterday', 'this_week', 'last_week',
                'this_month', 'last_month', 'this_quarter', 'last_quarter',
                'this_year', 'last_year', 'last_7_days', 'last_30_days',
                'last_90_days', 'last_365_days'
        reference_date: Date to calculate from (defaults to today)
        
    Returns:
        Tuple of (start_date, end_date)
        
    Raises:
        ValueError: If period is not recognized
    """
    ref = reference_date or date.today()
    
    if period == 'today':
        return ref, ref
    
    elif period == 'yesterday':
        yesterday = ref - timedelta(days=1)
        return yesterday, yesterday
    
    elif period == 'this_week':
        start = ref - timedelta(days=ref.weekday())
        return start, ref
    
    elif period == 'last_week':
        end = ref - timedelta(days=ref.weekday() + 1)
        start = end - timedelta(days=6)
        return start, end
    
    elif period == 'this_month':
        start = ref.replace(day=1)
        return start, ref
    
    elif period == 'last_month':
        first_of_this_month = ref.replace(day=1)
        end = first_of_this_month - timedelta(days=1)
        start = end.replace(day=1)
        return start, end
    
    elif period == 'this_quarter':
        quarter = (ref.month - 1) // 3
        start_month = quarter * 3 + 1
        start = ref.replace(month=start_month, day=1)
        return start, ref
    
    elif period == 'last_quarter':
        quarter = (ref.month - 1) // 3
        if quarter == 0:
            # Q4 of previous year
            start = ref.replace(year=ref.year - 1, month=10, day=1)
            end = ref.replace(year=ref.year - 1, month=12, day=31)
        else:
            start_month = (quarter - 1) * 3 + 1
            end_month = quarter * 3
            start = ref.replace(month=start_month, day=1)
            # Last day of end_month
            if end_month == 12:
                end = ref.replace(month=12, day=31)
            else:
                end = ref.replace(month=end_month + 1, day=1) - timedelta(days=1)
        return start, end
    
    elif period == 'this_year':
        start = ref.replace(month=1, day=1)
        return start, ref
    
    elif period == 'last_year':
        start = ref.replace(year=ref.year - 1, month=1, day=1)
        end = ref.replace(year=ref.year - 1, month=12, day=31)
        return start, end
    
    elif period == 'last_7_days':
        start = ref - timedelta(days=6)
        return start, ref
    
    elif period == 'last_30_days':
        start = ref - timedelta(days=29)
        return start, ref
    
    elif period == 'last_90_days':
        start = ref - timedelta(days=89)
        return start, ref
    
    elif period == 'last_365_days':
        start = ref - timedelta(days=364)
        return start, ref
    
    else:
        raise ValueError(
            f"Unknown period '{period}'. Valid options: today, yesterday, "
            "this_week, last_week, this_month, last_month, this_quarter, "
            "last_quarter, this_year, last_year, last_7_days, last_30_days, "
            "last_90_days, last_365_days"
        )