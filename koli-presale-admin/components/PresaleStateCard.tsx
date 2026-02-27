"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { fetchPresaleState, PresaleState } from "@/lib/admin";
import { lamportsToSol, formatTokenAmount, shortenAddress } from "@/lib/anchor";
import { format } from "date-fns";

interface Props {
  mintAddress: string;
  onMintChange: (mint: string) => void;
}

function DataRow({ label, value, highlight, mono = true }: {
  label: string;
  value: string | React.ReactNode;
  highlight?: "cyan" | "green" | "red" | "yellow" | "muted";
  mono?: boolean;
}) {
  const colors = {
    cyan: "text-koli-accent",
    green: "text-koli-accent3",
    red: "text-koli-danger",
    yellow: "text-koli-warning",
    muted: "text-koli-muted",
    undefined: "text-koli-text",
  };

  return (
    <div className="flex items-start justify-between py-2.5 border-b border-koli-border/40 gap-4">
      <span className="text-[10px] text-koli-muted uppercase tracking-wider shrink-0">{label}</span>
      <span className={`text-[11px] ${colors[highlight as keyof typeof colors] ?? "text-koli-text"} ${mono ? "font-mono" : ""} text-right break-all`}>
        {value}
      </span>
    </div>
  );
}

export default function PresaleStateCard({ mintAddress, onMintChange }: Props) {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<PresaleState | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [mintInput, setMintInput] = useState(mintAddress);

  const refresh = useCallback(async () => {
    if (!wallet || !mintInput) return;
    setLoading(true);
    try {
      const s = await fetchPresaleState(wallet, mintInput, connection);
      setState(s);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [wallet, mintInput, connection]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const formatTs = (ts: number) => {
    if (!ts) return "—";
    try {
      return format(new Date(ts * 1000), "MMM dd, yyyy HH:mm");
    } catch {
      return ts.toString();
    }
  };

  return (
    <div className="space-y-4">
      {/* Mint input */}
      <div className="flex gap-2">
        <input
          className="koli-input flex-1"
          placeholder="Mint address..."
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
        />
        <button
          className="btn-primary px-3"
          onClick={() => { onMintChange(mintInput); refresh(); }}
        >
          Load
        </button>
      </div>

      {/* Card */}
      <div className="animated-border">
        <div className="bg-koli-surface p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
                PRESALE STATE
              </h2>
              {lastRefresh && (
                <p className="text-[9px] text-koli-muted mt-0.5">
                  Last refresh: {format(lastRefresh, "HH:mm:ss")}
                </p>
              )}
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="text-koli-muted hover:text-koli-accent transition-colors p-1.5 rounded border border-koli-border hover:border-koli-accent/40"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {loading && !state && (
            <div className="text-center py-10 text-koli-muted text-xs">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
              Fetching presale state...
            </div>
          )}

          {!loading && !state && (
            <div className="text-center py-10">
              <AlertTriangle size={20} className="text-koli-warning mx-auto mb-2" />
              <p className="text-xs text-koli-muted">No presale found</p>
              <p className="text-[10px] text-koli-muted/60 mt-1">Check mint address or initialize presale</p>
            </div>
          )}

          {state && (
            <div className="space-y-0">
              {/* Status badge */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded bg-koli-bg border border-koli-border">
                <span className={`status-dot ${state.paused ? "paused" : "active"}`}></span>
                <span className={`text-xs font-bold uppercase tracking-wider ${state.paused ? "text-koli-warning" : "text-koli-accent3"}`}>
                  {state.paused ? "PAUSED" : "ACTIVE"}
                </span>
                <span className="ml-auto text-[9px] text-koli-muted">Auto-refresh: 5s</span>
              </div>

              {/* Addresses */}
              <div className="space-y-0">
                <DataRow label="Admin" value={shortenAddress(state.admin, 6)} highlight="cyan" />
                <DataRow label="Mint" value={shortenAddress(state.mint, 6)} highlight="cyan" />
                <DataRow label="Vault" value={shortenAddress(state.vault, 6)} highlight="cyan" />
                <DataRow label="Treasury" value={shortenAddress(state.treasury, 6)} highlight="cyan" />
              </div>

              {/* Numbers */}
              <div className="space-y-0 mt-2">
                <DataRow
                  label="Total Sold"
                  value={`${formatTokenAmount(Number(state.totalSold))} KOLI`}
                  highlight="green"
                />
                <DataRow
                  label="Total Claimed"
                  value={`${formatTokenAmount(Number(state.totalClaimed))} KOLI`}
                  highlight="yellow"
                />
                <DataRow
                  label="Max Supply"
                  value={`${formatTokenAmount(Number(state.maxSupply))} KOLI`}
                />
                <DataRow
                  label="Base Price"
                  value={`${lamportsToSol(Number(state.basePrice)).toFixed(6)} SOL`}
                />
                <DataRow
                  label="Price Increment"
                  value={`${lamportsToSol(Number(state.priceIncrement)).toFixed(8)} SOL`}
                />
              </div>

              {/* Times */}
              <div className="space-y-0 mt-2">
                <DataRow label="Start Time" value={formatTs(state.startTime)} />
                <DataRow label="End Time" value={formatTs(state.endTime)} />
                <DataRow label="Cliff Time" value={formatTs(state.cliffTime)} highlight="yellow" />
                <DataRow label="Vesting End" value={formatTs(state.vestingEnd)} highlight="yellow" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
