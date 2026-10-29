import { EventEmitter } from "node:events";

// In-process pub/sub used to push n8n webhook events to open dashboards via SSE.
// (Single-instance. For multi-instance deployments swap for Supabase Realtime / Redis pub-sub.)
const g = globalThis as unknown as { __fenebrisBus?: EventEmitter };
export const bus = g.__fenebrisBus ?? new EventEmitter();
bus.setMaxListeners(200);
g.__fenebrisBus = bus;

export type LiveEvent = {
  type: string;
  title: string;
  detail?: string;
  at: string;
};

export function publish(e: Omit<LiveEvent, "at">) {
  bus.emit("event", { ...e, at: new Date().toISOString() } satisfies LiveEvent);
}
