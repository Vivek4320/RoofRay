'use client';

import Image from "next/image";

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#report', label: 'Sample report' },
  { href: '#why', label: 'Why RoofRay' },
  { href: '#faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export default function Navbar() {
  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
        {/* Logo */}
        <a href="#top" className="flex-shrink-0 transition-transform duration-300 hover:scale-105">
          <Image
            src="/Logo-removebg-preview.png"
            alt="RoofRay Logo"
            width={400}
            height={140}
            priority
            className="h-20 sm:h-20 md:h-24 lg:h-28 w-auto object-contain"
          />
        </a>

        {/* Desktop nav links */}
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link relative rounded-full px-4 py-2 text-sm font-medium text-muted transition-all duration-300 hover:text-primary"
            >
              <span className="relative z-10">{link.label}</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary scale-0 transition-all duration-300" />
            </a>
          ))}
        </nav>

        {/* CTA — visible on all screens */}
        <a href="#top" className="group/nav-btn relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-semibold text-white transition-all duration-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)' }}>
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/nav-btn:translate-x-full" />
          <span className="absolute -inset-1 rounded-full bg-primary/20 opacity-0 blur-sm transition-all duration-500 group-hover/nav-btn:opacity-100 group-hover/nav-btn:inset-[-4px] group-hover/nav-btn:blur-md" />
          <span className="relative z-10">Talk to RoofRay</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="relative z-10 h-4 w-4 transition-all duration-500 group-hover/nav-btn:translate-x-1 group-hover/nav-btn:rotate-[-8deg] group-hover/nav-btn:scale-110">
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
          <span className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover/nav-btn:opacity-100" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E40AF)' }} />
          <span className="absolute inset-0 rounded-full shadow-[0_8px_32px_rgba(37,99,235,0.5)] opacity-0 transition-opacity duration-500 group-hover/nav-btn:opacity-100" />
        </a>
      </div>
    </header>
  );
}
