-- Run this in Supabase SQL Editor

-- ─── Profiles ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── Rooms ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  player0_id UUID REFERENCES auth.users(id) NOT NULL,
  player1_id UUID REFERENCES auth.users(id),
  player0_username TEXT NOT NULL,
  player1_username TEXT,
  game_state JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players can read their rooms" ON rooms FOR SELECT
  USING (auth.uid() = player0_id OR auth.uid() = player1_id OR status = 'waiting');
CREATE POLICY "Player0 can create rooms" ON rooms FOR INSERT
  WITH CHECK (auth.uid() = player0_id);
CREATE POLICY "Players can update their rooms" ON rooms FOR UPDATE
  USING (auth.uid() = player0_id OR auth.uid() = player1_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Enable Realtime ──────────────────────────────────────────────────────────
-- In Supabase Dashboard: Database → Replication → rooms table → Enable
-- Or run:
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- ─── Stats function ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_game_stats(
  winner_id UUID,
  p0_id UUID,
  p1_id UUID
)
RETURNS void AS $$
BEGIN
  -- Increment games_played for both
  UPDATE profiles SET games_played = games_played + 1 WHERE id = p0_id;
  UPDATE profiles SET games_played = games_played + 1 WHERE id = p1_id;
  -- Increment games_won for winner
  UPDATE profiles SET games_won = games_won + 1 WHERE id = winner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
