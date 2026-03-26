"""
Orbital classification and space law compliance.
Handles Potentially Hazardous Asteroid (PHA) designations and
future Artemis Accords compliance checks.
"""


# Composition descriptions by spectral class
COMPOSITION_TYPE = {
    "C": "water/carbon-rich",
    "S": "silicate/stony",
    "M": "heavy metal/platinum-group",
}


def get_composition_description(spectral_class: str) -> str:
    """
    Get human-readable composition description for a spectral class.
    
    Args:
        spectral_class: Spectral taxonomy ('C', 'S', or 'M')
    
    Returns:
        Plain-English composition description
    
    Classifications:
        - C-Class: Carbonaceous — water ice, organics, volatiles
        - S-Class: Silicaceous — stony-iron, mixed silicates
        - M-Class: Metallic — pure iron-nickel core, PGMs
    """
    return COMPOSITION_TYPE.get(spectral_class, "mixed composition")


def generate_xai_summary(
    full_name: str,
    spectral_class: str,
    albedo: float,
    inclination: float,
    mission_cost_usd: float,
    adjusted_value_usd: float,
    net_profit_usd: float,
    next_pass_date: str,
) -> str:
    """
    Generate an Explainable AI (XAI) mission briefing in plain English.
    
    Args:
        full_name: Asteroid official designation
        spectral_class: Spectral taxonomy ('C', 'S', or 'M')
        albedo: Surface reflectivity (0.0-1.0)
        inclination: Orbital inclination in degrees
        mission_cost_usd: Total mission CapEx
        adjusted_value_usd: Market-shock-deflated commodity value
        net_profit_usd: Net profit (adjusted_value - mission_cost)
        next_pass_date: Predicted launch window (e.g., "OCT 2028")
    
    Returns:
        Plain-English mission summary for non-technical stakeholders
    
    Purpose:
        - Translate complex astrophysics into investor-friendly language
        - Highlight key decision factors (cost, profit, timeline)
        - Build trust through transparency (no "black box" AI)
    
    Template:
        "SPECTRAVEIN has classified {name} as a {class}-Class target.
         Based on an albedo of {albedo}, we predict a {composition} composition.
         The mission requires a CapEx of {cost} due to an inclination of {incl}°.
         With a post-market-shock valuation of {value}, this yields an estimated
         net profit of {profit}. The optimal launch window opens in {date}."
    
    Example Output:
        "SPECTRAVEIN has classified 433 Eros as an S-Class target. Based on
         an albedo of 0.250, we predict a silicate/stony composition. The mission
         requires a CapEx of $7.4 Billion due to an inclination of 10.83°. With
         a post-market-shock valuation of $51.2 Trillion, this yields an estimated
         net profit of $51.1 Trillion. The optimal launch window opens in FEB 2028."
    """
    from app.services.economics import format_usd_human_readable
    
    composition = get_composition_description(spectral_class)
    
    cost_str = format_usd_human_readable(mission_cost_usd)
    value_str = format_usd_human_readable(adjusted_value_usd)
    profit_str = format_usd_human_readable(net_profit_usd)
    
    summary = (
        f"SPECTRAVEIN has classified {full_name} as a {spectral_class}-Class target. "
        f"Based on an albedo of {albedo:.3f}, we predict a {composition} composition. "
        f"The mission requires a CapEx of {cost_str} "
        f"due to an inclination of {inclination:.2f}°. "
        f"With a post-market-shock valuation of {value_str}, "
        f"this yields an estimated net profit of {profit_str}. "
        f"The optimal launch window opens in {next_pass_date}."
    )
    
    return summary


def check_pha_status(pha_flag: str) -> bool:
    """
    Parse JPL PHA (Potentially Hazardous Asteroid) flag.
    
    Args:
        pha_flag: PHA designation from JPL SBDB ("Y" or "N")
    
    Returns:
        True if PHA, False otherwise
    
    PHA Definition (NASA/JPL):
        An asteroid is designated PHA if:
        1. MOID < 0.05 AU (~7.5 million km from Earth)
        2. Absolute magnitude H < 22 (~140m diameter)
    
    Legal Implications:
        - Artemis Accords (2024) discourage commercial mining of PHAs
        - Reason: Mission failure could alter trajectory → Earth impact risk
        - Recommendation: Flag PHAs in UI, require extra investor disclosure
    
    Future Enhancement:
        - Integrate with Sentry Impact Risk Table (JPL)
        - Calculate Palermo Technical Impact Hazard Scale
        - Add "mining prohibited" flag for high-risk PHAs
    """
    return pha_flag.strip().upper() == "Y"


def is_mining_prohibited(pha: bool, moid_au: float) -> bool:
    """
    Determine if asteroid mining is legally/ethically prohibited.
    
    Args:
        pha: Potentially Hazardous Asteroid flag
        moid_au: Minimum Orbit Intersection Distance in AU
    
    Returns:
        True if mining should be restricted, False if permissible
    
    Prohibition Criteria (Proposed Artemis Accords Framework):
        1. PHA designation (JPL-flagged)
        2. MOID < 0.02 AU (~3 million km — ultra-close approach)
        3. Future: Eccentricity > 0.9 (unstable orbit)
    
    Current Implementation:
        - PHA flag triggers warning
        - MOID < 0.02 AU triggers hard prohibition
        - Used to filter dashboard results or add warning badges in UI
    
    Notes:
        - Not legally binding (space law is evolving)
        - Provides ethical guardrails for investor presentations
        - Reduces liability in case of mission failure
    """
    # Ultra-close approaches are prohibited regardless of PHA status
    if moid_au < 0.02:
        return True
    
    # PHAs are flagged but not strictly prohibited (requires case-by-case review)
    # Returning False to allow them in results with warning badge
    return False


def get_risk_classification(
    pha: bool, 
    moid_au: float, 
    inclination: float, 
    accessibility_score: float
) -> str:
    """
    Classify mission risk level for investor disclosure.
    
    Args:
        pha: Potentially Hazardous Asteroid flag
        moid_au: Minimum Orbit Intersection Distance in AU
        inclination: Orbital inclination in degrees
        accessibility_score: Mission accessibility (0-100)
    
    Returns:
        Risk classification string: "LOW", "MODERATE", "HIGH", "EXTREME"
    
    Risk Matrix:
        - LOW: Non-PHA, high accessibility (>80), low inclination (<10°)
        - MODERATE: Non-PHA, moderate accessibility (60-80)
        - HIGH: PHA or low accessibility (<60) or high inclination (>30°)
        - EXTREME: PHA + low accessibility + close approach (MOID < 0.05 AU)
    
    Usage:
        - Dashboard filtering (hide EXTREME by default)
        - Investor risk disclosures
        - Insurance premium estimation
    """
    # EXTREME: Multiple red flags
    if pha and accessibility_score < 60 and moid_au < 0.05:
        return "EXTREME"
    
    # HIGH: Single major red flag
    if pha or accessibility_score < 60 or inclination > 30:
        return "HIGH"
    
    # MODERATE: Viable but challenging
    if accessibility_score < 80:
        return "MODERATE"
    
    # LOW: Prime target
    return "LOW"
