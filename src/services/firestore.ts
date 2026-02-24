import { collection, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot, serverTimestamp, setDoc, runTransaction } from "firebase/firestore";
import { ref, getDownloadURL, uploadBytes, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions, auth } from "@/lib/firebase";
import { User, Withdrawal, Donation } from "@/types/admin";
import type { AdminType } from "@/types/admin";

export interface ReportData {
  date: Date;
  count?: number;
  amount?: number;
}

export interface ManaRewardAnalytics {
  totalRewardsGenerated: number;
  totalRewardsClaimed: number;
  totalClaimAmount: number;
  activeRewards: number;
  expiredRewards: number;
  claimRate: number;
  averageClaimAmount: number;
  recentRewards: Array<{
    id: string;
    code: string;
    totalPool: number;
    remainingPool: number;
    claimCount: number;
    expiresAt: string;
    status: string;
  }>;
}

export interface AdminUserShare {
  id: string;
  userId: string;
  fromAdminId: string;
  fromAdminType: AdminType;
  toAdminType: AdminType;
  note: string;
  status: "shared" | "reviewed";
  createdAt: string;
  userSnapshot: User;
}

export interface PlatformCode {
  id: string;
  code: string;
  description: string;
  leaderId: string;
  leaderName: string;
  isActive: boolean;
  usageCount: number;
  maxUses: number | null;
  createdAt: string;
}

export interface Leader {
  id: string;
  name: string;
  codeName: string;
  isActive: boolean;
  createdAt: string;
}

export interface NewsPost {
  id: string;
  title: string;
  imageUrl: string;
  imagePath: string;
  category: string;
  details: string;
  postedAt: string;
  createdAt: string;
  createdBy: string;
}

export interface MaintenanceSchedulerConfig {
  enabled: boolean;
  startAt: string;
  endAt: string;
  durationHours: number;
  startInHours: number;
  startInMinutes: number;
  message: string;
  timezone: string;
  updatedAt: string;
  updatedBy: string;
}

const toIsoString = (value: unknown): string => {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof (value as Timestamp)?.toDate === "function") {
    return (value as Timestamp).toDate().toISOString();
  }
  return new Date().toISOString();
};

