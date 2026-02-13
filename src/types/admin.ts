export type AdminType = "developer" | "finance";

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
  kycStatus?: "PENDING" | "APPROVED" | "REJECTED" | "NOT_SUBMITTED";
  kycSubmittedAt?: string;
  kycManualData?: {
    address?: string;
    phoneNumber?: string;
  };
  kycImageUrl?: string;
  name?: string;
  role?: string;
  status?: string;
  uid?: string;
  leaderId?: string;
  leaderName?: string;
  platformCode?: string;
  platformCodeId?: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  status: "pending" | "sent" | "approved" | "rejected" | "returned";
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
  financeNote?: string;
  mainAdminNote?: string;
  // Additional fields from payout_queue collection
  actualAmountWithdrawn?: number;
  grossAmount?: number;
  netAmount?: number;
  platformFee?: number;
  remainingBalance?: number;
  totalWithdrawnSoFar?: number;
  withdrawalSessionId?: string;
  // Correct total withdrawable balance calculated using calculateTotalWithdrawable logic
  totalWithdrawableBalance?: number;
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

export interface ODHexWithdrawal {
  id: string;
  userId: string;
  userEmail: string;
  leaderId?: string;
  leaderName?: string;
  amount: number;
  method: "ewallet" | "bank";
  provider: string;
  accountDetails: string;
  status: "pending" | "completed" | "rejected";
  requestedAt: string;
  processedAt: string | null;
  processedBy?: string | null;
  rejectionReason?: string;
}