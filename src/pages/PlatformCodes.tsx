import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import PageLoading from "@/components/PageLoading";
import {
  createPlatformCode,
  deletePlatformCode,
  PlatformCode,
  subscribeToPlatformCodes,
  updatePlatformCode,
} from "@/services/firestore";

const PlatformCodes = () => {
  const generateRandomCode = (length = 6) => {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let index = 0; index < length; index += 1) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  };

  const [codes, setCodes] = useState<PlatformCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [leaderSearch, setLeaderSearch] = useState("");
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<PlatformCode | null>(null);
  const [modalLeaderName, setModalLeaderName] = useState("");
  const [modalLeaderId, setModalLeaderId] = useState("");
  const [modalDescription, setModalDescription] = useState("");
  const [modalMaxUses, setModalMaxUses] = useState("");
  const [modalActive, setModalActive] = useState(true);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalDeleting, setModalDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();

  useEffect(() => {
    let unsubscribe = () => undefined;

    try {
      unsubscribe = subscribeToPlatformCodes((data) => {
        setCodes(data);
        setLoading(false);
      });
    } catch (error) {
      console.error("Failed to subscribe to platform codes:", error);
      setLoading(false);
      toast({
        title: "Could not load platform codes",
        description: "Please refresh the page or check your connection.",
        variant: "destructive",
      });
    }

    return () => unsubscribe();
  }, [toast]);

  const activeCount = useMemo(
    () => codes.filter((platformCode) => platformCode.isActive).length,
    [codes]
  );

  const filteredCodes = useMemo(() => {
    const searchValue = leaderSearch.trim().toLowerCase();
    if (!searchValue) {
      return codes;
    }

    return codes.filter((platformCode) => {
      const name = platformCode.leaderName?.toLowerCase() || "";
      return name.includes(searchValue);
    });
  }, [codes, leaderSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredCodes.length / itemsPerPage));

  const paginatedCodes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCodes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCodes, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [leaderSearch]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  const resetForm = () => {
    setCode("");
    setDescription("");
    setLeaderId("");
    setLeaderName("");
    setMaxUses("");
  };

  const handleCreateCode = async () => {
    if (!leaderId.trim() || !leaderName.trim()) {
      toast({
        title: "Missing required fields",
        description: "Leader Code and Leader Name are required.",
        variant: "destructive",
      });
      return;
    }

    const parsedMaxUses = maxUses.trim() ? Number(maxUses) : null;
    if (parsedMaxUses !== null && (!Number.isFinite(parsedMaxUses) || parsedMaxUses <= 0)) {
      toast({
        title: "Invalid max uses",
        description: "Max Uses must be a positive number.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const finalCode = code.trim() ? code.trim().toUpperCase() : generateRandomCode(6);

      await createPlatformCode({
        code: finalCode,
        description,
        leaderId,
        leaderName,
        maxUses: parsedMaxUses,
      });

      toast({
        title: "Platform code created",
        description: code.trim()
          ? "The new leader platform code has been saved to Firestore."
          : `Generated code ${finalCode} has been saved to Firestore.`,
      });

      resetForm();
    } catch (error: any) {
      toast({
        title: "Failed to create code",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleViewLeader = (platformCode: PlatformCode) => {
    setSelectedCode(platformCode);
    setModalLeaderName(platformCode.leaderName || "");
    setModalLeaderId(platformCode.leaderId || "");
    setModalDescription(platformCode.description || "");
    setModalMaxUses(
      typeof platformCode.maxUses === "number" && Number.isFinite(platformCode.maxUses)
        ? String(platformCode.maxUses)
        : ""
    );
    setModalActive(platformCode.isActive);
    setLeaderModalOpen(true);
  };

  const handleSaveModal = async () => {
    if (!selectedCode) return;

    if (!modalLeaderName.trim() || !modalLeaderId.trim()) {
      toast({
        title: "Missing required fields",
        description: "Leader Name and Leader Code are required.",
        variant: "destructive",
      });
      return;
    }

    const parsedMaxUses = modalMaxUses.trim() ? Number(modalMaxUses) : null;
    if (parsedMaxUses !== null && (!Number.isFinite(parsedMaxUses) || parsedMaxUses <= 0)) {
      toast({
        title: "Invalid max uses",
        description: "Max Uses must be a positive number.",
        variant: "destructive",
      });
      return;
    }

    setModalSaving(true);
    try {
      await updatePlatformCode(selectedCode.id, {
        description: modalDescription,
        leaderId: modalLeaderId,
        leaderName: modalLeaderName,
        maxUses: parsedMaxUses,
        isActive: modalActive,
      });

      toast({
        title: "Code updated",
        description: `${selectedCode.code} has been updated.`,
      });
      setLeaderModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Failed to update code",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteModal = async () => {
    if (!selectedCode) return;

    const shouldDelete = window.confirm(`Delete platform code ${selectedCode.code}?`);
    if (!shouldDelete) return;

    setModalDeleting(true);
    try {
      await deletePlatformCode(selectedCode.id);
      toast({
        title: "Code deleted",
        description: `${selectedCode.code} has been deleted.`,
      });
      setLeaderModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Failed to delete code",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setModalDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Codes</h1>
        <p className="text-muted-foreground">Create and manage leader platform codes.</p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 md:p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Create Platform Code</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <Input
            placeholder="Code (e.g. KOLI2026)"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
          />
          <Input
            placeholder="Leader Code"
            value={leaderId}
            onChange={(event) => setLeaderId(event.target.value)}
          />
          <Input
            placeholder="Leader Name"
            value={leaderName}
            onChange={(event) => setLeaderName(event.target.value)}
          />
          <Input
            placeholder="Description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <Input
            type="number"
            placeholder="Max Uses (optional)"
            value={maxUses}
            onChange={(event) => setMaxUses(event.target.value)}
          />
        </div>

        <p className="text-xs text-muted-foreground">Code will be generated randomly if left empty.</p>

        <div className="flex justify-end">
          <Button onClick={handleCreateCode} disabled={saving}>
            {saving ? "Saving..." : "Create Code"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-semibold">Existing Codes</h2>
            <p className="text-sm text-muted-foreground">
              Total: {codes.length} • Active: {activeCount}
            </p>
          </div>
          <div className="w-full max-w-xs">
            <Input
              placeholder="Search by leader name"
              value={leaderSearch}
              onChange={(event) => setLeaderSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <PageLoading className="min-h-[16rem]" />
          ) : filteredCodes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {leaderSearch.trim() ? "No matching leaders found." : "No platform codes yet."}
            </div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Code</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Leader</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Description</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Usage</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Created</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Active</th>
                </tr>
              </thead>
              <tbody>
                {paginatedCodes.map((platformCode) => (
                  <tr key={platformCode.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm font-semibold">{platformCode.code}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium">{platformCode.leaderName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{platformCode.leaderId || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">{platformCode.description || "—"}</td>
                    <td className="px-4 py-3 text-sm">
                      {platformCode.usageCount}
                      {typeof platformCode.maxUses === "number" ? ` / ${platformCode.maxUses}` : ""}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(platformCode.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" onClick={() => handleViewLeader(platformCode)}>
                        View Leader
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && filteredCodes.length > 0 && totalPages > 1 && (
          <div className="p-4 border-t border-border">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((previousPage) => Math.max(1, previousPage - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
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
                    onClick={() => setCurrentPage((previousPage) => Math.min(totalPages, previousPage + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <Dialog open={leaderModalOpen} onOpenChange={setLeaderModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Leader Details</DialogTitle>
            <DialogDescription>Edit, delete, and update active status for this platform code.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Leader Name</p>
              <Input value={modalLeaderName} onChange={(event) => setModalLeaderName(event.target.value)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leader Code</p>
              <Input value={modalLeaderId} onChange={(event) => setModalLeaderId(event.target.value)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <Input value={modalDescription} onChange={(event) => setModalDescription(event.target.value)} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Max Uses (optional)</p>
              <Input type="number" value={modalMaxUses} onChange={(event) => setModalMaxUses(event.target.value)} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Active</p>
              <Switch checked={modalActive} onCheckedChange={setModalActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteModal} disabled={modalDeleting || modalSaving}>
              {modalDeleting ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setLeaderModalOpen(false)} disabled={modalDeleting || modalSaving}>
              Close
            </Button>
            <Button onClick={handleSaveModal} disabled={modalDeleting || modalSaving}>
              {modalSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformCodes;
