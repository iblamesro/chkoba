import { io } from 'socket.io-client'

// Client 1 : Alice
const client1 = io('http://localhost:3000', { reconnection: true })

client1.on('connect', () => {
  console.log('✓ [Alice] Connectée')
  client1.emit('join_room', {
    roomId: 'test-game',
    userId: 'alice',
    name: 'Alice',
    country: 'tunisia'
  })
})

client1.on('room_updated', (data) => {
  console.log(`📢 [Alice] Room: ${data.players.length}/2 joueurs`)
})

client1.on('game_started', (data) => {
  console.log(`🎮 [Alice] Partie démarrée! Ma main: ${data.myHand.length} cartes`)
  console.log(`🎮 [Alice] Table: ${data.table.length} cartes`)
  console.log(`🎮 [Alice] C'est au joueur ${data.currentPlayerIndex === 0 ? 'Alice' : 'Bob'} de jouer`)
})

// Client 2 : Bob (après 1 seconde)
setTimeout(() => {
  const client2 = io('http://localhost:3000', { reconnection: true })

  client2.on('connect', () => {
    console.log('✓ [Bob] Connecté')
    client2.emit('join_room', {
      roomId: 'test-game',
      userId: 'bob',
      name: 'Bob',
      country: 'algeria'
    })
  })

  client2.on('room_updated', (data) => {
    console.log(`📢 [Bob] Room: ${data.players.length}/2 joueurs`)
  })

  client2.on('game_started', (data) => {
    console.log(`🎮 [Bob] Partie démarrée! Ma main: ${data.myHand.length} cartes`)
    console.log(`🎮 [Bob] Table: ${data.table.length} cartes`)
    console.log(`🎮 [Bob] C'est au joueur ${data.currentPlayerIndex === 0 ? 'Alice' : 'Bob'} de jouer`)
    
    // Fermer après quelques secondes
    setTimeout(() => {
      client1.disconnect()
      client2.disconnect()
      process.exit(0)
    }, 2000)
  })
}, 1000)

setTimeout(() => {
  console.log('Timeout')
  process.exit(1)
}, 10000)
