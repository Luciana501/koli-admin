"use client";

import React, { useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Users, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { fetchUserAllocation } from "@/lib/admin";
import { deriveUserAllocationPDASync } from "@/lib/pda";
import { PublicKey } from "@solana/web3.js";
import { formatTokenAmount } from "@/lib/anchor";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  mintAddress: string;
}

export default function UserInspector({ mintAddress }: Props) {
  const wallet = useAnchorWallet();
  const [userAddress, setUserAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [allocation, setAllocation] = useState<{
    user: string;
    presale: string;
    amountPurchased: string;
    amountClaimed: string;
    bump: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [allocationPDA, setAllocationPDA] = useState("");

  const fetchUser = async () => {
    if (!userAddress) return;
    setLoading(true);
    setError(null);
    setAllocation(null);

    try {
      // Derive PDA first
      const userPubkey = new PublicKey(userAddress);
      const [pda] = deriveUserAllocationPDASync(userPubkey);
      setAllocationPDA(pda.toString());

      const result = await fetchUserAllocation(wallet, userAddress);
      if (result) {
        setAllocation(result);
      } else {
        setError("No allocation found for this user");
      }
    } catch (e: any) {
      setError(e.message || "Invalid address or account not found");
    } finally {
      setLoading(false);
    }
  };

  const totalPurchased = allocation ? Number(allocation.amountPurchased) : 0;
  const totalClaimed = allocation ? Number(allocation.amountClaimed) : 0;
  const claimable = totalPurchased - totalClaimed;
  const claimedPct = totalPurchased > 0 ? (totalClaimed / totalPurchased) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Users size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
          USER ALLOCATION INSPECTOR
        </h2>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <input
          className="koli-input flex-1"
          placeholder="User wallet address..."
          value={userAddress}
          onChange={(e) => setUserAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchUser()}
        />
        <button
          className="btn-primary px-4"
          onClick={fetchUser}
          disabled={loading || !userAddress}
        >
          {loading ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Search size={12} />
          )}
        </button>
      </div>

      {/* Quick fill with own address */}
      {wallet && (
        <button
          className="text-[10px] text-koli-muted hover:text-koli-accent transition-colors"
          onClick={() => setUserAddress(wallet.publicKey.toString())}
        >
          Use my address →
        </button>
      )}

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-koli-danger/5 border border-koli-danger/30 rounded p-4 flex gap-2"
          >
            <AlertTriangle size={14} className="text-koli-danger shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-koli-danger font-bold">Not Found</p>
              <p className="text-[10px] text-koli-danger/70 mt-1">{error}</p>
              {allocationPDA && (
                <p className="text-[10px] text-koli-muted mt-2 break-all">
                  Checked PDA: {allocationPDA}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {allocation && !error && (
          <motion.div
            key="allocation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="animated-border"
          >
            <div className="bg-koli-surface p-5 space-y-4">
              <div className="flex items-center gap-2 text-koli-accent3">
                <span className="status-dot active" />
                <span className="text-xs font-bold uppercase tracking-wider">Allocation Found</span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Purchased", value: formatTokenAmount(totalPurchased), color: "text-koli-accent" },
                  { label: "Claimed", value: formatTokenAmount(totalClaimed), color: "text-koli-accent3" },
                  { label: "Claimable", value: formatTokenAmount(claimable), color: "text-koli-warning" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-koli-bg border border-koli-border rounded p-3 text-center">
                    <div className={`text-lg font-bold font-mono ${stat.color}`}>
                      {stat.value}
                    </div>
                    <div className="text-[9px] text-koli-muted uppercase tracking-wider mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Claim progress */}
              <div>
                <div className="flex justify-between text-[10px] text-koli-muted mb-2">
                  <span>Claim Progress</span>
                  <span>{claimedPct.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-koli-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-koli-accent3 to-koli-accent transition-all duration-500"
                    style={{ width: `${claimedPct}%` }}
                  />
                </div>
              </div>

              {/* Raw data */}
              <div className="space-y-0 text-[10px] font-mono">
                <div className="flex justify-between py-2 border-b border-koli-border/40">
                  <span className="text-koli-muted">User PDA</span>
                  <span className="text-koli-text break-all ml-4">{allocationPDA.slice(0, 20)}...</span>
                </div>
                <div className="flex justify-between py-2 border-b border-koli-border/40">
                  <span className="text-koli-muted">Presale</span>
                  <span className="text-koli-text">{allocation.presale.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between py-2 border-b border-koli-border/40">
                  <span className="text-koli-muted">Raw Purchased</span>
                  <span className="text-koli-accent">{allocation.amountPurchased}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-koli-muted">Raw Claimed</span>
                  <span className="text-koli-accent3">{allocation.amountClaimed}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
