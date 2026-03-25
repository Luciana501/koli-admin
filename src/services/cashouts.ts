const kashApiBase = (import.meta.env.VITE_KASH_API_BASE_URL || "").replace(/\/$/, "");

function endpoint(path: string) {
  if (!kashApiBase) return "";
  return `${kashApiBase}${path}`;
}

async function parseError(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const err = await res.json().catch(() => ({}));
    return err?.error || `${fallback} (HTTP ${res.status})`;
  }
  return `${fallback} (HTTP ${res.status})`;
}

export async function startFiatExchange(requestId: string) {
  const url = endpoint("/api/kash-cashouts/start");
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });

  if (!res.ok) {
    const message = await parseError(res, "Failed to start fiat exchange");
    throw new Error(message);
  }
}

export async function completeKashCashout(requestId: string) {
  const url = endpoint("/api/kash-cashouts/complete");
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });

  if (!res.ok) {
    const message = await parseError(res, "Failed to complete cashout");
    throw new Error(message);
  }
}

export async function rejectKashCashout(requestId: string, reason: string) {
  const url = endpoint("/api/kash-cashouts/reject");
  if (!url) return;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, reason }),
  });

  if (!res.ok) {
    const message = await parseError(res, "Failed to reject cashout");
    throw new Error(message);
  }
}
