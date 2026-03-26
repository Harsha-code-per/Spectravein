"""
Live Data Ingestion & ML classification pipeline.
Fetches NEO telemetry from NASA JPL SBDB API, classifies by albedo, and
merges new/updated records into backend/asteroid_labeled.csv.
"""

import re
import sys
from pathlib import Path
from typing import Tuple

import numpy as np
import pandas as pd
import requests
from sklearn.cluster import KMeans

NASA_SBDB_API_URL = "https://ssd-api.jpl.nasa.gov/sbdb_query.api"

OUTPUT_COLUMNS = [
    "id",
    "full_name",
    "neo",
    "pha",
    "moid",
    "e",
    "a",
    "q",
    "i",
    "diameter",
    "albedo",
    "class",
    "H",
    "spectral_class",
]


def _get_csv_path() -> Path:
    """Resolve backend/asteroid_labeled.csv dynamically."""
    backend_dir = Path(__file__).resolve().parent.parent.parent
    return backend_dir / "asteroid_labeled.csv"


def _build_id_from_designation(designation: str) -> str:
    """Build stable legacy-style IDs like a0000433 when possible."""
    text = str(designation).strip()
    if not text:
        return "unknown"

    if text.lower().startswith("a") and text[1:].isdigit():
        return text.lower()

    digits = re.sub(r"\D", "", text)
    if digits:
        return f"a{int(digits):07d}"

    slug = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return f"neo_{slug}" if slug else "unknown"


def _extract_designation_from_name(full_name: str) -> str:
    text = str(full_name).strip()
    match = re.match(r"^(\d+)", text)
    if match:
        return match.group(1)
    return text.split(" ", 1)[0] if text else ""


def _fetch_with_params(params: dict) -> pd.DataFrame:
    response = requests.get(NASA_SBDB_API_URL, params=params, timeout=45)
    response.raise_for_status()
    payload = response.json()
    if "data" not in payload:
        raise ValueError("NASA API response missing 'data' field")
    return pd.DataFrame(payload.get("data", []), columns=payload.get("fields", []))


def fetch_neo_data_from_nasa() -> pd.DataFrame:
    """
    Step 1: Fetch NEO telemetry from NASA SBDB.
    Uses requested query first, then a compatibility fallback if needed.
    """
    print("[INGESTION] Fetching NASA NEO telemetry...", file=sys.stderr)

    primary_params = {
        "fields": "des,name,diameter,albedo,i,moid,a,e,H",
        "sb-cdata": '{"neo":"Y"}',
        "limit": "2000",
    }

    try:
        df = _fetch_with_params(primary_params)
        print(f"[INGESTION] ✅ Primary query returned {len(df)} rows", file=sys.stderr)
        return df
    except Exception as exc:
        print(
            f"[INGESTION] Primary query failed ({exc}); trying compatibility query...",
            file=sys.stderr,
        )

    fallback_params = {
        "fields": "spkid,full_name,diameter,albedo,i,moid,a,e,H",
        "sb-group": "neo",
        "limit": "2000",
    }
    df = _fetch_with_params(fallback_params)
    print(f"[INGESTION] ✅ Fallback query returned {len(df)} rows", file=sys.stderr)
    return df


