// NERVE Engine - Optimize Job (Complete optimization with saving)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, scoreGPU, gpuFamily, KWH_PER_GPU_HR, EUR_USD } from "../_shared/utils.ts";
import type { GpuInstance, AZInfo, RegionInfo } from "../_shared/types.ts";

interface OptimizeRequest {
  estimated_gpu_hours: number;
  min_gpu_memory_gb: number;
  deadline: string;
  preferred_region?: string | null;
  current_region?: string | null;
  current_az?: string | null;
  current_sku?: string | null;
  current_price_usd_hr?: number;
}

interface OptimizeResponse {
  job_id: string;
  recommendation: {
    region: string;
    az: string;
    gpu_sku: string;
    gpu_name: string;
    spot_price_usd_hr: number;
    ondemand_price_usd_hr: number;
    savings_pct: number;
    carbon_intensity_gco2_kwh: number;
    carbon_index: string;
    temperature_c: number;
    wind_kmh: number;
    score: number;
  };
  financial_analysis: {
    current_cost_usd: number;
    recommended_cost_usd: number;
    savings_usd: number;
    savings_eur: number;
    savings_pct: number;
    payback_time_hours?: number;
  };
  environmental_impact: {
    current_co2_grams: number;
    recommended_co2_grams: number;
    co2_saved_grams: number;
    equivalent: string;
  };
  reason: string;
  should_switch: boolean;
  switch_reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reqData: OptimizeRequest = await req.json();
    
