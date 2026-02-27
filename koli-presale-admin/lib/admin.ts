import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getMint,
  getAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import { getProgram, DEVNET_CONNECTION, solToLamports } from "./anchor";
import {
  derivePresalePDASync,
  deriveTreasuryPDASync,
  deriveVaultPDASync,
  deriveUserAllocationPDASync,
} from "./pda";

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

export async function fetchPresaleState(
  wallet: AnchorWallet,
  mintAddress: string,
  connection?: Connection
): Promise<PresaleState | null> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const mintPubkey = new PublicKey(mintAddress);
    const [presalePDA] = derivePresalePDASync(wallet.publicKey, mintPubkey);

    const state = await (program.account as any).presale.fetch(presalePDA);
    return {
      admin: state.admin.toString(),
      mint: state.mint.toString(),
      vault: state.vault.toString(),
      treasury: state.treasury.toString(),
      totalSold: state.totalSold.toString(),
      totalClaimed: state.totalClaimed.toString(),
      maxSupply: state.maxSupply.toString(),
      basePrice: state.basePrice.toString(),
      priceIncrement: state.priceIncrement.toString(),
      startTime: state.startTime.toNumber(),
      endTime: state.endTime.toNumber(),
      cliffTime: state.cliffTime.toNumber(),
      vestingEnd: state.vestingEnd.toNumber(),
      paused: state.paused,
      bump: state.bump,
    };
  } catch (e) {
    return null;
  }
}

export async function fetchUserAllocation(
  wallet: AnchorWallet,
  userAddress: string,
  connection?: Connection
): Promise<UserAllocationState | null> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const userPubkey = new PublicKey(userAddress);
    const [userAllocPDA] = deriveUserAllocationPDASync(userPubkey);

    const state = await (program.account as any).userAllocation.fetch(userAllocPDA);
    return {
      user: state.user.toString(),
      presale: state.presale.toString(),
      amountPurchased: state.amountPurchased.toString(),
      amountClaimed: state.amountClaimed.toString(),
      bump: state.bump,
    };
  } catch (e) {
    return null;
  }
}

export async function initializePresale(
  wallet: AnchorWallet,
  params: {
    mintAddress: string;
    basePrice: number;
    priceIncrement: number;
    maxSupply: number;
    startTime: number;
    endTime: number;
    cliffTime: number;
    vestingEnd: number;
  },
  connection?: Connection
): Promise<TxResult> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const mintPubkey = new PublicKey(params.mintAddress);

    const [presalePDA] = derivePresalePDASync(wallet.publicKey, mintPubkey);
    const [treasuryPDA] = deriveTreasuryPDASync(presalePDA);
    const [vaultPDA] = deriveVaultPDASync(presalePDA);

    const sig = await (program.methods as any)
      .initializePresale(
        new BN(solToLamports(params.basePrice)),
        new BN(solToLamports(params.priceIncrement)),
        new BN(params.maxSupply * 1e9),
        new BN(params.startTime),
        new BN(params.endTime),
        new BN(params.cliffTime),
        new BN(params.vestingEnd)
      )
      .accounts({
        presale: presalePDA,
        treasury: treasuryPDA,
        vault: vaultPDA,
        mint: mintPubkey,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    return { signature: sig, success: true };
  } catch (e: any) {
    return { signature: "", success: false, error: e.message || String(e) };
  }
}

export async function setPause(
  wallet: AnchorWallet,
  mintAddress: string,
  paused: boolean,
  connection?: Connection
): Promise<TxResult> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const mintPubkey = new PublicKey(mintAddress);
    const [presalePDA] = derivePresalePDASync(wallet.publicKey, mintPubkey);

    const sig = await (program.methods as any)
      .setPause(paused)
      .accounts({
        presale: presalePDA,
        admin: wallet.publicKey,
      })
      .rpc();

    return { signature: sig, success: true };
  } catch (e: any) {
    return { signature: "", success: false, error: e.message || String(e) };
  }
}

export async function withdrawTreasury(
  wallet: AnchorWallet,
  mintAddress: string,
  amountSol: number,
  connection?: Connection
): Promise<TxResult> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const mintPubkey = new PublicKey(mintAddress);
    const [presalePDA] = derivePresalePDASync(wallet.publicKey, mintPubkey);
    const [treasuryPDA] = deriveTreasuryPDASync(presalePDA);

    const sig = await (program.methods as any)
      .withdrawTreasury(new BN(solToLamports(amountSol)))
      .accounts({
        presale: presalePDA,
        treasury: treasuryPDA,
        admin: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature: sig, success: true };
  } catch (e: any) {
    return { signature: "", success: false, error: e.message || String(e) };
  }
}

export async function buyTokens(
  wallet: AnchorWallet,
  mintAddress: string,
  adminAddress: string,
  solAmount: number,
  connection?: Connection
): Promise<TxResult> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const mintPubkey = new PublicKey(mintAddress);
    const adminPubkey = new PublicKey(adminAddress);
    const [presalePDA] = derivePresalePDASync(adminPubkey, mintPubkey);
    const [treasuryPDA] = deriveTreasuryPDASync(presalePDA);
    const [userAllocPDA] = deriveUserAllocationPDASync(wallet.publicKey);

    const sig = await (program.methods as any)
      .buyTokens(new BN(solToLamports(solAmount)))
      .accounts({
        presale: presalePDA,
        treasury: treasuryPDA,
        userAllocation: userAllocPDA,
        buyer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature: sig, success: true };
  } catch (e: any) {
    return { signature: "", success: false, error: e.message || String(e) };
  }
}

export async function claimTokens(
  wallet: AnchorWallet,
  mintAddress: string,
  adminAddress: string,
  connection?: Connection
): Promise<TxResult> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const program = getProgram(wallet, conn);
    const mintPubkey = new PublicKey(mintAddress);
    const adminPubkey = new PublicKey(adminAddress);
    const [presalePDA] = derivePresalePDASync(adminPubkey, mintPubkey);
    const [vaultPDA] = deriveVaultPDASync(presalePDA);
    const [userAllocPDA] = deriveUserAllocationPDASync(wallet.publicKey);

    const userTokenAccount = getAssociatedTokenAddressSync(
      mintPubkey,
      wallet.publicKey
    );

    const sig = await (program.methods as any)
      .claimTokens()
      .accounts({
        presale: presalePDA,
        vault: vaultPDA,
        userAllocation: userAllocPDA,
        userTokenAccount,
        claimer: wallet.publicKey,
        mint: mintPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature: sig, success: true };
  } catch (e: any) {
    return { signature: "", success: false, error: e.message || String(e) };
  }
}

export async function getVaultBalance(
  vaultAddress: string,
  connection?: Connection
): Promise<{ balance: number; decimals: number } | null> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const vaultPubkey = new PublicKey(vaultAddress);
    const accountInfo = await getAccount(conn, vaultPubkey);
    const mintInfo = await getMint(conn, accountInfo.mint);
    return {
      balance: Number(accountInfo.amount),
      decimals: mintInfo.decimals,
    };
  } catch {
    return null;
  }
}

export async function getTreasuryBalance(
  treasuryAddress: string,
  connection?: Connection
): Promise<number> {
  try {
    const conn = connection || DEVNET_CONNECTION;
    const treasuryPubkey = new PublicKey(treasuryAddress);
    const balance = await conn.getBalance(treasuryPubkey);
    return balance;
  } catch {
    return 0;
  }
}
