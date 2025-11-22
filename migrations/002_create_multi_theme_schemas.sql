-- PostgreSQL Migration: Create Multi-Theme Schemas
-- สร้าง schemas สำหรับ 3 ธีม: heng36, max56, jeed24

-- สร้าง function สำหรับอัพเดท updated_at (ต้องสร้างก่อน triggers)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- สร้าง schemas
CREATE SCHEMA IF NOT EXISTS heng36;
CREATE SCHEMA IF NOT EXISTS max56;
CREATE SCHEMA IF NOT EXISTS jeed24;

-- Function สำหรับสร้าง tables ในแต่ละ schema
CREATE OR REPLACE FUNCTION create_theme_tables(schema_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Users Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.users (
    user_id VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255),
    hcoin DECIMAL(15,2) DEFAULT 0 CHECK (hcoin >= 0),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_users_hcoin ON %I.users(hcoin DESC)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_users_status ON %I.users(status)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_users_created_at ON %I.users(created_at DESC)', schema_name, schema_name);

  -- Games Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.games (
    game_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    unlocked BOOLEAN DEFAULT true,
    locked BOOLEAN DEFAULT false,
    user_access_type VARCHAR(20) DEFAULT ''all'',
    selected_users JSONB,
    game_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_games_type ON %I.games(type)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_games_unlocked ON %I.games(unlocked)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_games_created_at ON %I.games(created_at DESC)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_games_name ON %I.games(name)', schema_name, schema_name);

  -- Checkins Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.checkins (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    day_index INTEGER NOT NULL,
    checked BOOLEAN DEFAULT false,
    checkin_date DATE NOT NULL,
    unique_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id, day_index)
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkins_game_user ON %I.checkins(game_id, user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkins_date ON %I.checkins(checkin_date)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkins_unique_key ON %I.checkins(unique_key)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkins_game_date ON %I.checkins(game_id, checkin_date)', schema_name, schema_name);

  -- Checkin Rewards Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.checkin_rewards (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    reward_type VARCHAR(50) NOT NULL,
    claimed BOOLEAN DEFAULT false,
    unique_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id, reward_type)
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkin_rewards_game_user ON %I.checkin_rewards(game_id, user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkin_rewards_unique_key ON %I.checkin_rewards(unique_key)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_checkin_rewards_type ON %I.checkin_rewards(reward_type)', schema_name, schema_name);

  -- Answers Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.answers (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    answer TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_answers_game ON %I.answers(game_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_answers_user ON %I.answers(user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_answers_created_at ON %I.answers(created_at DESC)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_answers_game_user ON %I.answers(game_id, user_id)', schema_name, schema_name);

  -- Presence Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.presence (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    room_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT ''online'',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_in_room BOOLEAN DEFAULT true,
    UNIQUE(game_id, room_id, user_id)
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_presence_game_room ON %I.presence(game_id, room_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_presence_user ON %I.presence(user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_presence_status ON %I.presence(status)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_presence_last_seen ON %I.presence(last_seen DESC)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_presence_game_room_status ON %I.presence(game_id, room_id, status)', schema_name, schema_name);

  -- Bingo Cards Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.bingo_cards (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    card_id VARCHAR(255) NOT NULL,
    numbers JSONB NOT NULL,
    checked_numbers JSONB,
    is_bingo BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id, card_id)
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_cards_game_user ON %I.bingo_cards(game_id, user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_cards_card_id ON %I.bingo_cards(card_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_cards_game ON %I.bingo_cards(game_id)', schema_name, schema_name);

  -- Bingo Players Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.bingo_players (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL,
    credit INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_ready BOOLEAN DEFAULT false,
    UNIQUE(game_id, user_id)
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_players_game ON %I.bingo_players(game_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_players_user ON %I.bingo_players(user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_players_ready ON %I.bingo_players(is_ready)', schema_name, schema_name);

  -- Bingo Game State Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.bingo_game_state (
    game_id VARCHAR(255) PRIMARY KEY,
    game_phase VARCHAR(20) DEFAULT ''waiting'',
    drawn_numbers JSONB DEFAULT ''[]''::jsonb,
    current_number INTEGER,
    game_started BOOLEAN DEFAULT false,
    ready_countdown INTEGER,
    ready_countdown_end TIMESTAMP,
    ready_players JSONB DEFAULT ''{}''::jsonb,
    auto_draw_interval INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_bingo_game_state_phase ON %I.bingo_game_state(game_phase)', schema_name, schema_name);

  -- Coin Transactions Table
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I.coin_transactions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    reason VARCHAR(255),
    unique_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )', schema_name);

  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_coin_transactions_user ON %I.coin_transactions(user_id)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_coin_transactions_unique_key ON %I.coin_transactions(unique_key)', schema_name, schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_coin_transactions_created_at ON %I.coin_transactions(created_at DESC)', schema_name, schema_name);

  -- Create triggers for updated_at
  EXECUTE format('CREATE TRIGGER update_%I_users_updated_at BEFORE UPDATE ON %I.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', schema_name, schema_name);

  EXECUTE format('CREATE TRIGGER update_%I_games_updated_at BEFORE UPDATE ON %I.games
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', schema_name, schema_name);

  EXECUTE format('CREATE TRIGGER update_%I_checkins_updated_at BEFORE UPDATE ON %I.checkins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', schema_name, schema_name);

  EXECUTE format('CREATE TRIGGER update_%I_checkin_rewards_updated_at BEFORE UPDATE ON %I.checkin_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', schema_name, schema_name);

  EXECUTE format('CREATE TRIGGER update_%I_presence_updated_at BEFORE UPDATE ON %I.presence
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', schema_name, schema_name);

  EXECUTE format('CREATE TRIGGER update_%I_bingo_game_state_updated_at BEFORE UPDATE ON %I.bingo_game_state
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', schema_name, schema_name);
END;
$$ LANGUAGE plpgsql;

-- สร้าง tables สำหรับทั้ง 3 schemas
SELECT create_theme_tables('heng36');
SELECT create_theme_tables('max56');
SELECT create_theme_tables('jeed24');

-- ลบ function หลังจากใช้เสร็จ (optional)
-- DROP FUNCTION create_theme_tables(TEXT);

