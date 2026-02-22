// NERVE Engine - Simulation with Scoring
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, scoreGPU, gpuFamily, KWH_PER_GPU_HR, EUR_USD } from "../_shared/utils.ts";
import type { SimulateRequest, SimulateResponse, GpuInstance, AZInfo, RegionInfo, Availability, InterruptionRisk } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reqData: SimulateRequest = await req.json();
    
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

    // Determine regions to check
    const regionsToCheck = reqData.preferred_region
      ? [reqData.preferred_region]
      : ["francecentral", "westeurope", "uksouth"];

    let bestGpu: GpuInstance | null = null;
    let bestScore = Infinity;
    let bestRegion: RegionInfo | null = null;
    let bestAz: AZInfo | null = null;
    let fallbackGpu: GpuInstance | null = null;
    let fallbackAz: AZInfo | null = null;

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
              if (bestGpu) {
                fallbackGpu = bestGpu;
                fallbackAz = bestAz;
              }
              bestScore = score;
              bestGpu = gpu;
              bestRegion = region;
              bestAz = az;
            } else if (!fallbackGpu) {
              fallbackGpu = gpu;
              fallbackAz = az;
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

    if (!fallbackGpu) {
      fallbackGpu = bestGpu;
      fallbackAz = bestAz;
    }

    // Get time-shifting plan
    const primaryRegion = bestRegion.region_id;
    let timeShift: any = { recommended: false, optimal_start: null };
    try {
      const timeshiftResponse = await fetch(`${functionsUrl}/timeshift-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimated_gpu_hours: reqData.estimated_gpu_hours,
          deadline: reqData.deadline,
          preferred_region: primaryRegion,
          flexible: reqData.flexible ?? true,
        }),
      });
      if (timeshiftResponse.ok) {
        timeShift = await timeshiftResponse.json();
      }
    } catch (error) {
      console.warn("Time-shift plan error:", error);
    }

    const strategy = timeShift.recommended ? "time_shifted" : "immediate";
    const optimalStart = timeShift.optimal_window_start || null;

    const now = new Date().toISOString();
    const gpuFam = gpuFamily(bestGpu.gpu_name);
    const kwhPerHr = KWH_PER_GPU_HR[gpuFam] || 0.30;

    // Financial calculations
    const spotTotal = bestGpu.spot_price_usd_hr * reqData.estimated_gpu_hours;
    const ondemandTotal = bestGpu.ondemand_price_usd_hr * reqData.estimated_gpu_hours;
    const savingsUsd = ondemandTotal - spotTotal;
    const timeShiftBonus = strategy === "time_shifted" ? savingsUsd * 0.08 : 0;

    // Carbon calculations
    const totalKwh = kwhPerHr * reqData.estimated_gpu_hours * 1.2;
    const totalCo2 = totalKwh * bestAz.carbon_intensity_gco2_kwh;
    const worstCo2 = totalKwh * 500;
    const co2Saved = worstCo2 - totalCo2;

    // Update stats in database
    try {
      await supabase.rpc("update_nerve_stats", {
        jobs_delta: 1,
        savings_delta: savingsUsd,
        co2_delta: co2Saved,
        checkpoints_delta: 0,
        evictions_delta: 0,
      });
    } catch (error) {
      console.warn("Failed to update stats:", error);
    }

    // Build response
    const checkpointInterval = reqData.checkpoint_interval_min || 30;
    const response: SimulateResponse = {
      decision: {
        primary_region: primaryRegion,
        primary_az: bestAz.az_id,
        gpu_sku: bestGpu.sku,
        gpu_name: bestGpu.gpu_name,
        spot_price_usd_hr: bestGpu.spot_price_usd_hr,
        start_strategy: strategy as "immediate" | "time_shifted",
        optimal_start_time: optimalStart,
        reason: `Score NERVE ${bestScore.toFixed(3)} — $${bestGpu.spot_price_usd_hr}/h Spot vs $${bestGpu.ondemand_price_usd_hr}/h On-Demand (${bestGpu.savings_pct}% off), carbone ${bestAz.carbon_index} (${bestAz.carbon_intensity_gco2_kwh} gCO2/kWh), temp ${bestAz.temperature_c}°C, vent ${bestAz.wind_kmh} km/h`,
      },
      fallback: {
        secondary_az: fallbackAz.az_id,
        secondary_sku: fallbackGpu.sku,
        fallback_reason: `Backup: ${fallbackGpu.gpu_name} @ $${fallbackGpu.spot_price_usd_hr}/h`,
      },
      checkpointing: {
        recommended_interval_min: checkpointInterval,
        storage_target: "s3",
        estimated_checkpoint_size_gb: Math.round(reqData.min_gpu_memory_gb * 0.8 * 10) / 10,
        reason: `Checkpoint toutes les ${checkpointInterval} min sur S3 — reprise garantie en < 90s`,
      },
      savings: {
        spot_cost_total_usd: Math.round(spotTotal * 100) / 100,
        ondemand_cost_total_usd: Math.round(ondemandTotal * 100) / 100,
        savings_usd: Math.round(savingsUsd * 100) / 100,
        savings_eur: Math.round(savingsUsd * EUR_USD * 100) / 100,
        savings_pct: Math.round(bestGpu.savings_pct * 10) / 10,
        time_shift_extra_savings_usd: Math.round(timeShiftBonus * 100) / 100,
      },
      green_impact: {
        carbon_intensity_gco2_kwh: bestAz.carbon_intensity_gco2_kwh,
        total_energy_kwh: Math.round(totalKwh * 100) / 100,
        total_co2_grams: Math.round(totalCo2 * 10) / 10,
        co2_vs_worst_region_grams: Math.round(worstCo2 * 10) / 10,
        co2_saved_grams: Math.round(co2Saved * 10) / 10,
        equivalent: `Equivalent a ${Math.round(co2Saved / 120 * 10) / 10} km en voiture evites`,
      },
      server_path: [
        {
          step: 1,
          action: "Lancement du job sur Spot GPU (LIVE prices)",
          region: primaryRegion,
          az: bestAz.az_id,
          gpu: bestGpu.sku,
          time: optimalStart || now,
        },
        {
          step: 2,
          action: "Checkpoint auto sur S3",
          region: primaryRegion,
          az: bestAz.az_id,
          gpu: bestGpu.sku,
          time: optimalStart || now,
        },
        {
          step: 3,
          action: "Job termine",
          region: primaryRegion,
          az: bestAz.az_id,
          gpu: bestGpu.sku,
          time: reqData.deadline,
        },
      ],
      risk_assessment: {
        spot_interruption_probability: (bestGpu.availability === "high" || bestGpu.availability === "medium")
          ? "low"
          : "medium",
        eviction_mitigation: "Smart Checkpointing + AZ-Hopping automatique",
        max_evictions_per_hour: 2,
      },
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Simulate error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
