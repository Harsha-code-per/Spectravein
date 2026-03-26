"""
CSV data loader for asteroid mining targets.
Loads and processes asteroid_labeled.csv for the API.
"""
import os
from pathlib import Path
import pandas as pd
from typing import Dict, Any, List


def get_csv_path() -> Path:
    """
    Locate asteroid_labeled.csv in the backend directory.
    Tries multiple locations to handle different deployment environments.
    """
    # Try relative to this file (backend/app/data/loader.py)
    current_dir = Path(__file__).parent
    backend_root = current_dir.parent.parent  # Go up to backend/
    
    possible_paths = [
        backend_root / "asteroid_labeled.csv",                    # backend/asteroid_labeled.csv
        backend_root / "data" / "asteroid_labeled.csv",           # backend/data/asteroid_labeled.csv
        Path.cwd() / "asteroid_labeled.csv",                      # Current working directory
        Path.cwd() / "backend" / "asteroid_labeled.csv",          # ./backend/asteroid_labeled.csv
    ]
    
    for path in possible_paths:
        if path.exists():
            print(f"[CSV] ✅ Found CSV at: {path}")
            return path
    
    # Last resort: environment variable
    env_path = os.getenv("ASTEROID_CSV_PATH")
    if env_path and Path(env_path).exists():
        print(f"[CSV] ✅ Found CSV via ASTEROID_CSV_PATH: {env_path}")
        return Path(env_path)
    
    raise FileNotFoundError(
        f"Could not find asteroid_labeled.csv. Tried:\n" + 
        "\n".join(f"  - {p}" for p in possible_paths)
    )


def load_asteroid_dataframe() -> pd.DataFrame:
    """
    Load the CSV file into a pandas DataFrame.
    
    Returns:
        DataFrame with all asteroid data
    """
    csv_path = get_csv_path()
    print(f"[CSV] Loading asteroid data from {csv_path}...")
    
    df = pd.read_csv(csv_path)
    print(f"[CSV] ✅ Loaded {len(df)} asteroids from CSV")
    
    # CSV columns: id,full_name,neo,pha,moid,e,a,q,i,diameter,albedo,class,H,spectral_class
    # Basic validation - check for critical columns
    required_columns = ['id', 'moid', 'e', 'a', 'i', 'albedo', 'diameter']
    
    missing = [col for col in required_columns if col not in df.columns]
    if missing:
        raise ValueError(f"CSV missing required columns: {missing}")
    
    return df


def build_asteroid_targets() -> List[Dict[str, Any]]:
    """
    Load CSV and return list of raw asteroid dictionaries.
    The API layer will handle all physics/economics calculations.
    
    Returns:
        List of dictionaries with asteroid data
    """
    df = load_asteroid_dataframe()
    
    # CSV columns: id,full_name,neo,pha,moid,e,a,q,i,diameter,albedo,class,H,spectral_class
    # Map to expected schema
    df['designation'] = df['id']
    df['name'] = df['full_name']
    df['absolute_magnitude'] = df['H']
    df['class_label'] = df.get('spectral_class', df.get('class', 'U'))
    
    # Handle diameter (single column in CSV, but API expects min/max)
    if 'diameter' in df.columns:
        # Assume ±10% margin for min/max
        df['est_diameter_min'] = df['diameter'] * 0.9
        df['est_diameter_max'] = df['diameter'] * 1.1
    
    # Convert to list of dicts, handling NaN values
    records = df.fillna({
        'name': '',
        'full_name': '',
        'designation': '',
        'class_label': 'U',
        'absolute_magnitude': 20.0
    }).to_dict('records')
    
    print(f"[CSV] ✅ Built {len(records)} asteroid records")
    return records
