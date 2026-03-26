import express from 'express'
import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import cors from 'cors'
import {
  initGame,
  playCard,
  findValidCaptures,
  RULES_BY_COUNTRY,
  GameState,
  GameRules
} from './game/engine'

// ============================================================
// Setup Express + Socket.io
// ============================================================

const app = express()
app.use(cors())
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

const PORT = process.env.PORT || 3000

// ============================================================
// State global (en mémoire pour l'instant)
// ============================================================

interface Room {
  roomId: string
  players: { socketId: string; userId: string; name: string; country: string }[]
  state: GameState | null
  status: 'waiting' | 'playing' | 'finished'
}

const rooms = new Map<string, Room>()
const playerRoom = new Map<string, string>()   // socketId → roomId

// ============================================================
// REST — Health check
// ============================================================

app.get('/health', (_, res) => {
  res.json({ status: 'ok', rooms: rooms.size })
})

// ============================================================
// WebSocket events
// ============================================================

io.on('connection', (socket: Socket) => {
  console.log(`[+] Connexion : ${socket.id}`)

  // ----------------------------------------------------------
  // Rejoindre / créer une room
  // ----------------------------------------------------------
  socket.on('join_room', ({
    roomId,
    userId,
    name,
    country
  }: {
    roomId: string
    userId: string
    name: string
    country: string
  }) => {
    let room = rooms.get(roomId)

    if (!room) {
      room = { roomId, players: [], state: null, status: 'waiting' }
      rooms.set(roomId, room)
    }

    if (room.status === 'playing') {
      socket.emit('error', { message: 'Partie déjà en cours' })
      return
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room complète' })
      return
    }

    room.players.push({ socketId: socket.id, userId, name, country })
    playerRoom.set(socket.id, roomId)
    socket.join(roomId)

    io.to(roomId).emit('room_updated', {
      roomId,
      players: room.players.map(p => ({ userId: p.userId, name: p.name })),
      status: room.status
    })

    console.log(`[Room ${roomId}] ${name} a rejoint (${room.players.length}/2)`)

    // 2 joueurs → on démarre automatiquement
    if (room.players.length === 2) {
      startGame(roomId, room)
    }
  })

  // ----------------------------------------------------------
  // Jouer une carte
  // ----------------------------------------------------------
  socket.on('play_card', ({
    cardId,
    captureIds
  }: {
    cardId: string
    captureIds?: string[]
  }) => {
    const roomId = playerRoom.get(socket.id)
    if (!roomId) return

    const room = rooms.get(roomId)
    if (!room?.state) return

    const player = room.players.find(p => p.socketId === socket.id)
    if (!player) return

    const { state: newState, result } = playCard(
      room.state,
      player.userId,
      cardId,
      captureIds
    )

    room.state = newState

    // Envoyer le résultat à tous les joueurs de la room
    io.to(roomId).emit('game_updated', sanitizeState(newState, null))

    // Feedback spécifique au joueur qui a joué
    socket.emit('play_result', result)

    if (result.type === 'capture' && result.isChkoba) {
      io.to(roomId).emit('chkoba', {
        playerName: player.name,
        message: `${player.name} fait une Chkoba !`
      })
    }

    if (newState.phase === 'finished') {
      io.to(roomId).emit('game_over', {
        scores: newState.players.map(p => ({
          name: p.name,
          score: p.score,
          chkobas: p.chkobaCount
        })),
        log: newState.log
      })
      room.status = 'finished'
    }
  })

  // ----------------------------------------------------------
  // Demander les captures possibles (preview pour l'UI iOS)
  // ----------------------------------------------------------
  socket.on('get_captures', ({ cardId }: { cardId: string }) => {
    const roomId = playerRoom.get(socket.id)
    if (!roomId) return

    const room = rooms.get(roomId)
    if (!room?.state) return

    const player = room.players.find(p => p.socketId === socket.id)
    if (!player) return

    const card = room.state.players
      .find(p => p.id === player.userId)
      ?.hand.find(c => c.id === cardId)

    if (!card) return

    const captures = findValidCaptures(card, room.state.table)
    socket.emit('captures_available', { cardId, captures })
  })

  // ----------------------------------------------------------
  // Déconnexion
  // ----------------------------------------------------------
  socket.on('disconnect', () => {
    const roomId = playerRoom.get(socket.id)
    if (roomId) {
      const room = rooms.get(roomId)
      if (room && room.status === 'playing') {
        io.to(roomId).emit('player_disconnected', {
          message: 'Adversaire déconnecté. Partie suspendue.'
        })
        room.status = 'waiting'
      }
      playerRoom.delete(socket.id)
    }
    console.log(`[-] Déconnexion : ${socket.id}`)
  })
})

// ============================================================
// Démarrer une partie
// ============================================================

function startGame(roomId: string, room: Room) {
  const [p1, p2] = room.players

  // Les règles s'adaptent au pays du premier joueur
  // (on pourra affiner : règles communes, vote, etc.)
  const country = p1.country as keyof typeof RULES_BY_COUNTRY
  const rules: GameRules = RULES_BY_COUNTRY[country] ?? RULES_BY_COUNTRY.default

  const state = initGame(
    [p1.userId, p2.userId],
    [p1.name, p2.name],
    rules
  )

  room.state = state
  room.status = 'playing'

  // Chaque joueur reçoit uniquement SA main (pas celle de l'adversaire)
  room.players.forEach((p, i) => {
    const socket = io.sockets.sockets.get(p.socketId)
    if (socket) {
      socket.emit('game_started', {
        gameId: state.gameId,
        rules,
        myIndex: i,
        myHand: state.players[i].hand,
        table: state.table,
        currentPlayerIndex: state.currentPlayerIndex,
        players: state.players.map(pl => ({
          id: pl.id,
          name: pl.name,
          handCount: pl.hand.length,
          score: pl.score
        }))
      })
    }
  })

  console.log(`[Room ${roomId}] Partie démarrée — règles: ${rules.country}`)
}

// ============================================================
// Sanitize : on n'envoie jamais la main de l'adversaire
// ============================================================

function sanitizeState(state: GameState, forUserId: string | null) {
  return {
    gameId: state.gameId,
    table: state.table,
    currentPlayerIndex: state.currentPlayerIndex,
    phase: state.phase,
    round: state.round,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,    // seulement le nombre, pas les cartes
      capturedCount: p.captured.length,
      chkobaCount: p.chkobaCount,
      score: p.score,
      // La main complète seulement pour le joueur concerné
      hand: p.id === forUserId ? p.hand : undefined
    }))
  }
}

// ============================================================
// Démarrage
// ============================================================

httpServer.listen(PORT, () => {
  console.log(`Serveur Chkoba en ligne sur le port ${PORT}`)
})
