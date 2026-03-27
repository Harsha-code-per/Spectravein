'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Asteroid, AsteroidClass } from '@/lib/data';
import { formatUSDShort } from '@/lib/api';
import { XaiTooltip } from '@/components/xai-tooltip';

const ease = [0.16, 1, 0.3, 1] as const;

// ── Sort options ────────────────────────────────────────────────────────────

type SortOption =
  | 'most_valuable'
  | 'most_cost_effective'
  | 'most_accessible'
  | 'closest_approaching'
  | 'smallest';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'most_valuable',       label: 'Most Valuable' },
  { value: 'most_cost_effective', label: 'Most Cost Effective' },
  { value: 'most_accessible',     label: 'Most Accessible' },
  { value: 'closest_approaching', label: 'Closest Approaching' },
  { value: 'smallest',            label: 'Smallest' },
];

function sortAsteroids(data: Asteroid[], sort: SortOption): Asteroid[] {
  const arr = [...data];
  switch (sort) {
    case 'most_valuable':
      return arr.sort((a, b) => b.gross_valuation - a.gross_valuation);
    case 'most_cost_effective':
      return arr.sort((a, b) => {
        const rA = a.gross_valuation / (101 - a.accessibility_score);
        const rB = b.gross_valuation / (101 - b.accessibility_score);
        return rB - rA;
      });
    case 'most_accessible':
      return arr.sort((a, b) => b.accessibility_score - a.accessibility_score);
    case 'closest_approaching':
      return arr.sort((a, b) => a.moid - b.moid);
    case 'smallest':
      return arr.sort((a, b) => a.diameter - b.diameter);
  }
}

// ── Floating asteroid thumbnail ─────────────────────────────────────────────

const CLASS_COLORS: Record<AsteroidClass, string> = {
  C: '#22d3ee',
  S: '#f59e0b',
  M: '#a3e635',
};

function AsteroidThumbnail({ asteroid }: { asteroid: Asteroid }) {
  const col = CLASS_COLORS[asteroid.classification] ?? '#ffffff';
  return (
    <div className="w-52 overflow-hidden rounded-sm border border-white/10 bg-black p-3 shadow-2xl">
      {/* Mini orbit graphic */}
      <div className="mb-2.5 flex h-24 w-full items-center justify-center rounded-sm bg-zinc-950">
        <svg viewBox="0 0 90 90" width="72" height="72">
          <circle cx="45" cy="45" r="34" fill="none" stroke={col} strokeWidth="0.5" opacity="0.2" />
          <circle cx="45" cy="45" r="22" fill={col} opacity="0.08" />
          <circle cx="45" cy="45" r="15" fill={col} opacity="0.15" />
          <circle cx="45" cy="45" r="10" fill={col} opacity="0.3" />
          {/* craters */}
          <circle cx="38" cy="40" r="3.5" fill="#000" opacity="0.5" />
          <circle cx="52" cy="50" r="2.5" fill="#000" opacity="0.4" />
          <circle cx="41" cy="53" r="2" fill="#000" opacity="0.4" />
          <circle cx="50" cy="37" r="1.5" fill="#000" opacity="0.35" />
        </svg>
      </div>
      <p className="font-mono text-[9px] uppercase tracking-widest" style={{ color: '#FF3831' }}>
        {asteroid.classification}-Type Asteroid
      </p>
      <p className="mt-0.5 text-sm font-bold leading-snug text-white">
        {asteroid.full_name.length > 24
          ? asteroid.full_name.slice(0, 24) + '…'
          : asteroid.full_name}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="font-mono text-[9px] text-white/30">Diameter</span>
        <span className="font-mono text-[9px] text-white/60">
          {asteroid.diameter >= 10 ? asteroid.diameter.toFixed(1) : asteroid.diameter.toFixed(3)} km
        </span>
        <span className="font-mono text-[9px] text-white/30">Valuation</span>
        <span className="font-mono text-[9px] font-bold text-white/80">
          {formatUSDShort(asteroid.gross_valuation)}
        </span>
        <span className="font-mono text-[9px] text-white/30">Access.</span>
        <span className="font-mono text-[9px] text-white/60">
          {asteroid.accessibility_score.toFixed(1)}/100
        </span>
      </div>
    </div>
  );
}

// ── Single row ──────────────────────────────────────────────────────────────

