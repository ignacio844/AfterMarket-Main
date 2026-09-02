"use client";

import { useEffect, useState } from "react";

type WeatherTheme = "sunny" | "cloudy" | "rainy" | "night" | "neutral";

type WeatherData = {
  temperature: number | null;
  condition: string;
  theme: WeatherTheme;
};

const fallbackWeather: WeatherData = {
  temperature: null,
  condition: "Buenos Aires",
  theme: "neutral",
};

function WeatherArtwork({ theme }: { theme: WeatherTheme }) {
  if (theme === "sunny") {
    return (
      <svg viewBox="0 0 120 120" className="weather-art weather-art-sun" aria-hidden="true">
        <g className="weather-sun-rays" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="5">
          <circle cx="60" cy="60" r="25" fill="currentColor" stroke="none" />
          <path d="M60 8v13M60 99v13M8 60h13M99 60h13M23 23l9 9M88 88l9 9M97 23l-9 9M32 88l-9 9" />
        </g>
      </svg>
    );
  }

  if (theme === "night") {
    return (
      <svg viewBox="0 0 120 120" className="weather-art weather-art-night" aria-hidden="true">
        <path className="weather-moon" d="M82 84A38 38 0 0 1 48 24a39 39 0 1 0 45 51 37 37 0 0 1-11 9Z" fill="currentColor" />
        <circle className="weather-star weather-star-one" cx="87" cy="25" r="3" fill="currentColor" />
        <circle className="weather-star weather-star-two" cx="105" cy="47" r="2" fill="currentColor" />
        <circle className="weather-star weather-star-three" cx="71" cy="13" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (theme === "cloudy" || theme === "rainy") {
    return (
      <svg viewBox="0 0 130 120" className="weather-art weather-art-rain" aria-hidden="true">
        <path className="weather-cloud-back" d="M39 71c-16 0-27-10-27-24 0-13 10-23 24-24C42 11 54 5 68 5c22 0 39 15 42 35 8 3 13 10 13 19 0 12-10 22-23 22H39Z" fill="currentColor" />
        <path className="weather-cloud-front" d="M18 89C8 89 0 81 0 71c0-9 7-17 17-18 4-10 14-16 26-16 16 0 29 11 31 26 7 2 12 8 12 15 0 9-8 17-17 17H18Z" fill="currentColor" />
        {theme === "rainy" &&
          [26, 45, 64, 83, 102].map((x, index) => (
            <path key={x} className={`weather-rain-drop weather-rain-drop-${index + 1}`} d={`M${x} 87l-8 18`} fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="4" />
          ))}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className="weather-art weather-art-neutral" aria-hidden="true">
      <circle cx="60" cy="60" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="60" cy="60" r="22" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function WeatherClockCard({ time }: { time: string }) {
  const [weather, setWeather] = useState<WeatherData>(fallbackWeather);

  useEffect(() => {
    let active = true;

    async function updateWeather() {
      try {
        const response = await fetch("/api/weather");
        if (!response.ok) throw new Error("Weather unavailable");
        const data = (await response.json()) as WeatherData;
        if (active) setWeather(data);
      } catch {
        if (active) setWeather(fallbackWeather);
      }
    }

    void updateWeather();
    const timer = window.setInterval(updateWeather, 30 * 60 * 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <aside
      className={`weather-clock-card weather-theme-${weather.theme} group relative h-48 min-h-48 overflow-hidden rounded-[28px] border shadow-[0_20px_50px_-38px_rgba(14,40,65,0.45)]`}
      aria-label={`Hora local: ${time}. ${weather.condition}${weather.temperature === null ? "" : `, ${weather.temperature} grados`}`}
    >
      <div className="weather-card-glow" aria-hidden="true" />
      <WeatherArtwork theme={weather.theme} />

      <div className="relative z-10 flex h-full flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <span className="weather-card-muted text-[10px] font-bold uppercase tracking-[0.18em]">Hora local</span>
          <span className="weather-status-dot size-2 rounded-full" />
        </div>

        <p className="weather-card-time mt-5 font-mono text-[2.65rem] font-semibold leading-none tracking-[-0.07em]">
          {time}
        </p>

        <div className="mt-auto min-w-0 pr-16">
          <p className="weather-card-condition truncate text-xs font-semibold">{weather.condition}</p>
          <p className="weather-card-muted mt-1 text-[10px]">
            {weather.temperature === null ? "Buenos Aires" : `${weather.temperature} °C · Buenos Aires`}
          </p>
        </div>
      </div>
    </aside>
  );
}
