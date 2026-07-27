export default function CTASection() {
  return (
    <section id="waitlist" className="relative overflow-hidden">
      {/* Blue gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-dark to-ink" />

      {/* Decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-[10%] h-64 w-64 rounded-full bg-white opacity-5 blur-3xl" />
        <div className="absolute bottom-10 right-[10%] h-48 w-48 rounded-full bg-white opacity-5 blur-3xl" />
        {/* Floating dots */}
        <div className="absolute top-20 right-[20%] h-2 w-2 rounded-full bg-white/20 animate-float" />
        <div className="absolute bottom-32 left-[15%] h-1.5 w-1.5 rounded-full bg-white/30 animate-float-slow" />
        <div className="absolute top-1/2 right-[30%] h-2.5 w-2.5 rounded-full bg-white/10 animate-float" style={{ animationDelay: '3s' }} />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-24 text-center lg:px-10 lg:py-32">
        {/* Icon */}
        <div className="mx-auto mb-8 grid h-16 w-16 place-items-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-white" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        </div>

        <p className="mb-5 font-mono text-xs uppercase tracking-[0.15em] text-white/60 font-semibold">
          Before you spend a rupee
        </p>

        <h2 className="font-display text-4xl font-extrabold tracking-tight text-white md:text-5xl">
          Ask your roof
          <br />
          a straight question.
        </h2>

        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/70 lg:text-lg">
          No account, no dropdown of cities. Just tell RoofRay where you are and
          how big your bill is.
        </p>

        {/* Email form */}
        <form className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row">
          <label htmlFor="email-cta" className="sr-only">Email address</label>
          <input
            id="email-cta"
            type="email"
            placeholder="you@example.com"
            className="flex-1 rounded-full border border-white/20 bg-white/10 px-6 py-4 text-sm text-white placeholder:text-white/40 focus:border-white focus:ring-2 focus:ring-white/20 focus:outline-none backdrop-blur-sm transition"
            required
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-white px-8 py-4 text-sm font-bold text-primary transition hover:bg-white/90 hover:shadow-lg hover:shadow-white/20"
          >
            Get early access
            <svg viewBox="0 0 20 20" fill="currentColor" className="ml-1.5 inline h-4 w-4">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </button>
        </form>

        <p className="mt-6 text-xs text-white/40">
          No spam. No account needed. Just early access.
        </p>
      </div>
    </section>
  );
}
