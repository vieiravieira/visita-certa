export interface Posicao {
  latitude: number;
  longitude: number;
  precisao: number;
}

/** Pede a localização atual do celular com alta precisão. */
export function pegarLocalizacao(): Promise<Posicao> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Este aparelho não informa localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          precisao: Math.round(p.coords.accuracy),
        }),
      (erro) => {
        if (erro.code === erro.PERMISSION_DENIED)
          reject(new Error("Permissão de localização negada. Libere a localização para este site nas configurações do navegador."));
        else if (erro.code === erro.TIMEOUT)
          reject(new Error("O GPS demorou para responder. Vá para perto de uma janela ou porta e tente de novo."));
        else reject(new Error("Não foi possível obter a localização. Verifique se o GPS está ligado."));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

/** Distância em metros (Haversine) — só para mostrar ao promotor; o servidor recalcula. */
export function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function linkMapa(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

export function formatarDistancia(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}
