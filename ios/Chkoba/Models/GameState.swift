import Foundation

struct PlayerInfo: Codable {
    let id: String
    let name: String
    let handCount: Int
    let capturedCount: Int
    let chkobaCount: Int
    let score: Int
    let hand: [Card]?
}

struct GameUpdate: Codable {
    let gameId: String
    let table: [Card]
    let currentPlayerIndex: Int
    let phase: String
    let round: Int
    let players: [PlayerInfo]
}

struct GameStarted: Codable {
    let gameId: String
    let myIndex: Int
    let myHand: [Card]
    let table: [Card]
    let currentPlayerIndex: Int
    let players: [PlayerInfo]
}

struct PlayResult: Codable {
    let type: String       // "capture", "place", "error"
    let captured: [Card]?
    let isChkoba: Bool?
    let message: String?
}
