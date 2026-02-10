import { collection, getDocs, doc, getDoc, updateDoc, query, where, orderBy, Timestamp, onSnapshot } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { User, Withdrawal, Donation } from "@/types/admin";

export interface ReportData {
  date: Date;
  count?: number;
  amount?: number;
}

// Fetch analytics data for reports
export const fetchReportAnalytics = async (type: "users" | "donations" | "assets" | "rewards", timeRange: string) => {
  try {
    const now = new Date();
    let startDate = new Date();

    // Calculate start date based on time range
    switch (timeRange) {
      case "7days":
        startDate.setDate(now.getDate() - 7);
        break;
      case "1month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "3months":
        startDate.setMonth(now.getMonth() - 3);
        break;
      case "6months":
        startDate.setMonth(now.getMonth() - 6);
        break;
      case "1year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 3);
    }

    if (type === "users") {
      // Get user registrations over time
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
        
        if (createdAt && createdAt >= startDate) {
          const dateKey = createdAt.toISOString().split('T')[0];
          dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + 1);
        }
      });

      const result: ReportData[] = [];
      const sortedDates = Array.from(dataMap.keys()).sort();
      let cumulativeCount = 0;
      
      sortedDates.forEach((dateKey) => {
        cumulativeCount += dataMap.get(dateKey) || 0;
        result.push({
          date: new Date(dateKey),
          count: cumulativeCount,
        });
      });

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
        
        if (createdAt && createdAt >= startDate) {
          const dateKey = createdAt.toISOString().split('T')[0];
          dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + donationAmount);
        }
      });

      const result: ReportData[] = [];
      const sortedDates = Array.from(dataMap.keys()).sort();
      let cumulativeAmount = 0;
      
      sortedDates.forEach((dateKey) => {
        cumulativeAmount += dataMap.get(dateKey) || 0;
        result.push({
          date: new Date(dateKey),
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
        
        if (createdAt && createdAt >= startDate) {
          const dateKey = createdAt.toISOString().split('T')[0];
          dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + totalAsset);
        }
      });

      const result: ReportData[] = [];
      const sortedDates = Array.from(dataMap.keys()).sort();
      let cumulativeAmount = 0;
      
      sortedDates.forEach((dateKey) => {
        cumulativeAmount += dataMap.get(dateKey) || 0;
        result.push({
          date: new Date(dateKey),
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
        
        if (claimedAt && claimedAt >= startDate) {
          const dateKey = claimedAt.toISOString().split('T')[0];
          dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + claimAmount);
        }
      });

      const result: ReportData[] = [];
      const sortedDates = Array.from(dataMap.keys()).sort();
      let cumulativeAmount = 0;
      
      sortedDates.forEach((dateKey) => {
        cumulativeAmount += dataMap.get(dateKey) || 0;
        result.push({
          date: new Date(dateKey),
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

// Update user information
export const updateUser = async (userId: string, updates: Partial<User>): Promise<boolean> => {
  try {
    const userRef = doc(db, "members", userId);
    await updateDoc(userRef, updates as any);
    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    return false;
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
