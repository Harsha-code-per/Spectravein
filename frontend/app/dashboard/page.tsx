'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { Asteroid } from '@/lib/data';
import { fetchTargets } from '@/lib/api';
import { TargetFinder } from '@/components/target-finder';
import { ErrorBanner } from '@/components/loading-skeleton';
import { XaiTooltip } from '@/components/xai-tooltip';

const ease = [0.16, 1, 0.3, 1] as const;

export default function DashboardPage() {
  const [targets, setTargets]           = useState<Asteroid[]>([]);
  const [activeTarget, setActiveTarget] = useState<Asteroid | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  async function loadTargets() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTargets();
      setTargets(data);
      if (data.length > 0) setActiveTarget(data[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTargets(); }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="border-b border-white/8 pt-24 pb-8">
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.4em]" style={{ color: '#FF3831' }}>
              — SPECTRAVEIN ORBITAL COMMAND CENTER
            </p>
            <h1 className="font-serif text-4xl font-black leading-tight text-white md:text-5xl">
              TARGET ACQUISITION
            </h1>
            <p className="mt-2 font-mono text-sm text-zinc-300">
              {loading
                ? 'Connecting to SPECTRAVEIN API…'
                : error
                ? 'Connection failed'
                : `${targets.length} NEO targets indexed · Select a row to load orbital telemetry`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {error && !loading && (
              <button
                onClick={loadTargets}
                className="flex items-center gap-2 border border-red-500/30 px-4 py-2.5 font-mono text-sm uppercase tracking-widest text-red-400 transition hover:bg-red-500/10"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            )}
            <div className="flex items-center gap-2 border border-white/10 px-4 py-2.5 font-mono text-sm uppercase tracking-widest text-zinc-300">
              {loading ? (
                <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-400" /> Connecting</>
              ) : error ? (
                <><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Offline</>
              ) : (
                <><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live · JPL Horizons</>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && !loading && <ErrorBanner message={error} />}

      {!error && (
        <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 xl:px-12 py-10 overflow-x-hidden">

          {/* ── Wide table ─────────────────────────────────────────── */}
          <TargetFinder
            targets={targets}
            loading={loading}
            selected={activeTarget}
            onSelect={setActiveTarget}
          />

          {/* ── Orbital telemetry panel (shown when a target is selected) ── */}
          <AnimatePresence>
            {activeTarget && !loading && (
              <motion.div
                key={activeTarget.id}
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.5, ease }}
                className="mt-12 border-t border-white/8 pt-10"
              >
                <div className="max-w-2xl">

                  {/* Summary + deep-analytics CTA */}
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">
                      Active Target
                    </p>
                    <h2 className="mt-2 font-serif text-3xl font-black leading-tight text-white md:text-4xl">
                      {activeTarget.full_name}
                    </h2>
                    <p className="mt-1.5 font-mono text-sm text-zinc-300">
                      {activeTarget.classification}-Type ·&nbsp;
                      {activeTarget.diameter >= 10
                        ? activeTarget.diameter.toFixed(1)
                        : activeTarget.diameter.toFixed(3)} km ·&nbsp;
                      MOID {activeTarget.moid.toFixed(4)} AU
                    </p>
                  </div>

                  {/* Quick stats */}
                  <div className="space-y-3 border-t border-white/8 pt-5">
                    {[
                      {
                        label: 'Inclination',
                        value: `${activeTarget.inclination.toFixed(2)}°`,
                        tooltip: "The vertical tilt of the asteroid's orbit relative to Earth's orbital plane. High tilt requires exponentially more rocket fuel (Delta-v) to intercept.",
                      },
                      {
                        label: 'Accessibility',
                        value: `${activeTarget.accessibility_score.toFixed(1)} / 100`,
                        tooltip: 'A proprietary score (0-100) combining Earth distance and orbital tilt. Higher scores indicate highly cost-effective mining missions.',
                      },
                      {
                        label: 'Classification',
                        value: `${activeTarget.classification}-Type`,
                        tooltip: 'The spectral taxonomy of the asteroid (C, S, or M). This dictates its primary resource composition: volatiles, silicates, or heavy metals.',
                      },
                      {
                        label: 'Albedo',
                        value: activeTarget.albedo.toFixed(3),
                        tooltip: 'The surface reflectivity of the asteroid. Our ML model uses this to predict composition: dark (<0.1) implies Carbon/Water, bright (>0.2) implies Metals.',
                      },
                    ].map(({ label, value, tooltip }) => (
                      <div key={label} className="flex justify-between border-b border-white/5 pb-3 last:border-0">
                        <span className="font-mono text-sm uppercase tracking-widest text-zinc-300">
                          <XaiTooltip term={label} explanation={tooltip} />
                        </span>
                        <span className="font-mono text-sm text-zinc-300">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* VIEW DEEP ANALYTICS CTA */}
                  <Link
                    href={`/analytics?id=${encodeURIComponent(activeTarget.id)}`}
                    className="group mt-2 flex w-full items-center justify-between border border-white/20 px-6 py-4 transition-all duration-200 hover:border-white hover:bg-white"
                  >
                    <span className="font-mono text-sm uppercase tracking-widest text-white transition-colors group-hover:text-black">
                      View Deep Analytics
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-white transition-colors group-hover:text-black" />
                  </Link>

                  <p className="font-mono text-sm text-zinc-300 uppercase tracking-widest">
                    Full financial model, composition breakdown &amp; ROI analysis
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      )}
    </main>
  );
}