def clean_and_transform(df: pd.DataFrame) -> pd.DataFrame:
    """Step 2: ETL cleanup and schema normalization."""
    print("[INGESTION] Running ETL cleanup...", file=sys.stderr)

    mapped = df.rename(
        columns={
            "des": "designation",
            "name": "full_name",
            "H": "absolute_magnitude",
            "spkid": "spkid",
        }
    ).copy()

    if "designation" not in mapped.columns:
        if "full_name" in mapped.columns:
            mapped["designation"] = mapped["full_name"].map(_extract_designation_from_name)
        elif "spkid" in mapped.columns:
            mapped["designation"] = mapped["spkid"].astype(str)
        else:
            mapped["designation"] = ""

    if "full_name" not in mapped.columns:
        mapped["full_name"] = mapped["designation"].astype(str)

    critical = ["diameter", "albedo", "i", "moid", "a", "e"]
    before_drop = len(mapped)
    mapped = mapped.dropna(subset=critical)
    print(f"[INGESTION] Dropped {before_drop - len(mapped)} rows with null critical values", file=sys.stderr)

    numeric_cols = critical + ["absolute_magnitude"]
    for col in numeric_cols:
        if col not in mapped.columns:
            mapped[col] = np.nan
        mapped[col] = pd.to_numeric(mapped[col], errors="coerce")

    mapped = mapped.dropna(subset=critical)
    mapped["absolute_magnitude"] = mapped["absolute_magnitude"].fillna(20.0)
    mapped["designation"] = mapped["designation"].fillna("").astype(str).str.strip()
    mapped["full_name"] = mapped["full_name"].fillna("").astype(str)
    mapped["id"] = mapped["designation"].map(_build_id_from_designation)
    mapped["est_diameter_min"] = mapped["diameter"] * 0.9
    mapped["est_diameter_max"] = mapped["diameter"] * 1.1
    mapped["q"] = mapped["a"] * (1 - mapped["e"])
    mapped["neo"] = "Y"
    mapped["pha"] = np.where(mapped["moid"] < 0.05, "Y", "N")

    print(f"[INGESTION] ✅ ETL complete with {len(mapped)} clean rows", file=sys.stderr)
    return mapped


def classify_with_kmeans(df: pd.DataFrame) -> pd.DataFrame:
    """Step 3: KMeans classify spectral classes from albedo."""
    print("[INGESTION] Running K-Means classification...", file=sys.stderr)
    result = df.copy()

    if len(result) < 3:
        result["class_label"] = "U"
        result["spectral_class"] = result["class_label"]
        print("[INGESTION] Not enough rows for KMeans, assigned 'U'", file=sys.stderr)
        return result

    X = result[["albedo"]].to_numpy()
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    labels = kmeans.fit_predict(X)
    centers = kmeans.cluster_centers_.flatten()
    ordered = np.argsort(centers)
    cluster_to_spectral = {
        ordered[0]: "C",
        ordered[1]: "S",
        ordered[2]: "M",
    }

    result["class_label"] = [cluster_to_spectral[label] for label in labels]
    result["spectral_class"] = result["class_label"]
    result["class"] = "NEO"

    distribution = result["class_label"].value_counts().to_dict()
    print(f"[INGESTION] ✅ Class distribution: {distribution}", file=sys.stderr)
    return result


def _normalize_existing(existing: pd.DataFrame) -> pd.DataFrame:
    df = existing.copy()

    if "id" not in df.columns and "designation" in df.columns:
        df["id"] = df["designation"].map(_build_id_from_designation)
    if "id" not in df.columns:
        df["id"] = ""

    if "spectral_class" not in df.columns:
        if "class_label" in df.columns:
            df["spectral_class"] = df["class_label"]
        else:
            df["spectral_class"] = "U"

    if "H" not in df.columns:
        if "absolute_magnitude" in df.columns:
            df["H"] = pd.to_numeric(df["absolute_magnitude"], errors="coerce")
        else:
            df["H"] = 20.0

    if "q" not in df.columns:
        df["a"] = pd.to_numeric(df.get("a"), errors="coerce")
        df["e"] = pd.to_numeric(df.get("e"), errors="coerce")
        df["q"] = df["a"] * (1 - df["e"])

    for col in OUTPUT_COLUMNS:
        if col not in df.columns:
            df[col] = np.nan

    df["id"] = df["id"].astype(str).str.strip().str.lower()
    return df[OUTPUT_COLUMNS]


