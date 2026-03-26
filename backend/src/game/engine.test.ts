import {
  createDeck,
  findValidCaptures,
  initGame,
  playCard,
  computeScores,
  RULES_BY_COUNTRY,
  Card,
  GameState
} from './engine'

// ============================================================
// Helpers
// ============================================================

function makeCard(rank: number, suit: string, value?: number): Card {
  return {
    id: `${rank}-${suit}`,
    rank: rank as any,
    suit: suit as any,
    value: value ?? rank
  }
}

function makeGame(overrides?: Partial<GameState>): GameState {
  const base = initGame(
    ['p1', 'p2'],
    ['Alice', 'Bob'],
    RULES_BY_COUNTRY.tunisia
  )
  return overrides ? { ...base, ...overrides } : base
}

// ============================================================
// 1. Deck
// ============================================================

describe('createDeck', () => {
  test('crée 52 cartes pour la variante standard', () => {
    const deck = createDeck(52)
    expect(deck).toHaveLength(52)
  })

  test('crée 40 cartes pour la variante maghreb', () => {
    const deck = createDeck(40)
    expect(deck).toHaveLength(40)
  })

  test('chaque carte a un id unique', () => {
    const deck = createDeck(52)
    const ids = deck.map(c => c.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(52)
  })

  test('toutes les couleurs sont représentées', () => {
    const deck = createDeck(52)
    const suits = new Set(deck.map(c => c.suit))
    expect(suits).toEqual(new Set(['clubs', 'diamonds', 'hearts', 'spades']))
  })

  test('le deck est mélangé (pas dans l\'ordre)', () => {
    const deck1 = createDeck(52)
    const deck2 = createDeck(52)
    const same = deck1.every((c, i) => c.id === deck2[i].id)
    expect(same).toBe(false)
  })
})

// ============================================================
// 2. Capture — le plus important
// ============================================================

describe('findValidCaptures', () => {

  // --- Capture directe ---

  test('capture directe : une carte de même valeur', () => {
    const card = makeCard(7, 'hearts')
    const table = [makeCard(7, 'clubs'), makeCard(3, 'diamonds')]
    const captures = findValidCaptures(card, table)

    expect(captures).toContainEqual([makeCard(7, 'clubs')])
  })

  test('pas de capture si aucune correspondance', () => {
    const card = makeCard(5, 'hearts')
    const table = [makeCard(3, 'clubs'), makeCard(6, 'diamonds')]
    const captures = findValidCaptures(card, table)

    expect(captures).toHaveLength(0)
  })

  test('plusieurs captures directes possibles', () => {
    const card = makeCard(4, 'hearts')
    const table = [
      makeCard(4, 'clubs'),
      makeCard(4, 'diamonds'),
      makeCard(2, 'spades')
    ]
    const captures = findValidCaptures(card, table)

    // Deux captures directes possibles (les deux 4)
    expect(captures.length).toBeGreaterThanOrEqual(2)
  })

  // --- Capture combinée ---

  test('capture combinée : 2 cartes dont la somme = valeur jouée', () => {
    const card = makeCard(7, 'hearts')
    const table = [makeCard(3, 'clubs'), makeCard(4, 'diamonds')]
    const captures = findValidCaptures(card, table)

    expect(captures).toContainEqual(
      expect.arrayContaining([makeCard(3, 'clubs'), makeCard(4, 'diamonds')])
    )
  })

  test('capture combinée avec 3 cartes', () => {
    const card = makeCard(6, 'hearts')
    const table = [
      makeCard(1, 'clubs'),
      makeCard(2, 'diamonds'),
      makeCard(3, 'spades'),
      makeCard(5, 'hearts')
    ]
    const captures = findValidCaptures(card, table)

    // 1+2+3 = 6 → valide
    expect(captures).toContainEqual(
      expect.arrayContaining([
        makeCard(1, 'clubs'),
        makeCard(2, 'diamonds'),
        makeCard(3, 'spades')
      ])
    )
  })

  test('capture directe ET combinée disponibles simultanément', () => {
    const card = makeCard(5, 'hearts')
    const table = [
      makeCard(5, 'clubs'),     // capture directe
      makeCard(2, 'diamonds'),
      makeCard(3, 'spades')     // 2+3 = capture combinée
    ]
    const captures = findValidCaptures(card, table)

    expect(captures.length).toBeGreaterThanOrEqual(2)
  })

  test('table vide → aucune capture', () => {
    const card = makeCard(7, 'hearts')
    const captures = findValidCaptures(card, [])
    expect(captures).toHaveLength(0)
  })
})

// ============================================================
// 3. playCard
// ============================================================

describe('playCard', () => {

  test('erreur si ce n\'est pas le tour du joueur', () => {
    const state = makeGame()
    const { result } = playCard(state, 'p2', state.players[1].hand[0].id)
    expect(result.type).toBe('error')
  })

  test('erreur si la carte n\'est pas dans la main', () => {
    const state = makeGame()
    const { result } = playCard(state, 'p1', 'carte-inexistante')
    expect(result.type).toBe('error')
  })

  test('pose une carte sur la table si pas de capture', () => {
    const state = makeGame()
    // On force une situation sans capture possible
    const player = state.players[0]
    const cardWithNoMatch = player.hand.find(
      c => !state.table.some(t => t.value === c.value)
    )

    if (!cardWithNoMatch) return // skip si pas de cas possible avec ce deck

    const { state: newState, result } = playCard(state, 'p1', cardWithNoMatch.id)
    expect(result.type).toBe('place')
    expect(newState.table).toContainEqual(cardWithNoMatch)
  })

  test('le tour passe au joueur suivant après avoir joué', () => {
    const state = makeGame()
    const card = state.players[0].hand[0]
    const { state: newState } = playCard(state, 'p1', card.id)
    expect(newState.currentPlayerIndex).toBe(1)
  })

  test('chkoba détectée quand la table est vidée', () => {
    // Setup manuel : table avec une seule carte, joueur avec la même valeur
    const tableCard = makeCard(7, 'clubs')
    const playerCard = makeCard(7, 'hearts')

    const state: GameState = {
      gameId: 'test',
      players: [
        {
          id: 'p1', name: 'Alice',
          hand: [playerCard],
          captured: [], chkobaCount: 0, score: 0
        },
        {
          id: 'p2', name: 'Bob',
          hand: [makeCard(3, 'spades')],
          captured: [], chkobaCount: 0, score: 0
        }
      ],
      deck: [],
      table: [tableCard],
      currentPlayerIndex: 0,
      lastCapturePlayerIndex: null,
      round: 1,
      phase: 'playing',
      rules: RULES_BY_COUNTRY.tunisia,
      log: []
    }

    const { result } = playCard(state, 'p1', playerCard.id, [tableCard.id])
    expect(result.type).toBe('capture')
    if (result.type === 'capture') {
      expect(result.isChkoba).toBe(true)
    }
  })

  test('chkobaCount du joueur s\'incrémente après une chkoba', () => {
    const tableCard = makeCard(7, 'clubs')
    const playerCard = makeCard(7, 'hearts')

    const state: GameState = {
      gameId: 'test',
      players: [
        {
          id: 'p1', name: 'Alice',
          hand: [playerCard],
          captured: [], chkobaCount: 0, score: 0
        },
        {
          id: 'p2', name: 'Bob',
          hand: [makeCard(3, 'spades')],
          captured: [], chkobaCount: 0, score: 0
        }
      ],
      deck: [],
      table: [tableCard],
      currentPlayerIndex: 0,
      lastCapturePlayerIndex: null,
      round: 1,
      phase: 'playing',
      rules: RULES_BY_COUNTRY.tunisia,
      log: []
    }

    const { state: newState } = playCard(state, 'p1', playerCard.id, [tableCard.id])
    expect(newState.players[0].chkobaCount).toBe(1)
  })
})

// ============================================================
// 4. Scoring
// ============================================================

describe('computeScores', () => {

  test('point pour le joueur avec le plus de cartes', () => {
    const base = makeGame()
    const state: GameState = {
      ...base,
      phase: 'scoring',
      table: [],
      players: [
        { ...base.players[0], captured: Array(30).fill(makeCard(2, 'clubs')) },
        { ...base.players[1], captured: Array(22).fill(makeCard(3, 'hearts')) }
      ]
    }
    const scored = computeScores(state)
    expect(scored.players[0].score).toBeGreaterThan(scored.players[1].score)
  })

  test('point pour le 7 de carreau (règles tunisiennes)', () => {
    const base = makeGame()
    const sevenDiamond = makeCard(7, 'diamonds')
    const state: GameState = {
      ...base,
      phase: 'scoring',
      table: [],
      players: [
        { ...base.players[0], captured: [sevenDiamond] },
        { ...base.players[1], captured: [] }
      ]
    }
    const scored = computeScores(state)
    expect(scored.players[0].score).toBeGreaterThanOrEqual(1)
  })

  test('chkoba ajoute des points au score final', () => {
    const base = makeGame()
    const state: GameState = {
      ...base,
      phase: 'scoring',
      table: [],
      players: [
        { ...base.players[0], captured: [], chkobaCount: 3, score: 0 },
        { ...base.players[1], captured: [], chkobaCount: 0, score: 0 }
      ]
    }
    const scored = computeScores(state)
    expect(scored.players[0].score).toBe(3) // 3 chkobas × 1 point
  })

  test('les cartes restantes sur la table vont au dernier captureur', () => {
    const base = makeGame()
    const leftover = makeCard(5, 'spades')
    const state: GameState = {
      ...base,
      phase: 'scoring',
      table: [leftover],
      lastCapturePlayerIndex: 1,
      players: [
        { ...base.players[0], captured: [] },
        { ...base.players[1], captured: [] }
      ]
    }
    const scored = computeScores(state)
    expect(scored.players[1].captured).toContainEqual(leftover)
  })

  test('la phase passe à finished après le scoring', () => {
    const state = makeGame()
    const scored = computeScores({ ...state, phase: 'scoring', table: [] })
    expect(scored.phase).toBe('finished')
  })
})