const getLatestUserSnapshotForShare = async (user: User): Promise<User> => {
  try {
    const latestUser = await fetchUserById(user.id);
    if (!latestUser) {
      return user;
    }

    return {
      ...user,
      ...latestUser,
      firstName: latestUser.firstName || user.firstName || "",
      lastName: latestUser.lastName || user.lastName || "",
      phoneNumber: latestUser.phoneNumber || user.phoneNumber || "",
      email: latestUser.email || user.email || "",
      address: latestUser.address || user.address || "",
      donationAmount: latestUser.donationAmount ?? user.donationAmount ?? 0,
      totalAsset: latestUser.totalAsset ?? user.totalAsset ?? 0,
      kycStatus: latestUser.kycStatus || user.kycStatus || "NOT_SUBMITTED",
      createdAt: latestUser.createdAt || user.createdAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error loading latest user snapshot for share:", error);
    return user;
  }
};

// Fetch analytics data for reports
export const fetchReportAnalytics = async (type: "users" | "donations" | "assets" | "rewards", timeRange: string) => {
  try {
    // Use UTC dates to match Firestore timestamps
    const now = new Date();
    const endDate = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      23, 59, 59, 999
    ));
    
    let startDate = new Date(endDate);

    // Calculate start date based on time range (in UTC)
    switch (timeRange) {
      case "7days":
        startDate.setUTCDate(startDate.getUTCDate() - 7);
        break;
      case "1month":
        startDate.setUTCMonth(startDate.getUTCMonth() - 1);
        break;
      case "3months":
        startDate.setUTCMonth(startDate.getUTCMonth() - 3);
        break;
      case "6months":
        startDate.setUTCMonth(startDate.getUTCMonth() - 6);
        break;
      case "1year":
        startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
        break;
      default:
        startDate.setUTCMonth(startDate.getUTCMonth() - 3);
    }
    
    startDate.setUTCHours(0, 0, 0, 0); // Start of start date
    
    console.log(`\ud83d\udcca Fetching ${type} analytics for ${timeRange}:`)
    console.log(`  Start: ${startDate.toISOString()} (${startDate.toLocaleDateString()})`)
    console.log(`  End: ${now.toISOString()} (${now.toLocaleDateString()})`);

    // Helper function to determine optimal aggregation level
    const getAggregationLevel = (timeRange: string): 'day' | 'week' | 'month' => {
      switch (timeRange) {
        case "7days":
        case "1month":
          return 'day';
        case "3months":
        case "6months":
          return 'week';
        case "1year":
          return 'month';
        default:
          return 'week';
      }
    };

    // Helper function to aggregate dates (working in UTC)
    const aggregateDates = (start: Date, end: Date, level: 'day' | 'week' | 'month'): string[] => {
      const dates: string[] = [];
      const current = new Date(start);
      current.setUTCHours(0, 0, 0, 0);
      
      if (level === 'day') {
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0]);
          current.setUTCDate(current.getUTCDate() + 1);
        }
      } else if (level === 'week') {
        // Start from the beginning of the week
        current.setUTCDate(current.getUTCDate() - current.getUTCDay());
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0]);
          current.setUTCDate(current.getUTCDate() + 7);
        }
      } else {
        // Month aggregation
        current.setUTCDate(1);
        while (current <= end) {
          dates.push(current.toISOString().split('T')[0]);
          current.setUTCMonth(current.getUTCMonth() + 1);
        }
      }
      
      return dates;
    };

    // Helper function to get aggregation key (working in UTC)
    const getAggregationKey = (dateStr: string, level: 'day' | 'week' | 'month'): string => {
      const date = new Date(dateStr + 'T00:00:00Z');
      
      if (level === 'day') {
        return dateStr;
      } else if (level === 'week') {
        const weekStart = new Date(date);
        weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
        return weekStart.toISOString().split('T')[0];
      } else {
        const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
        return monthStart.toISOString().split('T')[0];
      }
    };

    const aggLevel = getAggregationLevel(timeRange);
    const allDates = aggregateDates(startDate, endDate, aggLevel);
    console.log(`  Aggregation: ${aggLevel} | Buckets: ${allDates.length}`);

    // Helper to create date from string reliably
    const createDateFromString = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    };

    if (type === "users") {
      // Get user registrations over time
      const usersRef = collection(db, "members");
      const snapshot = await getDocs(usersRef);
      console.log(`👥 Found ${snapshot.size} total users in database`);
      
      const dataMap = new Map<string, number>();
      let usersInRange = 0;
      let usersProcessed = 0;
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        let createdAt: Date | null = null;
        usersProcessed++;
        
        // Handle different date formats
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
          } else if (typeof data.createdAt === 'string') {
            createdAt = new Date(data.createdAt);
          }
        }
        
        if (usersProcessed <= 3) {
          console.log(`Sample user ${usersProcessed} createdAt:`, createdAt, 'startDate:', startDate, 'inRange:', createdAt && createdAt >= startDate);
        }
        
        if (createdAt && createdAt >= startDate && createdAt <= endDate) {
          usersInRange++;
          const dateKey = createdAt.toISOString().split('T')[0];
          const aggKey = getAggregationKey(dateKey, aggLevel);
          dataMap.set(aggKey, (dataMap.get(aggKey) || 0) + 1);
        }
      });
      
      console.log(`✅ Processed ${usersProcessed} users, ${usersInRange} in date range`);
      console.log(`📊 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      console.log(`📊 DataMap has ${dataMap.size} entries`);
      if (dataMap.size > 0) {
        const entries = Array.from(dataMap.entries()).slice(0, 3);
        console.log(`📊 First 3 entries:`, entries);
      }

      // Build non-cumulative result so each bucket represents only that
      // day's/week's/month's registrations.
      const result: ReportData[] = [];
      allDates.forEach((dateKey) => {
        result.push({
          date: createDateFromString(dateKey),
          count: dataMap.get(dateKey) || 0,
        });
      });

      console.log(`✅ Returning ${result.length} data points for users`);
      console.log(`📊 DataMap entries (first 5):`, Array.from(dataMap.entries()).slice(0, 5));
      console.log(`📊 First 3 results:`, result.slice(0, 3).map(r => ({ date: r.date.toISOString(), count: r.count, isValidDate: !isNaN(r.date.getTime()) })));
      console.log(`📊 Last 3 results:`, result.slice(-3).map(r => ({ date: r.date.toISOString(), count: r.count, isValidDate: !isNaN(r.date.getTime()) })));
      return result;
    } else if (type === "donations") {
      // Get donation submissions over time from donationContracts.
      // Use approved/active only to align with financial reporting.
      const donationsRef = collection(db, "donationContracts");
      const snapshot = await getDocs(donationsRef);

      const dataMap = new Map<string, number>();

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        let createdAt: Date | null = null;

        if (data.createdAt) {
          if (typeof data.createdAt.toDate === "function") {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
          } else if (typeof data.createdAt === "string") {
            createdAt = new Date(data.createdAt);
          }
        }

        const status = (data.status || "").toString().toLowerCase();
        const isIncludedStatus = status === "approved" || status === "active";
        const donationAmount = Number(data.donationAmount || 0);

        if (
          createdAt &&
          createdAt >= startDate &&
          createdAt <= endDate &&
          isIncludedStatus &&
          Number.isFinite(donationAmount)
        ) {
          const dateKey = createdAt.toISOString().split("T")[0];
          const aggKey = getAggregationKey(dateKey, aggLevel);
          dataMap.set(aggKey, (dataMap.get(aggKey) || 0) + donationAmount);
        }
      });

      // Build non-cumulative result so each bucket represents only that day's/week's/month's donations.
      const result: ReportData[] = [];
      allDates.forEach((dateKey) => {
        result.push({
          date: createDateFromString(dateKey),
          amount: dataMap.get(dateKey) || 0,
        });
      });

      return result;
    } else if (type === "assets") {
      // Get total assets over time
      const usersRef = collection(db, "members");
      const snapshot = await getDocs(usersRef);
      
      const dataMap = new Map<string, number>();
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        let createdAt: Date | null = null;
        
        // Handle different date formats
        if (data.createdAt) {
          if (typeof data.createdAt.toDate === 'function') {
            createdAt = data.createdAt.toDate();
          } else if (data.createdAt instanceof Date) {
            createdAt = data.createdAt;
          } else if (typeof data.createdAt === 'string') {
            createdAt = new Date(data.createdAt);
          }
        }
        
        const totalAsset = data.totalAsset || 0;
        
        if (createdAt && createdAt >= startDate && createdAt <= now) {
          const dateKey = createdAt.toISOString().split('T')[0];
          const aggKey = getAggregationKey(dateKey, aggLevel);
          dataMap.set(aggKey, (dataMap.get(aggKey) || 0) + totalAsset);
        }
      });

      // Build result with aggregated date range
      const result: ReportData[] = [];
      let cumulativeAmount = 0;
      
      allDates.forEach((dateKey) => {
        cumulativeAmount += dataMap.get(dateKey) || 0;
        result.push({
          date: createDateFromString(dateKey),
          amount: cumulativeAmount,
        });
      });

      return result;
    } else {
      // Get total rewards claimed over time
      const rewardsRef = collection(db, "rewardClaims");
      const snapshot = await getDocs(rewardsRef);
      
      const dataMap = new Map<string, number>();
      
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        let claimedAt: Date | null = null;
        
        // Handle different date formats
        if (data.claimedAt) {
          if (typeof data.claimedAt.toDate === 'function') {
            claimedAt = data.claimedAt.toDate();
          } else if (data.claimedAt instanceof Date) {
            claimedAt = data.claimedAt;
          } else if (typeof data.claimedAt === 'string') {
            claimedAt = new Date(data.claimedAt);
          }
        }
        
        const claimAmount = data.claimAmount || 0;
        
        if (claimedAt && claimedAt >= startDate && claimedAt <= now) {
          const dateKey = claimedAt.toISOString().split('T')[0];
          const aggKey = getAggregationKey(dateKey, aggLevel);
          dataMap.set(aggKey, (dataMap.get(aggKey) || 0) + claimAmount);
        }
      });

      // Build result with aggregated date range
      const result: ReportData[] = [];
      let cumulativeAmount = 0;
      
      allDates.forEach((dateKey) => {
        cumulativeAmount += dataMap.get(dateKey) || 0;
        result.push({
          date: createDateFromString(dateKey),
          amount: cumulativeAmount,
        });
      });

      return result;
    }
  } catch (error) {
    console.error("Error fetching report analytics:", error);
    return [];
  }
};

// Real-time listener for users/members
export const subscribeToUsers = (callback: (users: User[]) => void) => {
  const usersRef = collection(db, "members");
  
  const unsubscribe = onSnapshot(usersRef, (snapshot) => {
    const users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      const manualData = data.kycManualData || {};
      const normalizedKycManualData = {
        ...manualData,
        idNumber:
          manualData.idNumber ||
          manualData.identificationNumber ||
          data.idNumber ||
          data.kycIdNumber ||
          data.validIdNumber ||
          undefined,
        identificationType:
          manualData.identificationType ||
          manualData.idType ||
          data.identificationType ||
          data.idType ||
          undefined,
      };

      return {
        id: doc.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        address: data.address || "",
        donationAmount: data.donationAmount || 0,
        totalAsset: data.totalAsset || 0,
        createdAt: toIsoString(data.createdAt),
        kycStatus: data.kycStatus || "NOT_SUBMITTED",
        kycSubmittedAt: data.kycSubmittedAt || undefined,
        kycRejectionReason: data.kycRejectionReason || undefined,
        kycManualData: normalizedKycManualData,
        kycImageUrl: data.kycImageUrl || undefined,
        name: data.name || undefined,
        role: data.role || undefined,
        status: data.status || undefined,
        uid: data.uid || undefined,
        leaderId: data.leaderId || undefined,
        leaderName: data.leaderName || undefined,
        platformCode: data.platformCode || undefined,
        platformCodeId: data.platformCodeId || undefined,
      };
    });
    callback(users);
  }, (error) => {
    console.error("Error listening to users:", error);
    callback([]);
  });
  
  return unsubscribe;
};

// Share a user profile from one admin role to the other role for validation
export const shareUserWithOtherAdmin = async (
  user: User,
  fromAdminType: AdminType,
  note?: string
): Promise<boolean> => {
  try {
    const latestUser = await getLatestUserSnapshotForShare(user);
    const fromAdminId = auth.currentUser?.uid;
    if (!fromAdminId) {
      throw new Error("Admin is not authenticated");
    }

    const toAdminType: AdminType = fromAdminType === "developer" ? "finance" : "developer";

    await addDoc(collection(db, "adminUserShares"), {
      userId: latestUser.id,
      fromAdminId,
      fromAdminType,
      toAdminType,
      note: note || "",
      status: "shared",
      createdAt: new Date().toISOString(),
      userSnapshot: {
        id: latestUser.id,
        firstName: latestUser.firstName || "",
        lastName: latestUser.lastName || "",
        phoneNumber: latestUser.phoneNumber || "",
        email: latestUser.email || "",
        address: latestUser.address || "",
        donationAmount: latestUser.donationAmount || 0,
        totalAsset: latestUser.totalAsset || 0,
        createdAt: latestUser.createdAt || new Date().toISOString(),
        kycStatus: latestUser.kycStatus || "NOT_SUBMITTED",
      },
    });

    return true;
  } catch (error) {
    console.error("Error sharing user profile:", error);
    return false;
  }
};

// Realtime listener for user profiles shared to a specific admin role
export const subscribeToSharedUsers = (
  adminType: AdminType,
  callback: (shares: AdminUserShare[]) => void
) => {
  const sharesRef = collection(db, "adminUserShares");
  const q = query(sharesRef, where("toAdminType", "==", adminType));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const shares: AdminUserShare[] = snapshot.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            userId: data.userId || "",
            fromAdminId: data.fromAdminId || "",
            fromAdminType: ((data.fromAdminType === "main" ? "developer" : data.fromAdminType) || "developer") as AdminType,
            toAdminType: (data.toAdminType || "finance") as AdminType,
            note: data.note || "",
            status: data.status || "shared",
            createdAt: data.createdAt || new Date().toISOString(),
            userSnapshot: {
              id: data.userSnapshot?.id || data.userId || "",
              firstName: data.userSnapshot?.firstName || "",
              lastName: data.userSnapshot?.lastName || "",
              phoneNumber: data.userSnapshot?.phoneNumber || "",
              email: data.userSnapshot?.email || "",
              address: data.userSnapshot?.address || "",
              donationAmount: data.userSnapshot?.donationAmount || 0,
              totalAsset: data.userSnapshot?.totalAsset || 0,
              createdAt: data.userSnapshot?.createdAt || new Date().toISOString(),
              kycStatus: data.userSnapshot?.kycStatus || "NOT_SUBMITTED",
            },
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      callback(shares);
    },
    (error) => {
      console.error("Error listening to shared user profiles:", error);
      callback([]);
    }
  );

  return unsubscribe;
};

// Send a structured "shared user" message to admin chat so it appears in Chat page
export const shareUserToAdminChat = async (
  user: User,
  fromAdminType: AdminType,
  note?: string
): Promise<boolean> => {
  try {
    const latestUser = await getLatestUserSnapshotForShare(user);
    const fromAdminId = auth.currentUser?.uid;
    if (!fromAdminId) {
      throw new Error("Admin is not authenticated");
    }

    const toAdminType: AdminType = fromAdminType === "developer" ? "finance" : "developer";
    const senderName = fromAdminType === "developer" ? "Developer Admin" : "Finance Admin";

    const lines = [
      `USER PROFILE SHARED TO ${toAdminType.toUpperCase()} ADMIN`,
      `Name: ${latestUser.firstName || ""} ${latestUser.lastName || ""}`,
      `Email: ${latestUser.email || ""}`,
      `Phone: ${latestUser.phoneNumber || "N/A"}`,
      `Address: ${latestUser.address || "N/A"}`,
      `Donation: ₱${(latestUser.donationAmount || 0).toLocaleString()}`,
      `Total Asset: ₱${(latestUser.totalAsset || 0).toLocaleString()}`,
      `KYC: ${latestUser.kycStatus || "NOT_SUBMITTED"}`,
    ];

    if (note?.trim()) {
      lines.push(`Validation Note: ${note.trim()}`);
    }

    await addDoc(collection(db, "chat"), {
      senderId: fromAdminId,
      senderName,
      senderType: fromAdminType,
      message: lines.join("\n"),
      timestamp: serverTimestamp(),
      read: false,
      attachments: [],
      shareMeta: {
        type: "user_profile_share",
        toAdminType,
        userId: latestUser.id,
        userEmail: latestUser.email,
        note: note?.trim() || "",
        userSnapshot: {
          firstName: latestUser.firstName || "",
          lastName: latestUser.lastName || "",
          phoneNumber: latestUser.phoneNumber || "",
          address: latestUser.address || "",
          donationAmount: latestUser.donationAmount || 0,
          totalAsset: latestUser.totalAsset || 0,
          kycStatus: latestUser.kycStatus || "NOT_SUBMITTED",
        },
      },
    });

    return true;
  } catch (error) {
    console.error("Error sending shared user profile to chat:", error);
    return false;
  }
};

// Real-time listener for withdrawals from payout_queue
export const subscribeToWithdrawals = (callback: (withdrawals: Withdrawal[]) => void) => {
  const withdrawalsRef = collection(db, "payout_queue");
  const q = query(withdrawalsRef, orderBy("requestedAt", "desc"));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const withdrawals: Withdrawal[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || "",
        userName: data.userName || "",
        userEmail: data.userEmail || "",
        userPhone: data.userPhone || "",
        amount: data.amount || 0,
        status: data.status || "pending",
        requestedAt: data.requestedAt || new Date().toISOString(),
        processedAt: data.processedAt || null,
        processedBy: data.processedBy || null,
        contractId: data.contractId || "",
        gcashNumber: data.gcashNumber || "",
        isPooled: data.isPooled || false,
        notes: data.notes || "",
        paymentMethod: data.paymentMethod || "",
        periodsWithdrawn: data.periodsWithdrawn || 0,
        totalWithdrawals: data.totalWithdrawals || 0,
        transactionProof: data.transactionProof || null,
        withdrawalNumber: data.withdrawalNumber || 0,
        financeNote: data.financeNote || "",
        mainAdminNote: data.mainAdminNote || "",
        // Additional fields from payout_queue collection
        actualAmountWithdrawn: data.actualAmountWithdrawn || 0,
        grossAmount: data.grossAmount || 0,
        netAmount: data.netAmount || 0,
        platformFee: data.platformFee || 0,
        remainingBalance: data.remainingBalance || 0,
        totalWithdrawnSoFar: data.totalWithdrawnSoFar || 0,
        withdrawalSessionId: data.withdrawalSessionId || "",
        // New field for correct withdrawable balance calculation
        totalWithdrawableBalance: data.totalWithdrawableBalance || 0,
      };
    });
    callback(withdrawals);
  }, (error) => {
    console.error("Error listening to withdrawals:", error);
    callback([]);
  });
  
  return unsubscribe;
};

// Fetch all members/users (one-time)
export const fetchUsers = async (): Promise<User[]> => {
  try {
    const usersRef = collection(db, "members");
    const snapshot = await getDocs(usersRef);
    
    const users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        address: data.address || "",
      donationAmount: data.donationAmount || 0,
        totalAsset: data.totalAsset || 0,
        createdAt: toIsoString(data.createdAt),
        kycStatus: data.kycStatus || "NOT_SUBMITTED",
        kycRejectionReason: data.kycRejectionReason || undefined,
        role: data.role || undefined,
        status: data.status || undefined,
        uid: data.uid || undefined,
        leaderId: data.leaderId || undefined,
        leaderName: data.leaderName || undefined,
        platformCode: data.platformCode || undefined,
        platformCodeId: data.platformCodeId || undefined,
      };
    });
    
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
};

// Fetch a single user by ID
export const fetchUserById = async (userId: string): Promise<User | null> => {
  try {
    const userDoc = await getDoc(doc(db, "members", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        id: userDoc.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        address: data.address || "",
        donationAmount: data.donationAmount || 0,
        totalAsset: data.totalAsset || 0,
        createdAt: toIsoString(data.createdAt),
        kycStatus: data.kycStatus || "NOT_SUBMITTED",
        kycRejectionReason: data.kycRejectionReason || undefined,
        role: data.role || undefined,
        status: data.status || undefined,
        uid: data.uid || undefined,
        leaderId: data.leaderId || undefined,
        leaderName: data.leaderName || undefined,
        platformCode: data.platformCode || undefined,
        platformCodeId: data.platformCodeId || undefined,
      };
    }
    return null;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
};

// Fetch all withdrawals from payout_queue
export const fetchWithdrawals = async (): Promise<Withdrawal[]> => {
  try {
    const withdrawalsRef = collection(db, "payout_queue");
    const snapshot = await getDocs(query(withdrawalsRef, orderBy("requestedAt", "desc")));
    
    const withdrawals: Withdrawal[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || "",
        userName: data.userName || "",
        userEmail: data.userEmail || "",
        userPhone: data.userPhone || "",
        amount: data.amount || 0,
        status: data.status || "pending",
        requestedAt: data.requestedAt || new Date().toISOString(),
        processedAt: data.processedAt || null,
        processedBy: data.processedBy || null,
        contractId: data.contractId || "",
        gcashNumber: data.gcashNumber || "",
        isPooled: data.isPooled || false,
        notes: data.notes || "",
        paymentMethod: data.paymentMethod || "",
        periodsWithdrawn: data.periodsWithdrawn || 0,
        totalWithdrawals: data.totalWithdrawals || 0,
        transactionProof: data.transactionProof || null,
        withdrawalNumber: data.withdrawalNumber || 0,
      };
    });
    
    return withdrawals;
  } catch (error) {
    console.error("Error fetching withdrawals:", error);
    return [];
  }
};

// Update withdrawal status in payout_queue
export const updateWithdrawalStatus = async (
  withdrawalId: string,
  status: "pending" | "sent" | "approved" | "rejected" | "returned",
  processedBy?: string,
  note?: string
): Promise<boolean> => {
  try {
    const withdrawalRef = doc(db, "payout_queue", withdrawalId);
    const updateData: any = {
      status,
      processedAt: new Date().toISOString(),
      processedBy: processedBy || "",
    };
    if (status === "rejected") {
      updateData.financeNote = note || "";
    }
    if (status === "returned") {
      updateData.mainAdminNote = note || "";
    }
    await updateDoc(withdrawalRef, updateData);
    return true;
  } catch (error) {
    console.error("Error updating withdrawal:", error);
    return false;
  }
};

// Real-time listener for ODHex withdrawals
export const subscribeToODHexWithdrawals = (callback: (withdrawals: import("@/types/admin").ODHexWithdrawal[]) => void) => {
  const withdrawalsRef = collection(db, "odhexWithdrawals");
  const q = query(withdrawalsRef, orderBy("requestedAt", "desc"));
  
  let retryCount = 0;
  const maxRetries = 3;
  
  const unsubscribe = onSnapshot(
    q, 
    {
      // Add includeMetadataChanges to handle connection state better
      includeMetadataChanges: false
    },
    async (snapshot) => {
      retryCount = 0; // Reset retry count on successful connection
      const withdrawals = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();

          let leaderId = data.leaderId || "";
          let leaderName = data.leaderName || "";

          if (data.userId || data.userEmail) {
            try {
              let userData: Record<string, any> | null = null;

              if (data.userId) {
                const userDoc = await getDoc(doc(db, "members", data.userId));
                if (userDoc.exists()) {
                  userData = userDoc.data();
                }
              }

              if (!userData && data.userId) {
                const byUidSnapshot = await getDocs(
                  query(collection(db, "members"), where("uid", "==", data.userId))
                );
                if (!byUidSnapshot.empty) {
                  userData = byUidSnapshot.docs[0].data() as Record<string, any>;
                }
              }

              if (!userData && data.userEmail) {
                const byEmailSnapshot = await getDocs(
                  query(collection(db, "members"), where("email", "==", data.userEmail))
                );
                if (!byEmailSnapshot.empty) {
                  userData = byEmailSnapshot.docs[0].data() as Record<string, any>;
                }
              }

              if (userData) {
                leaderId = userData.leaderId || leaderId;
                leaderName = userData.leaderName || leaderName;
              }
            } catch (memberError) {
              console.error("Error fetching member leader info for ODHex withdrawal:", memberError);
            }
          }

          return {
            id: docSnapshot.id,
            userId: data.userId || "",
            userEmail: data.userEmail || "",
            leaderId: leaderId || undefined,
            leaderName: leaderName || undefined,
            amount: data.amount || 0,
            method: data.method || "ewallet",
            provider: data.provider || "",
            accountDetails: data.accountDetails || "",
            status: data.status || "pending",
            requestedAt: data.requestedAt || new Date().toISOString(),
            processedAt: data.processedAt || null,
            processedBy: data.processedBy || null,
            rejectionReason: data.rejectionReason || "",
            refundApplied: data.refundApplied === true,
            refundAppliedAt: data.refundAppliedAt || null,
            refundAmount: Number(data.refundAmount || 0),
            refundTargetMemberId: data.refundTargetMemberId || "",
          } as import("@/types/admin").ODHexWithdrawal;
        })
      );
      callback(withdrawals);
    }, 
    (error) => {
      retryCount++;
      console.error(`Error listening to ODHex withdrawals (attempt ${retryCount}/${maxRetries}):`, error);
      
      // Return empty array but don't prevent retries
      if (retryCount >= maxRetries) {
        console.warn("Max retries reached for ODHex withdrawals listener. Returning empty data.");
      }
      callback([]);
    }
  );
  
  return unsubscribe;
};

// Update ODHex withdrawal status
const resolveODHexMemberRef = async (
  userId?: string,
  userEmail?: string
) => {
  if (userId) {
    const byODHexMembersDocIdRef = doc(db, "ODHexMembers", userId);
    const byODHexMembersDocIdSnap = await getDoc(byODHexMembersDocIdRef);
    if (byODHexMembersDocIdSnap.exists()) {
      return byODHexMembersDocIdRef;
    }

    const byMembersDocIdRef = doc(db, "members", userId);
    const byMembersDocIdSnap = await getDoc(byMembersDocIdRef);
    if (byMembersDocIdSnap.exists()) {
      return byMembersDocIdRef;
    }

    const odhexMembersByUid = await getDocs(
      query(collection(db, "ODHexMembers"), where("uid", "==", userId))
    );
    if (!odhexMembersByUid.empty) {
      return odhexMembersByUid.docs[0].ref;
    }

    const membersByUid = await getDocs(
      query(collection(db, "members"), where("uid", "==", userId))
    );
    if (!membersByUid.empty) {
      return membersByUid.docs[0].ref;
    }
  }

  if (userEmail) {
    const odhexMembersByEmail = await getDocs(
      query(collection(db, "ODHexMembers"), where("email", "==", userEmail))
    );
    if (!odhexMembersByEmail.empty) {
      return odhexMembersByEmail.docs[0].ref;
    }

    const membersByEmail = await getDocs(
      query(collection(db, "members"), where("email", "==", userEmail))
    );
    if (!membersByEmail.empty) {
      return membersByEmail.docs[0].ref;
    }
  }

  return null;
};

export const updateODHexWithdrawalStatus = async (
  withdrawalId: string,
  status: "pending" | "completed" | "rejected",
  processedBy?: string,
  rejectionReason?: string
): Promise<boolean> => {
  try {
    const withdrawalRef = doc(db, "odhexWithdrawals", withdrawalId);

    // Simple update path for non-rejected statuses
    if (status !== "rejected") {
      await updateDoc(withdrawalRef, {
        status,
        processedAt: new Date().toISOString(),
        processedBy: processedBy || "",
      });
      return true;
    }

    // Rejection path: update status + refund amount back to member vaultBalance atomically
    const initialWithdrawalSnap = await getDoc(withdrawalRef);
    if (!initialWithdrawalSnap.exists()) {
      throw new Error("ODHex withdrawal not found");
    }

    const initialWithdrawalData = initialWithdrawalSnap.data();
    const memberRef = await resolveODHexMemberRef(
      initialWithdrawalData.userId,
      initialWithdrawalData.userEmail
    );

    if (!memberRef) {
      throw new Error("Unable to find member document for vault balance refund");
    }

    const normalizedReason =
      rejectionReason?.trim() || "Withdrawal rejected by finance admin.";
    const nowIso = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      const latestWithdrawalSnap = await transaction.get(withdrawalRef);
      if (!latestWithdrawalSnap.exists()) {
        throw new Error("ODHex withdrawal not found during transaction");
      }

      const latestWithdrawal = latestWithdrawalSnap.data() as Record<string, any>;
      const latestStatus = String(latestWithdrawal.status || "").toLowerCase();

      const baseUpdate = {
        status,
        processedAt: nowIso,
        processedBy: processedBy || "",
        rejectionReason: normalizedReason,
      };

      // Guard against duplicate refunds
      if (latestStatus === "rejected" && latestWithdrawal.refundApplied === true) {
        transaction.update(withdrawalRef, baseUpdate);
        return;
      }

      const refundAmount = Number(latestWithdrawal.amount || 0);
      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new Error("Invalid ODHex withdrawal amount for refund");
      }

      const memberSnap = await transaction.get(memberRef);
      if (!memberSnap.exists()) {
        throw new Error("Member document not found during refund transaction");
      }

      const memberData = memberSnap.data() as Record<string, any>;
      const currentVaultBalance = Number(memberData.vaultBalance || 0);
      const nextVaultBalance = currentVaultBalance + refundAmount;

      transaction.update(memberRef, {
        vaultBalance: nextVaultBalance,
        lastRefundAt: nowIso,
      });

      transaction.update(withdrawalRef, {
        ...baseUpdate,
        refundApplied: true,
        refundAppliedAt: nowIso,
        refundAmount,
        refundTargetMemberId: memberRef.id,
        refundField: "vaultBalance",
      });
    });

    return true;
  } catch (error) {
    console.error("Error updating ODHex withdrawal:", error);
    return false;
  }
};

// Get statistics for dashboard
export const fetchDashboardStats = async () => {
  try {
    const usersSnapshot = await getDocs(collection(db, "members"));
    const withdrawalsSnapshot = await getDocs(collection(db, "payout_queue"));
    
    const totalUsers = usersSnapshot.size;
    let totalDonations = 0;
    let totalAssets = 0;
    
    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalDonations += data.donationAmount || 0;
      totalAssets += data.totalAsset || 0;
    });
    
    const pendingWithdrawals = withdrawalsSnapshot.docs.filter(
      (doc) => doc.data().status === "pending"
    ).length;
    
    return {
      totalUsers,
      totalDonations,
      totalAssets,
      pendingWithdrawals,
    };
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return {
      totalUsers: 0,
      totalDonations: 0,
      totalAssets: 0,
      pendingWithdrawals: 0,
    };
  }
};

// Real-time listener for donations
export const subscribeToDonations = (callback: (donations: Donation[]) => void) => {
  // Try "donationContracts" collection first (based on Firebase rules)
  const donationsRef = collection(db, "donationContracts");
  // Remove orderBy temporarily to see if that's causing the issue
  const q = query(donationsRef);
  
  console.log("Subscribing to donationContracts collection...");
  
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    console.log(`Found ${snapshot.docs.length} donation documents`);
    
    const donationsPromises = snapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();
      console.log("Donation document:", docSnapshot.id, data);
      
      // Fetch user info
      let userName = "Unknown";
      let userEmail = "";
      let userPhone = "";
      
      if (data.userId) {
        try {
          const userDoc = await getDoc(doc(db, "members", data.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userName = `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Unknown";
            userEmail = userData.email || "";
            userPhone = userData.phoneNumber || "";
          }
        } catch (error) {
          console.error("Error fetching user info:", error);
        }
      }
      
      // Generate fresh download URL from receipt path if available
      let receiptURL = data.receiptURL || "";
      if (data.receiptPath) {
        try {
          const storageRef = ref(storage, data.receiptPath);
          receiptURL = await getDownloadURL(storageRef);
        } catch (error) {
          console.error("Error getting receipt download URL:", error);
          // Fall back to stored receiptURL if getDownloadURL fails
          receiptURL = data.receiptURL || "";
        }
      }
      
      return {
        id: docSnapshot.id,
        userId: data.userId || "",
        userName,
        userEmail,
        userPhone,
        donationAmount: data.donationAmount || 0,
        paymentMethod: data.paymentMethod || "",
        receiptPath: data.receiptPath || "",
        receiptURL,
        status: data.status || "pending",
        rejectionReason:
          data.rejectionReason ||
          data.rejectionNote ||
          data.rejectionNotes ||
          data.note ||
          "",
        createdAt: data.createdAt || new Date().toISOString(),
        approvedAt: data.approvedAt || null,
        approvedBy: data.approvedBy || null,
        contractEndDate: data.contractEndDate || null,
        donationStartDate: data.donationStartDate || null,
        lastWithdrawalDate: data.lastWithdrawalDate || null,
        withdrawalsCount: data.withdrawalsCount || 0,
      };
    });
    
    const donations = await Promise.all(donationsPromises);
    callback(donations);
  }, (error) => {
    console.error("Error listening to donations:", error);
    callback([]);
  });
  
  return unsubscribe;
};

