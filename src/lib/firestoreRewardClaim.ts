// Firestore Reward Claim Transaction Logic
// This should be called when a user claims a reward code
import { db } from "./firebase";
import {
  doc,
  runTransaction,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  increment,
  updateDoc,
} from "firebase/firestore";

/**
 * Claim a reward code transactionally
 * @param {string} userId - The ID of the user claiming
 * @param {string} rewardCode - The code being claimed (matches secretCode)
 * @param {number} claimedAmount - The amount to claim
 */
export async function claimReward({ userId, rewardCode, claimedAmount }) {
  await runTransaction(db, async (transaction) => {
    // 1. Get the globalRewards doc for this code
    const globalRewardsQuery = query(
      collection(db, "globalRewards"),
      where("activeCode", "==", rewardCode)
    );
    const globalRewardsSnap = await getDocs(globalRewardsQuery);
    if (globalRewardsSnap.empty) throw new Error("Reward code not found");
    const globalRewardDoc = globalRewardsSnap.docs[0];
    const globalRewardRef = globalRewardDoc.ref;
    const globalRewardData = globalRewardDoc.data();

    // 2. Get the rewardsHistory doc for this code
    const rewardsHistoryQuery = query(
      collection(db, "rewardsHistory"),
      where("secretCode", "==", rewardCode)
    );
    const rewardsHistorySnap = await getDocs(rewardsHistoryQuery);
    if (rewardsHistorySnap.empty) throw new Error("Reward history not found");
    const rewardsHistoryDoc = rewardsHistorySnap.docs[0];
    const rewardsHistoryRef = rewardsHistoryDoc.ref;

    // 3. Get the user doc
    const userRef = doc(db, "members", userId);

    // 4. Get current number of claims for this code
    const claimsQuery = query(
      collection(db, "rewardClaims"),
      where("rewardCode", "==", rewardCode)
    );
    const claimsSnap = await getDocs(claimsQuery);
    const claimOrder = claimsSnap.size + 1;

    // 5. Check remainingPool
    if (globalRewardData.remainingPool < claimedAmount) {
      throw new Error("Not enough remaining pool");
    }

    // 6. Write claim doc
    const now = new Date().toISOString();
    await addDoc(collection(db, "rewardClaims"), {
      userId,
      rewardCode,
      claimedAmount,
      claimedAt: now,
      codeCreatedAt: globalRewardData.createdAt,
      claimOrder,
    });

    // 7. Update remainingPool
    transaction.update(globalRewardRef, {
      remainingPool: globalRewardData.remainingPool - claimedAmount,
      updatedAt: now,
    });

    // 8. Update user balance and totalEarnings
    transaction.update(userRef, {
      balance: increment(claimedAmount),
      totalEarnings: increment(claimedAmount),
    });

    // 9. If depleted, update rewardsHistory.status
    if (globalRewardData.remainingPool - claimedAmount <= 0) {
      transaction.update(rewardsHistoryRef, { status: "depleted" });
    }
  });
}

// Firestore Index Suggestions (add in Firebase console):
// 1. rewardClaims: Composite index on rewardCode+claimedAt
// 2. rewardClaims: Composite index on userId+claimedAt
// 3. rewardsHistory: Composite index on status+createdAt
// 4. rewardsHistory: Composite index on createdAt
