// NERVE Engine Types - Migrated from Python models

export type Availability = "high" | "medium" | "low" | "very_low";

export type CarbonIndex = "very low" | "low" | "moderate" | "high" | "very high";

export type StartStrategy = "immediate" | "time_shifted";

export type InterruptionRisk = "low" | "medium" | "high";

export interface GpuInstance {
  sku: string;
  gpu_name: string;
  gpu_count: number;
  vcpus: number;
  ram_gb: number;
  spot_price_usd_hr: number;
  ondemand_price_usd_hr: number;
  savings_pct: number;
  availability: Availability;
  tier?: "low" | "mid" | "high" | "premium";
}

export interface AZInfo {
  az_id: string;
  az_name: string;
  gpu_instances: GpuInstance[];
  carbon_intensity_gco2_kwh: number;
  carbon_index: CarbonIndex;
  temperature_c: number;
  wind_kmh: number;
  score?: number | null;
}

export interface RegionInfo {
  region_id: string;
  region_name: string;
  cloud_provider: string;
  location: string;
  availability_zones: AZInfo[];
}

export interface Decision {
  primary_region: string;
  primary_az: string;
  gpu_sku: string;
  gpu_name: string;
  spot_price_usd_hr: number;
  start_strategy: StartStrategy;
  optimal_start_time: string | null;
  reason: string;
}

export interface Fallback {
  secondary_az: string;
  secondary_sku: string;
  fallback_reason: string;
}

export interface CheckpointConfig {
  recommended_interval_min: number;
  storage_target: string;
  estimated_checkpoint_size_gb: number;
  reason: string;
}

export interface Savings {
  spot_cost_total_usd: number;
  ondemand_cost_total_usd: number;
  savings_usd: number;
  savings_eur: number;
  savings_pct: number;
  time_shift_extra_savings_usd: number;
}

export interface GreenImpact {
  carbon_intensity_gco2_kwh: number;
  total_energy_kwh: number;
  total_co2_grams: number;
  co2_vs_worst_region_grams: number;
  co2_saved_grams: number;
  equivalent: string;
}

export interface ServerStep {
  step: number;
  action: string;
  region: string;
  az: string;
  gpu: string;
  time: string;
}

export interface RiskAssessment {
  spot_interruption_probability: InterruptionRisk;
  eviction_mitigation: string;
  max_evictions_per_hour: number;
}

export interface SimulateRequest {
  job_type?: string;
  model?: string;
  estimated_gpu_hours: number;
  min_gpu_memory_gb: number;
  deadline: string; // ISO8601
  preferred_region?: string | null;
  checkpoint_interval_min?: number;
  flexible?: boolean;
}

export interface SimulateResponse {
  decision: Decision;
  fallback: Fallback;
  checkpointing: CheckpointConfig;
  savings: Savings;
  green_impact: GreenImpact;
  server_path: ServerStep[];
  risk_assessment: RiskAssessment;
}

export interface TimeShiftRequest {
  estimated_gpu_hours: number;
  deadline: string; // ISO8601
  preferred_region?: string | null;
  flexible?: boolean;
}

export interface TimeShiftPlan {
  recommended: boolean;
  optimal_window_start: string | null;
  optimal_window_end: string | null;
  reason: string;
  estimated_spot_price_usd_hr: number;
  current_spot_price_usd_hr: number;
  price_reduction_pct: number;
  carbon_reduction_pct: number;
  meets_deadline: boolean;
}

export interface CheckpointSimulateRequest {
  job_id: string;
  current_region: string;
  current_az: string;
  current_sku: string;
  model_size_gb: number;
  epoch_progress_pct: number;
}

export interface CheckpointEvent {
  job_id: string;
  status: string;
  checkpoint_saved: boolean;
  checkpoint_size_gb: number;
  save_duration_sec: number;
  from_az: string;
  to_az: string;
  downtime_ms: number;
  epoch_progress_pct: number;
  resumed: boolean;
  timeline: Array<{
    time_sec: number;
    event: string;
  }>;
}

export interface DashboardStats {
  total_jobs_managed: number;
  total_savings_usd: number;
  total_savings_eur: number;
  total_co2_saved_grams: number;
  total_checkpoints_saved: number;
  total_evictions_handled: number;
  avg_savings_pct: number;
  uptime_pct: number;
  regions_monitored: string[];
  last_updated: string; // ISO8601
}

export interface WeatherData {
  current_temp_c: number;
  current_wind_kmh: number;
  current_solar_wm2: number;
  hourly: Array<{
    hour: string;
    temp_c: number;
    wind_kmh: number;
    solar_wm2: number;
  }>;
}

export interface CarbonData {
  gco2_kwh: number;
  index: CarbonIndex;
  source: string;
  from?: string;
  to?: string;
  model?: {
    wind_cf: number;
    solar_cf: number;
    wind_share_pct: number;
    solar_share_pct: number;
    gas_share_pct: number;
  };
}

export interface ScraperStatus {
  last_scrape: string | null;
  scrape_count: number;
  total_gpus: number;
  regions: string[];
  price_history_points: Record<string, number>;
  errors: string[];
}
