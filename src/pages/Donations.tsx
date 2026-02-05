import React, { useState, useEffect } from "react";
import { Donation } from "@/types/admin";
import { subscribeToDonations, updateDonationStatus } from "@/services/firestore";
import { IconCheck, IconX, IconEye, IconDownload } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Donations = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedReceiptUrl, setSelectedReceiptUrl] = useState<string>("");
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const { toast } = useToast();
  const itemsPerPage = 10;

  useEffect(() => {
    // Subscribe to real-time donations updates
    const unsubscribe = subscribeToDonations((data) => {
      setDonations(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const pendingDonations = donations.filter((d) => d.status === "pending");
  const historyDonations = donations.filter((d) => d.status !== "pending");
  
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

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await updateDonationStatus(id, "approved");
      toast({
        title: "Success",
        description: "Donation approved successfully",
      });
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

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await updateDonationStatus(id, "rejected");
      toast({
        title: "Success",
        description: "Donation rejected successfully",
      });
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
      
      if (donation.receiptURL) {
        console.log("Opening receipt URL:", donation.receiptURL);
        setSelectedReceiptUrl(donation.receiptURL);
        setSelectedDonation(donation);
        setReceiptModalOpen(true);
      } else {
        console.log("No receipt URL found for donation:", donation.id);
        toast({
          title: "Receipt Not Found",
          description: "Receipt URL not available.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error viewing receipt:", error);
      toast({
        title: "Receipt Not Found",
        description: "Failed to load receipt from storage.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading donations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 lg:p-10 space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Donation Management</h1>
        <p className="text-base text-muted-foreground">
          Review and validate user donation submissions
        </p>
      </div>

      {/* Pending Donations Section */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Pending Approvals</h2>
          <div className="px-3 py-1.5 bg-amber-500/10 text-amber-600 rounded-full text-sm font-medium">
            {pendingDonations.length} Pending
          </div>
        </div>

        {pendingDonations.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No pending donations at the moment</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-gradient-to-r from-muted/60 to-muted/30">
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">User</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Amount</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Payment Method</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Created Date</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Receipt</th>
                      <th className="text-center p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Actions</th>
                    </tr>
                  </thead>
                <tbody>
                  {paginatedDonations.map((donation) => (
                    <tr key={donation.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                      <td className="p-4 md:p-5">
                        <div className="space-y-1">
                          <p className="font-semibold text-base">{donation.userName || "Loading..."}</p>
                          <p className="text-xs text-muted-foreground">{donation.userEmail || donation.userId}</p>
                        </div>
                      </td>
                      <td className="p-4 md:p-5">
                        <span className="text-lg font-bold text-primary">
                          ₱{donation.donationAmount.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 md:p-5">
                        <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium capitalize">
                          {donation.paymentMethod}
                        </span>
                      </td>
                      <td className="p-4 md:p-5 text-sm text-muted-foreground">
                        {new Date(donation.createdAt).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </td>
                      <td className="p-4 md:p-5">
                        {donation.receiptURL ? (
                          <button
                            onClick={() => handleViewReceipt(donation)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all hover:scale-105 text-sm font-medium"
                          >
                            <IconEye className="h-4 w-4" />
                            View
                          </button>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">No receipt</span>
                        )}
                      </td>
                      <td className="p-4 md:p-5">
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => handleApprove(donation.id)}
                            disabled={processingId === donation.id}
                            className="p-2.5 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-all hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
                            title="Approve"
                          >
                            <IconCheck className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleReject(donation.id)}
                            disabled={processingId === donation.id}
                            className="p-2.5 rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-all hover:scale-110 disabled:opacity-50 disabled:hover:scale-100"
                            title="Reject"
                          >
                            <IconX className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* History Section */}
      <div className="space-y-5 mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Donation History</h2>
          <div className="px-3 py-1.5 bg-muted text-muted-foreground rounded-full text-sm font-medium">
            {historyDonations.length} Processed
          </div>
        </div>
        
        {historyDonations.length === 0 ? (
          <div className="bg-gradient-to-br from-muted/30 to-muted/10 border-2 border-dashed border-border rounded-xl p-12 text-center">
            <p className="text-muted-foreground text-lg">No processed donations yet</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-gradient-to-r from-muted/60 to-muted/30">
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">User</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Amount</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Payment Method</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Created Date</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Status</th>
                      <th className="text-left p-4 md:p-5 text-sm font-semibold uppercase tracking-wide">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedHistory.map((donation) => (
                      <tr key={donation.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                        <td className="p-4 md:p-5">
                          <div className="space-y-1">
                            <p className="font-semibold text-base">{donation.userName || "Loading..."}</p>
                            <p className="text-xs text-muted-foreground">{donation.userEmail || donation.userId}</p>
                          </div>
                        </td>
                        <td className="p-4 md:p-5">
                          <span className="text-base font-semibold">
                            ₱{donation.donationAmount.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 md:p-5">
                          <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 text-sm font-medium capitalize">
                            {donation.paymentMethod}
                          </span>
                        </td>
                        <td className="p-4 md:p-5 text-sm text-muted-foreground">
                          {new Date(donation.createdAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </td>
                        <td className="p-4 md:p-5">
                          <span className={`inline-flex px-3 py-1.5 rounded-full text-sm font-semibold ${
                            donation.status === "approved" 
                              ? "bg-green-500/15 text-green-600" 
                              : "bg-red-500/15 text-red-600"
                          }`}>
                            {donation.status.charAt(0).toUpperCase() + donation.status.slice(1)}
                          </span>
                        </td>
                        <td className="p-4 md:p-5">
                          {donation.receiptURL ? (
                            <button
                              onClick={() => handleViewReceipt(donation)}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all hover:scale-105 text-sm font-medium"
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

      {/* Receipt Modal */}
      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="text-2xl font-bold">Payment Receipt</DialogTitle>
          </DialogHeader>
          
          {selectedDonation && (
            <div className="mt-6 space-y-6 overflow-auto max-h-[calc(90vh-180px)]">
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
                      selectedDonation.status === "approved" 
                        ? "bg-green-500/15 text-green-600" 
                        : selectedDonation.status === "rejected"
                        ? "bg-red-500/15 text-red-600"
                        : "bg-amber-500/15 text-amber-600"
                    }`}>
                      {selectedDonation.status.charAt(0).toUpperCase() + selectedDonation.status.slice(1)}
                    </span>
                  </div>
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
                  <div className="bg-muted/30 rounded-lg p-4">
                    <img
                      src={selectedReceiptUrl}
                      alt="Payment Receipt"
                      className="w-full h-auto rounded-lg shadow-lg border border-border"
                      onLoad={() => {
                        console.log("✅ Receipt image loaded successfully");
                        console.log("Image URL:", selectedReceiptUrl);
                      }}
                      onError={(e) => {
                        console.error("❌ Failed to load receipt image");
                        console.error("URL:", selectedReceiptUrl);
                        console.error("Error event:", e);
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Donations;
