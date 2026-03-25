export async function startFiatExchange(requestId: string) {
  const res = await fetch("/api/kash-cashouts/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to start fiat exchange");
  }
}

export async function completeKashCashout(requestId: string) {
  const res = await fetch("/api/kash-cashouts/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to complete cashout");
  }
}

export async function rejectKashCashout(requestId: string, reason: string) {
  const res = await fetch("/api/kash-cashouts/reject", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, reason }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to reject cashout");
  }
}
