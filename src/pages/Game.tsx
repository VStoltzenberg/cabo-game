import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CardComponent, CardBack } from '../components/Card';
import type { Card, GameState, GameRoom } from '../types/game';
import {
  confirmInitialPeek,
  drawFromDeck,
  drawFromDiscard,
  discardDrawnCard,
  replaceCardInHand,
  resolvePeek,
  resolveSpy,
  resolveSwapChooseOwn,
  resolveSwapChooseOpponent,
  callCabo,
  calculateRoundEnd,
  createInitialGameState,
} from '../game/engine';

export function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [myUserId, setMyUserId] = useState<string>('');
  const [myUsername, setMyUsername] = useState<string>('');
  const [myIndex, setMyIndex] = useState<0 | 1 | null>(null);
  const [gs, setGs] = useState<GameState | null>(null);
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set()); // "playerIdx-cardIdx"
  const [peekCount, setPeekCount] = useState(0); // how many initial peeks done
  const [showPeekCard, setShowPeekCard] = useState<{ playerIdx: number; cardIdx: number; card: Card } | null>(null);
  const [selectedOwnCard, setSelectedOwnCard] = useState<number | null>(null);
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [notification, setNotification] = useState('');
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMyTurn = myIndex !== null && gs?.currentTurn === myIndex && gs.phase === 'playing';
  const opponentIndex: 0 | 1 = myIndex === 0 ? 1 : 0;

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !roomId) return;
      setMyUserId(user.id);

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      if (profile) setMyUsername(profile.username);

      const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      if (!roomData) { navigate('/lobby'); return; }

      const r = roomData as GameRoom;
      setRoom(r);
      const idx = r.player0_id === user.id ? 0 : 1;
      setMyIndex(idx);
      setGs(r.game_state);

      // Subscribe to realtime updates
      supabase
        .channel(`game-${roomId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        }, (payload) => {
          const updated = payload.new as GameRoom;
          setRoom(updated);
          const newGs = updated.game_state;
          setGs(newGs);
          if (newGs.phase === 'round_end' || newGs.phase === 'game_over') {
            setShowRoundEnd(true);
            setRevealedCards(new Set()); // reset revealed memory
            setPeekCount(0);
          }
          showNotif(newGs.lastEvent);
        })
        .subscribe();
    }
    init();
  }, [roomId]);

  // ── Persist state ────────────────────────────────────────────────────
  const persistState = useCallback(async (newGs: GameState) => {
    if (!roomId) return;
    await supabase
      .from('rooms')
      .update({
        game_state: newGs,
        status: newGs.phase === 'game_over' ? 'finished' : 'active',
      })
      .eq('id', roomId);
  }, [roomId]);

  function showNotif(msg: string) {
    setNotification(msg);
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotification(''), 3000);
  }

  // ── Initial Peek ──────────────────────────────────────────────────────
  function handleInitialPeekCard(cardIdx: number) {
    if (!gs || myIndex === null || peekCount >= 2) return;
    if (gs.phase !== 'initial_peek') return;
    const card = gs.hands[myIndex][cardIdx];
    const key = `${myIndex}-${cardIdx}`;
    if (revealedCards.has(key)) return;

    setRevealedCards(prev => new Set([...prev, key]));
    setPeekCount(c => c + 1);
    setShowPeekCard({ playerIdx: myIndex, cardIdx, card });
    setTimeout(() => setShowPeekCard(null), 2000);
  }

  async function confirmReady() {
    if (!gs || myIndex === null) return;
    const newGs = confirmInitialPeek(gs, myIndex);
    setGs(newGs);
    await persistState(newGs);
  }

  // ── Draw Card ─────────────────────────────────────────────────────────
  async function handleDrawDeck() {
    if (!gs || !isMyTurn || gs.drawnCard) return;
    const newGs = drawFromDeck(gs);
    setGs(newGs);
    await persistState(newGs);
  }

  async function handleDrawDiscard() {
    if (!gs || !isMyTurn || gs.drawnCard || gs.discardPile.length === 0) return;
    const newGs = drawFromDiscard(gs);
    setGs(newGs);
    await persistState(newGs);
  }

  // ── Use drawn card ────────────────────────────────────────────────────
  async function handleDiscardDrawn() {
    if (!gs || !isMyTurn || !gs.drawnCard) return;
    const newGs = discardDrawnCard(gs);
    setGs(newGs);
    await persistState(newGs);
  }

  async function handleReplaceCard(cardIdx: number) {
    if (!gs || myIndex === null) return;

    // If it's a swap action and choosing own card
    if (gs.pendingAction?.type === 'swap' && gs.pendingAction.step === 'choose_swap_own' && gs.currentTurn === myIndex) {
      const newGs = resolveSwapChooseOwn(gs, cardIdx);
      setGs(newGs);
      await persistState(newGs);
      return;
    }

    // Normal replace
    if (!isMyTurn || !gs.drawnCard) return;
    const newGs = replaceCardInHand(gs, cardIdx);
    setGs(newGs);
    await persistState(newGs);
  }

  // ── Action handlers ───────────────────────────────────────────────────
  async function handlePeekCard(cardIdx: number) {
    if (!gs || myIndex === null) return;
    if (gs.pendingAction?.type === 'peek' && gs.currentTurn === myIndex) {
      const card = gs.hands[myIndex][cardIdx];
      setShowPeekCard({ playerIdx: myIndex, cardIdx, card });
      setTimeout(async () => {
        setShowPeekCard(null);
        const newGs = resolvePeek(gs, cardIdx);
        setGs(newGs);
        await persistState(newGs);
      }, 2000);
    }
  }

  async function handleSpyCard(cardIdx: number) {
    if (!gs || myIndex === null) return;
    if (gs.pendingAction?.type === 'spy' && gs.currentTurn === myIndex) {
      const card = gs.hands[opponentIndex][cardIdx];
      setShowPeekCard({ playerIdx: opponentIndex, cardIdx, card });
      setTimeout(async () => {
        setShowPeekCard(null);
        const newGs = resolveSpy(gs, cardIdx);
        setGs(newGs);
        await persistState(newGs);
      }, 2000);
    }
  }

  async function handleSwapOpponentCard(cardIdx: number) {
    if (!gs || myIndex === null) return;
    if (gs.pendingAction?.type === 'swap' && gs.pendingAction.step === 'choose_swap_opponent' && gs.currentTurn === myIndex) {
      const newGs = resolveSwapChooseOpponent(gs, cardIdx);
      setGs(newGs);
      await persistState(newGs);
    }
  }

  async function handleCallCabo() {
    if (!gs || !isMyTurn || gs.phase !== 'playing') return;
    const newGs = callCabo(gs, myUserId);
    setGs(newGs);
    await persistState(newGs);
  }

  async function handleEndRound() {
    if (!gs || !room) return;
    const playerIds: [string, string] = [room.player0_id, room.player1_id ?? ''];
    const newGs = calculateRoundEnd(gs, playerIds);
    setGs(newGs);
    await persistState(newGs);
    // Update profiles
    if (newGs.winner) {
      await supabase.rpc('increment_game_stats', {
        winner_id: newGs.winner,
        p0_id: playerIds[0],
        p1_id: playerIds[1],
      });
    }
  }

  async function handleNextRound() {
    if (!gs) return;
    const newGs = createInitialGameState(gs);
    setGs(newGs);
    setShowRoundEnd(false);
    setRevealedCards(new Set());
    setPeekCount(0);
    await persistState(newGs);
  }

  // ── Render helpers ────────────────────────────────────────────────────
  function getCardClickHandler(playerIdx: number, cardIdx: number) {
    if (!gs || myIndex === null) return undefined;

    const phase = gs.phase;
    const pending = gs.pendingAction;
    const isCurrentPlayer = gs.currentTurn === myIndex;

    // Initial peek
    if (phase === 'initial_peek' && playerIdx === myIndex && peekCount < 2) {
      return () => handleInitialPeekCard(cardIdx);
    }

    // Replace with drawn card
    if (phase === 'playing' && gs.drawnCard && isCurrentPlayer && !pending && playerIdx === myIndex) {
      return () => handleReplaceCard(cardIdx);
    }

    // Peek action – own card
    if (pending?.type === 'peek' && isCurrentPlayer && playerIdx === myIndex) {
      return () => handlePeekCard(cardIdx);
    }

    // Spy action – opponent card
    if (pending?.type === 'spy' && isCurrentPlayer && playerIdx === opponentIndex) {
      return () => handleSpyCard(cardIdx);
    }

    // Swap: choose own card
    if (pending?.type === 'swap' && pending.step === 'choose_swap_own' && isCurrentPlayer && playerIdx === myIndex) {
      return () => handleReplaceCard(cardIdx);
    }

    // Swap: choose opponent card
    if (pending?.type === 'swap' && pending.step === 'choose_swap_opponent' && isCurrentPlayer && playerIdx === opponentIndex) {
      return () => handleSwapOpponentCard(cardIdx);
    }

    return undefined;
  }

  function isCardHighlighted(playerIdx: number, cardIdx: number): boolean {
    if (!gs || myIndex === null) return false;
    const pending = gs.pendingAction;
    const isCurrentPlayer = gs.currentTurn === myIndex;

    if (gs.phase === 'initial_peek' && playerIdx === myIndex && peekCount < 2) return true;
    if (gs.drawnCard && !pending && isCurrentPlayer && gs.phase === 'playing' && playerIdx === myIndex) return true;
    if (pending?.type === 'peek' && isCurrentPlayer && playerIdx === myIndex) return true;
    if (pending?.type === 'spy' && isCurrentPlayer && playerIdx === opponentIndex) return true;
    if (pending?.type === 'swap' && pending.step === 'choose_swap_own' && isCurrentPlayer && playerIdx === myIndex) return true;
    if (pending?.type === 'swap' && pending.step === 'choose_swap_opponent' && isCurrentPlayer && playerIdx === opponentIndex) return true;
    return false;
  }

  function isCardFaceUp(playerIdx: number, cardIdx: number): boolean {
    if (!gs) return false;
    if (gs.phase === 'round_end' || gs.phase === 'game_over') return true;
    const key = `${playerIdx}-${cardIdx}`;
    return revealedCards.has(key);
  }

  function getActionHint(): string {
    if (!gs || myIndex === null) return '';
    const pending = gs.pendingAction;
    const isCurrentPlayer = gs.currentTurn === myIndex;

    if (gs.phase === 'initial_peek') {
      if (!gs.initialPeekReady[myIndex]) {
        return peekCount >= 2 ? 'Drücke "Bereit" wenn du dir die Karten gemerkt hast.' : `Tippe auf ${2 - peekCount} ${2 - peekCount === 1 ? 'Karte' : 'Karten'} zum Anschauen (${peekCount}/2).`;
      }
      return 'Warte auf Gegner...';
    }
    if (!isCurrentPlayer) return 'Warte auf den Zug des Gegners...';
    if (!gs.drawnCard) return 'Ziehe eine Karte vom Stapel oder der Ablage.';
    if (pending?.type === 'peek') return '👁️ Peek: Wähle eine eigene Karte zum Anschauen.';
    if (pending?.type === 'spy') return '🔍 Spy: Wähle eine Karte des Gegners zum Anschauen.';
    if (pending?.type === 'swap' && pending.step === 'choose_swap_own') return '🔄 Swap: Wähle eine deiner eigenen Karten.';
    if (pending?.type === 'swap' && pending.step === 'choose_swap_opponent') return '🔄 Swap: Wähle eine Karte des Gegners.';
    if (gs.drawnCard) return 'Ersetze eine eigene Karte ODER wirf die gezogene Karte ab.';
    return '';
  }

  if (!gs || myIndex === null || !room) {
    return (
      <div className="min-h-screen stars-bg flex items-center justify-center">
        <p className="text-purple-300">Lade Spiel...</p>
      </div>
    );
  }

  const myHand = gs.hands[myIndex];
  const opponentHand = gs.hands[opponentIndex];
  const topDiscard = gs.discardPile[gs.discardPile.length - 1];
  const opponentName = myIndex === 0 ? room.player1_username : room.player0_username;
  const myScore = gs.cumulativeScores[myIndex];
  const opponentScore = gs.cumulativeScores[opponentIndex];

  const caboAvailable = isMyTurn && !gs.drawnCard && gs.phase === 'playing';

  return (
    <div className="min-h-screen stars-bg flex flex-col safe-top safe-bottom"
      style={{ maxHeight: '100dvh', overflow: 'hidden' }}>

      {/* ── Notification bar ── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 z-50 text-center py-2 px-4 text-sm"
            style={{ background: 'rgba(45,27,105,0.95)', borderBottom: '1px solid rgba(167,139,250,0.3)' }}
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scores ── */}
      <div className="flex justify-between items-center px-4 py-2 pt-10"
        style={{ borderBottom: '1px solid rgba(167,139,250,0.1)' }}>
        <div className="text-center">
          <p className="text-xs text-purple-400">{opponentName ?? 'Gegner'}</p>
          <p className="text-xl font-bold" style={{ color: '#f472b6' }}>{opponentScore}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-purple-400">Runde {gs.round}</p>
          <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${gs.currentTurn === myIndex ? 'bg-green-400' : 'bg-red-400'}`} />
        </div>
        <div className="text-center">
          <p className="text-xs text-purple-400">Du ({myUsername})</p>
          <p className="text-xl font-bold" style={{ color: '#4ade80' }}>{myScore}</p>
        </div>
      </div>

      {/* ── Opponent hand ── */}
      <div className="flex justify-center gap-2 py-3 px-2">
        {opponentHand.map((card, i) => {
          const handler = getCardClickHandler(opponentIndex, i);
          const highlighted = isCardHighlighted(opponentIndex, i);
          const faceUp = isCardFaceUp(opponentIndex, i);
          return faceUp ? (
            <CardComponent key={card.id} card={card} size="sm" onClick={handler} highlighted={highlighted} />
          ) : (
            <div key={i} onClick={handler}
              className={`rounded-xl ${highlighted ? 'ring-2 ring-blue-400' : ''}`}>
              <CardBack size="sm" />
            </div>
          );
        })}
      </div>

      {/* ── Center: Draw & Discard ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        
        {/* Action hint */}
        <p className="text-purple-300 text-xs text-center px-4 min-h-[2em]">{getActionHint()}</p>

        {/* Stacks */}
        <div className="flex items-center gap-6">
          {/* Draw pile */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-purple-400 text-xs">Stapel ({gs.deck.length})</p>
            <div
              onClick={isMyTurn && !gs.drawnCard ? handleDrawDeck : undefined}
              className={isMyTurn && !gs.drawnCard ? 'cursor-pointer hover:scale-105 transition-transform' : 'opacity-60'}
            >
              <CardBack size="md" />
            </div>
          </div>

          {/* Drawn card (in hand) */}
          {gs.drawnCard && gs.currentTurn === myIndex && (
            <div className="flex flex-col items-center gap-1">
              <p className="text-yellow-400 text-xs">Gezogen</p>
              <div className="relative">
                <CardComponent card={gs.drawnCard} size="md" />
              </div>
              {!gs.pendingAction && (
                <button
                  className="text-xs text-red-400 hover:text-red-300 mt-1"
                  onClick={handleDiscardDrawn}
                >
                  ✕ Abwerfen
                </button>
              )}
            </div>
          )}

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-purple-400 text-xs">Ablage</p>
            {topDiscard ? (
              <div
                onClick={isMyTurn && !gs.drawnCard ? handleDrawDiscard : undefined}
                className={isMyTurn && !gs.drawnCard ? 'cursor-pointer hover:scale-105 transition-transform' : 'opacity-60'}
              >
                <CardComponent card={topDiscard} size="md" />
              </div>
            ) : (
              <div className="w-20 h-28 rounded-xl border-2 border-dashed border-purple-700 flex items-center justify-center">
                <span className="text-purple-600 text-xs">Leer</span>
              </div>
            )}
          </div>
        </div>

        {/* CABO button */}
        {caboAvailable && (
          <motion.button
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="btn-cabo cabo-glow mt-2"
            onClick={handleCallCabo}
          >
            📢 CABO!
          </motion.button>
        )}

        {/* CABO called notice */}
        {gs.phase === 'cabo_called' && (
          <div className="card-panel px-4 py-2 text-center">
            <p className="text-yellow-400 font-bold text-sm">⚡ CABO wurde gerufen!</p>
            <p className="text-purple-300 text-xs">
              {gs.caboCallerId === myUserId
                ? 'Warte auf letzten Zug des Gegners...'
                : 'Letzter Zug für dich!'}
            </p>
          </div>
        )}

        {/* End round button (for cabo caller after all turns) */}
        {gs.phase === 'cabo_called' && gs.caboLastTurnDone && gs.currentTurn === myIndex && (
          <button className="btn-primary" onClick={handleEndRound}>
            Karten aufdecken & Runde beenden
          </button>
        )}
      </div>

      {/* ── My hand ── */}
      <div className="px-4 pb-2">
        {/* Initial peek controls */}
        {gs.phase === 'initial_peek' && !gs.initialPeekReady[myIndex] && (
          <div className="text-center mb-2 space-y-1">
            {peekCount >= 2 && (
              <button className="btn-primary text-sm px-6 py-2" onClick={confirmReady}>
                ✓ Bereit!
              </button>
            )}
          </div>
        )}
        {gs.phase === 'initial_peek' && gs.initialPeekReady[myIndex] && (
          <p className="text-center text-green-400 text-sm mb-2">✓ Bereit – warte auf Gegner</p>
        )}

        <div className="flex justify-center gap-2">
          {myHand.map((card, i) => {
            const key = `${myIndex}-${i}`;
            const handler = getCardClickHandler(myIndex, i);
            const highlighted = isCardHighlighted(myIndex, i);
            const faceUp = isCardFaceUp(myIndex, i) || revealedCards.has(key);
            return faceUp ? (
              <CardComponent
                key={card.id}
                card={card}
                size="md"
                onClick={handler}
                highlighted={highlighted}
              />
            ) : (
              <div
                key={i}
                onClick={handler}
                className={`rounded-xl ${highlighted ? 'ring-2 ring-yellow-400 scale-105' : ''} transition-all duration-200`}
              >
                <CardBack size="md" />
              </div>
            );
          })}
        </div>
        <p className="text-center text-purple-500 text-xs mt-1">Deine Karten</p>
      </div>

      {/* ── Peek overlay ── */}
      <AnimatePresence>
        {showPeekCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowPeekCard(null)}
          >
            <div className="text-center space-y-4">
              <p className="text-purple-200 text-sm">
                {showPeekCard.playerIdx === myIndex ? `Deine Karte ${showPeekCard.cardIdx + 1}` : `Karte ${showPeekCard.cardIdx + 1} des Gegners`}
              </p>
              <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1.3 }}>
                <CardComponent card={showPeekCard.card} size="lg" />
              </motion.div>
              <p className="text-purple-400 text-xs">Tippe zum Schließen</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Round End Modal ── */}
      <AnimatePresence>
        {showRoundEnd && (gs.phase === 'round_end' || gs.phase === 'game_over') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          >
            <div className="card-panel p-6 w-full max-w-sm space-y-4 text-center">
              <h2 className="text-2xl font-bold" style={{ color: '#fbbf24', fontFamily: 'Georgia, serif' }}>
                {gs.phase === 'game_over' ? '🏆 Spiel vorbei!' : `Runde ${gs.roundHistory[gs.roundHistory.length - 1]?.round ?? gs.round} beendet`}
              </h2>

              {gs.roundHistory.length > 0 && (() => {
                const last = gs.roundHistory[gs.roundHistory.length - 1];
                const myRoundScore = last.scores[myIndex];
                const oppRoundScore = last.scores[opponentIndex];
                return (
                  <div className="space-y-2">
                    <div className="flex justify-around">
                      <div>
                        <p className="text-xs text-purple-400">Du</p>
                        <p className="text-3xl font-bold text-green-400">{myRoundScore}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-400">{opponentName}</p>
                        <p className="text-3xl font-bold text-pink-400">{oppRoundScore}</p>
                      </div>
                    </div>
                    <div className="flex justify-around pt-2 border-t border-purple-800">
                      <div>
                        <p className="text-xs text-purple-400">Gesamt</p>
                        <p className="text-xl font-bold text-green-400">{gs.cumulativeScores[myIndex]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-400">Gesamt</p>
                        <p className="text-xl font-bold text-pink-400">{gs.cumulativeScores[opponentIndex]}</p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Show all hands */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-purple-400 mb-1">Deine Karten</p>
                  <div className="flex justify-center gap-1">
                    {myHand.map(c => <CardComponent key={c.id} card={c} size="sm" />)}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-purple-400 mb-1">{opponentName}'s Karten</p>
                  <div className="flex justify-center gap-1">
                    {opponentHand.map(c => <CardComponent key={c.id} card={c} size="sm" />)}
                  </div>
                </div>
              </div>

              {gs.phase === 'game_over' ? (
                <div>
                  <p className="text-xl font-bold mb-3" style={{ color: '#fbbf24' }}>
                    {gs.winner === myUserId ? '🎉 Du gewinnst!' : `${opponentName} gewinnt!`}
                  </p>
                  <button className="btn-primary w-full" onClick={() => navigate('/lobby')}>
                    Zurück zur Lobby
                  </button>
                </div>
              ) : (
                <button className="btn-primary w-full" onClick={handleNextRound}>
                  ✦ Nächste Runde
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
