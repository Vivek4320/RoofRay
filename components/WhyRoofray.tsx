import { LuCircleCheck, LuMapPin, LuMessageCircle } from 'react-icons/lu';

const REASONS = [
  {
    icon: (
      <LuMessageCircle className="h-7 w-7" aria-hidden="true" />
    ),
    title: 'Just talk to it',
    body: 'No sliders, no multi-field forms. Tell RoofRay about your roof the way you\'d tell a friend.',
    color: 'from-primary to-primary-dark',
    bg: 'bg-primary/10',
  },
  {
    icon: (
      <LuMapPin className="h-7 w-7" aria-hidden="true" />
    ),
    title: 'Your exact rooftop',
    body: 'Not city averages — your precise latitude and longitude, with NASA POWER irradiance data.',
    color: 'from-primary-light to-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: (
      <LuCircleCheck className="h-7 w-7" aria-hidden="true" />
    ),
    title: 'A clear yes or no',
    body: 'A direct verdict on profitability, with the full breakdown on request. No decoding required.',
    color: 'from-primary to-primary-dark',
    bg: 'bg-primary/10',
  },
];

export default function WhyRoofRay() {
  return (
    <section id="why" className="relative bg-backgorund overflow-hidden">

      <div className="relative mx-auto max-w-7xl px-6 py-24 lg:px-10 lg:py-32">
        {/* Header */}
        <div className="mb-10 md:mb-16 max-w-2xl">
          <p className="section-label mb-5">Why not a calculator?</p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Those tools ask you
            <br />
            to <span className="relative inline-block">
              <span className="blue-text">already know the answer.</span>
              <svg className="absolute -bottom-6 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8C40 2 80 2 100 6C120 10 160 10 198 4" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
              </svg>
            </span>
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted">
            The national portal, the MNRE rooftop calculator, and ISRO&apos;s app
            are all solid — and all slider-based. RoofRay is the only one that
            lets you describe your roof like you&apos;d describe it to a neighbour.
          </p>
        </div>

        {/* Cards — staggered asymmetric grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {REASONS.map((r, i) => (
            <div
              key={r.title}
              className={`soft-card solar-shimmer solar-glow group relative overflow-hidden p-6 sm:p-8 transition-all duration-300 ${i === 1 ? 'lg:-mt-8' : ''
                }`}
            >
              {/* Top accent gradient */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${r.color}`} />

              {/* Icon */}
              <div className={`mb-6 solar-icon-pulse grid h-14 w-14 place-items-center rounded-2xl ${r.bg} text-primary transition-all duration-300 group-hover:scale-110`}>
                {r.icon}
              </div>

              <h3 className="mb-3 font-display text-xl font-bold text-white">
                {r.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted lg:text-base">
                {r.body}
              </p>

              {/* Decorative corner */}
              <div className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom diagonal cut */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" className="w-full" preserveAspectRatio="none">
          <path d="M0 60L1440 15V60H0Z" fill="#0B0F1A" />
        </svg>
      </div>
    </section>
  );
}
