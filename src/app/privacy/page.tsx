import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy · BrandFly" };

// Public page (no login): Google's OAuth consent screen links here.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12 text-[15px] leading-relaxed text-foreground">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">BrandFly outreach and scheduling tool · last updated 3 November 2026</p>

      <h2 className="mt-8 text-lg font-semibold">Who we are</h2>
      <p className="mt-2">
        BrandFly is the internal outreach and meeting-scheduling tool of Fenebris India Pvt. Ltd. and its brands TapadiaTech and Expert in SEO. It is used only by our own team. Contact:{" "}
        <a className="text-indigo-700 underline" href="mailto:brandflyoffice@gmail.com">
          brandflyoffice@gmail.com
        </a>
        .
      </p>

      <h2 className="mt-8 text-lg font-semibold">Google data we access and why</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5">
        <li>
          <strong>Google Calendar</strong> of our own company account: we read free/busy times so we only offer open meeting slots, and we create, update or cancel the
          calendar event (with its Google Meet link) for a meeting a prospect booked with us.
        </li>
        <li>
          <strong>Google Sheets</strong> of our own company account: we add or update one row per booked meeting in our internal meeting sheet.
        </li>
      </ul>
      <p className="mt-2">We do not read email, contacts, files or any other Google data, and we do not access anyone else&apos;s Google account.</p>

      <h2 className="mt-8 text-lg font-semibold">How the data is used and stored</h2>
      <p className="mt-2">
        Meeting details (name, company, email address, meeting time and Meet link) are stored in our own database on our own server and are used only to run and follow
        up the meeting. We do not sell or share this data, and we do not use it for advertising. Our use of information received from Google APIs follows the{" "}
        <a className="text-indigo-700 underline" href="https://developers.google.com/terms/api-services-user-data-policy">
          Google API Services User Data Policy
        </a>
        , including the Limited Use requirements.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Your choices</h2>
      <p className="mt-2">
        If you were contacted by us and want your details removed, reply &quot;remove me&quot; to any of our emails or write to the address above, and we will delete them.
        Access to our Google account can be revoked at any time at{" "}
        <a className="text-indigo-700 underline" href="https://myaccount.google.com/permissions">
          myaccount.google.com/permissions
        </a>
        .
      </p>
    </main>
  );
}
