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
        error_detail = str(exc)
        print(f"[TARGETS] ❌ CSV VALIDATION ERROR: {error_detail}", file=sys.stderr)
        raise HTTPException(
            status_code=503,
            detail=f"Asteroid data file is corrupted: {error_detail}"
        )

    except Exception as exc:
        error_detail = str(exc)
        print(f"[TARGETS] ❌ UNEXPECTED ERROR: {error_detail}", file=sys.stderr)
        print(f"[TARGETS] Full traceback:\n{traceback.format_exc()}", file=sys.stderr)
        raise HTTPException(
            status_code=500,
            detail=f"Internal error: {error_detail[:100]}"
        )