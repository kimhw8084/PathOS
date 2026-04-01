from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
import os

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "SYSGRID Production API"
    
    # Environment
    ENVIRONMENT: str = "production"  # development, production, test
    
    # CORS Origins (comma-separated string converted to list)
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Database
    @property
    def DATABASE_URL(self) -> str:
        # Get the absolute path to the backend directory
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        db_path = os.path.join(base_dir, "system_grid.db")
        return f"sqlite+aiosqlite:///{db_path}"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