interface RowProps {
  asteroid: Asteroid;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

function AsteroidRow({ asteroid, rank, isSelected, onSelect, onPointerEnter, onPointerLeave }: RowProps) {
  const [hov, setHov] = useState(false);
  const RED = '#FF3831';
  const col = hov ? RED : isSelected ? '#ffffff' : '#71717a';

  return (
    <motion.div
      role="row"
      tabIndex={0}
      className="group relative flex cursor-pointer items-center gap-4 border-b border-white/5 px-2 py-5 outline-none
                 focus-visible:ring-1 focus-visible:ring-white/30"
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      onPointerEnter={() => { setHov(true); onPointerEnter(); }}
      onPointerLeave={() => { setHov(false); onPointerLeave(); }}
      animate={{ skewY: hov ? -0.6 : 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Selected indicator bar */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            className="absolute left-0 top-0 h-full w-px"
            style={{ backgroundColor: RED }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ scaleY: 0 }}
            transition={{ duration: 0.25, ease }}
          />
        )}
      </AnimatePresence>

      {/* Rank */}
      <motion.span
        className="w-9 shrink-0 font-mono text-sm"
        animate={{ color: hov ? RED : '#3f3f46' }}
        transition={{ duration: 0.15 }}
      >
        {String(rank).padStart(3, '0')}
      </motion.span>

      {/* Name + ID */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <motion.p
            className="truncate text-base font-bold leading-tight"
            animate={{ color: col }}
            transition={{ duration: 0.15 }}
          >
            {asteroid.full_name}
          </motion.p>
          {(asteroid.pha || asteroid.moid < 0.05) && (
            <XaiTooltip
              term={
                <span className="flex items-center gap-0.5 rounded-sm px-1 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest"
                  style={{ backgroundColor: 'rgba(127,29,29,0.5)', color: '#FF3831' }}>
                  <Lock className="h-2 w-2" />PHA
                </span>
              }
              explanation="Potentially Hazardous Asteroid. Legally restricted from commercial mining to prevent accidental Earth-impact trajectory alterations."
            />
          )}
        </div>
        <p className="font-mono text-sm text-zinc-300">
          JPL:{asteroid.id}
        </p>
      </div>

      {/* Class */}
      <motion.span
        className="hidden w-12 shrink-0 font-mono text-sm sm:block"
        animate={{ color: hov ? RED : '#52525b' }}
        transition={{ duration: 0.15 }}
      >
        {asteroid.classification}
      </motion.span>

      {/* Diameter */}
      <motion.span
        className="hidden w-20 shrink-0 font-mono text-sm sm:block"
        animate={{ color: hov ? RED : '#52525b' }}
        transition={{ duration: 0.15 }}
      >
        {asteroid.diameter >= 10 ? asteroid.diameter.toFixed(1) : asteroid.diameter.toFixed(3)} km
      </motion.span>

      {/* Access */}
      <motion.span
        className="hidden w-14 shrink-0 text-right font-mono text-sm md:block"
        animate={{ color: hov ? RED : '#52525b' }}
        transition={{ duration: 0.15 }}
      >
        {asteroid.accessibility_score.toFixed(1)}
      </motion.span>

      {/* Valuation */}
      <motion.span
        className="w-20 shrink-0 text-right font-mono text-sm font-bold"
        animate={{ color: hov ? RED : '#e4e4e7' }}
        transition={{ duration: 0.15 }}
      >
        {formatUSDShort(asteroid.gross_valuation)}
      </motion.span>
    </motion.div>
  );
}

// ── Pagination pill ─────────────────────────────────────────────────────────

function PagePill({ page, active, onClick }: { page: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center px-2 font-mono text-[10px] uppercase tracking-widest
                 transition-colors duration-150"
      style={active ? { color: '#FF3831' } : { color: '#52525b' }}
    >
      {page}
    </button>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

interface Props {
  targets: Asteroid[];
  loading: boolean;
  selected: Asteroid | null;
  onSelect: (a: Asteroid) => void;
}

export function TargetFinder({ targets, loading, selected, onSelect }: Props) {
  const [search, setSearch]       = useState('');
  const [sort, setSort]           = useState<SortOption>('most_valuable');
  const [page, setPage]           = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Cursor tracking for floating thumbnail
  const containerRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const springX = useSpring(rawX, { stiffness: 280, damping: 28 });
  const springY = useSpring(rawY, { stiffness: 280, damping: 28 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      rawX.set(e.clientX);
      rawY.set(e.clientY);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [rawX, rawY]);

  const handleSearch = useCallback((v: string) => { setSearch(v); setPage(1); }, []);
  const handleSort   = useCallback((v: string) => { setSort(v as SortOption); setPage(1); }, []);

  const processed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? targets.filter((a) => a.full_name.toLowerCase().includes(q)) : targets;
    return sortAsteroids(filtered, sort);
  }, [targets, search, sort]);

  const totalPages = Math.max(1, Math.ceil(processed.length / ITEMS_PER_PAGE));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * ITEMS_PER_PAGE;
  const pageItems  = processed.slice(pageStart, pageStart + ITEMS_PER_PAGE);

  const hoveredAsteroid = hoveredId ? targets.find((a) => a.id === hoveredId) ?? null : null;

  // Page pills (show first, last, current ± 1, ellipsis)
  function getPagePills(): (number | '…')[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, safePage - 1, safePage, safePage + 1].filter(p => p >= 1 && p <= totalPages));
    const sorted = [...set].sort((a, b) => a - b);
    const result: (number | '…')[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && (sorted[i] as number) - (sorted[i - 1] as number) > 1) result.push('…');
      result.push(sorted[i]);
    }
    return result;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="flex flex-col gap-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-white/5 px-2 py-5">
            <div className="h-3 w-8 animate-pulse rounded bg-white/6" />
            <div className="h-3 flex-1 animate-pulse rounded bg-white/6" />
            <div className="h-3 w-20 animate-pulse rounded bg-white/6" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-0">

