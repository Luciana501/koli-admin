import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function startFiatExchange(requestId: string) {
  const ref = doc(db, "kashCashouts", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Cashout not found");
  }
  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: "FIAT_EXCHANGING",
    fiatStartedAt: now,
    updatedAt: now,
  });
}

export async function completeKashCashout(requestId: string) {
  const ref = doc(db, "kashCashouts", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Cashout not found");
  }
  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: "APPROVED",
    fiatApprovedAt: now,
    updatedAt: now,
  });
}

export async function rejectKashCashout(requestId: string, reason: string) {
  const ref = doc(db, "kashCashouts", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error("Cashout not found");
  }
  const now = new Date().toISOString();
  await updateDoc(ref, {
    status: "REJECTED",
    rejectionReason: reason || "Rejected by fiat admin",
    processedAt: now,
    updatedAt: now,
  });
}
