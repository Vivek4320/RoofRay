import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import AnimateInView from '@/components/AnimateInView';
import { LuArrowLeft, LuArrowRight, LuBot, LuChartNoAxesColumnIncreasing, LuChevronDown, LuCircleCheck, LuCloud, LuHouse, LuLeaf, LuLightbulb, LuMapPin, LuMessageCircle, LuMousePointer2, LuSun, LuTerminal, LuZap, LuCheck } from 'react-icons/lu';

export const metadata: Metadata = {
  title: 'About RoofRay — Making Solar Decisions Smarter',
  description:
    'Learn about RoofRay, the AI-powered rooftop solar feasibility assistant. Discover our mission, how we work, and why we help people make smarter renewable energy decisions.',
};

// ─── Shared responsive tokens ────────────────────────────────────────────────
// Keeping these in one place makes the whole page easy to tune per breakpoint.

const SECTION_PAD = 'px-4 py-14 sm:px-6 sm:py-20 lg:px-10 lg:py-28';
const SECTION_GRID = 'grid items-center gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-20';
const H2 =
  'font-display text-[1.75rem] leading-tight sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white';
const LEAD = 'text-[0.95rem] sm:text-base lg:text-lg leading-relaxed text-muted';

// ─── Data ────────────────────────────────────────────────────────────────────