// Update donation status
export const updateDonationStatus = async (
  donationId: string,
  status: "approved" | "rejected",
  rejectionReason?: string
): Promise<void> => {
  try {
    const donationRef = doc(db, "donationContracts", donationId);
    
    // Get the donation data first
    const donationDoc = await getDoc(donationRef);
    if (!donationDoc.exists()) {
      throw new Error("Donation not found");
    }
    
    const donationData = donationDoc.data();
    
    const updateData: any = {
      status,
    };

    if (status === "rejected") {
      const trimmedReason = rejectionReason?.trim() || "";
      if (!trimmedReason) {
        throw new Error("Rejection reason is required");
      }
      updateData.rejectionReason = trimmedReason;
    }

    // If approved, set approval metadata
    if (status === "approved") {
      const now = new Date();
      updateData.approvedAt = now.toISOString();
      updateData.donationStartDate = now.toISOString();
      updateData.rejectionReason = "";
      
      // Calculate contract end date (30 days from now)
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 365);
      updateData.contractEndDate = endDate.toISOString();
    }
    
    // Update donation status
    await updateDoc(donationRef, updateData);
    
    // If approved, update user's donationAmount
    if (status === "approved" && donationData.userId && donationData.donationAmount) {
      const userRef = doc(db, "members", donationData.userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentDonationAmount = userData.donationAmount || 0;
        const newDonationAmount = currentDonationAmount + donationData.donationAmount;
        
        console.log(`Updating user ${donationData.userId} donation: ${currentDonationAmount} + ${donationData.donationAmount} = ${newDonationAmount}`);
        
        await updateDoc(userRef, {
          donationAmount: newDonationAmount,
        });
      }
    }
  } catch (error) {
    console.error("Error updating donation status:", error);
    throw error;
  }
};

