import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { IST_TZ } from "./constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "+14155550123" -> "+1 (415) 555-0123"; other countries "+44 7700 900123". */
export function formatPhone(e164: string) {
  const d = e164.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  const cc = PHONE_CODES.find((c) => d.startsWith(c)) ?? d.slice(0, 2);
  const rest = d.slice(cc.length);
  return rest.length > 6 ? `+${cc} ${rest.slice(0, 4)} ${rest.slice(4)}` : `+${d}`;
}
const PHONE_CODES = ["358", "353", "351", "352", "420", "971", "972", "966", "974", "44", "49", "33", "34", "39", "31", "32", "41", "43", "46", "47", "45", "48", "61", "64", "91", "65", "27", "30"];

export function formatUsd(n: number, compact = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? "compact" : "standard",
  }).format(n);
}

export function formatPct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function formatDateTime(d: Date | string, tz: string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...opts,
  }).format(new Date(d));
}

export function formatIst(d: Date | string) {
  return `${formatDateTime(d, IST_TZ)} IST`;
}

export function formatRevenueBand(rev: number | null | undefined) {
  if (!rev) return "Revenue unknown";
  if (rev < 500_000) return "$100k–$500k";
  if (rev < 1_000_000) return "$500k–$1M";
  if (rev < 3_000_000) return "$1M–$3M";
  if (rev < 6_000_000) return "$3M–$6M";
  return "$6M–$10M";
}

export function countdown(target: Date | string, now = Date.now()) {
  const ms = new Date(target).getTime() - now;
  const abs = Math.abs(ms);
  const mins = Math.round(abs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  let text: string;
  if (mins < 1) text = "now";
  else if (mins < 60) text = `${mins} min${mins === 1 ? "" : "s"}`;
  else if (hrs < 24) text = `${hrs}h ${mins % 60}m`;
  else text = `${days}d ${hrs % 24}h`;
  const state: "past" | "live" | "soon" | "today" | "later" =
    ms < -45 * 60000 ? "past" : ms <= 0 ? "live" : ms < 60 * 60000 ? "soon" : hrs < 24 ? "today" : "later";
  return { ms, text: ms < 0 ? (state === "live" ? "Live now" : `${text} ago`) : `In ${text}`, state };
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday start
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function endOfWeek(d = new Date()) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(e.getDate() + 7);
  e.setMilliseconds(-1);
  return e;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function safePct(num: number, den: number) {
  return den > 0 ? (num / den) * 100 : 0;
}