const HOW_STEPS = [
  {
    n: '01',
    title: 'Location',
    body: 'Understand the user\'s geographic location and assess local solar potential based on precise coordinates.',
    icon: <LuMapPin className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    n: '02',
    title: 'Roof Area',
    body: 'Analyze the total available rooftop space to determine how many solar panels can be installed effectively.',
    icon: <LuHouse className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    n: '03',
    title: 'Electricity Usage',
    body: 'Use the monthly electricity bill to precisely understand energy requirements and calculate optimal solar capacity.',
    icon: <LuZap className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    n: '04',
    title: 'Roof Shading',
    body: 'Consider whether the roof has no shade, partial shade, or heavy shade to accurately estimate energy generation.',
    icon: <LuSun className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    n: '05',
    title: 'AI Analysis',
    body: 'Process all collected information through intelligent solar feasibility algorithms to evaluate potential accurately.',
    icon: <LuBot className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    n: '06',
    title: 'Recommendation',
    body: 'Present results in a simple, understandable format — including feasibility verdict, estimated savings, and next steps.',
    icon: <LuCircleCheck className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
];

const WHY_CARDS = [
  {
    badgeIcon: <LuZap className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
    title: 'Quick Analysis',
    body: 'Get useful solar feasibility insights without complicated calculations or technical expertise.',
    icon: <LuZap className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    badgeIcon: <LuBot className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
    title: 'AI-Powered Assistance',
    body: 'An intelligent assistant guides users through the entire solar analysis process, step by step.',
    icon: <LuBot className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    badgeIcon: <LuChartNoAxesColumnIncreasing className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
    title: 'Simple Insights',
    body: 'Complex solar information is translated into clear, easy-to-understand insights anyone can act on.',
    icon: <LuChartNoAxesColumnIncreasing className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
  {
    badgeIcon: <LuSun className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
    title: 'Renewable Energy Focus',
    body: 'Encouraging smarter decisions for clean and sustainable energy solutions for every Indian rooftop.',
    icon: <LuSun className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />,
  },
];

const TECH_ITEMS = [
  {
    label: 'Artificial Intelligence',
    sublabel: 'Intelligent solar analysis',
    icon: <LuMessageCircle className="h-5 w-5" aria-hidden="true" />,
  },
  {
    label: 'Location-Based Analysis',
    sublabel: 'Precise coordinate data',
    icon: <LuMapPin className="h-5 w-5" aria-hidden="true" />,
  },
  {
    label: 'Solar Feasibility Engine',
    sublabel: 'Real-world calculations',
    icon: <LuSun className="h-5 w-5" aria-hidden="true" />,
  },
  {
    label: 'Modern Web Technologies',
    sublabel: 'Fast, responsive interface',
    icon: <LuTerminal className="h-5 w-5" aria-hidden="true" />,
  },
  {
    label: 'Data Processing',
    sublabel: 'Accurate energy modeling',
    icon: <LuChartNoAxesColumnIncreasing className="h-5 w-5" aria-hidden="true" />,
  },
  {
    label: 'Interactive Experience',
    sublabel: 'Human-friendly design',
    icon: <LuMousePointer2 className="h-5 w-5" aria-hidden="true" />,
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <main id="main-content" className="min-h-screen overflow-x-hidden pb-16 lg:pb-0">
      {/* Back link */}
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-8 md:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500 hover:text-white sm:px-5 sm:py-3 sm:text-sm"
        >
          <LuArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          Back to Home
        </Link>
      </div>

      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section
        id="about-hero"
        className="relative flex items-center overflow-hidden bg-background pt-10 pb-14 sm:pt-16 sm:pb-20 md:pt-24 lg:min-h-[85vh] lg:pt-28 lg:pb-24"
        aria-label="About RoofRay Hero"
      >
        {/* Background decorations (non-interactive, closed before the content) */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {/* Radial blue glow */}
          <div className="absolute top-1/3 left-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[90px] sm:h-[480px] sm:w-[480px] lg:h-[600px] lg:w-[600px] lg:blur-[120px]" />
          {/* Rotating sun rings (tablet and up) */}
          <div className="absolute top-10 right-[4%] hidden h-[200px] w-[200px] opacity-[0.06] md:block lg:top-16 lg:right-[6%] lg:h-[260px] lg:w-[260px]">
            <div className="absolute inset-0 rounded-full border-2 border-primary animate-spin-slow" />
            <div className="absolute inset-8 rounded-full border border-primary animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '18s' }} />
            <div className="absolute inset-16 rounded-full border border-primary animate-spin-slow" style={{ animationDuration: '22s' }} />
            <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/30" />
          </div>
          {/* Bottom-left rings (tablet and up) */}
          <div className="absolute bottom-16 left-[4%] hidden h-[160px] w-[160px] opacity-[0.04] md:block">
            <div className="absolute inset-0 rounded-full border border-primary animate-spin-slow" style={{ animationDuration: '20s' }} />
            <div className="absolute inset-5 rounded-full border border-primary animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
          </div>
          {/* Stripe bg */}
          <div className="absolute inset-0 stripe-bg opacity-30" />
          {/* Floating particles */}
          <div className="absolute top-32 right-[18%] h-2 w-2 rounded-full bg-primary/20 animate-float" />
          <div className="absolute top-52 right-[30%] hidden h-1.5 w-1.5 rounded-full bg-primary/30 animate-float-slow sm:block" />
          <div className="absolute bottom-40 left-[14%] h-2 w-2 rounded-full bg-primary/15 animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-[40%] left-[28%] hidden h-1 w-1 rounded-full bg-primary/25 animate-float-slow sm:block" style={{ animationDelay: '4s' }} />
        </div>

        {/* Hero content */}
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Text */}
            <div className="animate-rise text-center lg:text-left">
              {/* Badge */}
              <div className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 sm:mb-8 sm:px-4 sm:py-2">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono text-[0.65rem] font-semibold uppercase tracking-widest text-primary sm:text-xs">
                  AI-Powered Solar Intelligence
                </span>
              </div>

              <h1 className="font-display text-[2.25rem] font-extrabold leading-[1.08] tracking-tight text-white min-[400px]:text-[2.6rem] sm:text-5xl md:text-6xl lg:text-[3.5rem] xl:text-6xl">
                Making Solar
                <br />
                Decisions{' '}
                <span className="relative inline-block">
                  <span className="blue-text">Smarter.</span>
                  <svg className="absolute -bottom-3 left-0 w-full sm:-bottom-4" viewBox="0 0 200 12" fill="none" aria-hidden="true">
                    <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                  </svg>
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-lg text-[0.95rem] leading-relaxed text-muted sm:mt-8 sm:text-lg lg:mx-0">
                RoofRay is an AI-powered rooftop solar feasibility assistant designed to make solar planning{' '}
                <span className="font-semibold text-primary">simple</span>,{' '}
                <span className="font-semibold text-primary">understandable</span>, and{' '}
                <span className="font-semibold text-primary">accessible</span> for everyone.
              </p>

              <div className="mt-8 flex flex-col items-stretch gap-3 min-[480px]:flex-row min-[480px]:flex-wrap min-[480px]:justify-center sm:mt-10 sm:gap-4 lg:justify-start">
                <Link
                  href="/"
                  className="btn-primary w-full justify-center min-[480px]:w-auto"
                  id="about-hero-cta-primary"
                >
                  Check Your Roof
                  <LuArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/contact"
                  className="btn-secondary w-full justify-center min-[480px]:w-auto"
                  id="about-hero-cta-secondary"
                >
                  Talk to RoofRay
                </Link>
              </div>
            </div>

            {/* Right: Solar House Illustration */}
            <div className="relative flex items-center justify-center animate-rise">
              <div className="pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl sm:h-80 sm:w-80" />
              <div className="relative z-10 w-full max-w-[17rem] min-[400px]:max-w-xs sm:max-w-md">
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
          className="relative overflow-hidden bg-surface-soft"
          aria-label="What is RoofRay"
        >
          <div className="pointer-events-none absolute inset-0 stripe-bg opacity-20" />
          <div className={`relative mx-auto max-w-7xl ${SECTION_PAD}`}>
            <div className={SECTION_GRID}>
              {/* Left: Text */}
              <div>
                <p className="section-label mb-4 sm:mb-5">What we do</p>
                <h2 className={H2}>
                  What is{' '}
                  <span className="relative inline-block">
                    <span className="blue-text">RoofRay?</span>
                  </span>
                </h2>
                <p className={`mt-5 sm:mt-6 ${LEAD}`}>
                  RoofRay helps users evaluate whether their rooftop is suitable for solar energy. Instead of making users understand complicated solar calculations, RoofRay collects a few important details and converts them into simple, understandable insights.
                </p>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted sm:text-base">
                  Whether you are a homeowner curious about solar panels or someone planning a clean energy upgrade, RoofRay gives you a clear picture of what is possible — without any technical expertise required.
                </p>

                {/* Key points */}
                <ul className="mt-6 space-y-3 sm:mt-8" aria-label="RoofRay key features">
                  {[
                    'No complicated forms or technical jargon',
                    'Location-specific solar potential analysis',
                    'Clear feasibility verdict and savings estimate',
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-3 text-sm text-muted">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <LuCheck className="h-3 w-3" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: Process Flow Card */}
              <div className="soft-card w-full min-w-0 p-4 sm:p-8 lg:p-10" aria-label="RoofRay analysis process">
                <p className="mb-5 font-mono text-xs font-semibold uppercase tracking-widest text-primary sm:mb-6">
                  Analysis Process
                </p>
                <div className="space-y-2 sm:space-y-3">
                  {[
                    { label: 'Location', icon: <LuMapPin className="h-5 w-5" aria-hidden="true" />, desc: 'Where is your roof?' },
                    { label: 'Roof Area', icon: <LuHouse className="h-5 w-5" aria-hidden="true" />, desc: 'How much space available?' },
                    { label: 'Electricity Bill', icon: <LuZap className="h-5 w-5" aria-hidden="true" />, desc: 'Monthly energy usage' },
                    { label: 'Roof Shading', icon: <LuCloud className="h-5 w-5" aria-hidden="true" />, desc: 'Shade conditions' },
                    { label: 'AI Analysis', icon: <LuBot className="h-5 w-5" aria-hidden="true" />, desc: 'Processing data...' },
                    { label: 'Solar Recommendation', icon: <LuSun className="h-5 w-5" aria-hidden="true" />, desc: 'Your feasibility verdict' },
                  ].map((step, idx, arr) => (
                    <div key={step.label}>
                      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-blue p-3 transition-all duration-300 hover:border-primary/30 hover:bg-primary/5 sm:gap-4 sm:p-3.5">
                        <span className="shrink-0 text-xl text-primary" aria-hidden="true">{step.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{step.label}</p>
                          <p className="truncate text-xs text-muted">{step.desc}</p>
                        </div>
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <span className="font-mono text-[0.6rem] font-bold text-primary">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                        </div>
                      </div>
                      {idx < arr.length - 1 && (
                        <div className="my-1 flex justify-center">
                          <div className="h-3 w-px bg-primary/20 sm:h-4" />
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
          className="relative overflow-hidden bg-background"
          aria-label="Our Mission"
        >
          <div className={`relative mx-auto max-w-7xl ${SECTION_PAD}`}>
            <div className="mx-auto max-w-3xl text-center">
              {/* Mission icon */}
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:mb-8 sm:h-16 sm:w-16">
                <LuSun className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
              </div>

              <p className="section-label mb-4 justify-center sm:mb-5">Our Mission</p>
              <h2 className={H2}>
                Our{' '}
                <span className="blue-text">Mission</span>
              </h2>
              <p className={`mt-6 sm:mt-8 ${LEAD}`}>
                Our mission is to simplify rooftop solar planning through technology. We want to help people make informed renewable-energy decisions by transforming complex solar feasibility calculations into{' '}
                <span className="font-semibold text-white">clear and useful insights</span> that everyone can understand and act on.
              </p>

              {/* Mission pillars */}
              <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-3 sm:gap-5">
                {[
                  { title: 'Simplify', desc: 'Make solar planning accessible to everyone, not just experts.', icon: <LuLightbulb className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" /> },
                  { title: 'Inform', desc: 'Give people the real data they need to make confident decisions.', icon: <LuChartNoAxesColumnIncreasing className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" /> },
                  { title: 'Empower', desc: 'Help individuals and businesses move towards clean energy.', icon: <LuLeaf className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" /> },
                ].map((pillar) => (
                  <div
                    key={pillar.title}
                    className="soft-card solar-shimmer group p-5 text-center transition-all duration-300"
                  >
                    <span className="mb-3 flex justify-center text-primary" aria-hidden="true">{pillar.icon}</span>
                    <h3 className="mb-2 font-display text-base font-bold text-white">{pillar.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{pillar.desc}</p>
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
          className="relative overflow-hidden bg-surface-soft"
          aria-label="How RoofRay Works"
        >
          <div className="pointer-events-none absolute inset-0 stripe-bg opacity-20" />
          <div className={`relative mx-auto max-w-7xl ${SECTION_PAD}`}>
            <div className="mb-10 max-w-2xl sm:mb-14 md:mb-20">
              <p className="section-label mb-4 sm:mb-5">The Process</p>
              <h2 className={H2}>
                How RoofRay{' '}
                <span className="relative inline-block">
                  <span className="blue-text">Works</span>
                  <svg className="absolute -bottom-4 left-0 w-full sm:-bottom-6" viewBox="0 0 200 12" fill="none" aria-hidden="true">
                    <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                  </svg>
                </span>
              </h2>
              <p className={`mt-6 sm:mt-8 ${LEAD}`}>
                Six thoughtful steps that transform your rooftop details into a clear solar feasibility analysis.
              </p>
            </div>

            {/* Mobile: 1 col / Tablet: 2 col / Desktop: 3 col */}
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {HOW_STEPS.map((step, idx) => (
                <AnimateInView key={step.n} delay={idx * 80}>
                  <div className="soft-card solar-shimmer solar-glow group relative flex h-full flex-col overflow-hidden p-5 sm:p-7">
                    {/* Top accent */}
                    <div className="absolute top-0 right-0 left-0 h-0.5 bg-primary/30 transition-colors duration-300 group-hover:bg-primary" />

                    <div className="mb-4 flex items-center gap-3 sm:mb-5">
                      <div className="num-circle h-10 w-10 text-sm">{step.n}</div>
                      <div className="solar-icon-pulse flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white">
                        {step.icon}
                      </div>
                    </div>

                    <h3 className="mb-2 font-display text-lg font-bold text-white">{step.title}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-muted">{step.body}</p>
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
          className="relative overflow-hidden bg-background"
          aria-label="Why Choose RoofRay"
        >
          <div className={`relative mx-auto max-w-7xl ${SECTION_PAD}`}>
            <div className="mb-10 max-w-2xl sm:mb-14 md:mb-20">
              <p className="section-label mb-4 sm:mb-5">Why us</p>
              <h2 className={H2}>
                Why Choose{' '}
                <span className="blue-text">RoofRay?</span>
              </h2>
              <p className={`mt-5 sm:mt-6 ${LEAD}`}>
                Built specifically to remove the barriers between you and a smarter solar decision.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:gap-8">
              {WHY_CARDS.map((card, idx) => (
                <AnimateInView key={card.title} delay={idx * 80}>
                  <div className="soft-card solar-rays solar-shimmer group relative flex h-full flex-col overflow-hidden p-5 sm:p-8">
                    {/* Icon area */}
                    <div className="mb-5 flex items-start gap-4 sm:mb-6">
                      <div className="solar-icon-pulse flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white sm:h-14 sm:w-14">
                        {card.icon}
                      </div>
                      <div className="flex-1 pt-1">
                        <span className="text-xl" aria-hidden="true">{card.badgeIcon}</span>
                      </div>
                    </div>

                    <h3 className="mb-2 font-display text-lg font-bold text-white sm:mb-3 sm:text-xl">{card.title}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-muted sm:text-base">{card.body}</p>

                    {/* Decorative corner */}
                    <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
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
          className="relative overflow-hidden bg-surface-soft"
          aria-label="Technology Behind RoofRay"
        >
          <div className="pointer-events-none absolute inset-0 stripe-bg opacity-20" />
          <div className={`relative mx-auto max-w-7xl ${SECTION_PAD}`}>
            <div className={SECTION_GRID}>
              {/* Left: Text */}
              <div className="min-w-0">
                <p className="section-label mb-4 sm:mb-5">Under the hood</p>
                <h2 className={H2}>
                  Built with Technology.{' '}
                  <br className="hidden sm:block" />
                  <span className="blue-text">Inspired by Clean Energy.</span>
                </h2>
                <p className={`mt-5 sm:mt-6 ${LEAD}`}>
                  RoofRay brings together modern technology and renewable energy expertise to deliver a seamless, intelligent solar feasibility experience.
                </p>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted sm:text-base">
                  Every component is purposefully designed — from data collection to analysis to presentation — ensuring that complex solar information is always delivered simply.
                </p>

                {/* Flow diagram */}
                <div className="soft-card mt-8 p-4 sm:mt-10 sm:p-6">
                  <p className="mb-4 font-mono text-xs font-semibold uppercase tracking-widest text-primary">
                    Technology Flow
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
                    {[
                      { top: 'AI', bottom: 'Analysis', color: 'bg-primary/15 text-primary' },
                      { top: 'Location', bottom: 'Solar Potential', color: 'bg-primary/10 text-primary' },
                      { top: 'Data', bottom: 'Feasibility', color: 'bg-primary/15 text-primary' },
                    ].map((flow) => (
                      <div key={flow.top} className={`min-w-0 rounded-xl border border-primary/10 p-2 sm:p-3 ${flow.color}`}>
                        <p className="font-display text-xs font-bold sm:text-sm">{flow.top}</p>
                        <LuChevronDown className="mx-auto my-1 h-3 w-3 text-primary/50" aria-hidden="true" />
                        <p className="break-words font-mono text-[0.6rem] text-primary/70 sm:text-[0.65rem]">{flow.bottom}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Tech cards grid */}
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4">
                {TECH_ITEMS.map((item, idx) => (
                  <AnimateInView key={item.label} delay={idx * 60}>
                    <div className="soft-card solar-shimmer group flex h-full cursor-default flex-row items-center gap-3 p-4 min-[420px]:flex-col min-[420px]:items-start sm:p-5">
                      <div className="solar-icon-pulse flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white">
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-tight text-white">{item.label}</p>
                        <p className="mt-0.5 text-xs text-muted">{item.sublabel}</p>
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
          className="relative overflow-hidden bg-background"
          aria-label="Our Vision"
        >
          <div className={`relative mx-auto max-w-7xl ${SECTION_PAD}`}>
            <div className={SECTION_GRID}>
              {/* Left: Vision Illustration (below text on mobile, left on desktop) */}
              <div className="relative order-2 flex items-center justify-center lg:order-1">
                <div className="pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl sm:h-72 sm:w-72" />
                <div className="relative z-10 w-full max-w-sm">
                  <VisionIllustration />
                </div>
              </div>

              {/* Right: Text */}
              <div className="order-1 min-w-0 lg:order-2">
                <p className="section-label mb-4 sm:mb-5">Looking ahead</p>
                <h2 className={H2}>
                  Our Vision for a{' '}
                  <br className="hidden sm:block" />
                  <span className="blue-text">Solar-Powered Future.</span>
                </h2>
                <p className={`mt-5 sm:mt-6 ${LEAD}`}>
                  We envision a future where understanding solar energy is simple for everyone. RoofRay aims to become a smart starting point for individuals and businesses exploring rooftop solar and cleaner energy solutions.
                </p>
                <p className="mt-4 text-[0.95rem] leading-relaxed text-muted sm:text-base">
                  By making solar feasibility knowledge accessible, we hope to accelerate the transition to renewable energy — one rooftop at a time.
                </p>

                {/* Vision stats */}
                <div className="mt-8 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-4">
                  {[
                    { num: '6+', label: 'Analysis\nParameters' },
                    { num: '100%', label: 'AI-Powered\nInsights' },
                    { num: '0', label: 'Technical\nKnowledge Needed' },
                  ].map((stat) => (
                    <div key={stat.label} className="min-w-0 text-center">
                      <p className="blue-text font-display text-xl font-extrabold sm:text-3xl">{stat.num}</p>
                      <p className="mt-1 whitespace-pre-line text-[0.65rem] leading-tight text-muted sm:text-xs">{stat.label}</p>
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
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute top-10 left-[10%] h-48 w-48 rounded-full bg-primary/5 blur-3xl sm:h-64 sm:w-64" />
            <div className="absolute right-[10%] bottom-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl sm:h-48 sm:w-48" />
            <div className="absolute inset-0 stripe-bg opacity-20" />
            {/* Floating dots */}
            <div className="absolute top-20 right-[20%] h-2 w-2 rounded-full bg-primary/20 animate-float" />
            <div className="absolute bottom-32 left-[15%] h-1.5 w-1.5 rounded-full bg-primary/30 animate-float-slow" />
            <div className="absolute top-1/2 right-[30%] hidden h-2.5 w-2.5 rounded-full bg-primary/10 animate-float sm:block" style={{ animationDelay: '3s' }} />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-10 lg:py-28">
            {/* Icon */}
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary sm:mb-8 sm:h-16 sm:w-16">
              <LuSun className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
            </div>

            <p className="mb-4 font-mono text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-primary sm:mb-5 sm:text-xs">
              Start your solar journey
            </p>

            <h2 className={H2}>
              Ready to Explore Your
              <br />
              <span className="blue-text">Solar Potential?</span>
            </h2>

            <p className="mx-auto mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted sm:mt-6 lg:text-lg">
              Let RoofRay help you understand the possibilities of rooftop solar — in minutes, not hours.
            </p>

            <div className="mx-auto mt-8 flex max-w-xs flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <Link
                href="/"
                className="btn-primary w-full justify-center sm:w-auto"
                id="about-cta-primary"
              >
                Check Your Roof
                <LuArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="btn-secondary w-full justify-center sm:w-auto"
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
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden="true">
      {/* Outer glow ring */}
      <div className="absolute inset-0 rounded-full border border-primary/10 animate-spin-slow" />
      <div className="absolute inset-6 rounded-full border border-primary/5 animate-spin-slow sm:inset-8" style={{ animationDirection: 'reverse', animationDuration: '18s' }} />

      {/* Central card */}
      <div className="absolute inset-8 flex animate-float-slow flex-col items-center justify-center rounded-3xl border border-line bg-surface-soft p-3 sm:inset-12 sm:p-6">
        {/* House SVG */}
        <svg viewBox="0 0 120 100" className="h-auto w-full max-w-[110px] sm:max-w-[140px]" fill="none">
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

        <div className="mt-2 text-center sm:mt-4">
          <p className="font-display text-[0.65rem] font-bold text-white sm:text-xs">Solar Analysis</p>
          <div className="mt-1 flex items-center justify-center gap-1.5 sm:mt-1.5">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
            <p className="font-mono text-[0.55rem] text-primary sm:text-[0.6rem]">Processing...</p>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute top-1 right-0 animate-float rounded-xl border border-line bg-surface-soft px-2.5 py-1.5 shadow-lg sm:top-4 sm:right-2 sm:px-3 sm:py-2">
        <p className="font-mono text-[0.55rem] font-bold text-primary sm:text-[0.6rem]"><LuSun className="mr-1 inline h-3 w-3" aria-hidden="true" />Solar Ready</p>
      </div>
      <div className="absolute bottom-4 left-0 animate-float-slow rounded-xl border border-line bg-surface-soft px-2.5 py-1.5 shadow-lg sm:bottom-8 sm:px-3 sm:py-2" style={{ animationDelay: '1.5s' }}>
        <p className="font-mono text-[0.55rem] font-bold text-primary sm:text-[0.6rem]"><LuBot className="mr-1 inline h-3 w-3" aria-hidden="true" />AI Analysis</p>
      </div>
    </div>
  );
}

function VisionIllustration() {
  return (
    <div className="relative w-full" aria-hidden="true">
      <div className="soft-card p-5 text-center sm:p-8">
        {/* Solar future visual */}
        <svg viewBox="0 0 200 160" className="h-auto w-full" fill="none">
          {/* Sky */}
          <rect width="200" height="160" rx="16" fill="#0D1424" />

          {/* Ground line */}
          <line x1="0" y1="120" x2="200" y2="120" stroke="#1E293B" strokeWidth="1" />

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