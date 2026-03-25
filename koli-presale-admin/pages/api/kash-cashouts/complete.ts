import { adminDb } from "@/lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CASHOUT_ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { requestId } = req.body || {};
    if (!requestId) return res.status(400).json({ error: "Missing requestId" });

    console.log(`[Cashout Complete] Processing requestId: ${requestId}`);

    const cashoutRef = adminDb.collection("kashCashouts").doc(requestId);
    const snap = await cashoutRef.get();
    if (!snap.exists) {
      console.warn(`[Cashout Complete] Cashout not found for requestId: ${requestId}`);
      return res.status(404).json({ error: "Cashout not found" });
    }

    const data = snap.data() || {};
    const firebaseUid = String(data.firebaseUid || "");
    const amount = Number(data.amount || 0);

    if (!firebaseUid || !Number.isFinite(amount)) {
      console.warn(`[Cashout Complete] Invalid cashout data - firebaseUid: ${firebaseUid}, amount: ${amount}`);
      return res.status(400).json({ error: "Invalid cashout data" });
    }

    await cashoutRef.set(
      {
        status: "APPROVED",
        fiatApprovedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const txRef = adminDb.collection("kashTransactions").doc();
    await txRef.set({
      id: txRef.id,
      kashAccountId: data.walletId || null,
      firebaseUid,
      email: data.email || null,
      displayName: data.displayName || null,
      walletPublicKey: data.walletPublicKey || null,
      direction: "DEBIT",
      type: "KASH_CASHOUT",
      sourceApp: "K_KASH",
      amount,
      balanceAfter: null,
      txHash: data.txHash || null,
      reference: requestId,
      status: "COMPLETED",
      metadata: {
        cashoutRequestId: requestId,
        channelId: data.channelId || null,
        channelLabel: data.channelLabel || null,
        channelType: data.channelType || null,
        stage: "fiat_exchange_completed",
      },
      createdAt: new Date().toISOString(),
    });

    console.log(`[Cashout Complete] Successfully completed cashout for requestId: ${requestId}`);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[Cashout Complete] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to complete cashout" });
  }
}
