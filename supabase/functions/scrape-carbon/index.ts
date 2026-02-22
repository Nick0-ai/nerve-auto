// NERVE Engine - Scrape Carbon Intensity
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, estimateCarbonFromWeather, REGIONS } from "../_shared/utils.ts";
import type { CarbonData } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { region_id, weather_data } = await req.json();
    
    if (!region_id || typeof region_id !== "string") {
      return new Response(
        JSON.stringify({ error: "region_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UK: use live API
    if (region_id === "uksouth") {
      try {
        const response = await fetch("https://api.carbonintensity.org.uk/intensity", {
          signal: AbortSignal.timeout(10000),
        });
        
        if (!response.ok) {
          throw new Error(`Carbon Intensity UK API error: ${response.statusText}`);
        }

        const data = await response.json();
        const entry = data.data?.[0] || {};
        const intensity = entry.intensity || {};
        const actual = intensity.actual ?? intensity.forecast ?? 120;
        const indexVal = intensity.index || "low";

        const result: CarbonData = {
          gco2_kwh: actual,
          index: indexVal as CarbonData["index"],
          source: "carbonintensity.org.uk (LIVE)",
          from: entry.from,
          to: entry.to,
        };

        return new Response(
          JSON.stringify(result),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error) {
        console.warn(`Carbon UK scrape failed:`, error);
        // Fallback to default
        const defaultResult: CarbonData = {
          gco2_kwh: 120.0,
          index: "low",
          source: "default (API failed)",
        };
        return new Response(
          JSON.stringify(defaultResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // France / Netherlands: use physics model with weather data
    if (!weather_data) {
      return new Response(
        JSON.stringify({ error: "weather_data is required for France/NL regions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const wind = weather_data.current_wind_kmh ?? 15.0;
    const solar = weather_data.current_solar_wm2 ?? 0.0;

    const result = estimateCarbonFromWeather(region_id, wind, solar);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape carbon error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
