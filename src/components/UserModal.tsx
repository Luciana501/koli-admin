import React, { useEffect, useState } from "react";
import { User } from "@/types/admin";
import { IconX } from "@tabler/icons-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence, motion } from "motion/react";
import { deleteDonationContract } from "@/services/firestore";

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
  contractType: string;
  createdAt: string;
  donationStartDate?: string;
  contractEndDate?: string;
  totalWithdrawn?: number;
  withdrawalsCount?: number;
}

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, user }) => {
  const [totalWithdrawals, setTotalWithdrawals] = useState<number>(0);
  const [totalRewardsClaimed, setTotalRewardsClaimed] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState<boolean>(false);
  const [donationEntries, setDonationEntries] = useState<DonationContractEntry[]>([]);
  const [isLoadingDonations, setIsLoadingDonations] = useState<boolean>(false);
  const [selectedContractEntry, setSelectedContractEntry] = useState<DonationContractEntry | null>(null);
  const [isDeletingContract, setIsDeletingContract] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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
              contractType: String(data.contractType || "N/A"),
              createdAt: normalizeIso(data.createdAt),
              donationStartDate: data.donationStartDate ? normalizeIso(data.donationStartDate) : undefined,
              contractEndDate: data.contractEndDate ? normalizeIso(data.contractEndDate) : undefined,
              totalWithdrawn: Number(data.totalWithdrawn || 0),
              withdrawalsCount: Number(data.withdrawalsCount || 0),
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

  const getContractTypeLabel = (contractType?: string) => {
    switch (contractType) {
      case "monthly_12_no_principal":
        return "30% Monthly for 1 Year";
      case "lockin_6_compound":
        return "6-Month Lock-In (Compounded)";
      case "lockin_12_compound":
        return "12-Month Lock-In (Compounded)";
      default:
        return contractType || "N/A";
    }
  };

  const getLockInMonths = (contractType?: string) => {
    if (!contractType) return 0;
    const match = contractType.match(/^lockin_(\d+)_compound$/i);
    return match ? Number(match[1]) : 0;
  };

  const formatValue = (value: number) => {
    if (!Number.isFinite(value)) return "0.0";
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  };

  const formatDateLabel = (dateValue: Date) =>
    dateValue.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const calculateContractPreview = (entry: DonationContractEntry) => {
    const now = new Date();
    const principal = Number(entry.amount || 0);
    const safePrincipal = Number.isFinite(principal) ? principal : 0;
    const startDate = entry.donationStartDate ? new Date(entry.donationStartDate) : new Date(entry.createdAt);
    const safeStartDate = Number.isNaN(startDate.getTime()) ? now : startDate;
    const totalWithdrawn = Number(entry.totalWithdrawn || 0);
    const lockInMonths = getLockInMonths(entry.contractType);
    const isCompound = lockInMonths > 0;

    if (isCompound) {
      const projectedUnlockAmount = safePrincipal * Math.pow(1.3, lockInMonths);
      const maturityDate = entry.contractEndDate
        ? new Date(entry.contractEndDate)
        : new Date(new Date(safeStartDate).setMonth(safeStartDate.getMonth() + lockInMonths));
      const isMatured = !Number.isNaN(maturityDate.getTime()) && now.getTime() >= maturityDate.getTime();
      const currentlyAvailable = isMatured ? Math.max(0, projectedUnlockAmount - totalWithdrawn) : 0;

      return {
        isCompound: true,
        lockInMonths,
        principal: safePrincipal,
        projectedTotal: projectedUnlockAmount,
        currentlyAvailable,
        totalWithdrawn,
        firstUnlockDate: formatDateLabel(maturityDate),
        contractEndDate: formatDateLabel(maturityDate),
      };
    }

    const amountPerPeriod = safePrincipal * 0.3;
    const planMonths = 12;
    const maxTotalWithdrawal = amountPerPeriod * planMonths;
    const inferredWithdrawn = entry.totalWithdrawn ?? (entry.withdrawalsCount || 0) * amountPerPeriod;
    const daysSinceStart = Math.max(
      0,
      Math.floor((now.getTime() - safeStartDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    const periodsElapsed = Math.floor(daysSinceStart / 30);
    const accumulatedAmount = Math.min(periodsElapsed * amountPerPeriod, maxTotalWithdrawal);
    const currentlyAvailable = Math.max(0, accumulatedAmount - inferredWithdrawn);
    const firstWithdrawalDate = new Date(safeStartDate);
    firstWithdrawalDate.setDate(firstWithdrawalDate.getDate() + 30);
    const contractEndDate = new Date(safeStartDate);
    contractEndDate.setMonth(contractEndDate.getMonth() + planMonths);

    return {
      isCompound: false,
      lockInMonths: planMonths,
      principal: safePrincipal,
      projectedTotal: maxTotalWithdrawal,
      currentlyAvailable,
      totalWithdrawn: inferredWithdrawn,
      amountPerPeriod,
      firstUnlockDate: formatDateLabel(firstWithdrawalDate),
      contractEndDate: formatDateLabel(contractEndDate),
    };
  };

  const buildCompoundProjection = (principal: number, months: number) => {
    const rows: Array<{ month: number; principalStart: number; interest: number; principalEnd: number }> = [];
    let runningPrincipal = principal;
    for (let month = 1; month <= months; month += 1) {
      const principalStart = runningPrincipal;
      const interest = principalStart * 0.3;
      const principalEnd = principalStart + interest;
      rows.push({ month, principalStart, interest, principalEnd });
      runningPrincipal = principalEnd;
    }
    return rows;
  };

  const contractsTotalDonations = donationEntries.reduce((sum, entry) => {
    const normalized = entry.status.toLowerCase();
    if (normalized !== "approved" && normalized !== "active") return sum;
    return sum + entry.amount;
  }, 0);

  const donationSummaryAmount = contractsTotalDonations;
  const selectedContractPreview = selectedContractEntry
    ? calculateContractPreview(selectedContractEntry)
    : null;
  const selectedProjectionRows =
    selectedContractPreview && selectedContractPreview.isCompound
      ? buildCompoundProjection(selectedContractPreview.principal, selectedContractPreview.lockInMonths)
      : [];

  if (!isOpen || !user) return null;

  const handleDeleteContract = async () => {
    if (!selectedContractEntry || isDeletingContract) return;
    setIsDeletingContract(true);
    try {
      await deleteDonationContract(selectedContractEntry.id);
      setDonationEntries((prev) => prev.filter((entry) => entry.id !== selectedContractEntry.id));
      setSelectedContractEntry(null);
      setIsDeleteConfirmOpen(false);
    } catch (error) {
      console.error("Failed to delete donation contract:", error);
    } finally {
      setIsDeletingContract(false);
    }
  };

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
                          <p className="text-xs text-muted-foreground">
                            Contract: {entry.contractType}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedContractEntry(entry)}
                            className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          >
                            View
                          </button>
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getDonationStatusClassName(
                              entry.status
                            )}`}
                          >
                            {formatDonationStatus(entry.status)}
                          </span>
                        </div>
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

      <AnimatePresence>
        {selectedContractEntry && selectedContractPreview && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-foreground/60"
              onClick={() => setSelectedContractEntry(null)}
              aria-label="Close contract preview"
            />
            <motion.div
              className="relative w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl max-h-[90vh] overflow-y-auto"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-base sm:text-lg font-semibold">Donation Contract Preview</h3>
                <button
                  type="button"
                  className="p-1.5 rounded-md hover:bg-accent transition-colors"
                  onClick={() => setSelectedContractEntry(null)}
                  aria-label="Close"
                >
                  <IconX className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 text-foreground p-4 space-y-3">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground">CONTRACT PREVIEW</p>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Contract Type</p>
                    <div className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium">
                      {getContractTypeLabel(selectedContractEntry.contractType)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">Initial Principal:</span>
                      <span className="font-semibold text-right break-words max-w-[14rem]">{formatValue(selectedContractPreview.principal)} KOLI</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">Selected Plan:</span>
                      <span className="font-semibold text-right break-words max-w-[14rem]">
                        {getContractTypeLabel(selectedContractEntry.contractType)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">
                        {selectedContractPreview.isCompound ? "Unlock Date:" : "First Withdrawal:"}
                      </span>
                      <span className="font-semibold text-right break-words max-w-[14rem]">{selectedContractPreview.firstUnlockDate}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">
                        {selectedContractPreview.isCompound ? "Lock-In:" : "Payout/Period:"}
                      </span>
                      <span className="font-semibold text-right break-words max-w-[14rem]">
                        {selectedContractPreview.isCompound
                          ? `${selectedContractPreview.lockInMonths} months (no withdrawals)`
                          : `30% (${formatValue(selectedContractPreview.amountPerPeriod || 0)} KOLI)`}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">
                        {selectedContractPreview.isCompound ? "Est. Unlock Amount:" : "Max Total Withdrawal:"}
                      </span>
                      <span className="font-bold text-emerald-600 text-right break-words max-w-[14rem]">
                        {formatValue(selectedContractPreview.projectedTotal)} KOLI
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-muted-foreground">Contract Ends:</span>
                      <span className="font-semibold text-right break-words max-w-[14rem]">{selectedContractPreview.contractEndDate}</span>
                    </div>
                  </div>
                </div>

                {selectedContractPreview.isCompound && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">LOCK-IN BREAKDOWN (ESTIMATED)</p>
                    <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background">
                      {selectedProjectionRows.map((row) => (
                        <div
                          key={row.month}
                          className="grid grid-cols-4 gap-2 px-3 py-2 text-[11px] border-b border-border last:border-b-0"
                        >
                          <span className="text-muted-foreground">M{row.month}</span>
                          <span className="text-muted-foreground">{formatValue(row.principalStart)}</span>
                          <span className="text-emerald-600">+{formatValue(row.interest)}</span>
                          <span className="font-semibold">{formatValue(row.principalEnd)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    disabled={isDeletingContract}
                    className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isDeletingContract ? "Deleting..." : "Delete Entry"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteConfirmOpen && selectedContractEntry && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="absolute inset-0 bg-foreground/60"
              onClick={() => setIsDeleteConfirmOpen(false)}
              aria-label="Close delete confirmation"
            />
            <motion.div
              className="relative w-full max-w-sm rounded-lg border border-border bg-card shadow-xl p-4 space-y-3"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              <div className="space-y-1">
                <p className="text-sm font-semibold">Delete donation entry?</p>
                <p className="text-xs text-muted-foreground">
                  This will permanently delete the selected donation entry. This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeletingContract}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteContract}
                  disabled={isDeletingContract}
                  className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isDeletingContract ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UserModal;

