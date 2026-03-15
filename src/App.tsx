import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { LoginPage } from './pages/Login';
import { LobbyPage } from './pages/Lobby';
import { GamePage } from './pages/Game';
import type { User } from '@supabase/supabase-js';

function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) {
    return (
      <div className="min-h-screen stars-bg flex items-center justify-center">
        <div className="text-purple-400 text-xl animate-pulse">✦</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/lobby" replace /> : <LoginPage />}
        />
        <Route
          path="/lobby"
          element={user ? <LobbyPage /> : <Navigate to="/login" replace />}
        />
        <Route
          path="/game/:roomId"
          element={user ? <GamePage /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to={user ? '/lobby' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
