import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None) -> str:
    v = os.getenv(name, default)
    if v is None:
        raise RuntimeError(f"Missing env var: {name}")
    return v


@dataclass(frozen=True)
class Settings:
    database_url_env: str = _env("DATABASE_URL", "")
    api_port: int = int(_env("API_PORT", "8080"))
    cors_origins: str = _env("API_CORS_ORIGINS", "http://localhost:4200,http://localhost:3000")

    @property
    def database_url(self) -> str:
        # Prefer single DATABASE_URL (prod). Example:
        # postgresql+psycopg://user:pass@host:5432/dbname
        if self.database_url_env.strip():
            return self.database_url_env.strip()

        # Local default for docker-compose (Postgres)
        return "postgresql+psycopg://vox:voxpass@localhost:5433/vox_finance"


settings = Settings()

