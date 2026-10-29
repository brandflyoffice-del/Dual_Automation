import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const dynamic = "force-dynamic";

const file = path.join(process.cwd(), "data", "offerings.json");

const item = z.object({
  name: z.string().trim().min(2).max(80),
  signals: z.string().trim().max(240).default(""),
});

export async function GET() {
  const raw = await readFile(file, "utf8");
  return NextResponse.json(JSON.parse(raw) as { name: string; signals: string }[]);
}

export async function POST(req: Request) {
  const parsed = item.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  const list = JSON.parse(await readFile(file, "utf8")) as { name: string; signals: string }[];
  if (list.some((o) => o.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return NextResponse.json({ error: "That service is already on the list" }, { status: 409 });
  }
  list.push(parsed.data);
  await writeFile(file, JSON.stringify(list, null, 2) + "\n");
  return NextResponse.json(list);
}
