'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#report', label: 'Sample report' },
  { href: '#why', label: 'Why RoofRay' },
  { href: '#faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' }
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  return (
    <header
      className="absolute top-0 left-0 right-0 z-50"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <a
          href="#top"
          className="flex items-center transition-transform duration-300 hover:scale-105"
        >
          <Image
            src="/Logo-removebg-preview.png"
            alt="RoofRay Logo"
            width={400}
            height={140}
            priority
            className="h-24 w-auto object-contain"
          />
        </a>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link relative rounded-full px-4 py-2 text-sm font-medium text-muted transition-all duration-300 hover:text-primary"
            >
              <span className="relative z-10">{link.label}</span>
              {/* Bottom accent dot */}
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary scale-0 transition-all duration-300" />
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <a href="#top" className="group/nav-btn relative inline-flex items-center gap-2.5 overflow-hidden rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-all duration-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)' }}>
          {/* Shimmer sweep */}
          <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/nav-btn:translate-x-full" />
          {/* Sun glow ring */}
          <span className="absolute -inset-1 rounded-full bg-primary/20 opacity-0 blur-sm transition-all duration-500 group-hover/nav-btn:opacity-100 group-hover/nav-btn:inset-[-4px] group-hover/nav-btn:blur-md" />
          <span className="relative z-10">Talk to RoofRay</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="relative z-10 h-4 w-4 transition-all duration-500 group-hover/nav-btn:translate-x-1 group-hover/nav-btn:rotate-[-8deg] group-hover/nav-btn:scale-110">
            <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
          </svg>
          {/* Gradient shift on hover */}
          <span className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-500 group-hover/nav-btn:opacity-100" style={{ background: 'linear-gradient(135deg, #1D4ED8, #1E40AF)' }} />
          {/* Shadow boost */}
          <span className="absolute inset-0 rounded-full shadow-[0_8px_32px_rgba(37,99,235,0.5)] opacity-0 transition-opacity duration-500 group-hover/nav-btn:opacity-100" />
        </a>

        {/* Mobile hamburger */}
        <button
          className="flex h-10 w-10 items-center justify-center rounded-xl text-ink transition-all duration-200 hover:bg-primary-50 hover:text-primary active:scale-95 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {
        mobileOpen && (
          <div className="fixed inset-0 top-[65px] z-40 bg-surface/95 backdrop-blur-xl lg:hidden">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-2 px-6 pt-8">
              {NAV_LINKS.map((link, i) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="group/mobile-link relative overflow-hidden rounded-2xl px-5 py-4 text-lg font-medium text-ink transition-all duration-300 hover:bg-primary-50 hover:text-primary hover:pl-7"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <span className="relative z-10">{link.label}</span>
                  {/* Solar shimmer on mobile links */}
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary/5 to-transparent transition-transform duration-500 group-hover/mobile-link:translate-x-full" />
                </a>
              ))}
              <a
                href="#top"
                onClick={() => setMobileOpen(false)}
                className="group/mobile-btn relative mt-4 flex items-center justify-center gap-2.5 overflow-hidden rounded-full px-6 py-4 text-base font-semibold text-white transition-all duration-500 hover:shadow-2xl"
                style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)' }}
              >
                {/* Shimmer */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover/mobile-btn:translate-x-full" />
                <span className="relative z-10">Talk to RoofRay</span>
                <svg viewBox="0 0 20 20" fill="currentColor" className="relative z-10 h-4 w-4 transition-all duration-500 group-hover/mobile-btn:translate-x-1 group-hover/mobile-btn:scale-110">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
                </svg>
              </a>
            </nav>
          </div>
        )
      }
    </header >
  );
}
