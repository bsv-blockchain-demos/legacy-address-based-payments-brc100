# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Legacy Bridge application that enables BSV payments between traditional Bitcoin SV addresses and modern BRC-100 wallets. It serves as a bridge between legacy and modern BSV wallet ecosystems, allowing users to:
- Generate public "Mountaintops" addresses with QR codes for receiving funds
- Import BSV from legacy addresses to BRC-100 wallets  
- Send payments to legacy addresses from BRC-100 wallets
- Track transaction history with blockchain links

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (localhost:5173)
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Preview production build
npm run preview

# Docker deployment (serves on port 8080)
docker-compose up -d
```

## Architecture & Key Components

### Technology Stack
- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: Material-UI with Emotion styling
- **BSV Integration**: BSV SDK v1.6.1 + Wallet Toolbox Client
- **Containerization**: Multi-stage Docker build with nginx

### Core Architecture

The application uses a protocol-based key derivation system with the protocol ID 'mountaintops'. Key architectural components:

1. **src/components/** - React UI components
   - `SendForm.tsx` - Handles sending BSV to legacy addresses
   - `ImportForm.tsx` - Imports funds from legacy addresses
   - `AddressDetails.tsx` - Displays generated address with QR code
   - `TransactionHistory.tsx` - Shows transaction history

2. **src/Importer.ts** - Core transaction signing logic
   - Implements ScriptTemplate interface
   - Handles P2PKH script creation
   - Manages transaction unlocking

3. **src/App.tsx** - Main application logic
   - Manages wallet connection via BRC-100
   - Handles protocol-specific key generation
   - Coordinates between components

### Key Technical Details

- **Protocol ID**: Uses 'mountaintops' for deterministic key derivation
- **Transaction Format**: Supports BEEF (BSV Extended Exchange Format)
- **Blockchain API**: Integrates with WhatsOnChain (includes hardcoded API key)
- **Network Support**: Both mainnet and testnet
- **Wallet Integration**: Requires BRC-100 compatible wallet (e.g., Metanet Desktop)

### Important Patterns

1. **Key Derivation**: Uses BSV SDK's protocol-based key derivation for address generation
2. **Transaction Building**: Custom transaction creation using BSV SDK's Transaction class
3. **External API Usage**: WhatsOnChain for blockchain data and UTXO queries
4. **State Management**: React hooks for local state management

## CI/CD & Deployment

- **GitHub Actions**: Builds and publishes Docker images to GHCR on main branch pushes
- **Docker**: Multi-stage build creates optimized nginx container
- **Production**: Serves static files via nginx on port 8080