// Real-time listener for KYC applications
export const subscribeToKYC = (callback: (users: User[]) => void) => {
  const usersRef = collection(db, "members");
  const q = query(usersRef);
  
  console.log("Subscribing to KYC applications...");
  
  const unsubscribe = onSnapshot(q, async (snapshot) => {
    console.log(`Found ${snapshot.docs.length} user documents`);
    
    const usersPromises = snapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();
      const manualData = data.kycManualData || {};
      const normalizedKycManualData = {
        ...manualData,
        idNumber:
          manualData.idNumber ||
          manualData.identificationNumber ||
          data.idNumber ||
          data.kycIdNumber ||
          data.validIdNumber ||
          undefined,
        identificationType:
          manualData.identificationType ||
          manualData.idType ||
          data.identificationType ||
          data.idType ||
          undefined,
      };
      
      // Get KYC image URL - check multiple possible field names
      let kycImageUrl = data.kycIdImageURL || data.kycImageUrl || data.validIdUrl || data.kycImage || undefined;
      
      // If we only have a path but not a full URL, try to get download URL from Storage
      if (!kycImageUrl && (data.kycIdImagePath || data.kycImagePath || data.validIdPath)) {
        try {
          const imagePath = data.kycIdImagePath || data.kycImagePath || data.validIdPath;
          const imageRef = ref(storage, imagePath);
          kycImageUrl = await getDownloadURL(imageRef);
          console.log("✅ Got KYC image URL from Storage path:", kycImageUrl);
        } catch (error) {
          console.log("⚠️ Could not fetch KYC image from Storage:", error);
        }
      }
      
      if (kycImageUrl) {
        console.log("📷 KYC Image found for user:", data.name || data.firstName, "- URL:", kycImageUrl);
      }
      
      return {
        id: docSnapshot.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        name: data.name || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        address: data.address || "",
        donationAmount: data.donationAmount || 0,
        totalAsset: data.totalAsset || 0,
        createdAt: data.createdAt || new Date().toISOString(),
        kycStatus: data.kycStatus || undefined,
        kycSubmittedAt: data.kycSubmittedAt || undefined,
        kycRejectionReason: data.kycRejectionReason || undefined,
        leaderId: data.leaderId || undefined,
        leaderName: data.leaderName || undefined,
        platformCode: data.platformCode || undefined,
        platformCodeId: data.platformCodeId || undefined,
        kycManualData: normalizedKycManualData,
        kycImageUrl: kycImageUrl,
      };
    });
    
    const users = await Promise.all(usersPromises);
    callback(users);
  }, (error) => {
    console.error("Error listening to KYC applications:", error);
    callback([]);
  });
  
  return unsubscribe;
};

