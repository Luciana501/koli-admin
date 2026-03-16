import React, { useState, useEffect, useMemo } from "react";
import { User } from "@/types/admin";
import { IconX } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { subscribeToPlatformCodes } from "@/services/firestore";

const buildLeaderValue = (leaderId: string, leaderName: string) =>
  `${encodeURIComponent(leaderId.trim())}|${encodeURIComponent(leaderName.trim())}`;

const parseLeaderValue = (value: string) => {
  const [encodedLeaderId = "", encodedLeaderName = ""] = value.split("|");
  return {
    leaderId: decodeURIComponent(encodedLeaderId),
    leaderName: decodeURIComponent(encodedLeaderName),
  };
};

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Partial<User> & { paymentMethod: string; contractType?: string | null; receiptFile?: File | null }) => Promise<void>;
  user: User | null;
  mode: "create" | "edit";
  canEditDonationFields?: boolean;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  user,
  mode,
  canEditDonationFields = true,
}) => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    address: "",
    leaderName: "",
    leaderId: "",
    password: "",
    donationAmount: "0",
    paymentMethod: "bank:BPI",
    contractType: "monthly_12_no_principal",
    donationStartDate: "",
    donationNote: "",
    kycStatus: "NOT_SUBMITTED" as "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED",
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [platformCodeLeaders, setPlatformCodeLeaders] = useState<Array<{ leaderId: string; leaderName: string }>>([]);

  const leaderOptions = useMemo(() => {
    const uniqueLeaders = new Map<string, { leaderId: string; leaderName: string }>();

    platformCodeLeaders.forEach((leader) => {
      const leaderId = (leader.leaderId || "").trim();
      const leaderName = (leader.leaderName || "").trim();
      if (!leaderId && !leaderName) return;

      const key = buildLeaderValue(leaderId, leaderName);
      if (!uniqueLeaders.has(key)) {
        uniqueLeaders.set(key, { leaderId, leaderName });
      }
    });

    return Array.from(uniqueLeaders.entries())
      .map(([value, leader]) => ({
        value,
        leaderId: leader.leaderId,
        leaderName: leader.leaderName,
        label: leader.leaderName || leader.leaderId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [platformCodeLeaders]);

  const selectedLeaderValue =
    formData.leaderId || formData.leaderName
      ? buildLeaderValue(formData.leaderId, formData.leaderName)
      : "unassigned";
  const hasSelectedLeaderInOptions = leaderOptions.some((option) => option.value === selectedLeaderValue);

  useEffect(() => {
    const unsubscribe = subscribeToPlatformCodes((codes) => {
      const leaders = codes.map((code) => ({
        leaderId: code.leaderId || "",
        leaderName: code.leaderName || "",
      }));
      setPlatformCodeLeaders(leaders);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && mode === "edit") {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        address: user.address || "",
        leaderName: user.leaderName || "",
        leaderId: user.leaderId || "",
        password: "",
        donationAmount: "0",
        paymentMethod: "bank:BPI",
        contractType: "current",
        donationStartDate: "",
        donationNote: "",
        kycStatus: user.kycStatus || "NOT_SUBMITTED",
      });
    } else if (mode === "create") {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        address: "",
        leaderName: "",
        leaderId: "",
        password: "",
        donationAmount: "0",
        paymentMethod: "bank:BPI",
        contractType: "monthly_12_no_principal",
        donationStartDate: "",
        donationNote: "",
        kycStatus: "NOT_SUBMITTED",
      });
    }
    setErrors({});
    setReceiptFile(null);
  }, [user, mode, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }
    if (!formData.phoneNumber.trim()) {
      newErrors.phoneNumber = "Phone number is required";
    }
    if (!formData.address.trim()) {
      newErrors.address = "Address is required";
    }
    if (mode === "create" && !formData.password.trim()) {
      newErrors.password = "Password is required";
    } else if (mode === "create" && formData.password.trim().length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const resolvedContractType =
        formData.contractType === "current" ? null : formData.contractType || "monthly_12_no_principal";

      const userData: Partial<User> & {
        paymentMethod: string;
        contractType?: string | null;
        donationStartDate?: string | null;
        donationNote?: string;
        receiptFile?: File | null;
      } = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        address: formData.address.trim(),
        leaderName: formData.leaderName.trim() || undefined,
        leaderId: formData.leaderId.trim() || undefined,
        donationAmount: parseFloat(formData.donationAmount) || 0,
        paymentMethod: formData.paymentMethod?.trim() || "bank:BPI",
        contractType: resolvedContractType,
        donationStartDate: formData.donationStartDate || null,
        donationNote: formData.donationNote?.trim() || "",
        receiptFile,
        kycStatus: formData.kycStatus,
      };

      // Add password for create mode
      if (mode === "create") {
        (userData as any).password = formData.password.trim();
      }

      await onSave(userData);
      onClose();
    } catch (error) {
      console.error("Error saving user:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/50"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">
            {mode === "create" ? "Create New User" : "Edit User"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Tabs defaultValue="user" className="w-full">
            <TabsList className="w-full grid grid-cols-2">
              <TabsTrigger value="user">User Info</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
            </TabsList>

            <TabsContent value="user" className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    First Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="Enter first name"
                    className={errors.firstName ? "border-destructive" : ""}
                  />
                  {errors.firstName && (
                    <p className="text-xs text-destructive">{errors.firstName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Last Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="Enter last name"
                    className={errors.lastName ? "border-destructive" : ""}
                  />
                  {errors.lastName && (
                    <p className="text-xs text-destructive">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Phone Number <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  placeholder="Enter phone number"
                  className={errors.phoneNumber ? "border-destructive" : ""}
                />
                {errors.phoneNumber && (
                  <p className="text-xs text-destructive">{errors.phoneNumber}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Address <span className="text-destructive">*</span>
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address"
                  className={errors.address ? "border-destructive" : ""}
                />
                {errors.address && (
                  <p className="text-xs text-destructive">{errors.address}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Leader</label>
                <Select
                  value={selectedLeaderValue}
                  onValueChange={(value) => {
                    if (value === "unassigned") {
                      setFormData({ ...formData, leaderId: "", leaderName: "" });
                      return;
                    }

                    const parsed = parseLeaderValue(value);
                    setFormData({
                      ...formData,
                      leaderId: parsed.leaderId,
                      leaderName: parsed.leaderName,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select leader" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {!hasSelectedLeaderInOptions && selectedLeaderValue !== "unassigned" && (
                      <SelectItem value={selectedLeaderValue}>
                        {formData.leaderName || formData.leaderId} (Current)
                      </SelectItem>
                    )}
                    {leaderOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} ({option.leaderId || "N/A"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mode === "create" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Password <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Enter password (min 6 characters)"
                    className={errors.password ? "border-destructive" : ""}
                  />
                  {errors.password && (
                    <p className="text-xs text-destructive">{errors.password}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">KYC Status</label>
                <Select
                  value={formData.kycStatus}
                  onValueChange={(value: any) => setFormData({ ...formData, kycStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_SUBMITTED">Not Submitted</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="financial" className="mt-4 space-y-4">
              {canEditDonationFields && (
                <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {mode === "edit" ? "Add Donation Entry" : "Donation Amount"}
                    </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.donationAmount}
                        onChange={(e) => setFormData({ ...formData, donationAmount: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Payment Method</label>
                      <Select
                        value={formData.paymentMethod}
                        onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank:BPI">Bank:BPI</SelectItem>
                          <SelectItem value="bank:GoTyme">Bank:GoTyme</SelectItem>
                          <SelectItem value="gcash:GCash">GCash</SelectItem>
                          <SelectItem value="maya:Maya">Maya</SelectItem>
                          <SelectItem value="paypal:PayPal">PayPal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Donation Start Date</label>
                    <Input
                      type="date"
                      value={formData.donationStartDate}
                      onChange={(e) => setFormData({ ...formData, donationStartDate: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Contract Type</label>
                    <Select
                      value={formData.contractType}
                      onValueChange={(value) => setFormData({ ...formData, contractType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select contract type" />
                      </SelectTrigger>
                      <SelectContent>
                        {mode === "edit" && (
                          <SelectItem value="current">Keep current</SelectItem>
                        )}
                        <SelectItem value="monthly_12_no_principal">30% Monthly for 1 Year</SelectItem>
                        <SelectItem value="lockin_6_compound">6-Month Lock-In (Compounded)</SelectItem>
                        <SelectItem value="lockin_12_compound">12-Month Lock-In (Compounded)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Receipt Upload</label>
                    <Input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    />
                    {receiptFile && (
                      <p className="text-xs text-muted-foreground truncate">
                        Selected: {receiptFile.name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes</label>
                    <Textarea
                      value={formData.donationNote}
                      onChange={(e) => setFormData({ ...formData, donationNote: e.target.value })}
                      placeholder="Add a note for this donation entry"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Saving..." : mode === "create" ? "Create User" : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserFormModal;
