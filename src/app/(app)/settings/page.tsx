import Link from "next/link";
import { Bot, CalendarCheck2, Palette } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PromptEditor } from "@/components/settings/prompt-editor";
import { BrandSettings } from "@/components/settings/brand-settings";
import { MeetingAlerts } from "@/components/settings/meeting-alerts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "prompt", label: "AI reply prompt", icon: Bot },
  { id: "brand", label: "Brand & logo", icon: Palette },
  { id: "meetings", label: "Meeting alerts", icon: CalendarCheck2 },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = TABS.find((t) => t.id === raw)?.id ?? "prompt";
  return (
    <>
      <PageHeader title="Settings" description="Change how the AI answers, the logo, and who hears about booked meetings. Saved changes apply straight away." />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/settings?tab=${id}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === id ? "bg-emerald/10 font-medium text-emerald" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </div>
      {tab === "prompt" && <PromptEditor />}
      {tab === "brand" && <BrandSettings />}
      {tab === "meetings" && <MeetingAlerts />}
    </>
  );
}
