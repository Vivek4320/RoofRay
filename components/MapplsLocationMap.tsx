"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    mappls?: {
      Map: new (id: string, options?: Record<string, unknown>) => unknown;
      Marker?: new (options: {
        map: unknown;
        position: { lat: number; lng: number };
        fitbounds?: boolean;
        icon_url?: string;
      }) => unknown;
      add3DModel?: (options: { map: unknown }) => void;
    };
    initRoofRayMappls?: () => void;
  }
}

type Props = {
  latitude: number;
  longitude: number;
  className?: string;
};

const SCRIPT_ID = "roofray-mappls-sdk";

export default function MapplsLocationMap({ latitude, longitude, className = "h-[240px] w-full" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPPLS_API_KEY;
    if (!token) return;

    let cancelled = false;

    const renderMap = () => {
      if (cancelled || !containerRef.current || !window.mappls?.Map) return;

      containerRef.current.innerHTML = "";
      const id = "roofray-mappls-" + Math.random().toString(36).slice(2);
      containerRef.current.id = id;

      const map = new window.mappls.Map(id, {
        center: [latitude, longitude],
        zoom: 18,
        zoomControl: true,
        location: false,
      });

      mapRef.current = map;

      // Always mark the exact GPS point supplied by RoofRay. The marker is
      // deliberately independent of the building dataset so the user can see
      // "this is my house" even when the map provider has not mapped the
      // building footprint yet.
      if (window.mappls.Marker) {
        try {
          new window.mappls.Marker({
            map,
            position: { lat: latitude, lng: longitude },
            fitbounds: false,
            icon_url: "https://apis.mappls.com/map_v3/1.png",
          });
        } catch {
          // Keep the map usable if marker rendering is unavailable.
        }
      }

      if (window.mappls.add3DModel) {
        try {
          window.mappls.add3DModel({ map });
        } catch {
          // Keep the normal Mappls map if 3D buildings are unavailable for this view.
        }
      }
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.mappls?.Map) renderMap();
      else existing.addEventListener("load", renderMap, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.async = true;
      script.defer = true;
      script.src = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${encodeURIComponent(token)}`;
      script.addEventListener("load", renderMap, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  if (!process.env.NEXT_PUBLIC_MAPPLS_API_KEY) {
    return (
      <div className={`${className} flex items-center justify-center bg-[#0B1220] text-center text-xs text-slate-500`}>
        Mappls API key is not configured.
      </div>
    );
  }

  return <div ref={containerRef} className={className} aria-label="RoofRay Mappls 3D location map" />;
}
