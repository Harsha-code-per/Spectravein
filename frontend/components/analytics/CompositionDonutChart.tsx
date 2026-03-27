'use client';

import { motion } from 'framer-motion';
import { BrainCircuit } from 'lucide-react';
import { Asteroid, getClassDescription } from '@/lib/data';
import { CompositionChart } from '@/components/composition-chart';
import { XaiTooltip } from '@/components/xai-tooltip';

const ease = [0.16, 1, 0.3, 1] as const;

function formatMass(kg: number): string {
  if (kg >= 1e18) return `${(kg / 1e18).toFixed(2)} ×10¹⁸ kg`;
  if (kg >= 1e15) return `${(kg / 1e15).toFixed(2)} ×10¹⁵ kg`;
  if (kg >= 1e12) return `${(kg / 1e12).toFixed(2)} ×10¹² kg`;
  if (kg >= 1e9) return `${(kg / 1e9).toFixed(2)} ×10⁹ kg`;
  return `${kg.toLocaleString()} kg`;
}

interface CompositionDonutChartProps {
  asteroid: Asteroid;
}

export function CompositionDonutChart({ asteroid }: CompositionDonutChartProps) {
  return (
    <section className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease }}
        className="border-b border-white/10 pb-8"
      >
        <div className="mb-4 flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-[#FF3831]" />
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#FF3831]">
            AI Mission Briefing
          </p>
        </div>
        <blockquote className="border-l-2 border-[#FF3831] pl-5">
          <p className="font-sans text-base leading-relaxed text-zinc-300">
            {asteroid.xai_summary}
          </p>
        </blockquote>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease, delay: 0.06 }}
        className="space-y-6"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-zinc-300">
          Resource Composition · {asteroid.classification}-Type Profile
        </p>

        <CompositionChart key={asteroid.id} composition={asteroid.composition} />

        <div className="space-y-2 border-t border-white/10 pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">
            Estimated Mass
          </p>
          <p className="font-serif text-3xl font-black text-white">{formatMass(asteroid.estimated_mass_kg)}</p>
          <p className="font-mono text-base text-zinc-300">
            {getClassDescription(asteroid.classification)}
          </p>
          <p className="font-mono text-sm text-zinc-300">
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
      </motion.div>
    </section>
  );
}
