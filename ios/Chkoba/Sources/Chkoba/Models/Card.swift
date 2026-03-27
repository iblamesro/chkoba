import Foundation

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
        default:                 return "black"
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
