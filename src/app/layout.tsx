import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { getSetting } from "@/lib/settings";
import { brandAccent } from "@/lib/settings-shared";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "BrandFly",
  description: "Email-only outreach, AI follow-ups and meeting booking — BrandFly.",
};

// The brand colour (Settings > Brand & logo, taken from the logo) drives every button, link and highlight, so a
// white-labelled dashboard matches its own logo. Read on each request; the default is BrandFly blue.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const brand = await getSetting("brand");
  const accent = brandAccent(brand.value.color);
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <style>{`:root{--primary:${accent};--emerald:${accent};--ring:${accent};--primary-foreground:#ffffff}`}</style>
      </head>
      <body className="min-h-screen font-sans">
        {children}
        <Toaster
          theme="light"
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#ffffff",
              border: "1px solid rgba(15,23,42,0.1)",
              color: "#0f172a",
              boxShadow: "0 10px 30px -10px rgba(15,23,42,0.2)",
            },
          }}
        />
      </body>
    </html>
  );
}
