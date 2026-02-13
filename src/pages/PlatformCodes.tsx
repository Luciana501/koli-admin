import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  createPlatformCode,
  PlatformCode,
  subscribeToPlatformCodes,
  updatePlatformCodeStatus,
} from "@/services/firestore";

const PlatformCodes = () => {
  const [codes, setCodes] = useState<PlatformCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const [maxUses, setMaxUses] = useState("");
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

  const resetForm = () => {
    setCode("");
    setDescription("");
    setLeaderId("");
    setLeaderName("");
    setMaxUses("");
  };

  const handleCreateCode = async () => {
    if (!code.trim() || !leaderId.trim() || !leaderName.trim()) {
      toast({
        title: "Missing required fields",
        description: "Code, Leader ID, and Leader Name are required.",
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
      await createPlatformCode({
        code,
        description,
        leaderId,
        leaderName,
        maxUses: parsedMaxUses,
      });

      toast({
        title: "Platform code created",
        description: "The new leader platform code has been saved to Firestore.",
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

  const handleToggleStatus = async (platformCode: PlatformCode, isActive: boolean) => {
    try {
      await updatePlatformCodeStatus(platformCode.id, isActive);
      toast({
        title: "Code updated",
        description: `${platformCode.code} is now ${isActive ? "active" : "inactive"}.`,
      });
    } catch (error) {
      console.error("Error updating platform code status:", error);
      toast({
        title: "Update failed",
        description: "Could not update platform code status.",
        variant: "destructive",
      });
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
            placeholder="Leader ID"
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

        <div className="flex justify-end">
          <Button onClick={handleCreateCode} disabled={saving}>
            {saving ? "Saving..." : "Create Code"}
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Existing Codes</h2>
            <p className="text-sm text-muted-foreground">
              Total: {codes.length} • Active: {activeCount}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading platform codes...</div>
          ) : codes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No platform codes yet.</div>
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
                {codes.map((platformCode) => (
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
                      <Switch
                        checked={platformCode.isActive}
                        onCheckedChange={(value) => handleToggleStatus(platformCode, value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlatformCodes;
