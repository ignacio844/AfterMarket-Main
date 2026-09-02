type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
  };
};

function describeWeather(code: number) {
  if (code === 0) return "Despejado";
  if (code <= 2) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if (code === 45 || code === 48) return "Con neblina";
  if (code >= 51 && code <= 57) return "Llovizna";
  if (code >= 61 && code <= 67) return "Lluvia";
  if (code >= 71 && code <= 77) return "Nieve";
  if (code >= 80 && code <= 82) return "Chaparrones";
  if (code >= 85 && code <= 86) return "Nevadas";
  if (code >= 95) return "Tormentas";
  return "Clima actual";
}

function selectTheme(code: number, isDay: boolean) {
  if ((code >= 51 && code <= 67) || (code >= 71 && code <= 86) || code >= 95) return "rainy" as const;
  if (!isDay) return "night" as const;
  if (code === 0 || code === 1) return "sunny" as const;
  return "cloudy" as const;
}

export async function GET() {
  try {
    const params = new URLSearchParams({
      latitude: "-34.6037",
      longitude: "-58.3816",
      current: "temperature_2m,weather_code,is_day",
      timezone: "America/Argentina/Buenos_Aires",
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      next: { revalidate: 1800 },
    });

    if (!response.ok) throw new Error("Weather service unavailable");

    const data = (await response.json()) as OpenMeteoResponse;
    const temperature = data.current?.temperature_2m;
    const weatherCode = data.current?.weather_code;
    const isDay = data.current?.is_day === 1;

    if (typeof temperature !== "number" || typeof weatherCode !== "number") {
      throw new Error("Incomplete weather response");
    }

    return Response.json({
      temperature: Math.round(temperature),
      condition: describeWeather(weatherCode),
      theme: selectTheme(weatherCode, isDay),
    });
  } catch {
    return Response.json({ temperature: null, condition: "Clima no disponible", theme: "neutral" }, { status: 503 });
  }
}
