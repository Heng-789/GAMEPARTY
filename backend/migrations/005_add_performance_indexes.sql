-- Performance Optimization Indexes
-- Add indexes to improve query performance and reduce database load

-- Answers table indexes
CREATE INDEX IF NOT EXISTS idx_answers_game_id ON answers(game_id);
CREATE INDEX IF NOT EXISTS idx_answers_user_id ON answers(user_id);
CREATE INDEX IF NOT EXISTS idx_answers_created_at ON answers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_answers_game_user ON answers(game_id, user_id);

-- Checkins table indexes
CREATE INDEX IF NOT EXISTS idx_checkins_game_id ON checkins(game_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_game_user ON checkins(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_day_index ON checkins(day_index);
CREATE INDEX IF NOT EXISTS idx_checkins_checkin_date ON checkins(checkin_date);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_hcoin ON users(hcoin DESC);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Games table indexes (if not already exist)
CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_type ON games(type);
CREATE INDEX IF NOT EXISTS idx_games_unlocked ON games(unlocked);

-- Bingo indexes
CREATE INDEX IF NOT EXISTS idx_bingo_cards_game_id ON bingo_cards(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_players_game_id ON bingo_players(game_id);
CREATE INDEX IF NOT EXISTS idx_bingo_players_user_id ON bingo_players(user_id);
CREATE INDEX IF NOT EXISTS idx_bingo_game_state_game_id ON bingo_game_state(game_id);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_game_id ON chat(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat(created_at DESC);

-- Presence indexes
CREATE INDEX IF NOT EXISTS idx_presence_game_id ON presence(game_id);
CREATE INDEX IF NOT EXISTS idx_presence_user_id ON presence(user_id);
CREATE INDEX IF NOT EXISTS idx_presence_game_user ON presence(game_id, user_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_answers_game_created ON answers(game_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_game_user_day ON checkins(game_id, user_id, day_index);

-- Analyze tables after creating indexes
ANALYZE answers;
ANALYZE checkins;
ANALYZE users;
ANALYZE games;
ANALYZE bingo_cards;
ANALYZE bingo_players;
ANALYZE bingo_game_state;
ANALYZE chat;
ANALYZE presence;

