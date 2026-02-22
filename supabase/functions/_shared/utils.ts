// NERVE Engine Utils - Shared constants and helper functions
import type { Availability, CarbonIndex, GpuInstance } from "./types.ts";

// ── Regions Configuration ───────────────────────────────────────────────

export const REGIONS = {
  francecentral: {
    name: "France Central",
    cloud_provider: "azure",
    location: "Paris, France",
    lat: 48.8566,
    lng: 2.3522,
    timezone: "Europe/Paris",
    azs: [
      { id: "fr-central-1", name: "France Central AZ-1" },
      { id: "fr-central-2", name: "France Central AZ-2" },
      { id: "fr-central-3", name: "France Central AZ-3" },
    ],
  },
  westeurope: {
    name: "West Europe",
    cloud_provider: "azure",
    location: "Amsterdam, Netherlands",
    lat: 52.3676,
    lng: 4.9041,
    timezone: "Europe/Amsterdam",
    azs: [
      { id: "we-1", name: "West Europe AZ-1" },
      { id: "we-2", name: "West Europe AZ-2" },
      { id: "we-3", name: "West Europe AZ-3" },
    ],
  },
  uksouth: {
    name: "UK South",
    cloud_provider: "azure",
    location: "London, UK",
    lat: 51.5074,
    lng: -0.1278,
    timezone: "Europe/London",
    azs: [
      { id: "uk-south-1", name: "UK South AZ-1" },
      { id: "uk-south-2", name: "UK South AZ-2" },
      { id: "uk-south-3", name: "UK South AZ-3" },
    ],
  },
} as const;

export const GPU_SKU_PREFIXES = ["Standard_NC", "Standard_NV", "Standard_ND"];

// ── GPU Catalog ─────────────────────────────────────────────────────────

export const GPU_CATALOG: Record<string, {
  name: string;
  count: number;
  vcpus: number;
  ram_gb: number;
  tier: "low" | "mid" | "high" | "premium";
}> = {
  nc6s_v3: { name: "Tesla V100 (16GB)", count: 1, vcpus: 6, ram_gb: 112, tier: "high" },
  nc12s_v3: { name: "Tesla V100 (16GB)", count: 2, vcpus: 12, ram_gb: 224, tier: "high" },
  nc24s_v3: { name: "Tesla V100 (16GB)", count: 4, vcpus: 24, ram_gb: 448, tier: "high" },
  nc24rs_v3: { name: "Tesla V100 (16GB)", count: 4, vcpus: 24, ram_gb: 448, tier: "high" },
  nc4as_t4_v3: { name: "Tesla T4 (16GB)", count: 1, vcpus: 4, ram_gb: 28, tier: "mid" },
  nc8as_t4_v3: { name: "Tesla T4 (16GB)", count: 1, vcpus: 8, ram_gb: 56, tier: "mid" },
  nc16as_t4_v3: { name: "Tesla T4 (16GB)", count: 1, vcpus: 16, ram_gb: 110, tier: "mid" },
  nc64as_t4_v3: { name: "Tesla T4 (16GB)", count: 4, vcpus: 64, ram_gb: 440, tier: "mid" },
  nc8ads_a10_v4: { name: "A10 (24GB)", count: 1, vcpus: 8, ram_gb: 55, tier: "mid" },
  nc16ads_a10_v4: { name: "A10 (24GB)", count: 1, vcpus: 16, ram_gb: 110, tier: "mid" },
  nc32ads_a10_v4: { name: "A10 (24GB)", count: 2, vcpus: 32, ram_gb: 220, tier: "mid" },
  nc48ads_a100_v4: { name: "A100 (80GB)", count: 2, vcpus: 48, ram_gb: 440, tier: "premium" },
  nc96ads_a100_v4: { name: "A100 (80GB)", count: 4, vcpus: 96, ram_gb: 880, tier: "premium" },
  ncc40ads_h100_v5: { name: "H100 (80GB)", count: 1, vcpus: 40, ram_gb: 320, tier: "premium" },
  nc80adis_h100_v5: { name: "H100 (80GB)", count: 2, vcpus: 80, ram_gb: 640, tier: "premium" },
  nv6ads_a10_v5: { name: "A10 (6GB slice)", count: 1, vcpus: 6, ram_gb: 55, tier: "low" },
  nv12ads_a10_v5: { name: "A10 (12GB slice)", count: 1, vcpus: 12, ram_gb: 110, tier: "low" },
  nv18ads_a10_v5: { name: "A10 (18GB slice)", count: 1, vcpus: 18, ram_gb: 220, tier: "mid" },
  nv36ads_a10_v5: { name: "A10 (24GB)", count: 1, vcpus: 36, ram_gb: 440, tier: "mid" },
  nv4as_v4: { name: "Radeon MI25 (4GB)", count: 1, vcpus: 4, ram_gb: 14, tier: "low" },
  nv8as_v4: { name: "Radeon MI25 (8GB)", count: 1, vcpus: 8, ram_gb: 28, tier: "low" },
  nv16as_v4: { name: "Radeon MI25 (16GB)", count: 1, vcpus: 16, ram_gb: 56, tier: "low" },
  nv32as_v4: { name: "Radeon MI25 (32GB)", count: 1, vcpus: 32, ram_gb: 112, tier: "low" },
  nv12s_v3: { name: "Tesla M60 (8GB)", count: 1, vcpus: 12, ram_gb: 112, tier: "low" },
  nv24s_v3: { name: "Tesla M60 (16GB)", count: 2, vcpus: 24, ram_gb: 224, tier: "low" },
  nv48s_v3: { name: "Tesla M60 (32GB)", count: 4, vcpus: 48, ram_gb: 448, tier: "low" },
};

