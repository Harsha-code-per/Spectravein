"""
Seed PostgreSQL/Supabase with asteroid data from asteroid_labeled.csv.
"""

from pathlib import Path

import pandas as pd
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from app.db.database import SessionLocal, Base, engine
from app.models.domain import AsteroidDB


CSV_PATH = Path(__file__).parent / "asteroid_labeled.csv"


def seed_database() -> None:
    print("=" * 72)
    print("SPECTRAVEIN DB Seeder")
    print("=" * 72)
    print(f"[1/5] Using CSV source: {CSV_PATH}")

    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    print("[2/5] Creating database tables (if not already present)...")
    AsteroidDB.__table__.drop(engine, checkfirst=True)
    Base.metadata.create_all(bind=engine)
    print("      ✓ Tables ready")

    print("[3/5] Loading CSV with pandas...")
    df = pd.read_csv(CSV_PATH)
    print(f"      ✓ Loaded {len(df):,} rows")

    def pick_column(*candidates: str) -> str:
        for candidate in candidates:
            if candidate in df.columns:
                return candidate
        raise KeyError(f"None of the expected columns were found: {candidates}")

    designation_col = pick_column("pdes", "id", "designation")
    name_col = pick_column("full_name", "name", "target_name")
    absolute_magnitude_col = pick_column("absolute_magnitude", "H")
    est_diameter_min_col = pick_column("est_diameter_min", "diameter")
    est_diameter_max_col = pick_column("est_diameter_max", "diameter")
    class_label_col = pick_column("class_label", "spectral_class")

    seed_df = pd.DataFrame(
        {
            "designation": df[designation_col].astype(str).str.strip(),
            "name": df[name_col].astype(str).str.strip(),
            "absolute_magnitude": df[absolute_magnitude_col].astype(float),
            "est_diameter_min": df[est_diameter_min_col].astype(float),
            "est_diameter_max": df[est_diameter_max_col].astype(float),
            "albedo": df["albedo"].astype(float),
            "e": df["e"].astype(float),
            "a": df["a"].astype(float),
            "i": df["i"].astype(float),
            "moid": df["moid"].astype(float),
            "class_label": df[class_label_col].astype(str).str.strip(),
        }
    )

    print("[4/5] Inserting rows into 'asteroids' table...")
    session = SessionLocal()
    try:
        # Idempotent seeding: clear existing rows first.
        session.execute(delete(AsteroidDB))

        records = seed_df.to_dict(orient="records")
        session.bulk_insert_mappings(AsteroidDB, records)
        session.commit()
        print(f"      ✓ Inserted {len(records):,} records successfully")
    except SQLAlchemyError:
        session.rollback()
        raise
    finally:
        session.close()

    print("[5/5] Seeding complete.")
    print("=" * 72)
    print("SUCCESS: PostgreSQL table 'asteroids' is now populated.")


if __name__ == "__main__":
    seed_database()
