import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";

export const metadata: Metadata = {
  title: "Dubai Real Estate Dashboard",
  description: "Dubai real estate market analytics - DLD transaction data from 2004 to 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>
          <Sidebar />
          <main className="md:pl-[220px] min-h-screen">
            <div className="pt-16 pb-6 px-4 md:pt-6 md:px-6">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
