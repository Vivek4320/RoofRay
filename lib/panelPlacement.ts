export type PanelPlacementEstimate = {
  panel: {
    widthM: number;
    lengthM: number;
    areaM2: number;
    assumedPowerW: number;
  };
  roof: {
    mappedAreaM2: number;
    usableAreaM2: number;
    usableAreaFactor: number;
  };
  estimate: {
    panelCount: number;
    systemSizeKw: number;
    annualGenerationKwh: number | null;
  };
  recommendedDirection: string | null;
  recommendation: string;
  limitations: string[];
};

export function estimatePanelPlacement({
  roofAreaM2,
  annualSpecificYieldKwhPerKwp,
  recommendedDirection,
  usableAreaFactor = 0.72,
}: {
  roofAreaM2: number;
  annualSpecificYieldKwhPerKwp: number | null;
  recommendedDirection: string | null;
  usableAreaFactor?: number;
}): PanelPlacementEstimate {
  // Conservative planning assumptions, not an installation design.
  const panelWidthM = 1.134;
  const panelLengthM = 1.722;
  const panelAreaM2 = panelWidthM * panelLengthM;
  const assumedPowerW = 450;
  const usableAreaM2 = Math.max(0, roofAreaM2 * usableAreaFactor);
  const panelCount = Math.max(0, Math.floor(usableAreaM2 / panelAreaM2));
  const systemSizeKw = Number(((panelCount * assumedPowerW) / 1000).toFixed(2));
  const annualGenerationKwh =
    annualSpecificYieldKwhPerKwp === null
      ? null
      : Math.round(systemSizeKw * annualSpecificYieldKwhPerKwp);

  const recommendation = recommendedDirection
    ? `Prioritize roof faces that can place panels toward ${recommendedDirection}, subject to the actual roof slope, structural constraints, access paths, and shading.`
    : "Prioritize the roof face with the strongest unobstructed solar exposure after a physical roof check.";

  return {
    panel: {
      widthM: panelWidthM,
      lengthM: panelLengthM,
      areaM2: Number(panelAreaM2.toFixed(2)),
      assumedPowerW,
    },
    roof: {
      mappedAreaM2: Number(roofAreaM2.toFixed(1)),
      usableAreaM2: Number(usableAreaM2.toFixed(1)),
      usableAreaFactor,
    },
    estimate: {
      panelCount,
      systemSizeKw,
      annualGenerationKwh,
    },
    recommendedDirection,
    recommendation,
    limitations: [
      "Panel count is a planning estimate based on mapped footprint area and a fixed usable-area factor.",
      "It does not model roof setbacks, fire access, vents, parapets, structural loading, panel spacing, or exact roof faces.",
      "Final panel layout and structural/electrical design require a qualified site assessment.",
    ],
  };
}
