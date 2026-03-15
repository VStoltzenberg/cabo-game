import type { Card, CardAction, GameState, RoundResult } from '../types/game';

// ─── Deck ────────────────────────────────────────────────────────────────────

const DECK_COMPOSITION: { value: number; count: number; action: CardAction }[] = [
  { value: 0,  count: 2, action: null  },
  { value: 1,  count: 4, action: null  },
  { value: 2,  count: 4, action: null  },
  { value: 3,  count: 4, action: null  },
  { value: 4,  count: 4, action: null  },
  { value: 5,  count: 4, action: null  },
  { value: 6,  count: 4, action: null  },
  { value: 7,  count: 4, action: 'peek' },
  { value: 8,  count: 4, action: 'peek' },
  { value: 9,  count: 4, action: 'spy'  },
  { value: 10, count: 4, action: 'spy'  },
  { value: 11, count: 4, action: 'swap' },
  { value: 12, count: 4, action: 'swap' },
  { value: 13, count: 2, action: null  },
];

export function buildDeck(): Card[] {
  const cards: Card[] = [];
  let id = 0;
  for (const { value, count, action } of DECK_COMPOSITION) {
    for (let i = 0; i < count; i++) {
      cards.push({ id: id++, value, action });
    }
  }
  return shuffleDeck(cards);
}

