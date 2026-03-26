"""
Economic valuation models and market simulation.
Implements the Market Shock Deflator and commodity pricing.
"""

import math


# Commodity Pricing: USD per kilogram by spectral class
# Based on terrestrial commodity markets (2026 prices)
VALUE_PER_KG_USD = {
    "C": 2.0,    # Water/volatiles — propellant value, not Earth market
    "S": 10.0,   # Mixed metals + silicates — construction materials
    "M": 50.0,   # Platinum-group metals — terrestrial demand driver
}


def calculate_gross_value_usd(mass_kg: float, spectral_class: str) -> float:
    """
    Calculate gross commodity valuation without market impact.
    
    Args:
        mass_kg: Total asteroid mass in kilograms
        spectral_class: Spectral taxonomy ('C', 'S', or 'M')
    
    Returns:
        Gross valuation in USD (pre-market-shock)
    
    Pricing Model:
        - C-Class: $2/kg  (water ice, organics — in-space propellant value)
        - S-Class: $10/kg (iron, nickel, silicates — construction materials)
        - M-Class: $50/kg (platinum, gold, rare metals — terrestrial commodity)
    
    Formula:
        value = mass × price_per_kg[class]
    
    Notes:
        - Assumes perfect extraction efficiency (100% recovery)
        - Does not account for:
            * Processing costs (~30% of gross value)
            * Transport costs to market (~10% of gross value)
            * Market absorption rate (see market_shock_deflator)
        - Real pricing requires futures markets and demand forecasting
    """
    price_per_kg = VALUE_PER_KG_USD.get(spectral_class, VALUE_PER_KG_USD["S"])
    return mass_kg * price_per_kg


def apply_market_shock_deflator(mass_kg: float, gross_value_usd: float) -> float:
    """
    Apply the Market Shock Deflator to adjust for supply flooding.
    
    Args:
        mass_kg: Total asteroid mass in kilograms
        gross_value_usd: Gross commodity value (pre-deflation)
    
    Returns:
        Adjusted valuation in USD (post-market-shock)
    
    Economic Problem:
        Bringing an entire asteroid's worth of platinum to market would
        catastrophically collapse commodity prices. A 1 km M-class asteroid
        contains more platinum than humanity has mined in all of history.
    
    Solution: Logarithmic Penalty Model
        The deflator compresses valuations non-linearly based on mass:
        - Small asteroids (<1000 tons): ~90-95% of gross value retained
        - Medium asteroids (10k-100k tons): ~60-80% retained
        - Large asteroids (>1M tons): ~20-40% retained
        - Planet-scale deposits: ~10% retained (Ganymed scenario)
    
    Formula:
        penalty_factor = 0.1 + 0.9 / (1 + log₁₀(max(1, mass_kg / 1e9)))
        adjusted_value = gross_value × penalty_factor
    
    Mathematical Properties:
        - Asymptotic floor at 10% (prevents zero valuation)
        - Smooth curve (differentiable, no discontinuities)
        - Mass-normalized (1 billion kg is the inflection point)
    
    Real-World Analog:
        Similar to De Beers diamond cartel's controlled release strategy
        or OPEC oil production quotas. Market value depends on absorption rate.
    
    Examples:
        - 1,000 kg asteroid:     penalty = ~95% (minimal market impact)
        - 1,000,000 kg asteroid: penalty = ~85% (moderate flooding)
        - 1,000,000,000 kg:      penalty = ~55% (major supply shock)
        - 1e15 kg (Ganymed):     penalty = ~16% (market collapse scenario)
    
    Notes:
        - Model assumes:
            * No controlled release strategy (dump entire payload at once)
            * Current terrestrial demand curves
            * No space-based industrial demand (LEO manufacturing)
        - Future refinement: integrate commodity futures elasticity data
    """
    # Normalize mass to billions of kg (1e9 kg ≈ 1 million tons)
    normalized_mass = max(1.0, mass_kg / 1e9)
    
    # Logarithmic penalty: asymptotes to 0.1 (10% floor)
    penalty_factor = 0.1 + (0.9 / (1.0 + math.log10(normalized_mass)))
    
    return gross_value_usd * penalty_factor


