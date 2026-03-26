import SwiftUI

struct CardView: View {
    let card: Card
    var isSelected: Bool = false
    var isHighlighted: Bool = false
    var size: CardSize = .normal

    enum CardSize {
        case small, normal, large
        var width: CGFloat {
            switch self { case .small: return 50; case .normal: return 70; case .large: return 90 }
        }
        var height: CGFloat { width * 1.4 }
        var fontSize: CGFloat {
            switch self { case .small: return 12; case .normal: return 16; case .large: return 22 }
        }
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.white)
                .shadow(
                    color: isSelected ? .blue.opacity(0.5) : .black.opacity(0.15),
                    radius: isSelected ? 8 : 3,
                    y: 2
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(
                            isSelected ? Color.blue :
                            isHighlighted ? Color.orange :
                            Color.gray.opacity(0.2),
                            lineWidth: isSelected || isHighlighted ? 2 : 0.5
                        )
                )

            VStack(spacing: 2) {
                Text(card.displayRank)
                    .font(.system(size: size.fontSize, weight: .bold))
                    .foregroundColor(card.suit.color == "red" ? .red : .black)
                Text(card.suit.symbol)
                    .font(.system(size: size.fontSize))
                    .foregroundColor(card.suit.color == "red" ? .red : .black)
            }
        }
        .frame(width: size.width, height: size.height)
        .scaleEffect(isSelected ? 1.08 : 1.0)
        .animation(.spring(response: 0.2), value: isSelected)
    }
}

#Preview {
    CardView(card: Card(id: "7-hearts", rank: 7, suit: .hearts, value: 7), isSelected: false)
}
