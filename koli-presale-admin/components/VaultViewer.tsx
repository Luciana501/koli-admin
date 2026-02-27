"use client";

import React, { useState, useEffect } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { Layers, RefreshCw } from "lucide-react";
import { getVaultBalance } from "@/lib/admin";
import { derivePresalePDASync, deriveVaultPDASync } from "@/lib/pda";
import { PublicKey } from "@solana/web3.js";
import { formatTokenAmount } from "@/lib/anchor";

interface Props {
  mintAddress: string;
}

export default function VaultViewer({ mintAddress }: Props) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [decimals, setDecimals] = useState<number>(9);
  const [vaultAddr, setVaultAddr] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchVault = async () => {
    if (!wallet || !mintAddress) return;
    setLoading(true);
    try {
      const mintPubkey = new PublicKey(mintAddress);
      const [presalePDA] = derivePresalePDASync(wallet.publicKey, mintPubkey);
      const [vaultPDA] = deriveVaultPDASync(presalePDA);
      setVaultAddr(vaultPDA.toString());
      const result = await getVaultBalance(vaultPDA.toString(), connection);
      if (result) {
        setBalance(result.balance);
        setDecimals(result.decimals);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVault();
    const interval = setInterval(fetchVault, 10000);
    return () => clearInterval(interval);
  }, [wallet, mintAddress]);

  const percentage = balance !== null && balance > 0
    ? Math.min((balance / (100_000_000 * Math.pow(10, decimals))) * 100, 100)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Layers size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
          VAULT TOKEN BALANCE
        </h2>
      </div>

      <div className="animated-border">
        <div className="bg-koli-surface p-5">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[10px] text-koli-muted uppercase tracking-wider">Token Vault</span>
            <button
              onClick={fetchVault}
              className="text-koli-muted hover:text-koli-accent transition-colors"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Big number */}
          <div className="text-center mb-6">
            <div className="text-4xl font-bold text-koli-accent font-mono">
              {balance !== null ? formatTokenAmount(balance, decimals) : "—"}
            </div>
            <div className="text-sm text-koli-muted mt-1">KOLI Tokens</div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex justify-between text-[10px] text-koli-muted mb-2">
              <span>Vault Fill</span>
              <span>{percentage.toFixed(2)}%</span>
            </div>
            <div className="h-2 bg-koli-bg rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-koli-accent to-koli-accent2 transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 text-[10px] font-mono">
            <div className="flex justify-between py-2 border-b border-koli-border/40">
              <span className="text-koli-muted">Mint</span>
              <span className="text-koli-text">{mintAddress ? `${mintAddress.slice(0, 8)}...${mintAddress.slice(-6)}` : "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-koli-border/40">
              <span className="text-koli-muted">Vault PDA</span>
              <span className="text-koli-text">{vaultAddr ? `${vaultAddr.slice(0, 8)}...${vaultAddr.slice(-6)}` : "—"}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-koli-border/40">
              <span className="text-koli-muted">Decimals</span>
              <span className="text-koli-accent">{decimals}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-koli-muted">Raw Amount</span>
              <span className="text-koli-text">{balance !== null ? balance.toLocaleString() : "—"}</span>
            </div>
          </div>
        </div>
      </div>

      {!mintAddress && (
        <div className="bg-koli-warning/10 border border-koli-warning/30 rounded p-4 text-xs text-koli-warning">
          ⚠ Set mint address in Presale State to view vault balance
        </div>
      )}
    </div>
  );
}
