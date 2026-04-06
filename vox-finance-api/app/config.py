import os
from dataclasses import dataclass


def _env(name: str, default: str | None = None) -> str:
    v = os.getenv(name, default)
    if v is None:
        raise RuntimeError(f"Missing env var: {name}")
    return v


@dataclass(frozen=True)
class Settings:
    mysql_host: str = _env("MYSQL_HOST", "localhost")
    mysql_port: int = int(_env("MYSQL_PORT", "3306"))
    mysql_db: str = _env("MYSQL_DB", "vox_finance")
    mysql_user: str = _env("MYSQL_USER", "vox")
    mysql_password: str = _env("MYSQL_PASSWORD", "voxpass")
    api_port: int = int(_env("API_PORT", "8080"))
    cors_origins: str = _env("API_CORS_ORIGINS", "http://localhost:4200,http://localhost:3000")

    @property
    def database_url(self) -> str:
        # SQLAlchemy URL for PyMySQL
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_db}"
            "?charset=utf8mb4"
        )


settings = Settings()

