"""
SQLAlchemy database infrastructure.
Provides engine, session factory, and declarative base.
"""

import os
import sys
from collections.abc import Generator
from threading import Lock

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings


def _build_database_url() -> str:
    """
    Resolve DATABASE_URL from settings with automatic fallback.
    Priority: SUPABASE_DATABASE_URL_DIRECT > SUPABASE_DATABASE_URL > DATABASE_URL
    """
    # Priority: Direct connection (fallback) > Pooling > Standard
    candidates = [
        ("DIRECT", settings.SUPABASE_DATABASE_URL_DIRECT.strip()),
        ("POOLING", settings.SUPABASE_DATABASE_URL.strip()),
        ("STANDARD", settings.DATABASE_URL.strip()),
    ]
    
    raw_database_url = None
    selected_type = None
    
    for url_type, url_value in candidates:
        if url_value:
            raw_database_url = url_value
            selected_type = url_type
            break
    
    if not raw_database_url:
        raise ValueError(
            "DATABASE_URL is not configured. Set it in backend/.env or Render environment."
        )

    # Log the connection attempt (masked password)
    masked_url = _mask_password(raw_database_url)
    print(f"[DATABASE] Using {selected_type} connection: {masked_url}", file=sys.stderr)

    # Normalize common postgres scheme for SQLAlchemy compatibility.
    if raw_database_url.startswith("postgres://"):
        raw_database_url = raw_database_url.replace("postgres://", "postgresql://", 1)

    url = make_url(raw_database_url)

    is_postgres = url.drivername.startswith("postgresql")
    host = (url.host or "").lower()
    is_local_host = host in {"localhost", "127.0.0.1"} or host.startswith("127.")

    # Add SSL requirement for non-local hosts
    if is_postgres and not is_local_host and "sslmode" not in url.query:
        url = url.update_query_dict({"sslmode": "require"})

    # CRITICAL: For Supabase Connection Pooling, ensure specific query params
    if is_postgres and "pooler.supabase.com" in host:
        print("[DATABASE] ⚠️  Supabase Connection Pooling detected (port 6543) - using NullPool", file=sys.stderr)
        # Force sslmode=require for Connection Pooling
        url = url.update_query_dict({"sslmode": "require"})

    final_url = str(url)
    print(f"[DATABASE] Final connection string: {_mask_password(final_url)}", file=sys.stderr)
    return final_url


def _mask_password(url: str) -> str:
    """Mask password in URL for safe logging."""
    try:
        if "://" in url and "@" in url:
            scheme_and_creds = url.split("@")[0]
            host_and_db = url.split("@")[1]
            if ":" in scheme_and_creds:
                scheme_user = scheme_and_creds.rsplit(":", 1)[0]
                return f"{scheme_user}:***@{host_and_db}"
        return url
    except:
        return url


# ── LAZY INITIALIZATION ──────────────────────────────────────────────────────
# Database connection is NOT created at import time to avoid connection errors
# when database is not needed (e.g., CSV-only mode).
#
# To use database features:
# 1. Uncomment the initialization code below
# 2. Call get_db() in your endpoints
# 3. Ensure DATABASE_URL is set in environment
#
# DATABASE_URL = _build_database_url()
# 
# # Enhanced engine configuration for Supabase Connection Pooling
# engine = create_engine(
#     DATABASE_URL,
#     poolclass=NullPool,  # Critical: NullPool prevents pool conflicts with pgBouncer
#     pool_pre_ping=True,  # Test connection before using
#     connect_args={
#         "connect_timeout": 10,
#         "keepalives": 1,
#         "keepalives_idle": 30,
#     },
#     echo=False,  # Set to True for SQL debugging
# )
# 
# SessionLocal = sessionmaker(
#     autocommit=False,
#     autoflush=False,
#     bind=engine,
# )
# 
# Base = declarative_base()
# _schema_ready = False
# _schema_lock = Lock()
# _backup_engine = None  # Will be created if primary fails

# Placeholder for when database is disabled
engine = None
SessionLocal = None
Base = declarative_base()
_schema_ready = False
_schema_lock = Lock()
_backup_engine = None


def _get_working_session():
    """
    Get a working database session with fallback mechanism.
    If primary connection fails, tries backup connection.
    
    NOTE: Currently disabled - database features are not active.
    """
    raise RuntimeError(
        "Database features are currently disabled. "
        "The API is running in CSV-only mode. "
        "To enable database: uncomment initialization in app/db/database.py"
    )
    
    global _backup_engine
    
    try:
        # Try primary engine
        db = SessionLocal()
        # Test the connection with a simple ping
        db.execute(text("SELECT 1"))
        return db
    except Exception as e:
        print(f"[DATABASE] Primary connection failed: {e}", file=sys.stderr)
        
        # Try backup if available
        if _backup_engine and settings.SUPABASE_DATABASE_URL_DIRECT:
            try:
                print("[DATABASE] Attempting fallback to DIRECT connection...", file=sys.stderr)
                BackupSessionLocal = sessionmaker(
                    autocommit=False,
                    autoflush=False,
                    bind=_backup_engine,
                )
                db = BackupSessionLocal()
                db.execute(text("SELECT 1"))
                print("[DATABASE] ✅ Fallback connection successful!", file=sys.stderr)
                return db
            except Exception as e2:
                print(f"[DATABASE] Backup connection also failed: {e2}", file=sys.stderr)
        
        # If we get here, both connections failed
        raise


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a scoped database session per request.
    Includes fallback to direct connection if pooling fails.
    """
    db = None
    try:
        db = _get_working_session()
        yield db
    finally:
        if db:
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
