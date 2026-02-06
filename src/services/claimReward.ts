import { db } from "@/lib/firebase";
import { doc, runTransaction, collection, addDoc, getDocs, query, where, increment } from "firebase/firestore";

/**
 * Claim a reward code for a user.
 * @param userId - The user's Firestore ID
 * @param rewardCode - The code to claim (string)
 * @param claimAmount - The amount to claim (number)
 */
export async function claimReward(userId: string, rewardCode: string, claimAmount: number) {
  const globalRewardRef = doc(db, "globalRewards", "currentActiveReward");
  const rewardsHistoryRef = collection(db, "rewardsHistory");
  const membersRef = doc(db, "members", userId);
  const rewardClaimsRef = collection(db, "rewardClaims");

  await runTransaction(db, async (transaction) => {
    // 1. Get global reward
    const globalRewardSnap = await transaction.get(globalRewardRef);
    if (!globalRewardSnap.exists()) throw new Error("Reward code not found");
    const globalReward = globalRewardSnap.data();

    // 2. Check remainingPool
    if (globalReward.remainingPool < claimAmount) throw new Error("Insufficient pool");

    // 3. Get user
    const userSnap = await transaction.get(membersRef);
    if (!userSnap.exists()) throw new Error("User not found");
    const user = userSnap.data();

    // 4. Count existing claims for this code
    const q = query(rewardClaimsRef, where("rewardCode", "==", rewardCode));
    const claimsSnap = await getDocs(q);
    const claimOrder = claimsSnap.size + 1;

    // 5. Write claim
    const now = new Date().toISOString();
    transaction.set(doc(rewardClaimsRef), {
      userId,
      rewardCode,
      claimedAmount: claimAmount,
      claimedAt: now,
      codeCreatedAt: globalReward.createdAt,
      claimOrder,
    });

    // 6. Update user balance and earnings
    transaction.update(membersRef, {
      balance: increment(claimAmount),
      totalEarnings: increment(claimAmount),
    });

    // 7. Update globalRewards.remainingPool
    const newRemaining = globalReward.remainingPool - claimAmount;
    transaction.update(globalRewardRef, {
      remainingPool: newRemaining,
    });

    // 8. If depleted, update rewardsHistory.status
    if (newRemaining <= 0) {
      // Find the rewardsHistory doc for this code
      const rhQuery = query(rewardsHistoryRef, where("secretCode", "==", rewardCode));
      const rhSnap = await getDocs(rhQuery);
      rhSnap.forEach((docSnap) => {
        transaction.update(doc(rewardsHistoryRef, docSnap.id), { status: "depleted" });
      });
    }
  });
}