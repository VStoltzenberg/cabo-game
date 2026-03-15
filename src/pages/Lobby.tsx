import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { createInitialGameState } from '../game/engine';
import { motion } from 'framer-motion';
import type { Profile } from '../types/game';

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function LobbyPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [myRoom, setMyRoom] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<{ games_played: number; games_won: number } | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) setProfile(data);
    setStats({ games_played: data?.games_played ?? 0, games_won: data?.games_won ?? 0 });
  }

  async function createRoom() {
    if (!profile) return;
    setLoading(true);
    setError('');

    const code = generateCode();
    const { data, error: err } = await supabase
      .from('rooms')
      .insert({
        code,
        player0_id: profile.id,
        player0_username: profile.username,
        game_state: createInitialGameState(),
        status: 'waiting',
      })
      .select()
      .single();

    if (err || !data) {
      setError('Fehler beim Erstellen des Raums.');
      setLoading(false);
      return;
    }

    setMyRoom(data.id);
    setRoomCode(code);
    setLoading(false);

    // Watch for opponent joining
    const channel = supabase
      .channel(`room-${data.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${data.id}`,
      }, (payload) => {
        const room = payload.new as any;
        if (room.player1_id && room.status === 'active') {
          channel.unsubscribe();
          navigate(`/game/${data.id}`);
        }
      })
      .subscribe();
  }

  async function joinRoom() {
    if (!profile || !joinCode.trim()) {
      setError('Bitte Code eingeben.');
      return;
    }
    setLoading(true);
    setError('');

    const { data: room, error: err } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', joinCode.toUpperCase().trim())
      .eq('status', 'waiting')
      .single();

    if (err || !room) {
      setError('Raum nicht gefunden oder bereits voll.');
      setLoading(false);
      return;
    }

    if (room.player0_id === profile.id) {
      setError('Das ist dein eigener Raum!');
      setLoading(false);
      return;
    }

    // Join as player1 and start the game
    const initialState = createInitialGameState();
    const { error: updateErr } = await supabase
      .from('rooms')
      .update({
        player1_id: profile.id,
        player1_username: profile.username,
        status: 'active',
        game_state: initialState,
      })
      .eq('id', room.id);

    if (updateErr) {
      setError('Fehler beim Beitreten.');
      setLoading(false);
      return;
    }

    navigate(`/game/${room.id}`);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen stars-bg p-4 safe-top safe-bottom">
      <div className="max-w-md mx-auto space-y-4">

        {/* Header */}
        <div className="flex justify-between items-center pt-2 pb-4">
          <h1
            className="text-3xl font-bold"
            style={{
              background: 'linear-gradient(135deg, #a78bfa, #fbbf24)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Georgia, serif',
            }}
          >
            CABO
          </h1>
          <div className="text-right">
            <p className="text-purple-200 text-sm">{profile?.username}</p>
            <button onClick={signOut} className="text-purple-400 text-xs hover:text-purple-300">
              Abmelden
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="card-panel p-4 flex justify-around">
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-300">{stats.games_played}</p>
              <p className="text-xs text-purple-400">Spiele</p>
            </div>
            <div className="w-px bg-purple-800" />
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400">{stats.games_won}</p>
              <p className="text-xs text-purple-400">Siege</p>
            </div>
            <div className="w-px bg-purple-800" />
            <div className="text-center">
              <p className="text-2xl font-bold text-pink-400">
                {stats.games_played > 0 ? Math.round((stats.games_won / stats.games_played) * 100) : 0}%
              </p>
              <p className="text-xs text-purple-400">Gewinnrate</p>
            </div>
          </div>
        )}

        {/* Create Room */}
        {!myRoom ? (
          <motion.div
            className="card-panel p-5 space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-lg font-bold text-purple-200">Neues Spiel starten</h2>
            <p className="text-purple-400 text-sm">Erstelle einen Raum und teile den Code mit deinem Freund.</p>
            <button className="btn-primary w-full" onClick={createRoom} disabled={loading}>
              {loading ? 'Erstelle...' : '✦ Raum erstellen'}
            </button>
          </motion.div>
        ) : (
          <motion.div
            className="card-panel p-5 space-y-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <h2 className="text-lg font-bold text-purple-200">Warte auf Mitspieler...</h2>
            <div className="bg-midnight rounded-xl p-4 text-center">
              <p className="text-purple-400 text-xs mb-1 uppercase tracking-widest">Dein Code</p>
              <p
                className="text-4xl font-bold tracking-[0.3em]"
                style={{ color: '#fbbf24', fontFamily: 'monospace' }}
              >
                {roomCode}
              </p>
            </div>
            <p className="text-purple-300 text-sm text-center">
              Teile diesen Code mit deinem Freund. Das Spiel startet automatisch.
            </p>
            <div className="flex items-center gap-2 justify-center">
              <div className="w-2 h-2 rounded-full bg-green-400 pulse-active" />
              <span className="text-green-400 text-sm">Warte auf Beitritt...</span>
            </div>
          </motion.div>
        )}

        {/* Join Room */}
        <div className="card-panel p-5 space-y-3">
          <h2 className="text-lg font-bold text-purple-200">Spiel beitreten</h2>
          <input
            className="input-field"
            type="text"
            placeholder="Raum-Code eingeben"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && joinRoom()}
            maxLength={6}
            style={{ letterSpacing: '0.2em', textAlign: 'center', fontSize: '1.2rem' }}
          />
          <button className="btn-secondary w-full" onClick={joinRoom} disabled={loading}>
            {loading ? 'Beitreten...' : 'Beitreten →'}
          </button>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center card-panel p-3">{error}</p>
        )}

        {/* Rules quick ref */}
        <div className="card-panel p-4">
          <p className="text-purple-300 text-xs font-bold mb-2 uppercase tracking-widest">Kurzregeln</p>
          <div className="space-y-1 text-purple-400 text-xs">
            <p>🦄 <b className="text-purple-300">Ziel:</b> Niedrigste Gesamtpunktzahl am Rundenende</p>
            <p>🃏 Jeder erhält 4 verdeckte Karten, merke dir 2 davon</p>
            <p>🎯 Ziehe vom Stapel, ersetze eine eigene Karte oder wirf ab</p>
            <p>📢 Ruf CABO wenn du die niedrigste Summe glaubst</p>
            <p>🔍 7/8 = Peek | 👁️ 9/10 = Spy | 🔄 11/12 = Swap</p>
          </div>
        </div>
      </div>
    </div>
  );
}
