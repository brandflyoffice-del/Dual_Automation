import { InboxView } from "@/components/inbox/inbox-view";
import { ExportMenu } from "@/components/export-menu";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
        <div className="flex items-center gap-3">
          <p className="hidden text-xs text-muted-foreground md:block">Every reply from every mailbox and campaign. The AI answers within seconds.</p>
          <ExportMenu dataset="emails" />
        </div>
      </div>
      <InboxView />
    </>
  );
}
