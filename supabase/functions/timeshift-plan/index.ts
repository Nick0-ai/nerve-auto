// NERVE Engine - Time-Shifting Plan Calculation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, INTRADAY_MULTIPLIERS, REGIONS } from "../_shared/utils.ts";
import type { TimeShiftRequest, TimeShiftPlan, WeatherData, CarbonData } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reqData: TimeShiftRequest = await req.json();
    
    if (!reqData.estimated_gpu_hours || !reqData.deadline) {
      return new Response(
        JSON.stringify({ error: "estimated_gpu_hours and deadline are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const regionId = reqData.preferred_region || "francecentral";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const functionsUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";

    // Get region data to build price and carbon curves
    const regionResponse = await fetch(`${functionsUrl}/get-region-data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id: regionId }),
    });
    
    if (!regionResponse.ok) {
      throw new Error("Failed to get region data");
    }
    
    const regionData = await regionResponse.json();
    const azs = regionData.availability_zones || [];
    if (azs.length === 0) {
      throw new Error("No availability zones found");
    }

    // Build price curve from average GPU prices
    const gpus = azs[0]?.gpu_instances || [];
    const avgPrice = gpus.length > 0
      ? gpus.reduce((sum: number, g: any) => sum + g.spot_price_usd_hr, 0) / gpus.length
      : 0.5;

    const priceCurve: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      priceCurve[h] = Math.round(avgPrice * (INTRADAY_MULTIPLIERS[h] || 1.0) * 10000) / 10000;
    }

    // Build carbon curve from weather data
    const weatherResponse = await fetch(`${functionsUrl}/scrape-weather`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id: regionId }),
    });
    const weather: WeatherData = weatherResponse.ok ? await weatherResponse.json() : { hourly: [] };

    const carbonResponse = await fetch(`${functionsUrl}/scrape-carbon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region_id: regionId, weather_data: weather }),
    });
    const carbon: CarbonData = carbonResponse.ok ? await carbonResponse.json() : { gco2_kwh: 100.0, index: "low" };

    const baseCarbon = carbon.gco2_kwh;
    const carbonCurve: Record<number, number> = {};
    const hourly = weather.hourly || [];
    
    for (let i = 0; i < 24; i++) {
      if (i < hourly.length) {
        const entry = hourly[i];
        const wind = entry.wind_kmh || 15.0;
        const solar = entry.solar_wm2 || 0.0;
        const windFactor = Math.max(0.7, 1.0 - (wind / 100.0));
        const solarFactor = Math.max(0.8, 1.0 - (solar / 500.0));
        carbonCurve[i] = Math.round(baseCarbon * windFactor * solarFactor * 10) / 10;
      } else {
        carbonCurve[i] = baseCarbon;
      }
    }

    // Find optimal window
    const now = new Date();
    const deadline = new Date(reqData.deadline);
    const hoursNeeded = reqData.estimated_gpu_hours;
    const hoursInt = Math.ceil(hoursNeeded);
    const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilDeadline < hoursNeeded) {
      return new Response(
        JSON.stringify({
          recommended: false,
          optimal_window_start: null,
          optimal_window_end: null,
          reason: "Deadline is too soon - cannot time-shift",
          estimated_spot_price_usd_hr: priceCurve[now.getUTCHours()] || 1.0,
          current_spot_price_usd_hr: priceCurve[now.getUTCHours()] || 1.0,
          price_reduction_pct: 0,
          carbon_reduction_pct: 0,
          meets_deadline: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let bestStartHour: number | null = null;
    let bestCost = Infinity;
    const maxOffset = Math.floor(hoursUntilDeadline - hoursNeeded) + 1;

    for (let startOffsetH = 0; startOffsetH < maxOffset; startOffsetH++) {
      const candidateStart = new Date(now.getTime() + startOffsetH * 60 * 60 * 1000);
      let totalCost = 0.0;
      
      for (let h = 0; h < hoursInt; h++) {
        const runHour = (candidateStart.getUTCHours() + h) % 24;
        totalCost += priceCurve[runHour] || 1.0;
      }

      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestStartHour = startOffsetH;
      }
    }

    if (bestStartHour === null) {
      return new Response(
        JSON.stringify({
          recommended: false,
          optimal_window_start: null,
          optimal_window_end: null,
          reason: "Could not find optimal window",
          estimated_spot_price_usd_hr: priceCurve[now.getUTCHours()] || 1.0,
          current_spot_price_usd_hr: priceCurve[now.getUTCHours()] || 1.0,
          price_reduction_pct: 0,
          carbon_reduction_pct: 0,
          meets_deadline: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const optimalStart = new Date(now.getTime() + bestStartHour * 60 * 60 * 1000);
    const optimalEnd = new Date(optimalStart.getTime() + hoursNeeded * 60 * 60 * 1000);

    // Calculate reductions
    const nowHour = now.getUTCHours();
    let currentCost = 0.0;
    let currentCarbon = 0.0;
    for (let h = 0; h < hoursInt; h++) {
      const runHour = (nowHour + h) % 24;
      currentCost += priceCurve[runHour] || 1.0;
      currentCarbon += carbonCurve[runHour] || 100.0;
    }

    let optimalCarbon = 0.0;
    for (let h = 0; h < hoursInt; h++) {
      const runHour = (optimalStart.getUTCHours() + h) % 24;
      optimalCarbon += carbonCurve[runHour] || 100.0;
    }

    const priceReduction = currentCost > 0
      ? Math.max(0, ((currentCost - bestCost) / currentCost) * 100)
      : 0;
    const carbonReduction = currentCarbon > 0
      ? Math.max(0, ((currentCarbon - optimalCarbon) / currentCarbon) * 100)
      : 0;

    const recommended = priceReduction > 5 && (reqData.flexible ?? true);
    const meetsDeadline = optimalEnd <= deadline;

    const optimalPrice = priceCurve[optimalStart.getUTCHours()] || 1.0;
    const currentPrice = priceCurve[nowHour] || 1.0;

    const plan: TimeShiftPlan = {
      recommended: recommended && meetsDeadline,
      optimal_window_start: optimalStart.toISOString(),
      optimal_window_end: optimalEnd.toISOString(),
      reason: recommended && meetsDeadline
        ? `Décaler le job à ${optimalStart.toISOString().substring(11, 16)} réduit le coût de ${Math.round(priceReduction)}% et le carbone de ${Math.round(carbonReduction)}% (données live ${regionId})`
        : "Le créneau actuel est optimal ou la deadline ne permet pas de décaler",
      estimated_spot_price_usd_hr: Math.round(optimalPrice * 10000) / 10000,
      current_spot_price_usd_hr: Math.round(currentPrice * 10000) / 10000,
      price_reduction_pct: Math.round(priceReduction * 10) / 10,
      carbon_reduction_pct: Math.round(carbonReduction * 10) / 10,
      meets_deadline: meetsDeadline,
    };

    return new Response(
      JSON.stringify(plan),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Timeshift plan error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
