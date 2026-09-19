import Link from "next/link";

export default function LegalPage() {
  return (
    <main className="min-h-screen bg-[#080C15] text-white px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-blue-400 hover:text-blue-300">← Back to RoofRay</Link>
        <p className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-blue-400">RoofRay</p>
        <h1 className="mt-3 text-4xl font-bold">Privacy Policy</h1>
        <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#0D1421] p-6 sm:p-8">
          <p className="text-base leading-8 text-slate-300">RoofRay may collect account information and rooftop analysis details that you provide to use its services. Information is used to provide, maintain, and improve the service. RoofRay does not display your password in plain text. For questions about privacy, please contact the RoofRay team.</p>
        </div>
      </div>
    </main>
  );
}
