"use client";

import { useEffect, useMemo, useState } from "react";

type Point = { latitude: number; longitude: number };
type Roof = { polygon?: Point[]; areaM2?: number; dimensionsM?: { width: number; length: number } };
type Obstacle = { id: string; type: string; latitude: number; longitude: number; heightMeters: number; shadowRisk: "high"|"medium"|"low"|"unknown"; distanceMeters: number };
type Shadow = { currentRisk: "high"|"medium"|"low"|"none"; estimatedAffectedDirections: string[]; timeSeries: Array<{ timestamp:string; sunAzimuthDeg:number; sunElevationDeg:number; affectedObstacleCount:number; highRiskObstacleCount:number; risk:string }> };
type Analysis = { roof?: Roof|null; obstacles?: { obstacles: Obstacle[] }; shadow?: Shadow; sunCycle?: { current: { azimuthDeg:number; elevationDeg:number; direction:string; aboveHorizon:boolean } }; panelPlacement?: { estimatedPanelCount:number; systemSizeKwp:number; mappedRoofAreaM2:number; usableRoofAreaM2:number; recommendedDirection:string } };

const riskClass = (risk: string) => risk === "high" ? "bg-red-500" : risk === "medium" ? "bg-amber-400" : "bg-emerald-400";

export default function SolarAnalysisMap() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  useEffect(() => {
    const load = () => {
      try {
        const raw = sessionStorage.getItem("roofray_solar_analysis");
        if (raw) setAnalysis(JSON.parse(raw));
      } catch {}
    };
    load();
    window.addEventListener("roofray_solar_analysis_ready", load);
    return () => window.removeEventListener("roofray_solar_analysis_ready", load);
  }, []);

  const map = useMemo(() => {
    const polygon = analysis?.roof?.polygon ?? [];
    const obstacles = analysis?.obstacles?.obstacles ?? [];
    if (polygon.length < 3) return null;

    const all = [...polygon, ...obstacles.map(o => ({ latitude:o.latitude, longitude:o.longitude }))];
    const minLat = Math.min(...all.map(p=>p.latitude)), maxLat = Math.max(...all.map(p=>p.latitude));
    const minLon = Math.min(...all.map(p=>p.longitude)), maxLon = Math.max(...all.map(p=>p.longitude));
    const padLat = Math.max((maxLat-minLat)*0.12, 0.00008);
    const padLon = Math.max((maxLon-minLon)*0.12, 0.00008);
    const y = (lat:number) => 96 - ((lat-(minLat-padLat))/((maxLat-minLat)+2*padLat))*92;
    const x = (lon:number) => 4 + ((lon-(minLon-padLon))/((maxLon-minLon)+2*padLon))*92;
    const roofPoints = polygon.map(p => `${x(p.longitude)},${y(p.latitude)}`).join(" ");
    return { x, y, roofPoints, obstacles };
  }, [analysis]);

  if (!analysis?.roof?.polygon?.length || !map) return null;

  const shadow = analysis.shadow;
  const current = analysis.sunCycle?.current;

  return (
    <section id="solar-map" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl">
        <div className="border-b border-white/10 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300">RoofRay Site Analysis</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Roof footprint & shadow map</h2>
          <p className="mt-2 text-sm text-slate-400">Mapped building footprint with nearby obstacle shadow-risk indicators. This is a planning estimate, not a measured 3D survey.</p>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-3">
            <svg viewBox="0 0 100 100" className="h-[360px] w-full">
              <defs><pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M 5 0 L 0 0 0 5" fill="none" stroke="rgba(255,255,255,.06)" strokeWidth=".25"/></pattern></defs>
              <rect width="100" height="100" fill="url(#grid)" />
              <polygon points={map.roofPoints} fill="rgba(56,189,248,.14)" stroke="rgba(125,211,252,.95)" strokeWidth="1.1" />
              {map.obstacles.map((o) => (
                <g key={o.id}>
                  <line x1={map.x(o.latitude === o.latitude ? o.longitude : 0)} y1={map.y(o.latitude)} x2={map.x(o.longitude) - Math.cos((analysis.shadow?.timeSeries?.[0]?.sunAzimuthDeg ?? 180) * Math.PI/180) * 5} y2={map.y(o.latitude) + Math.sin((analysis.shadow?.timeSeries?.[0]?.sunAzimuthDeg ?? 180) * Math.PI/180) * 5} stroke="rgba(248,113,113,.32)" strokeWidth=".8" />
                  <circle cx={map.x(o.longitude)} cy={map.y(o.latitude)} r="1.7" className={riskClass(o.shadowRisk).replace("bg-","fill-")} />
                </g>
              ))}
              <text x="5" y="8" fill="rgba(255,255,255,.65)" fontSize="3">N</text>
              <text x="92" y="96" fill="rgba(255,255,255,.45)" fontSize="2.4">OSM footprint</text>
            </svg>
          </div>
          <div className="space-y-3">
            {current && <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs text-slate-400">Current sun</p><p className="mt-1 text-lg font-semibold text-white">{current.direction} · {current.elevationDeg}° elevation</p><p className="text-sm text-slate-400">{current.azimuthDeg}° azimuth</p></div>}
            {shadow && <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs text-slate-400">Shadow risk</p><p className="mt-1 text-lg font-semibold capitalize text-white">{shadow.currentRisk}</p><p className="mt-1 text-sm text-slate-400">{shadow.estimatedAffectedDirections.length ? shadow.estimatedAffectedDirections.join(", ") : "No affected direction in sampled period."}</p></div>}
            {analysis.panelPlacement && <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="text-xs text-slate-400">Panel estimate</p><p className="mt-1 text-lg font-semibold text-white">{analysis.panelPlacement.estimatedPanelCount} panels · {analysis.panelPlacement.systemSizeKwp} kWp</p><p className="text-sm text-slate-400">{analysis.panelPlacement.mappedRoofAreaM2} m² mapped roof · {analysis.panelPlacement.recommendedDirection} recommended</p></div>}
            {shadow?.timeSeries?.length ? <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><p className="mb-3 text-xs text-slate-400">Next 12-hour shadow timeline</p><div className="space-y-2">{shadow.timeSeries.map((s)=><div key={s.timestamp} className="flex items-center justify-between text-xs"><span className="text-slate-500">{new Date(s.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span><span className="text-slate-300">{s.sunElevationDeg}°</span><span className={`rounded-full px-2 py-0.5 text-white ${riskClass(s.risk)}`}>{s.risk}</span></div>)}</div></div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