// ── Scoring Weights ────────────────────────────────────────────────────

export const WEIGHTS = {
  price: 0.50,
  carbon: 0.20,
  availability: 0.15,
  cooling: 0.10,
  renewable: 0.05,
};

export const EUR_USD = 0.92;

export const KWH_PER_GPU_HR: Record<string, number> = {
  v100: 0.30,
  t4: 0.07,
  a10: 0.15,
  a100: 0.40,
  h100: 0.70,
  m60: 0.15,
  mi25: 0.10,
};

export const AVAIL_SCORES: Record<Availability, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
  very_low: 0.1,
};

// ── Grid Mix & Carbon ───────────────────────────────────────────────────

export const GRID_MIX = {
  francecentral: {
    nuclear: 0.70,
    hydro: 0.12,
    wind_max: 0.10,
    solar_max: 0.05,
    gas_base: 0.08,
  },
  westeurope: {
    nuclear: 0.03,
    hydro: 0.00,
    wind_max: 0.22,
    solar_max: 0.12,
    gas_base: 0.52,
    coal_base: 0.05,
  },
};

export const EMISSION_FACTORS = {
  nuclear: 12,
  hydro: 24,
  wind: 11,
  solar: 45,
  gas: 490,
  coal: 820,
  other: 300,
};

// ── Time-Shifting ───────────────────────────────────────────────────────

export const INTRADAY_MULTIPLIERS: Record<number, number> = {
  0: 0.72, 1: 0.65, 2: 0.60, 3: 0.58, 4: 0.60, 5: 0.65,
  6: 0.75, 7: 0.85, 8: 0.92, 9: 0.98, 10: 1.05, 11: 1.10,
  12: 1.12, 13: 1.10, 14: 1.05, 15: 0.98, 16: 0.92, 17: 0.88,
  18: 0.82, 19: 0.78, 20: 0.75, 21: 0.73, 22: 0.72, 23: 0.72,
};

// ── Checkpointing ──────────────────────────────────────────────────────

export const NEIGHBOR_AZ: Record<string, string> = {
  "fr-central-1": "fr-central-2",
  "fr-central-2": "fr-central-3",
  "fr-central-3": "fr-central-1",
  "we-1": "we-2",
  "we-2": "we-3",
  "we-3": "we-1",
  "uk-south-1": "uk-south-2",
  "uk-south-2": "uk-south-3",
  "uk-south-3": "uk-south-1",
};

export const S3_UPLOAD_GBPS = 1.2;

// ── Helper Functions ────────────────────────────────────────────────────

export function identifyGPU(sku: string): typeof GPU_CATALOG[string] | null {
  const s = sku.toLowerCase();
  for (const [key, specs] of Object.entries(GPU_CATALOG)) {
    if (s.includes(key)) {
      return specs;
    }
  }
  return null;
}

export function estimateAvailability(
  price: number,
  tier: string,
  spot: number = 0,
  ondemand: number = 0
): Availability {
  if (ondemand > 0 && spot > 0) {
    const ratio = spot / ondemand;
    if (ratio > 0.70) return "low";
    if (ratio > 0.45) return "medium";
    return "high";
  }

  // Fallback: tier-based
  if (tier === "premium") return "low";
  if (tier === "high") return price > 2.0 ? "medium" : "high";
  if (tier === "mid") return "high";
  return "high";
}

