"use client";

import React, { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Eye, Wifi } from "lucide-react";

import AdminSidebar, { Section } from "@/components/AdminSidebar";
import InitializePresaleForm from "@/components/InitializePresaleForm";
import PauseToggle from "@/components/PauseToggle";
import PDATools from "@/components/PDATools";
import PresaleStateCard from "@/components/PresaleStateCard";
import TestBuy from "@/components/TestBuy";
import TestClaim from "@/components/TestClaim";
import TransactionLog, { LogEntry } from "@/components/TransactionLog";
import UserInspector from "@/components/UserInspector";
import VaultViewer from "@/components/VaultViewer";
import WithdrawTreasury from "@/components/WithdrawTreasury";
import { lamportsToSol } from "@/lib/anchor";

const PREVIEW_ADMIN = "PREVIEW_ADMIN_4xexkQVDQ8ebsAxGjCetizM387ccsM";
const PREVIEW_SOL_BALANCE = 61_500_000_000; // lamports

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("state");
  const [mintAddress, setMintAddress] = useState("PREVIEW_MINT_9f8a7b6c");
  const [presalePaused, setPresalePaused] = useState<boolean | null>(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: "preview-boot",
      timestamp: new Date(),
      type: "info",
      instruction: "preview_mode",
      details: "All Presale Admin actions are placeholders. No on-chain calls are executed.",
    },
  ]);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => {
      const next: LogEntry = {
        ...entry,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date(),
      };
      return [...prev.slice(-49), next];
    });
  }, []);

  const sectionTitles: Record<Section, string> = {
    state: "Presale State",
    initialize: "Initialize Presale",
    pause: "Pause Control",
    withdraw: "Withdraw Treasury",
    vault: "Vault Balance",
    buy: "Test Buy",
    claim: "Test Claim",
    inspector: "User Inspector",
    pda: "PDA Tools",
    logs: "Transaction Console",
  };

  return (
    <div className="flex min-h-screen bg-koli-bg grid-overlay">
      <div className="scan-line" />

      <AdminSidebar active={activeSection} onChange={setActiveSection} isAdmin={true} />

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="h-14 border-b border-koli-border bg-koli-surface/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-[11px] text-koli-muted">
            <span style={{ fontFamily: "var(--font-display)", fontSize: "10px", color: "#00c6ff" }}>KOLI</span>
            <ChevronRight size={10} />
            <span className="text-koli-text">{sectionTitles[activeSection]}</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px]">
              <Wifi size={11} className="text-koli-accent3" />
              <span className="text-koli-accent3">Preview Mode</span>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border border-koli-accent/30 bg-koli-accent/5 text-koli-accent">
              <Eye size={11} />
              Read-only Demo
            </div>

            <div className="text-[11px] text-koli-muted font-mono">
              <span className="text-koli-accent">{lamportsToSol(PREVIEW_SOL_BALANCE).toFixed(4)}</span>
              <span className="ml-1">SOL</span>
            </div>
          </div>
        </header>

        <div className="bg-koli-warning/5 border-b border-koli-warning/20 px-6 py-3 text-[11px] text-koli-warning">
          Preview build: transactions, balance reads, and state changes are mocked for UI demonstration only.
        </div>

        <div className="flex-1 p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="max-w-3xl"
            >
              {activeSection === "state" && (
                <PresaleStateCard mintAddress={mintAddress} onMintChange={setMintAddress} />
              )}

              {activeSection === "initialize" && (
                <InitializePresaleForm
                  onSuccess={(sig, mint) => {
                    setMintAddress(mint || mintAddress);
                    addLog({
                      type: "success",
                      instruction: "initialize_presale",
                      signature: sig,
                      details: "Preview action completed",
                    });
                  }}
                />
              )}

              {activeSection === "pause" && (
                <PauseToggle
                  mintAddress={mintAddress}
                  currentPaused={presalePaused}
                  onToggle={() => {
                    setPresalePaused((prev) => !Boolean(prev));
                    addLog({
                      type: "info",
                      instruction: "set_pause",
                      details: "Preview toggle executed",
                    });
                  }}
                />
              )}

              {activeSection === "withdraw" && <WithdrawTreasury mintAddress={mintAddress} />}
              {activeSection === "vault" && <VaultViewer mintAddress={mintAddress} />}
              {activeSection === "buy" && <TestBuy mintAddress={mintAddress} adminAddress={PREVIEW_ADMIN} />}
              {activeSection === "claim" && <TestClaim mintAddress={mintAddress} adminAddress={PREVIEW_ADMIN} />}
              {activeSection === "inspector" && <UserInspector mintAddress={mintAddress} />}
              {activeSection === "pda" && <PDATools mintAddress={mintAddress} />}

              {activeSection === "logs" && (
                <TransactionLog logs={logs} onClear={() => setLogs([])} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
