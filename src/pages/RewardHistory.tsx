import * as React from "react";
import { collection, getDocs, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminLayout from "../components/AdminLayout";
import { RewardClaim } from "@/types/admin";
import { IconGift, IconHistory, IconFilter, IconSearch } from "@tabler/icons-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import PageLoading from "@/components/PageLoading";

interface RewardHistoryItem {
  id?: string;
  createdAt?: string;
  expiresAt?: string;
  pool?: number;
  remainingPool?: number;
  secretCode: string;
  status: string;
  type: string;
  userId?: string;
  userName?: string;
}

interface Member {
  id: string;
  uid?: string;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
}

const RewardHistory: React.FC = () => {
  const normalizeCode = (value: unknown): string => String(value || "").trim().toUpperCase();

  const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (typeof value === "object" && value !== null && typeof (value as { toDate?: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    const parsed = new Date(value as string).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const toIso = (value: unknown): string => {
    const ms = toMillis(value);
    return ms ? new Date(ms).toISOString() : "";
  };

  const computeRewardStatus = (reward: Pick<RewardHistoryItem, "status" | "expiresAt" | "pool" | "remainingPool">): string => {
    const now = Date.now();
    const expiresMs = toMillis(reward.expiresAt);
    const rawStatus = String(reward.status || "").toLowerCase();
    const poolValue = typeof reward.pool === "number" ? reward.pool : undefined;
    const remainingValue = typeof reward.remainingPool === "number" ? reward.remainingPool : undefined;

    if (expiresMs && expiresMs < now) return "expired";
    if ((typeof remainingValue === "number" && remainingValue <= 0) || (typeof poolValue === "number" && poolValue <= 0)) {
      return "depleted";
    }
    if (rawStatus === "active" || rawStatus === "expired" || rawStatus === "depleted") {
      return rawStatus;
    }
    return "active";
  };

  const [activeTab, setActiveTab] = React.useState<"analytics" | "claims">("analytics");
  const [rewards, setRewards] = React.useState<RewardHistoryItem[]>([]);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [rewardClaims, setRewardClaims] = React.useState<RewardClaim[]>([]);
  const [loading, setLoading] = React.useState(true);
  // UI input states for calendar only
  const [dateFromInput, setDateFromInput] = React.useState("");
  const [dateToInput, setDateToInput] = React.useState("");
  // Actual filter states
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState("latest");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const [filterTrigger, setFilterTrigger] = React.useState(0);
  const [claimsSearch, setClaimsSearch] = React.useState("");
  const [claimsSort, setClaimsSort] = React.useState("latest");
  const [claimsAmountFilter, setClaimsAmountFilter] = React.useState("all");
  const [claimsDateFromInput, setClaimsDateFromInput] = React.useState("");
  const [claimsDateToInput, setClaimsDateToInput] = React.useState("");
  const [claimsDateFrom, setClaimsDateFrom] = React.useState("");
  const [claimsDateTo, setClaimsDateTo] = React.useState("");
  const [claimsFilterTrigger, setClaimsFilterTrigger] = React.useState(0);
  const [analyticsCurrentPage, setAnalyticsCurrentPage] = React.useState(1);
  const [claimsCurrentPage, setClaimsCurrentPage] = React.useState(1);
  const itemsPerPage = 10;
  const [showFilters, setShowFilters] = React.useState(false);
  const [showClaimsFilters, setShowClaimsFilters] = React.useState(false);

  React.useEffect(() => {
    const fetchRewards = async () => {
      try {
        const snap = await getDocs(collection(db, "rewardsHistory"));
        const normalizedRaw = snap.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, unknown>;
            const secretCode = normalizeCode(data.secretCode || data.code || data.activeCode);
            if (!secretCode) return null;

            const basePool =
              typeof data.pool === "number"
                ? data.pool
                : typeof data.totalPool === "number"
                ? data.totalPool
                : 0;
            const remainingPool =
              typeof data.remainingPool === "number"
                ? data.remainingPool
                : typeof basePool === "number"
                ? basePool
                : undefined;

            const createdAt =
              toIso(data.createdAt) ||
              toIso(data.updatedAt) ||
              "";
            const expiresAt = toIso(data.expiresAt) || "";

            const reward: RewardHistoryItem = {
              id: docSnap.id,
              secretCode,
              createdAt,
              expiresAt,
              pool: basePool,
              remainingPool,
              status: String(data.status || ""),
              type: String(data.type || "mana"),
              userId: String(data.userId || ""),
              userName: String(data.userName || ""),
            };

            return {
              ...reward,
              status: computeRewardStatus(reward),
            } as RewardHistoryItem;
          })
          .filter((item): item is RewardHistoryItem => Boolean(item));

        const dedupedByCode = new Map<string, RewardHistoryItem>();
        normalizedRaw.forEach((item) => {
          const existing = dedupedByCode.get(item.secretCode);
          if (!existing) {
            dedupedByCode.set(item.secretCode, item);
            return;
          }

          const existingCreated = toMillis(existing.createdAt);
          const candidateCreated = toMillis(item.createdAt);
          if (candidateCreated > existingCreated) {
            dedupedByCode.set(item.secretCode, item);
          }
        });

        const filteredData = Array.from(dedupedByCode.values()).sort(
          (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
        );

        setRewards(filteredData);
      } catch (error) {
        console.error("Error fetching rewards:", error);
      }
    };
    
    const fetchMembers = async () => {
      try {
        const snap = await getDocs(collection(db, "members"));
        const data = snap.docs.map(doc => {
          const docData = doc.data();
          return {
            id: doc.id,
            uid: docData.uid || "",
            name: docData.name || `${docData.firstName || ""} ${docData.lastName || ""}`.trim(),
            email: docData.email || "",
            firstName: docData.firstName || "",
            lastName: docData.lastName || "",
            phoneNumber: docData.phoneNumber || "",
          } as Member;
        });
        console.log("Fetched members:", data);
        setMembers(data);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };
    
    // No longer need to fetch claims - using rewardClaims from real-time listener
    
    // Check alternative collection names
    const checkAlternativeCollections = async () => {
      const alternativeNames = ["claim", "userClaims", "manaRewards", "rewardHistory"];
      for (const name of alternativeNames) {
        try {
          const snap = await getDocs(collection(db, name));
          if (snap.docs.length > 0) {
            console.log(`Found ${snap.docs.length} documents in '${name}' collection`);
            console.log("Sample doc:", snap.docs[0].data());
          }
        } catch (error) {
          console.log(`Collection '${name}' does not exist or error:`, error);
        }
      }
    };
    
    // Use real-time listener for reward claims
    // Try without orderBy first to see if data exists
    const unsubscribeRewardClaims = onSnapshot(
      collection(db, "rewardClaims"),
      (snapshot) => {
        console.log("=== REWARD CLAIMS SNAPSHOT ===");
        console.log("Total documents:", snapshot.docs.length);
        console.log("Empty:", snapshot.empty);
        
        const data = snapshot.docs.map(doc => {
          const docData = doc.data();
          console.log("Document ID:", doc.id);
          console.log("Document data:", docData);
          console.log("Fields:", Object.keys(docData));
          
          return {
            id: doc.id,
            userId: String(docData.userId || docData.uid || "").trim(),
            userName: docData.userName || docData.name || "",
            userEmail: docData.userEmail || docData.email || "",
            claimAmount: Number(docData.claimAmount ?? docData.amount ?? 0) || 0,
            claimedAt: toIso(docData.claimedAt || docData.timestamp || docData.createdAt) || new Date().toISOString(),
            claimedDate: docData.claimedDate || docData.date || "",
            poolAfter: docData.poolAfter || docData.afterPool || 0,
            poolBefore: docData.poolBefore || docData.beforePool || 0,
            rewardPoolId: docData.rewardPoolId || docData.poolId || "",
            secretCode: normalizeCode(docData.secretCode || docData.code || docData.rewardCode || ""),
            timeToClaim: Number(docData.timeToClaim || 0) || 0,
            timeToClaimMinutes: Number(docData.timeToClaimMinutes || 0) || 0,
            codeCreatedAt: toIso(docData.codeCreatedAt) || "",
          } as RewardClaim;
        });
        
        console.log("Processed reward claims count:", data.length);
        console.log("Processed data sample:", data.slice(0, 2));
        
        // Sort by claimedAt in memory since we can't use orderBy
        const sortedData = data.sort((a, b) => {
          const dateA = new Date(a.claimedAt).getTime();
          const dateB = new Date(b.claimedAt).getTime();
          return dateB - dateA; // Descending order
        });
        
        setRewardClaims(sortedData);
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to reward claims:", error);
        console.error("Error details:", error.message);
        setLoading(false);
      }
    );

    fetchRewards();
    fetchMembers();
    checkAlternativeCollections();
    
    return () => {
      unsubscribeRewardClaims();
    };
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

  let result = rewards.map(r => {
    const status = computeRewardStatus(r);
    return { ...r, computedStatus: status };
  }).filter(r => {
    // Parse createdAt as ISO string or timestamp
    const createdTime = toMillis(r.createdAt);

    const matchesSearch =
      r.userName?.toLowerCase().includes(search.toLowerCase()) ||
      r.userId?.toLowerCase().includes(search.toLowerCase()) ||
      r.secretCode?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter ? r.computedStatus === statusFilter : true;

    const matchesDateFrom = fromTime !== null ? createdTime >= fromTime : true;
    const matchesDateTo = toTime !== null ? createdTime <= toTime : true;

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  // Sorting
  if (filter === "latest") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);
      return bTime - aTime; // Newest first
    });
  } else if (filter === "oldest") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aTime = toMillis(a.createdAt);
      const bTime = toMillis(b.createdAt);
      return aTime - bTime; // Oldest first
    });
  } else if (filter === "most") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aClaims = rewardClaims.filter((claim) => normalizeCode(claim.secretCode) === normalizeCode(a.secretCode)).reduce((sum: number, claim) => sum + (claim.claimAmount || 0), 0);
      const bClaims = rewardClaims.filter((claim) => normalizeCode(claim.secretCode) === normalizeCode(b.secretCode)).reduce((sum: number, claim) => sum + (claim.claimAmount || 0), 0);
      return bClaims - aClaims;
    });
  } else if (filter === "least") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aClaims = rewardClaims.filter((claim) => normalizeCode(claim.secretCode) === normalizeCode(a.secretCode)).reduce((sum: number, claim) => sum + (claim.claimAmount || 0), 0);
      const bClaims = rewardClaims.filter((claim) => normalizeCode(claim.secretCode) === normalizeCode(b.secretCode)).reduce((sum: number, claim) => sum + (claim.claimAmount || 0), 0);
      return aClaims - bClaims;
    });
  } else if (filter === "first") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => {
      const aFiltered = rewardClaims.filter((claim) => normalizeCode(claim.secretCode) === normalizeCode(a.secretCode));
      const bFiltered = rewardClaims.filter((claim) => normalizeCode(claim.secretCode) === normalizeCode(b.secretCode));
      
      const aFirst = aFiltered.sort((x, y) => {
        const xTime = toMillis(x.claimedAt);
        const yTime = toMillis(y.claimedAt);
        return xTime - yTime;
      })[0];
      const bFirst = bFiltered.sort((x, y) => {
        const xTime = toMillis(x.claimedAt);
        const yTime = toMillis(y.claimedAt);
        return xTime - yTime;
      })[0];
      
      const aCreatedAt = toMillis(a.createdAt) || toMillis((aFirst as RewardClaim & { codeCreatedAt?: string } | undefined)?.codeCreatedAt);
      const bCreatedAt = toMillis(b.createdAt) || toMillis((bFirst as RewardClaim & { codeCreatedAt?: string } | undefined)?.codeCreatedAt);
      const aTime = aFirst && aCreatedAt ? (toMillis(aFirst.claimedAt) - aCreatedAt) : Infinity;
      const bTime = bFirst && bCreatedAt ? (toMillis(bFirst.claimedAt) - bCreatedAt) : Infinity;
      return aTime - bTime;
    });
  } else if (filter === "pool") {
    result = result.slice().sort((a: RewardHistoryItem, b: RewardHistoryItem) => (b.pool || 0) - (a.pool || 0));
  }
  return result;
}, [rewards, rewardClaims, search, filter, statusFilter, dateFrom, dateTo, filterTrigger]);

  // Paginate analytics
  const paginatedRewards = React.useMemo(() => {
    const startIndex = (analyticsCurrentPage - 1) * itemsPerPage;
    return filteredRewards.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRewards, analyticsCurrentPage]);

  const analyticsTotalPages = Math.ceil(filteredRewards.length / itemsPerPage);

  // Filter reward claims
  const filteredRewardClaims = React.useMemo(() => {
    const getClaimTime = (dateValue: unknown): number => {
      return toMillis(dateValue);
    };

    const fromTime = claimsDateFrom ? new Date(`${claimsDateFrom}T00:00:00`).getTime() : null;
    const toTime = claimsDateTo ? new Date(`${claimsDateTo}T23:59:59.999`).getTime() : null;

    let result = rewardClaims.filter(claim => {
      const matchesSearch = 
        claim.userName?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
        claim.userEmail?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
        claim.secretCode?.toLowerCase().includes(claimsSearch.toLowerCase()) ||
        claim.userId?.toLowerCase().includes(claimsSearch.toLowerCase());

      const amount = claim.claimAmount || 0;
      const matchesAmount =
        claimsAmountFilter === "all"
          ? true
          : claimsAmountFilter === "low"
          ? amount < 10000
          : claimsAmountFilter === "medium"
          ? amount >= 10000 && amount < 50000
          : amount >= 50000;

      const claimedTime = getClaimTime(claim.claimedAt);
      const matchesDateFrom = fromTime !== null ? claimedTime >= fromTime : true;
      const matchesDateTo = toTime !== null ? claimedTime <= toTime : true;

      return matchesSearch && matchesAmount && matchesDateFrom && matchesDateTo;
    });

    if (claimsSort === "latest") {
      result = result.slice().sort((a, b) => getClaimTime(b.claimedAt) - getClaimTime(a.claimedAt));
    } else if (claimsSort === "oldest") {
      result = result.slice().sort((a, b) => getClaimTime(a.claimedAt) - getClaimTime(b.claimedAt));
    } else if (claimsSort === "highest") {
      result = result.slice().sort((a, b) => (b.claimAmount || 0) - (a.claimAmount || 0));
    } else if (claimsSort === "lowest") {
      result = result.slice().sort((a, b) => (a.claimAmount || 0) - (b.claimAmount || 0));
    }

    return result;
  }, [rewardClaims, claimsSearch, claimsSort, claimsAmountFilter, claimsDateFrom, claimsDateTo, claimsFilterTrigger]);

  // Paginate claims
  const paginatedClaims = React.useMemo(() => {
    const startIndex = (claimsCurrentPage - 1) * itemsPerPage;
    return filteredRewardClaims.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRewardClaims, claimsCurrentPage]);

  const claimsTotalPages = Math.ceil(filteredRewardClaims.length / itemsPerPage);

  // Reset pagination when filters change
  React.useEffect(() => {
    setAnalyticsCurrentPage(1);
  }, [search, filter, statusFilter, dateFrom, dateTo]);

  React.useEffect(() => {
    setClaimsCurrentPage(1);
  }, [claimsSearch, claimsSort, claimsAmountFilter, claimsDateFrom, claimsDateTo]);

  const memberNameByKey = React.useMemo(() => {
    const map = new Map<string, string>();

    members.forEach((member) => {
      const resolvedName =
        member.name?.trim() ||
        `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
        member.email?.trim() ||
        member.id;

      if (!resolvedName) return;

      map.set(member.id, resolvedName);

      const uid = member.uid?.trim();
      if (uid) {
        map.set(uid, resolvedName);
      }

      const email = member.email?.trim().toLowerCase();
      if (email) {
        map.set(email, resolvedName);
      }
    });

    return map;
  }, [members]);

  const resolveMemberName = React.useCallback(
    (identifier: string, fallback?: string) => {
      const normalized = String(identifier || "").trim();
      if (!normalized) return fallback || "Unknown User";

      return (
        memberNameByKey.get(normalized) ||
        memberNameByKey.get(normalized.toLowerCase()) ||
        fallback ||
        normalized
      );
    },
    [memberNameByKey]
  );

  // Leaderboards - use rewardClaims
  const userClaimStats: Record<string, { total: number; count: number; times: number[]; displayName?: string }> = {};
  rewardClaims.forEach((claim) => {
    const claimWithTiming = claim as RewardClaim & {
      codeCreatedAt?: string;
      timeToClaim?: number;
      timeToClaimMinutes?: number;
      userEmail?: string;
      userName?: string;
    };

    const claimantKey =
      claim.userId?.trim() ||
      claimWithTiming.userEmail?.trim().toLowerCase() ||
      claimWithTiming.userName?.trim().toLowerCase() ||
      claim.id;

    const claimantDisplayName =
      claimWithTiming.userName?.trim() ||
      claimWithTiming.userEmail?.trim() ||
      undefined;

    if (!userClaimStats[claimantKey]) {
      userClaimStats[claimantKey] = { total: 0, count: 0, times: [], displayName: claimantDisplayName };
    }

    if (!userClaimStats[claimantKey].displayName && claimantDisplayName) {
      userClaimStats[claimantKey].displayName = claimantDisplayName;
    }

    userClaimStats[claimantKey].total += claim.claimAmount || 0;
    userClaimStats[claimantKey].count += 1;
    
    // Calculate time to claim using reward creation time from rewards array
    const reward = rewards.find(r => normalizeCode(r.secretCode) === normalizeCode(claim.secretCode));
    let derivedTimeMs = 0;

    if (typeof claimWithTiming.timeToClaimMinutes === "number" && claimWithTiming.timeToClaimMinutes > 0) {
      derivedTimeMs = claimWithTiming.timeToClaimMinutes * 60 * 1000;
    } else if (typeof claimWithTiming.timeToClaim === "number" && claimWithTiming.timeToClaim > 0) {
      derivedTimeMs = claimWithTiming.timeToClaim * 1000;
    } else {
      const claimedTime = toMillis(claim.claimedAt);
      const createdTime = toMillis(reward?.createdAt) || toMillis(claimWithTiming.codeCreatedAt);
      if (claimedTime && createdTime && claimedTime >= createdTime) {
        derivedTimeMs = claimedTime - createdTime;
      }
    }

    if (derivedTimeMs > 0) {
      userClaimStats[claimantKey].times.push(derivedTimeMs);
    }
  });
  // Top claimers
  const topClaimers = Object.entries(userClaimStats)
    .map(([userId, stat]) => ({ userId, ...stat }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const fastestEligible = Object.entries(userClaimStats)
    .filter(([_, stat]) => stat.count >= 3 && stat.times.length > 0)
    .map(([userId, stat]) => ({
      userId,
      avgTime: stat.times.reduce((a, b) => a + b, 0) / stat.times.length,
      count: stat.count,
    }))
    .sort((a, b) => a.avgTime - b.avgTime);

  const fastestFallback = Object.entries(userClaimStats)
    .filter(([_, stat]) => stat.count >= 1 && stat.times.length > 0)
    .map(([userId, stat]) => ({
      userId,
      avgTime: stat.times.reduce((a, b) => a + b, 0) / stat.times.length,
      count: stat.count,
    }))
    .sort((a, b) => a.avgTime - b.avgTime)
    .slice(0, 3);

  // Prefer >=3 claims, but show real available data if none qualify yet.
  const fastestClaimers = (fastestEligible.length > 0 ? fastestEligible : fastestFallback).slice(0, 3);

  if (loading) {
    return <PageLoading className="min-h-[16rem]" />;
  }

  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">Reward History</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Track and analyze reward distribution</p>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 sm:gap-4 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 px-2 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition text-xs sm:text-base whitespace-nowrap ${
            activeTab === "analytics"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground hover:bg-muted border border-border"
          }`}
        >
          <IconGift size={20} />
          <span className="hidden sm:inline">Reward </span>Analytics
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`flex items-center gap-2 px-2 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition text-xs sm:text-base whitespace-nowrap ${
            activeTab === "claims"
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground hover:bg-muted border border-border"
          }`}
        >
          <IconHistory size={20} />
          <span className="hidden sm:inline">Individual </span>Claims ({rewardClaims.length})
        </button>
      </div>

      {activeTab === "analytics" ? (
        <>
          {/* Search and Filters */}
          <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
              <div className="relative flex-1 sm:max-w-md">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search reward code..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2"
                >
                  <IconFilter className="h-4 w-4" />
                  Filters
                  {(statusFilter || dateFrom || dateTo || filter !== "latest") && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground ml-1 sm:ml-2">
                  Total Mana Codes: {filteredRewards.length}
                </div>
              </div>
            </div>

            {/* Collapsible Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
                {/* Sort By */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Sort By</label>
                  <Select value={filter} onValueChange={setFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="most">Most Claimed</SelectItem>
                      <SelectItem value="first">Fastest First Claim</SelectItem>
                      <SelectItem value="least">Least Claimed</SelectItem>
                      <SelectItem value="pool">Pool Size</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Status</label>
                  <Select
                    value={statusFilter || "all"}
                    onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="depleted">Depleted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range - Empty third column for alignment */}
                <div></div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-semibold mb-2">From Date</label>
                  <input 
                    type="date" 
                    className="w-full border border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background" 
                    value={dateFromInput} 
                    onChange={e => setDateFromInput(e.target.value)} 
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-semibold mb-2">To Date</label>
                  <input 
                    type="date" 
                    className="w-full border border-input rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background" 
                    value={dateToInput} 
                    onChange={e => setDateToInput(e.target.value)} 
                  />
                </div>

                {/* Apply Button */}
                <div className="flex items-end">
                  <button
                    className="w-full px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors shadow-sm text-sm"
                    onClick={() => {
                      setDateFrom(dateFromInput);
                      setDateTo(dateToInput);
                      setFilterTrigger(v => v + 1);
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>

      {/* Analytics Table */}
      {filteredRewards.length === 0 ? (
      <div className="bg-card border border-border rounded-lg text-center py-8 md:py-12 mb-8">
        <p className="text-sm md:text-base text-muted-foreground">No rewards found matching your filters.</p>
      </div>
      ) : (
      <div className="bg-card border border-border rounded-lg overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Reward Code</th>
                <th className="text-right px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Pool</th>
                <th className="text-center px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Status</th>
                <th className="text-left px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Created</th>
                <th className="text-right px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Total Claimed</th>
                <th className="text-center px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Claimers</th>
                <th className="text-right px-4 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Time to First Claim</th>
              </tr>
            </thead>
        <tbody>
          {paginatedRewards.map((r, idx) => {
            const codeClaims = rewardClaims.filter(claim => normalizeCode(claim.secretCode) === normalizeCode(r.secretCode));
            const totalClaimed = codeClaims.reduce((sum, claim) => sum + (claim.claimAmount || 0), 0);
            const claimers = Array.from(new Set(codeClaims.map(claim => claim.userId))).length;
            const sortedClaims = [...codeClaims].sort((a, b) => {
              const aTime = toMillis(a.claimedAt);
              const bTime = toMillis(b.claimedAt);
              return aTime - bTime;
            });
            const firstClaim = sortedClaims[0];
            const timeToFirst = firstClaim ? 
              (() => {
                const typedFirstClaim = firstClaim as RewardClaim & {
                  codeCreatedAt?: string;
                  timeToClaim?: number;
                  timeToClaimMinutes?: number;
                };

                if (typeof typedFirstClaim.timeToClaimMinutes === "number" && typedFirstClaim.timeToClaimMinutes > 0) {
                  return typedFirstClaim.timeToClaimMinutes * 60;
                }

                if (typeof typedFirstClaim.timeToClaim === "number" && typedFirstClaim.timeToClaim > 0) {
                  return typedFirstClaim.timeToClaim;
                }

                const claimedTime = toMillis(firstClaim.claimedAt);
                const createdTime = toMillis(r.createdAt) || toMillis(typedFirstClaim.codeCreatedAt);
                return claimedTime && createdTime ? (claimedTime - createdTime) / 1000 : null;
              })()
              : null;
            const status = r.computedStatus || 'active';
            return (
              <tr
                key={r.id || idx}
                className="border-b border-border hover:bg-muted/50 transition-colors"
              >
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle font-semibold text-xs md:text-sm whitespace-nowrap">{r.secretCode}</td>
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right whitespace-nowrap">₱{(r.pool || 0).toLocaleString()}</td>
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle text-center">
                  <span className={`inline-flex items-center px-2 md:px-3 py-1 rounded-full text-xs font-semibold ${
                    status === 'active' ? 'bg-green-100 text-green-700' :
                    status === 'expired' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                </td>
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm whitespace-nowrap">
                  {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : "-"}
                </td>
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right font-semibold text-green-600 whitespace-nowrap">₱{totalClaimed.toLocaleString()}</td>
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-center">{claimers}</td>
                <td className="px-4 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right whitespace-nowrap">{timeToFirst !== null ? `${Math.round(timeToFirst)}s` : '-'}</td>
              </tr>
            );
          })}
        </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Pagination for Analytics */}
      {analyticsTotalPages > 1 && (
        <div className="mb-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setAnalyticsCurrentPage(Math.max(1, analyticsCurrentPage - 1))}
                  className={analyticsCurrentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: analyticsTotalPages }, (_, i) => i + 1).map((page) => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setAnalyticsCurrentPage(page)}
                    isActive={page === analyticsCurrentPage}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setAnalyticsCurrentPage(Math.min(analyticsTotalPages, analyticsCurrentPage + 1))}
                  className={analyticsCurrentPage === analyticsTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4">Top Claimers</h3>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">User</th>
                    <th className="text-right px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Total Claimed</th>
                    <th className="text-center px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Claims</th>
                  </tr>
                </thead>
                <tbody>
                {topClaimers.map((u, idx) => {
                  const displayName = resolveMemberName(u.userId, u.displayName);
                  return (
                    <tr key={u.userId} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm font-medium truncate max-w-[120px] md:max-w-none">{displayName}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right font-semibold text-green-600 whitespace-nowrap">₱{(u.total || 0).toLocaleString()}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-center">{u.count || 0}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
            </div>
            {topClaimers.length === 0 && (
              <div className="text-center py-6 md:py-8">
                <p className="text-muted-foreground text-xs md:text-sm">No claimers yet.</p>
              </div>
            )}
          </div>
        </div>
        <div>
          <h3 className="font-bold text-base md:text-lg mb-3 md:mb-4">Fastest Claimers (≥3 claims)</h3>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="text-left px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">User</th>
                    <th className="text-right px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Avg. Time to Claim</th>
                    <th className="text-center px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Claims</th>
                  </tr>
                </thead>
                <tbody>
                {fastestClaimers.map((u, idx) => {
                  const displayName = resolveMemberName(u.userId, userClaimStats[u.userId]?.displayName);
                  return (
                    <tr key={u.userId} className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors">
                      <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm font-medium truncate max-w-[120px] md:max-w-none">{displayName}</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right font-semibold text-blue-600 whitespace-nowrap">{Math.round((u.avgTime || 0) / 1000)}s</td>
                      <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-center">{u.count || 0}</td>
                  </tr>
                );
              })}
              </tbody>
            </table>
            </div>
            {fastestClaimers.length === 0 && (
              <div className="text-center py-6 md:py-8">
                <p className="text-muted-foreground text-xs md:text-sm">No claim timing data available yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
        </>
      ) : (
        <>
          {/* Individual Claims Tab - Search and Filters */}
          <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
              <div className="relative flex-1">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search by user name, email, reward code, or user ID..."
                  value={claimsSearch}
                  onChange={e => setClaimsSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowClaimsFilters(!showClaimsFilters)}
                  className="flex items-center gap-2"
                >
                  <IconFilter className="h-4 w-4" />
                  Filters
                  {(claimsSort !== "latest" || claimsAmountFilter !== "all" || claimsDateFrom || claimsDateTo) && (
                    <div className="w-2 h-2 bg-primary rounded-full" />
                  )}
                </Button>
                <div className="text-xs sm:text-sm font-medium text-muted-foreground ml-1 sm:ml-2">
                  Total Claims: {filteredRewardClaims.length}
                </div>
              </div>
            </div>

            {showClaimsFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select value={claimsSort} onValueChange={setClaimsSort}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="highest">Highest Amount</SelectItem>
                      <SelectItem value="lowest">Lowest Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount Range</label>
                  <Select value={claimsAmountFilter} onValueChange={setClaimsAmountFilter}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Amounts</SelectItem>
                      <SelectItem value="low">Low (&lt; ₱10K)</SelectItem>
                      <SelectItem value="medium">Medium (₱10K - ₱50K)</SelectItem>
                      <SelectItem value="high">High (₱50K+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div></div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">From Date</label>
                  <Input
                    type="date"
                    className="h-10"
                    value={claimsDateFromInput}
                    onChange={(e) => setClaimsDateFromInput(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">To Date</label>
                  <Input
                    type="date"
                    className="h-10"
                    value={claimsDateToInput}
                    onChange={(e) => setClaimsDateToInput(e.target.value)}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    className="w-full h-10"
                    onClick={() => {
                      setClaimsDateFrom(claimsDateFromInput);
                      setClaimsDateTo(claimsDateToInput);
                      setClaimsFilterTrigger((v) => v + 1);
                    }}
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            )}
          </div>

          {filteredRewardClaims.length === 0 ? (
            <div className="bg-card border border-border rounded-lg text-center py-8 md:py-12">
              <p className="text-base md:text-lg text-muted-foreground">No reward claims found.</p>
              <p className="text-xs md:text-sm text-muted-foreground mt-2">Claims will appear here when users claim rewards.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="text-left px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">User Name</th>
                      <th className="text-left px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Email</th>
                      <th className="text-left px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Reward Code</th>
                      <th className="text-right px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Claim Amount</th>
                      <th className="text-right px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Pool Before</th>
                      <th className="text-right px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Pool After</th>
                      <th className="text-left px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Claimed At</th>
                      <th className="text-right px-3 md:px-6 py-3 md:py-4 font-semibold text-xs md:text-sm whitespace-nowrap">Time to Claim</th>
                    </tr>
                  </thead>
                  <tbody>
                  {paginatedClaims.map((claim, idx) => {
                    // Handle different date formats (ISO string, Firestore Timestamp, etc.)
                    let claimedDate;
                    const claimedAtValue = claim.claimedAt;
                    
                    if (claimedAtValue != null) {
                      try {
                        if (typeof claimedAtValue === 'object' && 
                            typeof (claimedAtValue as any).toDate === 'function') {
                          // Firestore Timestamp
                          claimedDate = (claimedAtValue as any).toDate();
                        } else {
                          // String or other format
                          claimedDate = new Date(claimedAtValue as string);
                        }
                      } catch (error) {
                        console.error('Error parsing claimedAt date:', error, claimedAtValue);
                        claimedDate = new Date();
                      }
                    } else {
                      claimedDate = new Date();
                    }
                    
                    const timeMinutes = Math.abs(claim.timeToClaimMinutes || 0);
                    const timeDisplay = timeMinutes < 60 
                      ? `${timeMinutes}m` 
                      : timeMinutes < 1440 
                      ? `${Math.floor(timeMinutes / 60)}h ${timeMinutes % 60}m`
                      : `${Math.floor(timeMinutes / 1440)}d ${Math.floor((timeMinutes % 1440) / 60)}h`;
                    
                    return (
                      <tr
                        key={claim.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm font-semibold">{claim.userName}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm">{claim.userEmail}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm font-semibold">{claim.secretCode}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right font-bold text-green-600 whitespace-nowrap">₱{(claim.claimAmount || 0).toFixed(2)}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right whitespace-nowrap">₱{(claim.poolBefore || 0).toFixed(2)}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right whitespace-nowrap">₱{(claim.poolAfter || 0).toFixed(2)}</td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm whitespace-nowrap">
                          {claimedDate && !isNaN(claimedDate.getTime()) ? 
                            claimedDate.toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Invalid Date'
                          }
                        </td>
                        <td className="px-3 md:px-6 py-3 md:py-4 align-middle text-xs md:text-sm text-right whitespace-nowrap">{timeDisplay}</td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>

              {/* Pagination for Claims */}
              {claimsTotalPages > 1 && (
                <div className="mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setClaimsCurrentPage(Math.max(1, claimsCurrentPage - 1))}
                          className={claimsCurrentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: claimsTotalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setClaimsCurrentPage(page)}
                            isActive={page === claimsCurrentPage}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setClaimsCurrentPage(Math.min(claimsTotalPages, claimsCurrentPage + 1))}
                          className={claimsCurrentPage === claimsTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RewardHistory;
