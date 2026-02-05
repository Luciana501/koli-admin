import React from "react";
import { User } from "@/types/admin";
import { IconX } from "@tabler/icons-react";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-foreground/50"
        onClick={onClose}
      />
      <div className="relative bg-card border border-border rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">User Information</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">First Name</label>
              <p className="text-base font-medium">{user.firstName}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Last Name</label>
              <p className="text-base font-medium">{user.lastName}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Email Address</label>
            <p className="text-base font-medium">{user.email}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
            <p className="text-base font-medium">{user.phoneNumber}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            <p className="text-base font-medium">{user.address}</p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Donation Amount</label>
              <p className="text-base font-medium">₱{user.donationAmount.toLocaleString()}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Total Asset</label>
              <p className="text-base font-medium">₱{user.totalAsset.toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">E-Wallet(s)</label>
            <p className="text-base font-medium text-muted-foreground italic">No e-wallets connected yet</p>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <label className="text-sm font-medium text-muted-foreground">Account Created</label>
            <p className="text-base font-medium">{new Date(user.createdAt).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">User ID</label>
            <p className="text-base font-medium font-mono text-sm">{user.id}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
