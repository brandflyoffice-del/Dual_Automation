import { InboxView } from "@/components/inbox/inbox-view";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
        <p className="hidden text-xs text-muted-foreground sm:block">Every reply from every mailbox and campaign. The AI answers within seconds.</p>
      </div>
      <InboxView />
    </>
  );
}
