'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, TrendingDown, TrendingUp, Zap, Compass, Activity, BrainCircuit, Calculator, Orbit } from 'lucide-react';
import { Asteroid, getClassColors, getClassDescription } from '@/lib/data';
import { fetchTargets, formatUSD } from '@/lib/api';
import { CompositionChart } from '@/components/composition-chart';
import dynamic from 'next/dynamic';

const OrbitalOrrery = dynamic(
  () => import('@/components/ui/OrbitalOrrery').then(m => m.OrbitalOrrery),
  { 
    ssr: false, 
    loading: () => <div className="h-[400px] w-full bg-black/50 animate-pulse border border-white/10 rounded-lg flex items-center justify-center text-white/50 font-mono text-sm tracking-widest">INITIALIZING ORBITAL TELEMETRY...</div> 
  }
);
import { XaiTooltip } from '@/components/xai-tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const ease = [0.16, 1, 0.3, 1] as const;

// ── Helpers ─────────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  return s >= 80 ? '#34d399' : s >= 60 ? '#fbbf24' : s >= 40 ? '#fb923c' : '#f87171';
}
function viabilityLabel(s: number) {
  return s >= 80 ? 'PRIME TARGET' : s >= 60 ? 'VIABLE' : s >= 40 ? 'MODERATE' : 'HIGH Δ-V';
}
function formatMass(kg: number): string {
  if (kg >= 1e18) return `${(kg / 1e18).toFixed(2)} ×10¹⁸ kg`;
  if (kg >= 1e15) return `${(kg / 1e15).toFixed(2)} ×10¹⁵ kg`;
  if (kg >= 1e12) return `${(kg / 1e12).toFixed(2)} ×10¹² kg`;
  if (kg >= 1e9)  return `${(kg / 1e9).toFixed(2)} ×10⁹ kg`;
  return `${kg.toLocaleString()} kg`;
}

/** Formats a signed USD value (handles negative net profit). */
function formatUSDSigned(usd: number): { sign: string; value: string; unit: string } {
  const sign = usd < 0 ? '-' : '';
  const abs = Math.abs(usd);
  if (abs >= 1e18) return { sign, value: (abs / 1e18).toFixed(2), unit: 'Quintillion USD' };
  if (abs >= 1e15) return { sign, value: (abs / 1e15).toFixed(2), unit: 'Quadrillion USD' };
  if (abs >= 1e12) return { sign, value: (abs / 1e12).toFixed(2), unit: 'Trillion USD' };
  if (abs >= 1e9)  return { sign, value: (abs / 1e9).toFixed(2),  unit: 'Billion USD' };
  if (abs >= 1e6)  return { sign, value: (abs / 1e6).toFixed(2),  unit: 'Million USD' };
  return { sign, value: abs.toLocaleString(), unit: 'USD' };
}

// Animated 1px progress bar
function AnimBar({
  value, max, color, delay = 0,
}: { value: number; max: number; color: string; delay?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-px w-full bg-white/10">
      <motion.div
        className="h-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.1, ease, delay }}
      />
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-white/8" />;
}

// ── NASA Trajectory types & helpers ─────────────────────────────────────────

interface PassEntry {
  date: string;
  distAU: number;
}

interface TrajectoryData {
  totalPasses: number;
  nextTwo: Array<{ date: string; distAU: number | null }>;
  closestPass: PassEntry | null;
  isEstimate: boolean;
}

/** Parse NASA CAD date "2027-Jan-15 03:58" → "Jan 15, 2027" */
function formatNasaDate(raw: string): string {
  const datePart = raw.split(' ')[0];
  const parts = datePart.split('-');
  if (parts.length < 3) return raw;
  const [year, month, day] = parts;
  return `${month} ${parseInt(day, 10)}, ${year}`;
}

function keplerFallback(asteroid: Asteroid): TrajectoryData {
  return {
    totalPasses: 0,
    nextTwo: [
      { date: asteroid.next_pass_date, distAU: null },
      { date: 'SEE NASA JPL', distAU: null },
    ],
    closestPass: null,
    isEstimate: true,
  };
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10 md:px-14">
      <div className="grid gap-16 lg:grid-cols-2">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px animate-pulse bg-white/6" />
          ))}
          <div className="mx-auto mt-8 h-52 w-52 animate-pulse rounded-full bg-white/4" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-px animate-pulse bg-white/6" />
              <div className="flex justify-between pt-1">
                <div className="h-2 animate-pulse rounded-full bg-white/6" style={{ width: `${25 + i * 9}%` }} />
                <div className="h-2 w-14 animate-pulse rounded-full bg-white/6" />
              </div>
            </div>
          ))}
          <div className="h-20 w-3/4 animate-pulse rounded bg-white/4" />
        </div>
      </div>
    </div>
  );
}