// Update KYC status
export const updateKYCStatus = async (
  userId: string,
  status: "APPROVED" | "REJECTED",
  rejectionReason?: string
): Promise<void> => {
  try {
    const userRef = doc(db, "members", userId);

    await updateDoc(userRef, {
      kycStatus: status,
      kycProcessedAt: new Date().toISOString(),
      kycRejectionReason:
        status === "REJECTED" ? (rejectionReason?.trim() || "") : "",
    });
  } catch (error) {
    console.error("Error updating KYC status:", error);
    throw error;
  }
};

export const subscribeToPlatformCodes = (callback: (codes: PlatformCode[]) => void) => {
  const codesRef = collection(db, "platformCodes");
  const q = query(codesRef);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const codes = snapshot.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            code: data.code || docSnapshot.id,
            description: data.description || "",
            leaderId: data.leaderId || "",
            leaderName: data.leaderName || "",
            isActive: typeof data.isActive === "boolean" ? data.isActive : true,
            usageCount: data.usageCount || 0,
            maxUses: typeof data.maxUses === "number" ? data.maxUses : null,
            createdAt: toIsoString(data.createdAt),
          } satisfies PlatformCode;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      callback(codes);
    },
    (error) => {
      console.error("Error listening to platform codes:", error);
      callback([]);
    }
  );

  return unsubscribe;
};

