// NERVE Engine - Scrape Weather from Open-Meteo API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, REGIONS } from "../_shared/utils.ts";
import type { WeatherData } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { region_id } = await req.json();
    
    if (!region_id || typeof region_id !== "string") {
      return new Response(
        JSON.stringify({ error: "region_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cfg = REGIONS[region_id as keyof typeof REGIONS];
    if (!cfg) {
      return new Response(
        JSON.stringify({ error: "Invalid region_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lng}&hourly=temperature_2m,windspeed_10m,direct_radiation&timezone=${cfg.timezone}&forecast_days=1`;
    
    try {
      const response = await fetch(url, { 
        signal: AbortSignal.timeout(10000) 
      });
      
      if (!response.ok) {
        throw new Error(`Open-Meteo API error: ${response.statusText}`);
      }

      const data = await response.json();
      const hourly = data.hourly || {};
      const temps = hourly.temperature_2m || [];
      const winds = hourly.windspeed_10m || [];
      const solar = hourly.direct_radiation || [];
      const hours = hourly.time || [];

      const nowHour = new Date().getUTCHours();
      const currentTemp = temps[nowHour] ?? temps[0] ?? 10.0;
      const currentWind = winds[nowHour] ?? winds[0] ?? 15.0;
      const currentSolar = solar[nowHour] ?? 0.0;

      const hourlyForecast = Array.from({ length: Math.min(24, temps.length) }, (_, i) => ({
        hour: hours[i] || `${String(i).padStart(2, "0")}:00`,
        temp_c: temps[i] ?? 10.0,
        wind_kmh: winds[i] ?? 15.0,
        solar_wm2: solar[i] ?? 0.0,
      }));

      const result: WeatherData = {
        current_temp_c: currentTemp,
        current_wind_kmh: currentWind,
        current_solar_wm2: currentSolar,
        hourly: hourlyForecast,
      };

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.warn(`Weather scrape failed ${region_id}:`, error);
      // Return default values
      const defaultResult: WeatherData = {
        current_temp_c: 10.0,
        current_wind_kmh: 15.0,
        current_solar_wm2: 0.0,
        hourly: [],
      };
      return new Response(
        JSON.stringify(defaultResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Scrape weather error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
