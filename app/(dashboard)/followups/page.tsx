"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface FollowUp {
  id: string;
  customer_phone: string;
  product_mentioned: string | null;
  product: string | null;
  intent_score: number | null;
  ab_variant: string | null;
  status: string;
  scheduled_for: string | null;
  sent_at: string | null;
  converted_at: string | null;
  conversion_value: string | null;
  message_sent: string | null;
  created_at: string;
}

interface ABRow {
  variant: string;
  industry: string | null;
  sent_count: number;
  converted_count: number;
  revenue_recovered: string;
  conversion_rate: number;
}

interface Stats {
  total_scheduled: number;
  total_sent: number;
  total_converted: number;
  total_cancelled: number;
  total_revenue_recovered: number;
  recovery_rate: number;
}

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatPhone(p: string): string {
  if (p?.startsWith("92") && p.length >= 12) return `0${p.slice(2, 5)}-${p.slice(5)}`;
  return p || "";
}

const statusBadge: Record<string, { bg: string; color: string; label: string }> = {
  scheduled: { bg: "#f1f5f9", color: "#475569", label: "Pending" },
  pending:   { bg: "#f1f5f9", color: "#475569", label: "Pending" },
  sent:      { bg: "#dbeafe", color: "#1d4ed8", label: "Sent" },
  converted: { bg: "#dcfce7", color: "#166534", label: "Converted ✅" },
  cancelled: { bg: "#fef2f2", color: "#b91c1c", label: "Cancelled" },
  failed:    { bg: "#fef2f2", color: "#b91c1c", label: "Failed" },
};

const variantColors: Record<string, { bg: string; color: string; border: string }> = {
  A: { bg: "rgba(29,158,117,0.08)", color: "#047857", border: "rgba(29,158,117,0.3)" },
  B: { bg: "rgba(245,158,11,0.08)", color: "#92400e", border: "rgba(245,158,11,0.3)" },
  C: { bg: "rgba(59,130,246,0.08)", color: "#1d4ed8", border: "rgba(59,130,246,0.3)" },
};

