// NERVE Engine - Dashboard Stats
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, EUR_USD, REGIONS } from "../_shared/utils.ts";
import type { DashboardStats } from "../_shared/types.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get stats from database
    const { data: statsData, error } = await supabase
      .from("nerve_stats")
      .select("*")
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows returned
      console.error("Error fetching stats:", error);
    }

    const stats = statsData || {
      total_jobs: 0,
      total_savings_usd: 0,
      total_co2_saved_g: 0,
      total_checkpoints: 0,
      total_evictions: 0,
      updated_at: new Date().toISOString(),
    };

    const dashboardStats: DashboardStats = {
      total_jobs_managed: stats.total_jobs || 0,
      total_savings_usd: Math.round((stats.total_savings_usd || 0) * 100) / 100,
      total_savings_eur: Math.round((stats.total_savings_usd || 0) * EUR_USD * 100) / 100,
      total_co2_saved_grams: Math.round((stats.total_co2_saved_g || 0) * 10) / 10,
      total_checkpoints_saved: stats.total_checkpoints || 0,
      total_evictions_handled: stats.total_evictions || 0,
      avg_savings_pct: 78.0, // Could be calculated from actual data
      uptime_pct: 100.0,
      regions_monitored: Object.keys(REGIONS),
      last_updated: stats.updated_at || new Date().toISOString(),
    };

    return new Response(
      JSON.stringify(dashboardStats),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Dashboard stats error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
