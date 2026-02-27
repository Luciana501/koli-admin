# KOLI Presale Admin Panel

Admin dashboard for the KOLI Presale smart contract on Solana Devnet.

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS** + custom dark Web3 design system
- **@coral-xyz/anchor** for Anchor program integration
- **@solana/web3.js** + **@solana/spl-token**
- **Solana Wallet Adapter** (Phantom)
- **Framer Motion** for animations

## Setup

### 1. Install dependencies

```bash
npm install
# or
yarn install
```

### 2. Add your IDL

Place your `koli_presale.json` IDL file in `/idl/koli_presale.json`.

A scaffold IDL is already included — replace it with your actual compiled IDL from Anchor.

### 3. Run on devnet

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Program Info

- **Program ID:** `4xexkQVDQ8ebsAxGjCetizM387ccsMDqZwV5Y25vKQnj`
- **Network:** Solana Devnet

## PDA Seeds

| Account | Seeds |
|---------|-------|
| Presale | `["presale", admin_pubkey, mint_pubkey]` |
| Treasury | `["treasury", presale_pubkey]` |
| Vault | `["vault", presale_pubkey]` |
| User Allocation | `["user-allocation", user_pubkey]` |

## Features

### Admin Controls
- **Initialize Presale** — Deploy a new presale with full configuration
- **Pause / Unpause** — Toggle presale with animated switch
- **Withdraw Treasury** — Withdraw collected SOL from treasury PDA
- **Vault Viewer** — Live token balance in vault

### Test Tools
- **Test Buy** — Simulate a buy_tokens transaction as admin
- **Test Claim** — Simulate claim_tokens (respects vesting)

### Monitoring
- **Presale State** — Live presale state auto-refreshed every 5s
- **User Inspector** — Inspect any user's allocation PDA
- **PDA Tools** — Derive and copy all program PDAs
- **TX Console** — Live transaction log with Solana Explorer links

## Security

- Admin features are gated behind wallet verification
- Connected wallet is compared against `presale.admin` from on-chain state
- Non-admin wallets see "Read-only" mode — admin controls are disabled

## Usage

1. Connect your Phantom wallet (admin keypair)
2. Go to **Presale State** and enter your token mint address
3. Dashboard auto-detects admin from on-chain state
4. Navigate sections using the sidebar

## File Structure

```
/app
  layout.tsx          — Root layout + font imports
  page.tsx            — Main dashboard page
  providers.tsx       — Wallet adapter providers
  globals.css         — Design system, animations

/components
  AdminSidebar.tsx    — Navigation sidebar
  PresaleStateCard.tsx — Live presale state viewer
  InitializePresaleForm.tsx — Initialize instruction form
  PauseToggle.tsx     — Animated pause/unpause toggle
  WithdrawTreasury.tsx — Treasury withdrawal interface
  VaultViewer.tsx     — Vault token balance display
  TestBuy.tsx         — Admin test buy tool
  TestClaim.tsx       — Admin test claim tool
  UserInspector.tsx   — User allocation inspector
  PDATools.tsx        — PDA derivation & copy tools
  TransactionLog.tsx  — Transaction console

/lib
  anchor.ts           — Program setup, utilities
  pda.ts              — PDA derivation functions
  admin.ts            — Admin transaction helpers

/idl
  koli_presale.json   — Anchor IDL
```
