import React, { useEffect, useState } from "react";
import { User } from "@/types/admin";
import { IconX } from "@tabler/icons-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

interface DonationContractEntry {
  id: string;
  amount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, user }) => {
  const [totalWithdrawals, setTotalWithdrawals] = useState<number>(0);
  const [totalRewardsClaimed, setTotalRewardsClaimed] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [donationEntries, setDonationEntries] = useState<DonationContractEntry[]>([]);
  const [isLoadingDonations, setIsLoadingDonations] = useState<boolean>(false);

  useEffect(() => {
    if (!user) {
      setDonationEntries([]);
      return;
    }

    const normalizeIso = (value: unknown): string => {
      if (!value) return new Date().toISOString();
      if (typeof value === "string") return value;
      if (value instanceof Date) return value.toISOString();
      if (typeof (value as { toDate?: () => Date }).toDate === "function") {
        return (value as { toDate: () => Date }).toDate().toISOString();
      }
      return new Date().toISOString();
    };

    const fetchUserStats = async () => {
      setIsLoadingStats(true);
      setIsLoadingDonations(true);
      try {
        const withdrawalsRef = collection(db, "withdrawals");
        const withdrawalsQuery = query(
          withdrawalsRef,
          where("userId", "==", user.id),
          where("status", "==", "approved")
        );
        const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
        const withdrawalTotal = withdrawalsSnapshot.docs.reduce((sum, docSnapshot) => {
          const data = docSnapshot.data();
          return sum + (data.amount || 0);
        }, 0);
        setTotalWithdrawals(withdrawalTotal);

        const rewardsRef = collection(db, "rewardClaims");
        const rewardsQuery = query(rewardsRef, where("userId", "==", user.id));
        const rewardsSnapshot = await getDocs(rewardsQuery);
        const rewardsTotal = rewardsSnapshot.docs.reduce((sum, docSnapshot) => {
          const data = docSnapshot.data();
          return sum + (data.claimAmount || 0);
        }, 0);
        setTotalRewardsClaimed(rewardsTotal);

        const donationContractsRef = collection(db, "donationContracts");
        const idsToMatch = Array.from(
          new Set([user.id, user.uid].filter((value): value is string => Boolean(value?.trim())))
        );
        const fieldsToMatch = ["userId", "uid", "memberId"] as const;
        const donationSnapshots = await Promise.all(
          idsToMatch.flatMap((idValue) =>
            fieldsToMatch.map((field) => getDocs(query(donationContractsRef, where(field, "==", idValue))))
          )
        );

        const uniqueEntries = new Map<string, DonationContractEntry>();
        donationSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((docSnapshot) => {
            if (uniqueEntries.has(docSnapshot.id)) return;
            const data = docSnapshot.data();
            const declaredAmount = Number(data.donationAmount || 0);
            const verifiedAmount = typeof data.verifiedAmount === "number" ? data.verifiedAmount : null;
            const effectiveAmount = Number(verifiedAmount ?? declaredAmount);

            uniqueEntries.set(docSnapshot.id, {
              id: docSnapshot.id,
              amount: Number.isFinite(effectiveAmount) ? effectiveAmount : 0,
              status: String(data.status || "pending"),
              paymentMethod: String(data.paymentMethod || "N/A"),
              createdAt: normalizeIso(data.createdAt),
            });
          });
        });

        const sortedEntries = Array.from(uniqueEntries.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setDonationEntries(sortedEntries);
      } catch (error) {
        console.error("Error fetching user stats:", error);
        setDonationEntries([]);
      } finally {
        setIsLoadingStats(false);
        setIsLoadingDonations(false);
      }
    };

    fetchUserStats();
  }, [user]);

  const formatCurrency = (value: number) => `\u20B1${value.toLocaleString()}`;
  const formatDonationStatus = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "approved" || normalized === "active") return "Approved";
    if (normalized === "rejected") return "Rejected";
    return "Pending";
  };
  const getDonationStatusClassName = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "approved" || normalized === "active") {
      return "bg-green-500/15 text-green-600";
    }
    if (normalized === "rejected") {
      return "bg-red-500/15 text-red-600";
    }
    return "bg-amber-500/15 text-amber-600";
  };
  const formatKycStatus = (status?: string) => {
    if (status === "APPROVED") return "Approved";
    if (status === "PENDING") return "Pending";
    if (status === "REJECTED") return "Rejected";
    return "Not Submitted";
  };
  const formatCreatedAt = (value?: string) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const contractsTotalDonations = donationEntries.reduce((sum, entry) => {
    const normalized = entry.status.toLowerCase();
    if (normalized !== "approved" && normalized !== "active") return sum;
    return sum + entry.amount;
  }, 0);

  const donationSummaryAmount =
    donationEntries.length > 0 ? contractsTotalDonations : user?.donationAmount || 0;

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-foreground/50" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-lg w-full max-w-sm sm:max-w-md md:max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border gap-2">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold truncate">User Information</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition-colors flex-shrink-0"
            aria-label="Close"
          >
            <IconX className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="financials">Financials</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">First Name</label>
                  <p className="text-base font-medium">{user.firstName || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                  <p className="text-base font-medium">{user.lastName || "N/A"}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <p className="text-base font-medium break-all">{user.email || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <p className="text-base font-medium">{user.phoneNumber || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Leader</label>
                  <p className="text-base font-medium">{user.leaderName || user.leaderId || "Unassigned"}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">Address</label>
                  <p className="text-base font-medium">{user.address || "N/A"}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="financials" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Total Donations</label>
                  <p className="text-base font-medium">{formatCurrency(donationSummaryAmount)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Assets</label>
                  <p className="text-base font-medium">{formatCurrency(user.totalAsset || 0)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Withdrawals</label>
                  {isLoadingStats ? (
                    <p className="text-base font-medium text-muted-foreground italic">Loading...</p>
                  ) : (
                    <p className="text-base font-medium">{formatCurrency(totalWithdrawals)}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Rewards Claimed</label>
                  {isLoadingStats ? (
                    <p className="text-base font-medium text-muted-foreground italic">Loading...</p>
                  ) : (
                    <p className="text-base font-medium">{formatCurrency(totalRewardsClaimed)}</p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-sm font-medium text-muted-foreground">Donation Entries</label>
                  <span className="text-xs text-muted-foreground">
                    {isLoadingDonations ? "Loading..." : `${donationEntries.length} record(s)`}
                  </span>
                </div>

                {isLoadingDonations ? (
                  <p className="text-sm text-muted-foreground italic">Loading donation records...</p>
                ) : donationEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No donation records found.</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto border border-border rounded-md divide-y divide-border">
                    {donationEntries.map((entry) => (
                      <div key={entry.id} className="px-3 py-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{formatCurrency(entry.amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}{" "} - {entry.paymentMethod}
                          </p>
                        </div>
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getDonationStatusClassName(
                            entry.status
                          )}`}
                        >
                          {formatDonationStatus(entry.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Account Created</label>
                  <p className="text-base font-medium">{formatCreatedAt(user.createdAt)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">KYC Status</label>
                  <p className="text-base font-medium">{formatKycStatus(user.kycStatus)}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-sm font-medium text-muted-foreground">User ID</label>
                  <p className="text-sm font-medium font-mono break-all">{user.id}</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Security telemetry is not available for this user in the current data model.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;

