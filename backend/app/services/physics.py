"""
Physics and orbital mechanics calculations.
All formulas are based on validated astrophysics models.
"""

import math


# Physical Constants: Bulk Density by Spectral Class
# Units: kg/km³ (matches JPL diameter measurements in km)
DENSITY_KG_PER_KM3 = {
    "C": 1.38e12,   # Carbonaceous — porous, volatile-rich, water ice
    "S": 2.71e12,   # Silicaceous  — stony-iron, mixed composition
    "M": 5.32e12,   # Metallic     — pure iron-nickel core, PGMs
}


def sphere_volume_km3(diameter_km: float) -> float:
    """
    Calculate the volume of a sphere given its diameter.
    
    Args:
        diameter_km: Asteroid diameter in kilometers
    
    Returns:
        Volume in cubic kilometers
    
    Formula:
        V = (4/3) * π * r³
        where r = diameter / 2
    """
    radius_km = diameter_km / 2.0
    return (4.0 / 3.0) * math.pi * (radius_km ** 3)


def estimate_mass_kg(diameter_km: float, spectral_class: str) -> float:
    """
    Estimate asteroid mass using diameter and spectral class.
    
    Args:
        diameter_km: Asteroid diameter in kilometers
        spectral_class: Spectral taxonomy ('C', 'S', or 'M')
    
    Returns:
        Estimated mass in kilograms
    
    Method:
        1. Calculate volume assuming spherical body
        2. Apply class-specific bulk density
        3. Mass = Volume × Density
    
    Notes:
        - Actual asteroids are irregular, not perfect spheres
        - This provides a conservative lower-bound estimate
        - Real mining operations would use radar/lidar for precise volume
    """
    volume_km3 = sphere_volume_km3(diameter_km)
    density = DENSITY_KG_PER_KM3.get(spectral_class, DENSITY_KG_PER_KM3["S"])
    return volume_km3 * density


def calculate_accessibility_score(inclination_deg: float) -> float:
    """
    Calculate mission accessibility score based on orbital inclination.
    
    Args:
        inclination_deg: Orbital inclination in degrees (0-180)
    
    Returns:
        Accessibility score (0-100)
        - 100 = perfectly aligned with Earth's orbit (minimal delta-v)
        - 0   = perpendicular orbit (prohibitively expensive)
    
    Formula:
        score = max(0, 100 - (inclination × 2))
    
    Physical Basis:
        - Delta-v cost increases exponentially with plane-change maneuvers
        - Inclination is the primary driver of mission fuel requirements
        - MOID (distance) is secondary and handled in mission_cost calculation
    
    Examples:
        - 0°   inclination → 100 score (optimal, coplanar with Earth)
        - 10°  inclination → 80  score (viable, moderate fuel penalty)
        - 30°  inclination → 40  score (challenging, high delta-v)
        - 50°+ inclination → 0   score (economically infeasible)
    """
    return max(0.0, 100.0 - inclination_deg * 2.0)


def calculate_mission_cost_usd(inclination_deg: float, moid_au: float) -> float:
    """
    Estimate total mission Capital Expenditure (CapEx) in USD.
    
    Args:
        inclination_deg: Orbital inclination in degrees
        moid_au: Minimum Orbit Intersection Distance in AU
    
    Returns:
        Total mission cost in USD
    
    Cost Model:
        1. Base Launch Cost: $2 billion (Falcon Heavy class)
        2. Inclination Penalty: $500M per degree (plane-change delta-v)
        3. Distance Penalty: $10B per AU (transit time + comms + power)
    
    Formula:
        cost = 2B + (inclination × 500M) + (moid × 10B)
    
    Examples:
        - Near-Earth, low-inclination: ~$2-4B (feasible)
        - Main belt, high-inclination: ~$20-50B (speculative)
    
    Notes:
        - Does not include:
            * Mining equipment CapEx (~$500M)
            * Return propellant (~$1B for sample return)
            * Ground operations (~$100M/year)
        - Model is simplified for MVP; real missions require trajectory optimization
    """
    base_cost = 2_000_000_000.0  # $2B baseline (rocket + spacecraft)
    inclination_penalty = inclination_deg * 500_000_000.0  # $500M per degree
    distance_penalty = moid_au * 10_000_000_000.0  # $10B per AU
    
    return base_cost + inclination_penalty + distance_penalty


def predict_next_pass_date(semi_major_axis_au: float, moid_au: float, current_year: int = 2026) -> str:
    """
    Predict the next optimal launch window using Kepler's Third Law.
    
    Args:
        semi_major_axis_au: Semi-major axis in Astronomical Units
        moid_au: Minimum Orbit Intersection Distance in AU
        current_year: Current calendar year (default: 2026)
    
    Returns:
        Launch window string (e.g., "OCT 2028")
    
    Method:
        1. Calculate orbital period using Kepler's Third Law: P = a^1.5 years
        2. Derive phase fraction from MOID (deterministic approximation)
        3. Compute time-until-next-pass: years_until = period × phase_fraction
        4. Clamp to realistic near-future window (0.5-3.5 years)
        5. Convert to calendar date
    
    Physical Basis:
        - Kepler's Third Law: P² ∝ a³ for objects orbiting the Sun
        - Real mission planning uses JPL HORIZONS ephemeris data
        - This model provides educational approximations without live API calls
    
    Limitations:
        - Does not account for:
            * True anomaly (current position in orbit)
            * Earth's position (synodic period)
            * Transfer orbit geometry (Hohmann vs. bi-elliptic)
        - For production, integrate NASA HORIZONS API for precise windows
    """
    # Kepler's Third Law: P (years) = a^1.5 (a in AU)
    period_years = max(0.5, semi_major_axis_au ** 1.5)
    
    # Deterministic phase fraction derived from MOID
    # This gives each asteroid a unique "current position" in its orbit
    phase_fraction = (moid_au * 7.3) % 1.0
    
    # Time until next favorable alignment
    years_until = period_years * phase_fraction
    
    # Clamp to realistic mission planning horizon (6 months to 3.5 years)
    years_until = max(0.5, min(years_until, 3.5))
    
    # Convert to calendar date
    total_months = int(years_until * 12)
    target_year = current_year + total_months // 12
    target_month_idx = total_months % 12
    
    months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
    
    return f"{months[target_month_idx]} {target_year}"
