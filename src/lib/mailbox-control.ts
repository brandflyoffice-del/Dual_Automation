// Stop / start one sending mailbox from Email Analytics (e.g. its warm-up reputation dropped).
// "Stop" sets the mailbox's daily limit in Smartlead to 0: it stays in its campaigns but sends nothing (warm-up keeps
// running). The old limit is kept in app_settings "mailbox_pauses", so "Start" puts it back. "Stop for today" also stores
// when to start again (next midnight New York, the campaigns' sending time zone); resumeDuePauses() does that and runs
// every 10 minutes on the server and whenever the board loads.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { setDailyLimit } from "@/lib/smartlead";

const KEY = "mailbox_pauses";
export const DEFAULT_DAILY_LIMIT = 20;
export type Pause = { limit: number; until: string | null; at: string };
type Pauses = Record<string, Pause>;

export async function getPauses(): Promise<Pauses> {
  const row = await db.appSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  const v = (row?.value as { pauses?: Pauses } | undefined)?.pauses;
  return v && typeof v === "object" ? v : {};
}

async function savePauses(pauses: Pauses) {
  const value = { pauses } as unknown as Prisma.InputJsonValue;
  await db.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Next 00:00 in New York, as an ISO time. */
export function nextMidnightNewYork(now = new Date()): string {
  const tz = "America/New_York";
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  const nyAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offset = nyAsUtc - Math.floor(now.getTime() / 1000) * 1000; // New York minus UTC, in ms
  const midnightNyAsUtc = Date.UTC(+p.year, +p.month - 1, +p.day + 1, 0, 0, 0);
  return new Date(midnightNyAsUtc - offset).toISOString();
}

export async function pauseMailbox(id: string, currentLimit: number, until: string | null) {
  const pauses = await getPauses();
  const keep = pauses[id]?.limit ?? (currentLimit > 0 ? currentLimit : DEFAULT_DAILY_LIMIT);
  if (!pauses[id]) await setDailyLimit(id, 0);
  pauses[id] = { limit: keep, until, at: new Date().toISOString() };
  await savePauses(pauses);
}

export async function resumeMailbox(id: string) {
  const pauses = await getPauses();
  await setDailyLimit(id, pauses[id]?.limit || DEFAULT_DAILY_LIMIT);
  delete pauses[id];
  await savePauses(pauses);
}

/** New daily limit. While the mailbox is stopped it is remembered and used when it starts again. */
export async function changeDailyLimit(id: string, limit: number) {
  const pauses = await getPauses();
  if (pauses[id]) {
    pauses[id].limit = limit;
    await savePauses(pauses);
  } else await setDailyLimit(id, limit);
}

export async function resumeDuePauses(): Promise<string[]> {
  const pauses = await getPauses();
  const due = Object.entries(pauses).filter(([, p]) => p.until && Date.parse(p.until) <= Date.now());
  const done: string[] = [];
  for (const [id] of due) {
    try {
      await resumeMailbox(id);
      done.push(id);
    } catch (e) {
      console.error(`[mailbox-control] could not start mailbox ${id} again: ${(e as Error).message}`);
    }
  }
  return done;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startPauseTimer() {
  if (timer) return;
  timer = setInterval(() => {
    resumeDuePauses().then((ids) => ids.length && console.log(`[mailbox-control] started again: ${ids.join(", ")}`)).catch(() => {});
  }, 10 * 60_000);
}