export const createPlatformCode = async (payload: {
  code: string;
  description: string;
  leaderId: string;
  leaderName: string;
  maxUses?: number | null;
}): Promise<void> => {
  const normalizedCode = payload.code.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error("Code is required");
  }

  const docRef = doc(db, "platformCodes", normalizedCode);
  const existing = await getDoc(docRef);
  if (existing.exists()) {
    throw new Error("Platform code already exists");
  }

  await setDoc(docRef, {
    code: normalizedCode,
    description: payload.description.trim(),
    leaderId: payload.leaderId.trim(),
    leaderName: payload.leaderName.trim(),
    usageCount: 0,
    maxUses: typeof payload.maxUses === "number" ? payload.maxUses : null,
    isActive: true,
    createdAt: serverTimestamp(),
  });
};

export const updatePlatformCodeStatus = async (codeId: string, isActive: boolean): Promise<void> => {
  const codeRef = doc(db, "platformCodes", codeId);
  await updateDoc(codeRef, {
    isActive,
    updatedAt: serverTimestamp(),
  });
};

export const updatePlatformCode = async (
  codeId: string,
  payload: {
    description: string;
    leaderId: string;
    leaderName: string;
    maxUses: number | null;
    isActive: boolean;
  }
): Promise<void> => {
  const codeRef = doc(db, "platformCodes", codeId);
  await updateDoc(codeRef, {
    description: payload.description.trim(),
    leaderId: payload.leaderId.trim(),
    leaderName: payload.leaderName.trim(),
    maxUses: payload.maxUses,
    isActive: payload.isActive,
    updatedAt: serverTimestamp(),
  });
};

export const deletePlatformCode = async (codeId: string): Promise<void> => {
  const codeRef = doc(db, "platformCodes", codeId);
  await deleteDoc(codeRef);
};

export const subscribeToLeaders = (callback: (leaders: Leader[]) => void) => {
  const leadersRef = collection(db, "leaders");
  const q = query(leadersRef);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const leaders = snapshot.docs
        .map((docSnapshot) => {
          const data = docSnapshot.data();
          return {
            id: docSnapshot.id,
            name: data.name || "",
            codeName: data.codeName || "",
            isActive: typeof data.isActive === "boolean" ? data.isActive : true,
            createdAt: toIsoString(data.createdAt),
          } satisfies Leader;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      callback(leaders);
    },
    (error) => {
      console.error("Error listening to leaders:", error);
      callback([]);
    }
  );

  return unsubscribe;
};

