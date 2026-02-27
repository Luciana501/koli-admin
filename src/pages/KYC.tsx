import React, { useState, useEffect } from "react";
import { User } from "@/types/admin";
import { PlatformCode, subscribeToKYC, subscribeToPlatformCodes, updateKYCStatus } from "@/services/firestore";
import {
  IDValidationResponse,
  ImageValidationResponse,
  SupportedIDType,
  analyzeIdentificationImage,
  validateIdentificationNumber,
} from "@/services/idValidation";
import { IconCheck, IconX, IconUser, IconEye, IconPhone, IconMapPin, IconCalendar, IconDownload, IconFilter, IconSearch } from "@tabler/icons-react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import PageLoading from "@/components/PageLoading";

const KYC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [platformCodes, setPlatformCodes] = useState<PlatformCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [mlValidationByUser, setMlValidationByUser] = useState<Record<string, IDValidationResponse>>({});
  const [imageValidationByUser, setImageValidationByUser] = useState<Record<string, ImageValidationResponse>>({});
  const [analysisLoadingUserId, setAnalysisLoadingUserId] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const { toast } = useToast();
  const itemsPerPage = 50;
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [kycStatusFilter, setKycStatusFilter] = useState("all");
  const [idTypeFilter, setIdTypeFilter] = useState("all");

  useEffect(() => {
    // Subscribe to real-time KYC updates
    const unsubscribe = subscribeToKYC((data) => {
      setUsers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToPlatformCodes((codes) => {
      setPlatformCodes(codes);
    });

    return () => unsubscribe();
  }, []);

  // Reset to page 1 when filters/search/sort change
  useEffect(() => {
    setCurrentPage(1);
    setHistoryPage(1);
  }, [searchTerm, sortOrder, kycStatusFilter, idTypeFilter]);

  const getNormalizedIdentificationType = (user: User): SupportedIDType | null => {
    const manualData = user.kycManualData as Record<string, unknown> | undefined;
    const rawType = (
      user.kycManualData?.identificationType ||
      (typeof manualData?.idType === "string" ? manualData.idType : "")
    ).trim();

    if (!rawType) return null;

    const allowedTypes: SupportedIDType[] = [
      "Philippine Passport",
      "Driver's License",
      "SSS ID",
      "GSIS ID",
      "UMID",
      "PhilHealth ID",
      "TIN ID",
      "Postal ID",
      "Voter's ID",
      "PRC ID",
      "Senior Citizen ID",
      "PWD ID",
      "National ID",
      "Others",
    ];

    if (rawType === "UMID (Unified Multi-Purpose ID)") return "UMID";
    if (rawType === "PRC ID (Professional License)") return "PRC ID";
    if (rawType === "National ID (PhilSys)") return "National ID";

    return allowedTypes.includes(rawType as SupportedIDType) ? (rawType as SupportedIDType) : "Others";
  };

  const getSubmissionMs = (user: User) => {
    const source = user.kycSubmittedAt || user.createdAt;
    if (!source) return 0;
    const parsed = new Date(source).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const getUserLeaderName = (user: User): string => {
    if (user.leaderName?.trim()) return user.leaderName.trim();

    const platformCodeId = (user.platformCodeId || "").trim();
    const platformCode = (user.platformCode || "").trim().toUpperCase();

    if (!platformCodeId && !platformCode) {
      return user.leaderId?.trim() ? user.leaderId.trim() : "N/A";
    }

    const matchedCode = platformCodes.find((code) => {
      const codeId = (code.id || "").trim().toUpperCase();
      const codeValue = (code.code || "").trim().toUpperCase();
      return (
        (platformCodeId && codeId === platformCodeId.toUpperCase()) ||
        (platformCode && (codeId === platformCode || codeValue === platformCode))
      );
    });

    if (matchedCode?.leaderName?.trim()) return matchedCode.leaderName.trim();
    if (matchedCode?.leaderId?.trim()) return matchedCode.leaderId.trim();
    if (user.leaderId?.trim()) return user.leaderId.trim();
    return "N/A";
  };

  const pendingKYC = [...users]
    .filter((u) => u.kycStatus === "PENDING")
    .sort((a, b) => getSubmissionMs(b) - getSubmissionMs(a));

  const historyUsers = users.filter((u) => u.kycStatus === "APPROVED" || u.kycStatus === "REJECTED");

  const idTypeOptions = Array.from(
    new Set(historyUsers.map((user) => getNormalizedIdentificationType(user)).filter((value): value is SupportedIDType => Boolean(value)))
  ).sort((a, b) => a.localeCompare(b));

  const filteredAndSortedUsers = [...historyUsers]
    .filter((user) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim().toLowerCase();
      const userStatus = user.kycStatus || "NOT_SUBMITTED";
      const userIdType = getNormalizedIdentificationType(user);

      const matchesSearch =
        !normalizedSearch ||
        fullName.includes(normalizedSearch) ||
        (user.name || "").toLowerCase().includes(normalizedSearch) ||
        (user.email || "").toLowerCase().includes(normalizedSearch) ||
        (user.phoneNumber || "").toLowerCase().includes(normalizedSearch) ||
        (user.kycManualData?.phoneNumber || "").toLowerCase().includes(normalizedSearch) ||
        (user.address || "").toLowerCase().includes(normalizedSearch) ||
        (user.kycManualData?.address || "").toLowerCase().includes(normalizedSearch) ||
        (user.leaderName || "").toLowerCase().includes(normalizedSearch) ||
        (user.leaderId || "").toLowerCase().includes(normalizedSearch);

      const matchesStatus = kycStatusFilter === "all" || userStatus === kycStatusFilter;
      const matchesIdType = idTypeFilter === "all" || userIdType === idTypeFilter;

      return matchesSearch && matchesStatus && matchesIdType;
    })
    .sort((a, b) => {
      const timeA = getSubmissionMs(a);
      const timeB = getSubmissionMs(b);
      return sortOrder === "latest" ? timeB - timeA : timeA - timeB;
    });

  const processedKYC = filteredAndSortedUsers;

  const totalPages = Math.ceil(pendingKYC.length / itemsPerPage);
  const historyTotalPages = Math.ceil(processedKYC.length / itemsPerPage);
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const historyStartIndex = (historyPage - 1) * itemsPerPage;
  
  const paginatedPending = pendingKYC.slice(
    startIndex,
    startIndex + itemsPerPage
  );
  
  const paginatedHistory = processedKYC.slice(
    historyStartIndex,
    historyStartIndex + itemsPerPage
  );

  const getIdentificationNumber = (user: User): string => {
    const manualData = user.kycManualData as Record<string, unknown> | undefined;
    const candidates = [
      user.kycManualData?.idNumber,
      typeof manualData?.identificationNumber === "string" ? manualData.identificationNumber : "",
      typeof manualData?.idNo === "string" ? manualData.idNo : "",
    ];

    const found = candidates.find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    return found?.trim() || "";
  };

  const getIdentificationType = (user: User): SupportedIDType => {
    return getNormalizedIdentificationType(user) || "Others";
  };

  const selectedIdNumber = selectedUser ? getIdentificationNumber(selectedUser) : "";
  const selectedIdType = selectedUser ? getIdentificationType(selectedUser) : "Others";
  const selectedLeaderName = selectedUser ? getUserLeaderName(selectedUser) : "N/A";
  const selectedMlResult = selectedUser ? mlValidationByUser[selectedUser.id] : undefined;
  const selectedImageResult = selectedUser ? imageValidationByUser[selectedUser.id] : undefined;
  const isSelectedMlLoading = selectedUser ? analysisLoadingUserId === selectedUser.id : false;

  const getConfidenceLabel = (confidence: number): "Low" | "Medium" | "High" => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  const getCheckBadgeClass = (status: "pass" | "warn" | "fail"): string => {
    if (status === "pass") return "bg-green-500/15 text-green-600";
    if (status === "warn") return "bg-amber-500/15 text-amber-600";
    return "bg-red-500/15 text-red-600";
  };

  const runMlValidation = async (user: User, force = false): Promise<IDValidationResponse | null> => {
    const idNumber = getIdentificationNumber(user);
    const idType = getIdentificationType(user);
    if (!idNumber) {
      return null;
    }

    const cached = mlValidationByUser[user.id];
    if (cached && !force) {
      return cached;
    }

    setAnalysisLoadingUserId(user.id);
    try {
      const result = await validateIdentificationNumber(idNumber, idType);
      setMlValidationByUser((prev) => ({ ...prev, [user.id]: result }));
      return result;
    } catch (error) {
      console.error("Failed to validate ID with ML service:", error);
      toast({
        title: "ML check unavailable",
        description: "Unable to validate this ID right now. Please ensure the ID validation API is running.",
        variant: "destructive",
      });
      return null;
    } finally {
      setAnalysisLoadingUserId((prev) => (prev === user.id ? null : prev));
    }
  };

  const runImageValidation = async (user: User, force = false): Promise<ImageValidationResponse | null> => {
    const imageUrl = user.kycImageUrl?.trim();
    const idType = getIdentificationType(user);
    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    
    console.log("runImageValidation called:", { userId: user.id, imageUrl, idType, userName, force });
    
    if (!imageUrl) {
      return null;
    }

    const cached = imageValidationByUser[user.id];
    if (cached && !force) {
      console.log("Returning cached result");
      return cached;
    }

    // Force clear cache when explicitly requested
    if (force && cached) {
      console.log("Force flag set - clearing cached result");
      setImageValidationByUser((prev) => {
        const newState = { ...prev };
        delete newState[user.id];
        return newState;
      });
    }

    setAnalysisLoadingUserId(user.id);
    try {
      console.log("Making API call to analyze-id-image endpoint");
      const result = await analyzeIdentificationImage(imageUrl, idType, userName);
      console.log("API call successful, result:", result);
      setImageValidationByUser((prev) => ({ ...prev, [user.id]: result }));
      return result;
    } catch (error) {
      console.error("Failed to validate image with ML service:", error);
      toast({
        title: "Image analysis unavailable",
        description: "Unable to analyze this KYC image right now. Please ensure the ID validation API is running.",
        variant: "destructive",
      });
      return null;
    } finally {
      setAnalysisLoadingUserId((prev) => (prev === user.id ? null : prev));
    }
  };

  const runFullAnalysis = async (user: User): Promise<void> => {
    await runMlValidation(user, true);
    await runImageValidation(user, true);
  };

  const getCombinedAnalysisForUser = (user: User): { status: "Valid" | "Invalid"; reasons: string[] } | null => {
    const idNumber = getIdentificationNumber(user);
    const numberResult = mlValidationByUser[user.id];
    const imageResult = imageValidationByUser[user.id];
    const hasImage = Boolean(user.kycImageUrl);

    if (idNumber && !numberResult) {
      return null;
    }

    if (hasImage && !imageResult) {
      return null;
    }

    const reasons = [
      ...(numberResult?.reasons || []),
      ...(imageResult?.reasons || []),
    ];

    const hasInvalid = numberResult?.status === "Invalid" || imageResult?.status === "Invalid";
    return {
      status: hasInvalid ? "Invalid" : "Valid",
      reasons,
    };
  };

  const handleView = (user: User) => {
    console.log("Viewing KYC for user:", user);
    console.log("KYC Image URL:", user.kycImageUrl);
    setSelectedUser(user);
    setRejectionReason(user.kycRejectionReason || "");
    setImageLoadError(false);
    setModalOpen(true);
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "APPROVED");
      toast({
        title: "Success",
        description: "KYC application approved successfully",
      });
      setModalOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve KYC application",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const trimmedReason = rejectionReason.trim();

    if (!trimmedReason) {
      toast({
        title: "Reason required",
        description: "Please provide a rejection reason before rejecting this KYC application.",
        variant: "destructive",
      });
      return;
    }

    setProcessingId(id);
    try {
      await updateKYCStatus(id, "REJECTED", trimmedReason);
      toast({
        title: "Success",
        description: "KYC application rejected",
      });
      setModalOpen(false);
      setRejectionReason("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject KYC application",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSortOrder("latest");
    setKycStatusFilter("all");
    setIdTypeFilter("all");
    setCurrentPage(1);
    setHistoryPage(1);
  };

  if (loading) {
    return <PageLoading className="min-h-[16rem]" />;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">KYC Verification</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Review and validate user identity verification requests
          </p>
        </div>

        {/* Pending KYC Applications */}
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg md:text-xl font-semibold">Pending Applications</h2>
            <div className="px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-xs md:text-sm font-medium whitespace-nowrap">
              {pendingKYC.length} Pending
            </div>
          </div>

        {pendingKYC.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No pending KYC applications</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-[55vh] overflow-y-auto">
                <ul className="divide-y divide-border">
                  {paginatedPending.map((user, index) => (
                    <li key={user.id} className="hover:bg-muted/40 transition-colors">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
                      {/* Number */}
                      <div className="hidden sm:block text-3xl font-thin opacity-30 tabular-nums min-w-[3rem]">
                        {String(startIndex + index + 1).padStart(2, '0')}
                      </div>
                      
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <IconUser className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-grow min-w-0">
                        <div className="font-semibold text-base mb-1">
                          {user.name || `${user.firstName} ${user.lastName}`}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconPhone className="h-3 w-3" />
                            {user.kycManualData?.phoneNumber || user.phoneNumber || "N/A"}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconMapPin className="h-3 w-3" />
                            {user.kycManualData?.address || user.address || "N/A"}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconCalendar className="h-3 w-3" />
                            {user.kycSubmittedAt 
                              ? new Date(user.kycSubmittedAt).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })
                              : "N/A"
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* View Button */}
                      <button
                        onClick={() => handleView(user)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all hover:scale-105 text-sm font-medium flex-shrink-0 w-full sm:w-auto justify-center"
                      >
                        <IconEye className="h-4 w-4" />
                        View
                      </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="mt-7 flex justify-center">
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
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search users by name, email, phone, or address..."
                className="pl-10"
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
                {(kycStatusFilter !== "all" || idTypeFilter !== "all" || searchTerm) && (
                  <div className="w-2 h-2 bg-primary rounded-full" />
                )}
              </Button>
              {(kycStatusFilter !== "all" || idTypeFilter !== "all" || searchTerm || sortOrder !== "latest") && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <IconX className="h-4 w-4" />
                </Button>
              )}
              <div className="text-sm font-medium text-muted-foreground ml-2">
                Total Users: {filteredAndSortedUsers.length}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="bg-muted/50 p-4 rounded-lg space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sort By</label>
                  <Select
                    value={sortOrder}
                    onValueChange={(value) => setSortOrder(value as "latest" | "oldest")}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Sort order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="latest">Latest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">KYC Status</label>
                    <Select value={kycStatusFilter} onValueChange={setKycStatusFilter}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">ID Type</label>
                  <Select value={idTypeFilter} onValueChange={setIdTypeFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All ID Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ID Types</SelectItem>
                      {idTypeOptions.map((idType) => (
                        <SelectItem key={idType} value={idType}>
                          {idType}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Showing {filteredAndSortedUsers.length} of {historyUsers.length} users
              </div>
            </div>
          )}
        </div>
      </div>

      {/* KYC History */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-lg md:text-xl font-semibold">Verification History</h2>
          <div className="px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-xs md:text-sm font-medium whitespace-nowrap">
            {processedKYC.length} Processed
          </div>
        </div>
        
        {processedKYC.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No processed applications yet</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="max-h-[55vh] overflow-y-auto">
                <ul className="divide-y divide-border">
                  {paginatedHistory.map((user, index) => (
                    <li key={user.id} className="hover:bg-muted/40 transition-colors">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-5">
                      {/* Number */}
                      <div className="hidden sm:block text-3xl font-thin opacity-30 tabular-nums min-w-[3rem]">
                        {String(historyStartIndex + index + 1).padStart(2, '0')}
                      </div>
                      
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                          <IconUser className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-grow min-w-0">
                        <div className="font-semibold text-base mb-1">
                          {user.name || `${user.firstName} ${user.lastName}`}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconPhone className="h-3 w-3" />
                            {user.kycManualData?.phoneNumber || user.phoneNumber || "N/A"}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconMapPin className="h-3 w-3" />
                            {user.kycManualData?.address || user.address || "N/A"}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconCalendar className="h-3 w-3" />
                            {user.kycSubmittedAt 
                              ? new Date(user.kycSubmittedAt).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })
                              : "N/A"
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <span className={`inline-flex px-3 py-1.5 rounded-full text-xs md:text-sm font-semibold flex-shrink-0 ${
                        user.kycStatus === "APPROVED" 
                          ? "bg-green-500/15 text-green-600" 
                          : "bg-red-500/15 text-red-600"
                      }`}>
                        {user.kycStatus}
                      </span>
                      
                      {/* View Button */}
                      <button
                        onClick={() => handleView(user)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all hover:scale-105 text-sm font-medium flex-shrink-0 w-full sm:w-auto justify-center"
                      >
                        <IconEye className="h-4 w-4" />
                        View
                      </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {historyTotalPages > 1 && (
              <div className="mt-7 flex justify-center">
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

      {/* KYC Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-xl md:text-2xl font-bold">KYC Application Details</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="mt-6 space-y-6 overflow-auto max-h-[calc(90vh-180px)]">
              {/* User Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">User Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Full Name</p>
                    <p className="font-semibold">{selectedUser.name || `${selectedUser.firstName} ${selectedUser.lastName}`}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="font-semibold">{selectedUser.email || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone Number</p>
                    <p className="font-semibold">{selectedUser.kycManualData?.phoneNumber || selectedUser.phoneNumber || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Address</p>
                    <p className="font-semibold">{selectedUser.kycManualData?.address || selectedUser.address || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Leader</p>
                    <p className="font-semibold">{selectedLeaderName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Submitted At</p>
                    <p className="font-semibold">
                      {selectedUser.kycSubmittedAt 
                        ? new Date(selectedUser.kycSubmittedAt).toLocaleString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : "N/A"
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Status</p>
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      selectedUser.kycStatus === "APPROVED" 
                        ? "bg-green-500/15 text-green-600" 
                        : selectedUser.kycStatus === "REJECTED"
                        ? "bg-red-500/15 text-red-600"
                        : "bg-amber-500/15 text-amber-600"
                    }`}>
                      {selectedUser.kycStatus || "PENDING"}
                    </span>
                  </div>
                  {selectedUser.kycStatus === "REJECTED" && selectedUser.kycRejectionReason && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground mb-1">Rejection Reason</p>
                      <p className="font-semibold whitespace-pre-wrap">{selectedUser.kycRejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* KYC Document/Image */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-lg font-semibold">Verification Document</h3>
                  {selectedUser.kycImageUrl && (
                    <a
                      href={selectedUser.kycImageUrl}
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
                {selectedUser.kycImageUrl ? (
                  <div className="bg-muted/30 rounded-lg p-4">
                    {!imageLoadError ? (
                      <img
                        src={selectedUser.kycImageUrl}
                        alt="KYC Document"
                        className="w-full h-auto rounded-lg shadow-lg border border-border"
                        onLoad={() => {
                          console.log("✅ KYC image loaded successfully");
                          console.log("Image URL:", selectedUser.kycImageUrl);
                          setImageLoadError(false);
                        }}
                        onError={(e) => {
                          console.error("❌ Failed to load KYC image");
                          console.error("URL:", selectedUser.kycImageUrl);
                          console.error("Error event:", e);
                          setImageLoadError(true);
                        }}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center bg-destructive/10 rounded-lg p-8 min-h-[300px] border-2 border-dashed border-destructive/50">
                        <IconX className="h-16 w-16 text-destructive mb-3" />
                        <p className="text-destructive font-semibold mb-2">Unable to Display Image</p>
                        <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
                          The image format may not be supported by your browser (.HEIC files from iPhones cannot be displayed in most browsers).
                        </p>
                        {selectedUser.kycImageUrl.toLowerCase().includes('.heic') && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded border border-amber-200 dark:border-amber-800 mb-3">
                            💡 This is a HEIC file. Users should upload JPEG or PNG formats instead.
                          </p>
                        )}
                        <a
                          href={selectedUser.kycImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-2 mt-2"
                        >
                          <IconDownload className="h-4 w-4" />
                          Try downloading the file directly
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-12 min-h-[300px] border-2 border-dashed border-border">
                    <IconUser className="h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground font-medium">No verification document attached</p>
                    <p className="text-xs text-muted-foreground mt-2">User has not uploaded a KYC document</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    ⚠️ Machine Learning Checker is not 100% accurate. Manual Verification is still required.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h3 className="text-lg font-semibold">ML Identification Check</h3>
                  <button
                    onClick={() => void runFullAnalysis(selectedUser)}
                    disabled={isSelectedMlLoading || (!selectedIdNumber && !selectedUser.kycImageUrl)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  >
                    {isSelectedMlLoading ? "Analyzing..." : "Analyze Identification Card"}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Submitted ID Number</p>
                    <p className="font-semibold break-all">{selectedIdNumber || "Not provided"}</p>
                    <p className="text-xs text-muted-foreground mt-1">ID Type: {selectedIdType}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">ML Verdict</p>
                    {isSelectedMlLoading ? (
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                        Checking...
                      </span>
                    ) : (() => {
                      const hasInvalid = selectedMlResult?.status === "Invalid" || selectedImageResult?.status === "Invalid";
                      const hasAnyResult = Boolean(selectedMlResult || selectedImageResult);

                      if (!hasAnyResult) {
                        return (
                          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600">
                            Not analyzed
                          </span>
                        );
                      }

                      return (
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                          hasInvalid
                            ? "bg-red-500/15 text-red-600"
                            : "bg-green-500/15 text-green-600"
                        }`}>
                          {hasInvalid ? "Invalid" : "Valid"}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {!selectedIdNumber && (
                  <p className="text-xs text-red-600">No submitted ID number found for this user.</p>
                )}

                {!!selectedImageResult?.message && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Image Analysis Message</p>
                    <p className="text-sm font-medium">{selectedImageResult.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Confidence: {(selectedImageResult.confidence * 100).toFixed(0)}% ({getConfidenceLabel(selectedImageResult.confidence)})
                    </p>
                  </div>
                )}

                {!!selectedImageResult?.checks?.length && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Analysis Breakdown</p>
                    <ul className="space-y-2">
                      {selectedImageResult.checks.map((check) => (
                        <li key={check.name} className="flex items-start gap-2 text-sm">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getCheckBadgeClass(check.status)}`}>
                            {check.status.toUpperCase()}
                          </span>
                          <span>
                            <span className="font-medium">{check.name}:</span> {check.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!(selectedMlResult?.reasons?.length || selectedImageResult?.reasons?.length) && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Model Notes</p>
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      {[...(selectedMlResult?.reasons || []), ...(selectedImageResult?.reasons || [])].map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedUser.kycStatus === "PENDING" && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Rejection Reason (required to reject)</label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this KYC application is being rejected"
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                  <button
                    onClick={() => handleReject(selectedUser.id)}
                    disabled={processingId === selectedUser.id}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 font-medium w-full sm:w-auto"
                  >
                    <IconX className="h-5 w-5" />
                    Reject Application
                  </button>
                  <button
                    onClick={() => handleApprove(selectedUser.id)}
                    disabled={processingId === selectedUser.id}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 font-medium w-full sm:w-auto"
                  >
                    <IconCheck className="h-5 w-5" />
                    Approve Application
                  </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default KYC;
