import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PCCI Show Results | Search & Points Tally",
  description: "Search PCCI dog show results by breed, date, PCCI No. and tally points.",
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
