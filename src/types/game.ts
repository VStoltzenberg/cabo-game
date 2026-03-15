export type CardAction = 'peek' | 'spy' | 'swap' | null;

export interface Card {
  id: number;        // unique ID in the deck (0..51)
  value: number;     // 0..13
  action: CardAction;
}

export type GamePhase =
  | 'waiting'        // Waiting for 2nd player
  | 'initial_peek'   // Players looking at 2 of their cards
  | 'playing'        // Normal play
  | 'cabo_called'    // CABO was called, last round
  | 'round_end'      // Show all cards, calculate scores
  | 'game_over';     // Someone hit 100+ points

export interface PendingAction {
  type: CardAction;
  card: Card;         // The card that triggered the action (just drawn)
  step: 'choose_own' | 'choose_opponent' | 'choose_swap_own' | 'choose_swap_opponent';
  spyRevealedCard?: Card; // For spy: which card was revealed
  swapOwnIndex?: number;  // For swap: which own card was chosen
}

export interface GameState {
  phase: GamePhase;
  round: number;
  deck: Card[];
  discardPile: Card[];
  hands: [Card[], Card[]];           // [player0, player1]
  currentTurn: 0 | 1;
  caboCallerId: string | null;       // userId who called CABO
  caboLastTurnDone: boolean;         // Has the other player taken their last turn?
  drawnCard: Card | null;
  drawnFrom: 'deck' | 'discard' | null;
  pendingAction: PendingAction | null;
  initialPeekReady: [boolean, boolean]; // Each player confirmed initial peek
  cumulativeScores: [number, number];
  roundHistory: RoundResult[];
  winner: string | null;             // userId
  lastEvent: string;                 // Human-readable description of last action
}

export interface RoundResult {
  round: number;
  scores: [number, number];
  caboCallerId: string;
  hands: [Card[], Card[]];
}

export interface GameRoom {
  id: string;
  code: string;
  player0_id: string;
  player1_id: string | null;
  player0_username: string;
  player1_username: string | null;
  game_state: GameState;
  status: 'waiting' | 'active' | 'finished';
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  games_played: number;
  games_won: number;
  created_at: string;
}
