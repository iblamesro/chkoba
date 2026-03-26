// ============================================================
// Types de base
// ============================================================

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades'
export type Rank = number  // 1-12

export interface Card {
  id: string        // ex: "7-diamonds"
  rank: Rank
  suit: Suit
  value: number     // valeur de capture (1-10, valet=8, dame=9, roi=10)
}

export interface Player {
  id: string
  name: string
  hand: Card[]
  captured: Card[]
  chkobaCount: number   // nombre de Chkobas dans la partie
  score: number
}

export interface GameState {
  gameId: string
  players: Player[]
  deck: Card[]
  table: Card[]
  currentPlayerIndex: number
  lastCapturePlayerIndex: number | null
  round: number
  phase: 'dealing' | 'playing' | 'scoring' | 'finished'
  rules: GameRules
  log: string[]
}

export interface GameRules {
  country: 'tunisia' | 'algeria' | 'morocco' | 'default'
  deckSize: 52 | 40
  pointsForCards: number       // seuil de cartes pour marquer (ex: 27 sur 52)
  pointsForDiamonds: number    // seuil de carreaux (ex: 8 sur 16)
  sevenOfDiamondsBonus: boolean
  chkobaPoints: number         // points par chkoba (souvent 1)
}

// ============================================================
// Création du deck
// ============================================================

export function createDeck(deckSize: 52 | 40 = 52): Card[] {
  const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']
  const ranks: Rank[] = deckSize === 52
    ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    : [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]   // variante 40 cartes : 1-7 + 10, J, Q (pas 8, 9, K)

  const captureValue = (rank: Rank): number => {
    if (rank <= 7) return rank
    if (rank === 8) return 8    // Valet
    if (rank === 9) return 9    // Dame
    if (rank === 10) return 10  // 10
    if (rank === 11) return 8   // Valet
    if (rank === 12) return 9   // Dame
    if (rank === 13) return 10  // Roi/As
    return rank
  }

  const deck: Card[] = []
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
        value: captureValue(rank)
      })
    }
  }
  return shuffle(deck)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ============================================================
// Initialisation d'une partie
// ============================================================

export function initGame(
  playerIds: string[],
  playerNames: string[],
  rules: GameRules
): GameState {
  const deck = createDeck(rules.deckSize)

  const players: Player[] = playerIds.map((id, i) => ({
    id,
    name: playerNames[i],
    hand: [],
    captured: [],
    chkobaCount: 0,
    score: 0
  }))

  const state: GameState = {
    gameId: crypto.randomUUID(),
    players,
    deck,
    table: [],
    currentPlayerIndex: 0,
    lastCapturePlayerIndex: null,
    round: 1,
    phase: 'dealing',
    rules,
    log: []
  }

  return deal(state)
}

function deal(state: GameState): GameState {
  let { deck, players, table } = state

  // 4 cartes sur la table
  const newTable = deck.splice(0, 4)

  // 3 cartes par joueur
  const newPlayers = players.map(p => ({
    ...p,
    hand: deck.splice(0, 3)
  }))

  return {
    ...state,
    deck,
    table: newTable,
    players: newPlayers,
    phase: 'playing',
    log: [...state.log, `Tour ${state.round} : distribution effectuée`]
  }
}

// ============================================================
// Logique de capture — le cœur du jeu
// ============================================================

export function findValidCaptures(
  card: Card,
  table: Card[]
): Card[][] {
  const captures: Card[][] = []

  // Capture directe : une carte de même valeur
  for (const tc of table) {
    if (tc.value === card.value) {
      captures.push([tc])
    }
  }

  // Capture combinée : plusieurs cartes dont la somme = valeur jouée
  const combos = getCombinations(table)
  for (const combo of combos) {
    if (combo.length > 1) {
      const sum = combo.reduce((acc, c) => acc + c.value, 0)
      if (sum === card.value) {
        captures.push(combo)
      }
    }
  }

  return captures
}

function getCombinations<T>(arr: T[]): T[][] {
  const result: T[][] = []
  const total = 1 << arr.length   // 2^n sous-ensembles

  for (let i = 1; i < total; i++) {
    const combo: T[] = []
    for (let j = 0; j < arr.length; j++) {
      if (i & (1 << j)) combo.push(arr[j])
    }
    result.push(combo)
  }
  return result
}

// ============================================================
// Jouer une carte
// ============================================================

export type PlayResult =
  | { type: 'capture'; captured: Card[]; isChkoba: boolean }
  | { type: 'place' }
  | { type: 'error'; message: string }

