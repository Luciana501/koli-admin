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
  const [expirationMinutes, setExpirationMinutes] = React.useState(30);
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
      // Fetch code history from globalRewards collection only
      const globalRewardsRef = collection(db, "globalRewards");
      const globalRewardsSnap = await getDocs(globalRewardsRef);
      // Filter for documents that look like code entries (e.g., have activeCode or similar fields)
      const hist: RewardHistoryItem[] = globalRewardsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as RewardHistoryItem))
        .filter(item => item.activeCode || item.secretCode || item.code)
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
      // Set expiration X minutes from now
      const now = new Date();
      const expires = new Date(now.getTime() + expirationMinutes * 60 * 1000);
      // Save to globalRewards/currentActiveReward (overwrite doc)
      await import("firebase/firestore").then(({ setDoc }) =>
        setDoc(doc(db, "globalRewards", "currentActiveReward"), {
          activeCode: inputCode,
          totalPool: inputPool,
          remainingPool: inputPool,
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
      setRemaining(inputPool);
      setCreatedAt(now.toISOString());
      setExpiresAt(expires.toISOString());
      setInputCode("");
      setInputPool(0);
      // Refresh history
      fetchRewards();
    } catch (e) {
      setError("Failed to generate reward");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-8 flex flex-col gap-4 font-['Montserrat'] shadow-lg w-full max-w-5xl mx-auto" style={{ fontFamily: 'Montserrat, sans-serif', minWidth: 700 }}>
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
        <label className="text-sm font-semibold mb-1">Expiration Time (minutes)</label>
        <input
          type="number"
          min={1}
          value={expirationMinutes}
          onChange={e => setExpirationMinutes(Number(e.target.value))}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-lg text-left bg-white"
          placeholder="Expiration in minutes"
          style={{ textAlign: 'left' }}
        />
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
        {(() => {
          let isExpired = false;
          if (expiresAt) {
            const exp = new Date(expiresAt);
            isExpired = exp < new Date();
          }
          const displayRemaining = isExpired ? 0 : remaining;
          return (
            <>
              <div className="w-full bg-muted rounded-lg h-4 overflow-hidden">
                <div
                  className="bg-green-500 h-4 rounded-lg transition-all duration-300"
                  style={{ width: `${totalPool ? (displayRemaining / totalPool) * 100 : 0}%` }}
                />
              </div>
              <span className="text-sm font-medium mt-1">{displayRemaining} / {totalPool}</span>
            </>
          );
        })()}
      </div>
      <div className="mt-8">
        <h4 className="font-bold text-lg mb-4 text-center">Previous Codes</h4>
        <div className="max-h-48 overflow-y-auto border rounded-xl p-4 bg-muted/30">
          {history.length === 0 ? (
            <span className="text-base text-muted-foreground">No previous codes.</span>
          ) : (
            <table className="w-full text-base">
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
                  if (!status) {
                    const now = new Date();
                    const expires = item.expiresAt ? new Date(item.expiresAt) : null;
                    if (expires && expires < now) {
                      status = 'expired';
                    } else if (typeof item.remainingPool === 'number' && item.remainingPool <= 0) {
                      status = 'used';
                    } else {
                      status = 'active';
                    }
                  }
                  return (
                    <tr key={item.id || idx} className="border-b last:border-0">
                      <td className="text-left font-semibold py-2 px-2">{item.activeCode || item.secretCode || item.code}</td>
                      <td className="text-left text-muted-foreground py-2 px-2">{item.pool ? `₱${item.pool}` : ''}</td>
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
  );
};

export default ManaRewardPanel;
