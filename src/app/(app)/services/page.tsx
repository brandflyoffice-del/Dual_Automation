"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

type Offering = { name: string; signals: string };

export default function ServicesPage() {
  const [rows, setRows] = useState<Offering[]>([]);
  const [name, setName] = useState("");
  const [signals, setSignals] = useState("");

  useEffect(() => {
    fetch("/api/offerings")
      .then((r) => r.json())
      .then(setRows)
      .catch(() => toast.error("Could not load services"));
  }, []);

  async function add() {
    const res = await fetch("/api/offerings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, signals }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || "Could not add");
      return;
    }
    setRows(json);
    setName("");
    setSignals("");
    toast.success("Service added. It is available on the next launch.");
  }

  return (
    <>
      <PageHeader
        title="Services you sell"
        description="Add any IT or digital service. The lead engine matches a prospect to this list. Nothing here is hardcoded to one industry."
      />
      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
          <Input value={name} placeholder="Service name, e.g. RFID" onChange={(e) => setName(e.target.value)} />
          <Input value={signals} placeholder="What signal suggests they need it" onChange={(e) => setSignals(e.target.value)} />
          <Button onClick={add} disabled={name.trim().length < 2}>
            Add service
          </Button>
        </CardContent>
      </Card>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((o) => (
          <li key={o.name} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-sm font-medium">{o.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{o.signals || "No signal note yet"}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
