from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    debug: bool = True
    app_secret_key: str = "reino-change-this-secret"

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "reino"

    jwt_secret: str = "reino-jwt-change-this"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days

    gemini_api_key: Optional[str] = None
    elevenlabs_api_key: Optional[str] = None
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"

    default_isp: str = "safaricom"
    allowed_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
