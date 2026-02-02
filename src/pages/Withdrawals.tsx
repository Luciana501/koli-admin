import React, { useState } from "react";
import { Withdrawal } from "@/types/admin";
import { mockWithdrawals } from "@/data/mockData";
import { useAuth } from "@/context/AuthContext";
import { IconSend, IconCheck } from "@tabler/icons-react";
import Pagination from "@/components/Pagination";
import { useToast } from "@/hooks/use-toast";

const Withdrawals = () => {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>(mockWithdrawals);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { adminType } = useAuth();
  const { toast } = useToast();
  const itemsPerPage = 5;

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

  const handleSendIndividual = (id: string) => {
    setWithdrawals((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "sent" as const } : w))
    );
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    toast({
      title: "Withdrawal sent",
      description: "The withdrawal request has been sent to the finance team.",
    });
  };

  const handleSendAll = () => {
    if (selectedIds.length === 0) {
      toast({
        title: "No withdrawals selected",
        description: "Please select at least one withdrawal to send.",
        variant: "destructive",
      });
      return;
    }

    setWithdrawals((prev) =>
      prev.map((w) =>
        selectedIds.includes(w.id) ? { ...w, status: "sent" as const } : w
      )
    );
    setSelectedIds([]);
    toast({
      title: "Withdrawals sent",
      description: `${selectedIds.length} withdrawal request(s) sent to the finance team.`,
    });
  };

  const isFinanceAdmin = adminType === "finance";

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Withdrawals</h1>
          <p className="text-muted-foreground mt-1">
            {isFinanceAdmin
              ? "Review and process withdrawal requests"
              : "Manage withdrawal requests"}
          </p>
        </div>
        {!isFinanceAdmin && selectedIds.length > 0 && (
          <button
            onClick={handleSendAll}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            <IconSend className="h-4 w-4" />
            Send All Selected ({selectedIds.length})
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
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
                  Bank Details
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
                    ${withdrawal.amount.toLocaleString()}
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
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
            {!isFinanceAdmin && (
              <button
                onClick={handleSendAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <IconSend className="h-4 w-4" />
                Send All to Finance Team
              </button>
            )}
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
