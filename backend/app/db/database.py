"""
SQLAlchemy database infrastructure.
Provides engine, session factory, and declarative base.
"""

from collections.abc import Generator
from threading import Lock

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _build_database_url() -> str:
    """
    Resolve DATABASE_URL from settings and fail fast if missing.
    Automatically enforce SSL for non-local PostgreSQL hosts.
    """
    raw_database_url = settings.DATABASE_URL.strip()
    if not raw_database_url:
        raise ValueError(
            "DATABASE_URL is not configured. Set it in backend/.env or environment."
        )

    # Normalize common postgres scheme for SQLAlchemy compatibility.
    if raw_database_url.startswith("postgres://"):
        raw_database_url = raw_database_url.replace("postgres://", "postgresql://", 1)

    url = make_url(raw_database_url)

    is_postgres = url.drivername.startswith("postgresql")
    host = (url.host or "").lower()
    is_local_host = host in {"localhost", "127.0.0.1"} or host.startswith("127.")

    if is_postgres and not is_local_host and "sslmode" not in url.query:
        url = url.update_query_dict({"sslmode": "require"})

    return str(url)


DATABASE_URL = _build_database_url()

engine = create_engine(
    DATABASE_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 10},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()
_schema_ready = False
_schema_lock = Lock()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a scoped database session per request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_database_schema() -> None:
    """
    Ensure required DB objects/columns exist for current ORM model.
    Safe to call on every request; it runs only once per process.
    """
    global _schema_ready

    if _schema_ready:
        return

    with _schema_lock:
        if _schema_ready:
            return

        Base.metadata.create_all(bind=engine)

        # Backfill schema drift for environments seeded before `name` existed.
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE asteroids ADD COLUMN IF NOT EXISTS name VARCHAR")
            )

        _schema_ready = True
