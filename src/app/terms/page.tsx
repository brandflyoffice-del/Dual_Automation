import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service · BrandFly" };

// Public page (no login): Google's OAuth consent screen links here.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-1 text-sm text-muted-foreground">BrandFly outreach and scheduling tool · last updated 3 November 2026</p>
      <p className="mt-6">
        BrandFly is an internal tool of Fenebris India Pvt. Ltd. (TapadiaTech, Expert in SEO). It is operated only by our own team to send business emails, answer
        replies and schedule free 30-minute consultations on Google Meet. It is not offered to the public.
      </p>
      <p className="mt-4">
        Booking a consultation through one of our links is free and creates no obligation. Times shown are subject to availability; we confirm every booking by email and
        you can reschedule or cancel through the link in that email.
      </p>
      <p className="mt-4">
        How we handle personal data is described in our{" "}
        <a className="text-indigo-700 underline" href="/privacy">
          Privacy Policy
        </a>
        . Questions:{" "}
        <a className="text-indigo-700 underline" href="mailto:brandflyoffice@gmail.com">
          brandflyoffice@gmail.com
        </a>
        .
      </p>
    </main>
  );
}