    if (!reqData.estimated_gpu_hours || !reqData.min_gpu_memory_gb || !reqData.deadline) {
      return new Response(
        JSON.stringify({ error: "estimated_gpu_hours, min_gpu_memory_gb, and deadline are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    const functionsUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";

    // Generate job ID
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Determine regions to check
    const regionsToCheck = reqData.preferred_region
      ? [reqData.preferred_region]
      : ["francecentral", "westeurope", "uksouth"];

    let bestGpu: GpuInstance | null = null;
    let bestScore = Infinity;
    let bestRegion: RegionInfo | null = null;
    let bestAz: AZInfo | null = null;

    // Check all regions
    for (const regionId of regionsToCheck) {
      try {
        const regionResponse = await fetch(`${functionsUrl}/get-region-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region_id: regionId }),
        });
        
        if (!regionResponse.ok) continue;
        
        const region: RegionInfo = await regionResponse.json();
        
        for (const az of region.availability_zones) {
          for (const gpu of az.gpu_instances) {
            if (gpu.ram_gb < reqData.min_gpu_memory_gb) continue;
            
            const score = scoreGPU(
              gpu,
              az.carbon_intensity_gco2_kwh,
              az.temperature_c,
              az.wind_kmh
            );
            
            if (score < bestScore) {
              bestScore = score;
              bestGpu = gpu;
              bestRegion = region;
              bestAz = az;
            }
          }
        }
      } catch (error) {
        console.warn(`Error checking region ${regionId}:`, error);
      }
    }

    if (!bestGpu || !bestAz || !bestRegion) {
      return new Response(
        JSON.stringify({ error: "No suitable GPU found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate financial analysis
    const recommendedCost = bestGpu.spot_price_usd_hr * reqData.estimated_gpu_hours;
    const recommendedOndemandCost = bestGpu.ondemand_price_usd_hr * reqData.estimated_gpu_hours;
    const recommendedSavings = recommendedOndemandCost - recommendedCost;

    let currentCost = 0;
    let shouldSwitch = false;
    let switchReason = "";

    if (reqData.current_price_usd_hr && reqData.current_price_usd_hr > 0) {
      currentCost = reqData.current_price_usd_hr * reqData.estimated_gpu_hours;
      const savingsFromSwitch = currentCost - recommendedCost;
      
      if (savingsFromSwitch > 0.1) { // At least 10 cents savings
        shouldSwitch = true;
        const savingsPct = (savingsFromSwitch / currentCost) * 100;
        switchReason = `Changer vous ferait économiser $${Math.round(savingsFromSwitch * 100) / 100} (${Math.round(savingsPct * 10) / 10}%) sur ce job.`;
      } else if (bestGpu.spot_price_usd_hr < reqData.current_price_usd_hr * 0.95) {
        shouldSwitch = true;
        switchReason = `Le serveur recommandé est ${Math.round((1 - bestGpu.spot_price_usd_hr / reqData.current_price_usd_hr) * 1000) / 10}% moins cher et plus écologique.`;
      } else {
        switchReason = "Votre configuration actuelle est déjà optimale pour ce job.";
      }
    } else {
      switchReason = "Configuration recommandée pour démarrer ce job.";
    }

    // Calculate environmental impact
    const gpuFam = gpuFamily(bestGpu.gpu_name);
    const kwhPerHr = KWH_PER_GPU_HR[gpuFam] || 0.30;
    const totalKwh = kwhPerHr * reqData.estimated_gpu_hours * 1.2;
    const recommendedCo2 = totalKwh * bestAz.carbon_intensity_gco2_kwh;
    
    let currentCo2 = 0;
    if (reqData.current_region && reqData.current_az) {
      try {
        const currentRegionResponse = await fetch(`${functionsUrl}/get-region-data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region_id: reqData.current_region }),
        });
        if (currentRegionResponse.ok) {
          const currentRegion: RegionInfo = await currentRegionResponse.json();
          const currentAz = currentRegion.availability_zones.find(az => az.az_id === reqData.current_az);
          if (currentAz) {
            currentCo2 = totalKwh * currentAz.carbon_intensity_gco2_kwh;
          }
        }
      } catch (error) {
        console.warn("Failed to get current region data:", error);
      }
    }

    const co2Saved = currentCo2 > 0 ? currentCo2 - recommendedCo2 : 0;
    const equivalentKm = Math.round((co2Saved / 120) * 10) / 10;

    // Build simple reason
    const reasonParts = [];
    reasonParts.push(`💰 Prix: $${bestGpu.spot_price_usd_hr.toFixed(4)}/h (${bestGpu.savings_pct.toFixed(1)}% moins cher que On-Demand)`);
    reasonParts.push(`🌱 Carbone: ${bestAz.carbon_index} (${bestAz.carbon_intensity_gco2_kwh.toFixed(1)} gCO₂/kWh)`);
    reasonParts.push(`🌡️ Température: ${bestAz.temperature_c.toFixed(1)}°C`);
    reasonParts.push(`💨 Vent: ${bestAz.wind_kmh.toFixed(1)} km/h`);
    reasonParts.push(`📍 Région: ${bestRegion.region_name} - ${bestAz.az_name}`);
    
    const simpleReason = reasonParts.join(" • ");

    const response: OptimizeResponse = {
      job_id: jobId,
      recommendation: {
        region: bestRegion.region_id,
        az: bestAz.az_id,
        gpu_sku: bestGpu.sku,
        gpu_name: bestGpu.gpu_name,
        spot_price_usd_hr: Math.round(bestGpu.spot_price_usd_hr * 10000) / 10000,
        ondemand_price_usd_hr: Math.round(bestGpu.ondemand_price_usd_hr * 10000) / 10000,
        savings_pct: Math.round(bestGpu.savings_pct * 10) / 10,
        carbon_intensity_gco2_kwh: bestAz.carbon_intensity_gco2_kwh,
        carbon_index: bestAz.carbon_index,
        temperature_c: bestAz.temperature_c,
        wind_kmh: bestAz.wind_kmh,
        score: Math.round(bestScore * 1000) / 1000,
      },
      financial_analysis: {
        current_cost_usd: Math.round(currentCost * 100) / 100,
        recommended_cost_usd: Math.round(recommendedCost * 100) / 100,
        savings_usd: Math.round((currentCost > 0 ? currentCost - recommendedCost : recommendedSavings) * 100) / 100,
        savings_eur: Math.round((currentCost > 0 ? currentCost - recommendedCost : recommendedSavings) * EUR_USD * 100) / 100,
        savings_pct: currentCost > 0 
          ? Math.round(((currentCost - recommendedCost) / currentCost) * 1000) / 10
          : Math.round(bestGpu.savings_pct * 10) / 10,
        payback_time_hours: currentCost > 0 && shouldSwitch
          ? Math.round((currentCost - recommendedCost) / bestGpu.spot_price_usd_hr * 10) / 10
          : undefined,
      },
      environmental_impact: {
        current_co2_grams: Math.round(currentCo2 * 10) / 10,
        recommended_co2_grams: Math.round(recommendedCo2 * 10) / 10,
        co2_saved_grams: Math.round(co2Saved * 10) / 10,
        equivalent: co2Saved > 0 
          ? `Équivalent à ${equivalentKm} km en voiture évités`
          : `Émission de ${Math.round(recommendedCo2 * 10) / 10} g CO₂`,
      },
      reason: simpleReason,
      should_switch: shouldSwitch,
      switch_reason: switchReason,
    };

    // Save to database
    try {
      await supabase.from("nerve_optimizations").insert({
        job_id: jobId,
        user_input: reqData,
        recommendation: response.recommendation,
        financial_gain_usd: response.financial_analysis.savings_usd,
        co2_saved_grams: response.environmental_impact.co2_saved_grams,
        reason: simpleReason,
      });
    } catch (error) {
      console.warn("Failed to save optimization:", error);
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Optimize job error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
