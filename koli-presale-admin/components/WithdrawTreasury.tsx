"use client";

import React, { useState, useEffect } from "react";
import { Wallet, CheckCircle, XCircle, ExternalLink, RefreshCw } from "lucide-react";
import { withdrawTreasury, getTreasuryBalance } from "@/lib/admin";
import { lamportsToSol } from "@/lib/anchor";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  mintAddress: string;
}

export default function WithdrawTreasury({ mintAddress }: Props) {
  const [amount, setAmount] = useState("0.1");
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  const [treasuryAddr, setTreasuryAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<{ sig: string; success: boolean; error?: string } | null>(null);

  const fetchBalance = async () => {
    if (!mintAddress) return;
    setRefreshing(true);
    try {
      const previewAddr = `PREVIEW_TREASURY_${mintAddress.slice(0, 16)}`;
      setTreasuryAddr(previewAddr);
      const bal = await getTreasuryBalance(previewAddr);
      setTreasuryBalance(bal);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [mintAddress]);

  const handleWithdraw = async () => {
    if (!mintAddress) return;
    setLoading(true);
    setResult(null);
    const res = await withdrawTreasury(undefined, mintAddress, parseFloat(amount));
    setResult({ sig: res.signature, success: res.success, error: res.error });
    if (res.success) await fetchBalance();
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Wallet size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
          WITHDRAW TREASURY
        </h2>
      </div>

      {!mintAddress && (
        <div className="bg-koli-warning/10 border border-koli-warning/30 rounded p-4 text-xs text-koli-warning">
          ⚠ Set mint address in Presale State first
        </div>
      )}

      {/* Treasury balance card */}
      <div className="animated-border">
        <div className="bg-koli-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] text-koli-muted uppercase tracking-wider">Treasury Balance</span>
            <button onClick={fetchBalance} className="text-koli-muted hover:text-koli-accent transition-colors">
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="text-center py-4">
            <div className="text-4xl font-bold text-koli-accent3 font-mono">
              {treasuryBalance !== null ? lamportsToSol(treasuryBalance).toFixed(4) : "—"}
            </div>
            <div className="text-sm text-koli-muted mt-1">SOL</div>
          </div>

          {treasuryAddr && (
            <div className="mt-3 p-2 bg-koli-bg rounded text-[10px] font-mono text-koli-muted break-all">
              <span className="text-koli-muted/60">PDA: </span>
              {treasuryAddr}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw form */}
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] text-koli-muted uppercase tracking-wider mb-1.5">
            Amount (SOL)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              className="koli-input flex-1"
              placeholder="0.00"
              step="0.001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {treasuryBalance !== null && (
              <button
                className="btn-primary px-3 text-[10px]"
                onClick={() => setAmount(lamportsToSol(treasuryBalance).toFixed(4))}
              >
                MAX
              </button>
            )}
          </div>
        </div>

        <div className="bg-koli-bg border border-koli-border rounded p-3 text-[10px] font-mono">
          <div className="text-koli-muted uppercase tracking-wider mb-1">Instruction</div>
          <div className="text-koli-accent">withdraw_treasury({amount || "0"} SOL)</div>
          <div className="text-koli-muted mt-1">Preview only: simulated payout (no real transfer)</div>
        </div>

        <button
          className="btn-primary w-full"
          onClick={handleWithdraw}
          disabled={loading || !mintAddress || !amount || parseFloat(amount) <= 0}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border border-koli-accent border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            `💰 Withdraw ${amount} SOL`
          )}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`rounded border p-4 ${
              result.success
                ? "bg-koli-accent3/5 border-koli-accent3/30"
                : "bg-koli-danger/5 border-koli-danger/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle size={14} className="text-koli-accent3" />
              ) : (
                <XCircle size={14} className="text-koli-danger" />
              )}
              <span className={`text-xs font-bold ${result.success ? "text-koli-accent3" : "text-koli-danger"}`}>
                {result.success ? "WITHDRAWAL SUCCESS" : "TX FAILED"}
              </span>
            </div>
            {result.success && result.sig && (
              <a
                href={`https://explorer.solana.com/tx/${result.sig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] text-koli-accent hover:underline break-all"
              >
                <ExternalLink size={10} />
                {result.sig.slice(0, 40)}...
              </a>
            )}
            {result.error && (
              <p className="text-[10px] text-koli-danger/80 break-all font-mono mt-1">{result.error}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



