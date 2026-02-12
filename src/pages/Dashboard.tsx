import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { subscribeToUsers, subscribeToWithdrawals, subscribeToKYC, updateKYCStatus } from "@/services/firestore";
import { IconUsers, IconCash, IconArrowUpRight, IconWallet } from "@tabler/icons-react";

const Dashboard = () => {
  const { adminType } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDonations: 0,
    totalAssets: 0,
    pendingWithdrawals: 0,
  });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kycUsers, setKycUsers] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    // ...existing code...
    setStats({
      totalUsers: 0,
      totalDonations: 0,
      totalAssets: 0,
      pendingWithdrawals: 0,
    });
    setLoading(false);

    let unsubscribeKYC = () => {};
    try {
      // Subscribe to real-time users updates
      const unsubscribeUsers = subscribeToUsers((users) => {
        // ...existing code...
        const totalDonations = users.reduce((sum, user) => sum + (user.donationAmount || 0), 0);
        const totalAssets = users.reduce((sum, user) => sum + (user.totalAsset || 0), 0);
        setStats((prev) => ({
          ...prev,
          totalUsers: users.length,
          totalDonations,
          totalAssets,
        }));
        setRecentUsers(users.slice(0, 5));
        setLoading(false);
        setError(null);
      });

      // Subscribe to real-time withdrawals updates
      const unsubscribeWithdrawals = subscribeToWithdrawals((withdrawals) => {
        // ...existing code...
        const pending = withdrawals.filter((w) => w.status === "pending").length;
        setStats((prev) => ({
          ...prev,
          pendingWithdrawals: pending,
        }));
        setRecentWithdrawals(withdrawals.slice(0, 5));
      });

      // Subscribe to KYC only for main admin
      if (adminType === "main") {
        unsubscribeKYC = subscribeToKYC((users) => {
          setKycUsers(users.filter(u => u.kycStatus === "PENDING"));
          setKycLoading(false);
        });
      }

      // Cleanup subscriptions on unmount
      return () => {
        unsubscribeUsers();
        unsubscribeWithdrawals();
        unsubscribeKYC();
      };
    } catch (err: any) {
      // ...existing code...
      console.error("Dashboard error:", err);
      setError(err.message || "Failed to load dashboard data");
      setLoading(false);
    }
  }, [adminType]);
  // KYC Approve/Reject handlers
  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "APPROVED");
      setKycUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert("Failed to approve KYC application");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "REJECTED");
      setKycUsers(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      alert("Failed to reject KYC application");
    } finally {
      setProcessingId(null);
    }
  };

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers.toString(),
      icon: IconUsers,
      change: "+12%",
    },
    {
      title: "Total Donations",
      value: `₱${stats.totalDonations.toLocaleString()}`,
      icon: IconWallet,
      change: "+8%",
    },
    {
      title: "Total Principal",
      value: `₱${stats.totalAssets.toLocaleString()}`,
      icon: IconCash,
      change: "+15%",
    },
    {
      title: "Pending Withdrawals",
      value: stats.pendingWithdrawals.toString(),
      icon: IconArrowUpRight,
      change: "Requests",
    },
  ];

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-destructive font-medium">Error loading dashboard</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">Please check your Firebase permissions and ensure you're authenticated.</p>
        </div>
      </div>
    );
  }

  // Financial Health calculations
  const communityReserve = Math.round(stats.totalAssets * 0.7);
  // Placeholder for current liability: you must replace this with actual matured payout logic if available
  const currentLiability = 0; // TODO: Calculate sum of all matured 30% payout eligible amounts

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Welcome back, {adminType === "main" ? "Main" : "Finance"} Admin
        </p>
      </div>

      {/* Financial Health Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 flex flex-col justify-between">
          <span className="text-muted-foreground text-xs md:text-sm font-medium">Community Reserve (70% of Assets)</span>
          <span className="text-2xl md:text-3xl font-bold mt-2">₱{communityReserve.toLocaleString()}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 flex flex-col justify-between">
          <span className="text-muted-foreground text-xs md:text-sm font-medium">Current Liability (Matured 30% Payouts)</span>
          <span className="text-2xl md:text-3xl font-bold mt-2">₱{currentLiability.toLocaleString()}</span>
        </div>
      </div>

      {/* Pending KYC Applications for Main Admin */}
      {adminType === "main" && (
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Pending KYC Applications</h2>
          {kycLoading ? (
            <p className="text-muted-foreground">Loading KYC applications...</p>
          ) : kycUsers.length === 0 ? (
            <p className="text-muted-foreground">No pending KYC applications.</p>
          ) : (
            <ul className="space-y-4">
              {kycUsers.map(user => (
                <li key={user.id} className="bg-muted/30 border border-border rounded-lg p-4 flex flex-col gap-2">
                  <div className="font-semibold">{user.name || `${user.firstName} ${user.lastName}`}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => handleApprove(user.id)}
                      disabled={processingId === user.id}
                      className="px-4 py-2 rounded bg-green-500/10 text-green-600 font-medium hover:bg-green-500/20 transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReject(user.id)}
                      disabled={processingId === user.id}
                      className="px-4 py-2 rounded bg-red-500/10 text-red-600 font-medium hover:bg-red-500/20 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        {/* ...existing stat cards code... */}
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-card border border-border rounded-lg p-4 md:p-6"
          >
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <span className="text-muted-foreground text-xs md:text-sm font-medium">
                {stat.title}
              </span>
              <stat.icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xl md:text-2xl font-bold">{stat.value}</span>
              <span className="text-xs md:text-sm text-muted-foreground">{stat.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* ...existing recent users and withdrawals code... */}
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Recent Users</h2>
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No users yet</p>
            ) : (
              recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-medium text-sm md:text-base truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <span className="text-sm md:text-base font-medium whitespace-nowrap">
                    ₱{user.totalAsset.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">
            Recent Withdrawals
          </h2>
          <div className="space-y-3">
            {recentWithdrawals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No withdrawals yet</p>
            ) : (
              recentWithdrawals.map((withdrawal) => (
                <div
                  key={withdrawal.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-medium text-sm md:text-base truncate">{withdrawal.userName}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {new Date(withdrawal.requestedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm md:text-base font-medium whitespace-nowrap">
                    ₱{withdrawal.amount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
