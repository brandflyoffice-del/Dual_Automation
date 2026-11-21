import { PageHeader } from "@/components/page-header";
import { TemplateEditor } from "@/components/templates/template-editor";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Email templates"
        description="The emails each Smartlead campaign sends. Change the wording, the subject, the colours or the signature, check the preview, then save. Every save keeps the previous version so you can undo it."
      />
      <TemplateEditor />
    </>
  );
}
