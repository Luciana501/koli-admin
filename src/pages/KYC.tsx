import React, { useState, useEffect } from "react";
import { User } from "@/types/admin";
import { subscribeToKYC, updateKYCStatus } from "@/services/firestore";
import { IconCheck, IconX, IconUser, IconEye, IconPhone, IconMapPin, IconCalendar, IconDownload, IconFilter } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
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

const KYC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { toast } = useToast();
  const itemsPerPage = 10;
  const [kycStatusFilter, setKycStatusFilter] = useState("all");

  useEffect(() => {
    // Subscribe to real-time KYC updates
    const unsubscribe = subscribeToKYC((data) => {
      setUsers(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
    setHistoryPage(1);
  }, [kycStatusFilter]);

  const pendingKYC = users.filter((u) => u.kycStatus === "PENDING");
  
  const processedKYC = users.filter((u) => {
    const isProcessed = u.kycStatus === "APPROVED" || u.kycStatus === "REJECTED";
    if (!isProcessed) return false;
    if (kycStatusFilter === "all") return true;
    return u.kycStatus === kycStatusFilter;
  });

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

  const handleView = (user: User) => {
    console.log("Viewing KYC for user:", user);
    console.log("KYC Image URL:", user.kycImageUrl);
    setSelectedUser(user);
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
    setProcessingId(id);
    try {
      await updateKYCStatus(id, "REJECTED");
      toast({
        title: "Success",
        description: "KYC application rejected",
      });
      setModalOpen(false);
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

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading KYC applications...</p>
        </div>
      </div>
    );
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

            {totalPages > 1 && (
              <div className="mt-7">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* KYC History */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h2 className="text-lg md:text-xl font-semibold">Verification History</h2>
          <div className="px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-xs md:text-sm font-medium whitespace-nowrap">
            {processedKYC.length} Processed
          </div>
        </div>
        
        {/* Filter Feature */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground whitespace-nowrap">Filter by Status:</label>
          </div>
          <Select value={kycStatusFilter} onValueChange={setKycStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-10">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {processedKYC.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No processed applications yet</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
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

            {historyTotalPages > 1 && (
              <div className="mt-7">
                <Pagination
                  currentPage={historyPage}
                  totalPages={historyTotalPages}
                  onPageChange={setHistoryPage}
                />
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
                    <img
                      src={selectedUser.kycImageUrl}
                      alt="KYC Document"
                      className="w-full h-auto rounded-lg shadow-lg border border-border"
                      onLoad={() => {
                        console.log("✅ KYC image loaded successfully");
                        console.log("Image URL:", selectedUser.kycImageUrl);
                      }}
                      onError={(e) => {
                        console.error("❌ Failed to load KYC image");
                        console.error("URL:", selectedUser.kycImageUrl);
                        console.error("Error event:", e);
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center bg-muted/30 rounded-lg p-12 min-h-[300px] border-2 border-dashed border-border">
                    <IconUser className="h-16 w-16 text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground font-medium">No verification document attached</p>
                    <p className="text-xs text-muted-foreground mt-2">User has not uploaded a KYC document</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {selectedUser.kycStatus === "PENDING" && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t">
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
