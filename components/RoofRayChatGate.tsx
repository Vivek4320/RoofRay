"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RoofRayChat from "@/components/RoofRayChat";

const AUTH_ROUTES = new Set(["/login", "/signup", "/reset-password"]);

export default function RoofRayChatGate() {
  const pathname = usePathname();
  const router = useRouter();

  // null = session check has not completed yet.
  // This prevents /chat from redirecting to /login before localStorage is read.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSession = () => {
      const token = localStorage.getItem("roofray_access_token");
      setIsAuthenticated(Boolean(token));
    };

    checkSession();

    window.addEventListener("roofray:session-changed", checkSession);
    window.addEventListener("storage", checkSession);

    return () => {
      window.removeEventListener("roofray:session-changed", checkSession);
      window.removeEventListener("storage", checkSession);
    };
  }, [pathname]);

  useEffect(() => {
    // Wait until the client-side session check has finished.
    if (isAuthenticated === null) return;

    if (pathname === "/chat" && !isAuthenticated) {
      router.replace("/login?redirect=/chat");
    }
  }, [pathname, isAuthenticated, router]);

  // Never mount the chat on authentication pages.
  if (AUTH_ROUTES.has(pathname)) return null;

  // Chat is only a dedicated /chat page.
  if (pathname !== "/chat") return null;

  // While checking the session, render nothing instead of redirecting.
  if (isAuthenticated === null) return null;

  // Logged-out users cannot access the chatbot.
  if (!isAuthenticated) return null;

  return <RoofRayChat />;
}
