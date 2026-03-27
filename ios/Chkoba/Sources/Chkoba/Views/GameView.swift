import SwiftUI

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
                waitingView
            } else if vm.phase == "finished" {
                gameOverView
            } else {
                gamePlayView
            }

            // Overlay Chkoba
            if let msg = vm.chkobaMessage {
                Text(msg)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.yellow)
                    .padding(20)
                    .background(Color.black.opacity(0.7))
                    .cornerRadius(16)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.easeInOut, value: vm.chkobaMessage)
    }

    // MARK: - Join

    var joinView: some View {
        VStack(spacing: 24) {
            Text("Chkoba")
                .font(.system(size: 48, weight: .bold))
                .foregroundColor(.white)

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

    // MARK: - Waiting

    var waitingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .tint(.white)
                .scaleEffect(1.5)
            Text("En attente d'un adversaire...")
                .foregroundColor(.white)
                .font(.headline)
        }
    }

    // MARK: - Game Over

    var gameOverView: some View {
        VStack(spacing: 20) {
            Text("Partie terminée")
                .font(.title).bold().foregroundColor(.white)
            if let data = vm.gameOverData,
               let scores = data["scores"] as? [[String: Any]] {
                ForEach(scores.indices, id: \.self) { i in
                    if let name = scores[i]["name"] as? String,
                       let score = scores[i]["score"] as? Int {
                        Text("\(name) : \(score) pts")
                            .foregroundColor(.white)
                            .font(.title2)
                    }
                }
            }
        }
    }

    // MARK: - Gameplay

    var gamePlayView: some View {
        VStack(spacing: 0) {

            // Infos adversaire
            opponentBar

            Spacer()

            // Table
            tableArea

            Spacer()

            // Main du joueur
            playerHand

            // Action bar
            actionBar
        }
        .padding(.vertical, 8)
    }

    var opponentBar: some View {
        HStack {
            if let opponent = vm.players[safe: 1 - vm.myIndex] {
                Text(opponent.name)
                    .foregroundColor(.white).font(.subheadline)
                Spacer()
                Text("\(opponent.handCount) cartes")
                    .foregroundColor(.white.opacity(0.7)).font(.caption)
                Text("Score : \(opponent.score)")
                    .foregroundColor(.white).font(.subheadline)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.black.opacity(0.2))
    }

    var tableArea: some View {
        VStack(spacing: 8) {
            Text("Tour \(vm.round)")
                .font(.caption)
                .foregroundColor(.white.opacity(0.6))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(vm.table) { card in
                        let isHighlighted = vm.availableCaptures.contains(where: {
                            $0.contains(card)
                        })
                        CardView(card: card, isHighlighted: isHighlighted, size: .normal)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    var playerHand: some View {
        VStack(spacing: 8) {
            HStack {
                if let me = vm.players[safe: vm.myIndex] {
                    Text(me.name)
                        .foregroundColor(.white).font(.subheadline)
                    Spacer()
                    Text("Score : \(me.score)")
                        .foregroundColor(.white).font(.subheadline)
                }
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: -12) {
                    ForEach(vm.myHand) { card in
                        CardView(
                            card: card,
                            isSelected: vm.selectedCard == card,
                            size: .normal
                        )
                        .onTapGesture { vm.selectCard(card) }
                        .offset(y: vm.selectedCard == card ? -16 : 0)
                        .animation(.spring(response: 0.25), value: vm.selectedCard)
                    }
                }
                .padding(.horizontal, 24)
            }
        }
        .padding(.vertical, 8)
        .background(Color.black.opacity(0.15))
    }

    var actionBar: some View {
        VStack(spacing: 8) {
            if !vm.isMyTurn {
                Text("Tour de l'adversaire…")
                    .foregroundColor(.white.opacity(0.6))
                    .font(.caption)
            } else if let _ = vm.selectedCard {
                if vm.availableCaptures.isEmpty {
                    Button("Poser la carte") {
                        vm.playSelected()
                    }
                    .buttonStyle(ChkobaButtonStyle(color: .blue))
                } else {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(vm.availableCaptures.indices, id: \.self) { i in
                                let capture = vm.availableCaptures[i]
                                Button("Capturer \(capture.map(\.displayRank).joined(separator: "+"))") {
                                    vm.playSelected(captureIds: capture.map(\.id))
                                }
                                .buttonStyle(ChkobaButtonStyle(color: .orange))
                            }
                        }
                        .padding(.horizontal, 16)
                    }
                }
            }

            if let err = vm.errorMessage {
                Text(err)
                    .foregroundColor(.red)
                    .font(.caption)
            }
        }
        .frame(height: 60)
    }
}

struct ChkobaButtonStyle: ButtonStyle {
    let color: Color
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .background(color.opacity(configuration.isPressed ? 0.7 : 1))
            .cornerRadius(10)
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}

#Preview {
    GameView()
}
