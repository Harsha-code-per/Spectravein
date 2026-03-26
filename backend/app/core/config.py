"""
Application configuration using Pydantic Settings.
Environment variables are loaded from .env file or system environment.
"""

from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    
    Environment Variables:
    ----------------------
    ALLOWED_ORIGINS : str
        Comma-separated list of allowed CORS origins.
        Example: "https://spectravein.vercel.app,https://www.spectravein.com"
        Default: "http://localhost:3000" (local development only)
    
    DATABASE_URL : str
        PostgreSQL connection string (Supabase/Azure PostgreSQL).
        Example: "postgresql://user:pass@host:5432/spectravein"

    SUPABASE_DATABASE_URL : str
        Optional explicit override for Supabase connection string.
        If set, it takes precedence over DATABASE_URL.
    
    ENVIRONMENT : str
        Deployment environment (development, staging, production)
    
    LOG_LEVEL : str
        Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    
    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000"
    
    # Database
    DATABASE_URL: str = ""
    SUPABASE_DATABASE_URL: str = ""
    
    # Application Metadata
    APP_NAME: str = "SPECTRAVEIN Mining Intelligence API"
    APP_VERSION: str = "2.0.0"
    ENVIRONMENT: str = "development"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Data Source (CSV path for current phase)
    CSV_PATH: str = "asteroid_labeled.csv"
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",  # Ignore extra env vars
    )
    
    def get_allowed_origins(self) -> List[str]:
        """
        Parse comma-separated ALLOWED_ORIGINS into a list.
        Strips whitespace and filters empty strings.
        
        Returns:
            List of allowed origin URLs
        """
        if not self.ALLOWED_ORIGINS:
            return ["http://localhost:3000"]  # Safe fallback for local dev
        
        origins = [
            origin.strip() 
            for origin in self.ALLOWED_ORIGINS.split(",") 
            if origin.strip()
        ]
        
        return origins if origins else ["http://localhost:3000"]
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT.lower() == "development"


# Global settings instance
# This will be imported by other modules
settings = Settings()
