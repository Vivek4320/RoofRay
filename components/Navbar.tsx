'use client';

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#report', label: 'Sample report' },
  { href: '#why', label: 'Why RoofRay' },
  { href: '#faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' }
];

export default function Navbar() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [profileName, setProfileName] = useState("Profile");

  useEffect(() => {
    const token = localStorage.getItem("roofray_access_token");
    const loggedIn = Boolean(token);
    setIsLoggedIn(loggedIn);

    const storedUser = localStorage.getItem("roofray_user");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const name =
          user?.user_metadata?.full_name ||
          user?.user_metadata?.name ||
          user?.email?.split("@")[0];

        if (name) setProfileName(name);
      } catch {
        // Ignore invalid local session data.
      }
    }

    // If the user clicked Talk to RoofRay before logging in,
    // open Botpress after the login flow returns to the home page.
    if (loggedIn && sessionStorage.getItem("roofray_pending_chat") === "true") {
      sessionStorage.removeItem("roofray_pending_chat");

      const openChat = () => {
        if (window.botpress?.open) {
          window.botpress.open();
        } else {
          window.botpress?.on?.("webchat:initialized", () => {
            window.botpress?.open?.();
          });
          window.setTimeout(() => {
            window.botpress?.open?.();
          }, 1500);
        }
      };

      window.setTimeout(openChat, 300);
    }
  }, []);

  const handleTalkToRoofRay = (
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();

    // User must be logged in before using RoofRay.
    if (!isLoggedIn) {
      sessionStorage.setItem("roofray_pending_chat", "true");
      window.location.href = "/login?redirect=/";
      return;
    }

    // Logged-in user: open Botpress.
    if (window.botpress?.open) {
      window.botpress.open();
      return;
    }

    const openWhenReady = () => {
      window.botpress?.open?.();
    };

    window.botpress?.on?.("webchat:initialized", openWhenReady);
    window.setTimeout(openWhenReady, 1500);
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
        <a href="#top" className="flex-shrink-0 transition-transform duration-300 hover:scale-105">
          <Image src="/Logo-removebg-preview.png" alt="RoofRay Logo" width={400} height={140} priority className="h-20 sm:h-20 md:h-24 lg:h-28 w-auto object-contain" />
        </a>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="nav-link relative rounded-full px-4 py-2 text-sm font-medium text-muted transition-all duration-300 hover:text-primary">
              <span className="relative z-10">{link.label}</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary scale-0 transition-all duration-300" />
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            id="bp-toggle-chat"
            href="#top"
            onClick={handleTalkToRoofRay}
            className="group/nav-btn relative inline-flex shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 py-2 sm:px-6 sm:py-2.5 text-xs sm:text-sm font-semibold text-white transition-all duration-500 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', boxShadow: '0 4px 20px rgba(37, 99, 235, 0.3)' }}
          >
            <span className="relative z-10">Talk to RoofRay</span>
            <svg viewBox="0 0 20 20" fill="currentColor" className="relative z-10 h-4 w-4 transition-all duration-500 group-hover/nav-btn:translate-x-1 group-hover/nav-btn:rotate-[-8deg] group-hover/nav-btn:scale-110">
              <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" />
            </svg>
          </a>

          {isLoggedIn && (
            <Link
              href="/profile"
              title={profileName}
              aria-label={`Open profile for ${profileName}`}
              className="group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-blue-400/30 bg-[#0D1424]/90 text-blue-300 shadow-lg shadow-blue-500/10 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-300/60 hover:bg-blue-500/15"
            >
              <span className="text-sm font-bold uppercase">{profileName.trim().charAt(0) || "U"}</span>
              <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/5 transition group-hover:ring-blue-300/30" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
