import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, Timestamp } from "firebase/firestore";

// Filter by date range, status
export async function getRewardHistory({ startDate, endDate, status }: { startDate?: string, endDate?: string, status?: string }) {
  const colRef = collection(db, "rewardsHistory");
  let filters: any[] = [];
  if (startDate) filters.push(where("createdAt", ">=", startDate));
  if (endDate) filters.push(where("createdAt", "<=", endDate));
  if (status) filters.push(where("status", "==", status));
  const q = filters.length > 0 ? query(colRef, ...filters) : colRef;
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// For each reward code, compute analytics
export async function getRewardCodeAnalytics(rewardCode: string) {
  const claimsQ = query(collection(db, "rewardClaims"), where("rewardCode", "==", rewardCode));
  const claimsSnap = await getDocs(claimsQ);
  const claims = claimsSnap.docs.map(doc => doc.data());
  if (claims.length === 0) return null;
  const totalClaimed = claims.reduce((sum, c) => sum + c.claimedAmount, 0);
  const numClaimers = claims.length;
  const firstClaim = claims.reduce((min, c) => c.claimedAt < min ? c.claimedAt : min, claims[0].claimedAt);
  const codeCreatedAt = claims[0].codeCreatedAt;
  const timeToFirstClaim = new Date(firstClaim).getTime() - new Date(codeCreatedAt).getTime();
  return { totalClaimed, numClaimers, timeToFirstClaim };
}