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
  const label = "Ubicacion GPS capturada";

  return { latitude, longitude, label };
}
