import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // We use email = username@cabo.game as a workaround for username-based auth
  // Sanitize: only allow alphanumeric, dots, hyphens, underscores
  const toEmail = (u: string) => {
    const sanitized = u.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
    return `${sanitized}@cabo.game`;
  };

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    if (username.includes('@')) {
      setError('Bitte keinen Email-Adresse verwenden — wähle einfach einen Benutzernamen (z.B. "vince").');
      return;
    }

    const sanitized = username.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
    if (!sanitized) {
      setError('Benutzername darf nur Buchstaben (a-z), Zahlen, Punkte, Bindestriche und Unterstriche enthalten.');
      return;
    }

    setLoading(true);
    setError('');

    const email = toEmail(username);

    if (mode === 'register') {
      const { error: signUpErr } = await supabase.auth.signUp({ email, password });
      if (signUpErr) {
        let msg = signUpErr.message;
        if (msg === 'User already registered') msg = 'Benutzername bereits vergeben.';
        else if (msg.includes('invalid format') || msg.includes('validate email')) msg = 'Ungültiger Benutzername. Bitte nur Buchstaben, Zahlen und einfache Sonderzeichen verwenden.';
        setError(msg);
        setLoading(false);
        return;
      }
      // Auto-sign in after register
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) { setError(signInErr.message); setLoading(false); return; }

      // Create profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          username: username.trim(),
          games_played: 0,
          games_won: 0,
        });
      }
    } else {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        setError('Benutzername oder Passwort falsch.');
        setLoading(false);
        return;
      }
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen stars-bg flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1
            className="text-6xl font-bold mb-2"
            style={{
              background: 'linear-gradient(135deg, #a78bfa, #fbbf24, #f472b6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'Georgia, serif',
              letterSpacing: '0.15em',
            }}
          >
            CABO
          </h1>
          <p className="text-purple-300 text-sm tracking-widest uppercase">Online Kartenspiel</p>
        </div>

        {/* Card */}
        <div className="card-panel p-6 space-y-4">
          {/* Toggle */}
          <div className="flex rounded-lg overflow-hidden border border-purple-800">
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-purple-700 text-white' : 'text-purple-300'}`}
              onClick={() => setMode('login')}
            >
              Anmelden
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'register' ? 'bg-purple-700 text-white' : 'text-purple-300'}`}
              onClick={() => setMode('register')}
            >
              Registrieren
            </button>
          </div>

          <input
            className="input-field"
            type="text"
            placeholder="Benutzername (z.B. vince)"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            className="input-field"
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            className="btn-primary w-full"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '...' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>
        </div>

        <p className="text-center text-purple-400 text-xs mt-4">
          Nur für privaten Gebrauch ✦ CABO Kartenspiel
        </p>
      </motion.div>
    </div>
  );
}
