export type RoofRayLocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type RoofRayLocationResult =
  | { ok: true; location: RoofRayLocation }
  | { ok: false; error: string };

declare global {
  interface Window {
    RoofRayLocation?: RoofRayLocation;
  }
}

export function getCurrentRoofRayLocation(): Promise<RoofRayLocationResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({
      ok: false,
      error: 'Location is only available in the browser.',
    });
  }

  if (!('geolocation' in navigator)) {
    return Promise.resolve({
      ok: false,
      error: 'Geolocation is not supported by this browser.',
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: RoofRayLocation = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          accuracy: Number(position.coords.accuracy.toFixed(1)),
          timestamp: position.timestamp,
        };

        window.RoofRayLocation = location;

        window.dispatchEvent(
          new CustomEvent<RoofRayLocation>('roofray_location', {
            detail: location,
          }),
        );

        resolve({ ok: true, location });
      },
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied.',
          2: 'Your location could not be determined.',
          3: 'Location request timed out.',
        };

        resolve({
          ok: false,
          error: messages[error.code] ?? 'Unable to get your location.',
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  });
}