export function playCard(
  state: GameState,
  playerId: string,
  cardId: string,
  captureIds?: string[]    // IDs des cartes choisies pour la capture
): { state: GameState; result: PlayResult } {

  const playerIndex = state.players.findIndex(p => p.id === playerId)
  if (playerIndex !== state.currentPlayerIndex) {
    return { state, result: { type: 'error', message: 'Ce n\'est pas ton tour' } }
  }

  const player = state.players[playerIndex]
  const card = player.hand.find(c => c.id === cardId)
  if (!card) {
    return { state, result: { type: 'error', message: 'Carte introuvable dans ta main' } }
  }

  // Retirer la carte de la main
  const newHand = player.hand.filter(c => c.id !== cardId)

  // Tentative de capture
  const validCaptures = findValidCaptures(card, state.table)

  if (validCaptures.length > 0 && captureIds && captureIds.length > 0) {
    // Le joueur a choisi quelles cartes capturer
    const chosenCapture = state.table.filter(c => captureIds.includes(c.id))
    const chosenSum = chosenCapture.reduce((acc, c) => acc + c.value, 0)

    if (chosenSum !== card.value) {
      return { state, result: { type: 'error', message: 'Capture invalide' } }
    }

    const newTable = state.table.filter(c => !captureIds.includes(c.id))
    const isChkoba = newTable.length === 0

    const newCaptured = [...player.captured, card, ...chosenCapture]
    const newChkobaCount = player.chkobaCount + (isChkoba ? 1 : 0)

    const newPlayers = [...state.players]
    newPlayers[playerIndex] = {
      ...player,
      hand: newHand,
      captured: newCaptured,
      chkobaCount: newChkobaCount
    }

    const newState = advanceTurn({
      ...state,
      players: newPlayers,
      table: newTable,
      lastCapturePlayerIndex: playerIndex,
      log: [
        ...state.log,
        `${player.name} capture avec ${card.id}${isChkoba ? ' — CHKOBA !' : ''}`
      ]
    })

    return { state: newState, result: { type: 'capture', captured: chosenCapture, isChkoba } }
  }

  // Pas de capture possible → pose la carte sur la table
  const newTable = [...state.table, card]
  const newPlayers = [...state.players]
  newPlayers[playerIndex] = { ...player, hand: newHand }

  const newState = advanceTurn({
    ...state,
    players: newPlayers,
    table: newTable,
    log: [...state.log, `${player.name} pose ${card.id} sur la table`]
  })

  return { state: newState, result: { type: 'place' } }
}

// ============================================================
// Avancement du tour et redistribution
// ============================================================

function advanceTurn(state: GameState): GameState {
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length
  const allHandsEmpty = state.players.every(p => p.hand.length === 0)

  // Plus de cartes en main → redistribuer si le deck le permet
  if (allHandsEmpty) {
    if (state.deck.length >= state.players.length * 3) {
      return deal({
        ...state,
        currentPlayerIndex: nextIndex,
        round: state.round + 1
      })
    } else {
      // Fin de partie → scoring
      return computeScores({
        ...state,
        currentPlayerIndex: nextIndex,
        phase: 'scoring'
      })
    }
  }

  return { ...state, currentPlayerIndex: nextIndex }
}

// ============================================================
// Scoring final
// ============================================================

export function computeScores(state: GameState): GameState {
  const { rules, players, lastCapturePlayerIndex } = state

  // Les cartes restantes sur la table vont au dernier qui a capturé
  let finalPlayers = [...players]
  if (lastCapturePlayerIndex !== null && state.table.length > 0) {
    finalPlayers[lastCapturePlayerIndex] = {
      ...finalPlayers[lastCapturePlayerIndex],
      captured: [
        ...finalPlayers[lastCapturePlayerIndex].captured,
        ...state.table
      ]
    }
  }

  finalPlayers = finalPlayers.map(player => {
    let score = 0

    // Point pour le plus de cartes
    const cardCount = player.captured.length
    if (cardCount > rules.pointsForCards) score += 1

    // Point pour le plus de carreaux
    const diamondCount = player.captured.filter(c => c.suit === 'diamonds').length
    if (diamondCount > rules.pointsForDiamonds) score += 1

    // Bonus 7 de carreau
    if (rules.sevenOfDiamondsBonus) {
      const hasSeven = player.captured.some(c => c.rank === 7 && c.suit === 'diamonds')
      if (hasSeven) score += 1
    }

    // Points de Chkoba
    score += player.chkobaCount * rules.chkobaPoints

    return { ...player, score }
  })

  return {
    ...state,
    players: finalPlayers,
    table: [],
    phase: 'finished',
    log: [
      ...state.log,
      ...finalPlayers.map(p => `${p.name} : ${p.score} point(s)`)
    ]
  }
}

// ============================================================
// Règles par pays
// ============================================================

export const RULES_BY_COUNTRY: Record<string, GameRules> = {
  tunisia: {
    country: 'tunisia',
    deckSize: 52,
    pointsForCards: 26,
    pointsForDiamonds: 8,
    sevenOfDiamondsBonus: true,
    chkobaPoints: 1
  },
  algeria: {
    country: 'algeria',
    deckSize: 52,
    pointsForCards: 26,
    pointsForDiamonds: 8,
    sevenOfDiamondsBonus: false,
    chkobaPoints: 1
  },
  morocco: {
    country: 'morocco',
    deckSize: 40,
    pointsForCards: 20,
    pointsForDiamonds: 6,
    sevenOfDiamondsBonus: true,
    chkobaPoints: 2
  },
  default: {
    country: 'default',
    deckSize: 52,
    pointsForCards: 26,
    pointsForDiamonds: 8,
    sevenOfDiamondsBonus: true,
    chkobaPoints: 1
  }
}