export default function FollowupsPage() {
  const { botId } = useAuth();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [abResults, setAbResults] = useState<ABRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsDraft, setSettingsDraft] = useState({
    followupEnabled: true, followupDelayHours: 4, followupMinScore: 7, followupMaxRetries: 1,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    try {
      const [fu, ab, st, bot] = await Promise.all([
        axios.get(`${API}/api/followups?botId=${botId}`),
        axios.get(`${API}/api/followups/ab-results?botId=${botId}`),
        axios.get(`${API}/api/followups/stats?botId=${botId}&days=30`),
        axios.get(`${API}/api/bots/${botId}`),
      ]);
      setFollowUps(fu.data.followUps || []);
      setAbResults(ab.data.results || []);
      setStats(st.data.stats || null);
      setSettingsDraft({
        followupEnabled: bot.data.followup_enabled ?? true,
        followupDelayHours: bot.data.followup_delay_hours ?? 4,
        followupMinScore: bot.data.followup_min_score ?? 7,
        followupMaxRetries: bot.data.followup_max_retries ?? 1,
      });
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  const cancelFollowUp = async (id: string) => {
    if (!confirm("Cancel this follow-up?")) return;
    try {
      await axios.delete(`${API}/api/followups/${id}`);
      setToast({ message: "Cancelled", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const saveSettings = async () => {
    if (!botId) return;
    setSavingSettings(true);
    try {
      await axios.patch(`${API}/api/followups/settings`, { botId, ...settingsDraft });
      setToast({ message: "Settings saved", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
    finally { setSavingSettings(false); }
  };

  // Aggregate A/B results across industries → one row per variant
  const abSummary: Record<string, { sent: number; converted: number; revenue: number }> = {
    A: { sent: 0, converted: 0, revenue: 0 },
    B: { sent: 0, converted: 0, revenue: 0 },
    C: { sent: 0, converted: 0, revenue: 0 },
  };
  for (const r of abResults) {
    if (!abSummary[r.variant]) continue;
    abSummary[r.variant].sent += r.sent_count;
    abSummary[r.variant].converted += r.converted_count;
    abSummary[r.variant].revenue += Number(r.revenue_recovered || 0);
  }

  // Determine winner (only if any variant has ≥5 sends)
  let winnerVariant: string | null = null;
  let winnerRate = 0;
  for (const [v, d] of Object.entries(abSummary)) {
    if (d.sent >= 5) {
      const rate = (d.converted / d.sent) * 100;
      if (rate > winnerRate) { winnerRate = rate; winnerVariant = v; }
    }
  }

  if (loading) {
    return <div className="p-3 md:p-8 animate-fade-in"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">🔔 Follow-ups</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Smart Follow-up Engine</h1>
        <p className="text-[16px] text-slate-500">AI-scored lead recovery with A/B tested messaging. Recovery tracked over 48 hours.</p>
      </div>

      {/* Section 1 — Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Sent" value={String(stats?.total_sent ?? 0)} />
        <SummaryCard label="Converted" value={String(stats?.total_converted ?? 0)} color="#047857" />
        <SummaryCard
          label="Recovery Rate"
          value={`${stats?.recovery_rate ?? 0}%`}
          color={(stats?.recovery_rate ?? 0) >= 20 ? "#047857" : undefined}
        />
        <SummaryCard
          label="Revenue Recovered"
          value={`Rs. ${Number(stats?.total_revenue_recovered ?? 0).toLocaleString("en-PK")}`}
          color="#047857"
        />
      </div>

      {/* Section 2 — A/B Results */}
      <div className="mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">A/B Test Results</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["A", "B", "C"] as const).map((v) => {
            const d = abSummary[v];
            const rate = d.sent > 0 ? ((d.converted / d.sent) * 100).toFixed(1) : "0";
            const isWinner = winnerVariant === v;
            const c = variantColors[v];
            return (
              <div key={v} className="card" style={{ background: c.bg, border: `2px solid ${isWinner ? c.color : c.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[24px] font-bold" style={{ color: c.color }}>Variant {v}</div>
                  {isWinner && <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: c.color, color: "#fff" }}>🏆 Winner</span>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Sent</span><span className="font-bold">{d.sent}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Converted</span><span className="font-bold">{d.converted}</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Rate</span><span className="font-bold" style={{ color: c.color }}>{rate}%</span></div>
                  <div className="flex justify-between text-[13px]"><span className="text-slate-500">Revenue</span><span className="font-bold">Rs. {d.revenue.toLocaleString("en-PK")}</span></div>
                </div>
              </div>
            );
          })}
        </div>
        {!winnerVariant && (
          <p className="text-[11px] text-slate-400 mt-2">A variant needs ≥5 sends before it can be declared a winner.</p>
        )}
      </div>

      {/* Section 3 — Recent Follow-ups */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">Recent Follow-ups</h2>
        {followUps.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No follow-ups yet. They auto-generate from high-intent conversations.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Product</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Variant</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Scheduled</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {followUps.map((f) => {
                  const sb = statusBadge[f.status] || { bg: "#f5f5f5", color: "#616161", label: f.status };
                  const product = f.product_mentioned || f.product || "—";
                  return (
                    <tr key={f.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-700">{formatPhone(f.customer_phone)}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[160px] truncate">{product}</td>
                      <td className="py-2 pr-3">
                        {f.intent_score != null && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{
                            background: f.intent_score >= 8 ? "#dcfce7" : f.intent_score >= 6 ? "#fef3c7" : "#f1f5f9",
                            color: f.intent_score >= 8 ? "#166534" : f.intent_score >= 6 ? "#92400e" : "#475569",
                          }}>{f.intent_score}/10</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        {f.ab_variant && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                            background: variantColors[f.ab_variant]?.bg || "#f1f5f9",
                            color: variantColors[f.ab_variant]?.color || "#475569",
                          }}>{f.ab_variant}</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500 text-[11px]">
                        {f.scheduled_for ? new Date(f.scheduled_for).toLocaleDateString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-[11px]">
                        {f.converted_at
                          ? <span className="text-green-700 font-semibold">Rs. {Number(f.conversion_value || 0).toLocaleString("en-PK")}</span>
                          : f.sent_at
                            ? <span className="text-slate-400">sent {timeAgo(f.sent_at)}</span>
                            : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {(f.status === "scheduled" || f.status === "pending") && (
                          <button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => cancelFollowUp(f.id)}>Cancel</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 4 — Settings */}
      <div className="card">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">⚙️ Follow-up Settings</h2>

        <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid #e5e7eb" }}>
          <div>
            <div className="text-[13px] font-semibold text-slate-800">Enable Follow-ups</div>
            <div className="text-[11px] text-slate-500">Auto-send recovery messages to high-intent customers</div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settingsDraft.followupEnabled}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, followupEnabled: e.target.checked })} />
            <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settingsDraft.followupEnabled ? "translate-x-5" : ""}`} />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          <div>
            <label className="form-label">Minimum Intent Score (1–10)</label>
            <input type="range" min="1" max="10" value={settingsDraft.followupMinScore}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, followupMinScore: parseInt(e.target.value) })}
              className="w-full" />
            <div className="text-[12px] text-slate-600 mt-1">
              Trigger at score ≥ <b>{settingsDraft.followupMinScore}</b>
            </div>
          </div>
          <div>
            <label className="form-label">Delay before sending</label>
            <select className="form-input" value={settingsDraft.followupDelayHours}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, followupDelayHours: parseInt(e.target.value) })}>
              <option value={2}>2 hours</option>
              <option value={4}>4 hours (recommended)</option>
              <option value={8}>8 hours</option>
              <option value={24}>24 hours</option>
              <option value={48}>48 hours</option>
            </select>
          </div>
          <div>
            <label className="form-label">Max retries</label>
            <select className="form-input" value={settingsDraft.followupMaxRetries}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, followupMaxRetries: parseInt(e.target.value) })}>
              <option value={0}>0 (one shot)</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>
        </div>

        <button className="btn-primary text-[13px]" onClick={saveSettings} disabled={savingSettings}>
          {savingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card !py-4">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[22px] font-bold" style={{ color: color || "#0f172a" }}>{value}</div>
    </div>
  );
}
