import * as React from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminLayout from "../components/AdminLayout";

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
  const [rewards, setRewards] = React.useState<RewardHistoryItem[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("most");

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
    fetchRewards();
    fetchMembers();
  }, []);

  // Search and filter logic
  const filteredRewards = rewards
    .filter(r => {
      if (!search) return true;
      return (
        r.userName?.toLowerCase().includes(search.toLowerCase()) ||
        r.userId?.toLowerCase().includes(search.toLowerCase())
      );
    })
    .sort((a, b) => {
      if (filter === "most") {
        // Sort by most claimed (pool desc)
        return b.pool - a.pool;
      } else if (filter === "first") {
        // Sort by first claimed (createdAt asc)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (filter === "least") {
        // Sort by least claimed (pool asc)
        return a.pool - b.pool;
      }
      return 0;
    });

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h2 className="text-2xl font-bold mb-6">Reward History</h2>
      <div className="flex gap-4 mb-6">
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
          <option value="first">First Claimed</option>
          <option value="least">Least Claimed</option>
        </select>
      </div>
      <table className="w-full border rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-muted/30">
            <th className="text-left px-4 py-2">User</th>
            <th className="text-left px-4 py-2">Email</th>
            <th className="text-left px-4 py-2">Reward Code</th>
            <th className="text-left px-4 py-2">Pool</th>
            <th className="text-left px-4 py-2">Claimed At</th>
            <th className="text-left px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredRewards.map((r, idx) => {
            const member = members.find(m => m.id === r.userId);
            return (
              <tr key={r.id || idx} className="border-b">
                <td className="px-4 py-2">{member ? member.name : r.userName || "-"}</td>
                <td className="px-4 py-2">{member ? member.email : "-"}</td>
                <td className="px-4 py-2">{r.secretCode}</td>
                <td className="px-4 py-2">₱{r.pool}</td>
                <td className="px-4 py-2">{r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}</td>
                <td className="px-4 py-2">{r.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default RewardHistory;
