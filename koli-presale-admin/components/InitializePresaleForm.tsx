"use client";

import React, { useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { Zap, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { initializePresale } from "@/lib/admin";
import { motion } from "framer-motion";

interface Props {
  onSuccess?: (signature: string, mint: string) => void;
}

export default function InitializePresaleForm({ onSuccess }: Props) {
  const wallet = useAnchorWallet();

  const [form, setForm] = useState({
    mintAddress: "",
    basePrice: "0.001",
    priceIncrement: "0.0000001",
    maxSupply: "1000000",
    startTime: "",
    endTime: "",
    cliffTime: "",
    vestingEnd: "",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sig: string; success: boolean; error?: string } | null>(null);

  const toUnixTimestamp = (dateStr: string) => {
    if (!dateStr) return 0;
    return Math.floor(new Date(dateStr).getTime() / 1000);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);

    const res = await initializePresale(
      wallet,
      {
        mintAddress: form.mintAddress,
        basePrice: parseFloat(form.basePrice),
        priceIncrement: parseFloat(form.priceIncrement),
        maxSupply: parseFloat(form.maxSupply),
        startTime: toUnixTimestamp(form.startTime),
        endTime: toUnixTimestamp(form.endTime),
        cliffTime: toUnixTimestamp(form.cliffTime),
        vestingEnd: toUnixTimestamp(form.vestingEnd),
      },
    );

    setResult({ sig: res.signature, success: res.success, error: res.error });
    if (res.success && onSuccess) onSuccess(res.signature, form.mintAddress);
    setLoading(false);
  };

  const Field = ({ label, name, type = "text", placeholder }: {
    label: string;
    name: keyof typeof form;
    type?: string;
    placeholder?: string;
  }) => (
    <div>
      <label className="block text-[10px] text-koli-muted uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        className="koli-input"
        placeholder={placeholder}
        value={form[name]}
        onChange={(e) => setForm((f) => ({ ...f, [name]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <Zap size={16} className="text-koli-accent" />
        <h2 className="text-sm font-bold text-koli-accent" style={{ fontFamily: 'var(--font-display)' }}>
          INITIALIZE PRESALE
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Field label="Mint Address" name="mintAddress" placeholder="Token mint pubkey..." />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Base Price (SOL)" name="basePrice" placeholder="0.001" />
          <Field label="Price Increment (SOL)" name="priceIncrement" placeholder="0.0000001" />
        </div>

        <Field label="Max Supply (tokens)" name="maxSupply" placeholder="1000000" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Time" name="startTime" type="datetime-local" />
          <Field label="End Time" name="endTime" type="datetime-local" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cliff Time" name="cliffTime" type="datetime-local" />
          <Field label="Vesting End" name="vestingEnd" type="datetime-local" />
        </div>
      </div>

      {/* Preview */}
      <div className="bg-koli-bg border border-koli-border rounded p-4 space-y-1 text-[10px] font-mono">
        <div className="text-koli-muted uppercase tracking-wider mb-2">TX Preview</div>
        <div className="flex justify-between">
          <span className="text-koli-muted">Instruction:</span>
          <span className="text-koli-accent">initialize_presale</span>
        </div>
        <div className="flex justify-between">
          <span className="text-koli-muted">Network:</span>
          <span className="text-koli-accent3">Devnet</span>
        </div>
        <div className="flex justify-between">
          <span className="text-koli-muted">Signer:</span>
          <span className="text-koli-text">{wallet?.publicKey?.toString().slice(0, 12) || "PREVIEW_SIGNER"}...</span>
        </div>
      </div>

      <button
        className="btn-primary w-full"
        onClick={handleSubmit}
        disabled={loading || !form.mintAddress}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border border-koli-accent border-t-transparent rounded-full animate-spin" />
            Broadcasting...
          </span>
        ) : (
          "⚡ Initialize Presale"
        )}
      </button>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
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
              {result.success ? "TRANSACTION SUCCESS" : "TRANSACTION FAILED"}
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
              {result.sig.slice(0, 32)}...
            </a>
          )}
          {result.error && (
            <p className="text-[10px] text-koli-danger/80 break-all font-mono mt-1">{result.error}</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