      {/* ── Floating thumbnail (cursor-following) ── */}
      <AnimatePresence>
        {hoveredAsteroid && (
          <motion.div
            className="pointer-events-none fixed z-50"
            style={{ left: springX, top: springY, translateX: 24, translateY: -64 }}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88 }}
            transition={{ duration: 0.18 }}
          >
            <AsteroidThumbnail asteroid={hoveredAsteroid} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls bar ── */}
      <div className="mb-6 flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search asteroid name…"
            className="border-0 border-b border-white/15 bg-transparent pl-0 font-mono text-sm text-white placeholder:text-zinc-300
                       focus-visible:border-white/40 focus-visible:ring-0 rounded-none h-9"
          />
        </div>

        {/* Sort */}
        <Select value={sort} onValueChange={handleSort}>
          <SelectTrigger
            className="w-48 border-0 border-b border-white/15 bg-transparent font-mono text-sm
                       uppercase tracking-widest text-zinc-300 focus:ring-0 rounded-none h-9"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-zinc-950 text-white">
            {SORT_OPTIONS.map((o) => (
              <SelectItem
                key={o.value}
                value={o.value}
                className="font-mono text-sm uppercase tracking-widest focus:bg-white/10 focus:text-white"
              >
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Column headers ── */}
      <div className="flex items-center gap-4 border-b border-white/8 px-2 pb-3">
        <span className="w-9 shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-300">#</span>
        <span className="flex-1 font-mono text-[10px] uppercase tracking-widest text-zinc-300">Name</span>
        <span className="hidden w-12 shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-300 sm:block">
          <XaiTooltip
            term="Classification"
            explanation="The spectral taxonomy of the asteroid (C, S, or M). This dictates its primary resource composition: volatiles, silicates, or heavy metals."
          >
            Class
          </XaiTooltip>
        </span>
        <span className="hidden w-20 shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-300 sm:block">
          <XaiTooltip
            term="Diameter"
            explanation="The estimated physical size in kilometers. This is multiplied by the class density to calculate the total extractable mass."
          >
            Diam.
          </XaiTooltip>
        </span>
        <span className="hidden w-14 shrink-0 text-right font-mono text-[10px] uppercase tracking-widest text-zinc-300 md:block">
          <XaiTooltip
            term="Accessibility"
            explanation="A proprietary score (0-100) combining Earth distance and orbital tilt. Higher scores indicate highly cost-effective mining missions."
          >
            Access.
          </XaiTooltip>
        </span>
        <span className="w-20 shrink-0 text-right font-mono text-[10px] uppercase tracking-widest text-zinc-300">
          <XaiTooltip
            term="Value"
            explanation="The estimated gross market value, calculated using the asteroid's volume, predicted density, and current terrestrial commodity prices."
          >
            Value
          </XaiTooltip>
        </span>
      </div>

      {/* ── Rows ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${safePage}-${search}-${sort}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {pageItems.length === 0 ? (
            <div className="py-16 text-center font-mono text-sm uppercase tracking-widest text-zinc-300">
              No targets matched
            </div>
          ) : (
            pageItems.map((a, idx) => (
              <AsteroidRow
                key={a.id}
                asteroid={a}
                rank={pageStart + idx + 1}
                isSelected={selected?.id === a.id}
                onSelect={() => onSelect(a)}
                onPointerEnter={() => setHoveredId(a.id)}
                onPointerLeave={() => setHoveredId(null)}
              />
            ))
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Footer: count + pagination ── */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <span className="font-mono text-sm uppercase tracking-widest text-zinc-300">
          {processed.length > 0
            ? `${pageStart + 1}–${Math.min(pageStart + ITEMS_PER_PAGE, processed.length)} of ${processed.length} targets`
            : '0 targets'}
        </span>

        <div className="flex items-center gap-1">
          {/* Prev */}
          <button
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="flex h-7 w-7 items-center justify-center text-white/30 transition-colors hover:text-white disabled:opacity-20"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          {/* Pills */}
          {getPagePills().map((pill, i) =>
            pill === '…' ? (
              <span key={`ell-${i}`} className="w-5 text-center font-mono text-[10px] text-white/20">…</span>
            ) : (
              <PagePill
                key={pill}
                page={pill as number}
                active={safePage === pill}
                onClick={() => setPage(pill as number)}
              />
            )
          )}

          {/* Next */}
          <button
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="flex h-7 w-7 items-center justify-center text-white/30 transition-colors hover:text-white disabled:opacity-20"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
