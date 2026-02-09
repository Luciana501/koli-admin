import * as React from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminLayout from "../components/AdminLayout";
import { RewardClaim } from "@/types/admin";
import { IconGift, IconHistory } from "@tabler/icons-react";

interface RewardHistoryItem {
  id?: string;
  createdAt: string;
  expiresAt: string;
  pool: number;
  secretCode: string;
  status: string;
  type: string;
  userId?: string;
  userName?: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

const RewardHistory: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<"analytics" | "claims">("analytics");
  const [rewards, setRewards] = React.useState<RewardHistoryItem[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [claims, setClaims] = React.useState<any[]>([]);
  const [rewardClaims, setRewardClaims] = React.useState<RewardClaim[]>([]);
  // UI input states for calendar only
  const [dateFromInput, setDateFromInput] = React.useState("");
  const [dateToInput, setDateToInput] = React.useState("");
  // Actual filter states
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("most");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const [filterTrigger, setFilterTrigger] = React.useState(0);
  const [claimsSearch, setClaimsSearch] = React.useState("");

  React.useEffect(() => {
    const fetchRewards = async () => {
      const snap = await getDocs(collection(db, "rewardsHistory"));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RewardHistoryItem));
      setRewards(data);
    };
    const fetchMembers = async () => {
      const snap = await getDocs(collection(db, "members"));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member));
      setMembers(data);
    };
    const fetchClaims = async () => {
      const snap = await getDocs(collection(db, "claims"));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClaims(data);
    };
    const fetchRewardClaims = async () => {
      const q = query(collection(db, "rewardClaims"), orderBy("claimedAt", "desc"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RewardClaim));
      setRewardClaims(data);
    };
    fetchRewards();
    fetchMembers();
    fetchClaims();
    fetchRewardClaims();
  }, []);

