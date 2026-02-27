"use client";

import React, { useState } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { ShoppingCart, CheckCircle, XCircle, ExternalLink, AlertTriangle } from "lucide-react";
import { buyTokens } from "@/lib/admin";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  mintAddress: string;
  adminAddress: string;
}

export default function TestBuy({ mintAddress, adminAddress }: Props) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [solAmount, setSolAmount] = useState("0.01");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sig: string; success: boolean; error?: string } | null>(null);

  const handleBuy = async () => {
    if (!wallet || !mintAddress || !adminAddress) return;
    setLoading(true);
    setResult(null);
    const res = await buyTokens(wallet, mintAddress, adminAddress, parseFloat(solAmount), connection);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <ShoppingCart size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
          TEST BUY TOKENS
        </h2>
      </div>

      <div className="bg-koli-warning/10 border border-koli-warning/30 rounded p-4 flex gap-3">
        <AlertTriangle size={14} className="text-koli-warning shrink-0 mt-0.5" />
        <p className="text-[11px] text-koli-warning">
          This uses real Devnet SOL. The admin wallet will simulate a buy transaction, creating a user allocation PDA.
        </p>
      </div>

      <div className="animated-border">
        <div className="bg-koli-surface p-5 space-y-4">
          <div>
            <label className="block text-[10px] text-koli-muted uppercase tracking-wider mb-1.5">
              SOL Amount to Spend
            </label>
            <input
              type="number"
              className="koli-input"
              placeholder="0.01"
              step="0.001"
              min="0.001"
              value={solAmount}
              onChange={(e) => setSolAmount(e.target.value)}
            />
          </div>

          <div className="bg-koli-bg border border-koli-border rounded p-3 space-y-1.5 text-[10px] font-mono">
            <div className="text-koli-muted uppercase tracking-wider mb-2">TX Preview</div>
            <div className="flex justify-between">
              <span className="text-koli-muted">Instruction</span>
              <span className="text-koli-accent">buy_tokens</span>
            </div>
            <div className="flex justify-between">
              <span className="text-koli-muted">Amount</span>
              <span className="text-koli-accent3">{solAmount} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-koli-muted">Buyer (Admin)</span>
              <span className="text-koli-text">{wallet?.publicKey.toString().slice(0, 12)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-koli-muted">Network</span>
              <span className="text-koli-accent3">Devnet</span>
            </div>
          </div>

          <button
            className="btn-primary w-full"
            onClick={handleBuy}
            disabled={loading || !mintAddress || !adminAddress || !solAmount}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3 h-3 border border-koli-accent border-t-transparent rounded-full animate-spin" />
                Broadcasting...
              </span>
            ) : (
              `🛒 Buy ${solAmount} SOL Worth`
            )}
          </button>

          {!mintAddress && (
            <p className="text-[10px] text-koli-danger">⚠ Mint address not set</p>
          )}
          {!adminAddress && (
            <p className="text-[10px] text-koli-danger">⚠ Admin address not set</p>
          )}
        </div>
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
                {result.success ? "BUY SUCCESS" : "BUY FAILED"}
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
                {result.sig}
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
