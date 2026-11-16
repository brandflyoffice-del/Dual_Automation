"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/** An open tab keeps the code it loaded. After a deploy this asks for a reload, so new buttons and fixes show up. */
export function VersionWatch() {
  const first = useRef<string | null>(null);
  const told = useRef(false);
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await r.json()) as { version: string };
        if (!first.current) first.current = version;
        else if (version !== first.current && !told.current) {
          told.current = true;
          toast.info("The dashboard was updated", {
            description: "Reload to get the latest version.",
            duration: Infinity,
            action: { label: "Reload", onClick: () => window.location.reload() },
          });
        }
      } catch {
        // offline or restarting: try again later
      }
    };
    check();
    const t = setInterval(check, 2 * 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return null;
}
