import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("4xexkQVDQ8ebsAxGjCetizM387ccsMDqZwV5Y25vKQnj");

export async function derivePresalePDA(
  adminPubkey: PublicKey,
  mintPubkey: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("presale"),
      adminPubkey.toBuffer(),
      mintPubkey.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export async function deriveTreasuryPDA(
  presalePubkey: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), presalePubkey.toBuffer()],
    PROGRAM_ID
  );
}

export async function deriveVaultPDA(
  presalePubkey: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), presalePubkey.toBuffer()],
    PROGRAM_ID
  );
}

export async function deriveUserAllocationPDA(
  userPubkey: PublicKey
): Promise<[PublicKey, number]> {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user-allocation"), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function derivePresalePDASync(
  adminPubkey: PublicKey,
  mintPubkey: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("presale"),
      adminPubkey.toBuffer(),
      mintPubkey.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function deriveTreasuryPDASync(presalePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), presalePubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function deriveVaultPDASync(presalePubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), presalePubkey.toBuffer()],
    PROGRAM_ID
  );
}

export function deriveUserAllocationPDASync(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user-allocation"), userPubkey.toBuffer()],
    PROGRAM_ID
  );
}
