"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { countdown } from "@/lib/utils";

export function useNow(intervalMs = 20000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function CountdownBadge({ start, status }: { start: string; status: string }) {
  const now = useNow();
  if (now === null) return <Badge variant="outline">…</Badge>;
  if (status === "CANCELLED") return <Badge variant="rose">Cancelled</Badge>;
  const c = countdown(start, now);
  const variant = c.state === "live" ? "emerald" : c.state === "soon" ? "amber" : c.state === "today" ? "indigo" : c.state === "past" ? "outline" : "default";
  return (
    <Badge variant={variant} className={`font-metric ${c.state === "live" ? "animate-pulse" : ""}`}>
      <Clock />
      {c.text}
    </Badge>
  );
}
