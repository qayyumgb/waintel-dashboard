"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-30 flex items-center px-4 gap-3"
        style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white"
          style={{ background: "rgba(255,255,255,0.15)" }}
          aria-label="Open menu"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="text-white font-bold text-[15px]">Waintel.ai</div>
      </div>

      {/* Overlay (mobile only) */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 md:ml-[264px] min-h-screen overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
