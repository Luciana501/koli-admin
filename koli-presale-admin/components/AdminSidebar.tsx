"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Zap,
  PauseCircle,
  Wallet,
  FlaskConical,
  Users,
  TerminalSquare,
  Layers,
  ShoppingCart,
  Gift,
} from "lucide-react";

export type Section =
  | "state"
  | "initialize"
  | "pause"
  | "withdraw"
  | "vault"
  | "buy"
  | "claim"
  | "inspector"
  | "pda"
  | "logs";

interface NavItem {
  id: Section;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const navItems: NavItem[] = [
  { id: "state", label: "Presale State", icon: <Activity size={14} />, group: "Monitor" },
  { id: "pda", label: "PDA Tools", icon: <Layers size={14} />, group: "Monitor" },
  { id: "logs", label: "Tx Console", icon: <TerminalSquare size={14} />, group: "Monitor" },
  { id: "initialize", label: "Initialize", icon: <Zap size={14} />, group: "Admin" },
  { id: "pause", label: "Pause Control", icon: <PauseCircle size={14} />, group: "Admin" },
  { id: "withdraw", label: "Withdraw Treasury", icon: <Wallet size={14} />, group: "Admin" },
  { id: "vault", label: "Vault Balance", icon: <Layers size={14} />, group: "Admin" },
  { id: "buy", label: "Test Buy", icon: <ShoppingCart size={14} />, group: "Test Tools" },
  { id: "claim", label: "Test Claim", icon: <Gift size={14} />, group: "Test Tools" },
  { id: "inspector", label: "User Inspector", icon: <Users size={14} />, group: "Test Tools" },
];

interface Props {
  active: Section;
  onChange: (s: Section) => void;
  isAdmin: boolean;
}

export default function AdminSidebar({ active, onChange, isAdmin }: Props) {
  const groups = ["Monitor", "Admin", "Test Tools"];

  return (
    <aside className="w-64 min-h-screen border-r border-koli-border flex flex-col bg-koli-surface relative">
      {/* Logo */}
      <div className="p-5 border-b border-koli-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-koli-accent to-koli-accent2 flex items-center justify-center text-xs font-bold animate-glow" style={{ fontFamily: 'var(--font-display)' }}>
            K
          </div>
          <div>
            <div className="text-xs font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>
              KOLI
            </div>
            <div className="text-[9px] text-koli-muted uppercase tracking-widest">
              Presale Admin
            </div>
          </div>
        </div>
        {/* Network badge */}
        <div className="mt-3 flex items-center gap-2">
          <span className="status-dot active"></span>
          <span className="text-[10px] text-koli-accent3 uppercase tracking-widest">Devnet</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {groups.map((group) => {
          const items = navItems.filter((n) => n.group === group);
          return (
            <div key={group}>
              <div className="text-[9px] text-koli-muted uppercase tracking-widest px-2 mb-2">
                {group}
              </div>
              <div className="space-y-1">
                {items.map((item) => {
                  const isActive = active === item.id;
                  const isAdminOnly = group === "Admin";
                  const disabled = isAdminOnly && !isAdmin;

                  return (
                    <button
                      key={item.id}
                      onClick={() => !disabled && onChange(item.id)}
                      disabled={disabled}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-[11px] transition-all duration-200 text-left ${
                        isActive
                          ? "bg-koli-accent/10 border border-koli-accent/40 text-koli-accent glow-cyan"
                          : disabled
                          ? "opacity-30 cursor-not-allowed text-koli-muted"
                          : "text-koli-muted hover:text-koli-text hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <span className={isActive ? "text-koli-accent" : ""}>{item.icon}</span>
                      <span>{item.label}</span>
                      {disabled && (
                        <span className="ml-auto text-[8px] text-koli-danger">LOCKED</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-koli-border">
        <div className="text-[9px] text-koli-muted text-center">
          Program ID
        </div>
        <div className="text-[9px] text-koli-accent/60 font-mono text-center mt-1 break-all">
          4xexkQVD...vKQnj
        </div>
      </div>
    </aside>
  );
}
