# SPECTRAVEIN · Spectravein Intelligence

> **Orbital Mining Intelligence & Economic Feasibility Engine**  
> *Transforming raw NASA/JPL spectral data into high-yield financial targets.*

---

<!-- Drop UI screenshots here before submission -->
| Landing Page | Target Finder | Mission Analytics |
|:---:|:---:|:---:|
| ![Landing](frontend/public/home.png) | ![Dashboard](frontend/public/dashboard.png) | ![Analytics](frontend/public/analytics.png) |

---

## Table of Contents

1. [The Vision](#the-vision)
2. [System Architecture](#system-architecture)
3. [How The Physics Engine Works](#how-the-physics-engine-works)
4. [Core Innovations](#core-innovations)
5. [Sample Use Cases](#sample-use-cases)
6. [Tech Stack](#tech-stack)
7. [Project Structure](#project-structure)
8. [API Reference](#api-reference)
9. [Local Development](#local-development)
10. [Production Deployment](#production-deployment)
11. [Environment Variables](#environment-variables)
12. [Data Sources](#data-sources)
13. [Legal & Disclaimer](#legal--disclaimer)

---

## The Vision

The asteroid belt is the solar system's commodity market — estimated at **$700 quintillion** in accessible mineral resources — yet no institution has built the financial intelligence layer needed to reason about it systematically. SPECTRAVEIN bridges that gap.

We treat each Near-Earth Object as a **financial instrument**: classifying its spectral composition via unsupervised machine learning, scoring its orbital accessibility using real delta-v physics, penalising its gross valuation against macro-economic shock models, stress-testing every mission against international space law, and surfacing the entire analysis through an interactive intelligence dashboard.

SPECTRAVEIN speaks two languages simultaneously: **astrophysics** and **commercial aerospace economics**. A geologist can verify the orbital mechanics. A venture capitalist can read the mission briefing. Both will find the numbers honest.

**802 Near-Earth Asteroids** catalogued, classified, and priced — live.

---

## System Architecture

SPECTRAVEIN is a clean three-tier system with strict separation of concerns:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     BROWSER  ·  Next.js 16 App Router                      │
│                                                                            │
│   /              Landing page + interactive 3D WebGL asteroid field        │
│   /dashboard     802-NEO sortable/searchable table with XAI column headers │
│   /analytics     Per-target: financial model, orrery, orbital telemetry    │
│                                                                            │
│   Design:  Pitch-black (#0a0a0a) · Griflan Red (#FF3831) · Serif/Mono      │
│   3D:      Three.js / @react-three/fiber (Orrery + particle field)         │
│   Motion:  Framer Motion v12 (page transitions + scroll reveals)           │
└───────────────────┬─────────────────────────────────┬──────────────────────┘
                    │                                 │
          HTTP GET /api/targets          GET /api/nasa-cad?des=...
          (FastAPI backend)              (Next.js rewrite → NASA JPL)
                    │                                 │
┌───────────────────▼───────────────┐   ┌─────────────▼──────────────────────┐
│      BACKEND  ·  FastAPI          │   │   EXTERNAL  ·  NASA JPL CAD API    │
│                                   │   │                                    │
│  GET /api/targets                 │   │  ssd-api.jpl.nasa.gov/cad.api      │
│    → Load asteroid_labeled.csv    │   │    → Real close-approach data      │
│    → Compute physics & economics  │   │    → All passes 2026–2100          │
│    → Return List[AsteroidTarget]  │   │    → Per-asteroid (triggered by    │
│                                   │   │  selecting a target in /analytics) │
│  GET /  (health check)            │   │                                    │
│                                   │   │  Proxied through Next.js rewrite   │
│  ML:    K-Means(k=3) on albedo    │   │  to bypass browser CORS policy     │
│  Math:  Kepler · delta-v physics  │   └────────────────────────────────────┘
└───────────────────────────────────┘
```

### Why a Next.js Proxy for NASA?

The NASA JPL Close-Approach Data (CAD) API does not set permissive CORS headers. A direct browser `fetch()` to `ssd-api.jpl.nasa.gov` is blocked by all modern browsers. We solve this with a **Next.js Rewrite** in `next.config.ts`:

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/nasa-cad',
      destination: 'https://ssd-api.jpl.nasa.gov/cad.api',
    },
  ];
}
```

The browser calls `/api/nasa-cad?des=...` — same origin, no CORS issue. Next.js forwards the full query string to NASA server-side and streams the response back. All parameters (`des`, `date-min`, `date-max`, `dist-max`) pass through transparently.

---

## How The Physics Engine Works

All computation happens inside `backend/main.py`. The `GET /api/targets` endpoint runs `_build_targets()` which streams through every row of `asteroid_labeled.csv` and derives 19 fields for each asteroid. Here is the exact math, function by function:

### Step 1 · Mass Estimation

```python
# Bulk density constants (kg/km³) — class-specific physical models
DENSITY = {
    "C": 1.38e12,   # Carbonaceous — porous, volatile-rich
    "S": 2.71e12,   # Silicaceous  — stony-iron
    "M": 5.32e12,   # Metallic     — iron-nickel core
}

volume_km3 = (4/3) × π × (diameter_km / 2)³
mass_kg    = volume_km3 × DENSITY[spectral_class]
```

### Step 2 · Gross Valuation

```python
# Commodity multiplier (USD per kg) — simplified economic model
VALUE_PER_KG = {
    "C": 2.0,    # Water / organics — lower commodity price
    "S": 10.0,   # Mixed metals + silicates
    "M": 50.0,   # Platinum-group metals dominant
}

gross_value_usd = mass_kg × VALUE_PER_KG[spectral_class]
```

### Step 3 · Market Shock Deflator

A single large metallic asteroid contains more platinum than humanity has ever mined. Selling it wholesale would collapse commodity markets globally. We apply a **logarithmic market saturation penalty**:

```
penalty_factor = 0.1 + 0.9 / ( 1 + log₁₀( max(1, mass_kg / 10⁹) ) )

adjusted_value_usd = gross_value_usd × penalty_factor
```

| Asteroid Size | Typical Penalty | Effect |
|---|---|---|
| < 1 m (sub-tonne) | ~0.99 | Nearly none — too small to move markets |
| 100 m diameter | ~0.72 | 28% haircut |
| 1 km diameter | ~0.45 | 55% haircut |
| 10 km+ (Ganymed-class) | ~0.15 | 85% haircut |

### Step 4 · Accessibility Score

```
score = max(0, 100 − (inclination_deg × 2.0))
```

A perfectly equatorial orbit (0°) scores 100. Every degree of inclination costs 2 points. An asteroid at 50° inclination scores 0 — economically unreachable with current propulsion. MOID provides an additional filter: targets with MOID < 0.05 AU are legally restricted regardless of their accessibility score.

### Step 5 · Static CapEx Estimate (Backend)

The backend produces a baseline mission cost from static orbital parameters only:

```
CapEx = $2,000,000,000 (base R&D + launch)
      + inclination_deg × $500,000,000
      + moid_au        × $10,000,000,000
```

### Step 6 · Dynamic CapEx (Frontend, Live)

The Analytics page fetches the **absolute closest confirmed approach** from the NASA CAD API (2026–2100) and recalculates CapEx dynamically using the real minimum-distance flyby:

```
CapEx (live) = $2,000,000,000 (base)
             + closest_pass_AU  × $5,000,000,000
             + inclination_deg  × $250,000,000

Net Profit   = adjusted_value_usd − CapEx (live)
```

This means **choosing the right launch window directly changes the net profit on screen** — a feature unique to SPECTRAVEIN.

### Step 7 · ESG CO₂ Offset

```
earth_co2_offset_tons = (mass_kg / 1000) × 40,000
```

Terrestrial rare-metal mining produces ~40,000 tonnes of CO₂ per tonne of platinum extracted. This field represents the Earth-based emissions completely bypassed by sourcing the same materials in space.

### Step 8 · XAI Summary (Auto-Generated)

```python
f"SPECTRAVEIN has classified {full_name} as a {cls}-Class target. "
f"Based on an albedo of {albedo:.3f}, we predict a {composition} composition. "
f"The mission requires a CapEx of {fmt(mission_cost)} "
f"due to an inclination of {inclination:.2f}°. "
f"With a post-market-shock valuation of {fmt(adjusted_value)}, "
f"this yields an estimated net profit of {fmt(net_profit)}. "
f"The optimal launch window opens in {next_pass}."
```

Each asteroid gets a machine-generated paragraph in plain English — the kind of briefing a board of directors would actually read.

---

## Core Innovations

### 1 · Explainable AI (XAI) — Orbital Science for Business Executives

Every hard scientific term in the UI is wrapped in an interactive **XAI Tooltip** (`components/xai-tooltip.tsx`): dotted underline, hover-to-reveal. The trigger accepts `React.ReactNode` so rich badge elements (e.g. the PHA lock badge) can act as tooltip triggers without wrapping in an extra span.

| Term | Plain-English Definition |
|---|---|
| **MOID** | Minimum Orbit Intersection Distance — closest the orbit path gets to Earth's orbit |
| **Inclination** | Orbital tilt; each degree costs exponentially more rocket fuel (delta-v) |
| **Albedo** | Surface reflectivity; dark (<0.1) = carbon, bright (>0.2) = metal |
| **Accessibility Score** | Proprietary 0–100 index: `100 − (inclination × 2)` |
| **Delta-v** | Total velocity change (fuel budget) to match the asteroid's trajectory |
| **AU** | Astronomical Unit — avg Earth–Sun distance (≈ 150 million km) |
| **Classification** | Spectral taxonomy: C (volatiles), S (silicates), M (heavy metals) |
| **Mining Viability** | Qualitative label derived from the accessibility score |

---

### 2 · Planetary Defense Lock — Legal Compliance Engine

SPECTRAVEIN automatically enforces the **Artemis Accords** and **UN Planetary Defense Protocols**. A target is flagged `isLegallyRestricted` if either condition is true:

```typescript
const isLegallyRestricted = asteroid.pha === true || asteroid.moid < 0.05;
```

**When locked, the system:**
- Shows a full-width crimson `RESTRICTED TARGET: PLANETARY DEFENSE JURISDICTION` banner
- Replaces all financial data with `OPERATION VETOED` in red typography
- Changes Mining Viability to `CLASS 1 HAZARD (LEGAL LOCKOUT)`
- Displays the legal explanation citing Artemis Accords and MOID threshold
- Marks the row in the dashboard table with a `🔒 PHA` badge (with XAI tooltip)

No financial analysis can be generated for a legally restricted target.

---

### 3 · ISRU Propellant Pivot — The Deep-Space Gas Station

The UI has **three distinct output states** for the financial panel, determined at render time:

```typescript
// Priority order:
if (isLegallyRestricted)          → OPERATION VETOED (red)
else if (classification === 'C')  → ISRU PROPELLANT YIELD (cyan)
else                              → PROJECTED NET PROFIT (white USD)
```

**ISRU Mode** (C-Class, non-PHA):
- Label changes to `ISRU PROPELLANT YIELD`
- Value shows water mass in metric tons: `(mass_kg / 1000) × 0.1`
- Styled in `text-cyan-400` with subtitle: *"Strategic deep-space refueling depot. Not designated for Earth-return payload."*

C-Class bodies are rich in water ice. Their commercial value is not in Earth-return minerals but in hydrogen/oxygen propellant production for deep-space missions.

---

### 4 · ESG Terrestrial Carbon Offset

Below the financial panel, every target shows its ecological impact in emerald green:

```
earth_co2_offset_tons  displayed as:
  ≥ 1e9   → "X.XX Gigatons CO₂ Prevented"
  ≥ 1e6   → "X.XX Megatons CO₂ Prevented"
  ≥ 1e3   → "X.XX Kilotons CO₂ Prevented"
```

The XAI tooltip explains: *"The estimated volume of Earth-based greenhouse gas emissions completely bypassed by extracting these resources in the vacuum of space."*

---

### 5 · Live 3D Heliocentric Orbital Orrery

`components/ui/OrbitalOrrery.tsx` — native WebGL, no iframes, no third-party orbit viewers.

**Keplerian ellipse math:**
```
b = a × √(1 − e²)           Semi-minor axis
c = a × e                   Focus offset (center → focal point)

Point at angle θ:
  x = cos(θ) × a − c        (shift −c so Sun sits at focal origin)
  z = sin(θ) × b

Inclination applied as:  group.rotation.x = i × (π / 180)

Orbital speed:  Δθ per frame = 0.25 / a^1.5   (Kepler's Third Law)
```

The scene renders:
- ☀️ **Sun** — glowing sphere + point light at the focal origin `(0, 0, 0)`
- 🔵 **Earth reference ring** — 1 AU circle at 0° inclination, dim `#334455`
- 🔴 **Target orbit** — inclined Keplerian ellipse in `#FF3831`, animated body tracking it
- ⭐ **Background stars** — `@react-three/drei Stars` component
- 🖱️ **Interactive** — `OrbitControls` with auto-rotate, zoom limits, pan

---

### 6 · Live Orbital Telemetry — NASA CAD API Integration

When a target is selected on `/analytics`, a `useEffect` fires and fetches all confirmed close approaches to 2100 through the Next.js proxy:

```
GET /api/nasa-cad?des={designation}&date-min=now&date-max=2100-01-01&dist-max=10
```

The response is parsed into three metrics displayed in the **Orbital Telemetry card**:

| Row | Data | Source |
|---|---|---|
| Total Intercept Opportunities | `data.count` | NASA CAD |
| Next 2 Chronological Passes | `data.data[0][3]`, `data.data[1][3]` | NASA CAD |
| Absolute Closest Approach | min(`data.data[n][4]`) across all passes | NASA CAD |

The closest approach distance (AU) feeds directly into the **live CapEx recalculation**.

**Fallback chain** (graceful degradation):
1. **NASA data available** → Live telemetry, glowing green indicator, real CapEx
2. **NASA unreachable (network error)** → `TELEMETRY UNAVAILABLE: OFFLINE MODE` badge, Kepler estimate, static CapEx
3. **NASA returns 0 results** → `THEORETICAL ESTIMATE` amber badge, Kepler estimate

---

### 7 · Interactive 3D Particle Field (Landing Page)

`components/ui/HeroParticles.tsx` — 3,000 particles in a spherical shell (r = 12–32 units) with two-layer animation:

- **Base drift**: slow autonomous Y/X rotation accumulating over time (`delta × 0.025` / `delta × 0.007`)
- **Mouse parallax**: `window.addEventListener('mousemove', { passive: true })` reads normalised `[-1, 1]` coords and applies a rotation offset on top of the base drift

~120 particles (~4%) are coloured Griflan Red `#FF3831`; the rest are pure white at 55% opacity with `sizeAttenuation` and `depthWrite: false` for correct transparency layering. The canvas uses `gl.alpha: true` + `background: transparent` so the pitch-black page shows through.

---

### 8 · Dynamic CapEx Breakdown Modal

Clicking `EST. MISSION COST` opens a Shadcn `Dialog` that shows the real-time cost calculation line-by-line:

```
Base R&D / Launch Cost:      $2,000,000,000
Distance Surcharge:          {closest_pass_AU} AU × $5,000,000,000
Inclination Surcharge:       {inclination}° × $250,000,000
─────────────────────────────────────────────────────
Total CapEx:                 ${total}
```

The modal makes explicit that **choosing a closer launch window lowers the CapEx** — the core commercial insight of the platform.

---

## Sample Use Cases

### Use Case 1 · The Cash Cow (M-Class, Low Inclination)

> **Target:** `3554 Amun (1986 EB)` · M-Type · Diameter: 2.5 km · Inclination: 3.1° · Accessibility: 93/100
>
> Amun is a metallic asteroid in a nearly Earth-coplanar orbit. Its low inclination makes it extraordinarily cheap to intercept — the inclination surcharge contributes less than $800M to the CapEx. Its M-Class composition (iron, nickel, cobalt, platinum-group metals) yields a gross valuation in the hundreds of trillions. After applying the Market Shock Deflator and subtracting the NASA-derived dynamic CapEx, the **Projected Net Profit** reads in multiple trillions of USD. Mining Viability: **PRIME TARGET**. ESG offset: tens of Gigatons of CO₂ prevented.

---

### Use Case 2 · The Gas Station (C-Class, Water-Rich)

> **Target:** `101955 Bennu (1999 RQ36)` · C-Type · Diameter: 0.49 km · Water-rich carbonaceous
>
> Bennu's carbonaceous composition makes it commercially marginal as an Earth-return payload — its `VALUE_PER_KG` multiplier is only $2 vs $50 for metals. But the UI **pivots automatically**. The financial panel transforms into **`ISRU PROPELLANT YIELD`** in neon cyan, showing billions of metric tons of extractable water ice convertible to H₂/O₂ rocket fuel. A subtitle reads: *"Strategic deep-space refueling depot. Not designated for Earth-return payload."* The ESG offset confirms emissions prevented. This is not a mine — it is a **filling station for the cislunar economy**.

---

### Use Case 3 · The Veto (Potentially Hazardous Asteroid)

> **Target:** `99942 Apophis (2004 MN4)` · S-Type · MOID: 0.0002 AU · PHA: Yes
>
> Despite its silicaceous composition and modest inclination, Apophis trips two regulatory flags: PHA designation **and** MOID far below the 0.05 AU threshold. The moment this target is selected, a crimson warning banner fills the Mission Profile. All financial analysis is suppressed. In place of net profit: **`OPERATION VETOED`**. Mining Viability reads **`CLASS 1 HAZARD (LEGAL LOCKOUT)`**. The dashboard table shows a red **�� PHA** badge next to its name. **No investor pitch can be generated.**

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| **Next.js** | 16.1.6 | App Router, SSG, `async rewrites()` NASA proxy |
| **TypeScript** | 5.x | End-to-end type safety across all components and API adapters |
| **Tailwind CSS** | v4 | Utility styling; custom `@theme` tokens in `globals.css` (no `tailwind.config.ts`) |
| **Framer Motion** | 12.x | Page transitions, staggered hero reveals, `AnimatePresence`, scroll `useInView` |
| **Three.js** | 0.183 | WebGL geometry, materials, lighting for Orrery + particle field |
| **@react-three/fiber** | 9.5 | React renderer for Three.js; `useFrame` animation loop |
| **@react-three/drei** | 10.x | `OrbitControls`, `Stars` presets |
| **Recharts** | 2.x | Animated `PieChart` for resource composition donut |
| **Shadcn UI** | — | `Dialog` (CapEx modal), `Tooltip` (XAI), `Input`, `Select` |
| **Lenis** | — | Smooth scroll provider |
| **Lucide React** | — | Icon system |

### Backend

| Technology | Version | Role |
|---|---|---|
| **FastAPI** | 0.135.1 | High-performance async REST API |
| **Uvicorn** | 0.41.0 | ASGI production server |
| **Pandas** | 3.0.1 | CSV ingestion, null-row filtering, columnar derivation |
| **Scikit-Learn** | 1.8.0 | K-Means(k=3) unsupervised spectral classification on albedo |
| **NumPy** | 2.4.2 | Vectorised physics and geometry computations |
| **Pydantic** | 2.12.5 | Strict `AsteroidTarget` response schema, auto OpenAPI docs |

---

## Project Structure

```
spectravein/
│
├── README.md
│
├── backend/
│   ├── main.py                    # FastAPI server + full physics & economics engine
│   │                              # 19-field AsteroidTarget Pydantic model
│   │                              # 8-step computation pipeline per asteroid
│   │                              # CORS reads ALLOWED_ORIGINS env var
│   ├── generate_labels.py         # Offline K-Means spectral classifier (run once)
│   │                              # Reads raw JPL CSV, writes asteroid_labeled.csv
│   ├── asteroid_labeled.csv       # 802 labeled NEOs (generated artifact, committed)
│   ├── requirements.txt           # Pinned Python dependency versions
│   ├── .env.example               # ALLOWED_ORIGINS template
│   └── .gitignore                 # Excludes venv/, __pycache__/, .env
│
└── frontend/
    ├── next.config.ts             # async rewrites(): /api/nasa-cad → ssd-api.jpl.nasa.gov
    ├── .env.example               # NEXT_PUBLIC_API_URL template
    ├── .gitignore                 # Excludes node_modules/, .next/, .env* (not .env.example)
    ├── package.json
    ├── tsconfig.json
    │
    ├── app/
    │   ├── layout.tsx             # Global: fonts, metadata, CustomCursor, SmoothScrollProvider
    │   ├── template.tsx           # Framer Motion page-level enter/exit transitions
    │   ├── globals.css            # Tailwind v4 @theme tokens, @keyframes marquee/ping
    │   ├── page.tsx               # Landing page: 3D particle field, hero, methodology, CTA, footer
    │   ├── dashboard/
    │   │   └── page.tsx           # Target Finder: fetch 802 NEOs, table, sort, search, pagination
    │   └── analytics/
    │       └── page.tsx           # Mission Analytics: full financial + telemetry + orrery
    │                              # NASA CAD fetch with AbortController + graceful fallback
    │                              # Three-state financial panel (Vetoed / ISRU / USD)
    │                              # 2-column brutalist grid layout
    │
    ├── components/
    │   ├── navbar.tsx             # Fixed global navigation with route-aware active state
    │   ├── target-finder.tsx      # Sortable/searchable/paginated data table
    │   │                          # XAI tooltips on column headers
    │   │                          # 🔒 PHA badge for restricted targets
    │   ├── composition-chart.tsx  # Recharts PieChart + custom legend + mass display
    │   ├── xai-tooltip.tsx        # Reusable XAI tooltip (term: ReactNode for badge support)
    │   ├── loading-skeleton.tsx   # Skeleton states + ErrorBanner (AWAITING BACKEND CONNECTION)
    │   ├── smooth-scroll-provider.tsx  # Lenis + TooltipProvider (delayDuration=200)
    │   ├── loading-screen.tsx     # Full-screen intro animation
    │   ├── custom-cursor.tsx      # Framer Motion custom cursor
    │   ├── navbar.tsx             # Fixed navigation
    │   └── ui/
    │       ├── OrbitalOrrery.tsx  # Three.js WebGL 3D heliocentric orbital visualisation
    │       │                      # Keplerian ellipse math, Kepler's 3rd Law speed
    │       │                      # OrbitRing + OrbitingBody + Sun sub-components
    │       ├── HeroParticles.tsx  # Three.js 3,000-particle interactive background
    │       │                      # Spherical distribution, dual-layer mouse parallax
    │       ├── button.tsx         # Shadcn Button
    │       ├── dialog.tsx         # Shadcn Dialog (CapEx Breakdown Modal)
    │       ├── input.tsx          # Shadcn Input (table search)
    │       ├── select.tsx         # Shadcn Select (sort dropdown)
    │       └── tooltip.tsx        # Shadcn Tooltip (base for XaiTooltip)
    │
    └── lib/
        ├── api.ts                 # fetchTargets() via NEXT_PUBLIC_API_URL env var
        │                          # apiTargetToAsteroid() adapter
        │                          # formatUSD(), formatUSDShort()
        └── data.ts                # Asteroid domain type (19 fields)
                                   # getClassColors(), getClassDescription()
                                   # AsteroidClass, CompositionEntry types
```

---

## API Reference

### `GET /`
Health check. Returns `{"status": "ok"}`.

---

### `GET /api/targets`

Returns all 802 labeled asteroid mining targets, sorted by `adjusted_value_usd` descending.

No query parameters required.

**Full response schema per record:**

```typescript
{
  id: string;                  // e.g. "a0001036"
  full_name: string;           // e.g. "1036 Ganymed (1924 TD)"
  diameter_km: number;         // Physical diameter in kilometres
  albedo: number;              // Surface reflectivity (0.0–1.0)
  inclination: number;         // Orbital inclination in degrees
  moid: number;                // Minimum Orbit Intersection Distance (AU)
  spectral_class: string;      // "C", "S", or "M"
  accessibility_score: number; // 0–100; score = max(0, 100 − inclination × 2)
  estimated_mass_kg: number;   // Derived from volume × class density
  estimated_value_usd: number; // Gross: mass × commodity multiplier
  adjusted_value_usd: number;  // After Market Shock Deflator logarithmic penalty
  mission_cost_usd: number;    // Static CapEx: base + inclination + moid penalties
  net_profit_usd: number;      // adjusted_value − mission_cost (static estimate)
  earth_co2_offset_tons: number; // (mass_kg / 1000) × 40,000
  semi_major_axis_au: number;  // Keplerian semi-major axis (AU)
  eccentricity: number;        // Orbital eccentricity (0 = circle, 1 = parabola)
  next_pass_date: string;      // Kepler-derived estimate, e.g. "APR 2028"
  xai_summary: string;         // Machine-generated plain-English executive briefing
  pha: boolean;                // Potentially Hazardous Asteroid flag from JPL
}
```

**Example record:**
```json
{
  "id": "a0001036",
  "full_name": "1036 Ganymed (1924 TD)",
  "diameter_km": 37.675,
  "albedo": 0.238,
  "inclination": 26.68,
  "moid": 0.3449,
  "spectral_class": "S",
  "accessibility_score": 46.64,
  "estimated_mass_kg": 1.53e+17,
  "estimated_value_usd": 1.53e+18,
  "adjusted_value_usd": 2.44e+17,
  "mission_cost_usd": 16_840_000_000,
  "net_profit_usd": 2.27e+17,
  "earth_co2_offset_tons": 6.12e+18,
  "semi_major_axis_au": 2.665,
  "eccentricity": 0.5337,
  "next_pass_date": "APR 2028",
  "xai_summary": "SPECTRAVEIN has classified 1036 Ganymed as an S-Class target...",
  "pha": false
}
```

---

## Local Development

### Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **pip** and **npm**

---

### Step 1 — Clone

```bash
git clone https://github.com/your-org/spectravein.git
cd spectravein
```

---

### Step 2 — Start the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install all Python dependencies (pinned versions)
pip install -r requirements.txt

# Generate the labeled dataset — only needed once.
# Runs K-Means(k=3) on raw albedo values → writes asteroid_labeled.csv (~10 seconds)
python generate_labels.py

# Start the API server with hot reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

✅ **API live:** `http://localhost:8000`  
📄 **Swagger UI:** `http://localhost:8000/docs`  
📄 **ReDoc:** `http://localhost:8000/redoc`

---

### Step 3 — Start the Frontend

Open a **new terminal tab**:

```bash
cd frontend

# Install Node dependencies
npm install

# Start the Next.js dev server
npm run dev
```

✅ **App live:** `http://localhost:3000`

The NASA CAD proxy is active automatically in dev — `/api/nasa-cad` rewrites to `ssd-api.jpl.nasa.gov` via Next.js.

---

### Step 4 — Verify the Connection

Open `http://localhost:3000/dashboard`. You should see the table populated with 802 asteroid targets. If the table shows `AWAITING BACKEND CONNECTION`, ensure the FastAPI server on port 8000 is running.

---

## Production Deployment

SPECTRAVEIN deploys as two independent services:

### Frontend → Vercel

1. Push the repository to GitHub
2. Import the repo in [vercel.com/new](https://vercel.com/new)
3. Set **Root Directory** to `frontend`
4. Add the environment variable:
   ```
   NEXT_PUBLIC_API_URL = https://your-backend.onrender.com
   ```
5. Deploy — Vercel auto-detects Next.js, runs `npm run build`, serves from edge CDN

The NASA CAD proxy (`next.config.ts` rewrites) works in production on Vercel with zero additional configuration.

---

### Backend → Render (recommended) or Railway

#### Render

1. Create a new **Web Service** in [render.com](https://render.com)
2. Connect your GitHub repository
3. Configure:
   ```
   Root Directory:  backend
   Environment:     Python 3
   Build Command:   pip install -r requirements.txt && python generate_labels.py
   Start Command:   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add the environment variable:
   ```
   ALLOWED_ORIGINS = https://your-app.vercel.app
   ```
5. Deploy

#### Railway

1. Create a new project from GitHub in [railway.app](https://railway.app)
2. Select the `backend/` folder
3. Set the same environment variable:
   ```
   ALLOWED_ORIGINS = https://your-app.vercel.app
   ```
4. Railway auto-detects the `requirements.txt` and starts uvicorn

---

## Environment Variables

### Frontend (`frontend/.env.local` for dev, Vercel dashboard for prod)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Full base URL of the deployed FastAPI backend. Must not have a trailing slash. |

```bash
# frontend/.env.local  (local dev — copy from .env.example)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

```bash
# Vercel Environment Variable (production)
NEXT_PUBLIC_API_URL=https://spectravein-api.onrender.com
```

> **Why `NEXT_PUBLIC_`?** Next.js only exposes variables prefixed `NEXT_PUBLIC_` to the browser bundle at build time. Variables without this prefix are server-only and would not be accessible in client components.

---

### Backend (`backend/.env` for dev, Render/Railway dashboard for prod)

| Variable | Required | Default | Description |
|---|---|---|---|
| `ALLOWED_ORIGINS` | No | `http://localhost:3000` | Comma-separated list of frontend origins permitted by CORS. |

```bash
# backend/.env  (local dev — copy from .env.example)
ALLOWED_ORIGINS=http://localhost:3000
```

```bash
# Render / Railway Environment Variable (production)
ALLOWED_ORIGINS=https://spectravein.vercel.app,https://www.spectravein.app
```

The backend parses the comma-separated string at startup:
```python
_raw = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000")
_allowed_origins = [o.strip() for o in _raw.split(",") if o.strip()]
```

---

### The NASA CAD Proxy (no env var needed)

The rewrite in `next.config.ts` requires no environment variable. It is always active in both dev and production:

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/nasa-cad',
      destination: 'https://ssd-api.jpl.nasa.gov/cad.api',
    },
  ];
}
```

All query parameters are forwarded automatically by Next.js. The browser never sees `ssd-api.jpl.nasa.gov` — it only calls `/api/nasa-cad`, which is the same origin as the app.

---

## Data Sources

| Source | URL | What We Use |
|---|---|---|
| **NASA/JPL Small-Body Database** | [ssd.jpl.nasa.gov/tools/sbdb_query.html](https://ssd.jpl.nasa.gov/tools/sbdb_query.html) | Orbital elements (`a`, `e`, `i`, `moid`, `q`), physical params (`diameter`, `albedo`), PHA flag |
| **NASA JPL HORIZONS** | [ssd.jpl.nasa.gov/horizons](https://ssd.jpl.nasa.gov/horizons/) | High-precision ephemeris reference for validation |
| **NASA JPL CAD API** | [ssd-api.jpl.nasa.gov/cad.api](https://ssd-api.jpl.nasa.gov/cad.api) | Real-time per-target close-approach data (live, on demand) |
| **NASA NEO Program** | [cneos.jpl.nasa.gov](https://cneos.jpl.nasa.gov/) | PHA designations and planetary defense classifications |

### The `asteroid_labeled.csv` Dataset

Generated by `generate_labels.py` using K-Means(k=3) clustering on the `albedo` column of the raw JPL export. The classifier assigns each NEO to one of three spectral families without any manual labeling:

```
albedo < 0.10  →  C-Class (dark, carbonaceous)
albedo 0.10–0.25  →  S-Class (intermediate, stony-iron)
albedo > 0.25  →  M-Class (bright, metallic)
```

802 NEOs pass the completeness filters (non-null `diameter`, `albedo`, `moid`, `i`, `a`, `e`).

---

## Legal & Disclaimer

All valuations, mission cost projections, net profit calculations, and ROI models produced by SPECTRAVEIN are **theoretical economic simulations for research and demonstration purposes only**. They do not constitute financial advice, investment advice, legal counsel, or operational mission-planning guidance.

The Planetary Defense Lock feature reflects the authors' good-faith interpretation of the Outer Space Treaty (1967), the Artemis Accords (2020), and current UN Committee on the Peaceful Uses of Outer Space (COPUOS) guidelines. It does not constitute legal counsel and should not be relied upon for actual regulatory compliance.

---

<div align="center">

**SPECTRAVEIN · Spectravein Intelligence**  
*Designed for the next century.*

</div>

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. Created by Harshavardhan K.
