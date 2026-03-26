import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', {
  reconnection: true
})

socket.on('connect', () => {
  console.log('✓ Connecté au serveur!')

  // Joindre une room
  socket.emit('join_room', {
    roomId: 'test-room-1',
    userId: 'user1',
    name: 'Alice',
    country: 'tunisia'
  })
})

socket.on('room_updated', (data) => {
  console.log('📢 Room updated:', JSON.stringify(data, null, 2))
})

socket.on('game_started', (data) => {
  console.log('🎮 Game started:', JSON.stringify(data, null, 2))
  setTimeout(() => process.exit(0), 1000)
})

socket.on('disconnect', () => {
  console.log('Déconnecté')
  process.exit(0)
})

socket.on('error', (err) => {
  console.error('❌ Erreur:', err)
  process.exit(1)
})

setTimeout(() => {
  console.log('⏱️  Timeout - aucun événement reçu')
  process.exit(0)
}, 5000)
