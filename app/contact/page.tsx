import Link from 'next/link';
import { LuArrowLeft, LuClock, LuMail, LuMapPin, LuPhone } from 'react-icons/lu';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background text-white">
      <section className="px-6 pb-16 pt-8 md:pt-10">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-5 py-3 text-sm font-medium text-blue-400 transition hover:bg-blue-500 hover:text-white">
            <LuArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>
        </div>
        <div className="mx-auto max-w-7xl pt-16 text-center md:pt-20">
          <p className="section-label mb-5 justify-center">Let&apos;s talk</p>
          <h1 className="font-display text-5xl font-bold md:text-6xl">
            Contact RoofRay
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400">
            Have questions about solar analysis or RoofRay? We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[#0E1628] p-8">
            <h2 className="mb-8 text-3xl font-bold">Contact Information</h2>

            <div className="space-y-8">
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-blue-400"><LuMail className="h-4 w-4" aria-hidden="true" />Email</h3>
                <p className="mt-2 text-slate-300">support@roofray.ai</p>
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-semibold text-blue-400"><LuPhone className="h-4 w-4" aria-hidden="true" />Phone</h3>
                <p className="mt-2 text-slate-300">+91 98765 43210</p>
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-semibold text-blue-400"><LuMapPin className="h-4 w-4" aria-hidden="true" />Location</h3>
                <p className="mt-2 text-slate-300">Jamnagar, Gujarat, India</p>
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-semibold text-blue-400"><LuClock className="h-4 w-4" aria-hidden="true" />Working Hours</h3>
                <p className="mt-2 text-slate-300">Monday - Saturday</p>
                <p className="text-slate-300">9:00 AM - 6:00 PM</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0E1628] p-8">
            <h2 className="mb-8 text-3xl font-bold">Send us a Message</h2>

            <form className="space-y-5">
              <input
                type="text"
                placeholder="Your Name"
                className="w-full rounded-xl border border-white/10 bg-[#101B31] px-5 py-4 outline-none transition focus:border-blue-500"
              />

              <input
                type="email"
                placeholder="Email Address"
                className="w-full rounded-xl border border-white/10 bg-[#101B31] px-5 py-4 outline-none transition focus:border-blue-500"
              />

              <input
                type="text"
                placeholder="Subject"
                className="w-full rounded-xl border border-white/10 bg-[#101B31] px-5 py-4 outline-none transition focus:border-blue-500"
              />

              <textarea
                rows={6}
                placeholder="Write your message..."
                className="w-full rounded-xl border border-white/10 bg-[#101B31] px-5 py-4 outline-none transition focus:border-blue-500"
              />

              <button className="w-full rounded-xl bg-blue-600 py-4 text-lg font-semibold transition hover:bg-blue-700">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

    </main>
  );
}