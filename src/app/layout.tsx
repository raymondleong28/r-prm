import type { Metadata } from "next";
import "./globals.css";
import { PrmProvider } from "@/context/PrmContext";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "R-PRM | Partner Relationship Management Cloud",
  description: "Self-hosted Partner Relationship Management platform for managing programs, partners, leads, deals, commissions, and payouts.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PrmProvider>
          <AppShell>{children}</AppShell>
        </PrmProvider>
      </body>
    </html>
  );
}
