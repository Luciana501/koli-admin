import React, { useState, useEffect, useMemo } from "react";
import { Withdrawal, ODHexWithdrawal } from "@/types/admin";
import { updateWithdrawalStatus, subscribeToODHexWithdrawals, updateODHexWithdrawalStatus } from "@/services/firestore";
import { useAuth } from "@/context/AuthContext";
import { IconSend, IconCheck, IconEye, IconX, IconFilter, IconSearch } from "@tabler/icons-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface GroupedWithdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  requestedAt: string;
  paymentMethod: string;
  isPooled: boolean;
  withdrawals: Withdrawal[];
}

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [odhexWithdrawals, setODHexWithdrawals] = useState<ODHexWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [odhexPage, setOdhexPage] = useState(1);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedWithdrawal | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "odhex">("odhex");
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectGroup, setRejectGroup] = useState<GroupedWithdrawal | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnGroup, setReturnGroup] = useState<GroupedWithdrawal | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [odhexViewModalOpen, setOdhexViewModalOpen] = useState(false);
  const [selectedOdhexWithdrawal, setSelectedOdhexWithdrawal] = useState<ODHexWithdrawal | null>(null);
  const [odhexRejectReason, setOdhexRejectReason] = useState("");
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [amountFilter, setAmountFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [withdrawalTypeFilter, setWithdrawalTypeFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  const { adminType } = useAuth();
  const { toast } = useToast();
  const itemsPerPage = 50;

  useEffect(() => {
    let errorTimeout: NodeJS.Timeout;

    // Subscribe to ODHex withdrawals
    const unsubscribeODHex = subscribeToODHexWithdrawals((data) => {
      setODHexWithdrawals(data);
      setLoading(false);
      setConnectionError(false);
    });

    // Set a timeout to show connection error if data doesn't load
    errorTimeout = setTimeout(() => {
      if (loading) {
        setConnectionError(true);
        setLoading(false);
      }
    }, 10000); // 10 seconds

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeODHex();
      clearTimeout(errorTimeout);
    };
  }, []);

  // Group withdrawals by userId + requestedAt with filtering
  const groupedWithdrawals = useMemo(() => {
    let filtered: Withdrawal[] = [];
    if (adminType === "finance") {
      filtered = withdrawals.filter((w) => w.status === "sent");
    } else {
      filtered = withdrawals.filter((w) => w.status === "pending");
    }
    
    // Apply additional filters
    filtered = filtered.filter((withdrawal) => {
      // Search filter
      const matchesSearch = !searchTerm ||
        withdrawal.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.userPhone.includes(searchTerm);
      
      // Status filter (for flexibility in future)
      const matchesStatus = !statusFilter || statusFilter === "all" || withdrawal.status === statusFilter;
      
      // Amount filter
      let matchesAmount = true;
      if (amountFilter && amountFilter !== "all") {
        switch (amountFilter) {
          case "low":
            matchesAmount = withdrawal.amount < 10000;
            break;
          case "medium":
            matchesAmount = withdrawal.amount >= 10000 && withdrawal.amount < 50000;
            break;
          case "high":
            matchesAmount = withdrawal.amount >= 50000;
            break;
        }
      }
      
      // Custom amount range
      if (minAmount && withdrawal.amount < parseFloat(minAmount)) matchesAmount = false;
      if (maxAmount && withdrawal.amount > parseFloat(maxAmount)) matchesAmount = false;
      
      // Payment method filter
      const matchesPaymentMethod = !paymentMethodFilter || 
        withdrawal.paymentMethod.toLowerCase().includes(paymentMethodFilter.toLowerCase());
      
      // Withdrawal type filter
      const matchesType = !withdrawalTypeFilter || 
        (withdrawalTypeFilter === "pooled" && withdrawal.isPooled) ||
        (withdrawalTypeFilter === "regular" && !withdrawal.isPooled);
      
      // Date range filter
      let matchesDate = true;
      if (dateFromFilter) {
        const withdrawalDate = new Date(withdrawal.requestedAt);
        const fromDate = new Date(dateFromFilter);
        matchesDate = withdrawalDate >= fromDate;
      }
      if (dateToFilter && matchesDate) {
        const withdrawalDate = new Date(withdrawal.requestedAt);
        const toDate = new Date(dateToFilter + "T23:59:59"); // Include full day
        matchesDate = withdrawalDate <= toDate;
      }
      
      return matchesSearch && matchesStatus && matchesAmount && matchesPaymentMethod && matchesType && matchesDate;
    });
    
    const groups = new Map<string, GroupedWithdrawal>();
    filtered.forEach((withdrawal) => {
      const key = `${withdrawal.userId}_${withdrawal.requestedAt}`;
      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.withdrawals.push(withdrawal);
        group.amount += withdrawal.amount;
      } else {
        groups.set(key, {
          id: key,
          userId: withdrawal.userId,
          userName: withdrawal.userName,
          userEmail: withdrawal.userEmail,
          userPhone: withdrawal.userPhone,
          amount: withdrawal.amount,
          requestedAt: withdrawal.requestedAt,
          paymentMethod: withdrawal.paymentMethod,
          isPooled: withdrawal.isPooled,
          withdrawals: [withdrawal],
        });
      }
    });
    return Array.from(groups.values());
  }, [withdrawals, adminType, searchTerm, statusFilter, amountFilter, paymentMethodFilter, withdrawalTypeFilter, dateFromFilter, dateToFilter, minAmount, maxAmount]);

  // Group history withdrawals (processed) with filtering
  const groupedHistory = useMemo(() => {
    let history = withdrawals.filter(
      (w) => w.status === "approved" || w.status === "sent" || w.status === "returned"
    );
    
    // Apply the same filters as pending withdrawals
    history = history.filter((withdrawal) => {
      // Search filter
      const matchesSearch = !searchTerm ||
        withdrawal.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.userPhone.includes(searchTerm);
      
      // Amount filter
      let matchesAmount = true;
      if (amountFilter && amountFilter !== "all") {
        switch (amountFilter) {
          case "low":
            matchesAmount = withdrawal.amount < 10000;
            break;
          case "medium":
            matchesAmount = withdrawal.amount >= 10000 && withdrawal.amount < 50000;
            break;
          case "high":
            matchesAmount = withdrawal.amount >= 50000;
            break;
        }
      }
      
      // Custom amount range
      if (minAmount && withdrawal.amount < parseFloat(minAmount)) matchesAmount = false;
      if (maxAmount && withdrawal.amount > parseFloat(maxAmount)) matchesAmount = false;
      
      // Payment method filter
      const matchesPaymentMethod = !paymentMethodFilter || paymentMethodFilter === "all" || 
        withdrawal.paymentMethod.toLowerCase().includes(paymentMethodFilter.toLowerCase());
      
      // Withdrawal type filter
      const matchesType = !withdrawalTypeFilter || withdrawalTypeFilter === "all" || 
        (withdrawalTypeFilter === "pooled" && withdrawal.isPooled) ||
        (withdrawalTypeFilter === "regular" && !withdrawal.isPooled);
      
      // Date range filter
      let matchesDate = true;
      if (dateFromFilter) {
        const withdrawalDate = new Date(withdrawal.requestedAt);
        const fromDate = new Date(dateFromFilter);
        matchesDate = withdrawalDate >= fromDate;
      }
      if (dateToFilter && matchesDate) {
        const withdrawalDate = new Date(withdrawal.requestedAt);
        const toDate = new Date(dateToFilter + "T23:59:59");
        matchesDate = withdrawalDate <= toDate;
      }
      
      return matchesSearch && matchesAmount && matchesPaymentMethod && matchesType && matchesDate;
    });
    
    const groups = new Map<string, GroupedWithdrawal>();

    history.forEach((withdrawal) => {
      const key = `${withdrawal.userId}_${withdrawal.requestedAt}`;
      
      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.withdrawals.push(withdrawal);
        group.amount += withdrawal.amount;
      } else {
        groups.set(key, {
          id: key,
          userId: withdrawal.userId,
          userName: withdrawal.userName,
          userEmail: withdrawal.userEmail,
          userPhone: withdrawal.userPhone,
          amount: withdrawal.amount,
          requestedAt: withdrawal.requestedAt,
          paymentMethod: withdrawal.paymentMethod,
          isPooled: withdrawal.isPooled,
          withdrawals: [withdrawal],
        });
      }
    });

    return Array.from(groups.values());
  }, [withdrawals, searchTerm, amountFilter, paymentMethodFilter, withdrawalTypeFilter, dateFromFilter, dateToFilter, minAmount, maxAmount]);

  // Group returns (rejected by finance, for developer admin only) with filtering
  const groupedReturns = useMemo(() => {
    let returns = withdrawals.filter((w) => w.status === "rejected");
    
    // Apply the same filters as other tabs
    returns = returns.filter((withdrawal) => {
      // Search filter
      const matchesSearch = !searchTerm ||
        withdrawal.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        withdrawal.userPhone.includes(searchTerm);
      
      // Amount filter
      let matchesAmount = true;
      if (amountFilter && amountFilter !== "all") {
        switch (amountFilter) {
          case "low":
            matchesAmount = withdrawal.amount < 10000;
            break;
          case "medium":
            matchesAmount = withdrawal.amount >= 10000 && withdrawal.amount < 50000;
            break;
          case "high":
            matchesAmount = withdrawal.amount >= 50000;
            break;
        }
      }
      
      // Custom amount range
      if (minAmount && withdrawal.amount < parseFloat(minAmount)) matchesAmount = false;
      if (maxAmount && withdrawal.amount > parseFloat(maxAmount)) matchesAmount = false;
      
      // Payment method filter
      const matchesPaymentMethod = !paymentMethodFilter || paymentMethodFilter === "all" || 
        withdrawal.paymentMethod.toLowerCase().includes(paymentMethodFilter.toLowerCase());
      
      // Withdrawal type filter
      const matchesType = !withdrawalTypeFilter || withdrawalTypeFilter === "all" || 
        (withdrawalTypeFilter === "pooled" && withdrawal.isPooled) ||
        (withdrawalTypeFilter === "regular" && !withdrawal.isPooled);
      
      // Date range filter
      let matchesDate = true;
      if (dateFromFilter) {
        const withdrawalDate = new Date(withdrawal.requestedAt);
        const fromDate = new Date(dateFromFilter);
        matchesDate = withdrawalDate >= fromDate;
      }
      if (dateToFilter && matchesDate) {
        const withdrawalDate = new Date(withdrawal.requestedAt);
        const toDate = new Date(dateToFilter + "T23:59:59");
        matchesDate = withdrawalDate <= toDate;
      }
      
      return matchesSearch && matchesAmount && matchesPaymentMethod && matchesType && matchesDate;
    });
    
    const groups = new Map<string, GroupedWithdrawal>();

    returns.forEach((withdrawal) => {
      const key = `${withdrawal.userId}_${withdrawal.requestedAt}`;
      
      if (groups.has(key)) {
        const group = groups.get(key)!;
        group.withdrawals.push(withdrawal);
        group.amount += withdrawal.amount;
      } else {
        groups.set(key, {
          id: key,
          userId: withdrawal.userId,
          userName: withdrawal.userName,
          userEmail: withdrawal.userEmail,
          userPhone: withdrawal.userPhone,
          amount: withdrawal.amount,
          requestedAt: withdrawal.requestedAt,
          paymentMethod: withdrawal.paymentMethod,
          isPooled: withdrawal.isPooled,
          withdrawals: [withdrawal],
        });
      }
    });

    return Array.from(groups.values());
  }, [withdrawals, searchTerm, amountFilter, paymentMethodFilter, withdrawalTypeFilter, dateFromFilter, dateToFilter, minAmount, maxAmount]);

  // Filter ODHex withdrawals with search and filters
  const filteredODHexWithdrawals = useMemo(() => {
    let filtered = odhexWithdrawals.filter((w) => {
      // Search filter
      const matchesSearch = !searchTerm ||
        w.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.accountDetails.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.provider.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Amount filter
      let matchesAmount = true;
      if (amountFilter && amountFilter !== "all") {
        switch (amountFilter) {
          case "low":
            matchesAmount = w.amount < 10000;
            break;
          case "medium":
            matchesAmount = w.amount >= 10000 && w.amount < 50000;
            break;
          case "high":
            matchesAmount = w.amount >= 50000;
            break;
        }
      }
      
      // Custom amount range
      if (minAmount && w.amount < parseFloat(minAmount)) matchesAmount = false;
      if (maxAmount && w.amount > parseFloat(maxAmount)) matchesAmount = false;
      
      // Payment method filter (provider in ODHex)
      const matchesPaymentMethod = !paymentMethodFilter || paymentMethodFilter === "all" || 
        w.provider.toLowerCase().includes(paymentMethodFilter.toLowerCase());

      // Withdrawal method filter (ODHex method: ewallet | bank)
      const matchesMethod = !withdrawalTypeFilter || withdrawalTypeFilter === "all" ||
        w.method.toLowerCase() === withdrawalTypeFilter.toLowerCase();

      // Status filter (history statuses)
      const matchesStatus = !statusFilter || statusFilter === "all" ||
        w.status.toLowerCase() === statusFilter.toLowerCase();
      
      // Date range filter
      let matchesDate = true;
      if (dateFromFilter) {
        const withdrawalDate = new Date(w.requestedAt);
        const fromDate = new Date(dateFromFilter);
        matchesDate = withdrawalDate >= fromDate;
      }
      if (dateToFilter && matchesDate) {
        const withdrawalDate = new Date(w.requestedAt);
        const toDate = new Date(dateToFilter + "T23:59:59");
        matchesDate = withdrawalDate <= toDate;
      }
      
      return matchesSearch && matchesAmount && matchesPaymentMethod && matchesMethod && matchesStatus && matchesDate;
    });
    
    return filtered;
  }, [odhexWithdrawals, searchTerm, amountFilter, paymentMethodFilter, withdrawalTypeFilter, statusFilter, dateFromFilter, dateToFilter, minAmount, maxAmount]);

  const odhexActiveWithdrawals = filteredODHexWithdrawals.filter((w) => w.status === "pending");
  const odhexHistoryWithdrawals = filteredODHexWithdrawals.filter(
    (w) => w.status === "completed" || w.status === "rejected"
  );

  const totalPages = Math.ceil(groupedWithdrawals.length / itemsPerPage);
  const historyTotalPages = Math.ceil(odhexHistoryWithdrawals.length / itemsPerPage);
  const returnsTotalPages = Math.ceil(groupedReturns.length / itemsPerPage);
  const odhexTotalPages = Math.ceil(odhexActiveWithdrawals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const historyStartIndex = (historyPage - 1) * itemsPerPage;
  const returnsStartIndex = (returnsPage - 1) * itemsPerPage;
  const odhexStartIndex = (odhexPage - 1) * itemsPerPage;
  const paginatedGroups = groupedWithdrawals.slice(
    startIndex,
    startIndex + itemsPerPage
  );
  const paginatedHistory = odhexHistoryWithdrawals.slice(
    historyStartIndex,
    historyStartIndex + itemsPerPage
  );
  const paginatedReturns = groupedReturns.slice(
    returnsStartIndex,
    returnsStartIndex + itemsPerPage
  );
  const paginatedODHex = odhexActiveWithdrawals.slice(
    odhexStartIndex,
    odhexStartIndex + itemsPerPage
  );

  const handleSelectAll = () => {
    if (selectedGroupIds.length === groupedWithdrawals.length) {
      setSelectedGroupIds([]);
    } else {
      setSelectedGroupIds(groupedWithdrawals.map((g) => g.id));
    }
  };

  const handleSelectGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((i) => i !== groupId) : [...prev, groupId]
    );
  };

  const handleViewDetails = (group: GroupedWithdrawal) => {
    setSelectedGroup(group);
    setDetailsModalOpen(true);
  };

  const handleApproveGroup = async (group: GroupedWithdrawal) => {
    const withdrawalIds = group.withdrawals.map(w => w.id);
    if (adminType === "finance") {
      // Finance approves
      const promises = withdrawalIds.map((id) =>
        updateWithdrawalStatus(id, "approved", adminType || "")
      );
      const results = await Promise.all(promises);
      const allSuccess = results.every(r => r);
      if (allSuccess) {
        toast({
          title: "Withdrawal Approved",
          description: `₱${group.amount.toLocaleString()} payment has been processed successfully.`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to approve some withdrawals.",
          variant: "destructive",
        });
      }
    } else {
      // Developer admin sends to finance
      const promises = withdrawalIds.map((id) =>
        updateWithdrawalStatus(id, "sent", adminType || "")
      );
      await Promise.all(promises);
      toast({
        title: "Sent to Finance",
        description: `Withdrawal request sent to finance team for processing.`,
      });
    }
  };

  const handleRejectGroup = (group: GroupedWithdrawal) => {
    setRejectGroup(group);
    setRejectNote("");
    setRejectModalOpen(true);
  };

  const confirmRejectGroup = async () => {
    if (!rejectGroup) return;
    if (!rejectNote.trim()) {
      toast({
        title: "Note Required",
        description: "Please provide a reason for rejection.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const withdrawalIds = rejectGroup.withdrawals.map(w => w.id);
      const promises = withdrawalIds.map((id) =>
        updateWithdrawalStatus(id, "rejected", adminType || "", rejectNote)
      );
      await Promise.all(promises);
      
      toast({
        title: "Withdrawal Rejected",
        description: "Withdrawal(s) have been rejected and returned to the developer admin.",
        variant: "destructive",
      });
      
      // Close modal and reset state after successful submission
      setRejectModalOpen(false);
      setRejectGroup(null);
      setRejectNote("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject withdrawal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToUser = (group: GroupedWithdrawal) => {
    setReturnGroup(group);
    setReturnNote("");
    setReturnModalOpen(true);
  };

  const confirmReturnToUser = async () => {
    if (!returnGroup) return;
    if (!returnNote.trim()) {
      toast({
        title: "Note Required",
        description: "Please add a note for the user.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const withdrawalIds = returnGroup.withdrawals.map(w => w.id);
      const promises = withdrawalIds.map((id) =>
        updateWithdrawalStatus(id, "returned", adminType || "", returnNote)
      );
      await Promise.all(promises);
      
      toast({
        title: "Returned to User",
        description: "Withdrawal(s) have been returned to the user with your note.",
      });
      
      // Close modal and reset state after successful submission
      setReturnModalOpen(false);
      setReturnGroup(null);
      setReturnNote("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to return withdrawal. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveSelected = async () => {
    if (adminType !== "finance") {
      toast({
        title: "Unauthorized",
        description: "Only finance admin can approve withdrawals.",
        variant: "destructive",
      });
      return;
    }

    if (selectedGroupIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one withdrawal to approve.",
        variant: "destructive",
      });
      return;
    }

    const selectedGroups = groupedWithdrawals.filter(g => selectedGroupIds.includes(g.id));
    const allWithdrawalIds = selectedGroups.flatMap(g => g.withdrawals.map(w => w.id));
    
    const promises = allWithdrawalIds.map((id) =>
      updateWithdrawalStatus(id, "approved", adminType)
    );
    
    await Promise.all(promises);
    setSelectedGroupIds([]);
    
    toast({
      title: "Withdrawals Approved",
      description: `${selectedGroups.length} withdrawal request(s) have been approved.`,
    });
  };

  const handleSendAll = async () => {
    if (groupedWithdrawals.length === 0) {
      toast({
        title: "No Withdrawals",
        description: "There are no pending withdrawals to send.",
        variant: "destructive",
      });
      return;
    }

    const allWithdrawalIds = groupedWithdrawals.flatMap(g => g.withdrawals.map(w => w.id));
    const promises = allWithdrawalIds.map((id) =>
      updateWithdrawalStatus(id, "sent", adminType || "")
    );
    await Promise.all(promises);

    toast({
      title: "Sent to Finance",
      description: `${groupedWithdrawals.length} withdrawal(s) sent to finance team for approval.`,
    });
  };
  
  // ODHex Withdrawal Handlers
  const handleApproveODHex = async (withdrawal: ODHexWithdrawal) => {
    try {
      await updateODHexWithdrawalStatus(withdrawal.id, "completed", adminType || "");
      toast({
        title: "Withdrawal Approved",
        description: `₱${withdrawal.amount.toLocaleString()} withdrawal to ${withdrawal.provider} has been marked as completed.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve withdrawal. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRejectODHex = async (withdrawal: ODHexWithdrawal, reason: string) => {
    try {
      await updateODHexWithdrawalStatus(withdrawal.id, "rejected", adminType || "", reason);
      toast({
        title: "Withdrawal Rejected",
        description: `Withdrawal has been rejected.`,
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject withdrawal. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setAmountFilter("all");
    setPaymentMethodFilter("all");
    setWithdrawalTypeFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setMinAmount("");
    setMaxAmount("");
    setCurrentPage(1);
    setHistoryPage(1);
    setReturnsPage(1);
    setOdhexPage(1);
  };
  
  const hasActiveFilters = searchTerm || (statusFilter !== "all") || (amountFilter !== "all") || (paymentMethodFilter !== "all") || (withdrawalTypeFilter !== "all") || dateFromFilter || dateToFilter || minAmount || maxAmount;

  const isFinanceAdmin = adminType === "finance";

  if (loading) {
    return (
      <div className="p-2 sm:p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading withdrawals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0">
      {connectionError && (
        <div className="mb-4 p-2 sm:p-3 md:p-4 mx-2 sm:mx-4 md:mx-6 lg:mx-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <IconX className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm md:text-base text-red-800 dark:text-red-300 mb-1">Connection Issue</h3>
              <p className="text-xs md:text-sm text-red-700 dark:text-red-400 mb-2">
                Unable to establish real-time connection to the database. Data may not be up to date.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="text-xs md:text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6 px-2 sm:px-4 md:px-6 lg:px-8">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold">ODHex Withdrawals</h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            {isFinanceAdmin
              ? "Review and process ODHex withdrawal requests"
              : "View ODHex withdrawal requests"}
          </p>
        </div>
      </div>
      
      {/* Search and Filters */}
      <div className="mb-6 px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
          <div className="relative flex-1 sm:max-w-md">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                setHistoryPage(1);
                setReturnsPage(1);
              }}
              placeholder="Search by email, user ID, account or provider..."
              className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <IconFilter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <div className="w-2 h-2 bg-primary rounded-full" />
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <IconX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* Amount Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount Range</label>
                <Select value={amountFilter} onValueChange={setAmountFilter}>
                  <SelectTrigger className="h-9">
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
              
              {/* Payment Method */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="maya">Maya</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Withdrawal Method */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Withdrawal Method</label>
                <Select value={withdrawalTypeFilter} onValueChange={setWithdrawalTypeFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="ewallet">E-wallet</SelectItem>
                    <SelectItem value="bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={dateFromFilter}
                    onChange={(e) => setDateFromFilter(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={dateToFilter}
                    onChange={(e) => setDateToFilter(e.target.value)}
                    className="h-9 text-xs"
                    placeholder="To"
                  />
                </div>
              </div>
              
              {/* Custom Amount Range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Custom Amount</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Min ₱"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="h-9 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="Max ₱"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {activeTab === "odhex" ? odhexActiveWithdrawals.length : odhexHistoryWithdrawals.length} withdrawals
              {hasActiveFilters && " (filtered)"}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border overflow-x-auto px-2 sm:px-4 md:px-6 lg:px-8">
        <button
          onClick={() => setActiveTab("odhex")}
          className={`px-2 sm:px-3 md:px-4 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "odhex"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          ODHex Withdrawals ({odhexActiveWithdrawals.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-2 sm:px-3 md:px-4 py-2 text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          History ({odhexHistoryWithdrawals.length})
        </button>
      </div>

      {activeTab === "history" && (
      odhexHistoryWithdrawals.length === 0 ? (
      <div className="bg-card border border-border rounded-lg p-6 sm:p-8 text-center text-muted-foreground mx-2 sm:mx-4 md:mx-6 lg:mx-8">
        No ODHex history found
      </div>
      ) : (
      <div className="bg-card border border-border rounded-lg">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  User
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Method
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Processed At
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.map((withdrawal, index) => {
                return (
                  <tr
                    key={withdrawal.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">{historyStartIndex + index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{withdrawal.userEmail}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">ID: {withdrawal.userId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold">₱{withdrawal.amount.toLocaleString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm capitalize">{withdrawal.method} • {withdrawal.provider}</div>
                      <div className="text-xs text-muted-foreground font-mono">{withdrawal.accountDetails}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {withdrawal.processedAt 
                        ? new Date(withdrawal.processedAt).toLocaleString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        withdrawal.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {withdrawal.status === "completed" ? "Completed" : "Rejected"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedOdhexWithdrawal(withdrawal);
                          setOdhexViewModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <IconEye className="h-3.5 w-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {odhexHistoryWithdrawals.length > 0 && (
          <div className="p-4 border-t border-border flex justify-end">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                    className={historyPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setHistoryPage(page)}
                      isActive={page === historyPage}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setHistoryPage(Math.min(historyTotalPages, historyPage + 1))}
                    className={historyPage === historyTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

      </div>
      )
      )}


      {/* ODHex Withdrawals Tab */}
      {activeTab === "odhex" && (
      odhexActiveWithdrawals.length === 0 ? (
      <div className="bg-card border border-border rounded-lg p-6 sm:p-8 text-center text-muted-foreground mx-2 sm:mx-4 md:mx-6 lg:mx-8">
        No active ODHex withdrawals
      </div>
      ) : (
      <div className="bg-card border border-border rounded-lg">
        <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  User
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Method
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Provider
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Account
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Requested
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedODHex.map((withdrawal) => (
                <tr key={withdrawal.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{withdrawal.userEmail}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      ID: {withdrawal.userId}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-foreground">
                      ₱{withdrawal.amount.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {withdrawal.amount.toLocaleString()} KOLI
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm capitalize">{withdrawal.method}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{withdrawal.provider}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-mono">{withdrawal.accountDetails}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground">
                      {new Date(withdrawal.requestedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(withdrawal.requestedAt).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      withdrawal.status === "pending" 
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        : withdrawal.status === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {withdrawal.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOdhexWithdrawal(withdrawal);
                          setOdhexViewModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 transition-colors"
                        title="View withdrawal details"
                      >
                        <IconEye className="h-3 w-3" />
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {odhexTotalPages > 1 && (
          <div className="p-4 border-t border-border">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setOdhexPage(Math.max(1, odhexPage - 1))}
                    className={odhexPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: odhexTotalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setOdhexPage(page)}
                      isActive={page === odhexPage}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setOdhexPage(Math.min(odhexTotalPages, odhexPage + 1))}
                    className={odhexPage === odhexTotalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}

      </div>
      )
      )}

      {/* Reject Modal (Finance Admin) */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejection. This will be sent to the developer admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              rows={4}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Enter reason for rejection (e.g., Invalid bank account, insufficient documentation, etc.)"
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setRejectModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmRejectGroup}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Reject Withdrawal"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return to User Modal (Developer Admin) */}
      <Dialog open={returnModalOpen} onOpenChange={setReturnModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Return Withdrawal to User</DialogTitle>
            <DialogDescription>
              Review the finance team's note and add your message for the user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Finance Team Note:</label>
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded text-sm">
                {returnGroup?.withdrawals[0].financeNote || "No note provided"}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Your Note to User:</label>
              <Textarea
                rows={4}
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                placeholder="Enter your message for the user explaining why the withdrawal was rejected and what they need to do..."
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setReturnModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmReturnToUser}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send to User"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">Withdrawal Request Details</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Breakdown of all withdrawals in this request
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="bg-muted/50 p-3 md:p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">User</p>
                    <p className="font-medium">{selectedGroup.userName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedGroup.userEmail}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedGroup.userPhone}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment Method</p>
                    <p className="font-medium">{selectedGroup.paymentMethod}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Session ID</p>
                    <p className="font-medium text-xs">{selectedGroup.withdrawals[0].withdrawalSessionId || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Requested At</p>
                    <p className="font-medium">{new Date(selectedGroup.requestedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Amount Breakdown */}
              <div className="bg-blue-50 border border-blue-200 p-3 md:p-4 rounded-lg">
                <h3 className="font-semibold text-xs md:text-sm mb-3 text-blue-900">Amount Breakdown</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-blue-700">Gross Amount</p>
                    <p className="font-bold text-blue-900">₱{(selectedGroup.withdrawals[0].grossAmount || selectedGroup.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Platform Fee ({
                      selectedGroup.withdrawals[0].platformFee && selectedGroup.withdrawals[0].grossAmount 
                        ? ((selectedGroup.withdrawals[0].platformFee / selectedGroup.withdrawals[0].grossAmount) * 100).toFixed(1)
                        : '0.0'
                    }%)</p>
                    <p className="font-bold text-red-600">-₱{(selectedGroup.withdrawals[0].platformFee || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Net Amount</p>
                    <p className="font-bold text-green-600">₱{(selectedGroup.withdrawals[0].netAmount || selectedGroup.withdrawals[0].amount || selectedGroup.amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-blue-700">Total Withdrawable Balance</p>
                    <p className="font-medium text-blue-900">₱{(selectedGroup.withdrawals[0].totalWithdrawableBalance || selectedGroup.withdrawals[0].remainingBalance || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {selectedGroup.withdrawals[0].totalWithdrawableBalance 
                        ? "Calculated using calculateTotalWithdrawable logic" 
                        : "⚠️ Using legacy remainingBalance field - update your withdrawal creation code"
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              {(selectedGroup.withdrawals[0].financeNote || selectedGroup.withdrawals[0].mainAdminNote) && (
                <div className="space-y-2">
                  {selectedGroup.withdrawals[0].financeNote && (
                    <div className="bg-red-50 border border-red-200 p-3 rounded">
                      <p className="text-sm font-medium text-red-900 mb-1">Finance Team Note:</p>
                      <p className="text-sm text-red-800">{selectedGroup.withdrawals[0].financeNote}</p>
                    </div>
                  )}
                  {selectedGroup.withdrawals[0].mainAdminNote && (
                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded">
                      <p className="text-sm font-medium text-yellow-900 mb-1">Admin Note:</p>
                      <p className="text-sm text-yellow-800">{selectedGroup.withdrawals[0].mainAdminNote}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Withdrawal Policy Info */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded">
                <p className="text-sm font-medium text-blue-900 mb-1">Withdrawal Policy:</p>
                <ul className="text-sm text-blue-800 space-y-1 ml-4 list-disc">
                  <li>Users can only submit one withdrawal request at a time</li>
                  <li>New withdrawals are blocked until current request is approved or successful</li>
                  <li>If rejected, the money is returned to user's withdrawable pool automatically</li>
                  <li>Platform fee is deducted from gross amount before payout</li>
                </ul>
              </div>

              {/* Individual Withdrawals */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Individual Withdrawals ({selectedGroup.withdrawals.length})</h3>
                <div className="space-y-2">
                  {selectedGroup.withdrawals.map((withdrawal, idx) => (
                    <div key={withdrawal.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-medium">
                            Contract: {withdrawal.contractId.slice(-8)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-primary">
                            ₱{(withdrawal.netAmount || withdrawal.amount).toLocaleString()}
                          </div>
                          {withdrawal.platformFee && (
                            <div className="text-xs text-red-600">
                              Fee: ₱{withdrawal.platformFee.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
                        <div>
                          <span className="font-medium">Withdrawal #:</span> {withdrawal.withdrawalNumber}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {withdrawal.isPooled ? 'Pooled' : 'Regular'}
                        </div>
                        <div>
                          <span className="font-medium">Total W/D:</span> {withdrawal.totalWithdrawals}
                        </div>
                        <div>
                          <span className="font-medium">Total Withdrawn:</span> ₱{(withdrawal.totalWithdrawnSoFar || 0).toLocaleString()}
                        </div>
                        {withdrawal.isPooled && withdrawal.periodsWithdrawn && (
                          <div>
                            <span className="font-medium">Periods:</span> {withdrawal.periodsWithdrawn}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Remaining:</span> ₱{(withdrawal.totalWithdrawableBalance || withdrawal.remainingBalance || 0).toLocaleString()}
                          {!withdrawal.totalWithdrawableBalance && withdrawal.remainingBalance && (
                            <span className="text-red-500 ml-1 text-xs">⚠️</span>
                          )}
                        </div>
                      </div>

                      {/* Amount Details */}
                      {(withdrawal.grossAmount || withdrawal.platformFee) && (
                        <div className="bg-gray-50 p-2 rounded text-xs mb-2">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="font-medium text-gray-600">Gross:</span>
                              <div className="font-semibold">₱{(withdrawal.grossAmount || withdrawal.amount).toLocaleString()}</div>
                            </div>
                            <div>
                              <span className="font-medium text-red-600">Platform Fee:</span>
                              <div className="font-semibold text-red-700">₱{(withdrawal.platformFee || 0).toLocaleString()}</div>
                            </div>
                            <div>
                              <span className="font-medium text-green-600">Net Amount:</span>
                              <div className="font-semibold text-green-700">₱{(withdrawal.netAmount || withdrawal.amount).toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {withdrawal.notes && (
                        <div className="mt-2 text-xs bg-muted/50 p-2 rounded">
                          <span className="font-medium">Notes:</span> {withdrawal.notes}
                        </div>
                      )}
                      {withdrawal.gcashNumber && (
                        <div className="mt-2 text-xs">
                          <span className="font-medium">GCash:</span> {withdrawal.gcashNumber}
                        </div>
                      )}
                      {withdrawal.transactionProof && (
                        <div className="mt-2 text-xs">
                          <span className="font-medium">Transaction Proof:</span> 
                          <a href={withdrawal.transactionProof} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">
                            View Proof
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ODHex Withdrawal View Modal */}
      <Dialog open={odhexViewModalOpen} onOpenChange={(open) => {
        setOdhexViewModalOpen(open);
        if (!open) {
          setSelectedOdhexWithdrawal(null);
          setOdhexRejectReason("");
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">ODHex Withdrawal Details</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              Review withdrawal information and take action
            </DialogDescription>
          </DialogHeader>
          {selectedOdhexWithdrawal && (
            <div className="space-y-4">
              {/* User Information */}
              <div className="bg-muted/50 p-3 md:p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-sm md:text-base">User Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Email:</span>
                    <div className="mt-1">{selectedOdhexWithdrawal.userEmail}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">User ID:</span>
                    <div className="mt-1 font-mono text-xs">{selectedOdhexWithdrawal.userId}</div>
                  </div>
                </div>
              </div>

              {/* Withdrawal Details */}
              <div className="bg-muted/50 p-3 md:p-4 rounded-lg">
                <h3 className="font-semibold mb-3 text-sm md:text-base">Withdrawal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">Amount:</span>
                    <div className="mt-1 text-lg font-bold">₱{selectedOdhexWithdrawal.amount.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">{selectedOdhexWithdrawal.amount.toLocaleString()} KOLI</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Status:</span>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        selectedOdhexWithdrawal.status === "pending" 
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : selectedOdhexWithdrawal.status === "completed"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {selectedOdhexWithdrawal.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Method:</span>
                    <div className="mt-1 capitalize">{selectedOdhexWithdrawal.method}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Provider:</span>
                    <div className="mt-1 font-medium">{selectedOdhexWithdrawal.provider}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Account Details:</span>
                    <div className="mt-1 font-mono text-xs">{selectedOdhexWithdrawal.accountDetails}</div>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Requested:</span>
                    <div className="mt-1 text-xs">
                      {new Date(selectedOdhexWithdrawal.requestedAt).toLocaleString()}
                    </div>
                  </div>
                  {selectedOdhexWithdrawal.processedAt && (
                    <div>
                      <span className="font-medium text-muted-foreground">Processed:</span>
                      <div className="mt-1 text-xs">
                        {new Date(selectedOdhexWithdrawal.processedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                  {selectedOdhexWithdrawal.processedBy && (
                    <div>
                      <span className="font-medium text-muted-foreground">Processed By:</span>
                      <div className="mt-1 text-xs">{selectedOdhexWithdrawal.processedBy}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedOdhexWithdrawal.status === "rejected" && selectedOdhexWithdrawal.rejectionReason && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                  <h3 className="font-semibold text-red-800 dark:text-red-300 mb-2">Rejection Reason</h3>
                  <p className="text-sm text-red-700 dark:text-red-400">{selectedOdhexWithdrawal.rejectionReason}</p>
                </div>
              )}

              {/* Action Buttons (finance only, and only if pending) */}
              {selectedOdhexWithdrawal.status === "pending" && isFinanceAdmin && (
                <div className="border-t pt-4 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={async () => {
                        await handleApproveODHex(selectedOdhexWithdrawal);
                        setOdhexViewModalOpen(false);
                        setSelectedOdhexWithdrawal(null);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <IconCheck className="h-4 w-4" />
                      Complete Withdrawal
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rejection Reason</label>
                    <Textarea
                      value={odhexRejectReason}
                      onChange={(e) => setOdhexRejectReason(e.target.value)}
                      placeholder="Enter reason for rejection..."
                      className="min-h-[80px]"
                    />
                    <button
                      onClick={async () => {
                        if (!odhexRejectReason.trim()) {
                          toast({
                            title: "Error",
                            description: "Please enter a rejection reason.",
                            variant: "destructive",
                          });
                          return;
                        }
                        await handleRejectODHex(selectedOdhexWithdrawal, odhexRejectReason);
                        setOdhexViewModalOpen(false);
                        setSelectedOdhexWithdrawal(null);
                        setOdhexRejectReason("");
                      }}
                      disabled={!odhexRejectReason.trim()}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <IconX className="h-4 w-4" />
                      Reject Withdrawal
                    </button>
                  </div>
                </div>
              )}

              {selectedOdhexWithdrawal.status === "pending" && !isFinanceAdmin && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">
                    View only. Only finance admin can process ODHex withdrawals.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Withdrawals;