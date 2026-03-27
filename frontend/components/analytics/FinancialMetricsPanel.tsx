'use client';

import { motion } from 'framer-motion';
import { Activity, Calculator, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { Asteroid } from '@/lib/data';
import { formatUSD } from '@/lib/api';
import { XaiTooltip } from '@/components/xai-tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ease = [0.16, 1, 0.3, 1] as const;

function scoreColor(s: number) {
  return s >= 80 ? '#34d399' : s >= 60 ? '#fbbf24' : s >= 40 ? '#fb923c' : '#f87171';
}

function viabilityLabel(s: number) {
  return s >= 80 ? 'PRIME TARGET' : s >= 60 ? 'VIABLE' : s >= 40 ? 'MODERATE' : 'HIGH Δ-V';
}

function formatUSDSigned(usd: number): { sign: string; value: string; unit: string } {
  const sign = usd < 0 ? '-' : '';
  const abs = Math.abs(usd);
  if (abs >= 1e18) return { sign, value: (abs / 1e18).toFixed(2), unit: 'Quintillion USD' };
  if (abs >= 1e15) return { sign, value: (abs / 1e15).toFixed(2), unit: 'Quadrillion USD' };
  if (abs >= 1e12) return { sign, value: (abs / 1e12).toFixed(2), unit: 'Trillion USD' };
  if (abs >= 1e9) return { sign, value: (abs / 1e9).toFixed(2), unit: 'Billion USD' };
  if (abs >= 1e6) return { sign, value: (abs / 1e6).toFixed(2), unit: 'Million USD' };
  return { sign, value: abs.toLocaleString(), unit: 'USD' };
}

function formatCO2(tons: number): { value: string; unit: string } {
  if (tons >= 1e9) return { value: (tons / 1e9).toFixed(2), unit: 'Gigatons CO₂' };
  if (tons >= 1e6) return { value: (tons / 1e6).toFixed(2), unit: 'Megatons CO₂' };
  if (tons >= 1e3) return { value: (tons / 1e3).toFixed(2), unit: 'Kilotons CO₂' };
  return { value: tons.toFixed(0), unit: 'Tons CO₂' };
}

function formatWaterTons(tons: number): { value: string; unit: string } {
  if (tons >= 1e12) return { value: (tons / 1e12).toFixed(2), unit: 'Trillion Metric Tons' };
  if (tons >= 1e9) return { value: (tons / 1e9).toFixed(2), unit: 'Billion Metric Tons' };
  if (tons >= 1e6) return { value: (tons / 1e6).toFixed(2), unit: 'Million Metric Tons' };
  if (tons >= 1e3) return { value: (tons / 1e3).toFixed(2), unit: 'Thousand Metric Tons' };
  return { value: tons.toFixed(0), unit: 'Metric Tons' };
}

interface FinancialMetricsPanelProps {
  asteroid: Asteroid;
  closestPassDistAU: number | null;
  capexModalOpen: boolean;
  setCapexModalOpen: (open: boolean) => void;
}

export function FinancialMetricsPanel({
  asteroid,
  closestPassDistAU,
  capexModalOpen,
  setCapexModalOpen,
}: FinancialMetricsPanelProps) {
  const BASE_LAUNCH = 2_000_000_000;
  const DIST_RATE = 5_000_000_000;
  const INCL_RATE = 250_000_000;
  const dynamicDistAU = closestPassDistAU ?? asteroid.moid;
  const dynamicCapEx = BASE_LAUNCH + dynamicDistAU * DIST_RATE + asteroid.inclination * INCL_RATE;
  const dynamicNetProfit = asteroid.adjusted_value_usd - dynamicCapEx;
  const isLegallyRestricted = asteroid.pha || asteroid.moid < 0.05;
  const isISRU = asteroid.classification === 'C' && !isLegallyRestricted;
  const waterMassTons = (asteroid.estimated_mass_kg / 1000) * 0.1;

  return (
    <section className="space-y-8">
      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease }}
          className="border border-white/10 p-6"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">Gross Valuation</p>
          <p className="font-serif text-[clamp(2.1rem,5vw,3.6rem)] font-black leading-none text-white">
            ${formatUSD(asteroid.gross_valuation).value}
          </p>
          <p className="mt-2 font-mono text-sm uppercase tracking-[0.25em] text-zinc-300">
            {formatUSD(asteroid.gross_valuation).unit}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.06 }}
          className="border border-orange-500/20 bg-orange-500/5 p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-orange-400" />
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-300">Post-Shock Valuation</p>
          </div>
          <p className="font-serif text-[clamp(2rem,4.2vw,3.2rem)] font-black leading-none text-orange-300">
            ${formatUSD(asteroid.adjusted_value_usd).value}
          </p>
          <p className="mt-2 font-mono text-sm uppercase tracking-[0.25em] text-zinc-300">
            {formatUSD(asteroid.adjusted_value_usd).unit}
          </p>
        </motion.div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.1 }}
          className="border border-white/10 p-6"
        >
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-300">Mission Economics</p>
          <button
            onClick={() => setCapexModalOpen(true)}
            className="group flex items-center gap-2 transition-opacity hover:opacity-80"
          >
            <p className="font-serif text-[clamp(1.8rem,4vw,2.8rem)] font-black text-zinc-300">${formatUSD(dynamicCapEx).value}</p>
            <Calculator className="h-4 w-4 text-zinc-300 group-hover:text-white" />
          </button>
          <p className="mt-1 font-mono text-sm uppercase tracking-widest text-zinc-300">
            {formatUSD(dynamicCapEx).unit}
            {closestPassDistAU !== null && <span className="ml-2 text-emerald-400">· live</span>}
          </p>
          <p className="mt-4 font-mono text-sm text-zinc-300">
            CapEx ratio: {((dynamicCapEx / Math.max(asteroid.adjusted_value_usd, 1)) * 100).toExponential(2)}%
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease, delay: 0.14 }}
          className="border border-white/10 p-6"
        >
          <div className="mb-3 flex items-center gap-2">
            {dynamicNetProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-400" />
            )}
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-300">Projected Net Profit</p>
          </div>
          {isLegallyRestricted ? (
            <div className="border-l-4 border-[#FF3831] bg-red-950/30 px-4 py-3">
              <p className="font-mono text-sm font-black uppercase tracking-[0.2em] text-[#FF3831]">Operation Vetoed</p>
              <p className="mt-2 font-mono text-sm text-zinc-300">
                Commercial extraction prohibited under Planetary Defense jurisdiction.
              </p>
            </div>
          ) : isISRU ? (
            <>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-300">ISRU Propellant Yield</p>
              </div>
              <p className="mt-2 font-serif text-[clamp(1.8rem,4vw,3rem)] font-black text-cyan-300">
                {formatWaterTons(waterMassTons).value}
              </p>
              <p className="font-mono text-sm text-zinc-300">{formatWaterTons(waterMassTons).unit}</p>
            </>
          ) : (
            <>
              <p
                className="font-serif text-[clamp(1.8rem,4vw,3rem)] font-black"
                style={{ color: dynamicNetProfit >= 0 ? '#ffffff' : '#f87171' }}
              >
                {formatUSDSigned(dynamicNetProfit).sign}${formatUSDSigned(dynamicNetProfit).value}
              </p>
              <p className="font-mono text-sm text-zinc-300">{formatUSDSigned(dynamicNetProfit).unit}</p>
            </>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.18 }}
        className="border border-emerald-900/40 bg-emerald-950/20 p-6"
      >
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-zinc-300">
            <XaiTooltip
              term="Terrestrial Ecological Offset (ESG)"
              explanation="Estimated Earth-based greenhouse gas emissions bypassed by space extraction versus terrestrial mining."
            />
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <p className="font-serif text-[clamp(1.8rem,3.6vw,2.8rem)] font-black text-emerald-300">
            {formatCO2(asteroid.earth_co2_offset_tons).value}
          </p>
          <p className="font-mono text-sm text-zinc-300">{formatCO2(asteroid.earth_co2_offset_tons).unit} Prevented</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease, delay: 0.22 }}
        className="border border-white/10 p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-zinc-300" />
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-300">
              <XaiTooltip
                term="Mining Viability"
                explanation="Qualitative assessment from accessibility score and legal constraints."
              />
            </p>
          </div>
          <p
            className="font-mono text-sm uppercase tracking-widest"
            style={{ color: isLegallyRestricted ? '#FF3831' : scoreColor(asteroid.accessibility_score) }}
          >
            {isLegallyRestricted ? 'CLASS 1 HAZARD (LEGAL LOCKOUT)' : viabilityLabel(asteroid.accessibility_score)}
          </p>
        </div>
        <div className="flex items-end gap-3">
          <p className="font-serif text-[clamp(2rem,4.6vw,3.6rem)] font-black" style={{ color: scoreColor(asteroid.accessibility_score) }}>
            {asteroid.accessibility_score.toFixed(0)}
          </p>
          <p className="pb-1 font-mono text-base text-zinc-300">/ 100</p>
        </div>
      </motion.div>

      <Dialog open={capexModalOpen} onOpenChange={setCapexModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-none border border-zinc-800 bg-[#0a0a0a] p-8 text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono text-[10px] uppercase tracking-[0.4em] text-zinc-300">
              Mission CapEx Breakdown
            </DialogTitle>
          </DialogHeader>
          <p className="font-serif text-2xl font-black text-white">{asteroid.full_name}</p>
          {closestPassDistAU !== null && (
            <p className="font-mono text-sm text-emerald-400">● Live data · closest pass at {closestPassDistAU.toFixed(4)} AU</p>
          )}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-zinc-300">Base R&D / Launch Cost</span>
              <span className="font-mono text-sm text-zinc-300">${formatUSD(BASE_LAUNCH).value} {formatUSD(BASE_LAUNCH).unit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-zinc-300">Distance Fuel Surcharge</span>
              <span className="font-mono text-sm text-zinc-300">${formatUSD(dynamicDistAU * DIST_RATE).value} {formatUSD(dynamicDistAU * DIST_RATE).unit}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-zinc-300">Inclination Fuel Surcharge</span>
              <span className="font-mono text-sm text-zinc-300">${formatUSD(asteroid.inclination * INCL_RATE).value} {formatUSD(asteroid.inclination * INCL_RATE).unit}</span>
            </div>
          </div>
          <div className="flex items-end justify-between border-t border-white/10 pt-4">
            <span className="font-mono text-sm uppercase tracking-[0.35em] text-zinc-300">Total CapEx</span>
            <span className="font-serif text-3xl font-black text-white">
              ${formatUSD(dynamicCapEx).value}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
