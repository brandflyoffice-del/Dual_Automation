"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, CalendarCheck2, CheckCircle2, ImageUp, Layers, Loader2, Radar, RefreshCw, RotateCcw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Brand = { name: string; logo: string | null; custom: boolean; updatedAt?: string | null };
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
const MAX_BYTES = 500_000;
const DEFAULT_LOGO = "/brand/brandfly.png";

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
/** Approximate decoded size of a base64 data URL. */
const dataUrlBytes = (u: string) => Math.floor(((u.split(",")[1] || "").length * 3) / 4);

export function BrandSettings() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; w?: number; h?: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/brand")
      .then((r) => r.json())
      .then((b: Brand) => {
        setSaved(b);
        setName(b.name);
        setLogo(b.logo);
      })
      .catch(() => toast.error("Could not load the brand settings"));
  }, []);

  function pick(f: File | undefined) {
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast.error("Use a PNG, JPG, WebP or SVG file");
    if (f.size > MAX_BYTES) return toast.error(`The logo is ${kb(f.size)}. Keep it under 500 KB.`);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setLogo(url);
      setFileInfo({ name: f.name, size: f.size });
      const img = new Image();
      img.onload = () => setFileInfo({ name: f.name, size: f.size, w: img.naturalWidth, h: img.naturalHeight });
      img.src = url;
    };
    reader.readAsDataURL(f);
  }

  async function put(payload: object, ok: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/brand", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) return toast.error(json.error || "Could not save");
      setSaved(json);
      setName(json.name);
      setLogo(json.logo);
      setFileInfo(null);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 4000);
      toast.success(ok);
      router.refresh();
    } catch (e) {
      toast.error("Network error", { description: (e as Error).message });
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  if (!saved) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading brand settings…
      </div>
    );
  }

  const trimmed = name.trim();
  const nameOk = trimmed.length >= 2 && trimmed.length <= 40;
  const dirty = trimmed !== saved.name || logo !== saved.logo;
  const preview = logo || DEFAULT_LOGO;
  const savedAt = saved.updatedAt ? new Date(saved.updatedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : null;
  const wide = fileInfo?.w && fileInfo?.h ? fileInfo.w / fileInfo.h : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Logo and name</CardTitle>
            {saved.custom ? <Badge variant="indigo">Customised</Badge> : <Badge variant="emerald">Default BrandFly</Badge>}
          </div>
          <CardDescription>
            The logo appears in the sidebar and the mobile header. The name is the browser tab title.{savedAt && ` Last saved ${savedAt}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor="brand-name">Brand name</Label>
              <span className="font-metric text-[11px] text-muted-foreground">{trimmed.length}/40</span>
            </div>
            <Input id="brand-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} aria-invalid={!nameOk} className={cn(!nameOk && "border-rose-500")} />
            {!nameOk && <p className="text-[11px] text-rose-600">Use 2 to 40 characters.</p>}
          </div>

          <div className="space-y-2">
            <Label>Logo</Label>
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload a logo"
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                drag ? "border-emerald bg-emerald/[0.06]" : "border-border hover:border-foreground/25 hover:bg-foreground/[0.02]",
              )}
              onClick={() => file.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  file.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                pick(e.dataTransfer.files[0]);
              }}
            >
              <div className="flex h-20 w-full max-w-xs items-center justify-center rounded-lg border border-border bg-card px-4 shadow-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Current logo" className="max-h-14 w-auto max-w-full object-contain" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center justify-center gap-1.5 text-sm font-medium">
                  <ImageUp className="size-4 text-emerald" />
                  {drag ? "Drop to use this logo" : logo ? "Click or drop to replace" : "Click or drop a logo here"}
                </div>
                <div className="text-[12px] text-muted-foreground">PNG, JPG, WebP or SVG · up to 500 KB · wide logo on a transparent background, about 520 × 180 px</div>
              </div>
            </div>
            <input ref={file} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />

            {(fileInfo || logo) && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-[12px]">
                <span className="min-w-0 truncate text-muted-foreground">
                  {fileInfo ? (
                    <>
                      <span className="font-medium text-foreground">{fileInfo.name}</span> · {kb(fileInfo.size)}
                      {fileInfo.w && ` · ${fileInfo.w} × ${fileInfo.h} px`}
                    </>
                  ) : (
                    <>Uploaded logo · {kb(dataUrlBytes(logo!))}</>
                  )}
                </span>
                <div className="flex gap-1">
                  <Button size="xs" variant="ghost" onClick={() => file.current?.click()}>
                    <RefreshCw /> Replace
                  </Button>
                  <Button size="xs" variant="ghost" 
                    onClick={() => {
                      setLogo(null);
                      setFileInfo(null);
                    }}
                  >
                    <Trash2 /> Remove
                  </Button>
                </div>
              </div>
            )}
            {wide !== null && wide < 1.4 && (
              <p className="text-[11px] text-amber-700">This logo is almost square. It will look small in the sidebar; a wider version reads better.</p>
            )}
            {!logo && saved.logo && <p className="text-[11px] text-muted-foreground">Removed. Save to go back to the BrandFly logo.</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button onClick={() => put({ name: trimmed, logo }, "Brand saved. The sidebar shows it now.")} disabled={!dirty || busy || !nameOk}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              Save changes
            </Button>
            <Button
              variant="secondary"
              disabled={!dirty || busy}
              onClick={() => {
                setName(saved.name);
                setLogo(saved.logo);
                setFileInfo(null);
              }}
            >
              <X /> Discard
            </Button>
            <Button
              variant="ghost"
              className="sm:ml-auto"
              disabled={busy || !saved.custom}
              onClick={() => {
                if (window.confirm("Go back to the BrandFly logo and name?")) put({ reset: true }, "Default logo and name restored");
              }}
            >
              <RotateCcw /> Restore default
            </Button>
            {justSaved && !dirty && (
              <span className="flex items-center gap-1 text-[12px] text-emerald">
                <CheckCircle2 className="size-3.5" /> Saved
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">Live preview</CardTitle>
            {dirty ? <Badge variant="amber">Not saved yet</Badge> : <Badge variant="outline">What everyone sees</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Browser tab</div>
            <div className="rounded-lg border border-border bg-muted p-1.5 pb-0">
              <div className="flex w-56 max-w-full items-center gap-2 rounded-t-md border border-b-0 border-border bg-card px-2.5 py-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.png" alt="" className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-[12px]">{trimmed || "—"}</span>
                <X className="size-3 shrink-0 text-muted-foreground" />
              </div>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">The small tab icon stays the same.</p>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sidebar</div>
            <div className="w-full max-w-[240px] rounded-lg border border-border bg-card p-3 shadow-card">
              <div className="px-1 pb-4 pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={trimmed} className="h-auto max-h-16 w-44 object-contain object-left" />
              </div>
              {[
                { label: "Command Center", icon: BarChart3, on: true },
                { label: "Meetings", icon: CalendarCheck2 },
                { label: "Lead Intelligence", icon: Radar },
                { label: "Services", icon: Layers },
              ].map(({ label, icon: Icon, on }) => (
                <div key={label} className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12px]", on ? "bg-emerald/10 font-medium text-emerald" : "text-muted-foreground")}>
                  <Icon className="size-3.5" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Phone header</div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="h-8 w-auto max-w-40 object-contain" />
              <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground">Launch</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
