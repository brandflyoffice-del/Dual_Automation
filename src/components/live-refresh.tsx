"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Radio } from "lucide-react";

/** Subscribes to /api/events (SSE fed by the n8n webhook) and refreshes server data in real time. */
export function LiveRefresh() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/events");
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (m) => {
      try {
        const e = JSON.parse(m.data) as { title: string; detail?: string; type: string };
        toast(e.title, { description: e.detail, icon: e.type === "meeting_synced" ? "📅" : "⚡" });
        router.refresh();
      } catch {}
    };
    return () => es.close();
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
      <Radio className={`size-3 ${connected ? "text-emerald" : "text-amber-700"}`} />
      {connected ? "Live" : "Connecting…"}
    </span>
  );
}
