"use client";

import { useState } from "react";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function LoginForm({ next, configured }: { next: string; configured: boolean }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(configured ? "" : "Login is not configured on this server yet.");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ user, password, remember }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || "Could not sign in.");
        setBusy(false);
        return;
      }
      window.location.assign(next);
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="user">Username</Label>
        <Input id="user" autoComplete="username" autoFocus value={user} onChange={(e) => setUser(e.target.value)} className="h-10" placeholder="Your username" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 pr-10"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>
      <label className="flex cursor-pointer select-none items-center gap-2 text-[13px] text-muted-foreground">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-emerald-600" />
        Keep me signed in for 30 days
      </label>
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[13px] text-rose-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 w-full" disabled={busy || !configured || !user.trim() || !password}>
        {busy ? <Loader2 className="animate-spin" /> : <LogIn />}
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
