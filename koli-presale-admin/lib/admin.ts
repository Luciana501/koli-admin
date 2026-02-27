// Preview-only mock implementations for presale admin UI.
// No on-chain reads/writes are performed in this file.

export interface PresaleState {
  admin: string;
  mint: string;
  vault: string;
  treasury: string;
  totalSold: string;
  totalClaimed: string;
  maxSupply: string;
  basePrice: string;
  priceIncrement: string;
  startTime: number;
  endTime: number;
  cliffTime: number;
  vestingEnd: number;
  paused: boolean;
  bump: number;
}

export interface UserAllocationState {
  user: string;
  presale: string;
  amountPurchased: string;
  amountClaimed: string;
  bump: number;
}

export interface TxResult {
  signature: string;
  success: boolean;
  error?: string;
}

type MaybeWallet = { publicKey?: { toString: () => string } } | null | undefined;

const PREVIEW_ADMIN = "PREVIEW_ADMIN_4xexkQVDQ8ebsAxGjCetizM387ccsM";
const PREVIEW_BASE_PRICE = "1000000"; // 0.001 SOL in lamports
const PREVIEW_PRICE_INCREMENT = "100"; // 0.0000001 SOL in lamports
const PREVIEW_MAX_SUPPLY = "1000000000000000"; // 1,000,000 tokens @ 9 decimals

function wait(ms = 220): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fakeSignature(): string {
  return `preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function cleanMint(mintAddress: string): string {
  return mintAddress?.trim() || "PREVIEW_MINT_9f8a7b6c5d4e3f2a1b";
}

function previewAddress(prefix: string, mintAddress: string): string {
  const mint = cleanMint(mintAddress).replace(/[^a-zA-Z0-9]/g, "").slice(0, 20);
  return `${prefix}_${mint || "PREVIEW"}`;
}

function walletAddress(wallet: MaybeWallet): string {
  return wallet?.publicKey?.toString?.() || PREVIEW_ADMIN;
}

export async function fetchPresaleState(
  wallet: MaybeWallet,
  mintAddress: string,
  _connection?: unknown
): Promise<PresaleState | null> {
  await wait();

  const now = Math.floor(Date.now() / 1000);
  const mint = cleanMint(mintAddress);

  return {
    admin: walletAddress(wallet),
    mint,
    vault: previewAddress("PREVIEW_VAULT", mint),
    treasury: previewAddress("PREVIEW_TREASURY", mint),
    totalSold: "278000000000000",
    totalClaimed: "124000000000000",
    maxSupply: PREVIEW_MAX_SUPPLY,
    basePrice: PREVIEW_BASE_PRICE,
    priceIncrement: PREVIEW_PRICE_INCREMENT,
    startTime: now - 86400,
    endTime: now + 86400 * 14,
    cliffTime: now + 86400 * 21,
    vestingEnd: now + 86400 * 120,
    paused: false,
    bump: 255,
  };
}

export async function fetchUserAllocation(
  _wallet: MaybeWallet,
  userAddress: string,
  _connection?: unknown
): Promise<UserAllocationState | null> {
  await wait();

  if (!userAddress?.trim()) return null;

  return {
    user: userAddress.trim(),
    presale: "PREVIEW_PRESALE_9a8b7c6d5e4f3g2h",
    amountPurchased: "15000000000",
    amountClaimed: "4500000000",
    bump: 254,
  };
}

export async function initializePresale(
  _wallet: MaybeWallet,
  _params: {
    mintAddress: string;
    basePrice: number;
    priceIncrement: number;
    maxSupply: number;
    startTime: number;
    endTime: number;
    cliffTime: number;
    vestingEnd: number;
  },
  _connection?: unknown
): Promise<TxResult> {
  await wait();
  return { signature: fakeSignature(), success: true };
}

export async function setPause(
  _wallet: MaybeWallet,
  _mintAddress: string,
  _paused: boolean,
  _connection?: unknown
): Promise<TxResult> {
  await wait();
  return { signature: fakeSignature(), success: true };
}

export async function withdrawTreasury(
  _wallet: MaybeWallet,
  _mintAddress: string,
  _amountSol: number,
  _connection?: unknown
): Promise<TxResult> {
  await wait();
  return { signature: fakeSignature(), success: true };
}

export async function buyTokens(
  _wallet: MaybeWallet,
  _mintAddress: string,
  _adminAddress: string,
  _solAmount: number,
  _connection?: unknown
): Promise<TxResult> {
  await wait();
  return { signature: fakeSignature(), success: true };
}

export async function claimTokens(
  _wallet: MaybeWallet,
  _mintAddress: string,
  _adminAddress: string,
  _connection?: unknown
): Promise<TxResult> {
  await wait();
  return { signature: fakeSignature(), success: true };
}

export async function getVaultBalance(
  _vaultAddress: string,
  _connection?: unknown
): Promise<{ balance: number; decimals: number } | null> {
  await wait(120);
  return {
    balance: 734_000_000_000,
    decimals: 9,
  };
}

export async function getTreasuryBalance(
  _treasuryAddress: string,
  _connection?: unknown
): Promise<number> {
  await wait(120);
  return 61_500_000_000; // 61.5 SOL
}
