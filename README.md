# RoofRay — Solar Feasibility Chatbot (Landing Page)

A Next.js + TypeScript + Tailwind CSS marketing site for the Location-Based
Solar Feasibility AI Chatbot project.

## Design

- **Palette**: near-black ink background, electric blue primary, sky-blue
  data accent, white text — no accent colors outside that family.
- **Type**: Space Grotesk (display), Inter (body), IBM Plex Mono (every
  number/coordinate/reading — the product's whole pitch is turning fuzzy
  talk into exact data, so the type system makes that visible).
- **Signature element**: the hero's animated roof-panel grid + coordinate
  "lock-on" readout, mirroring the real geolocation → irradiance flow
  described in the project doc.

## Run it locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Structure

```
app/
  layout.tsx      fonts + metadata
  page.tsx         assembles all sections
  globals.css      base styles, focus states, reduced-motion handling
components/
  Nav.tsx
  Hero.tsx             signature coordinate-lock + panel grid
  HowItWorks.tsx       5-step real sequence + chat mockup
  ReportPreview.tsx    mock feasibility report, data-card style
  TechStack.tsx        NASA POWER / Open-Meteo / Nominatim / PVGIS strip
  Differentiator.tsx   comparison vs PM Surya Ghar / MNRE / ISRO tools
  CTASection.tsx
  Footer.tsx
```

All copy is placeholder/demo data (sample coordinates, sample bill,
sample report figures) — wire up the real Claude API + NASA POWER +
Open-Meteo calls described in the project doc to make it live.