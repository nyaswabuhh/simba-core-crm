from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID
from app.models.user import UserRole


# Base schema
class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    role: UserRole = UserRole.SALES


# Schema for creating a user
class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


# Schema for updating a user
class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


# Schema for password change
class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


# Schema for response
class UserResponse(UserBase):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    full_name: str

    class Config:
        from_attributes = True


# Schema for user in lists (minimal info)
class UserSummary(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole

    class Config:
        from_attributes = True