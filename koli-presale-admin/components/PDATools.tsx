"use client";

import React, { useEffect, useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Check, Copy, Layers } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import {
  derivePresalePDASync,
  deriveTreasuryPDASync,
  deriveUserAllocationPDASync,
  deriveVaultPDASync,
} from "@/lib/pda";

interface Props {
  mintAddress: string;
}

function CopyableAddress({ label, value, bump }: { label: string; value: string; bump?: number }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-koli-bg border border-koli-border rounded p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-koli-muted uppercase tracking-wider">{label}</span>
        {bump !== undefined && <span className="text-[9px] text-koli-accent/60 font-mono">bump: {bump}</span>}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-koli-accent font-mono break-all flex-1">{value || "N/A"}</span>
        {value && (
          <button onClick={copy} className="shrink-0 text-koli-muted hover:text-koli-accent transition-colors p-1 rounded">
            {copied ? <Check size={12} className="text-koli-accent3" /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PDATools({ mintAddress }: Props) {
  const wallet = useAnchorWallet();
  const [userInput, setUserInput] = useState("");
  const [pdas, setPDAs] = useState<{
    presale: string;
    presaleBump: number;
    treasury: string;
    treasuryBump: number;
    vault: string;
    vaultBump: number;
    userAlloc: string;
    userAllocBump: number;
  } | null>(null);

  const derivePDAs = () => {
    if (!mintAddress) return;

    try {
      const adminPubkey = wallet?.publicKey || new PublicKey("11111111111111111111111111111111");
      const mintPubkey = new PublicKey(mintAddress);
      const [presalePDA, presaleBump] = derivePresalePDASync(adminPubkey, mintPubkey);
      const [treasuryPDA, treasuryBump] = deriveTreasuryPDASync(presalePDA);
      const [vaultPDA, vaultBump] = deriveVaultPDASync(presalePDA);

      let userAllocPDA = PublicKey.default;
      let userAllocBump = 0;
      if (userInput) {
        try {
          const userPubkey = new PublicKey(userInput);
          [userAllocPDA, userAllocBump] = deriveUserAllocationPDASync(userPubkey);
        } catch {
          userAllocPDA = PublicKey.default;
          userAllocBump = 0;
        }
      }

      setPDAs({
        presale: presalePDA.toString(),
        presaleBump,
        treasury: treasuryPDA.toString(),
        treasuryBump,
        vault: vaultPDA.toString(),
        vaultBump,
        userAlloc: userInput ? userAllocPDA.toString() : "",
        userAllocBump,
      });
    } catch {
      setPDAs(null);
    }
  };

  useEffect(() => {
    derivePDAs();
  }, [wallet, mintAddress, userInput]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Layers size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: "var(--font-display)" }}>
          PDA DERIVATION TOOLS
        </h2>
      </div>

      <div className="bg-koli-bg border border-koli-border rounded p-4 text-[10px] font-mono space-y-2">
        <div className="text-koli-muted uppercase tracking-wider mb-3">Seed Schemes</div>
        <div className="space-y-1.5 text-koli-muted">
          <div>
            <span className="text-koli-accent">Presale PDA </span>
            -&gt; ["presale", admin, mint]
          </div>
          <div>
            <span className="text-koli-accent">Treasury PDA </span>
            -&gt; ["treasury", presale]
          </div>
          <div>
            <span className="text-koli-accent">Vault PDA </span>
            -&gt; ["vault", presale]
          </div>
          <div>
            <span className="text-koli-accent">User Alloc PDA </span>
            -&gt; ["user-allocation", user]
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-koli-border text-koli-muted/60">
          Program ID: 4xexkQVDQ8ebsAxGjCetizM387ccsMDqZwV5Y25vKQnj
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
        <div className="bg-koli-bg border border-koli-border rounded p-3">
          <div className="text-koli-muted mb-1">Admin (Signer)</div>
          <div className="text-koli-text break-all">
            {(wallet?.publicKey?.toString() || "11111111111111111111111111111111").slice(0, 20)}...
          </div>
        </div>
        <div className="bg-koli-bg border border-koli-border rounded p-3">
          <div className="text-koli-muted mb-1">Mint</div>
          <div className="text-koli-text break-all">{mintAddress ? `${mintAddress.slice(0, 20)}...` : "Not set"}</div>
        </div>
      </div>

      {pdas && (
        <div className="space-y-3">
          <CopyableAddress label="Presale PDA" value={pdas.presale} bump={pdas.presaleBump} />
          <CopyableAddress label="Treasury PDA" value={pdas.treasury} bump={pdas.treasuryBump} />
          <CopyableAddress label="Vault PDA" value={pdas.vault} bump={pdas.vaultBump} />
        </div>
      )}

      <div>
        <label className="block text-[10px] text-koli-muted uppercase tracking-wider mb-1.5">
          User Address (for allocation PDA)
        </label>
        <input
          className="koli-input"
          placeholder="User wallet address..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
      </div>

      {pdas && <CopyableAddress label="User Allocation PDA" value={pdas.userAlloc} bump={pdas.userAllocBump} />}

      {!mintAddress && (
        <div className="bg-koli-warning/10 border border-koli-warning/30 rounded p-3 text-[11px] text-koli-warning">
          Set mint address in Presale State to derive PDAs
        </div>
      )}
    </div>
  );
}
