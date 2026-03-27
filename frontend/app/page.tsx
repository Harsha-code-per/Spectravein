'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';

const HeroParticles = dynamic(
  () => import('@/components/ui/HeroParticles').then((m) => m.HeroParticles),
  { ssr: false },
);

const ease = [0.16, 1, 0.3, 1] as const;

// ── Reusable reveal wrapper ─────────────────────────────────────────────────

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px 0px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 36 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

// ── Feature Highlights data ──────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    title: 'LIVE NASA\nTELEMETRY',
    tag: 'Autonomous Ingestion',
    body: `SPECTRAVEIN runs a live autonomous ingestion engine wired to the NASA/JPL Small-Body Database. New Near-Earth Object telemetry is synchronized into the intelligence layer without manual intervention, keeping mission decisions anchored to current orbital data.`,
    stat: '24/7',
    statLabel: 'autonomous ingest',
    accent: '#ffffff',
  },
  {
    num: '02',
    title: 'ON-THE-FLY ML\nCLASSIFICATION',
    tag: 'Machine Learning',
    body: `Incoming asteroid telemetry is classified by an unsupervised K-Means model using albedo signatures. Every target is automatically grouped into Carbonaceous (C), Silicaceous (S), or Metallic (M) profiles for immediate composition-aware analytics.`,
    stat: 'K-Means',
    statLabel: 'unsupervised spectral model',
    accent: '#FF3831',
  },
  {
    num: '03',
    title: 'INTERACTIVE 3D\nORBITAL MECHANICS',
    tag: 'WebGL Visualization',
    body: `The analytics surface includes a cinematic 60fps WebGL/Three.js heliocentric projection engine. Teams can inspect trajectory geometry, inclination, eccentricity, and Earth-relative accessibility through a responsive interactive orbital interface.`,
    stat: '60fps',
    statLabel: 'cinematic projection engine',
    accent: '#a1a1aa',
  },
  {
    num: '04',
    title: 'ENTERPRISE\nSECURITY',
    tag: 'Production Hardening',
    body: `SPECTRAVEIN is hardened with SlowAPI rate limiting and production-grade CORS controls. This security layer protects API surfaces from abusive traffic while preserving low-latency telemetry delivery to the dashboard and analytics stack.`,
    stat: 'SlowAPI',
    statLabel: 'rate-limited API perimeter',
    accent: '#22d3ee',
  },
  {
    num: '05',
    title: 'LIVE TARGET\nINTELLIGENCE SCALE',
    tag: 'Operational Dataset',
    body: `SPECTRAVEIN now serves a continuously refreshed catalog of 934 NEO intelligence targets, combining historical orbital economics with newly ingested telemetry. Decision-makers can move from scan to deep mission analysis in seconds.`,
    stat: '934',
    statLabel: 'active NEO targets',
    accent: '#4ade80',
  },
] as const;

// ── Page ────────────────────────────────────────────────────────────────────

const WORDS = ['SPECTRAVEIN', 'LIVE ORBITAL', 'INTELLIGENCE'] as const;

const TICKER = [
  'LIVE NASA TELEMETRY', 'AUTONOMOUS INGESTION ENGINE',
  'ON-THE-FLY ML CLASSIFICATION', 'K-MEANS ALBEDO CLUSTERING',
  'INTERACTIVE 3D ORRERY', '60FPS WEBGL VISUALIZATION',
  'ENTERPRISE SECURITY', 'SLOWAPI RATE LIMITING',
  'PRODUCTION CORS CONTROLS', '934 ACTIVE NEO TARGETS',
];

