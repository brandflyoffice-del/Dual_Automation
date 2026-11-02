import { PageHeader } from "@/components/page-header";
import { ServiceLines } from "@/components/services/service-lines";

export const dynamic = "force-dynamic";

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        title="Services you sell"
        description="Each service has its own email campaign and a list of sub-services. Add, rename or remove them here; Launch picks up the changes straight away."
      />
      <ServiceLines />
    </>
  );
}
