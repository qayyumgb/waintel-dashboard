"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface MonthlyUsage {
  period: string;
  year: number;
  month: number;
  waintelCost: { plan: string; monthlyPkr: number; includedConversations: number };
  metaCost: {
    totalUsd: number;
    totalPkr: number;
    breakdown: Record<string, { count: number; costPkr: number; costUsd: number }>;
  };
  summary: {
    totalConversations: number;
    totalMessages: number;
    totalCostPkr: number;
    costPerConversation: number;
    metaAsPercentage: string;
    projectedMonthEndPkr: number;
    includedUsedPct: number;
    includedRemaining: number;
  };
}

interface DailyRow {
  record_date: string;
  conversations: number;
  messages: number;
  meta_cost_pkr: number;
}

interface RateInfo {
  rate: number;
  source: "live" | "fallback";
  updatedAt: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatPkr(n: number): string {
  return `Rs. ${Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

export default function UsagePage() {
  const { botId } = useAuth();
  const [usage, setUsage] = useState<MonthlyUsage | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [rateInfo, setRateInfo] = useState<RateInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRate, setSavingRate] = useState(false);
  const [rateOverride, setRateOverride] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    try {
      const [u, d, r] = await Promise.all([
        axios.get(`${API}/api/pricing/usage?botId=${botId}`),
        axios.get(`${API}/api/pricing/daily?botId=${botId}&days=30`),
        axios.get(`${API}/api/pricing/rate`),
      ]);
      setUsage(u.data);
      setDaily(d.data.days || []);
      setRateInfo(r.data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  const saveRate = async () => {
    if (!botId || !rateOverride) return;
    const n = parseFloat(rateOverride);
    if (isNaN(n) || n <= 0) {
      setToast({ message: "Enter a valid positive number", type: "error" });
      return;
    }
    setSavingRate(true);
    try {
      await axios.patch(`${API}/api/pricing/rate`, { botId, rate: n });
      setToast({ message: "Exchange rate updated", type: "success" });
      setRateOverride("");
      load();
    } catch {
      setToast({ message: "Failed to update rate", type: "error" });
    } finally {
      setSavingRate(false);
    }
  };

  if (loading) {
    return (
      <div className="p-3 md:p-8 animate-fade-in">
        <div className="text-center py-20 text-slate-400">Loading pricing data...</div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="p-3 md:p-8 animate-fade-in">
        <div className="text-center py-20 text-slate-400">Failed to load pricing data</div>
      </div>
    );
  }

  const usedPct = Math.min(100, usage.summary.includedUsedPct);
  const meterColor = usedPct < 70 ? "#1D9E75" : usedPct < 90 ? "#f59e0b" : "#ef4444";
  const meterBg = usedPct < 70 ? "#e8f5e9" : usedPct < 90 ? "#fffbeb" : "#fef2f2";

  const convos = usage.summary.totalConversations;
  const minutesIfHuman = convos * 10;
  const hoursIfHuman = Math.round(minutesIfHuman / 60);
  const humanCostPkr = hoursIfHuman * 150;
  const roi = usage.summary.totalCostPkr > 0 ? (humanCostPkr / usage.summary.totalCostPkr).toFixed(1) : "∞";

  const maxDailyConvs = Math.max(...daily.map((d) => d.conversations), 1);
  const maxDailyCost = Math.max(...daily.map((d) => d.meta_cost_pkr), 1);

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-5xl">
      <div className="mb-8">
        <div className="page-breadcrumb">💰 Pricing & Usage</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Transparent Pricing</h1>
        <p className="text-[16px] text-slate-500">See exactly what you&apos;re paying. Meta API costs, Waintel subscription, zero hidden fees.</p>
      </div>

      {/* SECTION 1 — This Month Summary */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">💰 Your Costs This Month — {usage.period}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl" style={{ background: "rgba(29,158,117,0.06)", border: "1px solid rgba(29,158,117,0.2)" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#047857" }}>Waintel Plan</div>
            <div className="text-[14px] font-bold capitalize text-slate-800">{usage.waintelCost.plan}</div>
            <div className="text-[22px] font-bold mt-1" style={{ color: "#1D9E75" }}>{formatPkr(usage.waintelCost.monthlyPkr)}</div>
            <div className="text-[11px] text-slate-500">/month · {usage.waintelCost.includedConversations.toLocaleString()} conversations included</div>
          </div>
          <div className="p-4 rounded-xl" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#1d4ed8" }}>Meta API Cost</div>
            <div className="text-[14px] font-bold text-slate-800">WhatsApp Cloud API</div>
            <div className="text-[22px] font-bold mt-1" style={{ color: "#1d4ed8" }}>{formatPkr(usage.metaCost.totalPkr)}</div>
            <div className="text-[11px] text-slate-500">{usage.summary.metaAsPercentage} of total</div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total This Month</div>
            <div className="text-[18px] font-bold text-slate-900">{formatPkr(usage.summary.totalCostPkr)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Per Conversation</div>
            <div className="text-[18px] font-bold text-slate-900">{formatPkr(usage.summary.costPerConversation)}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Projected Month-End</div>
            <div className="text-[18px] font-bold text-slate-900">{formatPkr(usage.summary.projectedMonthEndPkr)}</div>
          </div>
        </div>

        <div className="mt-4 p-3 rounded-xl text-[12px]" style={{ background: "#f0fdf4", color: "#166534" }}>
          💚 Meta API costs are nearly zero because customer-initiated messages are <b>FREE</b>. You only pay when the bot reaches out first (follow-ups, reports).
        </div>
      </div>

      {/* SECTION 2 — Usage Meter */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">📊 Conversations Used</h2>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[22px] font-bold text-slate-900">{usage.summary.totalConversations.toLocaleString()}</span>
          <span className="text-[13px] text-slate-500">of {usage.waintelCost.includedConversations.toLocaleString()} included ({usedPct}%)</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden mb-3" style={{ background: meterBg }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${usedPct}%`, background: meterColor }}
          />
        </div>
        <div className="text-[12px] text-slate-500">
          {usage.summary.includedRemaining.toLocaleString()} conversations remaining this month
        </div>
        <div className="mt-2 text-[12px]" style={{ color: meterColor }}>
          {usedPct < 70 && <>✅ Well within your plan limits</>}
          {usedPct >= 70 && usedPct < 90 && <>⚠️ You&apos;ve used {usedPct}% of your plan — consider upgrading if this pace continues</>}
          {usedPct >= 90 && <>🚨 You&apos;re at {usedPct}% — upgrade to the next tier to avoid overage</>}
        </div>
      </div>

      {/* SECTION 3 — Meta Pricing Explained */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">ℹ️ How Meta WhatsApp Pricing Works</h2>
        <p className="text-[13px] text-slate-500 mb-4">
          Meta charges per <b>24-hour conversation window</b>, not per message. When a customer messages you first, it&apos;s free.
          You only pay when the bot starts the conversation (follow-ups, daily reports, broadcasts).
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Rate (USD)</th>
                <th className="py-2 pr-3">Rate (PKR)</th>
                <th className="py-2 pr-3 text-right">Your Usage</th>
                <th className="py-2 pr-3 text-right">Your Cost</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key: "service",        label: "Customer-initiated", usd: 0 },
                { key: "utility",        label: "Bot-initiated (utility)", usd: 0.005 },
                { key: "marketing",      label: "Marketing broadcast", usd: 0.0125 },
                { key: "authentication", label: "OTP / authentication", usd: 0.0095 },
              ].map((row) => {
                const pkrRate = (rateInfo?.rate || 278.5) * row.usd;
                const userBreakdown = usage.metaCost.breakdown[row.key];
                return (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-700">{row.label}</td>
                    <td className="py-2 pr-3">{row.usd === 0 ? <span className="text-green-700 font-semibold">FREE ✅</span> : `$${row.usd.toFixed(4)}`}</td>
                    <td className="py-2 pr-3">{row.usd === 0 ? "—" : formatPkr(pkrRate)}</td>
                    <td className="py-2 pr-3 text-right">{userBreakdown?.count || 0}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{formatPkr(userBreakdown?.costPkr || 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 rounded-xl text-[12px]" style={{ background: "#f0fdf4", color: "#166534" }}>
          💡 <b>{(() => {
            const free = usage.metaCost.breakdown.service?.count || 0;
            const total = usage.summary.totalConversations;
            return total > 0 ? Math.round((free / total) * 100) : 0;
          })()}%</b> of your conversations are FREE because customers message you first.
        </div>
      </div>

      {/* SECTION 4 — Daily Usage Chart (30 days) */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">📈 Daily Usage — Last 30 Days</h2>
        {daily.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-[13px]">No usage data yet. Start chatting with your bot to see activity here.</div>
        ) : (
          <>
            <div className="mb-5">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Conversations per day</div>
              <div className="space-y-1.5">
                {daily.map((d) => (
                  <div key={d.record_date} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-[70px] shrink-0">
                      {new Date(d.record_date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    </span>
                    <div className="flex-1 h-4 rounded" style={{ background: "#f1f5f9" }}>
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${Math.max((d.conversations / maxDailyConvs) * 100, 2)}%`,
                          background: "linear-gradient(90deg, #1D9E75, #0F6E56)",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 w-[40px] text-right">{d.conversations}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Meta cost per day (PKR)</div>
              <div className="space-y-1.5">
                {daily.map((d) => (
                  <div key={d.record_date + "-cost"} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-[70px] shrink-0">
                      {new Date(d.record_date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                    </span>
                    <div className="flex-1 h-4 rounded" style={{ background: "#f1f5f9" }}>
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${d.meta_cost_pkr > 0 ? Math.max((d.meta_cost_pkr / maxDailyCost) * 100, 2) : 0}%`,
                          background: "#1d4ed8",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 w-[60px] text-right">{formatPkr(d.meta_cost_pkr)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* SECTION 5 — Cost Comparison */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">📈 Value You&apos;re Getting</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-xl bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">You Pay</div>
            <div className="text-[24px] font-bold text-slate-900">{formatPkr(usage.summary.totalCostPkr)}</div>
            <div className="text-[12px] text-slate-500">this month</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">You Get</div>
            <div className="text-[24px] font-bold text-slate-900">{convos.toLocaleString()}</div>
            <div className="text-[12px] text-slate-500">conversations handled by AI</div>
          </div>
        </div>

        <div className="p-4 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "#166534" }}>If a human did this work</div>
          <div className="text-[13px] text-slate-700 space-y-1">
            <div>{convos.toLocaleString()} conversations × 10 min each = <b>{hoursIfHuman} hours</b></div>
            <div>At Rs. 150/hr = <b>{formatPkr(humanCostPkr)}</b></div>
          </div>
          <div className="mt-3 text-[14px] font-bold" style={{ color: "#166534" }}>
            ROI: {roi}x — AI saves {formatPkr(Math.max(0, humanCostPkr - usage.summary.totalCostPkr))} this month
          </div>
        </div>
      </div>

      {/* SECTION 6 — USD/PKR Rate Setting */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">⚙️ USD / PKR Exchange Rate</h2>
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <div className="text-[13px] text-slate-600 mb-1">
              Current rate: <b>1 USD = Rs. {rateInfo?.rate.toFixed(2)}</b>
            </div>
            <div className="text-[11px] text-slate-400">
              Source: {rateInfo?.source === "live" ? "🟢 Live rate" : "⚪ Fallback"}
              {rateInfo && <> · updated {timeAgo(rateInfo.updatedAt)}</>}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.01"
              className="form-input max-w-[140px]"
              placeholder="Override rate"
              value={rateOverride}
              onChange={(e) => setRateOverride(e.target.value)}
            />
            <button
              className="btn-primary text-[13px]"
              onClick={saveRate}
              disabled={savingRate || !rateOverride}
            >
              {savingRate ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          This rate only affects Meta cost calculations — it doesn&apos;t change your Waintel subscription price.
        </p>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
