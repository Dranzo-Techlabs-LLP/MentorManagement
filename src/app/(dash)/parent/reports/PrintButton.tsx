"use client";

import { Printer } from "lucide-react";

/**
 * PrintButton — triggers the browser print dialog for the branded report.
 * Hidden from the printed page via the `no-print` class.
 */
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print">
      <Printer className="h-4 w-4" /> Print / Save PDF
    </button>
  );
}
