import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { CalendarCheck2, MessagesSquare, Radar } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { authConfigured, authRequired, SESSION_COOKIE, verifySession } from "@/lib/auth";
import { getSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getSetting("brand");
  return { title: `Sign in · ${brand.value.name}` };
}

const safeNext = (n: string | undefined) => (n && n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/dashboard");

const POINTS = [
  { icon: Radar, title: "Find the right people", text: "Describe who you want; AI fills the search and writes a personal first email." },
  { icon: MessagesSquare, title: "AI answers every reply", text: "In the same email thread, from your own prompt and prices." },
  { icon: CalendarCheck2, title: "Meetings book themselves", text: "One click on a time: Google Meet, calendar invite and the sheet are done." },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (!authRequired()) redirect(target);
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (session) redirect(target);

  const brand = await getSetting("brand");
  const logo = `/api/brand/logo?v=${brand.updatedAt ? brand.updatedAt.getTime() : "default"}`;
  const name = brand.value.name;

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-card lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 50% at 15% 10%, rgba(5,150,105,0.14), transparent 70%), radial-gradient(55% 45% at 90% 85%, rgba(79,70,229,0.14), transparent 70%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "linear-gradient(rgba(15,23,42,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.05) 1px, transparent 1px)", backgroundSize: "36px 36px", maskImage: "linear-gradient(180deg, black, transparent 85%)" }}
        />
        <div className="relative flex flex-1 flex-col justify-between p-12 xl:p-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="h-14 w-auto max-w-[220px] object-contain object-left mix-blend-multiply" />
          <div className="max-w-md">
            <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-foreground">Outreach that turns replies into booked meetings.</h1>
            <ul className="mt-9 space-y-5">
              {POINTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3.5">
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-card">
                    <Icon className="size-[18px] text-emerald" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {name}</p>
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-8">
        <div className="w-full max-w-[400px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={name} className="mx-auto mb-8 h-12 w-auto max-w-[200px] object-contain lg:hidden" />
          <div className="shadow-card rounded-2xl border border-border bg-card p-7 sm:p-8">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Welcome back. Sign in to your {name} workspace.</p>
            <LoginForm next={target} configured={authConfigured()} />
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Protected workspace ·{" "}
            <a href="/privacy" className="underline-offset-2 hover:underline">
              Privacy
            </a>{" "}
            ·{" "}
            <a href="/terms" className="underline-offset-2 hover:underline">
              Terms
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
