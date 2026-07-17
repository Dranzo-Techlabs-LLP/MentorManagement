import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

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
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
