"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RoofRayChat from "@/components/RoofRayChat";

const AUTH_ROUTES = new Set(["/login", "/signup", "/reset-password"]);

export default function RoofRayChatGate() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      setIsAuthenticated(Boolean(localStorage.getItem("roofray_access_token")));
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
    if (pathname === "/chat" && !isAuthenticated) {
      router.replace("/login?redirect=/chat");
    }
  }, [pathname, isAuthenticated, router]);

  // Never mount the chat on authentication pages.
  if (AUTH_ROUTES.has(pathname)) return null;

  // RoofRayChat is a dedicated /chat page now.
  // Do not mount it globally on the homepage, footer, about, contact, etc.
  if (pathname !== "/chat") return null;

  // The chat is private and requires an authenticated session.
  if (!isAuthenticated) return null;

  return <RoofRayChat />;
}
