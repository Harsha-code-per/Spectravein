# SPECTRAVEIN · Orbital Mining Intelligence

Production-grade orbital intelligence platform combining a Next.js enterprise frontend with a modular FastAPI backend for live NEO analytics, mission economics, and interactive 3D telemetry.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Deployment Topology](#deployment-topology)
3. [Phase 1 Completion: Security & Performance](#phase-1-completion-security--performance)
4. [Phase 3 Completion: Live ML Ingestion Engine](#phase-3-completion-live-ml-ingestion-engine)
5. [API Surface](#api-surface)
6. [Repository Structure](#repository-structure)
7. [Local Development](#local-development)
8. [Environment Variables](#environment-variables)
9. [Operations: Running the Pipeline](#operations-running-the-pipeline)
10. [Legal & Disclaimer](#legal--disclaimer)

---

## System Architecture

SPECTRAVEIN is a decoupled, cloud-ready architecture:

- **Frontend:** Next.js 16 (App Router) on Vercel
- **Backend:** FastAPI (modular `app/` structure) on Render
- **Data Layer:** Live NASA/JPL SBDB ingestion merged into `backend/asteroid_labeled.csv`
- **Visualization:** Three.js / `@react-three/fiber` orbital projection components

```text
User Browser
   │
   ▼
Next.js Frontend (Vercel)
  - /            Landing + hero visualization
  - /dashboard   Target intelligence table
  - /analytics   3D orbital + finance + telemetry
   │
   ▼
FastAPI Backend (Render)
  - GET  /api/targets
  - POST /api/admin/pipeline/run (rate-limited)
   │
   ├── Services Layer (physics, economics, orbital, ingestion)
   ├── Data Loader (CSV abstraction)
   └── Models/Schemas (Pydantic)
   │
   ▼
NASA JPL SBDB API (Live Telemetry)
```

The frontend and backend are independently deployable and communicate over API contracts, enabling horizontal scale and independent release cycles.

---

## Deployment Topology

SPECTRAVEIN is actively deployed as two production services:

- **Frontend:** Vercel (global edge delivery for Next.js app)
- **Backend:** Render (FastAPI API service with environment-based configuration)

This separation provides operational isolation, lower blast radius, and clearer ownership boundaries between UI delivery and compute/data pipelines.

---

## Phase 1 Completion: Security & Performance

### Backend hardening

- `slowapi` rate limiting is integrated and active.
- Sensitive admin route protection is enforced:
  - `POST /api/admin/pipeline/run` with `@limiter.limit("2/minute")`
- CORS is environment-driven (`ALLOWED_ORIGINS`) via `pydantic-settings`.
- Wildcard CORS has been removed in favor of explicit allowed origins.

### Frontend performance optimization

- Heavy 3D landing assets are loaded with **dynamic imports** (SSR disabled where required).
- `React.memo` is applied to orbital visualization wrappers/components in `OrbitalOrrery.tsx` to reduce avoidable re-renders.
- Analytics UI was modularized into dedicated components for maintainability and rendering stability.

---

## Phase 3 Completion: Live ML Ingestion Engine

The live pipeline is implemented in:

```text
backend/app/services/ingestion.py
```

### What it does

1. Fetches NEO telemetry from NASA JPL SBDB (`sbdb_query.api`)
2. Cleans/transforms schema into internal target format
3. Runs unsupervised **K-Means** (`k=3`) on albedo
4. Maps cluster centers to spectral classes:
   - lowest center -> `C`
   - middle center -> `S`
   - highest center -> `M`
5. Merges incoming records with existing dataset by stable asteroid ID
6. Exports updated `backend/asteroid_labeled.csv`

### Why this is production-safe

- **Idempotent merge behavior:** re-runs update overlaps and append only truly new asteroids.
- **No destructive overwrite semantics:** existing custom rows are preserved unless matching IDs are intentionally updated.
- **Dynamic path resolution:** CSV path resolved with `pathlib` for local and cloud runtime parity.
- **Operational logging:** pipeline emits `stderr` status logs for cloud observability.

### Trigger route

The ingestion engine is exposed through an admin API:

```http
POST /api/admin/pipeline/run
```

This route executes the full Fetch -> ETL -> ML -> Merge -> Export workflow and returns processed counts.

---

## API Surface

```text
GET  /                      Health check
GET  /api/targets           Computed target intelligence payload
POST /api/admin/pipeline/run Admin-triggered live ingestion pipeline (2/min)
```

---

## Repository Structure

```text
SPECTRAVEIN/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py
│   │   ├── api/endpoints.py
│   │   ├── services/
│   │   │   ├── physics.py
│   │   │   ├── economics.py
│   │   │   ├── orbital.py
│   │   │   └── ingestion.py
│   │   ├── data/loader.py
│   │   └── models/schemas.py
│   ├── asteroid_labeled.csv
│   ├── pyproject.toml
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── page.tsx
    │   ├── dashboard/page.tsx
    │   └── analytics/page.tsx
    ├── components/
    │   ├── analytics/
    │   └── ui/OrbitalOrrery.tsx
    └── package.json
```

---

## Local Development

### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`, backend on `http://localhost:8000`.

---

## Environment Variables

### Backend

```bash
ALLOWED_ORIGINS=http://localhost:3000,https://your-vercel-domain.vercel.app
DATABASE_URL=
SUPABASE_DATABASE_URL=
SUPABASE_DATABASE_URL_DIRECT=
ENVIRONMENT=development
LOG_LEVEL=INFO
```

### Frontend

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Operations: Running the Pipeline

Manual trigger example:

```bash
curl -X POST "https://<your-render-service>/api/admin/pipeline/run"
```

Expected behavior:

- Pull latest NEO telemetry from NASA
- Reclassify incoming records (K-Means k=3)
- Merge into existing dataset without destructive replacement
- Return success payload with `asteroids_processed`

---

## Legal & Disclaimer

All valuations, mission cost projections, net profit calculations, and ROI models produced by SPECTRAVEIN are **theoretical economic simulations for research and demonstration purposes only**. They do not constitute financial advice, investment advice, legal counsel, or operational mission-planning guidance.

The Planetary Defense Lock feature reflects the authors' good-faith interpretation of the Outer Space Treaty (1967), the Artemis Accords (2020), and current UN Committee on the Peaceful Uses of Outer Space (COPUOS) guidelines. It does not constitute legal counsel and should not be relied upon for actual regulatory compliance.
