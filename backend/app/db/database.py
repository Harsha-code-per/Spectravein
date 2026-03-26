"""
SQLAlchemy database infrastructure.
Provides engine, session factory, and declarative base.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import NullPool  # <-- 1. ADDED THIS IMPORT

from app.core.config import settings


def _build_database_url() -> str:
    """
    Resolve DATABASE_URL from settings and fail fast if missing.
    """
    database_url = settings.DATABASE_URL.strip()
    if not database_url:
        raise ValueError(
            "DATABASE_URL is not configured. Set it in backend/.env or environment."
        )

    # Normalize common postgres scheme for SQLAlchemy compatibility.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    return database_url


DATABASE_URL = _build_database_url()

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,  # <-- 2. STRIPPED LOCAL POOLING TO FIX PGBOUNCER CLASH
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a scoped database session per request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()