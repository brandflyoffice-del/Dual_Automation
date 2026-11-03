// Server-only: turns one table (leads, email activity, meetings) into CSV, Markdown or PDF for download.
import PDFDocument from "pdfkit";

export type ExportColumn = { key: string; label: string };
export type ExportTable = { title: string; subtitle: string; columns: ExportColumn[]; rows: Record<string, string>[] };
export type ExportFormat = "csv" | "md" | "pdf";

const cell = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** RFC 4180 CSV with a BOM, so Excel opens UTF-8 names (é, ü, ₹) correctly. */
export function toCsv(t: ExportTable): Buffer {
  const q = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [t.columns.map((c) => q(c.label)).join(","), ...t.rows.map((r) => t.columns.map((c) => q(cell(r[c.key]))).join(","))];
  return Buffer.from("﻿" + lines.join("\r\n") + "\r\n", "utf8");
}

export function toMarkdown(t: ExportTable): Buffer {
  const esc = (v: string) => v.replace(/\|/g, "\\|").replace(/\r?\n+/g, "<br>");
  const out = [
    `# ${t.title}`,
    "",
    t.subtitle,
    "",
    `| ${t.columns.map((c) => c.label).join(" | ")} |`,
    `| ${t.columns.map(() => "---").join(" | ")} |`,
    ...t.rows.map((r) => `| ${t.columns.map((c) => esc(cell(r[c.key]))).join(" | ")} |`),
    "",
  ];
  if (!t.rows.length) out.push("_No rows._", "");
  return Buffer.from(out.join("\n"), "utf8");
}

/**
 * A4 landscape. Few columns: a grid. Many columns (leads): one block per row with the first column as its heading,
 * so long fields such as the pain point wrap instead of being cut. PDF's built-in Helvetica only covers Latin-1, so
 * other characters are replaced rather than printed as boxes.
 */
export function toPdf(t: ExportTable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 36, bufferPages: true, info: { Title: t.title } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const latin = (v: string) => v.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
    const W = doc.page.width - 72;
    const bottom = () => doc.page.height - 50;

    doc.font("Helvetica-Bold").fontSize(16).fillColor("#0f172a").text(latin(t.title));
    doc.moveDown(0.2).font("Helvetica").fontSize(9).fillColor("#64748b").text(latin(t.subtitle));
    doc.moveDown(0.8);
    if (!t.rows.length) doc.font("Helvetica").fontSize(10).fillColor("#334155").text("No rows.");

    const grid = t.columns.length <= 7;
    if (grid && t.rows.length) {
      const colW = W / t.columns.length;
      const header = () => {
        const y = doc.y;
        doc.rect(36, y - 2, W, 16).fill("#f1f5f9");
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#334155");
        t.columns.forEach((c, i) => doc.text(latin(c.label), 36 + i * colW + 3, y + 2, { width: colW - 6, lineBreak: false, ellipsis: true }));
        doc.y = y + 18;
      };
      header();
      for (const r of t.rows) {
        doc.font("Helvetica").fontSize(8);
        const heights = t.columns.map((c) => doc.heightOfString(latin(cell(r[c.key])).slice(0, 600), { width: colW - 6 }));
        const h = Math.min(160, Math.max(12, ...heights)) + 6;
        if (doc.y + h > bottom()) {
          doc.addPage();
          header();
        }
        const y = doc.y;
        doc.fillColor("#0f172a");
        t.columns.forEach((c, i) => doc.text(latin(cell(r[c.key])).slice(0, 600), 36 + i * colW + 3, y + 2, { width: colW - 6, height: h - 4, ellipsis: true }));
        doc.moveTo(36, y + h).lineTo(36 + W, y + h).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
        doc.y = y + h + 2;
      }
    } else {
      const [head, ...rest] = t.columns;
      for (const r of t.rows) {
        if (doc.y > bottom() - 60) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#0f172a").text(latin(cell(r[head.key])), 36, doc.y, { width: W });
        doc.moveDown(0.15);
        for (const c of rest) {
          const v = cell(r[c.key]);
          if (!v) continue;
          if (doc.y > bottom()) doc.addPage();
          doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text(latin(c.label) + ": ", 44, doc.y, { continued: true, width: W - 8 });
          doc.font("Helvetica").fillColor("#1f2937").text(latin(v).slice(0, 1200));
        }
        doc.moveDown(0.3);
        doc.moveTo(36, doc.y).lineTo(36 + W, doc.y).strokeColor("#e2e8f0").lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }
    }

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      // The footer sits inside the bottom margin; without lifting the margin pdfkit would start a new, empty page.
      const margin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7.5).fillColor("#94a3b8").text(`${latin(t.title)}  ·  page ${i + 1} of ${range.count}`, 36, doc.page.height - 30, { width: W, align: "right", lineBreak: false });
      doc.page.margins.bottom = margin;
    }
    doc.end();
  });
}

export const CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  pdf: "application/pdf",
};
