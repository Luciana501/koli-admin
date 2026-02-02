export type AdminType = "main" | "finance";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  address: string;
  depositAmount: number;
  totalAsset: number;
  createdAt: string;
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
