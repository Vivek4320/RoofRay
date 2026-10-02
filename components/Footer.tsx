import Link from "next/link";
import { FaEnvelope, FaFacebookF as FaFacebook, FaGithub, FaInstagram, FaLinkedinIn as FaLinkedin } from "react-icons/fa6";
import { LuHeart } from "react-icons/lu";
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
                src="/favicon.ico"
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
                  <Icon className="h-5 w-5 text-slate-300" aria-hidden="true" />
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
            Made with <LuHeart className="mx-1 inline h-3.5 w-3.5 text-red-400" aria-hidden="true" /> for Indian Rooftops
          </p>

        </div>

      </div>
    </footer>
  );
}