// ── Main inner component (needs searchParams) ────────────────────────────────

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const targetId     = searchParams.get('id');

  const [asteroid, setAsteroid] = useState<Asteroid | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryData | null>(null);
  const [cadLoading, setCadLoading] = useState(false);
  const [cadOffline, setCadOffline] = useState(false);
  const [capexModalOpen, setCapexModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchTargets();
        if (targetId) {
          const found = data.find((a) => a.id === targetId) ?? data[0];
          setAsteroid(found ?? null);
        } else {
          setAsteroid(data[0] ?? null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [targetId]);

  // ── NASA CAD trajectory fetch — all passes up to 2100 ──────────────────────
  useEffect(() => {
    if (!asteroid) return;

    const controller = new AbortController();
    // Use first word/number of full_name as designation (most reliable for CAD API)
    const designation = asteroid.full_name.split(' ')[0].trim();

    setTrajectoryData(null);
    setCadOffline(false);
    setCadLoading(true);

    fetch(
      `/api/nasa-cad?des=${designation}&date-min=now&date-max=2100-01-01&dist-max=10`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((json) => {
        const count = parseInt(json.count ?? '0', 10);
        if (!json.data?.length || count === 0) {
          setTrajectoryData(keplerFallback(asteroid));
          return;
        }

        const fields: string[] = json.fields ?? [];
        const cdIdx   = fields.indexOf('cd')   !== -1 ? fields.indexOf('cd')   : 3;
        const distIdx = fields.indexOf('dist') !== -1 ? fields.indexOf('dist') : 4;

        // Parse every pass into { date, distAU }
        const allPasses: PassEntry[] = (json.data as string[][]).map((row) => ({
          date:   formatNasaDate(row[cdIdx]   ?? ''),
          distAU: parseFloat(row[distIdx] ?? '0') || 0,
        }));

        // Next 2 chronological passes
        const nextTwo: TrajectoryData['nextTwo'] = [
          allPasses[0] ? { date: allPasses[0].date, distAU: allPasses[0].distAU } : { date: 'N/A', distAU: null },
          allPasses[1] ? { date: allPasses[1].date, distAU: allPasses[1].distAU } : { date: 'N/A', distAU: null },
        ];

        // Absolute closest pass (minimum distance across all passes)
        const closestPass = allPasses.reduce<PassEntry>(
          (best, p) => (p.distAU < best.distAU ? p : best),
          allPasses[0],
        );

        setTrajectoryData({ totalPasses: count, nextTwo, closestPass, isEstimate: false });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setCadOffline(true);
          setTrajectoryData(keplerFallback(asteroid));
        }
      })
      .finally(() => setCadLoading(false));

    return () => controller.abort();
  }, [asteroid?.id]);

  const backHref = asteroid
    ? `/dashboard?highlight=${encodeURIComponent(asteroid.id)}`
    : '/dashboard';

  // ── Regulatory risk evaluation ───────────────────────────────────────────────
  const isLegallyRestricted = Boolean(
    asteroid && (asteroid.pha || asteroid.moid < 0.05)
  );

  // ── Dynamic CapEx (live-data-driven when CAD data is available) ──────────────
  const BASE_LAUNCH      = 2_000_000_000;
  const DIST_RATE        = 5_000_000_000;   // per AU
  const INCL_RATE        = 250_000_000;     // per degree
  // Use absolute closest pass distance for best-case CapEx; fall back to MOID
  const closestPassDistAU = trajectoryData?.closestPass?.distAU ?? null;
  const dynamicDistAU    = closestPassDistAU ?? asteroid?.moid ?? 0;
  const dynamicCapEx     = BASE_LAUNCH
    + dynamicDistAU * DIST_RATE
    + (asteroid?.inclination ?? 0) * INCL_RATE;
  const dynamicNetProfit = (asteroid?.adjusted_value_usd ?? 0) - dynamicCapEx;

  // ── ISRU / C-Type water yield ────────────────────────────────────────────────
  // 10% of estimated mass is extractable water ice → converted to metric tons
  const isISRU = asteroid?.classification === 'C' && !isLegallyRestricted;
  const waterMassTons = asteroid ? (asteroid.estimated_mass_kg / 1000) * 0.1 : 0;

  // ── ESG CO2 offset formatter ─────────────────────────────────────────────────
  function formatCO2(tons: number): { value: string; unit: string } {
    if (tons >= 1e9)  return { value: (tons / 1e9).toFixed(2),  unit: 'Gigatons CO₂' };
    if (tons >= 1e6)  return { value: (tons / 1e6).toFixed(2),  unit: 'Megatons CO₂' };
    if (tons >= 1e3)  return { value: (tons / 1e3).toFixed(2),  unit: 'Kilotons CO₂' };
    return { value: tons.toFixed(0), unit: 'Tons CO₂' };
  }

  // ── Water mass formatter ─────────────────────────────────────────────────────
  function formatWaterTons(tons: number): { value: string; unit: string } {
    if (tons >= 1e12) return { value: (tons / 1e12).toFixed(2), unit: 'Trillion Metric Tons' };
    if (tons >= 1e9)  return { value: (tons / 1e9).toFixed(2),  unit: 'Billion Metric Tons' };
    if (tons >= 1e6)  return { value: (tons / 1e6).toFixed(2),  unit: 'Million Metric Tons' };
    if (tons >= 1e3)  return { value: (tons / 1e3).toFixed(2),  unit: 'Thousand Metric Tons' };
    return { value: tons.toFixed(0), unit: 'Metric Tons' };
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Fixed back button + header ─────────────────────────────── */}
      <div className="border-b border-white/8 px-8 pt-24 pb-6 md:px-14">
        <div className="mx-auto max-w-7xl">

          {/* Back link */}
          <Link
            href="/dashboard"
            className="group mb-6 flex w-max items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-white/30 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Back to Orbital Tracking
          </Link>

          {loading ? (
            <div className="space-y-2">
              <div className="h-3 w-24 animate-pulse rounded bg-white/8" />
              <div className="h-8 w-64 animate-pulse rounded bg-white/8" />
            </div>
          ) : asteroid ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.4em]" style={{ color: '#FF3831' }}>
                  — Deep Financial Analysis
                </p>
                <h1 className="font-serif text-3xl font-black leading-tight text-white md:text-4xl">
                  {asteroid.full_name}
                </h1>
                <p className="mt-1.5 font-mono text-[10px] text-white/30">
                  {getClassDescription(asteroid.classification)}
                </p>
              </div>
              {/* Class badge */}
              <span
                className={`border px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest
                  ${getClassColors(asteroid.classification).bg}
                  ${getClassColors(asteroid.classification).text}
                  ${getClassColors(asteroid.classification).border}`}
              >
                <XaiTooltip
                  term="Classification"
                  explanation="The spectral taxonomy of the asteroid (C, S, or M). This dictates its primary resource composition: volatiles, silicates, or heavy metals."
                >
                  {asteroid.classification}-TYPE
                </XaiTooltip>
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
          className="mx-auto flex max-w-7xl flex-col items-center justify-center px-8 py-32 text-center md:px-14"
        >
          {/* Pulsing status indicator */}
          <span className="relative mb-8 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF3831] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF3831]" />
          </span>
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.5em] text-white/25">
            System Status · Data Pipeline
          </p>
          <h2 className="mb-4 font-serif text-3xl font-black text-white">
            AWAITING BACKEND CONNECTION
          </h2>
          <p className="mb-2 max-w-sm font-mono text-[10px] leading-relaxed text-white/30">
            The SPECTRAVEIN intelligence pipeline is currently unreachable.
            Ensure the FastAPI server is running on port&nbsp;8000.
          </p>
          <p className="mb-10 font-mono text-[9px] text-white/20">
            ERR: {error}
          </p>
          <Link
            href="/dashboard"
            className="group flex items-center gap-2 border-t border-white/10 pt-6 font-mono text-[10px] uppercase tracking-[0.35em] text-white/30 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Return to Dashboard
          </Link>
        </motion.div>
      )}

      {loading && <AnalyticsSkeleton />}

      {!loading && !error && !asteroid && (
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-center px-8 py-32 text-center md:px-14">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.5em] text-white/25">No Target Selected</p>
          <h2 className="mb-6 font-serif text-2xl font-black text-white">NO TARGET DATA RECEIVED</h2>
          <Link href="/dashboard" className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.35em] text-white/30 transition-colors hover:text-white">
            <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
            Select a Target
          </Link>
        </div>
      )}

      {!loading && !error && asteroid && (
        <AnimatePresence mode="wait">
          <motion.div
            key={asteroid.id}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease }}
            className="mx-auto max-w-7xl px-8 py-12 md:px-14"
          >
            {/* ── Regulatory Warning Banner ─────────────────────────── */}
            {isLegallyRestricted && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease }}
                className="mb-8 border-l-4 bg-red-950/50 px-6 py-5"
                style={{ borderColor: '#FF3831' }}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-px font-mono text-[10px] font-black uppercase tracking-[0.35em] text-white">
                    ⚠ RESTRICTED TARGET: PLANETARY DEFENSE JURISDICTION
                  </span>
                </div>
                <p className="mt-3 font-sans text-[11px] leading-relaxed text-white/60">
                  Under current Artemis Accords and UN Planetary Defense protocols, commercial mining
                  operations on Potentially Hazardous Asteroids (PHAs) or bodies with a MOID &lt; 0.05 AU
                  are strictly prohibited due to trajectory-alteration risks. This target has been flagged
                  {asteroid.pha ? ' as a confirmed PHA' : ''}
                  {asteroid.pha && asteroid.moid < 0.05 ? ' and' : ''}
                  {asteroid.moid < 0.05 ? ` with a dangerously close Earth distance (MOID ${asteroid.moid.toFixed(4)} AU)` : ''}.
                  All financial projections below are provided for intelligence purposes only.
                </p>
              </motion.div>
            )}

            {/* ── AI Mission Briefing — full-width editorial row ─────── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease, delay: 0.08 }}
              className="mb-12 border-b border-white/8 pb-10"
            >
              <div className="mb-4 flex items-center gap-2">
                <BrainCircuit className="h-3.5 w-3.5" style={{ color: '#FF3831' }} />
                <p className="font-mono text-[9px] uppercase tracking-[0.4em]" style={{ color: '#FF3831' }}>
                  AI Mission Briefing
                </p>
              </div>
              <blockquote className="border-l-2 pl-5" style={{ borderColor: '#FF3831' }}>
                <p className="font-sans text-sm leading-relaxed text-zinc-400">
                  {asteroid.xai_summary}
                </p>
              </blockquote>
            </motion.div>

            {/* ── 2-column deep-dive grid ──────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 w-full max-w-7xl mx-auto">

              {/* ════ LEFT — Visuals & Physics ════ */}
              <div className="flex flex-col gap-0">

                {/* Resource Composition */}
                <div className="pb-10">
                  <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                    Resource Composition · {asteroid.classification}-Type Profile
                  </p>
                  <CompositionChart key={asteroid.id} composition={asteroid.composition} />
                  <div className="mt-10 border-t border-white/8 pt-8">
                    <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                      Estimated Mass
                    </p>
                    <p className="mt-2 font-serif text-2xl font-black text-white">
                      {formatMass(asteroid.estimated_mass_kg)}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-white/25">
                      Diameter: {asteroid.diameter >= 10 ? asteroid.diameter.toFixed(1) : asteroid.diameter.toFixed(3)} km ·{' '}
                      <XaiTooltip
                        term="Albedo"
                        explanation="The proportion of sunlight reflected by the asteroid. Low (<0.1) indicates carbon-rich composition; high (>0.2) indicates metallic or silicate."
                      >
                        Albedo
                      </XaiTooltip>
                      : {asteroid.albedo.toFixed(3)}
                    </p>
                  </div>
                </div>

                <Divider />

                {/* 3D Orbital Orrery */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease, delay: 0.28 }}
                  className="py-10"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Orbit className="h-3.5 w-3.5 text-white/25" />
                      <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/40">
                        Heliocentric Orbital Projection · Interactive 3D
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                        <span className="font-mono text-[8px] text-white/20">Earth</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#FF3831]" />
                        <span className="font-mono text-[8px] text-white/20">Target</span>
                      </span>
                    </div>
                  </div>
                  <div
                    className="relative h-[340px] w-full overflow-hidden border border-white/8"
                    style={{ background: '#050505' }}
                  >
                    <OrbitalOrrery asteroid={asteroid} />
                    <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[8px] text-white/15">
                      Drag to rotate · Scroll to zoom
                    </div>
                  </div>
                  <div className="mt-1.5 flex gap-5 font-mono text-[8px] text-white/20">
                    <span>SMA: {asteroid.semi_major_axis_au.toFixed(3)} AU</span>
                    <span>ECC: {asteroid.eccentricity.toFixed(4)}</span>
                    <span>INC: {asteroid.inclination.toFixed(1)}°</span>
                  </div>
                </motion.div>

                <Divider />

                {/* Orbital Mechanics bars */}
                <div className="py-10">
                  <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                    Orbital Mechanics
                  </p>
                  <div className="space-y-7">

                    {/* Inclination */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/30">
                          <Compass className="h-3 w-3" />
                          <XaiTooltip
                            term="Inclination"
                            explanation="The vertical tilt of the asteroid's orbit relative to Earth's orbital plane. High tilt requires massive fuel expenditures to reach."
                          />
                        </span>
                        <span className="font-mono text-[11px] text-white/60">
                          {asteroid.inclination.toFixed(2)}°
                        </span>
                      </div>
                      <AnimBar
                        value={asteroid.inclination}
                        max={30}
                        color={asteroid.inclination < 5 ? '#34d399' : asteroid.inclination < 15 ? '#fbbf24' : '#f87171'}
                        delay={0.05}
                      />
                      <p className="mt-1.5 font-mono text-[9px] text-white/20">
                        {asteroid.inclination < 5
                          ? 'Low delta-v requirement'
                          : asteroid.inclination < 15
                            ? 'Moderate delta-v'
                            : <>High <XaiTooltip term="Delta-v" explanation="The total change in velocity (rocket fuel) required to match the asteroid's trajectory. Higher inclination = exponentially more fuel." /> — costly intercept</>
                        }
                      </p>
                    </div>

                    {/* Earth MOID */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/30">
                          <Activity className="h-3 w-3" />
                          <XaiTooltip
                            term="MOID"
                            explanation="Minimum Orbit Intersection Distance. The closest the asteroid's orbit gets to Earth's orbit — a key proxy for mission accessibility."
                          />
                        </span>
                        <span className="font-mono text-[11px] text-white/60">
                          {asteroid.moid.toFixed(4)} AU
                        </span>
                      </div>
                      <AnimBar
                        value={Math.max(0, 100 - (asteroid.moid / 0.5) * 100)}
                        max={100}
                        color={asteroid.moid < 0.05 ? '#34d399' : asteroid.moid < 0.25 ? '#22d3ee' : '#52525b'}
                        delay={0.1}
                      />
                      <p className="mt-1.5 font-mono text-[9px] text-white/20">
                        {asteroid.moid < 0.05 ? 'Earth proximal — NEA' : asteroid.moid < 0.25 ? 'Near-Earth accessible' : 'Main belt — deep space mission'}
                      </p>
                    </div>

                    {/* Diameter */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-white/30">
                          <XaiTooltip
                            term="Diameter"
                            explanation="The estimated physical size in kilometers. This is multiplied by the class density to calculate the total extractable mass."
                          />
                        </span>
                        <span className="font-mono text-[11px] text-white/60">
                          {asteroid.diameter >= 10 ? asteroid.diameter.toFixed(1) : asteroid.diameter.toFixed(3)} km
                        </span>
                      </div>
                      <AnimBar
                        value={Math.log10(asteroid.diameter + 1)}
                        max={Math.log10(231)}
                        color="#a1a1aa"
                        delay={0.15}
                      />
                      <p className="mt-1.5 font-mono text-[9px] text-white/20">
                        {asteroid.diameter < 1 ? 'Sub-km body' : asteroid.diameter < 10 ? 'Small body' : asteroid.diameter < 100 ? 'Medium body' : 'Major body'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* ════ RIGHT — Economics & Telemetry ════ */}
              <div className="flex flex-col gap-0">

                {/* Gross valuation — massive serif */}
                <div className="pb-8">
                  <p className="mb-4 font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                    Gross Valuation
                  </p>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease, delay: 0.05 }}
                  >
                    <div className="font-serif font-black leading-none text-white"
                      style={{ fontSize: 'clamp(3rem, 8vw, 6rem)' }}
                    >
                      ${formatUSD(asteroid.gross_valuation).value}
                    </div>
                    <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.35em] text-white/30">
                      {formatUSD(asteroid.gross_valuation).unit}
                    </p>
                  </motion.div>
                </div>

                <Divider />

                {/* Post-shock valuation */}
                <div className="py-8">
                  <div className="mb-4 flex items-center gap-2">
                    <TrendingDown className="h-3.5 w-3.5 text-orange-400" />
                    <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-orange-400/60">
                      Post-Shock Valuation · Market Saturation Adjusted
                    </p>
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease, delay: 0.12 }}
                  >
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="font-serif font-black leading-none text-orange-400"
                        style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)' }}
                      >
                        ${formatUSD(asteroid.adjusted_value_usd).value}
                      </div>
                      <span className="mb-1 font-serif text-2xl font-black text-orange-400/60">
                        −{asteroid.gross_valuation > 0
                          ? ((1 - asteroid.adjusted_value_usd / asteroid.gross_valuation) * 100).toFixed(1)
                          : '0.0'}%
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.35em] text-orange-400/35">
                      {formatUSD(asteroid.adjusted_value_usd).unit}
                    </p>
                  </motion.div>
                  <p className="mt-5 font-mono text-[10px] leading-relaxed text-white/20">
                    Logarithmic market shock penalty applied. Flooding supply crashes commodity prices —
                    adjusted value reflects real, phased extraction economics.
                  </p>
                </div>

                <Divider />

                {/* Mission Economics — CapEx vs Net Profit */}
                <div className="py-8">
                  <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                    Mission Economics
                  </p>
                  <div className="grid grid-cols-2 gap-6">

                    {/* Left — CapEx (interactive button) */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease, delay: 0.18 }}
                    >
                      <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">
                        Est. Mission Cost
                      </p>
                      <button
                        onClick={() => setCapexModalOpen(true)}
                        className="group flex items-center gap-2 transition-opacity hover:opacity-70"
                      >
                        <div className="font-mono text-xl font-bold text-zinc-500">
                          ${formatUSD(dynamicCapEx).value}
                        </div>
                        <Calculator className="h-3.5 w-3.5 text-zinc-600 transition-colors group-hover:text-white" />
                      </button>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                        {formatUSD(dynamicCapEx).unit}
                        {closestPassDistAU !== null && (
                          <span className="ml-2 text-emerald-600">· live</span>
                        )}
                      </p>
                    </motion.div>

                    {/* Right — ISRU Yield | Net Profit | Legal Lockout */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease, delay: 0.24 }}
                    >
                      {isLegallyRestricted ? (
                        /* ── OPERATION VETOED ── */
                        <div>
                          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">
                            Projected Net Profit
                          </p>
                          <div
                            className="border-l-4 px-4 py-3"
                            style={{ borderColor: '#FF3831', backgroundColor: 'rgba(127,29,29,0.2)' }}
                          >
                            <p className="font-mono text-xs font-black uppercase tracking-[0.25em]" style={{ color: '#FF3831' }}>
                              OPERATION VETOED
                            </p>
                            <p className="mt-1.5 font-mono text-[9px] text-white/40 leading-relaxed">
                              Commercial extraction prohibited under Planetary Defense jurisdiction.
                            </p>
                          </div>
                        </div>
                      ) : isISRU ? (
                        /* ── ISRU PROPELLANT YIELD (C-Type) ── */
                        <div>
                          <div className="mb-2 flex items-center gap-1.5">
                            <Activity className="h-3 w-3 text-cyan-400" />
                            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">
                              ISRU Propellant Yield
                            </p>
                          </div>
                          <div
                            className="font-serif font-black leading-none text-cyan-400"
                            style={{ fontSize: 'clamp(1.75rem, 4vw, 3.5rem)' }}
                          >
                            {formatWaterTons(waterMassTons).value}
                          </div>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-cyan-600">
                            {formatWaterTons(waterMassTons).unit}
                          </p>
                          <p className="mt-2 font-mono text-[8px] leading-relaxed text-white/30">
                            H₂/O₂ Rocket Propellant (10% extractable ice mass)
                          </p>
                          <div className="mt-3 border-t border-white/8 pt-3">
                            <p className="font-mono text-[8px] leading-relaxed text-cyan-700/80">
                              Strategic deep-space refueling depot. Not designated for Earth-return payload.
                            </p>
                          </div>
                        </div>
                      ) : (
                        /* ── Normal USD profit display ── */
                        <>
                          <div className="mb-2 flex items-center gap-1.5">
                            {dynamicNetProfit >= 0
                              ? <TrendingUp className="h-3 w-3 text-emerald-400" />
                              : <TrendingDown className="h-3 w-3 text-red-400" />
                            }
                            <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/25">
                              Projected Net Profit
                            </p>
                            {closestPassDistAU !== null && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                            )}
                          </div>
                          <div
                            className="font-serif font-black leading-none"
                            style={{
                              fontSize: 'clamp(1.75rem, 4vw, 3.5rem)',
                              color: dynamicNetProfit >= 0 ? '#ffffff' : '#f87171',
                            }}
                          >
                            {formatUSDSigned(dynamicNetProfit).sign}
                            ${formatUSDSigned(dynamicNetProfit).value}
                          </div>
                          <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/25">
                            {formatUSDSigned(dynamicNetProfit).unit}
                          </p>
                          {/* Explicit CapEx deduction breakdown */}
                          <div className="mt-3 space-y-1 border-t border-white/8 pt-3">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-mono text-[9px] text-white/20">Post-Shock Value</span>
                              <span className="font-mono text-[9px] text-white/40">
                                ${formatUSD(asteroid.adjusted_value_usd).value} {formatUSD(asteroid.adjusted_value_usd).unit}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="font-mono text-[9px] text-white/20">− Mission CapEx</span>
                              <span className="font-mono text-[9px] text-[#FF3831]">
                                −${formatUSD(dynamicCapEx).value} {formatUSD(dynamicCapEx).unit}
                              </span>
                            </div>
                            <div className="flex items-baseline justify-between gap-2 border-t border-white/8 pt-1">
                              <span className="font-mono text-[9px] text-white/20">CapEx Ratio</span>
                              <span className="font-mono text-[9px] text-white/40">
                                {((dynamicCapEx / asteroid.adjusted_value_usd) * 100).toExponential(2)}%
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </div>
                </div>

                {/* ESG Terrestrial Ecological Offset */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease, delay: 0.3 }}
                  className="border border-emerald-900/40 bg-emerald-950/20 px-6 py-5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-emerald-600">
                      <XaiTooltip
                        term="Terrestrial Ecological Offset (ESG)"
                        explanation="The estimated volume of Earth-based greenhouse gas emissions completely bypassed by extracting these resources in the vacuum of space, versus conventional terrestrial mining which produces ~40,000 tons CO₂ per ton of rare metals."
                      />
                    </p>
                  </div>
                  <div className="flex items-baseline gap-3">
                    <span
                      className="font-serif font-black leading-none text-emerald-400"
                      style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.5rem)' }}
                    >
                      {formatCO2(asteroid.earth_co2_offset_tons).value}
                    </span>
                    <span className="font-mono text-xs text-emerald-600">
                      {formatCO2(asteroid.earth_co2_offset_tons).unit} Prevented
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[8px] leading-relaxed text-emerald-800">
                    Equivalent emissions avoided vs. Earth-based mining operations
                  </p>
                </motion.div>

                {/* Mission CapEx Breakdown Modal */}
                <Dialog open={capexModalOpen} onOpenChange={setCapexModalOpen}>
                  <DialogContent className="rounded-none border border-zinc-800 bg-[#0a0a0a] p-8 text-white sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">
                        Mission CapEx Breakdown
                      </DialogTitle>
                    </DialogHeader>
                    <p className="mt-1 font-serif text-xl font-black text-white">
                      {asteroid?.full_name}
                    </p>
                    {closestPassDistAU !== null && (
                      <p className="mb-6 font-mono text-[9px] text-emerald-500">
                        ● Live data · closest pass at {closestPassDistAU.toFixed(4)} AU
                      </p>
                    )}
                    <div className="space-y-0 border-t border-white/8">
                      {[
                        {
                          label: 'Base R&D / Launch Cost',
                          sub: 'Fixed deployment baseline',
                          value: BASE_LAUNCH,
                        },
                        {
                          label: 'Distance Fuel Surcharge',
                          sub: `${dynamicDistAU.toFixed(4)} AU × $5B/AU`,
                          value: dynamicDistAU * DIST_RATE,
                        },
                        {
                          label: 'Inclination Fuel Surcharge',
                          sub: `${asteroid?.inclination.toFixed(2)}° × $250M/°`,
                          value: (asteroid?.inclination ?? 0) * INCL_RATE,
                        },
                      ].map((row) => (
                        <div key={row.label} className="flex items-start justify-between border-b border-white/8 py-4">
                          <div>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-white/60">
                              {row.label}
                            </p>
                            <p className="mt-0.5 font-mono text-[9px] text-white/25">{row.sub}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm font-bold text-white/80">
                              ${formatUSD(row.value).value}
                            </p>
                            <p className="font-mono text-[9px] text-white/25">
                              {formatUSD(row.value).unit}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between border-t-2 border-white/20 pt-4">
                      <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/40">
                        Total CapEx
                      </p>
                      <div className="text-right">
                        <p className="font-serif text-3xl font-black text-white">
                          ${formatUSD(dynamicCapEx).value}
                        </p>
                        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">
                          {formatUSD(dynamicCapEx).unit}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 border-t border-white/8 pt-4">
                      <div className="flex items-baseline justify-between">
                        <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                          Post-Shock Valuation
                        </p>
                        <p className="font-mono text-sm text-orange-400">
                          ${formatUSD(asteroid?.adjusted_value_usd ?? 0).value} {formatUSD(asteroid?.adjusted_value_usd ?? 0).unit}
                        </p>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between">
                        <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                          − Mission CapEx
                        </p>
                        <p className="font-mono text-sm text-[#FF3831]">
                          −${formatUSD(dynamicCapEx).value} {formatUSD(dynamicCapEx).unit}
                        </p>
                      </div>
                      <div className="mt-1 mb-4 flex justify-end">
                        <p className="font-mono text-[9px] text-white/20">
                          CapEx = {((dynamicCapEx / (asteroid?.adjusted_value_usd ?? 1)) * 100).toExponential(2)}% of post-shock value
                        </p>
                      </div>
                      <div className="mt-3 flex items-baseline justify-between border-t border-white/8 pt-3">
                        <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                          Net Profit
                        </p>
                        <p
                          className="font-serif text-2xl font-black"
                          style={{ color: dynamicNetProfit >= 0 ? '#ffffff' : '#f87171' }}
                        >
                          {formatUSDSigned(dynamicNetProfit).sign}$
                          {formatUSDSigned(dynamicNetProfit).value}{' '}
                          <span className="font-mono text-xs font-normal text-white/30">
                            {formatUSDSigned(dynamicNetProfit).unit}
                          </span>
                        </p>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Divider />

                {/* Mining Viability — Accessibility score */}
                <div className="py-8">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-white/25" />
                      <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
                        <XaiTooltip
                          term="Mining Viability"
                          explanation="A qualitative assessment based on the Accessibility Score, determining if current aerospace technology can profitably reach and return material."
                        />
                      </p>
                    </div>
                    <span
                      className="font-mono text-[10px] uppercase tracking-widest font-bold"
                      style={{ color: isLegallyRestricted ? '#FF3831' : scoreColor(asteroid.accessibility_score) }}
                    >
                      {isLegallyRestricted ? 'CLASS 1 HAZARD (LEGAL LOCKOUT)' : viabilityLabel(asteroid.accessibility_score)}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-3 mb-5">
                    <span
                      className="font-serif text-[clamp(2.5rem,5vw,4rem)] font-black leading-none"
                      style={{ color: scoreColor(asteroid.accessibility_score) }}
                    >
                      {asteroid.accessibility_score.toFixed(0)}
                    </span>
                    <span className="font-mono text-sm text-white/25">/ 100</span>
                  </div>
                  <AnimBar
                    value={asteroid.accessibility_score}
                    max={100}
                    color={scoreColor(asteroid.accessibility_score)}
                  />
                </div>

                <Divider />

                {/* Orbital Telemetry & Launch Windows */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease, delay: 0.3 }}
                  className="py-8"
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between border border-white/10 border-b-0 px-5 py-3 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <Orbit className="h-3.5 w-3.5 text-white/25" />
                      <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/40">
                        Orbital Telemetry &amp; Launch Windows
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {cadOffline && (
                        <span className="font-mono text-[8px] uppercase tracking-widest text-[#FF3831]/90 bg-[#FF3831]/10 px-2 py-0.5">
                          TELEMETRY UNAVAILABLE: OFFLINE MODE
                        </span>
                      )}
                      {!cadOffline && trajectoryData?.isEstimate && (
                        <span className="font-mono text-[8px] uppercase tracking-widest text-amber-400/70 bg-amber-400/10 px-2 py-0.5">
                          THEORETICAL EST.
                        </span>
                      )}
                      {cadLoading ? (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/20" />
                      ) : trajectoryData && !trajectoryData.isEstimate ? (
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Row 1 — Total Intercept Opportunities */}
                  <div className="border border-white/10 border-b-0 px-5 py-4">
                    <p className="mb-1 font-mono text-[8px] uppercase tracking-[0.4em] text-white/25">
                      Total Intercept Opportunities · 2026–2100
                    </p>
                    {cadLoading ? (
                      <div className="h-5 w-16 animate-pulse rounded bg-white/6" />
                    ) : (
                      <div className="flex items-baseline gap-3">
                        <span className="font-serif text-3xl font-black text-white">
                          {trajectoryData ? trajectoryData.totalPasses : '—'}
                        </span>
                        <span className="font-mono text-[9px] text-white/25">
                          {trajectoryData?.isEstimate ? 'estimated via Kepler' : 'confirmed approaches'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Row 2 — Next 2 Passes */}
                  <div className="border border-white/10 border-b-0 px-5 py-4">
                    <p className="mb-3 font-mono text-[8px] uppercase tracking-[0.4em] text-white/25">
                      Next 2 Passes
                    </p>
                    {cadLoading ? (
                      <div className="space-y-2">
                        <div className="h-4 w-48 animate-pulse rounded bg-white/6" />
                        <div className="h-4 w-36 animate-pulse rounded bg-white/6" />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(trajectoryData?.nextTwo ?? [{ date: '—', distAU: null }, { date: '—', distAU: null }]).map((pass, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-[8px] text-white/20">#{i + 1}</span>
                              <span className="font-mono text-xs text-white/70">{pass.date}</span>
                            </div>
                            {pass.distAU !== null ? (
                              <span className="font-mono text-[10px] text-white/40">
                                {pass.distAU.toFixed(4)}{' '}
                                <XaiTooltip
                                  term="AU"
                                  explanation="Astronomical Unit — the average distance from Earth to the Sun (≈ 150 million km). Used to measure distances within the solar system."
                                />
                              </span>
                            ) : (
                              <span className="font-mono text-[9px] text-white/20">dist N/A</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Row 3 — Absolute Closest Approach */}
                  <div className="border border-white/10 px-5 py-4">
                    <p className="mb-3 font-mono text-[8px] uppercase tracking-[0.4em] text-white/25">
                      Absolute Closest Approach · Optimal CapEx Window
                    </p>
                    {cadLoading ? (
                      <div className="h-8 w-56 animate-pulse rounded bg-white/6" />
                    ) : trajectoryData?.closestPass ? (
                      <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-3">
                            <span
                              className="font-mono text-sm font-black uppercase tracking-widest px-3 py-1.5"
                              style={{ backgroundColor: '#FF3831', color: '#000000' }}
                            >
                              {trajectoryData.closestPass.date}
                            </span>
                          </div>
                          <p className="mt-2 font-mono text-[9px] text-white/30">
                            Recommended for lowest CapEx &amp; highest net profit
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-serif text-2xl font-black text-white">
                            {trajectoryData.closestPass.distAU.toFixed(4)}
                          </span>
                          <span className="ml-1.5 font-mono text-[9px] text-white/35">
                            <XaiTooltip
                              term="AU"
                              explanation="Astronomical Unit — the average distance from Earth to the Sun (≈ 150 million km). Used to measure distances within the solar system."
                            />
                          </span>
                          <p className="mt-0.5 font-mono text-[8px] text-white/20">
                            minimum distance
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-mono text-[10px] text-white/30">
                        {trajectoryData?.isEstimate
                          ? 'Closest pass estimated via Kepler orbital mechanics'
                          : 'No close approaches detected in window'}
                      </p>
                    )}
                  </div>
                </motion.div>

                {/* Back CTA */}
                <div className="pt-4">
                  <Link
                    href="/dashboard"
                    className="group flex items-center gap-2 border-t border-white/8 pt-6 font-mono text-[10px] uppercase tracking-[0.35em] text-white/25 transition-colors hover:text-white"
                  >
                    <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-0.5" />
                    Back to Orbital Tracking
                  </Link>
                </div>

              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

    </main>
  );
}

// ── Suspense boundary required by useSearchParams ────────────────────────────

export default function AnalyticsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0a0a0a] text-white pt-24">
        <AnalyticsSkeleton />
      </main>
    }>
      <AnalyticsContent />
    </Suspense>
  );
}
