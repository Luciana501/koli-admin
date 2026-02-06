import * as React from "react";
import { useState, useEffect } from "react";
import { doc, getDoc, collection, getDocs, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

type RewardHistoryItem = {
  id?: string;
  activeCode?: string;
  secretCode?: string;
  code?: string;
  pool?: number;
  totalPool?: number;
  remainingPool?: number;
  createdAt?: string;
  expiresAt?: string;
  status?: string;
};

const ManaRewardPanel = () => {
  const [inputCode, setInputCode] = React.useState("");
  const [inputPool, setInputPool] = React.useState(0);
  const [activeCode, setActiveCode] = React.useState("");
  const [totalPool, setTotalPool] = React.useState(0);
  const [remaining, setRemaining] = React.useState(0);
  const [expiresAt, setExpiresAt] = React.useState("");
  const [expirationValue, setExpirationValue] = React.useState(0);
  const [expirationUnit, setExpirationUnit] = React.useState("minutes");
  const [createdAt, setCreatedAt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [history, setHistory] = React.useState<RewardHistoryItem[]>([]);
  // For real-time UI updates (e.g., code expiration)
  const [, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    // Update every second to trigger re-render for expiration
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchRewards = async () => {
    setLoading(true);
    try {
      // Fetch active code and pool info from globalRewards/currentActiveReward
      const docRef = doc(db, "globalRewards", "currentActiveReward");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setActiveCode(data.activeCode || "");
        setTotalPool(data.totalPool || 0);
        setRemaining(data.remainingPool || 0);
        setExpiresAt(data.expiresAt || "");
        setCreatedAt(data.createdAt || "");
      }

      const rewardsHistoryRef = collection(db, "rewardsHistory");
      const rewardsHistorySnap = await getDocs(rewardsHistoryRef);
      const hist: RewardHistoryItem[] = rewardsHistorySnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as RewardHistoryItem))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      setHistory(hist);
    } catch (e) {
      setError("Failed to fetch rewards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let multiplier = 1;
      if (expirationUnit === "hours") multiplier = 60;
      if (expirationUnit === "days") multiplier = 60 * 24;
      const expires = new Date(now.getTime() + expirationValue * multiplier * 60 * 1000);

      // Fetch previous remaining pool
      let prevRemaining = 0;
      let prevExpiresAt = "";
      const docRef = doc(db, "globalRewards", "currentActiveReward");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        prevRemaining = data.remainingPool || 0;
        prevExpiresAt = data.expiresAt || "";
      }

      // If previous code is still active, accumulate
      let newRemainingPool = inputPool;
      if (prevExpiresAt && new Date(prevExpiresAt) > now) {
        newRemainingPool += prevRemaining;
      }

      // Save to globalRewards/currentActiveReward (overwrite doc)
      await import("firebase/firestore").then(({ setDoc }) =>
        setDoc(doc(db, "globalRewards", "currentActiveReward"), {
          activeCode: inputCode,
          totalPool: inputPool,
          remainingPool: newRemainingPool,
          createdAt: now.toISOString(),
          expiresAt: expires.toISOString(),
          updatedAt: now.toISOString(),
        })
      );

      // Add to rewardsHistory for admin/history
      await addDoc(collection(db, "rewardsHistory"), {
        secretCode: inputCode,
        pool: inputPool,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        type: "mana",
        status: "active"
      });

      setActiveCode(inputCode);
      setTotalPool(inputPool);
      setRemaining(newRemainingPool);
      setCreatedAt(now.toISOString());
      setExpiresAt(expires.toISOString());
      setInputCode("");
      setInputPool(0);
      fetchRewards();
    } catch (e) {
      setError("Failed to generate reward");
    } finally {
      setLoading(false);
    }
  };

  // --- Remaining Balance Calculation ---
  const now = new Date();
  const activePools = history
    .filter(item => {
      const expires = item.expiresAt ? new Date(item.expiresAt) : null;
      return expires && expires > now;
    })
    .reduce((sum, item) => sum + (item.pool || 0), 0);

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <div className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-4 font-['Montserrat'] shadow-lg w-full max-w-5xl mx-auto" style={{ fontFamily: 'Montserrat, sans-serif', minWidth: 1000, marginTop: -100 }}>
        <h3 className="font-extrabold text-2xl mb-4 tracking-tight text-center">MANA Reward Control Panel</h3>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold mb-1">Active Reward Code</label>
          <input
            type="text"
            value={inputCode}
            onChange={e => setInputCode(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg text-left bg-white"
            placeholder="Enter reward code"
            style={{ textAlign: 'left' }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold mb-1">Total Reward Pool</label>
          <input
            type="number"
            value={inputPool}
            onChange={e => setInputPool(Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg text-left bg-white"
            placeholder="Enter total pool"
            style={{ textAlign: 'left' }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold mb-1">Expiration Time</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={expirationValue}
              onChange={e => setExpirationValue(Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg text-left bg-white"
              placeholder="Expiration"
              style={{ textAlign: 'left' }}
            />
            <select
              value={expirationUnit}
              onChange={e => setExpirationUnit(e.target.value)}
              className="px-2 py-3 border border-gray-300 rounded-lg text-lg bg-white"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
        {/* Only allow Generate if no non-expired code exists */}
        <button
          type="button"
          onClick={handleGenerate}
          className="w-full py-3 mt-2 bg-black text-white rounded-lg font-bold text-lg tracking-wide hover:bg-primary/90 transition shadow-md"
          disabled={
            loading ||
            !inputCode ||
            !inputPool
          }
        >
          Generate
        </button>
        <div className="flex flex-col gap-2 mt-4">
          <label className="text-sm font-semibold mb-1">Remaining Balance</label>
          <div className="w-full bg-muted rounded-lg h-4 overflow-hidden">
            <div
              className="bg-green-500 h-4 rounded-lg transition-all duration-300"
              style={{ width: `${activePools > 0 ? 100 : 0}%` }}
            />
          </div>
          <span className="text-sm font-medium mt-1">
            {activePools > 0 ? `${activePools} / ${activePools}` : "0 / 0"}
          </span>
        </div>
        <div className="mt-8">
          <h4 className="font-bold text-lg mb-4 text-center">Previous Codes</h4>
          <div className="max-h-48 overflow-y-auto border rounded-xl p-4 bg-muted/30">
            {history.length === 0 ? (
              <span className="text-base text-muted-foreground">No previous codes.</span>
            ) : (
              <table className="w-full max-w-[1200px] text-base">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-bold py-2 px-2">Code</th>
                    <th className="text-left font-bold py-2 px-2">Pool</th>
                    <th className="text-left font-bold py-2 px-2">Created</th>
                    <th className="text-left font-bold py-2 px-2">Expires</th>
                    <th className="text-left font-bold py-2 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => {
                    // Compute status if not present
                    let status = item.status;
                    const now = new Date();
                    const expires = item.expiresAt ? new Date(item.expiresAt) : null;
                    if (expires && expires < now) {
                      status = 'expired';
                    } else if (typeof item.remainingPool === 'number' && item.remainingPool <= 0) {
                      status = 'used';
                    } else {
                      status = 'active';
                    }
                    // Show pool, fallback to totalPool, always show a value (even 0)
                    const poolValue = (item.pool !== undefined && item.pool !== null)
                      ? item.pool
                      : (item.totalPool !== undefined && item.totalPool !== null)
                        ? item.totalPool
                        : 0;
                    return (
                      <tr key={item.id || idx} className="border-b last:border-0">
                        <td className="text-left font-semibold py-2 px-2">{item.activeCode || item.secretCode || item.code}</td>
                        <td className="text-left text-muted-foreground py-2 px-2">₱{poolValue}</td>
                        <td className="text-left text-muted-foreground py-2 px-2">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</td>
                        <td className="text-left text-muted-foreground py-2 px-2">{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : ''}</td>
                        <td className="text-left py-2 px-2">
                          <span className={
                            status === 'active' ? 'text-green-600 font-semibold' :
                            status === 'expired' ? 'text-red-500 font-semibold' :
                            status === 'used' ? 'text-red-600 font-semibold' : ''
                          }>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        {error && <span className="text-xs text-red-500 mt-2">{error}</span>}
      </div>
    </div>
  );
};

export default ManaRewardPanel;