import { MobileNav, Sidebar } from "@/components/sidebar";
import { getSetting } from "@/lib/settings";
import { LaunchProgress } from "@/components/launch-progress";

// Every page reads the logo/name from the DB, so none may be prerendered at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const brand = await getSetting("brand");
  return { title: brand.value.name };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const brand = await getSetting("brand");
  const props = { brandName: brand.value.name, logoVersion: brand.updatedAt ? String(brand.updatedAt.getTime()) : "default" };
  return (
    <div className="flex min-h-screen">
      <Sidebar {...props} />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <MobileNav {...props} />
        <main className="mx-auto w-full min-w-0 max-w-[1500px] overflow-x-hidden px-3 py-4 pb-24 sm:px-4 md:px-8 md:py-8 lg:pb-8">{children}</main>
      </div>
      <LaunchProgress />
    </div>
  );
}
