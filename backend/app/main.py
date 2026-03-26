"""
SPECTRAVEIN Mining Intelligence API
Cloud-Native Enterprise Backend

FastAPI application factory with security middleware.
Deployed on Azure App Service (Python 3.11 runtime).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.endpoints import router


def create_application() -> FastAPI:
    """
    Application factory pattern.
    Creates and configures the FastAPI application instance.
    
    Returns:
        Configured FastAPI application
    
    Configuration:
        - CORS: Restrictive origins from environment variable
        - Metadata: Title, description, version from settings
        - Routers: API endpoints mounted at root
    
    Deployment:
        - Azure App Service: Uses Gunicorn/Uvicorn workers
        - Startup command: gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker
    """
    app = FastAPI(
        title="SPECTRAVEIN Enterprise Intelligence API",
        description=(
            "Enterprise asteroid intelligence platform for classification, "
            "mission economics, and orbital risk analytics powered by NASA/JPL data."
        ),
        version=settings.APP_VERSION,
        contact={"name": "Harshavardhan K"},
        docs_url="/docs" if settings.is_development else None,  # Disable Swagger in production
        redoc_url="/redoc" if settings.is_development else None,
    )
    
    # ── CORS Middleware (SECURITY CRITICAL) ──────────────────────────────
    #
    # ⚠️  PRODUCTION SECURITY:
    # The allow_origins list is now controlled by the ALLOWED_ORIGINS
    # environment variable. This prevents unauthorized cross-origin access.
    #
    # Deployment Checklist:
    # 1. Azure App Service: Set ALLOWED_ORIGINS in Configuration > Application Settings
    #    Example: "https://spectravein.vercel.app,https://www.spectravein.com"
    #
    # 2. Local Development: Create .env file with:
    #    ALLOWED_ORIGINS=http://localhost:3000
    #
    # 3. DO NOT use ["*"] wildcard in production — this allows any website
    #    to call your API, enabling CSRF attacks and data scraping.
    #
    # 4. For investor demos on temporary domains, add them to ALLOWED_ORIGINS
    #    comma-separated list (no need to redeploy code).
    #
    allowed_origins = settings.get_allowed_origins()
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,  # ✅ SECURE: Uses env var, not wildcard
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=600,  # Cache preflight requests for 10 minutes
    )
    
    # ── Mount API Routes ──────────────────────────────────────────────────
    app.include_router(router)
    
    # ── Startup Event (Future: Database Connection Pool) ─────────────────
    @app.on_event("startup")
    async def startup_event():
        """
        Initialize resources on application startup.
        
        Current: No-op (CSV-based data loading)
        Future: Create PostgreSQL connection pool
        """
        print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting...")
        print(f"📍 Environment: {settings.ENVIRONMENT}")
        print(f"🔒 CORS allowed origins: {allowed_origins}")
        
        # Future: Initialize database connection pool
        # from app.core.database import init_db_pool
        # await init_db_pool(settings.DATABASE_URL)
    
    # ── Shutdown Event (Future: Close Database Connections) ──────────────
    @app.on_event("shutdown")
    async def shutdown_event():
        """
        Cleanup resources on application shutdown.
        
        Current: No-op
        Future: Close PostgreSQL connection pool
        """
        print(f"👋 {settings.APP_NAME} shutting down...")
        
        # Future: Close database pool
        # from app.core.database import close_db_pool
        # await close_db_pool()
    
    return app


# ── Application Instance ──────────────────────────────────────────────────
# This is the WSGI/ASGI application that Uvicorn/Gunicorn will serve.
#
# Deployment Commands:
#   Local Dev:   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
#   Production:  gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
#
app = create_application()


# ── Development Server (Optional) ─────────────────────────────────────────
# Only runs when executing this file directly: python -m app.main
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (dev only)
        log_level="info",
    )
