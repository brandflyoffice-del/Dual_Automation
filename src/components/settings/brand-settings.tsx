"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Brand = { name: string; logo: string | null; custom: boolean };
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function BrandSettings() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState<Brand | null>(null);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (f.size > 500_000) return toast.error("The logo must be under 500 KB");
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result));
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
      toast.success(ok);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const dirty = !!saved && (name.trim() !== saved.name || logo !== saved.logo);
  const preview = logo || "/brand/brandfly.png";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader>
          <CardTitle>Logo and name</CardTitle>
          <CardDescription>The logo is shown in the sidebar and the mobile header; the name is the browser tab title. A wide logo on a transparent background looks best (about 520 × 180 px).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input id="brand-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.03]"
              onClick={() => file.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pick(e.dataTransfer.files[0]);
              }}
            >
              <ImageUp className="size-5" />
              <span>Click or drop a PNG, JPG, WebP or SVG (max 500 KB)</span>
            </div>
            <input ref={file} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => put({ name: name.trim(), logo }, "Brand saved")} disabled={!dirty || busy || name.trim().length < 2}>
              {busy ? <Loader2 className="animate-spin" /> : <Save />}
              Save
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !saved?.custom}
              onClick={() => {
                if (window.confirm("Go back to the BrandFly logo and name?")) put({ reset: true }, "Default logo restored");
              }}
            >
              <RotateCcw />
              Use the default logo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>{dirty ? "Not saved yet" : "What everyone sees now"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-border bg-card p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={name} className="h-auto max-h-16 w-44 object-contain object-left" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-8 w-auto max-w-40 object-contain" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
