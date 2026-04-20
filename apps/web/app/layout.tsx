import "./globals.css";
import type { Metadata } from "next";
import { ExtensionErrorFilter } from "./extension-error-filter";

export const metadata: Metadata = {
  title: "MemeRecall",
  description: "KOL trust score and dead-chart revival radar for BSC memecoins.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ExtensionErrorFilter />
        {children}
      </body>
    </html>
  );
}
