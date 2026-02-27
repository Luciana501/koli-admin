"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet, useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldOff, Wifi, WifiOff, ChevronRight } from "lucide-react";

import AdminSidebar, { Section } from "@/components/AdminSidebar";
import PresaleStateCard from "@/components/PresaleStateCard";
import InitializePresaleForm from "@/components/InitializePresaleForm";
import PauseToggle from "@/components/PauseToggle";
import WithdrawTreasury from "@/components/WithdrawTreasury";
import VaultViewer from "@/components/VaultViewer";
import TestBuy from "@/components/TestBuy";
import TestClaim from "@/components/TestClaim";
import UserInspector from "@/components/UserInspector";
import PDATools from "@/components/PDATools";
import TransactionLog, { LogEntry } from "@/components/TransactionLog";
import { fetchPresaleState } from "@/lib/admin";
import { lamportsToSol } from "@/lib/anchor";

// Known admin address - update this with actual presale admin
const ADMIN_PROGRAM_ADDRESS = ""; // Will be determined from on-chain state

export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  const [activeSection, setActiveSection] = useState<Section>("state");
  const [mintAddress, setMintAddress] = useState("");
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [presaleAdmin, setPresaleAdmin] = useState<string | null>(null);
  const [presalePaused, setPresalePaused] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const isAdmin = !presaleAdmin || !wallet.publicKey
    ? false
    : presaleAdmin === wallet.publicKey.toString();

  const isConnected = wallet.connected && wallet.publicKey;

  // Fetch SOL balance
  useEffect(() => {
    if (!wallet.publicKey || !connection) return;
    const fetch = async () => {
      const bal = await connection.getBalance(wallet.publicKey!);
      setSolBalance(bal);
    };
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, [wallet.publicKey, connection]);

  // Fetch presale state to determine admin
  useEffect(() => {
    if (!anchorWallet || !mintAddress) return;
    const fetch = async () => {
      const state = await fetchPresaleState(anchorWallet, mintAddress, connection);
      if (state) {
        setPresaleAdmin(state.admin);
        setPresalePaused(state.paused);
      }
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, [anchorWallet, mintAddress, connection]);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => {
      const newLog: LogEntry = {
        ...entry,
        id: Math.random().toString(36).slice(2),
        timestamp: new Date(),
      };
      return [...prev.slice(-49), newLog]; // keep last 50
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
      {/* Animated scan line */}
      <div className="scan-line" />

      {/* Sidebar */}
      <AdminSidebar
        active={activeSection}
        onChange={setActiveSection}
        isAdmin={isAdmin}
      />

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="h-14 border-b border-koli-border bg-koli-surface/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-10">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-[11px] text-koli-muted">
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: '#00c6ff' }}>KOLI</span>
            <ChevronRight size={10} />
            <span className="text-koli-text">{sectionTitles[activeSection]}</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Network status */}
            <div className="flex items-center gap-1.5 text-[10px]">
              {isConnected ? (
                <>
                  <Wifi size={11} className="text-koli-accent3" />
                  <span className="text-koli-accent3">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff size={11} className="text-koli-muted" />
                  <span className="text-koli-muted">Disconnected</span>
                </>
              )}
            </div>

            {/* Admin badge */}
            {isConnected && (
              <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border ${
                isAdmin
                  ? "border-koli-accent3/30 bg-koli-accent3/5 text-koli-accent3"
                  : "border-koli-danger/30 bg-koli-danger/5 text-koli-danger"
              }`}>
                {isAdmin ? <Shield size={11} /> : <ShieldOff size={11} />}
                {isAdmin ? "Admin" : "Read-only"}
              </div>
            )}

            {/* SOL balance */}
            {isConnected && solBalance !== null && (
              <div className="text-[11px] text-koli-muted font-mono">
                <span className="text-koli-accent">{lamportsToSol(solBalance).toFixed(4)}</span>
                <span className="ml-1">SOL</span>
              </div>
            )}

            {/* Wallet button */}
            <WalletMultiButton />
          </div>
        </header>

        {/* Not connected state */}
        {!isConnected && (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center max-w-sm"
            >
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-koli-accent/20 to-koli-accent2/20 border border-koli-accent/30 flex items-center justify-center mx-auto mb-6 animate-glow">
                <Shield size={32} className="text-koli-accent" />
              </div>
              <h1
                className="text-2xl font-bold text-koli-accent mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                KOLI Admin Panel
              </h1>
              <p className="text-koli-muted text-sm mb-8">
                Connect your Phantom wallet to access the presale admin dashboard
              </p>
              <WalletMultiButton />
              <p className="text-[10px] text-koli-muted/50 mt-6">
                Network: Solana Devnet • Program: 4xexkQVD...vKQnj
              </p>
            </motion.div>
          </div>
        )}

        {/* Connected — wallet detected but not admin */}
        {isConnected && !isAdmin && presaleAdmin && (
          <div className="bg-koli-danger/5 border-b border-koli-danger/20 px-6 py-3 flex items-center gap-3">
            <ShieldOff size={14} className="text-koli-danger" />
            <div className="text-[11px] text-koli-danger">
              <span className="font-bold">UNAUTHORIZED: </span>
              Connected wallet is not the presale admin. Admin controls are disabled. Read-only mode active.
            </div>
            <span className="ml-auto text-[10px] text-koli-danger/60 font-mono hidden md:block">
              Expected: {presaleAdmin.slice(0, 16)}...
            </span>
          </div>
        )}

        {/* Content area */}
        {isConnected && (
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
                  <PresaleStateCard
                    mintAddress={mintAddress}
                    onMintChange={setMintAddress}
                  />
                )}

                {activeSection === "initialize" && (
                  <InitializePresaleForm
                    onSuccess={(sig, mint) => {
                      setMintAddress(mint);
                      addLog({
                        type: "success",
                        instruction: "initialize_presale",
                        signature: sig,
                        details: `Mint: ${mint}`,
                      });
                    }}
                  />
                )}

                {activeSection === "pause" && (
                  <PauseToggle
                    mintAddress={mintAddress}
                    currentPaused={presalePaused}
                    onToggle={() => {
                      addLog({
                        type: "info",
                        instruction: "set_pause",
                        details: "Pause state toggled",
                      });
                    }}
                  />
                )}

                {activeSection === "withdraw" && (
                  <WithdrawTreasury mintAddress={mintAddress} />
                )}

                {activeSection === "vault" && (
                  <VaultViewer mintAddress={mintAddress} />
                )}

                {activeSection === "buy" && (
                  <TestBuy
                    mintAddress={mintAddress}
                    adminAddress={presaleAdmin || wallet.publicKey?.toString() || ""}
                  />
                )}

                {activeSection === "claim" && (
                  <TestClaim
                    mintAddress={mintAddress}
                    adminAddress={presaleAdmin || wallet.publicKey?.toString() || ""}
                  />
                )}

                {activeSection === "inspector" && (
                  <UserInspector mintAddress={mintAddress} />
                )}

                {activeSection === "pda" && (
                  <PDATools mintAddress={mintAddress} />
                )}

                {activeSection === "logs" && (
                  <TransactionLog
                    logs={logs}
                    onClear={() => setLogs([])}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
