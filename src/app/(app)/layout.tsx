import { MobileNav, Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-x-hidden">
        <MobileNav />
        <main className="mx-auto w-full min-w-0 max-w-[1500px] overflow-x-hidden px-3 py-4 pb-24 sm:px-4 md:px-8 md:py-8 lg:pb-8">{children}</main>
      </div>
    </div>
  );
}
