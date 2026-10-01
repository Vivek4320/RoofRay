"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    mappls?: {
      Map: new (id: string, options?: Record<string, unknown>) => unknown;
      add3DModel?: (options: { map: unknown }) => void;
      Marker?: new (options: Record<string, unknown>) => {
        remove?: () => void;
      };
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
  const markerRef = useRef<{ remove?: () => void } | null>(null);

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

      // Keep a clear house/location marker on top of the map. The map center
      // alone is easy to lose visually, especially when 3D mode is enabled.
      if (window.mappls.Marker) {
        try {
          markerRef.current = new window.mappls.Marker({
            map,
            position: { lat: latitude, lng: longitude },
            html: '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563eb;border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:16px;line-height:1;color:#fff;">⌂</span></div>',
            width: 34,
            height: 34,
            offset: [0, -17],
            popupOptions: true,
            popupHtml: "Your house / selected location",
          });
        } catch {
          markerRef.current = null;
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
      markerRef.current?.remove?.();
      markerRef.current = null;
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
