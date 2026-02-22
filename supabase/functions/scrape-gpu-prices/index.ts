// NERVE Engine - Scrape GPU Prices from Azure Retail Prices API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, identifyGPU, estimateAvailability, GPU_SKU_PREFIXES } from "../_shared/utils.ts";
import type { GpuInstance } from "../_shared/types.ts";

serve(async (req) => {
  // Handle CORS preflight
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

    const gpus: Partial<GpuInstance>[] = [];

    // Scrape for each GPU prefix type
    for (const prefixType of ["NC", "NV", "ND"]) {
      const url = `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq '${region_id}' and contains(meterName,'Spot') and contains(armSkuName,'${prefixType}')`;
      
      try {
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(15000) 
        });
        
        if (!response.ok) {
          console.warn(`Azure scrape failed ${region_id}/${prefixType}: ${response.statusText}`);
          continue;
        }

        const data = await response.json();
        const items = data.Items || [];

        // Deduplicate: keep cheapest per SKU (Windows vs Linux)
        const seen: Record<string, any> = {};
        for (const item of items) {
          const sku = item.armSkuName || "";
          const price = item.retailPrice || 999;
          if (!seen[sku] || price < seen[sku].retailPrice) {
            seen[sku] = item;
          }
        }

        // Process each unique SKU
        for (const [sku, item] of Object.entries(seen)) {
          const gpuInfo = identifyGPU(sku);
          if (!gpuInfo) continue;

          gpus.push({
            region: region_id,
            sku: sku,
            gpu_name: gpuInfo.name,
            gpu_count: gpuInfo.count,
            vcpus: gpuInfo.vcpus,
            ram_gb: gpuInfo.ram_gb,
            spot_price_usd_hr: Math.round(item.retailPrice * 1000000) / 1000000,
            ondemand_price_usd_hr: 0.0, // Will be enriched below
            savings_pct: 0.0,
            availability: "high",
            tier: gpuInfo.tier,
          });
        }
      } catch (error) {
        console.warn(`Azure scrape error ${region_id}/${prefixType}:`, error);
      }
    }

    // Enrich with on-demand prices
    for (const gpu of gpus) {
      if (!gpu.sku) continue;

      const url = `https://prices.azure.com/api/retail/prices?$filter=serviceName eq 'Virtual Machines' and armRegionName eq '${region_id}' and armSkuName eq '${gpu.sku}'`;
      
      try {
        const response = await fetch(url, { 
          signal: AbortSignal.timeout(10000) 
        });
        
        if (response.ok) {
          const data = await response.json();
          const items = data.Items || [];
          
          // Find the non-Spot, non-Low Priority price
          for (const item of items) {
            const meter = item.meterName || "";
            if (!meter.includes("Spot") && !meter.includes("Low Priority")) {
              const odPrice = item.retailPrice;
              gpu.ondemand_price_usd_hr = Math.round(odPrice * 10000) / 10000;
              if (odPrice > 0 && gpu.spot_price_usd_hr) {
                gpu.savings_pct = Math.round((1 - gpu.spot_price_usd_hr / odPrice) * 1000) / 10;
              }
              break;
            }
          }
        }
      } catch (error) {
        // Estimate on-demand as ~5x spot if API fails
        if (gpu.spot_price_usd_hr) {
          gpu.ondemand_price_usd_hr = Math.round(gpu.spot_price_usd_hr * 5 * 10000) / 10000;
          gpu.savings_pct = 80.0;
        }
      }

      // Recalculate availability with real spot/on-demand ratio
      if (gpu.spot_price_usd_hr && gpu.ondemand_price_usd_hr && gpu.tier) {
        gpu.availability = estimateAvailability(
          gpu.spot_price_usd_hr,
          gpu.tier,
          gpu.spot_price_usd_hr,
          gpu.ondemand_price_usd_hr
        );
      }
    }

    return new Response(
      JSON.stringify({ gpus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape GPU prices error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
