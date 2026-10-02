'use client';

import dynamic from 'next/dynamic';

const House3D = dynamic(() => import('./House3D'), { ssr: false });

export default function Hero() {
  return (
    <section id="top" className="relative min-h-screen overflow-hidden  pt-28 md:pt-36">
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
        <div className="grid min-h-0 items-center gap-8 lg:min-h-[calc(100vh-6rem)] lg:grid-cols-[1.15fr_1fr] lg:gap-6">
          {/* Left: Content */}
          <div className="min-w-0 animate-rise lg:-mt-12">
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
          <div className="relative flex min-w-0 flex-col items-center gap-2 animate-rise lg:animate-rise-delayed w-full">
            {/* Background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-blue-600/15 opacity-60 blur-3xl pointer-events-none" />

            {/* 3D House Model */}
            <div className="relative z-10 w-full min-w-0 max-w-[560px]">
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