function shuffleDeck(cards: Card[]): Card[] {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── Initial State ───────────────────────────────────────────────────────────

export function createInitialGameState(prevState?: GameState): GameState {
  const deck = buildDeck();
  // Deal 4 cards to each player
  const hand0 = deck.splice(0, 4);
  const hand1 = deck.splice(0, 4);
  // First discard
  const firstDiscard = deck.splice(0, 1);

  const prev = prevState;
  return {
    phase: 'initial_peek',
    round: prev ? prev.round + 1 : 1,
    deck,
    discardPile: firstDiscard,
    hands: [hand0, hand1],
    currentTurn: 0,
    caboCallerId: null,
    caboLastTurnDone: false,
    drawnCard: null,
    drawnFrom: null,
    pendingAction: null,
    initialPeekReady: [false, false],
    cumulativeScores: prev ? prev.cumulativeScores : [0, 0],
    roundHistory: prev ? prev.roundHistory : [],
    winner: null,
    lastEvent: 'Neue Runde! Schau dir 2 deiner Karten an.',
  };
}

// ─── Player Actions ──────────────────────────────────────────────────────────

export function confirmInitialPeek(state: GameState, playerIndex: 0 | 1): GameState {
  const ready: [boolean, boolean] = [...state.initialPeekReady] as [boolean, boolean];
  ready[playerIndex] = true;
  const phase = ready[0] && ready[1] ? 'playing' : 'initial_peek';
  return {
    ...state,
    initialPeekReady: ready,
    phase,
    lastEvent: ready[0] && ready[1]
      ? 'Beide Spieler bereit. Spiel beginnt!'
      : `Spieler ${playerIndex + 1} ist bereit...`,
  };
}

export function drawFromDeck(state: GameState): GameState {
  if (state.deck.length === 0) {
    // Reshuffle discard pile (keep top card)
    const top = state.discardPile[state.discardPile.length - 1];
    const newDeck = shuffleDeck(state.discardPile.slice(0, -1));
    const drawnCard = newDeck.splice(0, 1)[0];
    return {
      ...state,
      deck: newDeck,
      discardPile: [top],
      drawnCard,
      drawnFrom: 'deck',
      lastEvent: `Spieler ${state.currentTurn + 1} zieht vom Nachziehstapel.`,
    };
  }
  const deck = [...state.deck];
  const drawnCard = deck.splice(0, 1)[0];
  return {
    ...state,
    deck,
    drawnCard,
    drawnFrom: 'deck',
    lastEvent: `Spieler ${state.currentTurn + 1} zieht vom Nachziehstapel.`,
  };
}

export function drawFromDiscard(state: GameState): GameState {
  if (state.discardPile.length === 0) return state;
  const discardPile = [...state.discardPile];
  const drawnCard = discardPile.pop()!;
  return {
    ...state,
    discardPile,
    drawnCard,
    drawnFrom: 'discard',
    pendingAction: null, // Cards from discard can never trigger actions
    lastEvent: `Spieler ${state.currentTurn + 1} nimmt die oberste Ablagekarte.`,
  };
}

export function discardDrawnCard(state: GameState): GameState {
  if (!state.drawnCard) return state;
  const card = state.drawnCard;

  // If drawn from deck and has action, trigger pending action
  if (state.drawnFrom === 'deck' && card.action) {
    return {
      ...state,
      discardPile: [...state.discardPile, card],
      drawnCard: null,
      drawnFrom: null,
      pendingAction: {
        type: card.action,
        card,
        step: card.action === 'swap' ? 'choose_swap_own' : card.action === 'peek' ? 'choose_own' : 'choose_opponent',
      },
      lastEvent: `Spieler ${state.currentTurn + 1} wirft ${card.value} ab → Aktion: ${actionName(card.action)}!`,
    };
  }

  // No action → end turn
  return endTurn({
    ...state,
    discardPile: [...state.discardPile, card],
    drawnCard: null,
    drawnFrom: null,
    lastEvent: `Spieler ${state.currentTurn + 1} wirft die gezogene Karte (${card.value}) ab.`,
  });
}

export function replaceCardInHand(state: GameState, handIndex: number): GameState {
  if (!state.drawnCard) return state;
  const hands: [Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
  ];
  const replaced = hands[state.currentTurn][handIndex];
  hands[state.currentTurn][handIndex] = state.drawnCard;

  // Check if replaced card has action
  let pendingAction = null;
  if (state.drawnFrom === 'deck' && replaced.action) {
    // Actually: in CABO the action is only triggered when you DISCARD the drawn card.
    // When you replace, no action. But the replaced card goes to discard.
  }

  return endTurn({
    ...state,
    hands,
    discardPile: [...state.discardPile, replaced],
    drawnCard: null,
    drawnFrom: null,
    pendingAction,
    lastEvent: `Spieler ${state.currentTurn + 1} tauscht Karte ${handIndex + 1} aus.`,
  });
}

// ─── Card Actions ─────────────────────────────────────────────────────────────

// Peek: Player looks at own card (client-side reveal only, no state change needed)
// We just advance past the pending action
export function resolvePeek(state: GameState, _cardIndex: number): GameState {
  // The actual reveal is handled client-side
  // Just clear pending action and end turn
  return endTurn({
    ...state,
    pendingAction: null,
    lastEvent: `Spieler ${state.currentTurn + 1} schaut eine eigene Karte an (Peek).`,
  });
}

// Spy: Player looks at opponent's card
export function resolveSpy(state: GameState, _opponentCardIndex: number): GameState {
  return endTurn({
    ...state,
    pendingAction: null,
    lastEvent: `Spieler ${state.currentTurn + 1} schaut eine Karte des Gegners an (Spy).`,
  });
}

// Swap step 1: Choose own card
export function resolveSwapChooseOwn(state: GameState, ownCardIndex: number): GameState {
  if (!state.pendingAction) return state;
  return {
    ...state,
    pendingAction: {
      ...state.pendingAction,
      step: 'choose_swap_opponent',
      swapOwnIndex: ownCardIndex,
    },
    lastEvent: `Spieler ${state.currentTurn + 1} wählt eigene Karte ${ownCardIndex + 1} zum Tauschen.`,
  };
}

// Swap step 2: Choose opponent's card
export function resolveSwapChooseOpponent(state: GameState, opponentCardIndex: number): GameState {
  if (!state.pendingAction || state.pendingAction.swapOwnIndex === undefined) return state;
  const opponent = state.currentTurn === 0 ? 1 : 0;
  const hands: [Card[], Card[]] = [
    [...state.hands[0]],
    [...state.hands[1]],
  ];
  const ownIdx = state.pendingAction.swapOwnIndex;
  const temp = hands[state.currentTurn][ownIdx];
  hands[state.currentTurn][ownIdx] = hands[opponent][opponentCardIndex];
  hands[opponent][opponentCardIndex] = temp;

  return endTurn({
    ...state,
    hands,
    pendingAction: null,
    lastEvent: `Spieler ${state.currentTurn + 1} tauscht Karte ${ownIdx + 1} mit Karte ${opponentCardIndex + 1} des Gegners (Swap).`,
  });
}

// ─── Discard matching cards ───────────────────────────────────────────────────

export function discardMatchingCards(
  state: GameState,
  playerIndex: 0 | 1,
  cardIndices: number[]
): GameState {
  if (cardIndices.length < 2) return state;
  const hands: [Card[], Card[]] = [[...state.hands[0]], [...state.hands[1]]];
  const playerHand = [...hands[playerIndex]];

  // Verify all have same value
  const values = cardIndices.map(i => playerHand[i].value);
  if (values.some(v => v !== values[0])) return state;

  // Remove cards and add to discard
  const removedCards = cardIndices.map(i => playerHand[i]);
  const newHand = playerHand.filter((_, i) => !cardIndices.includes(i));
  hands[playerIndex] = newHand;

  const newDiscard = [...state.discardPile, ...removedCards];
  return {
    ...state,
    hands,
    discardPile: newDiscard,
    lastEvent: `Spieler ${playerIndex + 1} legt ${cardIndices.length} gleiche Karten (Wert ${values[0]}) ab!`,
  };
}

// ─── CABO ─────────────────────────────────────────────────────────────────────

export function callCabo(state: GameState, callerId: string): GameState {
  return {
    ...state,
    phase: 'cabo_called',
    caboCallerId: callerId,
    lastEvent: `CABO! Spieler ${state.currentTurn + 1} ruft CABO. Noch ein letzter Zug für den Gegner.`,
  };
}

// ─── Round End ────────────────────────────────────────────────────────────────

export function calculateRoundEnd(
  state: GameState,
  playerIds: [string, string]
): GameState {
  const score0 = state.hands[0].reduce((sum, c) => sum + c.value, 0);
  const score1 = state.hands[1].reduce((sum, c) => sum + c.value, 0);

  let finalScore0 = score0;
  let finalScore1 = score1;

  const caboCallerIndex = playerIds.indexOf(state.caboCallerId ?? '') as 0 | 1;

  // If CABO caller doesn't have the lowest sum, they get +5 extra
  if (caboCallerIndex === 0 && score0 > score1) finalScore0 += 5;
  else if (caboCallerIndex === 1 && score1 > score0) finalScore1 += 5;
  // Tie: CABO caller gets +5
  else if (score0 === score1) {
    if (caboCallerIndex === 0) finalScore0 += 5;
    else finalScore1 += 5;
  }

  const newCumulative: [number, number] = [
    state.cumulativeScores[0] + finalScore0,
    state.cumulativeScores[1] + finalScore1,
  ];

  const roundResult: RoundResult = {
    round: state.round,
    scores: [finalScore0, finalScore1],
    caboCallerId: state.caboCallerId ?? '',
    hands: state.hands,
  };

  // Check Kamikaze: exactly 0 points -> opponent gets +5 (rule: no extra penalty specified)
  // Check game over: someone >= 100 points
  // Special: exactly 100 -> reduce to 50
  const processedCumulative: [number, number] = [...newCumulative] as [number, number];
  for (let i = 0; i < 2; i++) {
    if (processedCumulative[i] === 100) processedCumulative[i] = 50;
  }

  const gameOver = processedCumulative[0] >= 100 || processedCumulative[1] >= 100;
  let winner: string | null = null;
  if (gameOver) {
    // Lower score wins
    winner = processedCumulative[0] <= processedCumulative[1] ? playerIds[0] : playerIds[1];
  }

  return {
    ...state,
    phase: gameOver ? 'game_over' : 'round_end',
    cumulativeScores: processedCumulative,
    roundHistory: [...state.roundHistory, roundResult],
    winner,
    lastEvent: `Runde ${state.round} vorbei! Spieler 1: ${finalScore0}P, Spieler 2: ${finalScore1}P`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function endTurn(state: GameState): GameState {
  const opponent: 0 | 1 = state.currentTurn === 0 ? 1 : 0;

  // If CABO was called and current player just finished their last turn
  if (state.phase === 'cabo_called') {
    // The cabo caller already played, now the other player played their last turn
    return {
      ...state,
      phase: 'cabo_called',
      caboLastTurnDone: true,
      currentTurn: opponent,
    };
  }

  return {
    ...state,
    currentTurn: opponent,
  };
}

export function actionName(action: CardAction): string {
  switch (action) {
    case 'peek': return 'Peek';
    case 'spy': return 'Spy';
    case 'swap': return 'Swap';
    default: return '';
  }
}

export function getCardTheme(value: number): {
  bg: string; accent: string; emoji: string; name: string;
} {
  const themes: Record<number, { bg: string; accent: string; emoji: string; name: string }> = {
    0:  { bg: 'from-gray-900 to-purple-950', accent: '#a78bfa', emoji: '🦄', name: 'Einhorn' },
    1:  { bg: 'from-amber-800 to-amber-500', accent: '#fbbf24', emoji: '🍂', name: 'Blatt' },
    2:  { bg: 'from-purple-300 to-pink-200',  accent: '#c084fc', emoji: '✨', name: 'Splash' },
    3:  { bg: 'from-green-700 to-lime-300',   accent: '#4ade80', emoji: '🌿', name: 'Spargel' },
    4:  { bg: 'from-teal-700 to-green-400',   accent: '#f97316', emoji: '🐦', name: 'Vögel' },
    5:  { bg: 'from-pink-400 to-yellow-300',  accent: '#fb7185', emoji: '🦋', name: 'Schmetterlinge' },
    6:  { bg: 'from-purple-300 to-pink-200',  accent: '#9333ea', emoji: '🥸', name: 'Spy' },
    7:  { bg: 'from-blue-500 to-pink-400',    accent: '#ffd700', emoji: '🐟', name: 'Koi' },
    8:  { bg: 'from-teal-400 to-orange-400',  accent: '#06b6d4', emoji: '🐙', name: 'Oktopus' },
    9:  { bg: 'from-gray-900 to-amber-800',   accent: '#d97706', emoji: '🐭', name: 'Mäuse' },
    10: { bg: 'from-purple-300 to-violet-200',accent: '#7c3aed', emoji: '🎩', name: 'Hut' },
    11: { bg: 'from-teal-500 to-teal-300',    accent: '#0f766e', emoji: '🦊', name: 'Fuchs' },
    12: { bg: 'from-orange-500 to-red-500',   accent: '#f97316', emoji: '💎', name: 'Geo' },
    13: { bg: 'from-purple-900 to-indigo-700',accent: '#818cf8', emoji: '🌈', name: 'Rakete' },
  };
  return themes[value] ?? { bg: 'from-gray-700 to-gray-500', accent: '#fff', emoji: '🃏', name: `${value}` };
}
