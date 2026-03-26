"""
SPECTRAVEIN Mining Intelligence API
Cloud-Native Enterprise Backend

FastAPI application factory with security middleware.
Deployed on Azure App Service (Python 3.11 runtime).
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Rate Limiting Imports ────────────────────────────────────────────────
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.api.endpoints import router, limiter  # ✅ Import the limiter


def create_application() -> FastAPI:
    """
    Application factory pattern.
    Creates and configures the FastAPI application instance.
    """
    app = FastAPI(
        title="SPECTRAVEIN Enterprise Intelligence API",
        description=(
            "Enterprise asteroid intelligence platform for classification, "
            "mission economics, and orbital risk analytics powered by NASA/JPL data."
        ),
        version=settings.APP_VERSION,
        contact={"name": "Harshavardhan K"},
        docs_url="/docs" if settings.is_development else None,
        redoc_url="/redoc" if settings.is_development else None,
    )
    
    # ── Rate Limiter Registration (SECURITY CRITICAL) ────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── CORS Middleware (SECURITY CRITICAL) ──────────────────────────────
    allowed_origins = settings.get_allowed_origins()
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        max_age=600,
    )
    
    # ── Mount API Routes ──────────────────────────────────────────────────
    app.include_router(router)
    
    # ── Startup Event ─────────────────────────────────────────────────────
    @app.on_event("startup")
    async def startup_event():
        """Initialize resources on application startup."""
        print(f"🚀 {settings.APP_NAME} v{settings.APP_VERSION} starting...")
        print(f"📍 Environment: {settings.ENVIRONMENT}")
        print(f"🔒 CORS allowed origins: {allowed_origins}")
        print("🛡️ Rate limiting enabled: Active")
    
    # ── Shutdown Event ────────────────────────────────────────────────────
    @app.on_event("shutdown")
    async def shutdown_event():
        """Cleanup resources on application shutdown."""
        print(f"👋 {settings.APP_NAME} shutting down...")
    
    return app


# ── Application Instance ──────────────────────────────────────────────────
app = create_application()


# ── Development Server (Optional) ─────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )