const STEPS = [
  {
    n: '01',
    title: 'Tell us about your roof',
    body: 'Describe your roof in plain words — size, shade, your electricity bill. No forms, no dropdowns, no jargon.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'We find your exact spot',
    body: 'RoofRay pinpoints your exact coordinates and reads real solar irradiance data from NASA POWER.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Get a clear verdict',
    body: 'A yes or no on profitability, with panel count, payback period, and monthly savings. Not a spreadsheet to decode.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative bg-background overflow-hidden">
      {/* Decorative diagonal stripe */}
      <div className="absolute inset-0 stripe-bg opacity-30 pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        {/* Section header — asymmetric: left-aligned with max constraint */}
        <div className="mb-12 md:mb-20 max-w-2xl">
          <p className="section-label mb-5">How it works</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Three steps.
            <br />
            <span className="relative inline-block">
              <span className="blue-text">One Conversation</span>
              <svg className="absolute -bottom-6 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
              </svg>
            </span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            No account needed. No city dropdown. Just tell RoofRay about your roof and
            get an answer in minutes.
          </p>
        </div>

        {/* Steps — asymmetric layout: first step big, next two stacked right */}
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
          {/* Step 1 — spans more width, taller */}
          <div className="soft-card solar-rays solar-shimmer group relative overflow-hidden p-6 sm:p-8 lg:col-span-5 lg:row-span-2 lg:p-10">
            {/* Blue accent corner */}
            <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-primary/5 to-transparent rounded-bl-[4rem]" />

            <div className="relative">
              <div className="mb-6 flex items-center gap-4">
                <div className="num-circle text-base h-12 w-12">01</div>
                <span className="font-mono text-xs uppercase tracking-widest text-primary font-semibold">Step One</span>
              </div>

              <h3 className="mb-4 font-display text-2xl font-bold text-muted lg:text-3xl">
                {STEPS[0].title}
              </h3>
              <p className="text-base leading-relaxed text-muted lg:text-lg">
                {STEPS[0].body}
              </p>

              {/* Illustration: chat bubble mockup */}
              <div className="mt-8 rounded-2xl bg-primary/20 p-5">
                <div className="flex gap-3">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-primary-light">
                      <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.783.783 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2。902A41.289 41。289 0 0010 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="rounded-2xl rounded-tl-sm bg-primary/10 px-4 py-3">
                    <p className="text-sm text-white">
                      &quot;I have a 1000 sq ft flat roof in Ahmedabad. My monthly bill is around ₹3,500. There&apos;s a water tank on one corner but otherwise it&apos;s clear.&quot;
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-3">
                  <div className="rounded-2xl rounded-tr-sm bg-primary-dark px-4 py-3">
                    <p className="text-sm text-white">
                      Got it — let me check the sun data for that spot.
                    </p>
                  </div>
                  <div className="h-8 w-8 shrink-0 rounded-full bg-primary-dark flex items-center justify-center">
                    <span className="text-xs font-bold text-white">AI</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — spans remaining width */}
          <div className="soft-card solar-shimmer solar-glow group relative overflow-hidden p-6 sm:p-8 lg:col-span-7 lg:p-10">
            {/* Accent gradient top edge */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-light to-primary-200" />

            <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-10">
              <div className="shrink-0">
                <div className="mb-4 flex items-center gap-3">
                  <div className="num-circle h-10 w-10">02</div>
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-semibold">Step Two</span>
                </div>
                <div className="solar-icon-pulse grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  {STEPS[1].icon}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-display text-2xl font-bold text-muted">
                  {STEPS[1].title}
                </h3>
                <p className="text-base leading-relaxed text-muted">
                  {STEPS[1].body}
                </p>
                {/* Mini data visualization */}
                <div className="mt-6 flex items-end gap-1.5">
                  {[40, 65, 85, 55, 90, 70, 95, 60, 80, 75, 88, 92].map((h, i) => (
                    <div
                      key={i}
                      className="w-3 rounded-t-sm transition-all duration-300 group-hover:opacity-100"
                      style={{
                        height: `${h * 0.4}px`,
                        backgroundColor: i === 6 ? '#3B82F6' : '#1E3A5F',
                        opacity: 0.6 + (i * 0.03),
                      }}
                    />
                  ))}
                  <span className="ml-2 text-[0.65rem] font-mono text-muted">monthly irradiance</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="soft-card solar-shimmer solar-glow group relative overflow-hidden p-6 sm:p-8 lg:col-span-7 lg:p-10">
            <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-10">
              <div className="shrink-0">
                <div className="mb-4 flex items-center gap-3">
                  <div className="num-circle h-10 w-10">03</div>
                  <span className="font-mono text-xs uppercase tracking-widest text-primary font-semibold">Step Three</span>
                </div>
                <div className="solar-icon-pulse grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  {STEPS[2].icon}
                </div>
              </div>
              <div>
                <h3 className="mb-3 font-display text-2xl font-bold text-muted">
                  {STEPS[2].title}
                </h3>
                <p className="text-base leading-relaxed text-muted">
                  {STEPS[2].body}
                </p>
                {/* Mini verdict mockup */}
                <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-[#10B981]/20 bg-[#10B981]/5 px-5 py-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#10B981]/10 text-success">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-muted">Yes, it&apos;s worth it</p>
                    <p className="text-xs text-muted">4.2 year payback · ₹2,180/mo savings</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom diagonal cut */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 60L1440 10V60H0Z" fill="#0B0F1A" />
        </svg>
      </div>
    </section>
  );
}
