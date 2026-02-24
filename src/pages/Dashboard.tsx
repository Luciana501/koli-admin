import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  MaintenanceSchedulerConfig,
  saveMaintenanceScheduler,
  subscribeToDonations,
  subscribeToKYC,
  subscribeToMaintenanceScheduler,
  subscribeToODHexWithdrawals,
  subscribeToUsers,
  updateKYCStatus,
} from "@/services/firestore";
import { IconUsers, IconCash, IconArrowUpRight, IconWallet } from "@tabler/icons-react";
import { ODHexWithdrawal, Donation, User } from "@/types/admin";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import PageLoading from "@/components/PageLoading";

const Dashboard = () => {
  const { adminType } = useAuth();
  const { toast } = useToast();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDonations: 0,
    totalAssets: 0,
    pendingWithdrawals: 0,
    pendingWithdrawalAmount: 0,
  });

  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<ODHexWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kycUsers, setKycUsers] = useState<any[]>([]);
  const [kycLoading, setKycLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [maintenanceSaving, setMaintenanceSaving] = useState(false);
  const [maintenanceCancelling, setMaintenanceCancelling] = useState(false);
  const [maintenanceAutoActivating, setMaintenanceAutoActivating] = useState(false);
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceSchedulerConfig | null>(null);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceStartAt, setMaintenanceStartAt] = useState("");
  const [maintenanceStartOffset, setMaintenanceStartOffset] = useState<number | "">("");
  const [maintenanceOffsetUnit, setMaintenanceOffsetUnit] = useState<"hours" | "minutes">("hours");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [showMaintenanceScheduler, setShowMaintenanceScheduler] = useState(false);
  const [maintenanceWarningOpen, setMaintenanceWarningOpen] = useState(false);
  const [pendingMaintenanceAction, setPendingMaintenanceAction] = useState<{ type: "enable" | "schedule"; nextEnabled?: boolean } | null>(null);

  const formatDateTime = (isoValue: string) => {
    if (!isoValue) return "—";
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    setStats({
      totalUsers: 0,
      totalDonations: 0,
      totalAssets: 0,
      pendingWithdrawals: 0,
      pendingWithdrawalAmount: 0,
    });
    setLoading(false);

    let unsubscribeKYC = () => {};
    let unsubscribeDonations = () => {};
    let unsubscribeMaintenance = () => {};

    try {
      const unsubscribeUsers = subscribeToUsers((users) => {
        const totalAssets = users.reduce((sum, user) => sum + (user.totalAsset || 0), 0);

        setStats((previousValue) => ({
          ...previousValue,
          totalUsers: users.length,
          totalAssets,
        }));

        setRecentUsers(users.slice(0, 5));
        setLoading(false);
        setError(null);
      });

      const unsubscribeWithdrawals = subscribeToODHexWithdrawals((withdrawals) => {
        const pendingRequests = withdrawals.filter((withdrawal) => withdrawal.status === "pending");
        const pendingCount = pendingRequests.length;
        const pendingAmount = pendingRequests.reduce((sum, withdrawal) => sum + (withdrawal.amount || 0), 0);

        setStats((previousValue) => ({
          ...previousValue,
          pendingWithdrawals: pendingCount,
          pendingWithdrawalAmount: pendingAmount,
        }));

        setRecentWithdrawals(withdrawals.slice(0, 5));
      });

      unsubscribeDonations = subscribeToDonations((donations: Donation[]) => {
        const totalApprovedDonations = donations
          .filter((donation) => donation.status === "approved")
          .reduce((sum, donation) => sum + (donation.donationAmount || 0), 0);

        setStats((previousValue) => ({
          ...previousValue,
          totalDonations: totalApprovedDonations,
        }));
      });

      if (adminType === "developer") {
        unsubscribeKYC = subscribeToKYC((users) => {
          setKycUsers(users.filter((user) => user.kycStatus === "PENDING"));
          setKycLoading(false);
        });
      }

      unsubscribeMaintenance = subscribeToMaintenanceScheduler((config: MaintenanceSchedulerConfig) => {
        setMaintenanceConfig(config);
        setMaintenanceEnabled(config.enabled);

        const startTime = Date.parse(config.startAt || "");
        const shouldAutoActivate =
          !config.enabled &&
          Number.isFinite(startTime) &&
          startTime > 0 &&
          Date.now() >= startTime &&
          !maintenanceAutoActivating;

        if (shouldAutoActivate) {
          setMaintenanceAutoActivating(true);
          saveMaintenanceScheduler({
            enabled: true,
            startAt: config.startAt || "",
            endAt: config.endAt || "",
            durationHours: config.durationHours || 0,
            startInHours: config.startInHours || 0,
            startInMinutes: config.startInMinutes || 0,
            message: config.message || "",
            timezone: config.timezone || "Asia/Manila",
          })
            .catch((error) => {
              console.error("Failed to auto-activate maintenance:", error);
            })
            .finally(() => {
              setMaintenanceAutoActivating(false);
            });
        }
      });

      return () => {
        unsubscribeUsers();
        unsubscribeWithdrawals();
        unsubscribeDonations();
        unsubscribeKYC();
        unsubscribeMaintenance();
      };
    } catch (caughtError: any) {
      console.error("Dashboard error:", caughtError);
      setError(caughtError.message || "Failed to load dashboard data");
      setLoading(false);
    }
  }, [adminType]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!maintenanceConfig || maintenanceConfig.enabled || maintenanceAutoActivating) return;

      const startTime = Date.parse(maintenanceConfig.startAt || "");
      const isDue = Number.isFinite(startTime) && startTime > 0 && Date.now() >= startTime;

      if (!isDue) return;

      setMaintenanceAutoActivating(true);
      saveMaintenanceScheduler({
        enabled: true,
        startAt: maintenanceConfig.startAt || "",
        endAt: maintenanceConfig.endAt || "",
        durationHours: maintenanceConfig.durationHours || 0,
        startInHours: maintenanceConfig.startInHours || 0,
        startInMinutes: maintenanceConfig.startInMinutes || 0,
        message: maintenanceConfig.message || "",
        timezone: maintenanceConfig.timezone || "Asia/Manila",
      })
        .catch((error) => {
          console.error("Failed to auto-activate maintenance:", error);
        })
        .finally(() => {
          setMaintenanceAutoActivating(false);
        });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [maintenanceConfig, maintenanceAutoActivating]);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "APPROVED");
      setKycUsers((previousValue) => previousValue.filter((user) => user.id !== id));
    } catch {
      alert("Failed to approve KYC application");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "REJECTED");
      setKycUsers((previousValue) => previousValue.filter((user) => user.id !== id));
    } catch {
      alert("Failed to reject KYC application");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleMaintenance = async (nextEnabled: boolean) => {
    setMaintenanceEnabled(nextEnabled);
    setMaintenanceSaving(true);
    try {
      await saveMaintenanceScheduler({
        enabled: nextEnabled,
        startAt: nextEnabled ? maintenanceConfig?.startAt || new Date().toISOString() : maintenanceConfig?.startAt || "",
        endAt: maintenanceConfig?.endAt || "",
        durationHours: maintenanceConfig?.durationHours || 0,
        startInHours: maintenanceConfig?.startInHours || 0,
        startInMinutes: maintenanceConfig?.startInMinutes || 0,
        message: maintenanceConfig?.message || "",
        timezone: maintenanceConfig?.timezone || "Asia/Manila",
      });

      toast({
        title: nextEnabled ? "Maintenance enabled" : "Maintenance disabled",
        description: "Koli system can now read the latest maintenance status.",
      });
    } catch (caughtError: any) {
      setMaintenanceEnabled(!nextEnabled);
      toast({
        title: "Failed to update maintenance status",
        description: caughtError?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const handleSaveMaintenance = async () => {
    const hasDateSchedule = Boolean(maintenanceStartAt);
    const numericOffsetForValidation = Number(maintenanceStartOffset);
    const hasOffsetSchedule = Number.isFinite(numericOffsetForValidation) && numericOffsetForValidation > 0;

    if (hasDateSchedule || hasOffsetSchedule) {
      const numericOffset = Number(maintenanceStartOffset);
      const hasOffset = Number.isFinite(numericOffset) && numericOffset > 0;

      if (maintenanceStartAt) {
        const startMs = new Date(maintenanceStartAt).getTime();
        if (!Number.isFinite(startMs)) {
          toast({
            title: "Invalid schedule",
            description: "Start date/time is invalid.",
            variant: "destructive",
          });
          return;
        }
      }

      if (maintenanceStartOffset !== "") {
        const startOffset = Number(maintenanceStartOffset);
        if (!Number.isFinite(startOffset) || startOffset <= 0) {
          toast({
            title: "Invalid offset",
            description: "Start offset must be greater than 0.",
            variant: "destructive",
          });
          return;
        }
      }
    }

    setMaintenanceSaving(true);
    try {
      const startOffset = Number(maintenanceStartOffset);
      const hasOffset = Number.isFinite(startOffset) && startOffset > 0;
      const totalOffsetMinutes = hasOffset ? (maintenanceOffsetUnit === "hours" ? startOffset * 60 : startOffset) : 0;
      const startInHours = hasOffset && maintenanceOffsetUnit === "hours" ? startOffset : 0;
      const startInMinutes = hasOffset && maintenanceOffsetUnit === "minutes" ? startOffset : 0;

      const startDate = maintenanceStartAt
        ? new Date(maintenanceStartAt)
        : totalOffsetMinutes > 0
        ? new Date(Date.now() + totalOffsetMinutes * 60 * 1000)
        : null;

      const autoEnabled = maintenanceEnabled;

      await saveMaintenanceScheduler({
        enabled: autoEnabled,
        startAt: startDate ? startDate.toISOString() : "",
        endAt: "",
        durationHours: 0,
        startInHours,
        startInMinutes,
        message: maintenanceMessage,
        timezone: "Asia/Manila",
      });

      toast({
        title: "Maintenance scheduler saved",
        description: "Koli system can now read the latest maintenance schedule.",
      });

      if (autoEnabled !== maintenanceEnabled) {
        setMaintenanceEnabled(autoEnabled);
      }

      setMaintenanceStartAt("");
      setMaintenanceStartOffset("");
      setMaintenanceOffsetUnit("hours");
      setMaintenanceMessage("");
    } catch (caughtError: any) {
      toast({
        title: "Failed to save maintenance scheduler",
        description: caughtError?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setMaintenanceSaving(false);
    }
  };

  const requestToggleMaintenance = (nextEnabled: boolean) => {
    if (nextEnabled) {
      setPendingMaintenanceAction({ type: "enable", nextEnabled });
      setMaintenanceWarningOpen(true);
      return;
    }

    void handleToggleMaintenance(nextEnabled);
  };

  const requestSaveMaintenance = () => {
    const hasDateSchedule = Boolean(maintenanceStartAt);
    const numericOffsetForValidation = Number(maintenanceStartOffset);
    const hasOffsetSchedule = Number.isFinite(numericOffsetForValidation) && numericOffsetForValidation > 0;

    if (hasDateSchedule || hasOffsetSchedule || maintenanceEnabled) {
      setPendingMaintenanceAction({ type: "schedule" });
      setMaintenanceWarningOpen(true);
      return;
    }

    void handleSaveMaintenance();
  };

  const confirmMaintenanceAction = () => {
    if (pendingMaintenanceAction?.type === "enable") {
      void handleToggleMaintenance(Boolean(pendingMaintenanceAction.nextEnabled));
    }

    if (pendingMaintenanceAction?.type === "schedule") {
      void handleSaveMaintenance();
    }

    setPendingMaintenanceAction(null);
    setMaintenanceWarningOpen(false);
  };

  const handleCancelMaintenance = async () => {
    setMaintenanceCancelling(true);
    try {
      await saveMaintenanceScheduler({
        enabled: false,
        startAt: "",
        endAt: "",
        durationHours: 0,
        startInHours: 0,
        startInMinutes: 0,
        message: "",
        timezone: "Asia/Manila",
      });

      setMaintenanceEnabled(false);
      setMaintenanceStartAt("");
      setMaintenanceStartOffset("");
      setMaintenanceOffsetUnit("hours");
      setMaintenanceMessage("");

      toast({
        title: "Maintenance cancelled",
        description: "Maintenance schedule has been cancelled.",
      });
    } catch (caughtError: any) {
      toast({
        title: "Failed to cancel maintenance",
        description: caughtError?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setMaintenanceCancelling(false);
    }
  };

  const statCards = [
    { title: "Total Users", value: stats.totalUsers.toString(), icon: IconUsers, meta: "Live" },
    { title: "Total Donations", value: `₱${stats.totalDonations.toLocaleString()}`, icon: IconWallet, meta: "Approved" },
    { title: "Total Principal", value: `₱${stats.totalAssets.toLocaleString()}`, icon: IconCash, meta: "Current" },
    { title: "Pending Withdrawals", value: stats.pendingWithdrawals.toString(), icon: IconArrowUpRight, meta: "Requests" },
  ];

  if (loading) {
    return <PageLoading className="min-h-[16rem]" />;
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

  const communityReserve = Math.round(stats.totalAssets * 0.7);
  const currentLiability = stats.pendingWithdrawalAmount;

  return (
    <div>
      <div className="mb-6 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Welcome back, {adminType === "developer" ? "Developer" : "Finance"} Admin
        </p>
      </div>

      {adminType === "developer" && (
      <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base md:text-lg font-semibold">Maintenance Scheduler</h2>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">Schedule maintenance for Koli system clients.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMaintenanceScheduler((previousValue) => !previousValue)}
          >
            {showMaintenanceScheduler ? "Hide Scheduler" : "Show Scheduler"}
          </Button>
        </div>

        {showMaintenanceScheduler && (
          <>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs md:text-sm text-muted-foreground">Enable</span>
          <Switch
            checked={maintenanceEnabled}
            onCheckedChange={requestToggleMaintenance}
            disabled={maintenanceSaving || maintenanceCancelling || maintenanceAutoActivating}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input type="datetime-local" value={maintenanceStartAt} onChange={(event) => setMaintenanceStartAt(event.target.value)} />
          <Input
            type="number"
            min={1}
            step={1}
            placeholder="Start offset (e.g. 1)"
            value={maintenanceStartOffset}
            onChange={(event) => {
              const value = event.target.value;
              setMaintenanceStartOffset(value === "" ? "" : Number(value));
            }}
          />
          <Select value={maintenanceOffsetUnit} onValueChange={(value: "hours" | "minutes") => setMaintenanceOffsetUnit(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="minutes">Minutes</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="Maintenance message (optional)"
            value={maintenanceMessage}
            onChange={(event) => setMaintenanceMessage(event.target.value)}
          />
        </div>

        <div className="flex items-center justify-between mt-4 gap-2">
          <p className="text-xs text-muted-foreground">
            Data path: systemSettings/maintenanceScheduler • Timezone: Asia/Manila • Set either specific date/time or start offset + unit
          </p>
          <div className="flex items-center gap-2">
            <Button onClick={requestSaveMaintenance} disabled={maintenanceSaving || maintenanceCancelling || maintenanceAutoActivating}>
              {maintenanceSaving ? "Saving..." : "Save Maintenance"}
            </Button>
          </div>
        </div>
          </>
        )}

        <div className="mt-4 text-xs md:text-sm text-muted-foreground">
          Current status: {maintenanceConfig?.enabled ? "Enabled" : "Inactive"}
        </div>

        <AlertDialog
          open={maintenanceWarningOpen}
          onOpenChange={(open) => {
            setMaintenanceWarningOpen(open);
            if (!open) setPendingMaintenanceAction(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingMaintenanceAction?.type === "enable" ? "Enable Maintenance Mode?" : "Save Maintenance Schedule?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingMaintenanceAction?.type === "enable"
                  ? "This action can immediately affect user access. Confirm only if you are ready to enter maintenance mode."
                  : "This will publish a maintenance schedule that can affect user access once it starts. Do you want to continue?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmMaintenanceAction}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {(maintenanceConfig?.enabled || maintenanceConfig?.startAt || maintenanceConfig?.startInHours || maintenanceConfig?.startInMinutes || maintenanceConfig?.message) && (
          <div className="mt-4 border border-border rounded-lg p-3 md:p-4 bg-muted/20 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="text-xs md:text-sm text-muted-foreground space-y-1">
              <p>Status: {maintenanceConfig?.enabled ? "Enabled" : "Scheduled"}</p>
              <p>Start: {formatDateTime(maintenanceConfig?.startAt || "")}</p>
              <p>
                Offset: {maintenanceConfig?.startInHours ? `${maintenanceConfig.startInHours} hour(s)` : maintenanceConfig?.startInMinutes ? `${maintenanceConfig.startInMinutes} minute(s)` : "—"}
              </p>
              <p>Message: {maintenanceConfig?.message || "—"}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleCancelMaintenance}
              disabled={maintenanceSaving || maintenanceCancelling || maintenanceAutoActivating}
            >
              {maintenanceCancelling ? "Cancelling..." : "Cancel Maintenance"}
            </Button>
          </div>
        )}
      </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 flex flex-col justify-between">
          <span className="text-muted-foreground text-xs md:text-sm font-medium">Community Reserve (70% of Assets)</span>
          <span className="text-2xl md:text-3xl font-bold mt-2">₱{communityReserve.toLocaleString()}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 flex flex-col justify-between">
          <span className="text-muted-foreground text-xs md:text-sm font-medium">Current Liability (Pending ODHex Withdrawals)</span>
          <span className="text-2xl md:text-3xl font-bold mt-2">₱{currentLiability.toLocaleString()}</span>
        </div>
      </div>

      {adminType === "developer" && (
        <div className="bg-card border border-border rounded-lg p-4 md:p-6 mb-6">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Pending KYC Applications</h2>
          {kycLoading ? (
            <p className="text-muted-foreground">Loading KYC applications...</p>
          ) : kycUsers.length === 0 ? (
            <p className="text-muted-foreground">No pending KYC applications.</p>
          ) : (
            <ul className="space-y-4">
              {kycUsers.map((user) => (
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
        {statCards.map((stat, index) => (
          <div key={index} className="bg-card border border-border rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <span className="text-muted-foreground text-xs md:text-sm font-medium">{stat.title}</span>
              <stat.icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <div className="flex items-end justify-between">
              <span className="text-xl md:text-2xl font-bold">{stat.value}</span>
              <span className="text-xs md:text-sm text-muted-foreground">{stat.meta}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Recent Users</h2>
          <div className="space-y-3">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No users yet</p>
            ) : (
              recentUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-medium text-sm md:text-base truncate">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <span className="text-sm md:text-base font-medium whitespace-nowrap">₱{user.totalAsset.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-3 md:mb-4">Recent ODHex Withdrawals</h2>
          <div className="space-y-3">
            {recentWithdrawals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No withdrawals yet</p>
            ) : (
              recentWithdrawals.map((withdrawal) => (
                <div key={withdrawal.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1 pr-4">
                    <p className="font-medium text-sm md:text-base truncate">{withdrawal.userEmail || withdrawal.userId}</p>
                    <p className="text-xs md:text-sm text-muted-foreground">{new Date(withdrawal.requestedAt).toLocaleDateString()}</p>
                  </div>
                  <span className="text-sm md:text-base font-medium whitespace-nowrap">₱{withdrawal.amount.toLocaleString()}</span>
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
