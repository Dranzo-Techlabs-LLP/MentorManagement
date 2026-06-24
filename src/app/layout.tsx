import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elevate U · Mentoring Management Portal",
  description:
    "Elevate U — Mentoring Management Portal for SLEP (Student Leadership Empowerment Program). An initiative of NDHR Global Solutions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
