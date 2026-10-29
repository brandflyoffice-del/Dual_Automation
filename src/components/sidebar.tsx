"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { BarChart3, CalendarCheck2, FileBarChart2, Mail, Radar, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { SystemStatus } from "@/components/system-status";
import { LaunchCampaign } from "@/components/launch-campaign";

const NAV = [
  { href: "/dashboard", label: "Command Center", short: "Home", icon: BarChart3 },
  { href: "/meetings", label: "Meetings", short: "Meetings", icon: CalendarCheck2 },
  { href: "/leads", label: "Lead Intelligence", short: "Leads", icon: Radar },
  { href: "/services", label: "Services", short: "Services", icon: Layers },
  { href: "/campaigns", label: "Sequence Monitor", short: "Campaigns", icon: Mail },
  { href: "/reports", label: "Weekly Reports", short: "Reports", icon: FileBarChart2 },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card p-3 lg:flex">
      <div className="px-2 pb-5 pt-2">
        <Image src="/brand/brandfly.png" alt="BrandFly" width={520} height={180} className="h-auto w-44" priority />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                active
                  ? "bg-emerald/10 font-medium text-emerald"
                  : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
              )}
            >
              <Icon className={cn("size-4", active && "text-emerald")} />
              {label}
            </Link>
          );
        })}
      </nav>
      <SystemStatus />
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-card/95 px-3 py-2 backdrop-blur lg:hidden">
        <Image src="/brand/brandfly.png" alt="BrandFly" width={520} height={180} className="h-8 w-auto" priority />
        <LaunchCampaign compact />
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-1 py-2 text-[10px]",
                active ? "font-medium text-emerald" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              {short}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