// Filter and sort rewards
const filteredRewards = React.useMemo(() => {
  // Helper to get Manila (UTC+8) timestamp for a date string (YYYY-MM-DD)
  function getManilaTimestamp(dateStr: string, endOfDay = false) {
    if (!dateStr) return null;
    // Parse as local date, then add 8 hours offset to get UTC+8
    const [year, month, day] = dateStr.split('-').map(Number);
    // For endOfDay, use 23:59:59.999 in UTC+8, which is 15:59:59.999 UTC
    // For startOfDay, use 00:00:00.000 in UTC+8, which is 16:00:00.000 previous day UTC
    if (endOfDay) {
      return Date.UTC(year, month - 1, day, 23, 59, 59, 999) - (8 * 60 * 60 * 1000);
    } else {
      return Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (8 * 60 * 60 * 1000);
    }
  }

  const fromTime = dateFrom ? getManilaTimestamp(dateFrom, false) : null;
  const toTime = dateTo ? getManilaTimestamp(dateTo, true) : null;

  let result = rewards.filter(r => {
    // Parse createdAt as ISO string or timestamp
    const createdTime = Date.parse(r.createdAt);

    const matchesSearch =
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userId?.toLowerCase().includes(search.toLowerCase()) ||
      r.secretCode?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter ? r.status === statusFilter : true;

    const matchesDateFrom = fromTime !== null ? createdTime >= fromTime : true;
    const matchesDateTo = toTime !== null ? createdTime <= toTime : true;

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  // Sorting
  if (filter === "most") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aClaims = claims.filter((c: any) => c.rewardCode === a.secretCode).reduce((sum: number, c: any) => sum + (c.claimedAmount || 0), 0);
      const bClaims = claims.filter((c: any) => c.rewardCode === b.secretCode).reduce((sum: number, c: any) => sum + (c.claimedAmount || 0), 0);
      return bClaims - aClaims;
    });
  } else if (filter === "least") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aClaims = claims.filter((c: any) => c.rewardCode === a.secretCode).reduce((sum: number, c: any) => sum + (c.claimedAmount || 0), 0);
      const bClaims = claims.filter((c: any) => c.rewardCode === b.secretCode).reduce((sum: number, c: any) => sum + (c.claimedAmount || 0), 0);
      return aClaims - bClaims;
    });
  } else if (filter === "first") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aFirst = claims.filter((c: any) => c.rewardCode === a.secretCode).sort((x: any, y: any) => new Date(x.claimedAt).getTime() - new Date(y.claimedAt).getTime())[0];
      const bFirst = claims.filter((c: any) => c.rewardCode === b.secretCode).sort((x: any, y: any) => new Date(x.claimedAt).getTime() - new Date(y.claimedAt).getTime())[0];
      const aTime = aFirst ? (new Date(aFirst.claimedAt).getTime() - new Date(a.createdAt).getTime()) : Infinity;
      const bTime = bFirst ? (new Date(bFirst.claimedAt).getTime() - new Date(b.createdAt).getTime()) : Infinity;
      return aTime - bTime;
    });
  } else if (filter === "pool") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => b.pool - a.pool);
  }
  return result;
}, [rewards, claims, search, filter, statusFilter, dateFrom, dateTo, filterTrigger]);

  // Filter reward claims
  const filteredRewardClaims = React.useMemo(() => {
    return rewardClaims.filter(claim => {
      const matchesSearch = 
        claim.userName?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
        claim.userEmail?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
        claim.secretCode?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
        claim.userId?.toLowerCase().includes(claimsSearch.toLowerCase());
      return matchesSearch;
    });
  }, [rewardClaims, claimsSearch]);

  // Leaderboards
  const userClaimStats: Record<string, { total: number; count: number; times: number[] }> = {};
  claims.forEach((c: any) => {
    if (!userClaimStats[c.userId]) userClaimStats[c.userId] = { total: 0, count: 0, times: [] };
    userClaimStats[c.userId].total += c.claimedAmount || 0;
    userClaimStats[c.userId].count += 1;
    if (c.claimedAt && c.codeCreatedAt) {
      userClaimStats[c.userId].times.push(new Date(c.claimedAt).getTime() - new Date(c.codeCreatedAt).getTime());
    }
  });
  // Top claimers
  const topClaimers = Object.entries(userClaimStats)
    .map(([userId, stat]) => ({ userId, ...stat }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  // Fastest claimers (at least 3 claims)
  const fastestClaimers = Object.entries(userClaimStats)
    .filter(([_, stat]) => stat.times.length >= 3)
    .map(([userId, stat]) => ({
      userId,
      avgTime: stat.times.reduce((a, b) => a + b, 0) / stat.times.length,
      count: stat.count,
    }))
    .sort((a, b) => a.avgTime - b.avgTime)
    .slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto p-8 font-['Montserrat'] bg-gray-50 min-h-screen" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <h2 className="text-3xl font-extrabold mb-8 text-center tracking-tight">Reward History</h2>
      
      {/* Tab Navigation */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
            activeTab === "analytics"
              ? "bg-black text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          <IconGift size={20} />
          Reward Analytics
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition ${
            activeTab === "claims"
              ? "bg-black text-white"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          <IconHistory size={20} />
          Individual Claims
        </button>
      </div>

      {activeTab === "analytics" ? (
        <>
          <div className="flex flex-row flex-wrap gap-4 mb-8 items-end justify-center max-w-7xl mx-auto">
        <input
          type="text"
          className="border rounded px-4 py-2 w-64"
          placeholder="Search by user name or ID"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-4 py-2"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="most">Most Claimed</option>
          <option value="first">Fastest First Claim</option>
          <option value="least">Least Claimed</option>
          <option value="pool">Pool Size</option>
        </select>
        <select
          className="border rounded px-4 py-2"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="depleted">Depleted</option>
        </select>
        <label className="text-sm">From:
          <input type="date" className="ml-2 border rounded px-2 py-1" value={dateFromInput} onChange={e => setDateFromInput(e.target.value)} />
        </label>
        <label className="text-sm">To:
          <input type="date" className="ml-2 border rounded px-2 py-1" value={dateToInput} onChange={e => setDateToInput(e.target.value)} />
        </label>
        <div className="flex items-center h-full">
          <button
            className="ml-2 px-4 py-2 bg-black text-white rounded shadow hover:bg-gray-800"
            style={{ height: '40px', marginTop: '2px' }}
            onClick={() => {
              setDateFrom(dateFromInput);
              setDateTo(dateToInput);
              setFilterTrigger(v => v + 1);
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Analytics Table */}
      <table className="w-full border border-gray-300 rounded-xl overflow-hidden mb-12 shadow-sm bg-white font-['Montserrat']">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-6 py-3 font-bold text-base">Reward Code</th>
            <th className="text-left px-6 py-3 font-bold text-base">Pool</th>
            <th className="text-left px-6 py-3 font-bold text-base">Status</th>
            <th className="text-left px-6 py-3 font-bold text-base">Created</th>
            <th className="text-left px-6 py-3 font-bold text-base">Total Claimed</th>
            <th className="text-left px-6 py-3 font-bold text-base">Claimers</th>
            <th className="text-left px-6 py-3 font-bold text-base">Time to First Claim</th>
          </tr>
        </thead>
        <tbody>
          {filteredRewards.map((r, idx) => {
            const codeClaims = claims.filter(c => c.rewardCode === r.secretCode);
            const totalClaimed = codeClaims.reduce((sum, c) => sum + (c.claimedAmount || 0), 0);
            const claimers = Array.from(new Set(codeClaims.map(c => c.userId))).length;
            const firstClaim = codeClaims.sort((a, b) => new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime())[0];
            const timeToFirst = firstClaim ? (new Date(firstClaim.claimedAt).getTime() - new Date(r.createdAt).getTime()) / 1000 : null;
            // Auto-expire logic: if expiresAt is in the past, show 'expired' in UI
            const now = Date.now();
            const isExpired = r.expiresAt && new Date(r.expiresAt).getTime() < now;
            const status = isExpired ? 'expired' : r.status;
            return (
              <tr
                key={r.id || idx}
                className={`border-b border-gray-200 transition font-['Montserrat'] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-primary/5`}
              >
                <td className="px-6 py-3 align-middle font-semibold text-sm">{r.secretCode}</td>
                <td className="px-6 py-3 align-middle text-sm">₱{r.pool}</td>
                <td className="px-6 py-3 align-middle text-sm capitalize">{status}</td>
                <td className="px-6 py-3 align-middle text-sm">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                <td className="px-6 py-3 align-middle text-sm">₱{totalClaimed}</td>
                <td className="px-6 py-3 align-middle text-sm">{claimers}</td>
                <td className="px-6 py-3 align-middle text-sm">{timeToFirst !== null ? `${Math.round(timeToFirst)}s` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 font-['Montserrat']">
        <div>
          <h3 className="font-bold text-xl mb-4 text-center">Top Claimers</h3>
          <table className="w-full border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm font-['Montserrat']">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-6 py-3 font-bold text-base">User</th>
                <th className="text-left px-6 py-3 font-bold text-base">Total Claimed</th>
                <th className="text-left px-6 py-3 font-bold text-base">Claims</th>
              </tr>
            </thead>
            <tbody>
              {topClaimers.map((u, idx) => {
                const member = members.find(m => m.id === u.userId);
                return (
                  <tr key={u.userId} className={`border-b border-gray-200 transition font-['Montserrat'] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-primary/5`}>
                    <td className="px-6 py-3 align-middle text-sm">{member ? member.name : u.userId}</td>
                    <td className="px-6 py-3 align-middle text-sm">₱{u.total}</td>
                    <td className="px-6 py-3 align-middle text-sm">{u.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="font-bold text-xl mb-4 text-center">Fastest Claimers (≥3 claims)</h3>
          <table className="w-full border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm font-['Montserrat']">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-6 py-3 font-bold text-base">User</th>
                <th className="text-left px-6 py-3 font-bold text-base">Avg. Time to Claim</th>
                <th className="text-left px-6 py-3 font-bold text-base">Claims</th>
              </tr>
            </thead>
            <tbody>
              {fastestClaimers.map((u, idx) => {
                const member = members.find(m => m.id === u.userId);
                return (
                  <tr key={u.userId} className={`border-b border-gray-200 transition font-['Montserrat'] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-primary/5`}>
                    <td className="px-6 py-3 align-middle text-sm">{member ? member.name : u.userId}</td>
                    <td className="px-6 py-3 align-middle text-sm">{Math.round(u.avgTime / 1000)}s</td>
                    <td className="px-6 py-3 align-middle text-sm">{u.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
        </>
      ) : (
        <>
          {/* Individual Claims Tab */}
          <div className="mb-8 flex justify-center">
            <input
              type="text"
              className="border rounded px-4 py-2 w-96"
              placeholder="Search by user name, email, code, or user ID"
              value={claimsSearch}
              onChange={e => setClaimsSearch(e.target.value)}
            />
          </div>

          <table className="w-full border border-gray-300 rounded-xl overflow-hidden shadow-sm bg-white font-['Montserrat']">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-6 py-3 font-bold text-base">User Name</th>
                <th className="text-left px-6 py-3 font-bold text-base">Email</th>
                <th className="text-left px-6 py-3 font-bold text-base">Reward Code</th>
                <th className="text-left px-6 py-3 font-bold text-base">Claim Amount</th>
                <th className="text-left px-6 py-3 font-bold text-base">Pool Before</th>
                <th className="text-left px-6 py-3 font-bold text-base">Pool After</th>
                <th className="text-left px-6 py-3 font-bold text-base">Claimed At</th>
                <th className="text-left px-6 py-3 font-bold text-base">Time to Claim</th>
              </tr>
            </thead>
            <tbody>
              {filteredRewardClaims.map((claim, idx) => {
                const claimedDate = new Date(claim.claimedAt);
                const timeMinutes = Math.abs(claim.timeToClaimMinutes);
                const timeDisplay = timeMinutes < 60 
                  ? `${timeMinutes}m` 
                  : timeMinutes < 1440 
                  ? `${Math.floor(timeMinutes / 60)}h ${timeMinutes % 60}m`
                  : `${Math.floor(timeMinutes / 1440)}d ${Math.floor((timeMinutes % 1440) / 60)}h`;
                
                return (
                  <tr
                    key={claim.id}
                    className={`border-b border-gray-200 transition font-['Montserrat'] ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-primary/5`}
                  >
                    <td className="px-6 py-3 align-middle text-sm font-semibold">{claim.userName}</td>
                    <td className="px-6 py-3 align-middle text-sm">{claim.userEmail}</td>
                    <td className="px-6 py-3 align-middle text-sm font-semibold">{claim.secretCode}</td>
                    <td className="px-6 py-3 align-middle text-sm font-bold text-green-600">₱{claim.claimAmount.toFixed(2)}</td>
                    <td className="px-6 py-3 align-middle text-sm">₱{claim.poolBefore.toFixed(2)}</td>
                    <td className="px-6 py-3 align-middle text-sm">₱{claim.poolAfter.toFixed(2)}</td>
                    <td className="px-6 py-3 align-middle text-sm">{claimedDate.toLocaleString()}</td>
                    <td className="px-6 py-3 align-middle text-sm">{timeDisplay}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default RewardHistory;
