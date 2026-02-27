"use client";

import React, { useEffect, useRef } from "react";
import { TerminalSquare, CheckCircle, XCircle, ExternalLink, Trash2 } from "lucide-react";
import { format } from "date-fns";

export interface LogEntry {
  id: string;
  timestamp: Date;
  type: "success" | "error" | "info";
  instruction: string;
  signature?: string;
  error?: string;
  details?: string;
}

interface Props {
  logs: LogEntry[];
  onClear: () => void;
}

export default function TransactionLog({ logs, onClear }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <TerminalSquare size={16} className="text-koli-accent" />
          <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
            TX CONSOLE
          </h2>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-[10px] text-koli-muted hover:text-koli-danger transition-colors"
        >
          <Trash2 size={11} />
          Clear
        </button>
      </div>

      {/* Terminal window */}
      <div className="bg-koli-bg border border-koli-border rounded overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-koli-surface border-b border-koli-border">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-koli-danger/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-koli-warning/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-koli-accent3/60" />
          </div>
          <span className="text-[10px] text-koli-muted ml-2 font-mono">koli-admin ~ transaction-log</span>
          <span className="ml-auto text-[10px] text-koli-muted">{logs.length} entries</span>
        </div>

        {/* Log content */}
        <div className="h-96 overflow-y-auto p-4 console-text space-y-3 font-mono">
          {logs.length === 0 && (
            <div className="text-koli-muted/50 text-center py-10">
              <TerminalSquare size={24} className="mx-auto mb-2 opacity-30" />
              <p>No transactions yet.</p>
              <p className="text-[10px] mt-1">Transaction logs will appear here.</p>
            </div>
          )}

          {logs.map((log) => (
            <div
              key={log.id}
              className={`border rounded p-3 animate-slideIn ${
                log.type === "success"
                  ? "border-koli-accent3/20 bg-koli-accent3/3"
                  : log.type === "error"
                  ? "border-koli-danger/20 bg-koli-danger/3"
                  : "border-koli-border bg-koli-surface"
              }`}
            >
              <div className="flex items-start gap-2">
                {log.type === "success" && <CheckCircle size={12} className="text-koli-accent3 shrink-0 mt-0.5" />}
                {log.type === "error" && <XCircle size={12} className="text-koli-danger shrink-0 mt-0.5" />}
                {log.type === "info" && <span className="text-koli-muted shrink-0">›</span>}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold ${
                      log.type === "success"
                        ? "text-koli-accent3"
                        : log.type === "error"
                        ? "text-koli-danger"
                        : "text-koli-muted"
                    }`}>
                      {log.instruction}
                    </span>
                    <span className="text-[9px] text-koli-muted shrink-0">
                      {format(log.timestamp, "HH:mm:ss")}
                    </span>
                  </div>

                  {log.signature && (
                    <div className="mt-1.5">
                      <a
                        href={`https://explorer.solana.com/tx/${log.signature}?cluster=devnet`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[10px] text-koli-accent hover:underline break-all"
                      >
                        <ExternalLink size={9} />
                        <span className="truncate">{log.signature.slice(0, 48)}...</span>
                      </a>
                    </div>
                  )}

                  {log.error && (
                    <div className="mt-1.5 text-[10px] text-koli-danger/70 break-all">
                      {log.error}
                    </div>
                  )}

                  {log.details && (
                    <div className="mt-1 text-[10px] text-koli-muted">
                      {log.details}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-[10px] text-koli-muted">
        <span className="status-dot active" />
        <span>Live on Devnet — auto-refresh every 5s</span>
      </div>
    </div>
  );
}
