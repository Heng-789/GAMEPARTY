-- PostgreSQL Migration: Create Tables
-- Database: heng36game

-- Enable UUID extension (if needed)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  password VARCHAR(255),
  hcoin DECIMAL(15,2) DEFAULT 0 CHECK (hcoin >= 0),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_hcoin ON users(hcoin DESC);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 2. Games Table
CREATE TABLE IF NOT EXISTS games (
  game_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  unlocked BOOLEAN DEFAULT true,
  locked BOOLEAN DEFAULT false,
  user_access_type VARCHAR(20) DEFAULT 'all',
  selected_users JSONB,
  game_data JSONB, -- เก็บ game-specific data (puzzle, bingo, checkin, etc.)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_games_type ON games(type);
CREATE INDEX IF NOT EXISTS idx_games_unlocked ON games(unlocked);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_name ON games(name);

-- 3. Checkins Table
CREATE TABLE IF NOT EXISTS checkins (
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
);

CREATE INDEX IF NOT EXISTS idx_checkins_game_user ON checkins(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkins_unique_key ON checkins(unique_key);
CREATE INDEX IF NOT EXISTS idx_checkins_game_date ON checkins(game_id, checkin_date);

-- 4. Checkin Rewards Table
CREATE TABLE IF NOT EXISTS checkin_rewards (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  reward_type VARCHAR(50) NOT NULL, -- 'complete', 'daily'
  claimed BOOLEAN DEFAULT false,
  unique_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, user_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_checkin_rewards_game_user ON checkin_rewards(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_checkin_rewards_unique_key ON checkin_rewards(unique_key);
CREATE INDEX IF NOT EXISTS idx_checkin_rewards_type ON checkin_rewards(reward_type);

-- 5. Answers Table
CREATE TABLE IF NOT EXISTS answers (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  answer TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_answers_game ON answers(game_id);
CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_created_at ON answers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_game_user ON answers(game_id, user_id);

-- 6. Presence Table
CREATE TABLE IF NOT EXISTS presence (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  room_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'online', -- 'online', 'away', 'offline'
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_in_room BOOLEAN DEFAULT true,
  UNIQUE(game_id, room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_presence_game_room ON presence(game_id, room_id);
CREATE INDEX IF NOT EXISTS idx_presence_user ON presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_status ON presence(status);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_presence_game_room_status ON presence(game_id, room_id, status);

-- 7. Bingo Cards Table
CREATE TABLE IF NOT EXISTS bingo_cards (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  card_id VARCHAR(255) NOT NULL,
  numbers JSONB NOT NULL, -- 5x5 array
  checked_numbers JSONB, -- 5x5 boolean array
  is_bingo BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(game_id, user_id, card_id)
);

CREATE INDEX IF NOT EXISTS idx_bingo_cards_game_user ON bingo_cards(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bingo_cards_card_id ON bingo_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_bingo_cards_game ON bingo_cards(game_id);

-- 8. Bingo Players Table
CREATE TABLE IF NOT EXISTS bingo_players (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  credit INTEGER DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_ready BOOLEAN DEFAULT false,
  UNIQUE(game_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bingo_players_game ON bingo_players(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_players_user ON bingo_players(user_id);
CREATE INDEX IF NOT EXISTS idx_bingo_players_ready ON bingo_players(is_ready);

-- 9. Bingo Game State Table
CREATE TABLE IF NOT EXISTS bingo_game_state (
  game_id VARCHAR(255) PRIMARY KEY,
  game_phase VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'countdown', 'playing', 'finished'
  drawn_numbers JSONB DEFAULT '[]'::jsonb,
  current_number INTEGER,
  game_started BOOLEAN DEFAULT false,
  ready_countdown INTEGER,
  ready_countdown_end TIMESTAMP,
  ready_players JSONB DEFAULT '{}'::jsonb,
  auto_draw_interval INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bingo_game_state_phase ON bingo_game_state(game_phase);

-- 10. Coin Transactions Table
CREATE TABLE IF NOT EXISTS coin_transactions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reason VARCHAR(255),
  unique_key VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_unique_key ON coin_transactions(unique_key);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at DESC);

-- 11. Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 12. Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checkins_updated_at BEFORE UPDATE ON checkins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checkin_rewards_updated_at BEFORE UPDATE ON checkin_rewards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_presence_updated_at BEFORE UPDATE ON presence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bingo_game_state_updated_at BEFORE UPDATE ON bingo_game_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

