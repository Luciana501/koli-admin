import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { AnchorProvider, Program, Idl } from "@coral-xyz/anchor";
import { AnchorWallet } from "@solana/wallet-adapter-react";
import idl from "@/idl/koli_presale.json";

export const PROGRAM_ID = new PublicKey("4xexkQVDQ8ebsAxGjCetizM387ccsMDqZwV5Y25vKQnj");
export const DEVNET_CONNECTION = new Connection(clusterApiUrl("devnet"), "confirmed");

export function getProgram(wallet: AnchorWallet, connection?: Connection) {
  const conn = connection || DEVNET_CONNECTION;
  const provider = new AnchorProvider(conn, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const normalizedIdl = {
    ...(idl as Record<string, unknown>),
    address: PROGRAM_ID.toBase58(),
  } as unknown as Idl;
  return new Program(normalizedIdl, PROGRAM_ID, provider);
}

export function getProvider(wallet: AnchorWallet, connection?: Connection) {
  const conn = connection || DEVNET_CONNECTION;
  return new AnchorProvider(conn, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / 1e9;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}

export function formatTokenAmount(amount: number | bigint, decimals: number = 9): string {
  return (Number(amount) / Math.pow(10, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
