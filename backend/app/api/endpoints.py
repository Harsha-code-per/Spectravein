"""
API route handlers.
FastAPI endpoints that orchestrate service calls and return responses.
"""

import sys
import traceback
from typing import List
from fastapi import APIRouter, HTTPException

from app.models.schemas import AsteroidTarget, HealthCheckResponse
from app.core.config import settings
from app.services import economics, orbital, physics
from app.data import loader

# Create router instance
router = APIRouter()


def _is_pha(moid_au: float, absolute_magnitude: float) -> bool:
    """
    Infer Potentially Hazardous Asteroid status from standard NASA criteria.
    """
    return moid_au < 0.05 and absolute_magnitude <= 22.0


def _map_csv_row_to_target(row: dict) -> AsteroidTarget:
    """
    Map CSV row dictionary to AsteroidTarget schema with full calculations.
    """
    # Extract base data from CSV
    designation = str(row.get('designation', row.get('id', 'UNKNOWN'))).strip()
    name = str(row.get('name', row.get('full_name', designation))).strip()
    spectral_class = str(row.get('class_label', 'U')).strip().upper()

    diameter_min = float(row.get('est_diameter_min', 0))
    diameter_max = float(row.get('est_diameter_max', 0))
    diameter_km = (diameter_min + diameter_max) / 2.0

    albedo = float(row.get('albedo', 0.1))
    inclination = float(row.get('i', 0))
    moid = float(row.get('moid', 0))
    semi_major_axis_au = float(row.get('a', 1.0))
    eccentricity = float(row.get('e', 0))
    absolute_magnitude = float(row.get('absolute_magnitude', 20.0))

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
def get_targets():
    """
    Retrieve all Near-Earth Asteroid mining targets from CSV.
    
    Returns:
        List of 802+ NEO targets with complete orbital, physical, and economic data.
        Sorted by estimated_value_usd descending (most valuable first).
    
    Data Source:
        backend/asteroid_labeled.csv (direct file read, no database required)
    
    Response Model:
        List[AsteroidTarget] — see app/models/schemas.py for full schema
    
    Performance:
        - CSV load + pandas processing: ~50-100ms
        - Physics/economics calculations: In-memory per request
    
    Error Handling:
        - 503: CSV file not found or corrupted
        - 500: Unexpected processing error (check logs)
    
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
        print("[TARGETS] Loading asteroid data from CSV...", file=sys.stderr)
        raw_records = loader.build_asteroid_targets()
        
        if not raw_records:
            error_msg = "Asteroid CSV is empty or unreadable."
            print(f"[TARGETS] ⚠️  {error_msg}", file=sys.stderr)
            raise HTTPException(
                status_code=503,
                detail=error_msg,
            )
        
        print(f"[TARGETS] ✅ Loaded {len(raw_records)} asteroids, computing metrics...", file=sys.stderr)
        targets = [_map_csv_row_to_target(row) for row in raw_records]
        targets.sort(key=lambda target: target.estimated_value_usd, reverse=True)
        print(f"[TARGETS] ✅ Successfully returning {len(targets)} targets", file=sys.stderr)
        return targets

    except FileNotFoundError as exc:
        error_detail = str(exc)
        print(f"[TARGETS] ❌ CSV FILE NOT FOUND: {error_detail}", file=sys.stderr)
        raise HTTPException(
            status_code=503,
            detail=f"Asteroid data file not found: {error_detail}"
        )

    except ValueError as exc:
        # CSV validation errors (missing columns, etc.)
        error_detail = str(exc)
        print(f"[TARGETS] ❌ CSV VALIDATION ERROR: {error_detail}", file=sys.stderr)
        raise HTTPException(
            status_code=503,
            detail=f"Asteroid data file is corrupted: {error_detail}"
        )

    except Exception as exc:
        # Unexpected errors
        error_detail = str(exc)
        print(f"[TARGETS] ❌ UNEXPECTED ERROR: {error_detail}", file=sys.stderr)
        print(f"[TARGETS] Full traceback:\n{traceback.format_exc()}", file=sys.stderr)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {error_detail[:100]}"
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
