// One-off codemod: dark-only Tailwind classes -> theme-token / light-safe classes. Safe to delete after use.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MAP = [
  [/hover:bg-white\/\[0\.03\]/g, "hover:bg-foreground/[0.04]"],
  [/hover:bg-white\/\[0\.04\]/g, "hover:bg-foreground/[0.05]"],
  [/bg-white\/\[0\.02\]/g, "bg-foreground/[0.03]"],
  [/bg-white\/\[0\.05\]/g, "bg-foreground/[0.06]"],
  [/bg-white\/\[0\.06\]/g, "bg-foreground/[0.06]"],
  [/bg-white\/\[0\.08\]/g, "bg-foreground/[0.08]"],
  [/bg-white\/10/g, "bg-foreground/10"],
  [/text-indigo-300/g, "text-indigo-700"],
  [/text-amber-400/g, "text-amber-700"],
  [/text-rose-400/g, "text-rose-600"],
  [/text-sky-400/g, "text-sky-700"],
  [/bg-\[#0b0b0e\]/g, "bg-card"],
  [/bg-black\/60 backdrop-blur-\[2px\]/g, "bg-slate-900/40 backdrop-blur-[2px]"],
];

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(f)) out.push(p);
  }
  return out;
}

let changed = 0;
for (const file of walk("src")) {
  let s = readFileSync(file, "utf8");
  const before = s;
  for (const [re, to] of MAP) s = s.replace(re, to);
  if (s !== before) {
    writeFileSync(file, s);
    changed++;
    console.log("updated", file);
  }
}
console.log(`${changed} files updated`);
