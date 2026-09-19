import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import AnimateInView from '@/components/AnimateInView';

export const metadata: Metadata = {
  title: 'About RoofRay — Making Solar Decisions Smarter',
  description:
    'Learn about RoofRay, the AI-powered rooftop solar feasibility assistant. Discover our mission, how we work, and why we help people make smarter renewable energy decisions.',
};

// ─── Data ────────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    n: '01',
    title: 'Location',
    body: 'Understand the user\'s geographic location and assess local solar potential based on precise coordinates.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'Roof Area',
    body: 'Analyze the total available rooftop space to determine how many solar panels can be installed effectively.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12 12 2.25l9.75 9.75M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Electricity Usage',
    body: 'Use the monthly electricity bill to precisely understand energy requirements and calculate optimal solar capacity.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
  },
  {
    n: '04',
    title: 'Roof Shading',
    body: 'Consider whether the roof has no shade, partial shade, or heavy shade to accurately estimate energy generation.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
  {
    n: '05',
    title: 'AI Analysis',
    body: 'Process all collected information through intelligent solar feasibility algorithms to evaluate potential accurately.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    n: '06',
    title: 'Recommendation',
    body: 'Present results in a simple, understandable format — including feasibility verdict, estimated savings, and next steps.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

const WHY_CARDS = [
  {
    emoji: '⚡',
    title: 'Quick Analysis',
    body: 'Get useful solar feasibility insights without complicated calculations or technical expertise.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
      </svg>
    ),
  },
  {
    emoji: '🤖',
    title: 'AI-Powered Assistance',
    body: 'An intelligent assistant guides users through the entire solar analysis process, step by step.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    emoji: '📊',
    title: 'Simple Insights',
    body: 'Complex solar information is translated into clear, easy-to-understand insights anyone can act on.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    emoji: '☀️',
    title: 'Renewable Energy Focus',
    body: 'Encouraging smarter decisions for clean and sustainable energy solutions for every Indian rooftop.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
];

const TECH_ITEMS = [
  {
    label: 'Artificial Intelligence',
    sublabel: 'Intelligent solar analysis',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    label: 'Location-Based Analysis',
    sublabel: 'Precise coordinate data',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    label: 'Solar Feasibility Engine',
    sublabel: 'Real-world calculations',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
      </svg>
    ),
  },
  {
    label: 'Modern Web Technologies',
    sublabel: 'Fast, responsive interface',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    label: 'Data Processing',
    sublabel: 'Accurate energy modeling',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
  {
    label: 'Interactive Experience',
    sublabel: 'Human-friendly design',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672 13.684 16.6m0 0-2.51 2.225.569-9.47 5.227 7.917-3.286-.672ZM12 2.25V4.5m5.834.166-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243-1.59-1.59" />
      </svg>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen pb-16 lg:pb-0">
      <div className="mx-auto max-w-7xl px-6 pt-8 md:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-medium text-blue-400 transition hover:bg-blue-500 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>
      </div>

      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section
        id="about-hero"
        className="relative min-h-[85vh] flex items-center overflow-hidden bg-background pt-28 md:pt-36"
        aria-label="About RoofRay Hero"
      >
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Radial blue glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />
          {/* Rotating sun rings */}
          <div className="absolute top-16 right-[6%] h-[260px] w-[260px] opacity-[0.06]">
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-spin-slow" />
            <div className="absolute inset-8 rounded-full border border-primary animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '18s' }} />
            <div className="absolute inset-16 rounded-full border border-primary animate-spin-slow" style={{ animationDuration: '22s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary/30" />
          </div>
          {/* Bottom-left rings */}
          <div className="absolute bottom-16 left-[4%] h-[160px] w-[160px] opacity-[0.04]">
            <div className="absolute inset-0 rounded-full border border-primary animate-spin-slow" style={{ animationDuration: '20s' }} />
            <div className="absolute inset-5 rounded-full border border-primary animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
          </div>
          {/* Stripe bg */}
          <div className="absolute inset-0 stripe-bg opacity-30" />
          {/* Floating particles */}
          <div className="absolute top-32 right-[18%] h-2 w-2 rounded-full bg-primary/20 animate-float" />
          <div className="absolute top-52 right-[30%] h-1.5 w-1.5 rounded-full bg-primary/30 animate-float-slow" />
          <div className="absolute bottom-40 left-[14%] h-2 w-2 rounded-full bg-primary/15 animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[40%] left-[28%] h-1 w-1 rounded-full bg-primary/25 animate-float-slow" style={{ animationDelay: '4s' }} />
          {/* Dot grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 w-full">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Text */}
            <div className="animate-rise">
              {/* Badge */}
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                  AI-Powered Solar Intelligence
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold leading-[1.05] tracking-tight text-white">
                Making Solar
                <br />
                Decisions{' '}
                <span className="relative inline-block">
                  <span className="blue-text">Smarter.</span>
                  <svg className="absolute -bottom-4 left-0 w-full" viewBox="0 0 200 12" fill="none">
                    <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                  </svg>
                </span>
              </h1>

              <p className="mt-8 max-w-lg text-base sm:text-lg leading-relaxed text-muted">
                RoofRay is an AI-powered rooftop solar feasibility assistant designed to make solar planning{' '}
                <span className="font-semibold text-primary">simple</span>,{' '}
                <span className="font-semibold text-primary">understandable</span>, and{' '}
                <span className="font-semibold text-primary">accessible</span> for everyone.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/"
                  className="btn-primary"
                  id="about-hero-cta-primary"
                >
                  Check Your Roof
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                  </svg>
                </Link>
                <Link
                  href="/contact"
                  className="btn-secondary"
                  id="about-hero-cta-secondary"
                >
                  Talk to RoofRay
                </Link>
              </div>
            </div>

            {/* Right: Solar House Illustration */}
            <div className="relative flex items-center justify-center animate-rise">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
              <div className="relative z-10 w-full max-w-md">
                <HeroIllustration />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. What is RoofRay ──────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="what-is-roofray"
          className="relative bg-surface-soft overflow-hidden"
          aria-label="What is RoofRay"
        >
          <div className="absolute inset-0 stripe-bg opacity-20 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
            <div className="grid gap-14 lg:grid-cols-2 lg:gap-20 items-center">
              {/* Left: Text */}
              <div>
                <p className="section-label mb-5">What we do</p>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                  What is{' '}
                  <span className="relative inline-block">
                    <span className="blue-text">RoofRay?</span>
                  </span>
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-muted">
                  RoofRay helps users evaluate whether their rooftop is suitable for solar energy. Instead of making users understand complicated solar calculations, RoofRay collects a few important details and converts them into simple, understandable insights.
                </p>
                <p className="mt-4 text-base leading-relaxed text-muted">
                  Whether you are a homeowner curious about solar panels or someone planning a clean energy upgrade, RoofRay gives you a clear picture of what is possible — without any technical expertise required.
                </p>

                {/* Key points */}
                <ul className="mt-8 space-y-3" aria-label="RoofRay key features">
                  {[
                    'No complicated forms or technical jargon',
                    'Location-specific solar potential analysis',
                    'Clear feasibility verdict and savings estimate',
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-muted">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Process Flow Card */}
              <div className="soft-card p-6 sm:p-8 lg:p-10" aria-label="RoofRay analysis process">
                <p className="font-mono text-xs uppercase tracking-widest text-primary font-semibold mb-6">
                  Analysis Process
                </p>
                <div className="space-y-3">
                  {[
                    { label: 'Location', icon: '📍', desc: 'Where is your roof?' },
                    { label: 'Roof Area', icon: '🏠', desc: 'How much space available?' },
                    { label: 'Electricity Bill', icon: '⚡', desc: 'Monthly energy usage' },
                    { label: 'Roof Shading', icon: '☁️', desc: 'Shade conditions' },
                    { label: 'AI Analysis', icon: '🤖', desc: 'Processing data...' },
                    { label: 'Solar Recommendation', icon: '☀️', desc: 'Your feasibility verdict' },
                  ].map((step, idx, arr) => (
                    <div key={step.label}>
                      <div className="flex items-center gap-4 rounded-xl bg-surface-blue border border-line p-3.5 transition-all duration-300 hover:border-primary/30 hover:bg-primary/5">
                        <span className="text-xl" role="img" aria-label={step.label}>{step.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{step.label}</p>
                          <p className="text-xs text-muted truncate">{step.desc}</p>
                        </div>
                        <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="font-mono text-[0.6rem] font-bold text-primary">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="flex justify-center my-1">
                          <div className="h-4 w-px bg-primary/20" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimateInView>

      {/* ── 3. Mission ──────────────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="mission"
          className="relative bg-background overflow-hidden"
          aria-label="Our Mission"
        >
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
            <div className="mx-auto max-w-3xl text-center">
              {/* Mission icon */}
              <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              </div>

              <p className="section-label mb-5 justify-center">Our Mission</p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                Our{' '}
                <span className="blue-text">Mission</span>
              </h2>
              <p className="mt-8 text-base sm:text-lg leading-relaxed text-muted">
                Our mission is to simplify rooftop solar planning through technology. We want to help people make informed renewable-energy decisions by transforming complex solar feasibility calculations into{' '}
                <span className="font-semibold text-white">clear and useful insights</span> that everyone can understand and act on.
              </p>

              {/* Mission pillars */}
              <div className="mt-12 grid gap-5 sm:grid-cols-3">
                {[
                  { title: 'Simplify', desc: 'Make solar planning accessible to everyone, not just experts.', icon: '💡' },
                  { title: 'Inform', desc: 'Give people the real data they need to make confident decisions.', icon: '📊' },
                  { title: 'Empower', desc: 'Help individuals and businesses move towards clean energy.', icon: '🌿' },
                ].map((pillar) => (
                  <div
                    key={pillar.title}
                    className="soft-card solar-shimmer group p-5 text-center transition-all duration-300"
                  >
                    <span className="text-3xl mb-3 block" role="img" aria-label={pillar.title}>{pillar.icon}</span>
                    <h3 className="font-display text-base font-bold text-white mb-2">{pillar.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{pillar.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </AnimateInView>

      {/* ── 4. How RoofRay Works ────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="how-roofray-works"
          className="relative bg-surface-soft overflow-hidden"
          aria-label="How RoofRay Works"
        >
          <div className="absolute inset-0 stripe-bg opacity-20 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
            <div className="mb-12 md:mb-20 max-w-2xl">
              <p className="section-label mb-5">The Process</p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                How RoofRay{' '}
                <span className="relative inline-block">
                  <span className="blue-text">Works</span>
                  <svg className="absolute -bottom-6 left-0 w-full" viewBox="0 0 200 12" fill="none">
                    <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                  </svg>
                </span>
              </h2>
              <p className="mt-8 text-base sm:text-lg leading-relaxed text-muted">
                Six thoughtful steps that transform your rooftop details into a clear solar feasibility analysis.
              </p>
            </div>

            {/* Desktop: 3-column grid / Mobile: vertical timeline */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {HOW_STEPS.map((step, idx) => (
                <AnimateInView key={step.n} delay={idx * 80}>
                  <div className="soft-card solar-shimmer solar-glow group relative overflow-hidden p-6 sm:p-7 h-full flex flex-col">
                    {/* Top accent */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/30 group-hover:bg-primary transition-colors duration-300" />

                    <div className="flex items-center gap-3 mb-5">
                      <div className="num-circle h-10 w-10 text-sm">{step.n}</div>
                      <div className="solar-icon-pulse flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        {step.icon}
                      </div>
                    </div>

                    <h3 className="font-display text-lg font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-sm leading-relaxed text-muted flex-1">{step.body}</p>
                  </div>
                </AnimateInView>
              ))}
            </div>
          </div>
        </section>
      </AnimateInView>

      {/* ── 5. Why RoofRay ──────────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="why-roofray"
          className="relative bg-background overflow-hidden"
          aria-label="Why Choose RoofRay"
        >
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
            <div className="mb-12 md:mb-20 max-w-2xl">
              <p className="section-label mb-5">Why us</p>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                Why Choose{' '}
                <span className="blue-text">RoofRay?</span>
              </h2>
              <p className="mt-6 text-base sm:text-lg leading-relaxed text-muted">
                Built specifically to remove the barriers between you and a smarter solar decision.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
              {WHY_CARDS.map((card, idx) => (
                <AnimateInView key={card.title} delay={idx * 80}>
                  <div className="soft-card solar-rays solar-shimmer group relative overflow-hidden p-6 sm:p-8 h-full flex flex-col">
                    {/* Icon area */}
                    <div className="mb-6 flex items-start gap-4">
                      <div className="solar-icon-pulse flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        {card.icon}
                      </div>
                      <div className="flex-1 pt-1">
                        <span className="text-xl" role="img" aria-label={card.title}>{card.emoji}</span>
                      </div>
                    </div>

                    <h3 className="font-display text-xl font-bold text-white mb-3">{card.title}</h3>
                    <p className="text-sm sm:text-base leading-relaxed text-muted flex-1">{card.body}</p>

                    {/* Decorative corner */}
                    <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                </AnimateInView>
              ))}
            </div>
          </div>
        </section>
      </AnimateInView>

      {/* ── 6. Technology ───────────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="technology"
          className="relative bg-surface-soft overflow-hidden"
          aria-label="Technology Behind RoofRay"
        >
          <div className="absolute inset-0 stripe-bg opacity-20 pointer-events-none" />
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
            <div className="grid gap-14 lg:grid-cols-2 lg:gap-20 items-center">
              {/* Left: Text */}
              <div>
                <p className="section-label mb-5">Under the hood</p>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                  Built with Technology.{' '}
                  <br />
                  <span className="blue-text">Inspired by Clean Energy.</span>
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-muted">
                  RoofRay brings together modern technology and renewable energy expertise to deliver a seamless, intelligent solar feasibility experience.
                </p>
                <p className="mt-4 text-base leading-relaxed text-muted">
                  Every component is purposefully designed — from data collection to analysis to presentation — ensuring that complex solar information is always delivered simply.
                </p>

                {/* Flow diagram */}
                <div className="mt-10 soft-card p-5 sm:p-6">
                  <p className="font-mono text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                    Technology Flow
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { top: 'AI', bottom: 'Analysis', color: 'bg-primary/15 text-primary' },
                      { top: 'Location', bottom: 'Solar Potential', color: 'bg-primary/10 text-primary' },
                      { top: 'Data', bottom: 'Feasibility', color: 'bg-primary/15 text-primary' },
                    ].map((flow) => (
                      <div key={flow.top} className={`rounded-xl p-3 ${flow.color} border border-primary/10`}>
                        <p className="font-display text-sm font-bold">{flow.top}</p>
                        <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 mx-auto my-1 text-primary/50" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        <p className="font-mono text-[0.65rem] text-primary/70">{flow.bottom}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Tech cards grid */}
              <div className="grid grid-cols-2 gap-4">
                {TECH_ITEMS.map((item, idx) => (
                  <AnimateInView key={item.label} delay={idx * 60}>
                    <div
                      className={`soft-card solar-shimmer group flex flex-col gap-3 p-4 sm:p-5 cursor-default ${idx === 0 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                    >
                      <div className="solar-icon-pulse flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                        {item.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white leading-tight">{item.label}</p>
                        <p className="text-xs text-muted mt-0.5">{item.sublabel}</p>
                      </div>
                    </div>
                  </AnimateInView>
                ))}
              </div>
            </div>
          </div>
        </section>
      </AnimateInView>

      {/* ── 7. Vision ───────────────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="vision"
          className="relative bg-background overflow-hidden"
          aria-label="Our Vision"
        >
          <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
            <div className="grid gap-14 lg:grid-cols-2 lg:gap-20 items-center">
              {/* Left: Vision Illustration */}
              <div className="relative flex items-center justify-center order-2 lg:order-1">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
                <div className="relative z-10 w-full max-w-sm">
                  <VisionIllustration />
                </div>
              </div>

              {/* Right: Text */}
              <div className="order-1 lg:order-2">
                <p className="section-label mb-5">Looking ahead</p>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
                  Our Vision for a{' '}
                  <br />
                  <span className="blue-text">Solar-Powered Future.</span>
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-muted">
                  We envision a future where understanding solar energy is simple for everyone. RoofRay aims to become a smart starting point for individuals and businesses exploring rooftop solar and cleaner energy solutions.
                </p>
                <p className="mt-4 text-base leading-relaxed text-muted">
                  By making solar feasibility knowledge accessible, we hope to accelerate the transition to renewable energy — one rooftop at a time.
                </p>

                {/* Vision stats */}
                <div className="mt-10 grid grid-cols-3 gap-4">
                  {[
                    { num: '6+', label: 'Analysis\nParameters' },
                    { num: '100%', label: 'AI-Powered\nInsights' },
                    { num: '0', label: 'Technical\nKnowledge Needed' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center">
                      <p className="font-display text-2xl sm:text-3xl font-extrabold blue-text">{stat.num}</p>
                      <p className="mt-1 text-xs text-muted leading-tight whitespace-pre-line">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimateInView>

      {/* ── 8. CTA ──────────────────────────────────────────────────────── */}
      <AnimateInView>
        <section
          id="about-cta"
          className="relative overflow-hidden bg-surface-blue"
          aria-label="Call to Action"
        >
          {/* Decorative elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-[10%] h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute bottom-10 right-[10%] h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute inset-0 stripe-bg opacity-20" />
            {/* Floating dots */}
            <div className="absolute top-20 right-[20%] h-2 w-2 rounded-full bg-primary/20 animate-float" />
            <div className="absolute bottom-32 left-[15%] h-1.5 w-1.5 rounded-full bg-primary/30 animate-float-slow" />
            <div className="absolute top-1/2 right-[30%] h-2.5 w-2.5 rounded-full bg-primary/10 animate-float" style={{ animationDelay: '3s' }} />
          </div>

          <div className="relative mx-auto max-w-4xl px-6 py-24 text-center lg:px-10 lg:py-32">
            {/* Icon */}
            <div className="mx-auto mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
              </svg>
            </div>

            <p className="mb-5 font-mono text-xs uppercase tracking-[0.15em] text-primary font-semibold">
              Start your solar journey
            </p>

            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Ready to Explore Your
              <br />
              <span className="blue-text">Solar Potential?</span>
            </h2>

            <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-muted lg:text-lg">
              Let RoofRay help you understand the possibilities of rooftop solar — in minutes, not hours.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/"
                className="btn-primary w-full sm:w-auto justify-center"
                id="about-cta-primary"
              >
                Check Your Roof
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </Link>
              <Link
                href="/contact"
                className="btn-secondary w-full sm:w-auto justify-center"
                id="about-cta-secondary"
              >
                Talk to RoofRay
              </Link>
            </div>
          </div>
        </section>
      </AnimateInView>

      <Footer />
    </main>
  );
}

// ─── Inline Illustrations (SVG) ──────────────────────────────────────────────

function HeroIllustration() {
  return (
    <div className="relative w-full aspect-square max-w-md mx-auto" aria-hidden="true">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full border border-primary/10 animate-spin-slow" />
      <div className="absolute inset-8 rounded-full border border-primary/08 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '18s' }} />

      {/* Central card */}
      <div className="absolute inset-12 rounded-3xl bg-surface-soft border border-line flex flex-col items-center justify-center p-6 animate-float-slow">
        {/* House SVG */}
        <svg viewBox="0 0 120 100" className="w-full max-w-[140px] h-auto" fill="none">
          {/* Sky background */}
          <rect width="120" height="100" rx="12" fill="#0D1424" />

          {/* Ground */}
          <rect x="0" y="78" width="120" height="22" rx="0" fill="#0F1929" />

          {/* House body */}
          <rect x="28" y="52" width="64" height="38" rx="2" fill="#111827" stroke="#1E293B" strokeWidth="1" />

          {/* Roof */}
          <path d="M22 54 L60 22 L98 54Z" fill="#0D1424" stroke="#1E3A5F" strokeWidth="1.5" strokeLinejoin="round" />

          {/* Door */}
          <rect x="52" y="68" width="16" height="22" rx="2" fill="#1E293B" />
          <rect x="54" y="70" width="6" height="10" rx="1" fill="#2563EB" opacity="0.3" />
          <rect x="60" y="70" width="6" height="10" rx="1" fill="#2563EB" opacity="0.3" />

          {/* Window left */}
          <rect x="33" y="60" width="16" height="12" rx="1.5" fill="#1E293B" stroke="#2563EB" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="41" y1="60" x2="41" y2="72" stroke="#2563EB" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="33" y1="66" x2="49" y2="66" stroke="#2563EB" strokeWidth="0.5" strokeOpacity="0.3" />

          {/* Window right */}
          <rect x="71" y="60" width="16" height="12" rx="1.5" fill="#1E293B" stroke="#2563EB" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="79" y1="60" x2="79" y2="72" stroke="#2563EB" strokeWidth="0.5" strokeOpacity="0.3" />
          <line x1="71" y1="66" x2="87" y2="66" stroke="#2563EB" strokeWidth="0.5" strokeOpacity="0.3" />

          {/* Solar panels on roof */}
          <g transform="rotate(-33, 60, 38)">
            <rect x="32" y="29" width="13" height="9" rx="1" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" />
            <line x1="38" y1="29" x2="38" y2="38" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
            <line x1="32" y1="33" x2="45" y2="33" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />

            <rect x="47" y="29" width="13" height="9" rx="1" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" />
            <line x1="53" y1="29" x2="53" y2="38" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
            <line x1="47" y1="33" x2="60" y2="33" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />

            <rect x="62" y="29" width="13" height="9" rx="1" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" />
            <line x1="68" y1="29" x2="68" y2="38" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
            <line x1="62" y1="33" x2="75" y2="33" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />

            <rect x="32" y="40" width="13" height="9" rx="1" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" />
            <line x1="38" y1="40" x2="38" y2="49" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
            <line x1="32" y1="44" x2="45" y2="44" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />

            <rect x="47" y="40" width="13" height="9" rx="1" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" />
            <line x1="53" y1="40" x2="53" y2="49" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
            <line x1="47" y1="44" x2="60" y2="44" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />

            <rect x="62" y="40" width="13" height="9" rx="1" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" />
            <line x1="68" y1="40" x2="68" y2="49" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
            <line x1="62" y1="44" x2="75" y2="44" stroke="#3B82F6" strokeWidth="0.3" strokeOpacity="0.6" />
          </g>

          {/* Sun */}
          <circle cx="100" cy="16" r="7" fill="#3B82F6" opacity="0.15" />
          <circle cx="100" cy="16" r="4" fill="#3B82F6" opacity="0.4" />
          {/* Sun rays */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 5.5 * Math.cos(rad);
            const y1 = 16 + 5.5 * Math.sin(rad);
            const x2 = 100 + 8.5 * Math.cos(rad);
            const y2 = 16 + 8.5 * Math.sin(rad);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.5" strokeLinecap="round" />
            );
          })}

          {/* AI spark */}
          <circle cx="18" cy="18" r="8" fill="#1D4ED8" opacity="0.15" />
          <text x="14" y="22" fontSize="8" fill="#3B82F6" fontFamily="monospace" opacity="0.8">AI</text>
        </svg>

        <div className="mt-4 text-center">
          <p className="font-display text-xs font-bold text-white">Solar Analysis</p>
          <div className="mt-1.5 flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            <p className="font-mono text-[0.6rem] text-primary">Processing...</p>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute top-4 right-2 rounded-xl bg-surface-soft border border-line px-3 py-2 shadow-lg animate-float">
        <p className="font-mono text-[0.6rem] text-primary font-bold">☀️ Solar Ready</p>
      </div>
      <div className="absolute bottom-8 left-0 rounded-xl bg-surface-soft border border-line px-3 py-2 shadow-lg animate-float-slow" style={{ animationDelay: '1.5s' }}>
        <p className="font-mono text-[0.6rem] text-primary font-bold">🤖 AI Analysis</p>
      </div>
    </div>
  );
}

function VisionIllustration() {
  return (
    <div className="relative w-full" aria-hidden="true">
      <div className="soft-card p-8 text-center">
        {/* Solar future visual */}
        <svg viewBox="0 0 200 160" className="w-full h-auto" fill="none">
          {/* Sky */}
          <rect width="200" height="160" rx="16" fill="#0D1424" />

          {/* Ground line */}
          <line x1="0" y1="120" x2="200" y2="120" stroke="#1E293B" strokeWidth="1" />

          {/* Multiple houses */}
          {/* House 1 - left small */}
          <rect x="15" y="90" width="32" height="30" rx="1" fill="#111827" stroke="#1E293B" strokeWidth="0.8" />
          <path d="M10 92 L31 72 L52 92Z" fill="#0D1424" stroke="#1E3A5F" strokeWidth="1" strokeLinejoin="round" />
          <rect x="23" y="98" width="8" height="10" rx="1" fill="#1E293B" />
          {/* Panels house 1 */}
          <rect x="17" y="78" width="8" height="5" rx="0.5" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.4" opacity="0.8" />
          <rect x="26" y="76" width="8" height="5" rx="0.5" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.4" opacity="0.8" />

          {/* House 2 - center large */}
          <rect x="76" y="75" width="48" height="45" rx="1.5" fill="#111827" stroke="#1E293B" strokeWidth="1" />
          <path d="M68 78 L100 48 L132 78Z" fill="#0D1424" stroke="#1E3A5F" strokeWidth="1.2" strokeLinejoin="round" />
          <rect x="90" y="95" width="12" height="18" rx="1" fill="#1E293B" />
          <rect x="80" y="85" width="10" height="8" rx="1" fill="#1E293B" stroke="#2563EB" strokeWidth="0.3" strokeOpacity="0.5" />
          <rect x="110" y="85" width="10" height="8" rx="1" fill="#1E293B" stroke="#2563EB" strokeWidth="0.3" strokeOpacity="0.5" />
          {/* Panels house 2 */}
          <rect x="78" y="56" width="12" height="8" rx="0.8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" opacity="0.9" />
          <rect x="91" y="52" width="12" height="8" rx="0.8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" opacity="0.9" />
          <rect x="104" y="56" width="12" height="8" rx="0.8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" opacity="0.9" />
          <rect x="78" y="65" width="12" height="8" rx="0.8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" opacity="0.9" />
          <rect x="91" y="61" width="12" height="8" rx="0.8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" opacity="0.9" />
          <rect x="104" y="65" width="12" height="8" rx="0.8" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.5" opacity="0.9" />

          {/* House 3 - right medium */}
          <rect x="148" y="85" width="38" height="35" rx="1" fill="#111827" stroke="#1E293B" strokeWidth="0.8" />
          <path d="M143" y2="87" />
          <path d="M143 88 L167 63 L191 88Z" fill="#0D1424" stroke="#1E3A5F" strokeWidth="1" strokeLinejoin="round" />
          <rect x="159" y="100" width="8" height="13" rx="1" fill="#1E293B" />
          {/* Panels house 3 */}
          <rect x="149" y="70" width="9" height="6" rx="0.5" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.4" opacity="0.8" />
          <rect x="159" y="67" width="9" height="6" rx="0.5" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.4" opacity="0.8" />
          <rect x="169" y="70" width="9" height="6" rx="0.5" fill="#1D4ED8" stroke="#3B82F6" strokeWidth="0.4" opacity="0.8" />

          {/* Sun */}
          <circle cx="100" cy="25" r="14" fill="#1D4ED8" opacity="0.08" />
          <circle cx="100" cy="25" r="9" fill="#2563EB" opacity="0.12" />
          <circle cx="100" cy="25" r="5" fill="#3B82F6" opacity="0.4" />
          {/* Sun rays */}
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 100 + 7 * Math.cos(rad);
            const y1 = 25 + 7 * Math.sin(rad);
            const x2 = 100 + (i % 2 === 0 ? 12 : 10) * Math.cos(rad);
            const y2 = 25 + (i % 2 === 0 ? 12 : 10) * Math.sin(rad);
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3B82F6" strokeWidth="0.8" strokeOpacity="0.4" strokeLinecap="round" />
            );
          })}

          {/* Energy beams from panels to sun */}
          <path d="M31 79 Q60 55 95 30" stroke="#3B82F6" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="3 3" />
          <path d="M97 56 Q98 42 100 32" stroke="#3B82F6" strokeWidth="0.8" strokeOpacity="0.25" strokeDasharray="3 3" />
          <path d="M167 69 Q140 50 106 32" stroke="#3B82F6" strokeWidth="0.5" strokeOpacity="0.15" strokeDasharray="3 3" />

          {/* Stars / particles */}
          <circle cx="150" cy="15" r="1" fill="#3B82F6" opacity="0.4" />
          <circle cx="165" cy="30" r="0.8" fill="#3B82F6" opacity="0.3" />
          <circle cx="30" cy="22" r="1" fill="#3B82F6" opacity="0.35" />
          <circle cx="45" cy="10" r="0.8" fill="#3B82F6" opacity="0.25" />

          {/* Grid overlay subtle */}
          <path d="M0 40 H200" stroke="#1E293B" strokeWidth="0.3" opacity="0.5" />
          <path d="M0 80 H200" stroke="#1E293B" strokeWidth="0.3" opacity="0.5" />
        </svg>

        <div className="mt-4">
          <p className="font-display text-sm font-bold text-white">A Solar-Powered Future</p>
          <p className="mt-1 font-mono text-xs text-muted">One rooftop at a time.</p>
        </div>
      </div>
    </div>
  );
}
