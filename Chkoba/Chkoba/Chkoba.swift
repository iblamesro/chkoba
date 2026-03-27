import SwiftUI

enum Suit: String, Codable {
    case clubs, diamonds, hearts, spades
    
    var symbol: String {
        switch self {
        case .clubs:    return "♣"
        case .diamonds: return "♦"
        case .hearts:   return "♥"
        case .spades:   return "♠"
        }
    }
    
    var color: String {
        switch self {
        case .diamonds, .hearts: return "red"
        default: return "black"
        }
    }
}

struct Card: Codable, Identifiable, Equatable {
    let id: String
    let rank: Int
    let suit: Suit
    let value: Int
    
    var displayRank: String {
        switch rank {
        case 1:  return "A"
        case 11: return "J"
        case 12: return "Q"
        case 13: return "K"
        default: return "\(rank)"
        }
    }
}

class ChkobaSocketManager: NSObject, ObservableObject {
    static let shared = ChkobaSocketManager()
    
    @Published var isConnected = false
    
    var onGameStarted: ((GameStarted) -> Void)?
    var onGameUpdated: ((GameUpdate) -> Void)?
    var onPlayResult: ((PlayResult) -> Void)?
    var onError: ((String) -> Void)?
    
    private var urlSession: URLSession
    private var webSocket: URLSessionWebSocketTask?
    
    private override init() {
        self.urlSession = URLSession(configuration: .default)
        super.init()
    }
    
    func connect() {
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
    }
    
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
    
    private func emit(_ event: String, _ data: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: data),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }
        
        let message = "42[\"\(event)\",\(jsonString)]"
        webSocket?.send(.string(message)) { _ in }
    }
    
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
            }
        }
    }
    
    private func handleMessage(_ message: String) {
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
            case "error":
                if let message = eventData["message"] as? String {
                    self.onError?(message)
                }
            default:
                break
            }
        }
    }
    
    private func decode<T: Decodable>(_ type: T.Type, from dict: [String: Any]) -> T? {
        guard let data = try? JSONSerialization.data(withJSONObject: dict) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}

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
    let type: String
    let captured: [Card]?
    let isChkoba: Bool?
    let message: String?
}

class GameViewModel: ObservableObject {
    @Published var myHand: [Card] = []
    @Published var table: [Card] = []
    @Published var players: [PlayerInfo] = []
    @Published var currentPlayerIndex: Int = 0
    @Published var myIndex: Int = 0
    @Published var phase: String = "waiting"
    @Published var round: Int = 1
    @Published var selectedCard: Card? = nil
    @Published var errorMessage: String? = nil
    
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
        }
        
        socket.onPlayResult = { [weak self] result in
            if result.type == "error" {
                self?.errorMessage = result.message
            }
            self?.selectedCard = nil
        }
        
        socket.onError = { [weak self] message in
            self?.errorMessage = message
        }
    }
    
    func selectCard(_ card: Card) {
        guard isMyTurn else { return }
        selectedCard = card
    }
    
    func playSelected() {
        guard let card = selectedCard else { return }
        socket.playCard(cardId: card.id)
    }
    
    func joinGame(name: String, country: String) {
        let userId = UUID().uuidString
        socket.connect()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            socket.joinRoom(roomId: "room-1", userId: userId, name: name, country: country)
        }
    }
}

struct CardView: View {
    let card: Card
    var isSelected: Bool = false
    
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white)
                .shadow(color: isSelected ? .blue.opacity(0.5) : .black.opacity(0.15), radius: 3, y: 2)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(isSelected ? Color.blue : Color.gray.opacity(0.2), lineWidth: isSelected ? 2 : 0.5)
                )
            
            VStack(spacing: 2) {
                Text(card.displayRank)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(card.suit.color == "red" ? .red : .black)
                Text(card.suit.symbol)
                    .font(.system(size: 16))
                    .foregroundColor(card.suit.color == "red" ? .red : .black)
            }
        }
        .frame(width: 70, height: 100)
        .scaleEffect(isSelected ? 1.08 : 1.0)
        .animation(.spring(response: 0.2), value: isSelected)
    }
}

struct GameView: View {
    @StateObject private var vm = GameViewModel()
    @State private var playerName = ""
    @State private var country = "tunisia"
    @State private var hasJoined = false
    
    var body: some View {
        ZStack {
            Color(red: 0.13, green: 0.45, blue: 0.22).ignoresSafeArea()
            
            if !hasJoined {
                joinView
            } else if vm.phase == "waiting" {
                VStack(spacing: 16) {
                    ProgressView().tint(.white).scaleEffect(1.5)
                    Text("En attente d'un adversaire...").foregroundColor(.white).font(.headline)
                }
            } else {
                gamePlayView
            }
        }
    }
    
    var joinView: some View {
        VStack(spacing: 24) {
            Text("Chkoba").font(.system(size: 48, weight: .bold)).foregroundColor(.white)
            
            TextField("Ton prénom", text: $playerName)
                .textFieldStyle(.roundedBorder)
                .frame(width: 240)
            
            Picker("Pays", selection: $country) {
                Text("Tunisie").tag("tunisia")
                Text("Algérie").tag("algeria")
                Text("Maroc").tag("morocco")
            }
            .pickerStyle(.segmented)
            .frame(width: 280)
            
            Button("Jouer") {
                guard !playerName.isEmpty else { return }
                vm.joinGame(name: playerName, country: country)
                hasJoined = true
            }
            .font(.system(size: 18, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 40)
            .padding(.vertical, 14)
            .background(Color.orange)
            .cornerRadius(12)
        }
        .padding()
    }
    
    var gamePlayView: some View {
        VStack(spacing: 16) {
            if let opponent = vm.players[safe: 1 - vm.myIndex] {
                HStack {
                    Text(opponent.name).foregroundColor(.white)
                    Spacer()
                    Text("\(opponent.handCount) cartes").foregroundColor(.white.opacity(0.7))
                }
                .padding(.horizontal, 16)
            }
            
            Spacer()
            
            VStack(spacing: 8) {
                Text("Table (Tour \(vm.round))").foregroundColor(.white.opacity(0.6))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(vm.table) { card in
                            CardView(card: card)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
            
            Spacer()
            
            VStack(spacing: 8) {
                if let me = vm.players[safe: vm.myIndex] {
                    Text("\(me.name) - Score: \(me.score)").foregroundColor(.white)
                }
                
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: -12) {
                        ForEach(vm.myHand) { card in
                            CardView(card: card, isSelected: vm.selectedCard == card)
                                .onTapGesture { vm.selectCard(card) }
                                .offset(y: vm.selectedCard == card ? -16 : 0)
                        }
                    }
                    .padding(.horizontal, 24)
                }
            }
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.15))
            
            VStack {
                if !vm.isMyTurn {
                    Text("Tour de l'adversaire…").foregroundColor(.white.opacity(0.6)).font(.caption)
                } else if let _ = vm.selectedCard {
                    Button("Poser la carte") { vm.playSelected() }
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.blue)
                        .cornerRadius(10)
                }
            }
            .frame(height: 40)
        }
        .padding(.vertical, 8)
    }
}

extension Collection {
    subscript(safe index: Index) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

@main
struct ChkobaApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
        }
    }
}

#Preview {
    GameView()
}
