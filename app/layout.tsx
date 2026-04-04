import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Waintel.ai — WhatsApp AI Agent",
  description: "Configure your WhatsApp AI Agent for your business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body suppressHydrationWarning className="min-h-screen flex" style={{ background: "#f6f7fb" }}>
        <Sidebar />
        <main className="flex-1 ml-[264px] min-h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
