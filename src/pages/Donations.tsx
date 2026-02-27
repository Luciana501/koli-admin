import React, { useState, useEffect, useMemo } from "react";
import { Donation } from "@/types/admin";
import { subscribeToDonations, updateDonationStatus } from "@/services/firestore";
import { IconX, IconEye, IconDownload, IconFilter, IconSearch } from "@tabler/icons-react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { ref, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import PageLoading from "@/components/PageLoading";

const Donations = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string>("");
  const [zoomModalOpen, setZoomModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approvingDonation, setApprovingDonation] = useState<Donation | null>(null);
  const [verifiedAmountInput, setVerifiedAmountInput] = useState("");
  const [approvalReviewNote, setApprovalReviewNote] = useState("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingDonation, setRejectingDonation] = useState<Donation | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const { toast } = useToast();
  const { adminType } = useAuth();
  const isFinanceAdmin = adminType === "finance";
  const [searchTerm, setSearchTerm] = useState("");
  const [amountFilter, setAmountFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 50;

  useEffect(() => {
    // Subscribe to real-time donations updates
    const unsubscribe = subscribeToDonations((data) => {
      setDonations(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const pendingDonations = useMemo(
    () =>
      [...donations]
        .filter((donation) => donation.status === "pending")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [donations]
  );

  const historySourceDonations = useMemo(
    () => donations.filter((donation) => donation.status !== "pending"),
    [donations]
  );

  const historyDonations = useMemo(() => {
    return historySourceDonations.filter((donation) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        (donation.userName || "").toLowerCase().includes(normalizedSearch) ||
        (donation.userEmail || "").toLowerCase().includes(normalizedSearch) ||
        donation.userId.toLowerCase().includes(normalizedSearch);

      let matchesAmount = true;
      const effectiveAmount = donation.verifiedAmount ?? donation.donationAmount;
      if (amountFilter && amountFilter !== "all") {
        switch (amountFilter) {
          case "discrepancy":
            matchesAmount = Boolean(donation.hasDiscrepancy);
            break;
          case "low":
            matchesAmount = effectiveAmount < 10000;
            break;
          case "medium":
            matchesAmount = effectiveAmount >= 10000 && effectiveAmount < 50000;
            break;
          case "high":
            matchesAmount = effectiveAmount >= 50000;
            break;
        }
      }

      if (minAmount && effectiveAmount < parseFloat(minAmount)) matchesAmount = false;
      if (maxAmount && effectiveAmount > parseFloat(maxAmount)) matchesAmount = false;

      const matchesPaymentMethod =
        !paymentMethodFilter ||
        paymentMethodFilter === "all" ||
        donation.paymentMethod.toLowerCase().includes(paymentMethodFilter.toLowerCase());

      let matchesDate = true;
      if (dateFromFilter) {
        const donationDate = new Date(donation.createdAt);
        const fromDate = new Date(dateFromFilter);
        matchesDate = donationDate >= fromDate;
      }
      if (dateToFilter && matchesDate) {
        const donationDate = new Date(donation.createdAt);
        const toDate = new Date(dateToFilter + "T23:59:59");
        matchesDate = donationDate <= toDate;
      }

      return matchesSearch && matchesAmount && matchesPaymentMethod && matchesDate;
    });
  }, [historySourceDonations, searchTerm, amountFilter, paymentMethodFilter, dateFromFilter, dateToFilter, minAmount, maxAmount]);
  
  const totalPages = Math.ceil(pendingDonations.length / itemsPerPage);
  const historyTotalPages = Math.ceil(historyDonations.length / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const historyStartIndex = (historyPage - 1) * itemsPerPage;
  
  const paginatedDonations = pendingDonations.slice(
    startIndex,
    startIndex + itemsPerPage
  );
  
  const paginatedHistory = historyDonations.slice(
    historyStartIndex,
    historyStartIndex + itemsPerPage
  );

  const hasActiveFilters =
    searchTerm ||
    amountFilter !== "all" ||
    paymentMethodFilter !== "all" ||
    dateFromFilter ||
    dateToFilter ||
    minAmount ||
    maxAmount;

  useEffect(() => {
    setHistoryPage(1);
  }, [searchTerm, amountFilter, paymentMethodFilter, dateFromFilter, dateToFilter, minAmount, maxAmount]);

  const clearFilters = () => {
    setSearchTerm("");
    setAmountFilter("all");
    setPaymentMethodFilter("all");
    setDateFromFilter("");
    setDateToFilter("");
    setMinAmount("");
    setMaxAmount("");
    setCurrentPage(1);
    setHistoryPage(1);
  };

  const openApproveDialog = (donation: Donation) => {
    if (!isFinanceAdmin) {
      toast({
        title: "View Only",
        description: "Only finance admin can approve donations.",
        variant: "destructive",
      });
      return;
    }

    setApprovingDonation(donation);
    setVerifiedAmountInput(String(donation.donationAmount || 0));
    setApprovalReviewNote("");
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!isFinanceAdmin) {
      toast({
        title: "View Only",
        description: "Only finance admin can approve donations.",
        variant: "destructive",
      });
      return;
    }
    if (!approvingDonation) return;

    const verifiedAmount = Number(verifiedAmountInput);
    if (!Number.isFinite(verifiedAmount) || verifiedAmount < 0) {
      toast({
        title: "Invalid Amount",
        description: "Verified amount must be a valid number greater than or equal to 0.",
        variant: "destructive",
      });
      return;
    }

    const declaredAmount = Number(approvingDonation.donationAmount || 0);
    const hasDiscrepancy = verifiedAmount !== declaredAmount;
    if (hasDiscrepancy && !approvalReviewNote.trim()) {
      toast({
        title: "Review Note Required",
        description: "Please add a note explaining the amount discrepancy.",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(approvingDonation.id);
    try {
      await updateDonationStatus(approvingDonation.id, "approved", {
        verifiedAmount,
        reviewNote: approvalReviewNote.trim(),
      });
      toast({
        title: "Success",
        description: hasDiscrepancy
          ? "Donation approved with adjustment."
          : "Donation approved successfully.",
      });

      if (selectedDonation?.id === approvingDonation.id) {
        setSelectedDonation({
          ...selectedDonation,
          status: "approved",
          verifiedAmount,
          discrepancyAmount: declaredAmount - verifiedAmount,
          hasDiscrepancy,
          reviewOutcome: hasDiscrepancy ? "approved_adjusted" : "approved_exact",
          reviewNote: approvalReviewNote.trim(),
        });
      }

      setApproveDialogOpen(false);
      setApprovingDonation(null);
      setVerifiedAmountInput("");
      setApprovalReviewNote("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve donation",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (donation: Donation) => {
    if (!isFinanceAdmin) {
      toast({
        title: "View Only",
        description: "Only finance admin can reject donations.",
        variant: "destructive",
      });
      return;
    }

    setRejectingDonation(donation);
    setRejectionReason(donation.rejectionReason || "");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectingDonation) {
      return;
    }

    const trimmedReason = rejectionReason.trim();
    if (!trimmedReason) {
      toast({
        title: "Reason Required",
        description: "Please provide a rejection reason before rejecting this donation.",
        variant: "destructive",
      });
      return;
    }

    const donationId = rejectingDonation.id;
    setProcessingId(donationId);
    try {
      await updateDonationStatus(donationId, "rejected", {
        rejectionReason: trimmedReason,
      });
      toast({
        title: "Success",
        description: "Donation rejected successfully",
      });

      if (selectedDonation?.id === donationId) {
        setSelectedDonation({
          ...selectedDonation,
          status: "rejected",
          rejectionReason: trimmedReason,
          reviewOutcome: "rejected",
          reviewNote: trimmedReason,
        });
      }

      setRejectDialogOpen(false);
      setRejectingDonation(null);
      setRejectionReason("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject donation",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleViewReceipt = async (donation: Donation) => {
    try {
      console.log("Full donation object:", donation);
      console.log("Receipt URL:", donation.receiptURL);
      console.log("Receipt Path:", donation.receiptPath);
      
      let receiptUrl = donation.receiptURL;
      
      // Always try to get fresh download URL from path if available
      if (donation.receiptPath) {
        console.log("Fetching fresh URL from storage path...");
        try {
          const storageRef = ref(storage, donation.receiptPath);
          const freshUrl = await getDownloadURL(storageRef);
          console.log("âœ… Fresh URL fetched:", freshUrl);
          receiptUrl = freshUrl;
        } catch (error) {
          console.error("Failed to fetch fresh URL, using stored URL:", error);
          // Fall back to stored receiptURL
        }
      }
      
      console.log("Opening donation review modal:", donation.id);
      setSelectedReceiptUrl(receiptUrl || "");
      setSelectedDonation(donation);
      setReceiptModalOpen(true);
    } catch (error) {
      console.error("Error viewing receipt:", error);
      toast({
        title: "Receipt Not Found",
        description: "Failed to load receipt from storage.",
        variant: "destructive",
      });
    }
  };

  const openZoomModal = () => {
    if (!selectedReceiptUrl) return;
    setZoomLevel(1);
    setZoomModalOpen(true);
  };

  const zoomIn = () => setZoomLevel((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
  const zoomOut = () => setZoomLevel((prev) => Math.max(1, Number((prev - 0.25).toFixed(2))));
  const zoomReset = () => setZoomLevel(1);

  const getDisplayStatus = (donation: Donation) => {
    if (donation.status === "rejected") return "Rejected";
    if (["approved", "active"].includes(donation.status)) {
      if (donation.reviewOutcome === "approved_adjusted" || donation.hasDiscrepancy) {
        return "Approved (Adjusted)";
      }
      return "Approved";
    }
    return "Pending";
  };

  const getDiscrepancyText = (donation: Donation) => {
    if (!donation.hasDiscrepancy) return null;
    const diff = Number(donation.discrepancyAmount || 0);
    if (diff > 0) {
      return `Short by ₱${diff.toLocaleString()}`;
    }
    if (diff < 0) {
      return `Over by ₱${Math.abs(diff).toLocaleString()}`;
    }
    return null;
  };

  if (loading) {
    return <PageLoading className="min-h-[16rem]" />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 md:space-y-8 p-2 sm:p-4 md:p-6 lg:p-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Donation Management</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {isFinanceAdmin ? "Review and validate user donation submissions" : "View donation submissions"}
        </p>
      </div>

      {/* Pending Donations Section */}

      <div className="space-y-3 sm:space-y-4 md:space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold">Pending Approvals</h2>
          <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-xs font-medium whitespace-nowrap">
            {pendingDonations.length} Pending
          </div>
        </div>

        {pendingDonations.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-6 sm:p-12 text-center">
            <p className="text-muted-foreground text-sm sm:text-lg">No pending donations at the moment</p>
          </div>
        ) : (
          <>
            <div className="md:hidden max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {paginatedDonations.map((donation) => (
                <div key={donation.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{donation.userName || "Loading..."}</p>
                      <p className="text-xs text-muted-foreground truncate">{donation.userEmail || donation.userId}</p>
                    </div>
                    <span className="text-sm font-bold text-primary whitespace-nowrap">₱{donation.donationAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium capitalize whitespace-nowrap">
                      {donation.paymentMethod}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(donation.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      onClick={() => handleViewReceipt(donation)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium"
                    >
                      <IconEye className="h-3.5 w-3.5" />
                      View
                    </button>
                    {isFinanceAdmin && (
                      <span className="text-xs text-muted-foreground">Review inside View</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">User</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Payment Method</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Created Date</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Receipt</th>
                    </tr>
                  </thead>
                <tbody>
                  {paginatedDonations.map((donation) => (
                    <tr key={donation.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <p className="font-medium text-sm">{donation.userName || "Loading..."}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">{donation.userEmail || donation.userId}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium whitespace-nowrap">
                          ₱{donation.donationAmount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium capitalize whitespace-nowrap">
                          {donation.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {new Date(donation.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleViewReceipt(donation)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium whitespace-nowrap"
                        >
                          <IconEye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          {totalPages > 1 && (
            <div className="mt-7">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => setCurrentPage(page)}
                        isActive={page === currentPage}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}
      </div>

      
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="relative flex-1 max-w-full sm:max-w-md">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search by user name, email, or user ID..."
                className="w-full pl-10 pr-4 py-2 text-sm rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
                {hasActiveFilters && <div className="w-2 h-2 bg-primary rounded-full" />}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <IconX className="h-4 w-4" />
                </Button>
              )}
              <div className="text-sm font-medium text-muted-foreground ml-2">
                Total Donations: {historyDonations.length}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount Range</label>
                  <Select value={amountFilter} onValueChange={setAmountFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Amounts</SelectItem>
                      <SelectItem value="discrepancy">Discrepancies Only</SelectItem>
                      <SelectItem value="low">Low (&lt; ₱10K)</SelectItem>
                      <SelectItem value="medium">Medium (₱10K - ₱50K)</SelectItem>
                      <SelectItem value="high">High (₱50K+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Method</label>
                  <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="gcash">GCash</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="maya">Maya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Date Range</label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={dateFromFilter}
                      onChange={(e) => setDateFromFilter(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <Input
                      type="date"
                      value={dateToFilter}
                      onChange={(e) => setDateToFilter(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

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

              <div className="text-sm text-muted-foreground">
                Showing {historyDonations.length} of {historySourceDonations.length} donations
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Section */}
      <div className="space-y-3 sm:space-y-4 md:space-y-5 mt-8 sm:mt-10 md:mt-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold">Donation History</h2>
          <div className="px-2 sm:px-3 py-1 sm:py-1.5 bg-muted text-muted-foreground rounded-full text-xs font-medium whitespace-nowrap">
            {historyDonations.length} Processed
          </div>
        </div>
        
        {historyDonations.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-6 sm:p-12 text-center">
            <p className="text-muted-foreground text-sm sm:text-lg">No processed donations yet</p>
          </div>
        ) : (
          <>
            <div className="md:hidden max-h-[55vh] overflow-y-auto space-y-3 pr-1">
              {paginatedHistory.map((donation) => (
                <div key={donation.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{donation.userName || "Loading..."}</p>
                      <p className="text-xs text-muted-foreground truncate">{donation.userEmail || donation.userId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold whitespace-nowrap">
                        ₱{(donation.verifiedAmount ?? donation.donationAmount).toLocaleString()}
                      </p>
                      {donation.hasDiscrepancy && (
                        <p className="text-[11px] text-amber-600 whitespace-nowrap">
                          {getDiscrepancyText(donation)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium capitalize whitespace-nowrap">
                      {donation.paymentMethod}
                    </span>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                      ["approved", "active"].includes(donation.status)
                        ? donation.hasDiscrepancy
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-green-500/15 text-green-600"
                        : donation.status === "rejected"
                          ? "bg-red-500/15 text-red-600"
                          : "bg-amber-500/15 text-amber-600"
                    }`}>
                      {getDisplayStatus(donation)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(donation.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    {donation.receiptURL ? (
                      <button
                        onClick={() => handleViewReceipt(donation)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium"
                      >
                        <IconEye className="h-3.5 w-3.5" />
                        View Receipt
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">-</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto max-h-[55vh] overflow-y-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">User</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Amount</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Payment Method</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Created Date</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Status</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground whitespace-nowrap">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((donation) => (
                      <tr key={donation.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <p className="font-medium text-sm">{donation.userName || "Loading..."}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{donation.userEmail || donation.userId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium whitespace-nowrap">
                              ₱{(donation.verifiedAmount ?? donation.donationAmount).toLocaleString()}
                            </span>
                            {donation.hasDiscrepancy && (
                              <p className="text-xs text-amber-700 mt-0.5">{getDiscrepancyText(donation)}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium capitalize whitespace-nowrap">
                            {donation.paymentMethod}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(donation.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs font-semibold ${
                            ["approved", "active"].includes(donation.status)
                              ? donation.hasDiscrepancy
                                ? "bg-amber-500/15 text-amber-700"
                                : "bg-green-500/15 text-green-600"
                              : donation.status === "rejected"
                                ? "bg-red-500/15 text-red-600"
                                : "bg-amber-500/15 text-amber-600"
                          }`}>
                            {getDisplayStatus(donation)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {donation.receiptURL ? (
                            <button
                              onClick={() => handleViewReceipt(donation)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors text-sm font-medium whitespace-nowrap"
                            >
                              <IconEye className="h-4 w-4" />
                              View
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-sm italic">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            {historyTotalPages > 1 && (
              <div className="mt-7">
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
          </>
        )}
      </div>

      {/* Receipt Modal */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-lg sm:text-2xl font-bold">Payment Receipt</DialogTitle>
          </DialogHeader>
          
          {selectedDonation && (
            <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6 overflow-auto max-h-[calc(90vh-180px)]">
              {/* Donation Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Donation Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">User Name</p>
                    <p className="font-semibold">{selectedDonation.userName || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="font-semibold">{selectedDonation.userEmail || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                    <p className="font-semibold">{selectedDonation.userPhone || "N/A"}</p>
                  </div>







                  
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Referral Code</p>
                    <p className="font-semibold text-muted-foreground italic">Coming soon</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Donation Amount</p>
                    <p className="font-semibold text-lg text-primary">₱{selectedDonation.donationAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Verified Amount</p>
                    <p className="font-semibold text-lg">
                      ₱{(selectedDonation.verifiedAmount ?? selectedDonation.donationAmount).toLocaleString()}
                    </p>
                  </div>
                  {selectedDonation.hasDiscrepancy && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Discrepancy</p>
                      <p className="font-semibold text-amber-700">
                        {getDiscrepancyText(selectedDonation)}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                    <span className="inline-flex px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-semibold capitalize">
                      {selectedDonation.paymentMethod}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Submitted Date & Time</p>
                    <p className="font-semibold">
                      {new Date(selectedDonation.createdAt).toLocaleString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      ["approved", "active"].includes(selectedDonation.status)
                        ? selectedDonation.hasDiscrepancy
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-green-500/15 text-green-600"
                        : selectedDonation.status === "rejected"
                        ? "bg-red-500/15 text-red-600"
                        : "bg-amber-500/15 text-amber-600"
                    }`}>
                      {getDisplayStatus(selectedDonation)}
                    </span>
                  </div>
                  {selectedDonation.reviewNote?.trim() && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Review Note</p>
                      <p className="font-semibold whitespace-pre-wrap">
                        {selectedDonation.reviewNote.trim()}
                      </p>
                    </div>
                  )}
                  {selectedDonation.status === "rejected" && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Rejection Reason</p>
                      <p className="font-semibold whitespace-pre-wrap">
                        {selectedDonation.rejectionReason?.trim() || "No rejection reason provided."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Receipt Image */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-lg font-semibold">Receipt Image</h3>
                  {selectedReceiptUrl && (
                    <a
                      href={selectedReceiptUrl}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors font-medium flex-shrink-0 mr-0 sm:mr-4"
                    >
                      <IconDownload className="h-4 w-4" />
                      Download
                    </a>
                  )}
                </div>

                {/* Image Display */}
                {selectedReceiptUrl ? (
                  <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                    <img
                      src={selectedReceiptUrl}
                      alt="Payment Receipt"
                      className="mx-auto w-auto max-w-full max-h-[420px] object-contain rounded-lg shadow-lg border border-border cursor-zoom-in"
                      onClick={openZoomModal}
                      title="Click to zoom"
                      onLoad={() => {
                        console.log("âœ… Receipt image loaded successfully");
                        console.log("Image URL:", selectedReceiptUrl);
                      }}
                      onError={async (e) => {
                        console.error("âŒ Failed to load receipt image");
                        console.error("URL:", selectedReceiptUrl);
                        console.error("Error event:", e);
                        
                        // Try to fetch fresh URL from path if available and haven't retried yet
                        if (selectedDonation?.receiptPath) {
                          try {
                            console.log("Attempting to fetch fresh URL from storage path...");
                            const storageRef = ref(storage, selectedDonation.receiptPath);
                            const freshUrl = await getDownloadURL(storageRef);
                            
                            // Only retry if we got a different URL
                            if (freshUrl !== selectedReceiptUrl) {
                              console.log("âœ… Got fresh URL, retrying...");
                              setSelectedReceiptUrl(freshUrl);
                              return; // Don't show error toast yet, retry with new URL
                            } else {
                              console.log("âš ï¸ Fresh URL is same as failed URL");
                            }
                          } catch (retryError) {
                            console.error("Failed to fetch fresh URL:", retryError);
                          }
                        } else {
                          console.error("No receipt path available for retry");
                        }
                        
                        // If we get here, retry failed or wasn't possible
                        setSelectedReceiptUrl("");
                        toast({
                          title: "Receipt Image Error",
                          description: "Failed to load the receipt image. The file may not exist or you don't have permission to view it.",
                          variant: "destructive",
                        });
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-12 min-h-[300px] border-2 border-dashed border-border">
                    <IconEye className="h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground font-medium">No receipt available</p>
                    <p className="text-xs text-muted-foreground mt-2">No payment receipt was uploaded</p>
                  </div>
                )}
              </div>

              {isFinanceAdmin && selectedDonation.status === "pending" && (
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReceiptModalOpen(false);
                      openRejectDialog(selectedDonation);
                    }}
                    disabled={processingId === selectedDonation.id}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Reject Donation
                  </Button>
                  <Button
                    onClick={() => {
                      setReceiptModalOpen(false);
                      openApproveDialog(selectedDonation);
                    }}
                    disabled={processingId === selectedDonation.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    Approve / Adjust Amount
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={zoomModalOpen}
        onOpenChange={(open) => {
          setZoomModalOpen(open);
          if (!open) {
            setZoomLevel(1);
          }
        }}
      >
        <DialogContent className="w-[96vw] sm:max-w-6xl max-h-[92vh] overflow-hidden">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-lg">Receipt Image Zoom</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={zoomOut} disabled={zoomLevel <= 1}>
              -
            </Button>
            <span className="text-sm text-muted-foreground min-w-[64px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <Button variant="outline" size="sm" onClick={zoomIn} disabled={zoomLevel >= 4}>
              +
            </Button>
            <Button variant="outline" size="sm" onClick={zoomReset}>
              Reset
            </Button>
          </div>

          <div className="mt-2 h-[70vh] overflow-auto rounded-md border bg-muted/20 p-3">
            {selectedReceiptUrl ? (
              <img
                src={selectedReceiptUrl}
                alt="Zoomed payment receipt"
                className="mx-auto origin-top rounded-md border border-border bg-background"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: "top center",
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No image available.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={approveDialogOpen}
        onOpenChange={(open) => {
          setApproveDialogOpen(open);
          if (!open) {
            setApprovingDonation(null);
            setVerifiedAmountInput("");
            setApprovalReviewNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Donation</DialogTitle>
            <DialogDescription>
              Confirm the verified amount from the receipt. If it differs from declared amount, add a review note.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p>
                Declared Amount:{" "}
                <span className="font-semibold">
                  ₱{(approvingDonation?.donationAmount || 0).toLocaleString()}
                </span>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Verified Amount</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={verifiedAmountInput}
                onChange={(event) => setVerifiedAmountInput(event.target.value)}
                placeholder="Enter verified amount from receipt"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Review Note</label>
              <Textarea
                value={approvalReviewNote}
                onChange={(event) => setApprovalReviewNote(event.target.value)}
                placeholder="Required when verified amount is different from declared amount."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setApproveDialogOpen(false);
                  setApprovingDonation(null);
                  setVerifiedAmountInput("");
                  setApprovalReviewNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processingId === approvingDonation?.id}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {processingId === approvingDonation?.id ? "Approving..." : "Approve Donation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={rejectDialogOpen}
        onOpenChange={(open) => {
          setRejectDialogOpen(open);
          if (!open) {
            setRejectingDonation(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Donation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a rejection reason so the user knows what to correct.
            </p>
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Enter rejection reason"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setRejectingDonation(null);
                  setRejectionReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={processingId === rejectingDonation?.id}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Reject Donation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Donations;


