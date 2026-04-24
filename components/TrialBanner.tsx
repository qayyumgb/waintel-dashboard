"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export interface TrialStatus {
  isOnTrial: boolean;
  isExpired: boolean;
  isExhausted: boolean;
  endsAt: string | null;
  daysLeft: number;
  hoursLeft: number;
  messagesUsed: number;
  messagesLimit: number;
  messagesLeft: number;
  usagePercent: number;
  plan: string;
  convertedAt: string | null;
  severity: "none" | "ok" | "warning" | "critical" | "blocked";
}

const SEVERITY_STYLES: Record<TrialStatus["severity"], { bg: string; border: string; text: string; accent: string; icon: string }> = {
  none:    { bg: "transparent",         border: "transparent",         text: "",              accent: "",         icon: "" },
  ok:      { bg: "#ecfdf5",             border: "#a7f3d0",             text: "#065f46",       accent: "#10b981",  icon: "🎁" },
  warning: { bg: "#fef3c7",             border: "#fde68a",             text: "#92400e",       accent: "#f59e0b",  icon: "⚠️" },
  critical:{ bg: "#fee2e2",             border: "#fecaca",             text: "#991b1b",       accent: "#ef4444",  icon: "⏰" },
  blocked: { bg: "#1f2937",             border: "#111827",             text: "#f9fafb",       accent: "#ef4444",  icon: "🔒" },
};

export default function TrialBanner() {
  const { tenantId } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await axios.get(`${API}/api/trial/status?tenantId=${tenantId}`);
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [tenantId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Listen for upgrade events
  useEffect(() => {
    const handler = () => fetchStatus();
    window.addEventListener("agencyProfileChanged", handler);
    const interval = setInterval(fetchStatus, 60000); // refresh every 60s
    return () => {
      window.removeEventListener("agencyProfileChanged", handler);
      clearInterval(interval);
    };
  }, [fetchStatus]);

  if (!status || !status.isOnTrial || dismissed) return null;

  const s = SEVERITY_STYLES[status.severity];
  const isBlocked = status.severity === "blocked";

  const timeCopy = (() => {
    if (isBlocked) {
      return status.isExpired && status.isExhausted
        ? "Trial ended"
        : status.isExpired
          ? "Trial period ended"
          : "Message limit reached";
    }
    if (status.daysLeft >= 1) return `${status.daysLeft} day${status.daysLeft === 1 ? "" : "s"} left`;
    if (status.hoursLeft >= 1) return `${status.hoursLeft} hour${status.hoursLeft === 1 ? "" : "s"} left`;
    return "Ends soon";
  })();

  return (
    <div
      className="w-full border-b px-4 py-3 relative z-20"
      style={{ background: s.bg, borderBottomColor: s.border, color: s.text }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
        <div className="flex-shrink-0 text-[20px]">{s.icon}</div>

        <div className="flex-1 min-w-[200px]">
          {isBlocked ? (
            <div>
              <div className="font-bold text-[14px] leading-tight">Your free trial has ended</div>
              <div className="text-[12px] opacity-80 mt-0.5">Upgrade to keep your bot running and unlock unlimited messages.</div>
            </div>
          ) : (
            <div>
              <div className="font-bold text-[14px] leading-tight flex items-center gap-2 flex-wrap">
                <span>Free trial</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.6)", color: s.text }}>
                  {timeCopy}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.6)", color: s.text }}>
                  {status.messagesUsed} / {status.messagesLimit} messages
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden w-full max-w-[420px]" style={{ background: "rgba(0,0,0,0.08)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${status.usagePercent}%`, background: s.accent }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className="text-[12px] font-semibold px-4 py-2 rounded-lg transition-all hover:opacity-90"
            style={{
              background: isBlocked ? "#ffffff" : s.accent,
              color: isBlocked ? "#111827" : "#ffffff",
            }}
            onClick={() => router.push("/pricing")}
          >
            {isBlocked ? "Upgrade Now →" : "Upgrade →"}
          </button>
          {!isBlocked && (
            <button
              className="text-[11px] opacity-60 hover:opacity-100 px-2"
              onClick={() => setDismissed(true)}
              title="Dismiss (re-appears on next load)"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
