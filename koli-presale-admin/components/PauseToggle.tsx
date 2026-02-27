"use client";

import React, { useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PauseCircle, Play, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { setPause } from "@/lib/admin";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  mintAddress: string;
  currentPaused: boolean | null;
  onToggle?: () => void;
}

export default function PauseToggle({ mintAddress, currentPaused, onToggle }: Props) {
  const wallet = useAnchorWallet();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sig: string; success: boolean; error?: string; action?: string } | null>(null);

  const handleToggle = async (pause: boolean) => {
    if (!mintAddress) return;
    setLoading(true);
    setResult(null);

    const res = await setPause(wallet, mintAddress, pause);
    setResult({
      sig: res.signature,
      success: res.success,
      error: res.error,
      action: pause ? "PAUSED" : "UNPAUSED",
    });
    if (res.success && onToggle) onToggle();
    setLoading(false);
  };

  const isPaused = currentPaused ?? false;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <PauseCircle size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
          PAUSE CONTROL
        </h2>
      </div>

      {!mintAddress && (
        <div className="bg-koli-warning/10 border border-koli-warning/30 rounded p-4 text-xs text-koli-warning">
          ⚠ Set mint address in Presale State to enable pause control
        </div>
      )}

      {/* Status display */}
      <div className="animated-border">
        <div className="bg-koli-surface p-6">
          <div className="flex flex-col items-center gap-6">
            {/* Visual toggle */}
            <div className="relative">
              <div
                className={`w-32 h-16 rounded-full border-2 transition-all duration-500 flex items-center ${
                  isPaused
                    ? "border-koli-warning bg-koli-warning/10"
                    : "border-koli-accent3 bg-koli-accent3/10"
                }`}
              >
                <motion.div
                  animate={{ x: isPaused ? 4 : 68 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isPaused ? "bg-koli-warning" : "bg-koli-accent3"
                  }`}
                >
                  {isPaused ? (
                    <PauseCircle size={20} className="text-koli-bg" />
                  ) : (
                    <Play size={20} className="text-koli-bg" />
                  )}
                </motion.div>
              </div>
            </div>

            <div className="text-center">
              <div
                className={`text-xl font-bold uppercase tracking-widest ${
                  isPaused ? "text-koli-warning" : "text-koli-accent3"
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {currentPaused === null ? "UNKNOWN" : isPaused ? "PAUSED" : "LIVE"}
              </div>
              <div className="text-[10px] text-koli-muted mt-1">
                {isPaused ? "Presale is currently paused. Users cannot buy." : "Presale is running. Users can buy tokens."}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 w-full">
              <button
                className="flex-1 btn-green"
                onClick={() => handleToggle(false)}
                disabled={loading || !mintAddress || !isPaused}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-koli-accent3 border-t-transparent rounded-full animate-spin" />
                    ...
                  </span>
                ) : (
                  "▶ Unpause"
                )}
              </button>
              <button
                className="flex-1 btn-danger"
                onClick={() => handleToggle(true)}
                disabled={loading || !mintAddress || isPaused}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border border-koli-danger border-t-transparent rounded-full animate-spin" />
                    ...
                  </span>
                ) : (
                  "⏸ Pause"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instruction info */}
      <div className="bg-koli-bg border border-koli-border rounded p-3 text-[10px] font-mono space-y-1">
        <div className="text-koli-muted uppercase tracking-wider mb-1">Instructions</div>
        <div className="flex gap-2">
          <span className="text-koli-accent3">set_pause(false)</span>
          <span className="text-koli-muted">→ Unpause presale</span>
        </div>
        <div className="flex gap-2">
          <span className="text-koli-danger">set_pause(true)</span>
          <span className="text-koli-muted">→ Pause presale</span>
        </div>
      </div>

      {/* Result */}
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
                {result.success ? `PRESALE ${result.action}` : "TX FAILED"}
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
