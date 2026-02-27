import React from "react";
import { Button } from "@/components/ui/button";

const DEFAULT_PRESALE_ADMIN_URL = "/koli-presale-admin";

const PresaleAdmin: React.FC = () => {
  const configuredUrl = import.meta.env.VITE_PRESALE_ADMIN_URL?.trim();
  const targetUrl = configuredUrl || DEFAULT_PRESALE_ADMIN_URL;

  const isRecursiveEmbed = React.useMemo(() => {
    if (typeof window === "undefined") return false;

    try {
      const resolvedTarget = new URL(targetUrl, window.location.origin);
      return (
        resolvedTarget.origin === window.location.origin &&
        resolvedTarget.pathname === window.location.pathname
      );
    } catch {
      return false;
    }
  }, [targetUrl]);

  if (isRecursiveEmbed) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-6 text-card-foreground">
        <h2 className="text-lg font-semibold">Presale Admin URL Configuration</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The embedded URL currently points to this same route, which causes a recursive load.
          Set `VITE_PRESALE_ADMIN_URL` to the deployed Presale Admin path (for example
          `/koli-presale-admin`) and reload.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Embedded from <span className="font-mono">{targetUrl}</span>
        </p>
        <Button asChild variant="outline" size="sm">
          <a href={targetUrl} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </Button>
      </div>
      <div className="h-[calc(100vh-11rem)] min-h-[560px] overflow-hidden rounded-lg border bg-background">
        <iframe
          title="KOLI Presale Admin"
          src={targetUrl}
          className="h-full w-full border-0"
        />
      </div>
    </section>
  );
};

export default PresaleAdmin;
