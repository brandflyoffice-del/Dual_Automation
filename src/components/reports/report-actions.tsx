"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, ExternalLink, FileDown, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function GenerateReportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(weekOffset: 0 | -1) {
    setBusy(weekOffset);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weekOffset }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "failed");
      setUrl(json.shareUrl);
      toast.success("Weekly client report generated", { description: "Shareable link ready — open it and use Save as PDF." });
      router.refresh();
    } catch (e) {
      toast.error("Could not generate report", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => generate(0)} disabled={busy !== null}>
        {busy === 0 ? <Loader2 className="animate-spin" /> : <Sparkles />}
        Generate Weekly Client Report (PDF / Shareable Link)
      </Button>
      <Button variant="secondary" onClick={() => generate(-1)} disabled={busy !== null}>
        {busy === -1 ? <Loader2 className="animate-spin" /> : <FileDown />}
        Last week
      </Button>
      {url && (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald/30 bg-emerald/[0.06] p-1 pl-3 text-xs">
          <Link2 className="size-3.5 text-emerald" />
          <span className="font-metric max-w-[260px] truncate">{url}</span>
          <Button size="xs" variant="ghost" onClick={copy}>
            {copied ? <Check className="text-emerald" /> : <Copy />} {copied ? "Copied" : "Copy"}
          </Button>
          <Button asChild size="xs" variant="ghost">
            <a href={`${url}?print=1`} target="_blank" rel="noreferrer">
              <FileDown /> PDF
            </a>
          </Button>
          <Button asChild size="xs" variant="ghost">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink /> Open
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

export function PrintControls({ auto }: { auto: boolean }) {
  // auto-open the browser print dialog (→ "Save as PDF") when ?print=1
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [auto]);
  return (
    <Button onClick={() => window.print()} className="no-print">
      <FileDown /> Download PDF
    </Button>
  );
}