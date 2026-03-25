import { adminDb } from "@/lib/firebaseAdmin";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", process.env.CASHOUT_ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { requestId, reason } = req.body || {};
    if (!requestId) return res.status(400).json({ error: "Missing requestId" });

    console.log(`[Cashout Reject] Processing requestId: ${requestId}, reason: ${reason}`);

    const ref = adminDb.collection("kashCashouts").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`[Cashout Reject] Cashout not found for requestId: ${requestId}`);
      return res.status(404).json({ error: "Cashout not found" });
    }

    await ref.set(
      {
        status: "REJECTED",
        rejectionReason: reason || "Rejected by fiat admin",
        processedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[Cashout Reject] Successfully rejected cashout for requestId: ${requestId}`);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[Cashout Reject] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to reject cashout" });
  }
}
