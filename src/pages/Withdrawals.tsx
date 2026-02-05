import React, { useState, useEffect } from "react";
import { Withdrawal } from "@/types/admin";
import { subscribeToWithdrawals, updateWithdrawalStatus } from "@/services/firestore";
import { useAuth } from "@/context/AuthContext";
import { IconSend, IconCheck } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/hooks/use-toast";

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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

  const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending");
  const totalPages = Math.ceil(pendingWithdrawals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedWithdrawals = pendingWithdrawals.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const handleSelectAll = () => {
    if (selectedIds.length === pendingWithdrawals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingWithdrawals.map((w) => w.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSendIndividual = async (id: string) => {
    const success = await updateWithdrawalStatus(id, "approved", adminType || "");
    if (success) {
      toast({
        title: "Withdrawal Approved",
        description: "Payment has been processed successfully.",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to approve withdrawal.",
        variant: "destructive",
      });
    }
  };

  const handleSendSelected = async () => {
    if (adminType !== "finance") {
      toast({
        title: "Unauthorized",
        description: "Only finance admin can approve withdrawals.",
        variant: "destructive",
      });
      return;
    }

    if (selectedIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one withdrawal to approve.",
        variant: "destructive",
      });
      return;
    }

    const promises = selectedIds.map((id) =>
      updateWithdrawalStatus(id, "approved", adminType)
    );
    
    await Promise.all(promises);
    setSelectedIds([]);
    
    toast({
      title: "Withdrawals Approved",
      description: `${selectedIds.length} withdrawal(s) have been approved.`,
    });
  };

  const handleSendAll = async () => {
    if (pendingWithdrawals.length === 0) {
      toast({
        title: "No Withdrawals",
        description: "There are no pending withdrawals to send.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Sent to Finance",
      description: `${pendingWithdrawals.length} withdrawal(s) sent to finance team for approval.`,
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
        {isFinanceAdmin && selectedIds.length > 0 && (
          <button
            onClick={handleSendSelected}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm md:text-base font-medium hover:opacity-90 transition-opacity w-full sm:w-auto"
          >
            <IconCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Approve Selected ({selectedIds.length})</span>
            <span className="sm:hidden">Send ({selectedIds.length})</span>
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {!isFinanceAdmin && (
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={
                        selectedIds.length === pendingWithdrawals.length &&
                        pendingWithdrawals.length > 0
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
                  Amount
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">
                  E-Wallet(s)
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
              {paginatedWithdrawals.map((withdrawal, index) => (
                <tr
                  key={withdrawal.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {!isFinanceAdmin && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(withdrawal.id)}
                        onChange={() => handleSelect(withdrawal.id)}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm">{startIndex + index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">
                    {withdrawal.userName}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">
                    ₱{withdrawal.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{withdrawal.bankDetails}</td>
                  <td className="px-4 py-3 text-sm">{withdrawal.requestedAt}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
                      Pending
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isFinanceAdmin ? (
                      <button
                        onClick={() => handleSendIndividual(withdrawal.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success text-success-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <IconCheck className="h-3.5 w-3.5" />
                        Approve
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendIndividual(withdrawal.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
                      >
                        <IconSend className="h-3.5 w-3.5" />
                        Send
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pendingWithdrawals.length > 0 && (
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

        {pendingWithdrawals.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No pending withdrawals
          </div>
        )}
      </div>
    </div>
  );
};

export default Withdrawals;
