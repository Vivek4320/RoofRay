'use client';

import dynamic from 'next/dynamic';

const House3D = dynamic(() => import('./House3D'), { ssr: false });

export default function Hero() {
  return (
    <section id="top" className="relative min-h-screen overflow-hidden bg-background pt-28 md:pt-36">
      {/* Background �� layered solar effects */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Large radial blue glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/3 h-[700px] w-[700px] rounded-full bg-primary/5 opacity-60 blur-[100px]" />

        {/* Rotating sun rings */}
        <div className="absolute top-16 right-[8%] h-[320px] w-[320px] opacity-[0.07]">
          <div className="absolute inset-0 rounded-full border-2 border-primary animate-spin-slow" />
          <div className="absolute inset-8 rounded-full border border-primary animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '18s' }} />
          <div className="absolute inset-16 rounded-full border border-primary animate-spin-slow" style={{ animationDuration: '22s' }} />
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary/30" />
        </div>

        {/* Second smaller ring cluster — bottom left */}
        <div className="absolute bottom-20 left-[5%] h-[180px] w-[180px] opacity-[0.04]">
          <div className="absolute inset-0 rounded-full border border-primary animate-spin-slow" style={{ animationDuration: '20s' }} />
          <div className="absolute inset-6 rounded-full border border-primary animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
        </div>

        {/* Diagonal stripe pattern */}
        <div className="absolute inset-0 stripe-bg opacity-40" />

        {/* Floating particles */}
        <div className="absolute top-32 right-[18%] h-2 w-2 rounded-full bg-primary/20 animate-float" />
        <div className="absolute top-52 right-[28%] h-1.5 w-1.5 rounded-full bg-primary/30 animate-float-slow" />
        <div className="absolute bottom-36 left-[12%] h-2 w-2 rounded-full bg-primary/15 animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[45%] left-[30%] h-1 w-1 rounded-full bg-primary/25 animate-float-slow" style={{ animationDelay: '4s' }} />
        <div className="absolute top-24 left-[15%] h-1.5 w-1.5 rounded-full bg-primary/10 animate-float" style={{ animationDelay: '1s' }} />

        {/* Subtle grid dots */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle, #3B82F6 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10">
        <div className="grid min-h-[calc(100vh-6rem)] items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          {/* Left: Content */}
          <div className="animate-rise lg:-mt-12">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 transition-all duration-300 hover:bg-primary/15 hover:border-primary/40 hover:shadow-sm cursor-default">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-xs font-semibold text-primary"> Location-Based Solar Intelligence</span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-[4.2rem] font-extrabold leading-[1.05] tracking-tight text-white">
              Location Based
              <br />
              Solar Feasibility {' '}
              <span className="relative inline-block">
                <span className="blue-text">AI-Chatbot</span>
                <svg className="absolute -bottom-4 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
                </svg>
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-5 sm:mt-7 max-w-lg text-base sm:text-lg leading-relaxed text-muted lg:text-xl">
              AI-powered rooftop analysis that uses your{" "}
              <span className="font-semibold text-primary">
                exact location
              </span>
              ,{" "}
              <span className="font-semibold text-primary">
                sunlight data
              </span>
              ,{" "}
              <span className="font-semibold text-primary">
                roof conditions
              </span>
              , and electricity usage to calculate{" "}
              <span className="font-semibold text-primary">
                real solar savings
              </span>{" "}
              before you invest.
            </p>
          </div>

          {/* Right: Interactive 3D Solar House Model */}
          <div className="relative flex flex-col items-center gap-2 animate-rise lg:animate-rise-delayed w-full">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-600/15 opacity-60 blur-3xl pointer-events-none" />

            {/* 3D House Model */}
            <div className="w-full max-w-[560px] relative z-10">
              <House3D />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricRow({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="font-mono text-[0.7rem] text-muted/60">{sub}</p>
      </div>
      <span className={`font-display text-lg font-bold ${highlight ? 'blue-text' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.06 1.06l1.06 1.06z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 01.968-.431l5.25 1.678a.75.75 0 01.431.97l-1.678 5.25a.75.75 0 11-1.4-.537l1.154-3.717-5.732 5.732a2 2 0 01-2.828 0L5.597 10.4l-3.717 1.154a.75.75 0 01-.537-1.4l5.25-1.678a.75.75 0 01.43.97L3.768 14.23a2 2 0 002.828 0l8.624-8.624a2 2 0 000-2.828l-.001-.001z" clipRule="evenodd" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zM6.75 6a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zM6.75 9a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clipRule="evenodd" />
    </svg>
  );
}
