import Solar3DViewer from "@/components/Solar3DViewer";

export default function Solar3DPage() {
  return (
    <main className="min-h-screen bg-[#050912]" data-roofray-map-engine="maplibre-satellite">
      <Solar3DViewer />
    </main>
  );
}
