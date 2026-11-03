import { PageHeader } from "@/components/page-header";
import { InboxView } from "@/components/inbox/inbox-view";

export const dynamic = "force-dynamic";

export default function InboxPage() {
  return (
    <>
      <PageHeader
        title="Inbox"
        description="Every conversation from every Smartlead campaign and mailbox in one place. Read the full thread, see what the AI answered, and reply yourself when you want to."
      />
      <InboxView />
    </>
  );
}
