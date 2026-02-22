// NERVE Engine - Checkpoint Simulation
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, NEIGHBOR_AZ, S3_UPLOAD_GBPS } from "../_shared/utils.ts";
import type { CheckpointSimulateRequest, CheckpointEvent } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const reqData: CheckpointSimulateRequest = await req.json();
    
    if (!reqData.job_id || !reqData.current_region || !reqData.current_az || !reqData.current_sku || !reqData.model_size_gb) {
      return new Response(
        JSON.stringify({ error: "job_id, current_region, current_az, current_sku, and model_size_gb are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    const functionsUrl = supabaseUrl.replace(/\/$/, "") + "/functions/v1";

    const targetAz = NEIGHBOR_AZ[reqData.current_az] || "fr-central-2";
    const checkpointSizeGb = reqData.model_size_gb * 0.8;
    const uploadDurationSec = checkpointSizeGb / S3_UPLOAD_GBPS;

    // Get live GPU data for context
    let targetGpuInfo = "same SKU";
    try {
      const regionResponse = await fetch(`${functionsUrl}/get-region-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_id: reqData.current_region }),
      });
      
      if (regionResponse.ok) {
        const regionData = await regionResponse.json();
        const azs = regionData.availability_zones || [];
        for (const az of azs) {
          for (const gpu of az.gpu_instances || []) {
            if (gpu.sku === reqData.current_sku) {
              targetGpuInfo = `${gpu.gpu_name} @ $${gpu.spot_price_usd_hr}/h (LIVE)`;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to get GPU info:", error);
    }

    // Get weather and carbon for context
    let weather: any = {};
    let carbon: any = {};
    try {
      const weatherResponse = await fetch(`${functionsUrl}/scrape-weather`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_id: reqData.current_region }),
      });
      if (weatherResponse.ok) {
        weather = await weatherResponse.json();
      }

      const carbonResponse = await fetch(`${functionsUrl}/scrape-carbon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region_id: reqData.current_region, weather_data: weather }),
      });
      if (carbonResponse.ok) {
        carbon = await carbonResponse.json();
      }
    } catch (error) {
      console.warn("Failed to get weather/carbon:", error);
    }

    // Build timeline
    const timeline = [
      {
        time_sec: 0.0,
        event: "Spot Interruption Notice — AWS metadata endpoint 169.254.169.254",
      },
      {
        time_sec: 1.5,
        event: "NERVE signal PyTorch: torch.save() triggered",
      },
      {
        time_sec: Math.round((1.5 + uploadDurationSec) * 10) / 10,
        event: `Checkpoint (${Math.round(checkpointSizeGb * 10) / 10} GB) uploaded to S3`,
      },
      {
        time_sec: Math.round((2.0 + uploadDurationSec) * 10) / 10,
        event: `kubectl cordon ${reqData.current_az} — node cordoned`,
      },
      {
        time_sec: Math.round((25.0 + uploadDurationSec) * 10) / 10,
        event: `New Spot GPU provisioned in ${targetAz} — ${targetGpuInfo}`,
      },
      {
        time_sec: Math.round((35.0 + uploadDurationSec) * 10) / 10,
        event: "Checkpoint downloaded from S3 — torch.load()",
      },
      {
        time_sec: Math.round((40.0 + uploadDurationSec) * 10) / 10,
        event: `Training resumed at ${reqData.epoch_progress_pct}% — zero loss (weather: ${weather.current_temp_c || "?"}°C, carbon: ${carbon.gco2_kwh || "?"} gCO2/kWh)`,
      },
    ];

    // Update stats
    try {
      await supabase.rpc("update_nerve_stats", {
        jobs_delta: 0,
        savings_delta: 0,
        co2_delta: 0,
        checkpoints_delta: 1,
        evictions_delta: 1,
      });
    } catch (error) {
      console.warn("Failed to update stats:", error);
    }

    const event: CheckpointEvent = {
      job_id: reqData.job_id,
      status: "migrated",
      checkpoint_saved: true,
      checkpoint_size_gb: Math.round(checkpointSizeGb * 10) / 10,
      save_duration_sec: Math.round(uploadDurationSec * 10) / 10,
      from_az: reqData.current_az,
      to_az: targetAz,
      downtime_ms: 0,
      epoch_progress_pct: reqData.epoch_progress_pct,
      resumed: true,
      timeline,
    };

    return new Response(
      JSON.stringify(event),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Checkpoint simulate error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
