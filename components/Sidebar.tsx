"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const BASE_NAV = [
  { href: "/", label: "Dashboard", icon: HomeIcon },
  { href: "/bot-setup", label: "Bot Setup", icon: SettingsIcon },
  { href: "/knowledge", label: "Knowledge Base", icon: BookIcon },
  { href: "/conversations", label: "Conversations", icon: ChatIcon },
  { href: "/reports", label: "Reports", icon: ReportIcon },
];

const ORDER_NAV = [
  { href: "/orders", label: "Orders", icon: BagIcon },
];

const HOTEL_NAV = [
  { href: "/bookings", label: "Bookings", icon: CalendarIcon },
  { href: "/rooms", label: "Rooms", icon: RoomIcon },
];

const ECOMMERCE_NAV = [
  { href: "/products", label: "Products", icon: TagIcon },
];

const BOTTOM_NAV = [
  { href: "/analytics", label: "Analytics", icon: ChartIcon },
  { href: "/pricing", label: "Billing", icon: CardIcon },
  { href: "/onboarding", label: "Setup Wizard", icon: WizardIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name || "My Business";
  const userEmail = session?.user?.email || "";
  const initials = userName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  const botId = (session as any)?.botId as string | undefined;
  const [industry, setIndustry] = useState<string>("");

  useEffect(() => {
    if (!botId) return;
    axios.get(`${API}/api/bots/${botId}`)
      .then((res) => setIndustry((res.data.industry || "").toLowerCase()))
      .catch(() => {});
  }, [botId]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ industry: string }>).detail;
      if (detail?.industry) setIndustry(detail.industry);
    };
    window.addEventListener("botIndustryChanged", handler);
    return () => window.removeEventListener("botIndustryChanged", handler);
  }, []);

  const isHotel = industry === "hotel";
  const isEcommerce = industry === "e-commerce" || industry === "ecommerce";
  const navItems = [
    ...BASE_NAV,
    ...(isHotel ? HOTEL_NAV : ORDER_NAV),
    ...(isEcommerce ? ECOMMERCE_NAV : []),
    ...BOTTOM_NAV,
  ];

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[264px] flex flex-col z-40"
      style={{
        background: "linear-gradient(180deg, #1D9E75 0%, #0F6E56 50%, #0A5A45 100%)",
        borderRight: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "4px 0 24px rgba(0,0,0,0.15)",
      }}
    >
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div
          className="w-[42px] h-[42px] rounded-xl flex items-center justify-center text-lg font-bold text-white"
          style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
        >
          W
        </div>
        <div>
          <div className="text-white font-bold text-[15px] leading-tight">Waintel.ai</div>
          <div className="text-white/60 text-[10px] font-semibold uppercase tracking-wider">
            WhatsApp AI Agent
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 mt-4 flex flex-col gap-1 overflow-y-auto overflow-x-hidden min-h-0"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.2) transparent",
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-medium transition-all duration-200 relative group"
              style={{
                color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[28px] rounded-r-full"
                  style={{ background: "#fff" }}
                />
              )}
              <div
                className="w-[36px] h-[36px] rounded-lg flex items-center justify-center transition-all duration-200"
                style={{
                  background: isActive ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                }}
              >
                <item.icon />
              </div>
              <span className="group-hover:translate-x-1 transition-transform duration-200">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Info Box */}
      <div className="mx-4 mb-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}>
        <div className="text-white/80 text-[11px] font-semibold uppercase tracking-wider mb-1">
          Bot Status
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
          <span className="text-white text-[13px] font-medium">Active & Running</span>
        </div>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-[40px] h-[40px] rounded-full flex items-center justify-center text-sm font-bold text-white relative shrink-0"
            style={{ background: "linear-gradient(135deg, #34C48E, #0F6E56)" }}
          >
            {initials}
            <div className="absolute bottom-0 right-0 w-[10px] h-[10px] rounded-full bg-emerald-400 border-2 border-[#0F6E56]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[13px] font-semibold truncate">{userName}</div>
            <div className="text-white/50 text-[11px] truncate">{userEmail}</div>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[12px] font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function HomeIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  );
}

function RoomIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  );
}

function WizardIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}
