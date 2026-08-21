export type BrowserLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

export type LocationFailure = {
  blocked: boolean;
  message: string;
};

export async function requestBrowserLocation(): Promise<BrowserLocation> {
  if (!("geolocation" in navigator)) {
    throw {
      blocked: true,
      message: "Este navegador no tiene GPS disponible.",
    } satisfies LocationFailure;
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
    });
  }).catch((error: GeolocationPositionError) => {
    const blocked = error.code === error.PERMISSION_DENIED;
    throw {
      blocked,
      message: blocked
        ? "Ubicacion bloqueada. Actívala desde el candado del navegador y vuelve a intentar."
        : "No pudimos obtener tu ubicacion. Revisa tu GPS o conexion.",
    } satisfies LocationFailure;
  });

  const latitude = position.coords.latitude;
  const longitude = position.coords.longitude;
  const label = await resolveLocationLabel(latitude, longitude);

  return { latitude, longitude, label };
}

async function resolveLocationLabel(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`,
      {
        headers: { "Accept-Language": "es" },
      },
    );

    if (!response.ok) {
      return "Ubicacion GPS validada";
    }

    const data = (await response.json()) as {
      address?: Record<string, string | undefined>;
      name?: string;
    };
    const address = data.address ?? {};
    const place = [
      address.road ?? address.neighbourhood ?? address.suburb ?? data.name,
      address.city ?? address.town ?? address.district ?? address.province,
    ]
      .filter(Boolean)
      .slice(0, 2)
      .join(", ");

    return place || "Ubicacion GPS validada";
  } catch {
    return "Ubicacion GPS validada";
  }
}
