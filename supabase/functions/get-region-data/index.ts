// NERVE Engine - Get Complete Region Data (combines all scrapers)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, REGIONS, azPriceVariation, azAvailabilityShift, estimateAvailability } from "../_shared/utils.ts";
import type { RegionInfo, AZInfo, GpuInstance, WeatherData, CarbonData } from "../_shared/types.ts";

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

    // Get project URL from environment
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const functionsUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";

    // Scrape GPU prices
    const gpuResponse = await fetch(`${functionsUrl}/scrape-gpu-prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id }),
    });
    const gpuData = await gpuResponse.json();
    const gpusRaw = gpuData.gpus || [];

    // Scrape weather
    const weatherResponse = await fetch(`${functionsUrl}/scrape-weather`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id }),
    });
    const weather: WeatherData = await weatherResponse.json();

    // Scrape carbon (needs weather data for France/NL)
    const carbonResponse = await fetch(`${functionsUrl}/scrape-carbon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id, weather_data: weather }),
    });
    const carbon: CarbonData = await carbonResponse.json();

    // Build AZ list with per-AZ GPU prices
    const azs: AZInfo[] = [];
    for (let i = 0; i < cfg.azs.length; i++) {
      const azCfg = cfg.azs[i];
      const azId = azCfg.id;

      // Per-AZ GPU instances with unique price variations
      const azGpuInstances: GpuInstance[] = [];
      for (const g of gpusRaw) {
        const azSpot = azPriceVariation(g.spot_price_usd_hr, azId, g.sku);
        const azOndemand = g.ondemand_price_usd_hr;
        const azSavings = azOndemand > 0 
          ? Math.round((1 - azSpot / azOndemand) * 1000) / 10 
          : g.savings_pct;
        
        const baseAvail = estimateAvailability(
          azSpot,
          g.tier || "mid",
          azSpot,
          azOndemand
        );
        const azAvail = azAvailabilityShift(baseAvail, azId);

        azGpuInstances.push({
          sku: g.sku,
          gpu_name: g.gpu_name,
          gpu_count: g.gpu_count,
          vcpus: g.vcpus,
          ram_gb: g.ram_gb,
          spot_price_usd_hr: azSpot,
          ondemand_price_usd_hr: azOndemand,
          savings_pct: azSavings,
          availability: azAvail,
          tier: g.tier,
        });
      }

      // Slight weather variation per AZ (different micro-climates)
      const temp = weather.current_temp_c + (i * 0.2 - 0.2);
      const wind = weather.current_wind_kmh + (i * 0.5 - 0.5);
      const gco2 = carbon.gco2_kwh;
      const idx = carbon.index;

      azs.push({
        az_id: azId,
        az_name: azCfg.name,
        gpu_instances: azGpuInstances,
        carbon_intensity_gco2_kwh: gco2,
        carbon_index: idx,
        temperature_c: Math.round(temp * 10) / 10,
        wind_kmh: Math.round(wind * 10) / 10,
        score: null,
      });
    }

    const regionInfo: RegionInfo = {
      region_id: region_id,
      region_name: cfg.name,
      cloud_provider: cfg.cloud_provider,
      location: cfg.location,
      availability_zones: azs,
    };

    return new Response(
      JSON.stringify(regionInfo),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get region data error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
