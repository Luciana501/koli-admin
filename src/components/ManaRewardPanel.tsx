import * as React from "react";
import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  writeBatch,
  onSnapshot,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [inputCode, setInputCode] = useState("");
  const [inputPool, setInputPool] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const [totalPool, setTotalPool] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [expiresAt, setExpiresAt] = useState("");
  const [expirationValue, setExpirationValue] = useState("");
  const [expirationUnit, setExpirationUnit] = useState("minutes");
  const [createdAt, setCreatedAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<RewardHistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  // --- Real-time re-render for expiration ---
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);


  // --- Real-time listeners ---
  useEffect(() => {
    const unsubscribeActiveReward = onSnapshot(
      doc(db, "globalRewards", "currentActiveReward"),
      async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const now = new Date();
          const expires = data.expiresAt ? new Date(data.expiresAt) : null;
          
          // Check if the active reward has expired
          if (expires && expires < now) {
            // Reset the active reward since it's expired
            await setDoc(docSnap.ref, {
              activeCode: "",
              totalPool: 0,
              remainingPool: 0,
              createdAt: "",
              expiresAt: "",
              updatedAt: now.toISOString(),
            });
            
            setActiveCode("");
            setTotalPool(0);
            setRemaining(0);
            setExpiresAt("");
            setCreatedAt("");
          } else {
            setActiveCode(data.activeCode || "");
            setTotalPool(data.totalPool || 0);
            setRemaining(data.remainingPool || 0);
            setExpiresAt(data.expiresAt || "");
            setCreatedAt(data.createdAt || "");
          }
        } else {
          setActiveCode("");
          setTotalPool(0);
          setRemaining(0);
          setExpiresAt("");
          setCreatedAt("");
        }
      }
    );

    const unsubscribeHistory = onSnapshot(
      collection(db, "rewardsHistory"),
      async (snapshot) => {
        const now = new Date();
        const batch = writeBatch(db);
        let expiredCount = 0;

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.status === "active" && data.expiresAt) {
            const expires = new Date(data.expiresAt);
            if (expires < now) {
              batch.update(docSnap.ref, {
                status: "expired",
                expiredAt: now.toISOString(),
              });
              expiredCount++;
            }
          }
        });

        if (expiredCount > 0) {
          await batch.commit();
        }

        const hist: RewardHistoryItem[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            // Check expiration status in real-time on the client side
            let currentStatus = data.status;
            if (data.status === "active" && data.expiresAt) {
              const expires = new Date(data.expiresAt);
              if (expires < now) {
                currentStatus = "expired";
              }
            }
            return { 
              id: doc.id, 
              ...data, 
              status: currentStatus 
            } as RewardHistoryItem;
          })
          .sort((a, b) => {
            const aTime = a.createdAt
              ? new Date(a.createdAt).getTime()
              : 0;
            const bTime = b.createdAt
              ? new Date(b.createdAt).getTime()
              : 0;
            return bTime - aTime;
          });

        setHistory(hist);
      }
    );

    // Periodic check to update expired items in Firestore (every 10 seconds)
    const expirationCheckInterval = setInterval(async () => {
      const now = new Date();
      const batch = writeBatch(db);
      let expiredCount = 0;

      const historySnapshot = await getDocs(collection(db, "rewardsHistory"));
      historySnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.status === "active" && data.expiresAt) {
          const expires = new Date(data.expiresAt);
          if (expires < now) {
            batch.update(docSnap.ref, {
              status: "expired",
              expiredAt: now.toISOString(),
            });
            expiredCount++;
          }
        }
      });

      if (expiredCount > 0) {
        await batch.commit();
      }
    }, 10000); // Check every 10 seconds

    return () => {
      unsubscribeActiveReward();
      unsubscribeHistory();
      clearInterval(expirationCheckInterval);
    };
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      // Check if the code already exists in rewardsHistory
      const existingCodeQuery = query(
        collection(db, "rewardsHistory"),
        where("secretCode", "==", inputCode)
      );
      const existingCodeSnapshot = await getDocs(existingCodeQuery);
      
      if (!existingCodeSnapshot.empty) {
        setError("This MANA code has already been used. Please enter a different code.");
        setLoading(false);
        return;
      }

      const now = new Date();
      let multiplier = 1;
      if (expirationUnit === "hours") multiplier = 60;
      if (expirationUnit === "days") multiplier = 60 * 24;

      const expires = new Date(
        now.getTime() +
          Number(expirationValue) * multiplier * 60 * 1000
      );

      let prevRemaining = 0;
      let prevExpiresAt = "";

      const docRef = doc(db, "globalRewards", "currentActiveReward");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        prevRemaining = data.remainingPool || 0;
        prevExpiresAt = data.expiresAt || "";
      }

      let newTotalPool = Number(inputPool);
      let newRemainingPool = Number(inputPool);
      if (prevExpiresAt && new Date(prevExpiresAt) > now) {
        newTotalPool += prevRemaining;
        newRemainingPool += prevRemaining;
      }

      await setDoc(docRef, {
        activeCode: inputCode,
        totalPool: newTotalPool,
        remainingPool: newRemainingPool,
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        updatedAt: now.toISOString(),
      });

      await addDoc(collection(db, "rewardsHistory"), {
        secretCode: inputCode,
        pool: Number(inputPool),
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        type: "mana",
        status: "active",
      });

      setInputCode("");
      setInputPool("");
      setExpirationValue("");
    } catch (e) {
      setError("Failed to generate reward");
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = React.useMemo(() => {
    return history.filter((item) => {
      const matchesSearch = (item.activeCode ||
        item.secretCode ||
        item.code ||
        "")
        .toLowerCase()
        .includes(historySearch.toLowerCase());
      
      // Check real-time expiration status
      let currentStatus = item.status;
      if (item.status === "active" && item.expiresAt) {
        const expires = new Date(item.expiresAt);
        if (expires < now) {
          currentStatus = "expired";
        }
      }
      
      const matchesStatus = statusFilter === "all" || currentStatus === statusFilter;
      
      let matchesDate = true;
      if (dateFilter && item.createdAt) {
        const itemDate = new Date(item.createdAt).toISOString().split('T')[0];
        matchesDate = itemDate === dateFilter;
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [history, historySearch, statusFilter, dateFilter, now]);

  const totalPages = Math.ceil(
    filteredHistory.length / itemsPerPage
  );

  const paginatedHistory = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredHistory.slice(
      startIndex,
      startIndex + itemsPerPage
    );
  }, [filteredHistory, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [historySearch, statusFilter, dateFilter]);

  const recentCodes = React.useMemo(
    () => history.slice(0, 3),
    [history]
  );

  // Compute real-time display values for remaining balance
  const isExpired = expiresAt ? new Date(expiresAt) < now : false;
  const displayRemaining = isExpired ? 0 : remaining;
  const displayTotalPool = isExpired ? 0 : totalPool;

  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-4 w-full">

      {/* LEFT PANEL */}
      <div className="w-full lg:w-[340px] bg-card border border-border rounded-lg p-4 md:p-6 flex flex-col shadow-sm overflow-auto lg:shrink-0">

          <h2 className="font-bold text-2xl mb-6 text-foreground">
            MANA Reward Control Panel
          </h2>
          <div className="flex flex-col gap-4 flex-grow">

            {/* Inputs */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Active Reward Code
              </label>
              <input
                type="text"
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value);
                  if (error) setError("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white h-10"
                placeholder="Enter reward code"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Total Reward Pool
              </label>
              <input
                type="number"
                value={inputPool}
                onChange={(e) => setInputPool(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white h-10"
                placeholder="Enter total pool"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-muted-foreground">
                Expiration Time
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={expirationValue}
                  onChange={(e) =>
                    setExpirationValue(e.target.value)
                  }
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white h-10"
                  placeholder="Time"
                />
                <select
                  value={expirationUnit}
                  onChange={(e) =>
                    setExpirationUnit(e.target.value)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white h-10"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !inputCode || !inputPool}
              className="w-full py-2.5 bg-black text-white rounded-lg font-bold text-sm hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate"}
            </button>

            {/* Error Message */}
            {error && (
              <div className="w-full p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Remaining */}
            <div className="mt-6">
              <label className="text-sm font-medium text-muted-foreground">
                Remaining Balance
              </label>
              <div className="w-full bg-muted rounded-lg h-3 mt-1.5 overflow-hidden">
                <div
                  className="bg-green-500 h-3 transition-all duration-500"
                  style={{
                    width:
                      displayTotalPool > 0
                        ? `${(displayRemaining / displayTotalPool) * 100}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="text-xs font-medium mt-1.5 block">
                {displayTotalPool > 0
                  ? `${displayRemaining} / ${displayTotalPool}`
                  : "0 / 0"}
              </span>
            </div>

            {/* Recent Codes */}
            <div className="mt-auto pt-6 border-t">
              <h4 className="font-semibold text-base mb-4">
                Recent Codes
              </h4>

              <div className="border rounded-lg p-3 bg-muted/20">
                {recentCodes.length === 0 ? (
                  <span className="text-muted-foreground">
                    No recent codes.
                  </span>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Code</th>
                        <th className="text-left py-2">Pool</th>
                        <th className="text-left py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCodes.map((item, idx) => (
                        <tr key={item.id || idx}>
                          <td className="py-2 font-semibold">
                            {item.secretCode}
                          </td>
                          <td>₱{item.pool}</td>
                          <td className={`font-semibold ${item.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                            {item.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 bg-card border border-border rounded-lg p-4 md:p-6 flex flex-col shadow-sm overflow-auto min-w-0">
          <h2 className="font-bold text-2xl mb-6 text-foreground">
            Reward History
          </h2>
          <div className="flex flex-col gap-4 flex-grow">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-medium text-muted-foreground">
                  Search History
                </label>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white h-10"
                  placeholder="Search codes"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Filter by Status
                </label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white h-10">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Filter by Date
                </label>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-40 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm bg-white h-10"
                />
              </div>
            </div>
            <div className="flex-grow overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Pool</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Expires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.map((item, idx) => {
                    // Compute real-time status for display
                    let displayStatus = item.status;
                    if (item.status === "active" && item.expiresAt) {
                      const expires = new Date(item.expiresAt);
                      if (expires < now) {
                        displayStatus = "expired";
                      }
                    }
                    
                    return (
                      <TableRow key={item.id || idx}>
                        <TableCell className="font-semibold">
                          {item.secretCode || item.activeCode || item.code}
                        </TableCell>
                        <TableCell>₱{item.pool}</TableCell>
                        <TableCell className={`font-semibold ${displayStatus === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                          {displayStatus}
                        </TableCell>
                        <TableCell>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</TableCell>
                        <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : ''}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={page === currentPage}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </div>
  );
};

export default ManaRewardPanel;
