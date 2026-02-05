export type AdminType = "main" | "finance";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  address: string;
  donationAmount: number;
  totalAsset: number;
  createdAt: string;
  kycStatus?: "PENDING" | "APPROVED" | "REJECTED";
  kycSubmittedAt?: string;
  kycManualData?: {
    address?: string;
    phoneNumber?: string;
  };
  kycImageUrl?: string;
  name?: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  status: "pending" | "approved" | "sent";
  requestedAt: string;
  bankDetails: string;
}

export interface Donation {
  id: string;
  userId: string;
  donationAmount: number;
  paymentMethod: string;
  receiptPath: string;
  receiptURL: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  contractEndDate?: string | null;
  donationStartDate?: string | null;
  lastWithdrawalDate?: string | null;
  withdrawalsCount: number;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}
