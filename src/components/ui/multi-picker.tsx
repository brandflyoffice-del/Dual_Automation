"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickerOption = { key: string; label: string; detail?: string; group?: string };
export type PickerChip = { key: string; label: string; muted?: boolean };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Chips + type-to-search dropdown. Picks an option with click or Enter; optional "Add …" row for free text.
 * Backspace on an empty box removes the last chip.
 */
export function MultiPicker({
  chips,
  options,
  onPick,
  onRemove,
  onCustom,
  customHint = "Add",
  placeholder = "Type to search…",
  emptyText = "Nothing matches.",
  className,
}: {
  chips: PickerChip[];
  options: PickerOption[];
  onPick: (option: PickerOption) => void;
  onRemove: (key: string) => void;
  onCustom?: (text: string) => void;
  customHint?: string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const taken = React.useMemo(() => new Set(chips.map((c) => c.key)), [chips]);
  const q = norm(query.trim());
  const shown = React.useMemo(() => {
    const free = options.filter((o) => !taken.has(o.key));
    if (!q) return free.slice(0, 80);
    const starts = free.filter((o) => norm(o.label).startsWith(q));
    const rest = free.filter((o) => !norm(o.label).startsWith(q) && norm(`${o.label} ${o.detail ?? ""}`).includes(q));
    return [...starts, ...rest].slice(0, 80);
  }, [options, taken, q]);
  const exact = shown.some((o) => norm(o.label) === q);
  const custom = onCustom && q.length >= 2 && !exact ? query.trim() : null;
  const rows = custom ? shown.length + 1 : shown.length;

  React.useEffect(() => setActive(0), [q]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(i: number) {
    if (i < shown.length) onPick(shown[i]);
    else if (custom) onCustom?.(custom);
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          data-picker-anchor=""
          className={cn(
            "flex min-h-10 w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-card px-2 py-1.5 shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
            className,
          )}
          onClick={() => {
            inputRef.current?.focus();
            setOpen(true);
          }}
        >
          {chips.map((c) => (
            <span
              key={c.key}
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-md border py-0.5 pl-2 pr-1 text-xs font-medium",
                c.muted ? "border-border bg-muted text-foreground" : "border-emerald/30 bg-emerald/10 text-emerald-800",
              )}
            >
              <span className="truncate">{c.label}</span>
              <button
                type="button"
                aria-label={`Remove ${c.label}`}
                className="rounded p-0.5 text-current/70 hover:bg-foreground/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(c.key);
                }}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <div className="flex min-w-[9rem] flex-1 items-center gap-1.5">
            {!chips.length && <Search className="size-3.5 shrink-0 text-muted-foreground" />}
            <input
              ref={inputRef}
              value={query}
              placeholder={chips.length ? "Add more…" : placeholder}
              className="h-7 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onFocus={() => setOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((a) => Math.min(rows - 1, a + 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(0, a - 1));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (rows) choose(Math.min(active, rows - 1));
                } else if (e.key === "Backspace" && !query && chips.length) {
                  onRemove(chips[chips.length - 1].key);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
            />
          </div>
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement)?.closest?.("[data-picker-anchor]")) e.preventDefault();
          }}
          className="z-[100] w-[var(--radix-popover-trigger-width)] min-w-[16rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div ref={listRef} className="max-h-72 overflow-y-auto p-1">
            {shown.map((o, i) => {
              const head = o.group && o.group !== shown[i - 1]?.group;
              return (
                <React.Fragment key={o.key}>
                  {head && <div className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{o.group}</div>}
                  <button
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i)}
                    className={cn("flex w-full items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm", active === i && "bg-accent")}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.detail && <span className="shrink-0 text-[11px] text-muted-foreground">{o.detail}</span>}
                  </button>
                </React.Fragment>
              );
            })}
            {custom && (
              <button
                type="button"
                data-idx={shown.length}
                onMouseEnter={() => setActive(shown.length)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(shown.length)}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-indigo-700", active === shown.length && "bg-accent")}
              >
                <Plus className="size-3.5" /> {customHint} “{custom}”
              </button>
            )}
            {!rows && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{emptyText}</p>}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