export default function Home() {
  return (
    <>
      {/* ── Fixed 3D particle field — renders behind all page content ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <HeroParticles />
      </div>

      <main className="relative z-10 overflow-x-hidden text-white">

      {/* ════════════════════════════════════════════════════════════
          HERO — 100vh
      ════════════════════════════════════════════════════════════ */}
      <section className="relative flex min-h-screen flex-col overflow-hidden">

        {/* Top rule */}
        <motion.div
          className="absolute left-0 right-0 top-0 h-px bg-white/6"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.4, ease }}
        />

        {/* Centered content block */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-16 text-center md:px-14">

          {/* Overline */}
          <motion.p
            className="mb-12 font-mono text-[10px] uppercase tracking-[0.4em] text-white/25"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.7, ease }}
          >
            SPECTRAVEIN Autonomous Orbital Intelligence Platform &nbsp;·&nbsp; Live NASA/JPL Telemetry
          </motion.p>

          {/* Staggered giant serif words */}
          <div className="select-none">
            {WORDS.map((word, i) => (
              <div key={word} className="overflow-hidden leading-none">
                <motion.h1
                  className="font-serif font-black leading-[0.85] text-[clamp(4rem,13vw,11.5rem)]"
                  style={{ color: i === 2 ? '#FF3831' : '#ffffff' }}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ delay: 0.1 + i * 0.14, duration: 1.0, ease }}
                >
                  {word}
                </motion.h1>
              </div>
            ))}
          </div>

          {/* Subheadline */}
          <motion.p
            className="mt-10 max-w-md text-base leading-relaxed text-white/35 md:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.7, ease }}
          >
            Live telemetry ingestion, autonomous ML classification, and enterprise-grade orbital economics for mission-critical asteroid intelligence.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            className="mt-12 flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.7, ease }}
          >
            {/* Primary — filled white */}
            <Link
              href="/dashboard"
              className="group relative overflow-hidden border border-white bg-white px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-black transition-all duration-300 hover:bg-transparent hover:text-white"
            >
              <span className="relative z-10 flex items-center gap-2">
                Launch Intelligence Dashboard
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>

            {/* Secondary — ghost */}
            <Link
              href="/analytics"
              className="group border border-white/20 px-8 py-4 font-mono text-[11px] uppercase tracking-widest text-white/50 transition-all duration-300 hover:border-white/60 hover:text-white"
            >
              View Economic Models
            </Link>
          </motion.div>

          {/* Subtle scroll hint */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.8 }}
          >
            <motion.div
              className="h-8 w-px bg-white/20"
              animate={{ scaleY: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformOrigin: 'top' }}
            />
            <span className="font-mono text-[8px] uppercase tracking-[0.4em] text-white/20">scroll</span>
          </motion.div>
        </div>

        {/* Ticker tape */}
        <div className="overflow-hidden border-t border-white/6 py-4">
          <div className="flex animate-marquee whitespace-nowrap">
            {[...TICKER, ...TICKER].map((item, i) => (
              <span key={i} className="mx-10 font-mono text-[10px] uppercase tracking-[0.3em] text-white/18">
                {item}
                <span className="ml-10 font-bold" style={{ color: '#FF3831' }}>·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Gradient fade — particles dissolve into the solid sections below */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-b from-transparent via-[#0a0a0a]/75 to-[#0a0a0a]" />
      </section>

      {/* ════════════════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a]">

        {/* Section label */}
        <div className="border-t border-white/8 px-8 py-10 md:px-14">
          <Reveal>
            <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
              — SPECTRAVEIN Feature Highlights
            </p>
          </Reveal>
        </div>

        {/* Steps */}
        {STEPS.map((step, i) => (
          <div key={step.num}>
            {/* Full-width rule */}
            <div className="h-px w-full bg-white/8" />

            <div className="px-8 py-16 md:px-14 md:py-20">
              <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[240px_1fr_200px] lg:gap-20 lg:items-start">

                {/* Left: number */}
                <Reveal delay={0}>
                  <span
                    className="font-serif font-black leading-none text-[clamp(4rem,10vw,7rem)] select-none"
                    style={{ color: 'rgba(255,255,255,0.06)' }}
                  >
                    {step.num}
                  </span>
                </Reveal>

                {/* Center: title + body */}
                <div>
                  <Reveal delay={0.05}>
                    <span
                      className="mb-4 inline-block font-mono text-[9px] uppercase tracking-[0.4em]"
                      style={{ color: step.accent }}
                    >
                      {step.tag}
                    </span>
                    <h2 className="whitespace-pre-line font-serif text-[clamp(2rem,5vw,3.75rem)] font-black leading-[0.9] text-white">
                      {step.title}
                    </h2>
                  </Reveal>

                  <Reveal delay={0.12}>
                    <p className="mt-8 max-w-2xl text-[13px] leading-[1.85] text-white/35 md:text-sm">
                      {step.body}
                    </p>
                  </Reveal>
                </div>

                {/* Right: stat */}
                <Reveal delay={0.08} className="lg:text-right">
                  <div
                    className="font-serif text-[clamp(2rem,4vw,3rem)] font-black leading-tight"
                    style={{ color: step.accent }}
                  >
                    {step.stat}
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/25">
                    {step.statLabel}
                  </div>
                </Reveal>

              </div>
            </div>
          </div>
        ))}

        {/* Final rule */}
        <div className="h-px w-full bg-white/8" />
      </section>

      {/* ════════════════════════════════════════════════════════════
          CTA INTERSTITIAL
      ════════════════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a0a] px-8 py-28 text-center md:px-14">
        <Reveal>
          <p className="mb-6 font-mono text-[9px] uppercase tracking-[0.4em] text-white/25">
            — Ready to proceed
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h2 className="font-serif text-[clamp(2.5rem,7vw,6rem)] font-black leading-[0.88] text-white">
            INITIALIZE<br />
            <span style={{ color: '#FF3831' }}>SCANNER</span>
          </h2>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mx-auto mt-8 max-w-sm text-sm leading-relaxed text-white/30">
            Access the live 934-target intelligence catalog with autonomous NASA ingestion, on-the-fly spectral ML, and real-time mission economics.
          </p>
        </Reveal>
        <Reveal delay={0.22}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group border border-white bg-white px-10 py-4 font-mono text-[11px] uppercase tracking-widest text-black transition-all duration-300 hover:bg-transparent hover:text-white"
            >
              <span className="flex items-center gap-2">
                Launch Intelligence Dashboard
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </Link>
            <Link
              href="/analytics"
              className="border border-white/15 px-10 py-4 font-mono text-[11px] uppercase tracking-widest text-white/40 transition hover:border-white/50 hover:text-white"
            >
              Economic Models
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/8 bg-[#0a0a0a]">
        <div className="mx-auto max-w-[1400px] px-8 py-16 md:px-14">

          {/* Top row: logo + nav */}
          <div className="flex flex-wrap items-start justify-between gap-10">

            {/* Brand block */}
            <div>
              <div className="flex items-center gap-3">
                <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/10">
                  <Image src="/logo.png" alt="SPECTRAVEIN" fill className="object-cover" />
                </div>
                <span className="font-serif text-xl font-black text-white">SPECTRAVEIN</span>
              </div>
              <p className="mt-3 max-w-xs font-mono text-[10px] leading-relaxed text-white/20">
                Orbital Mining Intelligence Platform.<br />
                Powered by NASA/JPL live telemetry · 934 NEO targets active.
              </p>
            </div>

            {/* Nav columns */}
            <div className="flex flex-wrap gap-12">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/20">Platform</p>
                {[
                  { label: 'Dashboard', href: '/dashboard' },
                  { label: 'Analytics', href: '/analytics' },
                  { label: 'Home', href: '/' },
                ].map(({ label, href }) => (
                  <Link key={label} href={href} className="font-mono text-[11px] text-white/40 transition hover:text-white">
                    {label}
                  </Link>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-white/20">Data Sources</p>
                {[
                  { label: 'JPL Small-Body DB', href: 'https://ssd.jpl.nasa.gov/tools/sbdb_query.html' },
                  { label: 'JPL HORIZONS', href: 'https://ssd.jpl.nasa.gov/horizons/' },
                  { label: 'NASA NEO Program', href: 'https://cneos.jpl.nasa.gov/' },
                ].map(({ label, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-mono text-[11px] text-white/40 transition hover:text-white"
                  >
                    {label}
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Massive wordmark */}
          <div className="mt-16 overflow-hidden">
            <p
              className="select-none whitespace-nowrap font-serif font-black leading-none text-[clamp(3.5rem,12vw,10rem)]"
              style={{ color: 'rgba(255,255,255,0.04)' }}
            >
              SPECTRAVEIN
            </p>
          </div>

          {/* Bottom bar */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/6 pt-8">
            <p className="font-mono text-[10px] text-white/20">
              © 2024 SPECTRAVEIN · All valuations are theoretical models for research purposes only.
            </p>
            <p className="font-mono text-[10px] text-white/15">
              Data from NASA/JPL Small-Body Database
            </p>
          </div>

        </div>
      </footer>

      </main>
    </>
  );
}
