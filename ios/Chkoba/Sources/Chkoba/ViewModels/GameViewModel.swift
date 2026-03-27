import Foundation
import Combine

class GameViewModel: ObservableObject {
    @Published var myHand: [Card] = []
    @Published var table: [Card] = []
    @Published var players: [PlayerInfo] = []
    @Published var currentPlayerIndex: Int = 0
    @Published var myIndex: Int = 0
    @Published var phase: String = "waiting"
    @Published var round: Int = 1

    @Published var selectedCard: Card? = nil
    @Published var availableCaptures: [[Card]] = []
    @Published var chkobaMessage: String? = nil
    @Published var errorMessage: String? = nil
    @Published var gameOverData: [String: Any]? = nil

    var isMyTurn: Bool { currentPlayerIndex == myIndex }

    private let socket = ChkobaSocketManager.shared

    init() {
        bindSocket()
    }

    private func bindSocket() {
        socket.onGameStarted = { [weak self] data in
            self?.myIndex = data.myIndex
            self?.myHand = data.myHand
            self?.table = data.table
            self?.players = data.players
            self?.currentPlayerIndex = data.currentPlayerIndex
            self?.phase = "playing"
        }

        socket.onGameUpdated = { [weak self] update in
            self?.table = update.table
            self?.currentPlayerIndex = update.currentPlayerIndex
            self?.phase = update.phase
            self?.round = update.round
            self?.players = update.players
            // Mettre à jour ma main si elle est dans l'update
            if let myHand = update.players[safe: self?.myIndex ?? 0]?.hand {
                self?.myHand = myHand
            }
        }

        socket.onPlayResult = { [weak self] result in
            if result.type == "error" {
                self?.errorMessage = result.message
            }
            self?.selectedCard = nil
            self?.availableCaptures = []
        }

        socket.onCapturesAvailable = { [weak self] data in
            // Parser les captures disponibles pour l'UI
            if let captures = data["captures"] as? [[[String: Any]]] {
                let decoded = captures.compactMap { group -> [Card]? in
                    let cards = group.compactMap { dict -> Card? in
                        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
                        return try? JSONDecoder().decode(Card.self, from: data)
                    }
                    return cards.isEmpty ? nil : cards
                }
                self?.availableCaptures = decoded
            }
        }

        socket.onChkoba = { [weak self] message in
            self?.chkobaMessage = message
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                self?.chkobaMessage = nil
            }
        }

        socket.onGameOver = { [weak self] data in
            self?.gameOverData = data
            self?.phase = "finished"
        }

        socket.onError = { [weak self] message in
            self?.errorMessage = message
        }
    }

    // MARK: - Actions

    func selectCard(_ card: Card) {
        guard isMyTurn else { return }
        selectedCard = card
        availableCaptures = []
        socket.getCaptures(cardId: card.id)
    }

    func playSelected(captureIds: [String] = []) {
        guard let card = selectedCard else { return }
        socket.playCard(cardId: card.id, captureIds: captureIds)
    }

    func joinGame(name: String, country: String) {
        let userId = UUID().uuidString
        socket.connect()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.socket.joinRoom(
                roomId: "room-1",
                userId: userId,
                name: name,
                country: country
            )
        }
    }
}

// Safe array subscript
extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
