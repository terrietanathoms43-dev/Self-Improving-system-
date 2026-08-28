import type { Metadata } from "next";
import "./globals.css";
import { StagingBanner } from "@/components/staging-banner";
export const metadata: Metadata = {
  title: "CareBridge Jamaica | AI Review & Governance",
  description:
    "Secure human oversight and continuous improvement for medical-assistance assessments.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StagingBanner />
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