export function azPriceVariation(basePrice: number, azId: string, sku: string): number {
  const hour = new Date().getUTCHours();
  const seed = `${azId}:${sku}:${hour}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to float in [-1, 1]
  const val = (Math.abs(hash) % 0xFFFFFFFF) / 0xFFFFFFFF * 2 - 1;
  const variationPct = val * 0.05; // ±5% average
  
  return Math.round(basePrice * (1 + variationPct) * 1000000) / 1000000;
}

export function azAvailabilityShift(baseAvail: Availability, azId: string): Availability {
  const seed = `${azId}:load`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const loadVal = Math.abs(hash) % 10;
  if (loadVal < 3) {
    if (baseAvail === "high") return "medium";
    if (baseAvail === "medium") return "low";
  }
  return baseAvail;
}

export function estimateCarbonFromWeather(
  regionId: string,
  windKmh: number,
  solarWm2: number
): {
  gco2_kwh: number;
  index: CarbonIndex;
  source: string;
  model: {
    wind_cf: number;
    solar_cf: number;
    wind_share_pct: number;
    solar_share_pct: number;
    gas_share_pct: number;
  };
} {
  const mix = GRID_MIX[regionId as keyof typeof GRID_MIX];
  if (!mix) {
    return {
      gco2_kwh: 100.0,
      index: "low",
      source: "default",
      model: { wind_cf: 0, solar_cf: 0, wind_share_pct: 0, solar_share_pct: 0, gas_share_pct: 0 },
    };
  }

  // Wind capacity factor: 0-1 based on live wind speed
  const windCf = Math.min(Math.max((windKmh - 5) / 40.0, 0.0), 1.0);
  const windShare = (mix.wind_max || 0) * windCf;

  // Solar capacity factor: 0-1 based on live solar radiation
  const solarCf = Math.min(Math.max(solarWm2 / 800.0, 0.0), 1.0);
  const solarShare = (mix.solar_max || 0) * solarCf;

  // Fixed sources
  const nuclearShare = mix.nuclear || 0;
  const hydroShare = mix.hydro || 0;
  const coalShare = (mix as any).coal_base || 0;

  // Gas fills the remaining demand
  const totalClean = nuclearShare + hydroShare + windShare + solarShare;
  const gasShare = Math.max(1.0 - totalClean - coalShare, (mix.gas_base || 0) * 0.5);

  // Weighted average carbon intensity
  const gco2 = Math.round((
    nuclearShare * EMISSION_FACTORS.nuclear +
    hydroShare * EMISSION_FACTORS.hydro +
    windShare * EMISSION_FACTORS.wind +
    solarShare * EMISSION_FACTORS.solar +
    gasShare * EMISSION_FACTORS.gas +
    coalShare * EMISSION_FACTORS.coal
  ) * 10) / 10;

  let index: CarbonIndex;
  if (gco2 < 80) index = "very low";
  else if (gco2 < 150) index = "low";
  else if (gco2 < 250) index = "moderate";
  else if (gco2 < 400) index = "high";
  else index = "very high";

  return {
    gco2_kwh: gco2,
    index,
    source: `NERVE weather-based model (wind=${Math.round(windKmh)}km/h, solar=${Math.round(solarWm2)}W/m2)`,
    model: {
      wind_cf: Math.round(windCf * 100) / 100,
      solar_cf: Math.round(solarCf * 100) / 100,
      wind_share_pct: Math.round(windShare * 1000) / 10,
      solar_share_pct: Math.round(solarShare * 1000) / 10,
      gas_share_pct: Math.round(gasShare * 1000) / 10,
    },
  };
}

export function scoreGPU(
  gpu: GpuInstance,
  carbonGco2: number,
  tempC: number,
  windKmh: number
): number {
  const normPrice = Math.min(gpu.spot_price_usd_hr / 15.0, 1.0);
  const normCarbon = Math.min(carbonGco2 / 500.0, 1.0);
  const availScore = AVAIL_SCORES[gpu.availability] || 0.5;
  const normCooling = Math.min(Math.max(tempC, 0) / 40.0, 1.0);
  const renewScore = Math.min(windKmh / 50.0, 1.0);

  return (
    WEIGHTS.price * normPrice +
    WEIGHTS.carbon * normCarbon +
    WEIGHTS.availability * (1 - availScore) +
    WEIGHTS.cooling * normCooling +
    WEIGHTS.renewable * (1 - renewScore)
  );
}

export function gpuFamily(gpuName: string): string {
  const lower = gpuName.toLowerCase();
  for (const fam of ["h100", "a100", "a10", "v100", "t4", "m60", "mi25"]) {
    if (lower.includes(fam)) return fam;
  }
  return "v100";
}

// ── CORS Headers ───────────────────────────────────────────────────────

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
