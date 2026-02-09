import React, { useState, useEffect, useMemo } from "react";
import { Withdrawal } from "@/types/admin";
import { subscribeToWithdrawals, updateWithdrawalStatus } from "@/services/firestore";
import { useAuth } from "@/context/AuthContext";
import { IconSend, IconCheck, IconEye } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

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
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupedWithdrawal | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const { adminType } = useAuth();
  const { toast } = useToast();
  const itemsPerPage = 5;

  useEffect(() => {
    // Subscribe to real-time withdrawals updates
    const unsubscribe = subscribeToWithdrawals((data) => {
      setWithdrawals(data);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Group withdrawals by userId + requestedAt
  const groupedWithdrawals = useMemo(() => {
    const pending = withdrawals.filter((w) => w.status === "pending");
    const groups = new Map<string, GroupedWithdrawal>();

    pending.forEach((withdrawal) => {
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
  }, [withdrawals]);

  // Group history withdrawals (approved/rejected)
  const groupedHistory = useMemo(() => {
    const history = withdrawals.filter((w) => w.status === "approved" || w.status === "sent");
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
  }, [withdrawals]);

  const totalPages = Math.ceil(groupedWithdrawals.length / itemsPerPage);
  const historyTotalPages = Math.ceil(groupedHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const historyStartIndex = (historyPage - 1) * itemsPerPage;
  const paginatedGroups = groupedWithdrawals.slice(
    startIndex,
    startIndex + itemsPerPage
  );
  const paginatedHistory = groupedHistory.slice(
    historyStartIndex,
    historyStartIndex + itemsPerPage
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

    toast({
      title: "Sent to Finance",
      description: `${groupedWithdrawals.length} withdrawal(s) sent to finance team for approval.`,
    });
  };

  const isFinanceAdmin = adminType === "finance";

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading withdrawals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Withdrawals</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            {isFinanceAdmin
              ? "Review and process withdrawal requests"
              : "Manage withdrawal requests"}
          </p>
        </div>
        {isFinanceAdmin && selectedGroupIds.length > 0 && activeTab === "pending" && (
          <button
            onClick={handleApproveSelected}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm md:text-base font-medium hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            <IconCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Approve Selected ({selectedGroupIds.length})</span>
            <span className="sm:hidden">Send ({selectedGroupIds.length})</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "pending"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Pending ({groupedWithdrawals.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          History ({groupedHistory.length})
        </button>
      </div>

      {activeTab === "pending" && (
      <div className="bg-card border border-border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {!isFinanceAdmin && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedGroupIds.length === groupedWithdrawals.length &&
                        groupedWithdrawals.length > 0
                      }
                      onChange={handleSelectAll}
                      className="h-4 w-4 rounded border-input accent-primary"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  User
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Payment Method
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Withdrawals
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Requested At
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
              {paginatedGroups.map((group, index) => (
                <tr
                  key={group.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {!isFinanceAdmin && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.includes(group.id)}
                        onChange={() => handleSelectGroup(group.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">{startIndex + index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{group.userName}</div>
                    <div className="text-xs text-muted-foreground">{group.userEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{group.userPhone}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    ₱{group.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{group.paymentMethod}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <div className="font-medium">{group.withdrawals.length} withdrawal{group.withdrawals.length > 1 ? 's' : ''}</div>
                      {group.isPooled && (
                        <div className="text-muted-foreground">Pooled Request</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(group.requestedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                      Pending
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(group)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <IconEye className="h-3.5 w-3.5" />
                        View
                      </button>
                      {isFinanceAdmin ? (
                        <button
                          onClick={() => handleApproveGroup(group)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success text-success-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                          Approve
                        </button>
                      ) : (
                        <button
                          onClick={() => handleApproveGroup(group)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                          <IconSend className="h-3.5 w-3.5" />
                          Send
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {groupedWithdrawals.length > 0 && (
          <div className="p-4 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            {!isFinanceAdmin && (
              <button
                onClick={handleSendAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <IconSend className="h-4 w-4" />
                Send All to Finance Team
              </button>
            )}
            <div className="md:ml-auto">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        )}

        {groupedWithdrawals.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No pending withdrawals
          </div>
        )}
      </div>
      )}

      {activeTab === "history" && (
      <div className="bg-card border border-border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  #
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  User
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Contact
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Payment Method
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Withdrawals
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  Requested At
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
              {paginatedHistory.map((group, index) => {
                const firstWithdrawal = group.withdrawals[0];
                const status = firstWithdrawal.status;
                return (
                  <tr
                    key={group.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm">{historyStartIndex + index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{group.userName}</div>
                      <div className="text-xs text-muted-foreground">{group.userEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{group.userPhone}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      ₱{group.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{group.paymentMethod}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs">
                        <div className="font-medium">{group.withdrawals.length} withdrawal{group.withdrawals.length > 1 ? 's' : ''}</div>
                        {group.isPooled && (
                          <div className="text-muted-foreground">Pooled Request</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(group.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {firstWithdrawal.processedAt 
                        ? new Date(firstWithdrawal.processedAt).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        status === "approved" || status === "sent"
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      }`}>
                        {status === "sent" ? "Approved" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleViewDetails(group)}
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

        {groupedHistory.length > 0 && (
          <div className="p-4 border-t border-border flex justify-end">
            <Pagination
              currentPage={historyPage}
              totalPages={historyTotalPages}
              onPageChange={setHistoryPage}
            />
          </div>
        )}

        {groupedHistory.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No withdrawal history
          </div>
        )}
      </div>
      )}

      {/* Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Withdrawal Request Details</DialogTitle>
            <DialogDescription>
              Breakdown of all withdrawals in this request
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4">
              {/* User Info */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-3 text-sm">
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
                    <p className="text-muted-foreground">Total Amount</p>
                    <p className="font-bold text-primary text-lg">₱{selectedGroup.amount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Requested At</p>
                    <p className="font-medium">{new Date(selectedGroup.requestedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Individual Withdrawals */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Individual Withdrawals ({selectedGroup.withdrawals.length})</h3>
                <div className="space-y-2">
                  {selectedGroup.withdrawals.map((withdrawal, idx) => (
                    <div key={withdrawal.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs font-semibold">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-medium">
                            Contract: {withdrawal.contractId.slice(-8)}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-primary">
                          ₱{withdrawal.amount.toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium">Withdrawal #:</span> {withdrawal.withdrawalNumber}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {withdrawal.isPooled ? 'Pooled' : 'Regular'}
                        </div>
                        {withdrawal.isPooled && (
                          <div>
                            <span className="font-medium">Periods:</span> {withdrawal.periodsWithdrawn}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Total W/D:</span> {withdrawal.totalWithdrawals}
                        </div>
                      </div>
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Withdrawals;
