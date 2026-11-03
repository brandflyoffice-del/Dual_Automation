import { NextResponse } from "next/server";
import { buildExport, DATASETS, type Dataset } from "@/lib/export-data";
import { CONTENT_TYPE, toCsv, toMarkdown, toPdf, type ExportFormat } from "@/lib/export";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/export?dataset=leads|emails|meetings&scope=...&format=csv|md|pdf  -> file download (login required, see middleware).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") as Dataset | null;
  const format = (url.searchParams.get("format") ?? "csv") as ExportFormat;
  if (!dataset || !(dataset in DATASETS)) return NextResponse.json({ error: "dataset must be leads, emails or meetings" }, { status: 400 });
  if (!["csv", "md", "pdf"].includes(format)) return NextResponse.json({ error: "format must be csv, md or pdf" }, { status: 400 });
  const scopes = DATASETS[dataset].scopes as readonly string[];
  const scope = scopes.includes(url.searchParams.get("scope") ?? "") ? url.searchParams.get("scope")! : scopes[0];

  const table = await buildExport(dataset, scope);
  const body = format === "csv" ? toCsv(table) : format === "md" ? toMarkdown(table) : await toPdf(table);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `brandfly-${dataset}-${scope.replace(/_/g, "-")}-${stamp}.${format}`;
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "content-type": CONTENT_TYPE[format],
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