def merge_with_existing(classified_df: pd.DataFrame) -> Tuple[pd.DataFrame, int, int]:
    """
    Merge newly ingested data with existing CSV.
    Keeps existing records, updates overlaps, and appends truly new asteroids.
    """
    csv_path = _get_csv_path()
    print(f"[INGESTION] Merging into {csv_path}...", file=sys.stderr)

    if csv_path.exists():
        existing_df = pd.read_csv(csv_path)
        existing_df = _normalize_existing(existing_df)
    else:
        existing_df = pd.DataFrame(columns=OUTPUT_COLUMNS)

    incoming = classified_df.copy()
    incoming["H"] = incoming["absolute_magnitude"]
    incoming["spectral_class"] = incoming["class_label"]

    for col in OUTPUT_COLUMNS:
        if col not in incoming.columns:
            incoming[col] = np.nan

    incoming = incoming[OUTPUT_COLUMNS]
    incoming["id"] = incoming["id"].astype(str).str.strip().str.lower()
    incoming = incoming[incoming["id"] != ""]
    incoming = incoming.drop_duplicates(subset=["id"], keep="last")

    existing_idx = existing_df.set_index("id", drop=False)
    incoming_idx = incoming.set_index("id", drop=False)

    overlapping_ids = existing_idx.index.intersection(incoming_idx.index)
    new_ids = incoming_idx.index.difference(existing_idx.index)

    if len(overlapping_ids) > 0:
        existing_idx.update(incoming_idx.loc[overlapping_ids])

    merged = pd.concat([existing_idx, incoming_idx.loc[new_ids]], axis=0, ignore_index=False)
    merged = merged.reset_index(drop=True)
    merged = _normalize_existing(merged)
    merged = merged.drop_duplicates(subset=["id"], keep="first")

    merged["neo"] = merged["neo"].fillna("Y")
    merged["pha"] = merged["pha"].fillna("N")
    merged["full_name"] = merged["full_name"].fillna("")
    merged["class"] = merged["class"].fillna("NEO")
    merged["spectral_class"] = merged["spectral_class"].fillna("U")
    merged["H"] = pd.to_numeric(merged["H"], errors="coerce").fillna(20.0)

    for col in ["moid", "e", "a", "q", "i", "diameter", "albedo"]:
        merged[col] = pd.to_numeric(merged[col], errors="coerce")

    merged = merged.dropna(subset=["moid", "e", "a", "i", "diameter", "albedo"])
    merged = merged.sort_values(by="id").reset_index(drop=True)

    added_count = int(len(new_ids))
    updated_count = int(len(overlapping_ids))
    return merged, added_count, updated_count


def export_to_csv(df: pd.DataFrame) -> str:
    """Step 4: Overwrite asteroid_labeled.csv with merged dataset."""
    csv_path = _get_csv_path()
    df.to_csv(csv_path, index=False)
    print(f"[INGESTION] ✅ Exported {len(df)} records to {csv_path}", file=sys.stderr)
    return str(csv_path)


def execute_pipeline() -> Tuple[bool, int]:
    """
    Master pipeline:
    Fetch -> Clean -> KMeans classify -> Merge with existing -> Export.

    Returns:
        (success, total_records_after_merge)
    """
    print("\n" + "=" * 64, file=sys.stderr)
    print("[INGESTION] 🚀 STARTING LIVE INGESTION + ML PIPELINE", file=sys.stderr)
    print("=" * 64, file=sys.stderr)

    try:
        raw_df = fetch_neo_data_from_nasa()
        clean_df = clean_and_transform(raw_df)
        if clean_df.empty:
            print("[INGESTION] ❌ No valid records after ETL", file=sys.stderr)
            return False, 0

        classified_df = classify_with_kmeans(clean_df)
        merged_df, added_count, updated_count = merge_with_existing(classified_df)
        export_path = export_to_csv(merged_df)

        print(f"[INGESTION] Added new asteroids: {added_count}", file=sys.stderr)
        print(f"[INGESTION] Updated existing asteroids: {updated_count}", file=sys.stderr)
        print(f"[INGESTION] Final asteroid count: {len(merged_df)}", file=sys.stderr)
        print(f"[INGESTION] Output path: {export_path}", file=sys.stderr)
        print("[INGESTION] ✅ PIPELINE SUCCESS", file=sys.stderr)
        print("=" * 64 + "\n", file=sys.stderr)
        return True, int(len(merged_df))

    except Exception as exc:
        print(f"[INGESTION] ❌ PIPELINE FAILED: {exc}", file=sys.stderr)
        print("=" * 64 + "\n", file=sys.stderr)
        return False, 0
