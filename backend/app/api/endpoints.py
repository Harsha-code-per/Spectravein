"""
API route handlers.
FastAPI endpoints that orchestrate service calls and return responses.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import ensure_database_schema, get_db
from app.models.domain import AsteroidDB
from app.models.schemas import AsteroidTarget, HealthCheckResponse
from app.core.config import settings
from app.services import economics, orbital, physics

# Create router instance
router = APIRouter()


def _is_pha(moid_au: float, absolute_magnitude: float) -> bool:
    """
    Infer Potentially Hazardous Asteroid status from standard NASA criteria.
    """
    return moid_au < 0.05 and absolute_magnitude <= 22.0


def _map_db_row_to_target(row: AsteroidDB) -> AsteroidTarget:
    """
    Map ORM row to the existing AsteroidTarget schema without changing response keys.
    """
    designation = str(row.designation).strip()
    name = (row.name or row.designation or "").strip()
    spectral_class = str(row.class_label).strip().upper()

    diameter_min = float(row.est_diameter_min)
    diameter_max = float(row.est_diameter_max)
    diameter_km = (diameter_min + diameter_max) / 2.0

    albedo = float(row.albedo)
    inclination = float(row.i)
    moid = float(row.moid)
    semi_major_axis_au = float(row.a)
    eccentricity = float(row.e)
    absolute_magnitude = float(row.absolute_magnitude)

    accessibility_score = physics.calculate_accessibility_score(inclination)
    estimated_mass_kg = physics.estimate_mass_kg(diameter_km, spectral_class)
    estimated_value_usd = economics.calculate_gross_value_usd(estimated_mass_kg, spectral_class)
    adjusted_value_usd = economics.apply_market_shock_deflator(estimated_mass_kg, estimated_value_usd)
    mission_cost_usd = physics.calculate_mission_cost_usd(inclination, moid)
    net_profit_usd = economics.calculate_net_profit_usd(adjusted_value_usd, mission_cost_usd)
    earth_co2_offset_tons = economics.calculate_co2_offset_tons(estimated_mass_kg)
    next_pass_date = physics.predict_next_pass_date(semi_major_axis_au, moid)

    full_name = name or designation
    asteroid_id = designation

    xai_summary = orbital.generate_xai_summary(
        full_name=full_name,
        spectral_class=spectral_class,
        albedo=albedo,
        inclination=inclination,
        mission_cost_usd=mission_cost_usd,
        adjusted_value_usd=adjusted_value_usd,
        net_profit_usd=net_profit_usd,
        next_pass_date=next_pass_date,
    )

    return AsteroidTarget(
        id=asteroid_id,
        full_name=full_name,
        diameter_km=round(diameter_km, 4),
        albedo=round(albedo, 4),
        inclination=round(inclination, 4),
        moid=round(moid, 6),
        semi_major_axis_au=round(semi_major_axis_au, 6),
        eccentricity=round(eccentricity, 6),
        spectral_class=spectral_class,
        pha=_is_pha(moid, absolute_magnitude),
        accessibility_score=round(accessibility_score, 2),
        estimated_mass_kg=round(estimated_mass_kg, 2),
        estimated_value_usd=round(estimated_value_usd, 2),
        adjusted_value_usd=round(adjusted_value_usd, 2),
        mission_cost_usd=round(mission_cost_usd, 2),
        net_profit_usd=round(net_profit_usd, 2),
        earth_co2_offset_tons=round(earth_co2_offset_tons, 2),
        next_pass_date=next_pass_date,
        xai_summary=xai_summary,
    )


@router.get("/", response_model=HealthCheckResponse, tags=["Health"])
def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    
    Returns:
        Service status, version, and environment information
    
    Usage:
        - Azure App Service: Used by health probe to verify service is running
        - Load Balancers: Determines if instance should receive traffic
        - Monitoring: Uptime checks (UptimeRobot, Pingdom, etc.)
    
    Status Codes:
        - 200: Service operational
        - 503: Service degraded (future: check database connectivity)
    
    Response Example:
        {
            "status": "Operational",
            "service": "SPECTRAVEIN Mining Intelligence API",
            "version": "2.0.0",
            "environment": "production"
        }
    """
    return HealthCheckResponse(
        status="Operational",
        service=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
    )


