-- NERVE Engine Tables
-- Stats and cache tables for Edge Functions

-- Stats table for dashboard
CREATE TABLE IF NOT EXISTS nerve_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_jobs integer DEFAULT 0,
  total_savings_usd numeric DEFAULT 0,
  total_co2_saved_g numeric DEFAULT 0,
  total_checkpoints integer DEFAULT 0,
  total_evictions integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Initialize with single row
INSERT INTO nerve_stats (id, total_jobs, total_savings_usd, total_co2_saved_g, total_checkpoints, total_evictions)
VALUES (gen_random_uuid(), 0, 0, 0, 0, 0)
ON CONFLICT DO NOTHING;

-- Cache table for scraper data (optional, for rate limiting)
CREATE TABLE IF NOT EXISTS nerve_cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_nerve_cache_expires_at ON nerve_cache(expires_at);

-- Enable RLS
ALTER TABLE nerve_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE nerve_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read for stats (dashboard)
CREATE POLICY "Allow public read nerve_stats" ON nerve_stats
  FOR SELECT USING (true);

-- Allow service role to update stats
CREATE POLICY "Allow service role update nerve_stats" ON nerve_stats
  FOR UPDATE USING (auth.role() = 'service_role');

-- Allow service role to insert stats
CREATE POLICY "Allow service role insert nerve_stats" ON nerve_stats
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Cache policies (service role only)
CREATE POLICY "Allow service role cache" ON nerve_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update stats atomically
CREATE OR REPLACE FUNCTION update_nerve_stats(
  jobs_delta integer DEFAULT 0,
  savings_delta numeric DEFAULT 0,
  co2_delta numeric DEFAULT 0,
  checkpoints_delta integer DEFAULT 0,
  evictions_delta integer DEFAULT 0
) RETURNS void AS $$
BEGIN
  UPDATE nerve_stats
  SET
    total_jobs = total_jobs + jobs_delta,
    total_savings_usd = total_savings_usd + savings_delta,
    total_co2_saved_g = total_co2_saved_g + co2_delta,
    total_checkpoints = total_checkpoints + checkpoints_delta,
    total_evictions = total_evictions + evictions_delta,
    updated_at = now()
  WHERE id = (SELECT id FROM nerve_stats LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
