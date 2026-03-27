'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Compass, Orbit } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Asteroid } from '@/lib/data';
import { XaiTooltip } from '@/components/xai-tooltip';

const ease = [0.16, 1, 0.3, 1] as const;

const OrbitalOrrery = dynamic(
  () => import('@/components/ui/OrbitalOrrery').then((m) => m.OrbitalOrrery),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[65vh] min-h-[600px] w-full items-center justify-center border border-white/10 bg-black/50 font-mono text-sm tracking-widest text-zinc-300">
        INITIALIZING ORBITAL TELEMETRY...
      </div>
    ),
  },
);

interface PassEntry {
  date: string;
  distAU: number;
}

export interface TrajectoryData {
  totalPasses: number;
  nextTwo: Array<{ date: string; distAU: number | null }>;
  closestPass: PassEntry | null;
  isEstimate: boolean;
}

function AnimBar({
  value,
  max,
  color,
  delay = 0,
}: {
  value: number;
  max: number;
  color: string;
  delay?: number;
}) {
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

interface OrbitalTelemetryDataProps {
  asteroid: Asteroid;
  trajectoryData: TrajectoryData | null;
  cadLoading: boolean;
  cadOffline: boolean;
}

function OrbitalTelemetryDataComponent({
  asteroid,
  trajectoryData,
  cadLoading,
  cadOffline,
}: OrbitalTelemetryDataProps) {
  return (
    <section className="space-y-8 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Orbit className="h-4 w-4 text-zinc-300" />
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">
              Heliocentric Orbital Projection · Interactive 3D
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
              <span className="font-mono text-sm text-zinc-300">Earth</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[#FF3831]" />
              <span className="font-mono text-sm text-zinc-300">Target</span>
            </span>
          </div>
        </div>
        <div className="relative h-[65vh] min-h-[600px] w-full overflow-hidden border border-white/10 bg-[#050505]">
          <OrbitalOrrery asteroid={asteroid} />
          <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-sm text-zinc-300">
            Drag to rotate · Scroll to zoom
          </div>
        </div>
        <div className="flex flex-wrap gap-5 font-mono text-sm text-zinc-300">
          <span>SMA: {asteroid.semi_major_axis_au.toFixed(3)} AU</span>
          <span>ECC: {asteroid.eccentricity.toFixed(4)}</span>
          <span>INC: {asteroid.inclination.toFixed(1)}°</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.05 }}
        className="border border-white/10 p-6"
      >
        <p className="mb-5 font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">Orbital Mechanics</p>
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-sm uppercase tracking-widest text-zinc-300">
                <Compass className="h-4 w-4" />
                <XaiTooltip
                  term="Inclination"
                  explanation="The vertical tilt of the asteroid orbit relative to Earth's orbital plane."
                />
              </span>
              <span className="font-mono text-base text-zinc-300">{asteroid.inclination.toFixed(2)}°</span>
            </div>
            <AnimBar
              value={asteroid.inclination}
              max={30}
              color={asteroid.inclination < 5 ? '#34d399' : asteroid.inclination < 15 ? '#fbbf24' : '#f87171'}
            />
            <p className="mt-2 font-mono text-sm text-zinc-300">
              {asteroid.inclination < 5
                ? 'Low delta-v requirement'
                : asteroid.inclination < 15
                  ? 'Moderate delta-v'
                  : 'High delta-v — costly intercept'}
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-sm uppercase tracking-widest text-zinc-300">
                <Activity className="h-4 w-4" />
                <XaiTooltip
                  term="MOID"
                  explanation="Minimum Orbit Intersection Distance: closest orbital approach to Earth."
                />
              </span>
              <span className="font-mono text-base text-zinc-300">{asteroid.moid.toFixed(4)} AU</span>
            </div>
            <AnimBar
              value={Math.max(0, 100 - (asteroid.moid / 0.5) * 100)}
              max={100}
              color={asteroid.moid < 0.05 ? '#34d399' : asteroid.moid < 0.25 ? '#22d3ee' : '#52525b'}
            />
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.1 }}
        className="border border-white/10 p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">
            Orbital Telemetry & Launch Windows
          </p>
          {cadOffline && (
            <span className="bg-[#FF3831]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[#FF3831]">
              Telemetry Offline
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="border border-white/10 p-4">
            <p className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-300">Total Intercept Opportunities · 2026–2100</p>
            {cadLoading ? (
              <div className="mt-2 h-6 w-20 animate-pulse rounded bg-white/10" />
            ) : (
              <div className="mt-2 flex items-end gap-3">
                <p className="font-serif text-4xl font-black text-white">{trajectoryData ? trajectoryData.totalPasses : '—'}</p>
                <p className="pb-1 font-mono text-sm text-zinc-300">
                  {trajectoryData?.isEstimate ? 'estimated via Kepler' : 'confirmed approaches'}
                </p>
              </div>
            )}
          </div>

          <div className="border border-white/10 p-4">
            <p className="mb-3 font-mono text-sm uppercase tracking-[0.3em] text-zinc-300">Next 2 Passes</p>
            {cadLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-52 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
              </div>
            ) : (
              <div className="space-y-2">
                {(trajectoryData?.nextTwo ?? [{ date: '—', distAU: null }, { date: '—', distAU: null }]).map((pass, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-zinc-300">#{i + 1}</span>
                      <span className="font-mono text-base text-zinc-300">{pass.date}</span>
                    </div>
                    {pass.distAU !== null ? (
                      <span className="font-mono text-sm text-zinc-300">{pass.distAU.toFixed(4)} AU</span>
                    ) : (
                      <span className="font-mono text-sm text-zinc-300">dist N/A</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-white/10 p-4">
            <p className="mb-3 font-mono text-sm uppercase tracking-[0.3em] text-zinc-300">
              Absolute Closest Approach · Optimal CapEx Window
            </p>
            {cadLoading ? (
              <div className="h-8 w-60 animate-pulse rounded bg-white/10" />
            ) : trajectoryData?.closestPass ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="bg-[#FF3831] px-3 py-1.5 font-mono text-sm font-black uppercase tracking-widest text-black">
                    {trajectoryData.closestPass.date}
                  </span>
                  <p className="mt-2 font-mono text-sm text-zinc-300">
                    Recommended for lowest CapEx & highest net profit
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-3xl font-black text-white">{trajectoryData.closestPass.distAU.toFixed(4)}</p>
                  <p className="font-mono text-sm text-zinc-300">AU minimum distance</p>
                </div>
              </div>
            ) : (
              <p className="font-mono text-sm text-zinc-300">
                {trajectoryData?.isEstimate ? 'Closest pass estimated via Kepler orbital mechanics' : 'No close approaches detected in window'}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export const OrbitalTelemetryData = memo(OrbitalTelemetryDataComponent);
OrbitalTelemetryData.displayName = 'OrbitalTelemetryData';
