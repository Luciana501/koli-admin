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

    console.log(`[Cashout Start] Processing requestId: ${requestId}`);

    const ref = adminDb.collection("kashCashouts").doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.warn(`[Cashout Start] Cashout not found for requestId: ${requestId}`);
      return res.status(404).json({ error: "Cashout not found" });
    }

    await ref.set(
      {
        status: "FIAT_EXCHANGING",
        fiatStartedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    console.log(`[Cashout Start] Successfully started fiat exchange for requestId: ${requestId}`);
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[Cashout Start] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to start fiat exchange" });
  }
}
