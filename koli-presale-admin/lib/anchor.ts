// Preview helpers only. Real Anchor program access is intentionally disabled.

export const PROGRAM_ID = "4xexkQVDQ8ebsAxGjCetizM387ccsMDqZwV5Y25vKQnj";
export const DEVNET_CONNECTION = null;

export function getProgram(): never {
  throw new Error("Preview mode: getProgram() is disabled.");
}

export function getProvider(): null {
  return null;
}

export function lamportsToSol(lamports: number | bigint): number {
  return Number(lamports) / 1e9;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * 1e9);
}

export function formatTokenAmount(amount: number | bigint, decimals = 9): string {
  return (Number(amount) / Math.pow(10, decimals)).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "N/A";
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
