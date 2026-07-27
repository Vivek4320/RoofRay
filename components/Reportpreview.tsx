const METRICS = [
  { label: 'System size', value: '9.1 kW', sub: '26 panels', icon: '⚡' },
  { label: 'Est. generation', value: '38.6 units', sub: 'per day, avg.', icon: '☀️' },
  { label: 'Investment', value: '₹6,18,000', sub: 'before subsidy', icon: '💰' },
  { label: 'Monthly savings', value: '₹2,180', sub: 'at current tariff', icon: '📉' },
  { label: 'Payback period', value: '4.2 yrs', sub: 'vs 25-yr panel life', icon: '⏱️' },
  { label: 'Sun-hours', value: '5.4 / day', sub: 'long-term avg, this point', icon: '🌤️' },
];

export default function ReportPreview() {
  return (
    <section id="report" className="relative bg-background overflow-hidden py-24 lg:py-32">

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        {/* Header — asymmetric: wide headline + narrow description */}
        <div className="mb-16 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-end">
          <div>
            <p className="section-label mb-5">The output</p>
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              A verdict,
              <br />
              <span className="relative inline-block">
              <span className="blue-text">not a spreadsheet</span>
              <svg className="absolute -bottom-6 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
              </svg>
            </span>
            </h2>
          </div>
          <p className="max-w-sm text-base leading-relaxed text-muted lg:text-lg">
            Every number below is tied to your coordinates and your bill — no
            city-wide estimate standing in for your actual roof.
          </p>
        </div>

        {/* Report card — asymmetric layout with offset */}
        <div className="relative">
          {/* Background shadow card (offset) */}
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-3xl bg-primary/5 opacity-40" />

          <div className="solar-rays relative overflow-hidden rounded-3xl border border-primary/20 shadow-xl">
            {/* Header bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-primary/20 px-6 py-4 lg:px-8">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                </span>
                <span className="font-mono text-xs text-muted">
                  report_jamnagar_2026-07-24.json
                </span>
              </div>
              <span className="rounded-full bg-success/10 px-4 py-1.5 font-mono text-[0.72rem] font-semibold text-success border border-success/20">
                PROFITABLE ✓
              </span>
            </div>

            {/* Metrics grid — asymmetric 3-col with varied card sizes */}
            <div className="grid grid-cols-2 divide-x divide-y divide-primary/20 lg:grid-cols-3">
              {METRICS.map((m, i) => (
                <div
                  key={m.label}
                  className="group p-6 lg:p-8 transition-all duration-300 hover:bg-primary/5"
                >
                  <span className="text-xl mb-3 block">{m.icon}</span>
                  <p className="section-label !text-[0.65rem] !gap-1.5 mb-2 !before:w-3">{m.label}</p>
                  <p className={`font-display text-2xl font-bold lg:text-3xl transition-colors duration-300 ${
                    i === 4 ? 'blue-text' : 'text-muted group-hover:text-primary'
                  }`}>
                    {m.value}
                  </p>
                  <p className="mt-1.5 font-mono text-[0.72rem] text-muted">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="border-t border-primary/20 px-6 py-4 lg:px-8">
              <p className="font-mono text-xs leading-relaxed text-muted">
                Forecast window: next 14 days, Open-Meteo · Irradiance baseline:
                NASA POWER · Subsidy slab not yet applied — ask for PM Surya Ghar
                estimate
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