@router.get("/api/targets", response_model=List[AsteroidTarget], tags=["Targets"])
def get_targets(db: Session = Depends(get_db)):
    """
    Retrieve all Near-Earth Asteroid mining targets.
    
    Returns:
        List of 802 NEO targets with complete orbital, physical, and economic data.
        Sorted by estimated_value_usd descending (most valuable first).
    
    Response Model:
        List[AsteroidTarget] — see app/models/schemas.py for full schema
    
    Query Parameters (Future):
        - page: int = 1 (pagination)
        - limit: int = 50 (results per page)
        - spectral_class: str = None (filter by C/S/M)
        - min_value: float = None (minimum valuation threshold)
        - min_accessibility: float = None (minimum accessibility score)
        - exclude_pha: bool = False (filter out Potentially Hazardous Asteroids)
    
    Performance:
        - Current: PostgreSQL query + in-memory metric computation
        - Target: <50ms (PostgreSQL with indexed computed columns/materialized metrics)
    
    Caching Strategy (Future):
        - Cache response in Redis (TTL: 1 hour)
        - Invalidate on NASA API updates (daily)
        - Add ETag header for client-side caching
    
    Error Handling:
        - 503: Database unavailable
        - 500: Unexpected processing error (check logs)
    
    Example Request:
        GET /api/targets
    
    Example Response:
        [
            {
                "id": "2000433",
                "full_name": "433 Eros",
                "diameter_km": 16.84,
                "albedo": 0.25,
                "inclination": 10.83,
                "moid": 0.148,
                "spectral_class": "S",
                "accessibility_score": 78.34,
                "estimated_mass_kg": 6.69e15,
                "estimated_value_usd": 6.69e16,
                "adjusted_value_usd": 5.12e16,
                "mission_cost_usd": 7.42e9,
                "net_profit_usd": 5.11e16,
                "earth_co2_offset_tons": 2.68e14,
                "semi_major_axis_au": 1.458,
                "eccentricity": 0.223,
                "next_pass_date": "FEB 2028",
                "xai_summary": "SPECTRAVEIN has classified...",
                "pha": false
            },
            ...
        ]
    """
    try:
        ensure_database_schema()
        targets_db = db.query(AsteroidDB).all()
        if not targets_db:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Asteroid dataset is empty in the database. "
                    "Run backend/seed_db.py against the production DATABASE_URL."
                ),
            )
        targets = [_map_db_row_to_target(row) for row in targets_db]
        targets.sort(key=lambda target: target.estimated_value_usd, reverse=True)
        return targets

    except SQLAlchemyError as exc:
        print(f"❌ Database query failed in /api/targets: {exc}")
        raise HTTPException(
            status_code=503,
            detail="Database unavailable. Please verify Supabase connectivity."
        )

    except ValueError as exc:
        # Data parsing/validation failed
        raise HTTPException(
            status_code=500,
            detail=f"Data validation error: {str(exc)}"
        )

# ── Future Endpoints ──────────────────────────────────────────────────────
#
# @router.get("/api/targets/{asteroid_id}", response_model=AsteroidTarget)
# async def get_target_by_id(asteroid_id: str):
#     """Get detailed information for a specific asteroid."""
#     pass
#
# @router.get("/api/targets/search", response_model=List[AsteroidTarget])
# async def search_targets(
#     q: str,
#     spectral_class: str | None = None,
#     min_value: float | None = None,
# ):
#     """Search asteroids by name or filter by criteria."""
#     pass
#
# @router.post("/api/missions/simulate", response_model=MissionSimulation)
# async def simulate_mission(request: MissionRequest):
#     """Simulate a mining mission with custom parameters."""
#     pass