export const createLeader = async (payload: { name: string; codeName: string }): Promise<void> => {
  const normalizedCodeName = payload.codeName.trim();
  const normalizedName = payload.name.trim();

  if (!normalizedName) {
    throw new Error("Leader name is required");
  }

  if (!normalizedCodeName) {
    throw new Error("Leader code name is required");
  }

  const leaderRef = doc(db, "leaders", normalizedCodeName);
  const existing = await getDoc(leaderRef);
  if (existing.exists()) {
    throw new Error("Leader already exists");
  }

  await setDoc(leaderRef, {
    name: normalizedName,
    codeName: normalizedCodeName,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

export const updateLeader = async (
  leaderId: string,
  payload: { name: string; isActive: boolean }
): Promise<void> => {
  const normalizedName = payload.name.trim();
  if (!normalizedName) {
    throw new Error("Leader name is required");
  }

  const leaderRef = doc(db, "leaders", leaderId);
  await updateDoc(leaderRef, {
    name: normalizedName,
    isActive: payload.isActive,
    updatedAt: serverTimestamp(),
  });
};

export const deleteLeader = async (leaderId: string): Promise<void> => {
  const leaderRef = doc(db, "leaders", leaderId);
  await deleteDoc(leaderRef);
};

export const createNewsPost = async (payload: {
  title: string;
  category: string;
  details: string;
  postedAt: string;
  imageFile: File;
}): Promise<void> => {
  const normalizedTitle = payload.title.trim();
  const normalizedCategory = payload.category.trim();
  const normalizedDetails = payload.details.trim();

  if (!normalizedTitle) {
    throw new Error("News title is required");
  }

  if (!normalizedCategory) {
    throw new Error("Category is required");
  }

  if (!normalizedDetails) {
    throw new Error("Details are required");
  }

  if (!payload.imageFile) {
    throw new Error("Image is required");
  }

  const postedDate = new Date(payload.postedAt);
  if (Number.isNaN(postedDate.getTime())) {
    throw new Error("Invalid posted date and time");
  }

  const safeFileName = payload.imageFile.name.replace(/\s+/g, "-");
  const imagePath = `news/${Date.now()}-${safeFileName}`;
  const imageRef = ref(storage, imagePath);

  await uploadBytes(imageRef, payload.imageFile);
  const imageUrl = await getDownloadURL(imageRef);

  await addDoc(collection(db, "news"), {
    title: normalizedTitle,
    imageUrl,
    imagePath,
    category: normalizedCategory,
    details: normalizedDetails,
    postedAt: postedDate.toISOString(),
    createdAt: serverTimestamp(),
    createdBy: auth.currentUser?.uid || "",
  });
};

export const subscribeToNewsPosts = (callback: (posts: NewsPost[]) => void) => {
  const newsRef = collection(db, "news");
  const newsQuery = query(newsRef, orderBy("postedAt", "desc"));

  const unsubscribe = onSnapshot(
    newsQuery,
    (snapshot) => {
      const posts = snapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          title: data.title || "",
          imageUrl: data.imageUrl || "",
          imagePath: data.imagePath || "",
          category: data.category || "",
          details: data.details || "",
          postedAt: toIsoString(data.postedAt),
          createdAt: toIsoString(data.createdAt),
          createdBy: data.createdBy || "",
        } satisfies NewsPost;
      });

      callback(posts);
    },
    (error) => {
      console.error("Error listening to news posts:", error);
      callback([]);
    }
  );

  return unsubscribe;
};

