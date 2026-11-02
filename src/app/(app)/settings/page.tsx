import Link from "next/link";
import { Bot, CalendarCheck2, Palette } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PromptEditor } from "@/components/settings/prompt-editor";
import { BrandSettings } from "@/components/settings/brand-settings";
import { MeetingAlerts } from "@/components/settings/meeting-alerts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "prompt", label: "AI reply prompt", detail: "How the AI answers replies", icon: Bot },
  { id: "brand", label: "Brand & logo", detail: "Logo and dashboard name", icon: Palette },
  { id: "meetings", label: "Meeting alerts", detail: "Who gets invited to meetings", icon: CalendarCheck2 },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.id === raw)?.id ?? "prompt";
  return (
    <>
      <PageHeader title="Settings" description="Change how the AI answers, the logo, and who hears about booked meetings. Saved changes apply straight away, no deploy needed." />
      <nav aria-label="Settings sections" className="mb-6 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 shadow-card sm:gap-1.5 sm:p-1.5">
        {TABS.map(({ id, label, detail, icon: Icon }) => {
          const on = tab === id;
          return (
            <Link
              key={id}
              href={`/settings?tab=${id}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "group flex min-w-0 items-center gap-2.5 rounded-lg px-2 py-2 transition-colors sm:px-3 sm:py-2.5",
                on ? "bg-emerald/[0.08] ring-1 ring-emerald/25" : "hover:bg-foreground/[0.04]",
              )}
            >
              <span
                className={cn(
                  "hidden size-8 shrink-0 items-center justify-center rounded-md border sm:flex",
                  on ? "border-emerald/30 bg-card text-emerald" : "border-border bg-muted text-muted-foreground group-hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate text-[13px] font-medium", on ? "text-emerald" : "text-foreground")}>{label}</span>
                <span className="hidden truncate text-[11px] text-muted-foreground md:block">{detail}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      {tab === "prompt" && <PromptEditor />}
      {tab === "brand" && <BrandSettings />}
      {tab === "meetings" && <MeetingAlerts />}
    </>
  );
}
