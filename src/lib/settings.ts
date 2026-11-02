import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DRAFT_REPLY_TEMPLATE, STARTING_PRICE } from "../../n8n/reply-prompt.mjs";
import {
  DEFAULT_BRAND,
  DEFAULT_MEETING_ALERTS,
  DEFAULT_SERVICE_LINES,
  type BrandSettings,
  type MeetingAlerts,
  type ReplyPromptSettings,
  type ServiceLine,
} from "@/lib/settings-shared";

export const DEFAULT_REPLY_PROMPT: ReplyPromptSettings = { prompt: DRAFT_REPLY_TEMPLATE, startingPrice: STARTING_PRICE };

type Keys = {
  reply_prompt: ReplyPromptSettings;
  brand: BrandSettings;
  service_lines: ServiceLine[];
  meeting_alerts: MeetingAlerts;
};

const DEFAULTS: { [K in keyof Keys]: Keys[K] } = {
  reply_prompt: DEFAULT_REPLY_PROMPT,
  brand: DEFAULT_BRAND,
  service_lines: DEFAULT_SERVICE_LINES,
  meeting_alerts: DEFAULT_MEETING_ALERTS,
};

/** Returns the stored value, or the built-in default when nothing is stored (or the DB is unreachable). */
export async function getSetting<K extends keyof Keys>(key: K): Promise<{ value: Keys[K]; custom: boolean; updatedAt: Date | null }> {
  try {
    const row = await db.appSetting.findUnique({ where: { key } });
    if (row) return { value: row.value as unknown as Keys[K], custom: true, updatedAt: row.updatedAt };
  } catch {
    // fall through to the default
  }
  return { value: DEFAULTS[key], custom: false, updatedAt: null };
}

export async function setSetting<K extends keyof Keys>(key: K, value: Keys[K]) {
  const json = value as unknown as Prisma.InputJsonValue;
  return db.appSetting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}

export async function resetSetting(key: keyof Keys) {
  await db.appSetting.deleteMany({ where: { key } });
}