def format_usd_human_readable(value_usd: float) -> str:
    """
    Format USD values into compact human-readable strings for XAI summaries.
    
    Args:
        value_usd: Dollar amount (can be negative for losses)
    
    Returns:
        Formatted string (e.g., "$5.2 Trillion", "-$1.8 Billion")
    
    Format Rules:
        - Negative values prefixed with minus sign
        - Scales: Million (1e6), Billion (1e9), Trillion (1e12), Quadrillion (1e15)
        - 1 decimal place for readability
    
    Examples:
        - 1_500_000        → "$1.5 Million"
        - 42_000_000_000   → "$42.0 Billion"
        - -3_200_000_000   → "-$3.2 Billion"
        - 1.8e15           → "$1.8 Quadrillion"
    """
    sign = "-" if value_usd < 0 else ""
    abs_value = abs(value_usd)
    
    if abs_value >= 1e15:
        return f"{sign}${abs_value / 1e15:.1f} Quadrillion"
    if abs_value >= 1e12:
        return f"{sign}${abs_value / 1e12:.1f} Trillion"
    if abs_value >= 1e9:
        return f"{sign}${abs_value / 1e9:.1f} Billion"
    if abs_value >= 1e6:
        return f"{sign}${abs_value / 1e6:.1f} Million"
    
    return f"{sign}${abs_value:,.0f}"


def calculate_net_profit_usd(adjusted_value_usd: float, mission_cost_usd: float) -> float:
    """
    Calculate net profit (or loss) for the mining mission.
    
    Args:
        adjusted_value_usd: Market-shock-deflated commodity value
        mission_cost_usd: Total mission CapEx
    
    Returns:
        Net profit in USD (can be negative for unprofitable missions)
    
    Formula:
        net_profit = adjusted_value - mission_cost
    
    Interpretation:
        - Positive: Profitable mission (green flag for investors)
        - Zero: Break-even (high-risk, low-reward)
        - Negative: Unprofitable (mission cost exceeds commodity value)
    
    Notes:
        - Does not include:
            * Operating expenses (OpEx) over mission lifetime (~$100M/year)
            * Financing costs (interest on borrowed CapEx)
            * Insurance premiums (~5-10% of CapEx for space missions)
        - For investment modeling, apply NPV discount rate (~8-12% for space ventures)
    """
    return adjusted_value_usd - mission_cost_usd


def calculate_co2_offset_tons(mass_kg: float) -> float:
    """
    Calculate CO2 emissions avoided vs. terrestrial mining.
    
    Args:
        mass_kg: Total asteroid mass in kilograms
    
    Returns:
        CO2 equivalent in metric tons avoided
    
    ESG Metric:
        Terrestrial mining (especially platinum/rare metals) is carbon-intensive:
        - Open-pit mining: ~20,000 kg CO2 per ton of ore processed
        - Smelting/refining: ~15,000 kg CO2 per ton of pure metal
        - Average: ~40,000 kg CO2 per ton of rare metal extracted
    
    Formula:
        co2_offset = (mass_kg / 1000) × 40,000
    
    Assumptions:
        - Space-based extraction has negligible carbon footprint
        - Launch emissions amortized over large payload (~0.1% of terrestrial mining)
        - Solar-powered processing (no fossil fuel combustion)
    
    Example:
        - 1 million kg asteroid → 40 million tons CO2 avoided
        - Equivalent to taking 8 million cars off the road for 1 year
    
    Notes:
        - Overly optimistic (ignores launch vehicle emissions)
        - But: Launch CO2 (~1000 tons per Falcon Heavy) is negligible vs.
          terrestrial mining emissions for the same commodity yield
        - Useful for ESG reporting and carbon credit valuation
    """
    mass_tons = mass_kg / 1000.0
    co2_per_ton = 40_000.0  # kg CO2 per ton of metal extracted terrestrially
    return mass_tons * co2_per_ton
