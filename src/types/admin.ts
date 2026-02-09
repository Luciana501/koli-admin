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
  userEmail: string;
  userPhone: string;
  amount: number;
  status: "pending" | "approved" | "sent";
  requestedAt: string;
  processedAt: string | null;
  processedBy: string | null;
  contractId: string;
  gcashNumber: string;
  isPooled: boolean;
  notes: string;
  paymentMethod: string;
  periodsWithdrawn: number;
  totalWithdrawals: number;
  transactionProof: string | null;
  withdrawalNumber: number;
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

export interface RewardClaim {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  claimAmount: number;
  claimedAt: string;
  claimedDate: string;
  poolAfter: number;
  poolBefore: number;
  rewardPoolId: string;
  secretCode: string;
  timeToClaim: number;
  timeToClaimMinutes: number;
}
