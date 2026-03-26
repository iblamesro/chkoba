import Foundation
import Combine

class ChkobaSocketManager: NSObject, ObservableObject {
    static let shared = ChkobaSocketManager()

    @Published var isConnected = false

    // Callbacks → ViewModel
    var onGameStarted: ((GameStarted) -> Void)?
    var onGameUpdated: ((GameUpdate) -> Void)?
    var onPlayResult: ((PlayResult) -> Void)?
    var onCapturesAvailable: (([String: Any]) -> Void)?
    var onChkoba: ((String) -> Void)?
    var onGameOver: (([String: Any]) -> Void)?
    var onPlayerDisconnected: (() -> Void)?
    var onError: ((String) -> Void)?

    private var urlSession: URLSession
    private var webSocket: URLSessionWebSocketTask?
    private var isConnecting = false

    private override init() {
        self.urlSession = URLSession(configuration: .default)
        super.init()
    }

    // MARK: - Connection

    func connect() {
        guard !isConnecting else { return }
        isConnecting = true

        let url = URL(string: "ws://localhost:3000/socket.io/?transport=websocket")!
        webSocket = urlSession.webSocketTask(with: url)
        webSocket?.resume()

        DispatchQueue.main.async {
            self.isConnected = true
            print("✓ WebSocket connecté")
        }

        receiveMessage()
    }

    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        DispatchQueue.main.async {
            self.isConnected = false
        }
        isConnecting = false
    }

    // MARK: - Send

    func joinRoom(roomId: String, userId: String, name: String, country: String) {
        let payload: [String: Any] = [
            "roomId": roomId,
            "userId": userId,
            "name": name,
            "country": country
        ]
        emit("join_room", payload)
    }

    func playCard(cardId: String, captureIds: [String] = []) {
        let payload: [String: Any] = [
            "cardId": cardId,
            "captureIds": captureIds
        ]
        emit("play_card", payload)
    }

    func getCaptures(cardId: String) {
        let payload: [String: Any] = ["cardId": cardId]
        emit("get_captures", payload)
    }

    private func emit(_ event: String, _ data: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }

        // Socket.io format: 2 (event), ["event_name", data]
        let message = "42[\"\(event)\",\(jsonString)]"
        webSocket?.send(.string(message)) { _ in }
    }

    // MARK: - Receive

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                self?.receiveMessage()

            case .failure(let error):
                print("❌ WebSocket error:", error)
                DispatchQueue.main.async {
                    self?.isConnected = false
                }
            }
        }
    }

    private func handleMessage(_ message: String) {
        // Parse Socket.io message format
        guard message.hasPrefix("42") else { return }

        let payload = String(message.dropFirst(2))
        guard let data = payload.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [Any],
              let eventName = array.first as? String,
              let eventData = array.last as? [String: Any] else { return }

        DispatchQueue.main.async {
            switch eventName {
            case "game_started":
                if let decoded = self.decode(GameStarted.self, from: eventData) {
                    self.onGameStarted?(decoded)
                }

            case "game_updated":
                if let decoded = self.decode(GameUpdate.self, from: eventData) {
                    self.onGameUpdated?(decoded)
                }

            case "play_result":
                if let decoded = self.decode(PlayResult.self, from: eventData) {
                    self.onPlayResult?(decoded)
                }

            case "captures_available":
                self.onCapturesAvailable?(eventData)

            case "chkoba":
                if let message = eventData["message"] as? String {
                    self.onChkoba?(message)
                }

            case "game_over":
                self.onGameOver?(eventData)

            case "player_disconnected":
                self.onPlayerDisconnected?()

            case "error":
                if let message = eventData["message"] as? String {
                    self.onError?(message)
                }

            default:
                break
            }
        }
    }

    // MARK: - Helpers

    private func decode<T: Decodable>(_ type: T.Type, from dict: [String: Any]) -> T? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
