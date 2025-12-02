-- PostgreSQL Migration: Create Reward Codes Table
-- This table stores reward codes for check-in games with atomic claim support
-- Supports multi-schema setup (heng36, max56, jeed24)

-- Function to create reward_codes table in a specific schema
CREATE OR REPLACE FUNCTION create_reward_codes_table(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Reward Codes Table (for daily rewards and complete rewards)
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.reward_codes (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    day_index INTEGER, -- NULL for complete rewards, INTEGER for daily rewards
    code VARCHAR(255) NOT NULL,
    code_type VARCHAR(50) NOT NULL DEFAULT ''daily'', -- ''daily'', ''complete'', ''coupon''
    coupon_item_index INTEGER, -- For coupon codes, which item index
    claimed_by VARCHAR(255) NULL,
    claimed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, day_index, code_type, coupon_item_index, code)
  )', schema_name);

  -- Indexes for fast lookups
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_reward_codes_game_day ON %I.reward_codes(game_id, day_index, code_type) WHERE claimed_by IS NULL', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_reward_codes_game_type ON %I.reward_codes(game_id, code_type) WHERE claimed_by IS NULL', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_reward_codes_coupon ON %I.reward_codes(game_id, code_type, coupon_item_index) WHERE claimed_by IS NULL AND code_type = ''coupon''', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_reward_codes_claimed_by ON %I.reward_codes(claimed_by)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_reward_codes_game_claimed ON %I.reward_codes(game_id, claimed_by)', schema_name, schema_name);

  -- Partial index for unclaimed codes (most common query)
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_reward_codes_unclaimed ON %I.reward_codes(game_id, day_index, code_type, coupon_item_index) 
    WHERE claimed_by IS NULL', schema_name, schema_name);

  -- Index for check-in queries optimization (if table exists)
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkins_game_user_day ON %I.checkins(game_id, user_id, day_index)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkins_user ON %I.checkins(user_id)', schema_name, schema_name);
END;
$$ LANGUAGE plpgsql;

-- Create reward_codes table in public schema (Supabase default)
-- For multi-schema setup, uncomment the schema-specific lines below
SELECT create_reward_codes_table('public');

-- Uncomment these if using separate schemas (not Supabase):
-- SELECT create_reward_codes_table('heng36');
-- SELECT create_reward_codes_table('max56');
-- SELECT create_reward_codes_table('jeed24');

-- Drop the function after use (optional, comment out if you want to keep it)
-- DROP FUNCTION create_reward_codes_table(TEXT);

