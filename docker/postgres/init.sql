CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS game_records (
  id SERIAL PRIMARY KEY,
  room_code VARCHAR(10) UNIQUE NOT NULL,
  player_count INTEGER NOT NULL,
  winner_id INTEGER REFERENCES players(id),
  total_turns INTEGER,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP,
  status VARCHAR(20) DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS game_players (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES game_records(id),
  player_id INTEGER REFERENCES players(id),
  team_color VARCHAR(20),
  final_score INTEGER,
  final_tech_points INTEGER,
  final_resources INTEGER,
  base_destroyed BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_game_records_status ON game_records(status);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players(player_id);