export const updateNewsPost = async (
  postId: string,
  payload: {
    title: string;
    category: string;
    details: string;
    postedAt: string;
    imageFile?: File | null;
    currentImagePath?: string;
  }
): Promise<void> => {
  const normalizedTitle = payload.title.trim();
  const normalizedCategory = payload.category.trim();
  const normalizedDetails = payload.details.trim();

  if (!normalizedTitle) {
    throw new Error("News title is required");
  }

  if (!normalizedCategory) {
    throw new Error("Category is required");
  }

  if (!normalizedDetails) {
    throw new Error("Details are required");
  }

  const postedDate = new Date(payload.postedAt);
  if (Number.isNaN(postedDate.getTime())) {
    throw new Error("Invalid posted date and time");
  }

  let imageUrl: string | undefined;
  let imagePath: string | undefined;

  if (payload.imageFile) {
    const safeFileName = payload.imageFile.name.replace(/\s+/g, "-");
    imagePath = `news/${Date.now()}-${safeFileName}`;
    const imageRef = ref(storage, imagePath);

    await uploadBytes(imageRef, payload.imageFile);
    imageUrl = await getDownloadURL(imageRef);

    if (payload.currentImagePath) {
      try {
        await deleteObject(ref(storage, payload.currentImagePath));
      } catch (error) {
        console.warn("Failed to delete previous news image:", error);
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    title: normalizedTitle,
    category: normalizedCategory,
    details: normalizedDetails,
    postedAt: postedDate.toISOString(),
    updatedAt: serverTimestamp(),
  };

  if (imageUrl && imagePath) {
    updatePayload.imageUrl = imageUrl;
    updatePayload.imagePath = imagePath;
  }

  await updateDoc(doc(db, "news", postId), updatePayload);
};

export const deleteNewsPost = async (postId: string, imagePath?: string): Promise<void> => {
  if (imagePath) {
    try {
      await deleteObject(ref(storage, imagePath));
    } catch (error) {
      console.warn("Failed to delete news image from storage:", error);
    }
  }

  await deleteDoc(doc(db, "news", postId));
};

export const subscribeToMaintenanceScheduler = (
  callback: (config: MaintenanceSchedulerConfig) => void
) => {
  const settingsRef = doc(db, "systemSettings", "maintenanceScheduler");

  const unsubscribe = onSnapshot(
    settingsRef,
    (snapshot) => {
      const data = snapshot.data() || {};
      callback({
        enabled: Boolean(data.enabled),
        startAt: typeof data.startAt === "string" ? data.startAt : "",
        endAt: typeof data.endAt === "string" ? data.endAt : "",
        durationHours: typeof data.durationHours === "number" && data.durationHours > 0 ? data.durationHours : 0,
        startInHours: typeof data.startInHours === "number" && data.startInHours > 0 ? data.startInHours : 0,
        startInMinutes: typeof data.startInMinutes === "number" && data.startInMinutes >= 0 ? data.startInMinutes : 0,
        message: typeof data.message === "string" ? data.message : "",
        timezone: typeof data.timezone === "string" ? data.timezone : "Asia/Manila",
        updatedAt: toIsoString(data.updatedAt),
        updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : "",
      });
    },
    (error) => {
      console.error("Error listening to maintenance scheduler:", error);
      callback({
        enabled: false,
        startAt: "",
        endAt: "",
        durationHours: 0,
        startInHours: 0,
        startInMinutes: 0,
        message: "",
        timezone: "Asia/Manila",
        updatedAt: new Date().toISOString(),
        updatedBy: "",
      });
    }
  );

  return unsubscribe;
};

export const saveMaintenanceScheduler = async (payload: {
  enabled: boolean;
  startAt: string;
  endAt: string;
  durationHours: number;
  startInHours?: number;
  startInMinutes?: number;
  message: string;
  timezone?: string;
}): Promise<void> => {
  const settingsRef = doc(db, "systemSettings", "maintenanceScheduler");

  await setDoc(
    settingsRef,
    {
      enabled: payload.enabled,
      startAt: payload.startAt,
      endAt: payload.endAt,
      durationHours: payload.durationHours,
      startInHours:
        typeof payload.startInHours === "number" && payload.startInHours > 0
          ? payload.startInHours
          : 0,
      startInMinutes:
        typeof payload.startInMinutes === "number" && payload.startInMinutes >= 0
          ? payload.startInMinutes
          : 0,
      message: payload.message.trim(),
      timezone: payload.timezone || "Asia/Manila",
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser?.uid || "",
    },
    { merge: true }
  );
};

// Create new user
export const createUser = async (
  userData: Omit<User, "id" | "createdAt">
): Promise<string> => {
  try {
    const password = (userData as any).password;
    if (password) {
      const createMemberAccount = httpsCallable(functions, "createMemberAccount");
      const result = await createMemberAccount({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phoneNumber: userData.phoneNumber,
        address: userData.address,
        password,
        donationAmount: userData.donationAmount || 0,
        totalAsset: userData.totalAsset || 0,
        kycStatus: userData.kycStatus || "NOT_SUBMITTED",
      });

      const createdUid = (result.data as any)?.uid;
      if (createdUid) {
        return createdUid;
      }
    }

    const membersRef = collection(db, "members");
    const nowIso = new Date().toISOString();
    const initialKycStatus = userData.kycStatus || "NOT_SUBMITTED";

    const docRef = await addDoc(membersRef, {
      ...userData,
      uid: (userData as any).uid || "",
      createdAt: nowIso,
      updatedAt: nowIso,
      kycStatus: initialKycStatus,
      ...(initialKycStatus === "APPROVED" || initialKycStatus === "REJECTED"
        ? { kycProcessedAt: nowIso }
        : {}),
    });

    // Ensure uid exists for downstream mobile lookups when admin creates records
    await updateDoc(docRef, {
      uid: (userData as any).uid || docRef.id,
    });

    return docRef.id;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

// Update user
export const updateUser = async (
  userId: string,
  userData: Partial<Omit<User, "id" | "createdAt">>
): Promise<void> => {
  try {
    const userRef = doc(db, "members", userId);
    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      ...userData,
      updatedAt: nowIso,
    };

    if (userData.kycStatus === "APPROVED" || userData.kycStatus === "REJECTED") {
      updatePayload.kycProcessedAt = nowIso;
    }

    await updateDoc(userRef, updatePayload);
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

// Delete user
export const deleteUser = async (userId: string): Promise<void> => {
  const fallbackDeleteFromFirestore = async () => {
    // 1) Try direct members/{userId}
    const directRef = doc(db, "members", userId);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      await deleteDoc(directRef);
      console.log('User deleted from Firestore by document ID');
      return;
    }

    // 2) Try members where uid == userId
    const byUid = await getDocs(query(collection(db, "members"), where("uid", "==", userId)));
    if (!byUid.empty) {
      await Promise.all(byUid.docs.map((d) => deleteDoc(doc(db, "members", d.id))));
      console.log(`User deleted from Firestore by uid match (${byUid.size} document(s))`);
      return;
    }

    throw new Error('User record not found in Firestore for deletion');
  };

  try {
    // Ensure user is authenticated before calling the function
    const currentUser = auth.currentUser;
    console.log('Current user:', currentUser?.uid);
    
    if (!currentUser) {
      throw new Error('You must be logged in to delete users');
    }

    // Get fresh ID token
    const idToken = await currentUser.getIdToken(true);
    console.log('Got ID token, length:', idToken.length);

    // Call the Cloud Function to delete both Auth and Firestore data
    const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
    console.log('Calling deleteUserAccount function for userId:', userId);
    
    const result = await deleteUserAccount({ userId });
    console.log('User deleted successfully:', result.data);
  } catch (error: any) {
    console.error("Error deleting user:", error);
    console.error("Error code:", error.code);
    console.error("Error details:", error.details);

    const code = String(error?.code || '');
    const message = String(error?.message || '').toLowerCase();
    const shouldFallbackToFirestore =
      code === 'functions/not-found' ||
      code === 'functions/internal' ||
      code === 'functions/unavailable' ||
      code === 'functions/unknown' ||
      message.includes('cors') ||
      message.includes('access-control-allow-origin') ||
      message.includes('404') ||
      message.includes('failed to fetch') ||
      message.includes('network');

    // If callable endpoint is unavailable, do Firestore-only deletion
    if (shouldFallbackToFirestore) {
      console.warn('Callable deleteUserAccount unavailable, deleting from Firestore only');
      try {
        await fallbackDeleteFromFirestore();
        console.log('User deleted from Firestore (Authentication account may still exist)');
        return;
      } catch (firestoreError) {
        console.error("Error deleting from Firestore:", firestoreError);
        throw new Error('Failed to delete user from Firestore');
      }
    }
    
    // Provide more detailed error message
    const errorMessage = error.message || 'Failed to delete user';
    throw new Error(errorMessage);
  }
};

// Fetch Mana Reward Analytics for Reports
export const fetchManaRewardAnalytics = async (): Promise<ManaRewardAnalytics> => {
  try {
    // Fetch rewards history - this contains all generated reward codes
    const rewardsRef = collection(db, "rewardsHistory");
    const rewardsSnapshot = await getDocs(rewardsRef);
    
    console.log("📊 Fetching MANA Reward Analytics...");
    console.log(`Found ${rewardsSnapshot.size} reward codes in rewardsHistory collection`);
    
    // Fetch reward claims
    const claimsRef = collection(db, "rewardClaims");
    const claimsSnapshot = await getDocs(claimsRef);
    
    console.log(`Found ${claimsSnapshot.size} claim documents in rewardClaims collection`);
    
    const now = new Date();
    let totalRewardsGenerated = rewardsSnapshot.size;
    let activeRewards = 0;
    let expiredRewards = 0;
    let totalClaimAmount = 0;
    let totalRewardsClaimed = claimsSnapshot.size;
    
    const recentRewards: Array<{
      id: string;
      code: string;
      totalPool: number;
      remainingPool: number;
      claimCount: number;
      expiresAt: string;
      status: string;
    }> = [];
    
    // Process rewards
    rewardsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      let expiresAt: Date | null = null;
      
      if (data.expiresAt) {
        if (typeof data.expiresAt.toDate === 'function') {
          expiresAt = data.expiresAt.toDate();
        } else if (data.expiresAt instanceof Date) {
          expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'string') {
          expiresAt = new Date(data.expiresAt);
        }
      }
      
      const isExpired = expiresAt ? expiresAt < now : false;
      
      if (isExpired) {
        expiredRewards++;
      } else {
        activeRewards++;
      }
      
      // Add to recent rewards (top 5)
      if (recentRewards.length < 5) {
        recentRewards.push({
          id: doc.id,
          code: data.code || "",
          totalPool: data.totalPool || 0,
          remainingPool: data.remainingPool || 0,
          claimCount: data.claimCount || 0,
          expiresAt: expiresAt?.toISOString() || "",
          status: isExpired ? "Expired" : "Active",
        });
      }
    });
    
    // Calculate total claim amount
    claimsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      totalClaimAmount += data.claimAmount || 0;
    });
    
    const claimRate = totalRewardsGenerated > 0 
      ? (totalRewardsClaimed / totalRewardsGenerated) * 100 
      : 0;
    
    const averageClaimAmount = totalRewardsClaimed > 0 
      ? totalClaimAmount / totalRewardsClaimed 
      : 0;
    
    console.log("✅ MANA Reward Analytics Summary:");
    console.log(`- Total Rewards Generated: ${totalRewardsGenerated}`);
    console.log(`- Active Rewards: ${activeRewards}`);
    console.log(`- Expired Rewards: ${expiredRewards}`);
    console.log(`- Total Claims: ${totalRewardsClaimed}`);
    console.log(`- Total Claim Amount: ${totalClaimAmount}`);
    console.log(`- Claim Rate: ${claimRate.toFixed(1)}%`);
    
    return {
      totalRewardsGenerated,
      totalRewardsClaimed,
      totalClaimAmount,
      activeRewards,
      expiredRewards,
      claimRate,
      averageClaimAmount,
      recentRewards,
    };
  } catch (error) {
    console.error("❌ Error fetching Mana Reward analytics:", error);
    return {
      totalRewardsGenerated: 0,
      totalRewardsClaimed: 0,
      totalClaimAmount: 0,
      activeRewards: 0,
      expiredRewards: 0,
      claimRate: 0,
      averageClaimAmount: 0,
      recentRewards: [],
    };
  }
};
