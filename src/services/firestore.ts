import { collection, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions, auth } from "@/lib/firebase";
import { User, Withdrawal, Donation } from "@/types/admin";

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

      // Build result with aggregated date range
      const result: ReportData[] = [];
      let cumulativeCount = 0;
      
      allDates.forEach((dateKey) => {
        const incrementValue = dataMap.get(dateKey) || 0;
        cumulativeCount += incrementValue;
        result.push({
          date: createDateFromString(dateKey),
          count: cumulativeCount,
        });
      });

      console.log(`✅ Returning ${result.length} data points for users`);
      console.log(`📊 DataMap entries (first 5):`, Array.from(dataMap.entries()).slice(0, 5));
      console.log(`📊 First 3 results:`, result.slice(0, 3).map(r => ({ date: r.date.toISOString(), count: r.count, isValidDate: !isNaN(r.date.getTime()) })));
      console.log(`📊 Last 3 results:`, result.slice(-3).map(r => ({ date: r.date.toISOString(), count: r.count, isValidDate: !isNaN(r.date.getTime()) })));
      return result;
    } else if (type === "donations") {
      // Get total donations over time
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
        
        const donationAmount = data.donationAmount || 0;
        
        if (createdAt && createdAt >= startDate && createdAt <= now) {
          const dateKey = createdAt.toISOString().split('T')[0];
          const aggKey = getAggregationKey(dateKey, aggLevel);
          dataMap.set(aggKey, (dataMap.get(aggKey) || 0) + donationAmount);
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
      return {
        id: doc.id,
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || "",
        address: data.address || "",
        donationAmount: data.donationAmount || 0,
        totalAsset: data.totalAsset || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        kycStatus: data.kycStatus || "NOT_SUBMITTED",
        kycSubmittedAt: data.kycSubmittedAt || undefined,
        kycManualData: data.kycManualData || undefined,
        kycImageUrl: data.kycImageUrl || undefined,
        name: data.name || undefined,
      };
    });
    callback(users);
  }, (error) => {
    console.error("Error listening to users:", error);
    callback([]);
  });
  
  return unsubscribe;
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
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
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
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
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
    (snapshot) => {
      retryCount = 0; // Reset retry count on successful connection
      const withdrawals: import("@/types/admin").ODHexWithdrawal[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId || "",
          userEmail: data.userEmail || "",
          amount: data.amount || 0,
          method: data.method || "ewallet",
          provider: data.provider || "",
          accountDetails: data.accountDetails || "",
          status: data.status || "pending",
          requestedAt: data.requestedAt || new Date().toISOString(),
          processedAt: data.processedAt || null,
          processedBy: data.processedBy || null,
          rejectionReason: data.rejectionReason || "",
        };
      });
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
export const updateODHexWithdrawalStatus = async (
  withdrawalId: string,
  status: "pending" | "completed" | "rejected",
  processedBy?: string,
  rejectionReason?: string
): Promise<boolean> => {
  try {
    const withdrawalRef = doc(db, "odhexWithdrawals", withdrawalId);
    const updateData: any = {
      status,
      processedAt: new Date().toISOString(),
      processedBy: processedBy || "",
    };
    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    await updateDoc(withdrawalRef, updateData);
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
  status: "approved" | "rejected"
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

    // If approved, set approval metadata
    if (status === "approved") {
      const now = new Date();
      updateData.approvedAt = now.toISOString();
      updateData.donationStartDate = now.toISOString();
      
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
        kycManualData: data.kycManualData || undefined,
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
  status: "APPROVED" | "REJECTED"
): Promise<void> => {
  try {
    const userRef = doc(db, "members", userId);
    
    await updateDoc(userRef, {
      kycStatus: status,
      kycProcessedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating KYC status:", error);
    throw error;
  }
};

// Create new user
export const createUser = async (
  userData: Omit<User, "id" | "createdAt">
): Promise<string> => {
  try {
    const membersRef = collection(db, "members");
    const docRef = await addDoc(membersRef, {
      ...userData,
      createdAt: new Date().toISOString(),
      kycStatus: userData.kycStatus || "NOT_SUBMITTED",
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
    await updateDoc(userRef, {
      ...userData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

// Delete user
export const deleteUser = async (userId: string): Promise<void> => {
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
    
    // If Cloud Function is not deployed, fall back to Firestore-only deletion
    if (error.code === 'functions/not-found') {
      console.warn('Cloud function not found, deleting from Firestore only');
      try {
        const userRef = doc(db, "members", userId);
        await deleteDoc(userRef);
        console.log('User deleted from Firestore (Authentication account still exists)');
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
