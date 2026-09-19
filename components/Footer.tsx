import Link from "next/link";
// Inline SVG icon components to avoid external react-icons dependency
const FaFacebook = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22 12a10 10 0 10-11.5 9.9v-7h-2.2v-2.9h2.2V9.1c0-2.2 1.3-3.4 3.3-3.4.9 0 1.8.1 1.8.1v2h-1c-1 0-1.3.6-1.3 1.2v1.5h2.2l-.4 2.9h-1.8v7A10 10 0 0022 12z" />
  </svg>
);

const FaInstagram = (props: any) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" />
    <path d="M17.5 6.5h.01" />
  </svg>
);

const FaLinkedin = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M4.98 3.5C4.98 4.88 3.86 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1 4.98 2.12 4.98 3.5zM0 8h5v16H0V8zm7.5 0H12v2.2h.1c.6-1.1 2.2-2.2 4.5-2.2C21.9 8 24 10.3 24 15.1V24h-5v-8.1c0-1.9 0-4.4-2.7-4.4-2.7 0-3.1 2.1-3.1 4.2V24h-5V8z" />
  </svg>
);

const FaGithub = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 .5A12 12 0 000 12.6c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.2-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1 .1 1.6.8 2 1.2 1.6-.2 3.3-.8 3.3-3.7 0-.8-.3-1.4-.8-1.9 2.6-.3 5.3-1.3 5.3-5.8 0-1.3-.5-2.3-1.2-3.1.1-.3.5-1.6-.1-3.3 0 0-1-.3-3.3 1.2a11.3 11.3 0 00-6 0C6 2 5 2.3 5 2.3c-.6 1.7-.2 3 .1 3.3-.7.8-1.2 1.8-1.2 3.1 0 4.5 2.7 5.5 5.3 5.8-.4.4-.7 1-.7 2v3c0 .3.2.7.8.6A12 12 0 0012 .5z" />
  </svg>
);

const FaEnvelope = (props: any) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
  </svg>
);

type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

const footerLinks: Record<string, FooterLink[]> = {
  Product: [
    { label: "How it Works", href: "/#how" },
    { label: "Sample Report", href: "/#report" },
    { label: "Why RoofRay", href: "/#why" },
    { label: "AI Chatbot", href: "/#top" },
  ],
  Resources: [
    { label: "FAQ", href: "/#faq" },
    { label: "Data Sources", href: "/#report" },
    { label: "API", href: "/#report" },
    { label: "Documentation", href: "/#faq" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ]
};

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#070B17]">
      <div className="mx-auto max-w-7xl px-6 py-12 sm:py-16 md:py-20">

        {/* Top */}

        <div className="grid gap-10 sm:gap-14 lg:grid-cols-5">

          {/* Brand */}

          <div className="lg:col-span-2">

            <div className="flex items-center">
              <img
                src="/Logo-removebg-preview.png"
                alt="RoofRay Logo"
                className="h-20 sm:h-28 md:h-36 w-auto object-contain"
              />
            </div>

            <p className="max-w-sm leading-7 sm:leading-8 text-sm sm:text-base text-slate-400">
              AI-powered rooftop analysis that helps homeowners discover
              their solar potential, savings, and payback period using
              trusted location-based data.
            </p>

            <div className="mt-6 sm:mt-8 flex flex-wrap gap-3 sm:gap-4">

              {[
                { Icon: FaFacebook, href: "https://www.facebook.com/", label: "Facebook" },
                { Icon: FaInstagram, href: "https://www.instagram.com/", label: "Instagram" },
                { Icon: FaLinkedin, href: "https://www.linkedin.com/in/vivek-pankhaniya/", label: "LinkedIn" },
                { Icon: FaGithub, href: "https://github.com/Vivek4320/RoofRay", label: "GitHub" },
                { Icon: FaEnvelope, href: "mailto:hello@roofray.in", label: "Email RoofRay" },
              ].map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-lg sm:rounded-xl border border-white/10 bg-white/5 transition hover:border-blue-500 hover:bg-blue-500/10"
                >
                  <Icon className="h-5 w-5 text-slate-300" />
                </a>
              ))}

            </div>

          </div>

          {/* Links */}

          {Object.entries(footerLinks).map(([title, links]) => (

            <div key={title}>

              <h3 className="mb-6 text-lg font-semibold text-white">
                {title}
              </h3>

              <ul className="space-y-3 sm:space-y-4">

                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm sm:text-base text-slate-400 transition hover:text-blue-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}

              </ul>

            </div>

          ))}

        </div>

        {/* Divider */}

        <div className="my-10 h-px bg-white/10" />

        <div className="mt-6 sm:mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs sm:text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-blue-400">
            Privacy Policy
          </Link>
          <span className="mx-2">|</span>
          <Link href="/terms" className="hover:text-blue-400">
            Terms of Service
          </Link>
          <span className="mx-2">|</span>
          <Link href="/cookies" className="hover:text-blue-400">
            Cookies
          </Link>
          <span className="mx-2">|</span>
          <Link href="/disclaimer" className="hover:text-blue-400">
            Disclaimer
          </Link>
        </div>

        {/* Bottom */}

        <div className="mt-6 sm:mt-10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 border-t border-white/10 pt-6 sm:pt-8 text-xs sm:text-sm text-slate-500">

          <p>
            © 2026 RoofRay. All rights reserved.
          </p>

          <p>
            Made with ❤️ for Indian Rooftops
          </p>

        </div>

      </div>
    </footer>
  );
}