import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#070B17] text-white">

      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-blue-400 transition hover:bg-blue-500 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>

          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="pt-12 pb-16 px-6">
        <div className="max-w-7xl mx-auto text-center">

          <h1 className="text-5xl md:text-6xl font-bold">
            Contact RoofRay
          </h1>

          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto">
            Have questions about solar analysis or RoofRay?
            We'd love to hear from you.
          </p>

        </div>
      </section>

      {/* Contact Section */}

      <section className="pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-10">

          {/* Left Side */}

          <div className="rounded-3xl border border-white/10 bg-[#0E1628] p-8">

            <h2 className="text-3xl font-bold mb-8">
              Contact Information
            </h2>

            <div className="space-y-8">

              <div>
                <h3 className="text-blue-400 font-semibold">
                  📧 Email
                </h3>
                <p className="text-slate-300 mt-2">
                  support@roofray.ai
                </p>
              </div>

              <div>
                <h3 className="text-blue-400 font-semibold">
                  📞 Phone
                </h3>
                <p className="text-slate-300 mt-2">
                  +91 98765 43210
                </p>
              </div>

              <div>
                <h3 className="text-blue-400 font-semibold">
                  📍 Location
                </h3>
                <p className="text-slate-300 mt-2">
                  Jamnagar, Gujarat, India
                </p>
              </div>

              <div>
                <h3 className="text-blue-400 font-semibold">
                  ⏰ Working Hours
                </h3>
                <p className="text-slate-300 mt-2">
                  Monday - Saturday
                </p>
                <p className="text-slate-300">
                  9:00 AM - 6:00 PM
                </p>
              </div>

            </div>

          </div>

          {/* Right Side */}

          <div className="rounded-3xl border border-white/10 bg-[#0E1628] p-8">

            <h2 className="text-3xl font-bold mb-8">
              Send us a Message
            </h2>

            <form className="space-y-5">

              <input
                type="text"
                placeholder="Your Name"
                className="w-full rounded-xl bg-[#101B31] border border-white/10 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                type="email"
                placeholder="Email Address"
                className="w-full rounded-xl bg-[#101B31] border border-white/10 px-5 py-4 outline-none focus:border-blue-500"
              />

              <input
                type="text"
                placeholder="Subject"
                className="w-full rounded-xl bg-[#101B31] border border-white/10 px-5 py-4 outline-none focus:border-blue-500"
              />

              <textarea
                rows={6}
                placeholder="Write your message..."
                className="w-full rounded-xl bg-[#101B31] border border-white/10 px-5 py-4 outline-none focus:border-blue-500"
              />

              <button
                className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold transition hover:bg-blue-700"
              >
                Send Message
              </button>

            </form>

          </div>

        </div>
      </section>

    </main>
  );
}