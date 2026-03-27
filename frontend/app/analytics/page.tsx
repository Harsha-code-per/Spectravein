'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Asteroid, getClassColors, getClassDescription } from '@/lib/data';
import { fetchTargets } from '@/lib/api';
import { CompositionDonutChart } from '@/components/analytics/CompositionDonutChart';
import { FinancialMetricsPanel } from '@/components/analytics/FinancialMetricsPanel';
import { OrbitalTelemetryData, TrajectoryData } from '@/components/analytics/OrbitalTelemetryData';

const ease = [0.16, 1, 0.3, 1] as const;

const OrbitalOrrery = dynamic(
  () => import('@/components/ui/OrbitalOrrery').then((m) => m.OrbitalOrrery),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center font-mono text-sm tracking-widest text-zinc-300">
        INITIALIZING ORBITAL TELEMETRY...
      </div>
    ),
  },
);

interface PassEntry {
  date: string;
  distAU: number;
}

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

function AnalyticsSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 md:px-8 xl:px-12">
      <div className="grid gap-8 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-px animate-pulse bg-white/10" />
          ))}
          <div className="h-64 animate-pulse bg-white/5" />
        </div>
        <div className="space-y-4 xl:col-span-7">
          <div className="h-[65vh] min-h-[600px] animate-pulse border border-white/10 bg-white/5" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse border border-white/10 bg-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalyticsContent() {
  const searchParams = useSearchParams();
  const targetId = searchParams.get('id');

  const [asteroid, setAsteroid] = useState<Asteroid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trajectoryData, setTrajectoryData] = useState<TrajectoryData | null>(null);
  const [cadLoading, setCadLoading] = useState(false);
  const [cadOffline, setCadOffline] = useState(false);
  const [capexModalOpen, setCapexModalOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
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
    void load();
  }, [targetId]);

  useEffect(() => {
    if (!asteroid) return;

    const controller = new AbortController();
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
        const cdIdx = fields.indexOf('cd') !== -1 ? fields.indexOf('cd') : 3;
        const distIdx = fields.indexOf('dist') !== -1 ? fields.indexOf('dist') : 4;

        const allPasses: PassEntry[] = (json.data as string[][]).map((row) => ({
          date: formatNasaDate(row[cdIdx] ?? ''),
          distAU: parseFloat(row[distIdx] ?? '0') || 0,
        }));

        const nextTwo: TrajectoryData['nextTwo'] = [
          allPasses[0] ? { date: allPasses[0].date, distAU: allPasses[0].distAU } : { date: 'N/A', distAU: null },
          allPasses[1] ? { date: allPasses[1].date, distAU: allPasses[1].distAU } : { date: 'N/A', distAU: null },
        ];

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
  }, [asteroid]);

  const closestPassDistAU = useMemo(() => trajectoryData?.closestPass?.distAU ?? null, [trajectoryData]);
  const isLegallyRestricted = Boolean(asteroid && (asteroid.pha || asteroid.moid < 0.05));

  if (loading) return <AnalyticsSkeleton />;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
      <div className="border-b border-white/10 pt-24 pb-8">
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12">
          <Link
            href="/dashboard"
            className="group mb-6 flex w-max items-center gap-2 font-mono text-sm uppercase tracking-[0.35em] text-zinc-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Orbital Tracking
          </Link>

          {error ? (
            <>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em] text-[#FF3831]">— System Status</p>
              <h1 className="font-serif text-4xl font-black text-white md:text-5xl">AWAITING BACKEND CONNECTION</h1>
              <p className="mt-3 max-w-xl font-mono text-base text-zinc-300">ERR: {error}</p>
            </>
          ) : asteroid ? (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em] text-[#FF3831]">— Deep Financial Analysis</p>
                <h1 className="font-serif text-4xl font-black leading-tight text-white md:text-5xl">{asteroid.full_name}</h1>
                <p className="mt-2 max-w-3xl font-mono text-base text-zinc-300">{getClassDescription(asteroid.classification)}</p>
              </div>
              <span
                className={`border px-3 py-1 font-mono text-sm font-bold uppercase tracking-widest
                ${getClassColors(asteroid.classification).bg}
                ${getClassColors(asteroid.classification).text}
                ${getClassColors(asteroid.classification).border}`}
              >
                {asteroid.classification}-TYPE
              </span>
            </div>
          ) : (
            <>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em] text-[#FF3831]">— Deep Financial Analysis</p>
              <h1 className="font-serif text-4xl font-black text-white md:text-5xl">NO TARGET DATA RECEIVED</h1>
            </>
          )}
        </div>
      </div>

      {!error && asteroid && (
        <AnimatePresence mode="wait">
          <motion.div
            key={asteroid.id}
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease }}
            className="w-full max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 py-10"
          >
            {isLegallyRestricted && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease }}
                className="mb-8 border-l-4 border-[#FF3831] bg-red-950/40 px-6 py-5"
              >
                <p className="font-mono text-sm font-black uppercase tracking-[0.3em] text-white">
                  ⚠ RESTRICTED TARGET: PLANETARY DEFENSE JURISDICTION
                </p>
                <p className="mt-3 max-w-5xl font-sans text-base leading-relaxed text-zinc-300 break-words">
                  Commercial mining operations on PHAs or targets with MOID &lt; 0.05 AU are prohibited under current
                  planetary defense protocols. Financial projections are shown for intelligence purposes only.
                </p>
              </motion.div>
            )}

            <section className="w-full bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.35em] text-[#FF3831]">
                AI Mission Briefing
              </p>
              <p className="font-mono text-base leading-relaxed text-zinc-300 break-words">
                {asteroid.xai_summary}
              </p>
            </section>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
              <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl [&>section>div:first-child]:hidden">
                <CompositionDonutChart asteroid={asteroid} />
              </div>

              <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl">
                <FinancialMetricsPanel
                  asteroid={asteroid}
                  closestPassDistAU={closestPassDistAU}
                  capexModalOpen={capexModalOpen}
                  setCapexModalOpen={setCapexModalOpen}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8 items-start">
              <div className="flex flex-col w-full gap-4 bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 shadow-2xl">
                <div className="flex flex-row justify-between items-center w-full gap-4">
                  <p className="text-xs font-mono text-zinc-400 tracking-widest uppercase">
                    HELIOCENTRIC ORBITAL PROJECTION · INTERACTIVE 3D
                  </p>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-mono text-zinc-400">Earth</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#FF3831]" />
                      <span className="text-xs font-mono text-zinc-400">Target</span>
                    </span>
                  </div>
                </div>

                <div className="aspect-video w-full rounded-xl overflow-hidden border border-white/10 bg-black/50 relative">
                  <div className="h-full w-full [&>canvas]:!h-full [&>canvas]:!w-full">
                    <OrbitalOrrery asteroid={asteroid} />
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <p className="text-xs text-zinc-500 text-center uppercase tracking-widest">
                    Drag to rotate · Scroll to zoom
                  </p>
                  <p className="text-xs font-mono text-zinc-400 text-center">
                    SMA: {asteroid.semi_major_axis_au.toFixed(3)} AU | ECC: {asteroid.eccentricity.toFixed(4)} | INC: {asteroid.inclination.toFixed(1)}°
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-2xl p-6 md:p-8 shadow-2xl [&>section>div:first-child]:hidden">
                <OrbitalTelemetryData
                  asteroid={asteroid}
                  trajectoryData={trajectoryData}
                  cadLoading={cadLoading}
                  cadOffline={cadOffline}
                />
              </div>
            </div>

            <div className="pt-8">
              <Link
                href="/dashboard"
                className="group flex items-center gap-2 border-t border-white/10 pt-6 font-mono text-sm uppercase tracking-[0.35em] text-zinc-300 transition-colors hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                Back to Orbital Tracking
              </Link>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </main>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#0a0a0a] pt-24 text-white">
          <AnalyticsSkeleton />
        </main>
      }
    >
      <AnalyticsContent />
    </Suspense>
  );
}
