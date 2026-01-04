from pydantic_settings import BaseSettings
from typing import List
import secrets


class Settings(BaseSettings):
    # API Settings
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "CRM System"
    DEBUG: bool = True
    
    # Database
    # DATABASE_URL: str ="postgresql://postgres:simbapos%402019@localhost:5432/crm_db"

    DATABASE_URL: str ="postgresql://postgres:simbapos%402019@localhost:5432/crm_db"
    
    # Security
    SECRET_KEY: str = secrets.token_urlsafe(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173", 
        "http://127.0.0.1:3000"
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()