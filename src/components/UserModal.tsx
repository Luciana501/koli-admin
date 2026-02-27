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

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, user }) => {
  const [totalWithdrawals, setTotalWithdrawals] = useState<number>(0);
  const [totalRewardsClaimed, setTotalRewardsClaimed] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;

    const fetchUserStats = async () => {
      setIsLoadingStats(true);
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
      } catch (error) {
        console.error("Error fetching user stats:", error);
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchUserStats();
  }, [user]);

  const formatCurrency = (value: number) => `₱${value.toLocaleString()}`;
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
                  <label className="text-sm font-medium text-muted-foreground">Donations</label>
                  <p className="text-base font-medium">{formatCurrency(user.donationAmount || 0)}</p>
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
