# Chkoba iOS App

App iOS pour Chkoba, jeu de cartes multijoueur en temps réel via WebSocket.

## Structure

```
Chkoba/
├── App/
│   └── ChkobaApp.swift          # Point d'entrée SwiftUI
├── Network/
│   └── SocketManager.swift      # WebSocket Client
├── Models/
│   ├── Card.swift               # Card & Suit models
│   └── GameState.swift          # Game data structures
├── ViewModels/
│   └── GameViewModel.swift      # State management
└── Views/
    ├── GameView.swift           # Main game screen
    └── CardView.swift           # Card component
```

## Setup

### 1. Ouvrir dans Xcode

```bash
open Chkoba -a Xcode
```

Ou via Xcode directement : File → Open Folder → sélectionne `Chkoba/`

### 2. Configuration

- **Target**: iPhone 15+ (minimum iOS 15)
- **Backend**: Le serveur Node.js doit tourner sur `http://localhost:3000`

### 3. Lancer

```
Cmd+R dans Xcode (ou ⌘R)
```

## Fonctionnalités

✅ **Login** - Sélection pseudo + pays
✅ **Matchmaking** - Attente adversaire en temps réel
✅ **Gameplay** - Affichage cartes, captures, Chkoba
✅ **Score** - Résultats finaux avec points

## Backend requis

```bash
cd backend
npm run dev  # Doit tourner sur le port 3000
```
