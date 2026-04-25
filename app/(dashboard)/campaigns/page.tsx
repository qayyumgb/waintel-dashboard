"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type CampaignStatus = "draft" | "scheduled" | "running" | "completed" | "paused" | "cancelled";

interface Campaign {
  id: string;
  name: string;
  message: string;
  segment_type: string;
  total_recipients: number;
  sent_count: number;
  replied_count: number;
  converted_count: number;
  failed_count: number;
  status: CampaignStatus;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  bot_name: string;
  reply_rate: number;
  conversion_rate: number;
}

interface Recipient {
  customer_phone: string;
  status: string;
  sent_at: string | null;
  replied_at: string | null;
  converted_at: string | null;
  error_message: string | null;
}

interface BotSettings {
  campaigns_enabled: boolean;
  campaign_send_rate: number;
  campaign_blacklist: string;
}

const SEGMENT_OPTIONS: Array<{ value: string; emoji: string; label: string; desc: string; needsDays?: "active" | "inactive" }> = [
  { value: "all_customers",      emoji: "👥", label: "All Customers",       desc: "Everyone who ever messaged your bot" },
  { value: "recent_customers",   emoji: "📅", label: "Recent Customers",    desc: "Active in the last X days", needsDays: "active" },
  { value: "hot_leads",          emoji: "🔥", label: "Hot Leads",           desc: "AI-scored 8+ (ready to buy)" },
  { value: "warm_leads",         emoji: "⚡", label: "Warm Leads",          desc: "AI-scored 5-7 (interested)" },
  { value: "abandoned_carts",    emoji: "🛒", label: "Abandoned Carts",     desc: "Showed intent but didn't convert" },
  { value: "paid_customers",     emoji: "✅", label: "Paid Customers",      desc: "Completed a payment" },
  { value: "inactive_customers", emoji: "😴", label: "Inactive Customers",  desc: "Haven't messaged in X days", needsDays: "inactive" },
];

const STATUS_STYLES: Record<CampaignStatus, { bg: string; text: string; label: string; emoji: string }> = {
  draft:     { bg: "#f1f5f9", text: "#475569", label: "Draft",     emoji: "📝" },
  scheduled: { bg: "#dbeafe", text: "#1d4ed8", label: "Scheduled", emoji: "⏰" },
  running:   { bg: "#dcfce7", text: "#166534", label: "Running",   emoji: "🔄" },
  completed: { bg: "#dcfce7", text: "#166534", label: "Completed", emoji: "✅" },
  paused:    { bg: "#fef3c7", text: "#92400e", label: "Paused",    emoji: "⏸" },
  cancelled: { bg: "#fee2e2", text: "#b91c1c", label: "Cancelled", emoji: "❌" },
};

function maskPhone(p: string): string {
  if (!p) return "";
  if (p.length >= 8) return p.slice(0, 4) + "XXX" + p.slice(-3);
  return p;
}

function timeAgo(d: string | null): string {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function CampaignsPage() {
  const { tenantId, botId } = useAuth();
  const [view, setView] = useState<"list" | "create" | "report">("list");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportCampaign, setReportCampaign] = useState<Campaign | null>(null);
  const [reportRecipients, setReportRecipients] = useState<Recipient[]>([]);
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await axios.get(`${API}/api/campaigns?tenantId=${tenantId}`);
      setCampaigns(data.campaigns || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [tenantId]);

  const loadSettings = useCallback(async () => {
    if (!botId) return;
    try {
      const { data } = await axios.get(`${API}/api/bots/${botId}`);
      setSettings({
        campaigns_enabled: data.campaigns_enabled ?? true,
        campaign_send_rate: data.campaign_send_rate ?? 20,
        campaign_blacklist: data.campaign_blacklist || "",
      });
    } catch { /* silent */ }
  }, [botId]);

  useEffect(() => { load(); loadSettings(); }, [load, loadSettings]);

  const openReport = async (c: Campaign) => {
    setReportCampaign(c);
    setView("report");
    try {
      const { data } = await axios.get(`${API}/api/campaigns/${c.id}`);
      setReportRecipients(data.recipients || []);
    } catch { /* silent */ }
  };

  const sendNow = async (id: string) => {
    if (!confirm("Send this campaign now?")) return;
    try {
      await axios.post(`${API}/api/campaigns/${id}/send`);
      setToast({ message: "Campaign started — sending in background. Check status in a few seconds.", type: "success" });
      // Poll status for the next 30 seconds so user sees if it fails the pre-flight check
      let polls = 0;
      const interval = setInterval(async () => {
        polls++;
        await load();
        const updated = (await axios.get(`${API}/api/campaigns?tenantId=${tenantId}`)).data.campaigns?.find((c: any) => c.id === id);
        if (updated?.status === "cancelled" || updated?.status === "completed" || polls >= 10) {
          clearInterval(interval);
          if (updated?.status === "cancelled" && updated.failed_count > 0) {
            setToast({ message: "Campaign cancelled — bot may not be connected. Check Bot Setup.", type: "error" });
          }
        }
      }, 3000);
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Send failed", type: "error" });
    }
  };

  const pause = async (id: string) => {
    try { await axios.post(`${API}/api/campaigns/${id}/pause`); load(); } catch {}
  };
  const cancel = async (id: string) => {
    if (!confirm("Cancel this campaign?")) return;
    try { await axios.post(`${API}/api/campaigns/${id}/cancel`); load(); } catch {}
  };
  const duplicate = async (id: string) => {
    try { await axios.post(`${API}/api/campaigns/${id}/duplicate`); setToast({ message: "Duplicated", type: "success" }); load(); } catch {}
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this campaign?")) return;
    try { await axios.delete(`${API}/api/campaigns/${id}`); load(); } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Delete failed", type: "error" });
    }
  };

  const saveSettings = async (next: Partial<BotSettings>) => {
    if (!botId || !settings) return;
    const updated = { ...settings, ...next };
    setSettings(updated);
    try {
      await axios.patch(`${API}/api/campaigns/settings`, {
        botId,
        campaignsEnabled: updated.campaigns_enabled,
        campaignSendRate: updated.campaign_send_rate,
        campaignBlacklist: updated.campaign_blacklist,
      });
      setToast({ message: "Settings saved", type: "success" });
    } catch { setToast({ message: "Save failed", type: "error" }); }
  };

  if (loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  // ── REPORT VIEW ─────────────────────────────────────────────────────────
  if (view === "report" && reportCampaign) {
    const c = reportCampaign;
    const progress = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0;
    return (
      <div className="p-3 md:p-8 animate-fade-in max-w-6xl">
        <button className="text-[13px] text-slate-500 hover:text-slate-800 mb-4" onClick={() => { setView("list"); setReportCampaign(null); }}>
          ← Back to campaigns
        </button>
        <div className="mb-6">
          <div className="page-breadcrumb">📊 Campaign Report</div>
          <h1 className="text-[26px] font-bold text-slate-900 mb-1">{c.name}</h1>
          <p className="text-[13px] text-slate-500">Started {timeAgo(c.started_at)} · {c.bot_name} · {c.segment_type}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPI label="📤 Sent" value={String(c.sent_count)} sub={`of ${c.total_recipients}`} />
          <KPI label="📩 Replied" value={String(c.replied_count)} sub={`${c.reply_rate}% reply rate`} color="#1d4ed8" />
          <KPI label="🎯 Converted" value={String(c.converted_count)} sub={`${c.conversion_rate}% rate`} color="#047857" />
          <KPI label="❌ Failed" value={String(c.failed_count)} color={c.failed_count > 0 ? "#b91c1c" : "#0f172a"} />
        </div>

        <div className="card mb-6">
          <h2 className="text-[14px] font-bold text-slate-700 mb-2">Delivery Progress</h2>
          <div className="h-3 rounded-full bg-slate-100 overflow-hidden mb-2">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: "#1D9E75" }} />
          </div>
          <div className="text-[12px] text-slate-500">{progress}% delivered ({c.sent_count} of {c.total_recipients})</div>
        </div>

        <div className="card mb-6">
          <h2 className="text-[14px] font-bold text-slate-700 mb-3">Message</h2>
          <div className="rounded-xl p-4 text-[13px] text-slate-800 whitespace-pre-wrap" style={{ background: "#dcf8c6", maxWidth: 480 }}>
            {c.message}
          </div>
        </div>

        <div className="card">
          <h2 className="text-[14px] font-bold text-slate-700 mb-3">Recipients ({reportRecipients.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Phone</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Replied</th>
                  <th className="py-2 pr-3">Error</th>
                </tr>
              </thead>
              <tbody>
                {reportRecipients.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-700">{maskPhone(r.customer_phone)}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: r.status === "replied" ? "#dcfce7" : r.status === "sent" ? "#dbeafe" : r.status === "failed" ? "#fee2e2" : "#f1f5f9",
                        color:      r.status === "replied" ? "#166534" : r.status === "sent" ? "#1d4ed8" : r.status === "failed" ? "#b91c1c" : "#475569",
                      }}>{r.status}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(r.sent_at)}</td>
                    <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(r.replied_at)}</td>
                    <td className="py-2 pr-3 text-red-600 text-[11px] max-w-[280px] truncate">{r.error_message || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ── CREATE VIEW ─────────────────────────────────────────────────────────
  if (view === "create") {
    return <CreateCampaign onCancel={() => setView("list")} onCreated={() => { setView("list"); load(); setToast({ message: "Campaign created!", type: "success" }); }} setToast={setToast} />;
  }

  // ── LIST VIEW ───────────────────────────────────────────────────────────
  const totalSent = campaigns.reduce((sum, c) => sum + c.sent_count, 0);
  const totalConverted = campaigns.reduce((sum, c) => sum + c.converted_count, 0);
  const avgReplyRate = campaigns.length > 0
    ? Math.round(campaigns.reduce((s, c) => s + (c.reply_rate || 0), 0) / campaigns.length * 10) / 10
    : 0;

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="page-breadcrumb">📢 Campaigns</div>
          <h1 className="text-[28px] font-bold text-slate-900 mb-2">Outbound Campaigns</h1>
          <p className="text-[16px] text-slate-500">Schedule WhatsApp blasts to segmented audiences. Track delivery, replies, and conversions per campaign.</p>
        </div>
        <button className="btn-primary text-[13px]" onClick={() => setView("create")}>
          + Create Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPI label="Total Campaigns" value={String(campaigns.length)} />
        <KPI label="Total Sent" value={totalSent.toLocaleString("en-PK")} />
        <KPI label="Avg Reply Rate" value={`${avgReplyRate}%`} color={avgReplyRate >= 20 ? "#047857" : "#0f172a"} />
        <KPI label="Total Converted" value={String(totalConverted)} color="#047857" />
      </div>

      {/* Campaign list */}
      <div className="card mb-8">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">All Campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No campaigns yet. Click <b>+ Create Campaign</b> to send your first WhatsApp blast.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Segment</th>
                  <th className="py-2 pr-3">Recipients</th>
                  <th className="py-2 pr-3">Sent</th>
                  <th className="py-2 pr-3">Reply Rate</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const s = STATUS_STYLES[c.status] || STATUS_STYLES.draft;
                  return (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-800">{c.name}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[280px]">{c.message}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{c.segment_type.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-3 text-slate-700">{c.total_recipients}</td>
                      <td className="py-2 pr-3 text-slate-700">{c.sent_count}</td>
                      <td className="py-2 pr-3 text-slate-700 font-semibold">{c.reply_rate}%</td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === "running" ? "animate-pulse" : ""}`}
                          style={{ background: s.bg, color: s.text }}>
                          {s.emoji} {s.label}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500 text-[11px]">
                        {c.scheduled_at && c.status === "scheduled"
                          ? `at ${new Date(c.scheduled_at).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                          : timeAgo(c.completed_at || c.started_at || c.created_at)}
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex gap-2 justify-end">
                          {c.status === "draft" && (<>
                            <button className="text-[11px] text-emerald-700 hover:underline" onClick={() => sendNow(c.id)}>Send Now</button>
                            <button className="text-[11px] text-red-500 hover:underline" onClick={() => remove(c.id)}>Delete</button>
                          </>)}
                          {c.status === "scheduled" && (<>
                            <button className="text-[11px] text-emerald-700 hover:underline" onClick={() => sendNow(c.id)}>Send Now</button>
                            <button className="text-[11px] text-red-500 hover:underline" onClick={() => cancel(c.id)}>Cancel</button>
                          </>)}
                          {c.status === "running" && (
                            <button className="text-[11px] text-amber-700 hover:underline" onClick={() => pause(c.id)}>Pause</button>
                          )}
                          {c.status === "paused" && (<>
                            <button className="text-[11px] text-emerald-700 hover:underline" onClick={() => sendNow(c.id)}>Resume</button>
                            <button className="text-[11px] text-red-500 hover:underline" onClick={() => cancel(c.id)}>Cancel</button>
                          </>)}
                          {c.status === "completed" && (<>
                            <button className="text-[11px] text-blue-700 hover:underline" onClick={() => openReport(c)}>View Report</button>
                            <button className="text-[11px] text-slate-600 hover:underline" onClick={() => duplicate(c.id)}>Duplicate</button>
                          </>)}
                          {c.status === "cancelled" && (
                            <button className="text-[11px] text-red-500 hover:underline" onClick={() => remove(c.id)}>Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settings */}
      {settings && (
        <div className="card">
          <h2 className="text-[16px] font-bold text-slate-800 mb-4">⚙️ Campaign Settings</h2>

          <label className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid #e5e7eb" }}>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Enable Campaigns</div>
              <div className="text-[11px] text-slate-500">Disable to lock campaign creation while keeping past data</div>
            </div>
            <input type="checkbox" className="sr-only peer" checked={settings.campaigns_enabled}
              onChange={(e) => saveSettings({ campaigns_enabled: e.target.checked })} />
            <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.campaigns_enabled ? "translate-x-5" : ""}`} />
            </div>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="form-label">Send Rate (messages per minute)</label>
              <select className="form-input" value={settings.campaign_send_rate}
                onChange={(e) => saveSettings({ campaign_send_rate: parseInt(e.target.value) })}>
                <option value={10}>10/min — safe (low spam risk)</option>
                <option value={20}>20/min — normal (recommended)</option>
                <option value={30}>30/min — fast</option>
                <option value={60}>60/min — max (higher spam risk)</option>
              </select>
              <div className="text-[11px] text-amber-700 mt-1">⚠️ Higher rates may trigger WhatsApp anti-spam.</div>
            </div>
            <div>
              <label className="form-label">Blacklist (one phone per line)</label>
              <textarea className="form-input font-mono text-[12px]" rows={4}
                value={settings.campaign_blacklist}
                onChange={(e) => setSettings({ ...settings, campaign_blacklist: e.target.value })}
                onBlur={() => saveSettings({ campaign_blacklist: settings.campaign_blacklist })}
                placeholder={"923001234567\n923009876543"} />
              <div className="text-[11px] text-slate-500 mt-1">These numbers will never receive any campaign.</div>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── CREATE CAMPAIGN COMPONENT ─────────────────────────────────────────────

function CreateCampaign({ onCancel, onCreated, setToast }: {
  onCancel: () => void;
  onCreated: () => void;
  setToast: (t: { message: string; type: "success" | "error" }) => void;
}) {
  const { tenantId, botId } = useAuth();
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [segment, setSegment] = useState<string>("all_customers");
  const [days, setDays] = useState(30);
  const [inactiveDays, setInactiveDays] = useState(30);
  const [maxRecipients, setMaxRecipients] = useState<number | "">("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // AI writer
  const [showAI, setShowAI] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [aiLoading, setAILoading] = useState(false);
  const [industry, setIndustry] = useState("general");

  useEffect(() => {
    if (!botId) return;
    axios.get(`${API}/api/bots/${botId}`).then((r) => setIndustry((r.data.industry || "general").toLowerCase())).catch(() => {});
  }, [botId]);

  const filters: Record<string, any> = {};
  if (segment === "recent_customers") filters.days = days;
  if (segment === "inactive_customers") filters.inactive_days = inactiveDays;
  if (maxRecipients) filters.max_recipients = maxRecipients;

  const preview = async () => {
    if (!botId) return;
    setPreviewLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/campaigns/preview`, { botId, segmentType: segment, filters });
      setPreviewCount(data.count);
      setPreviewSample(data.sample || []);
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Preview failed", type: "error" });
    } finally { setPreviewLoading(false); }
  };

  const create = async () => {
    if (!tenantId || !botId || !name || !message) {
      setToast({ message: "Name and message required", type: "error" });
      return;
    }
    setCreating(true);
    try {
      const body: any = { botId, tenantId, name, message, segmentType: segment, filters };
      if (scheduleMode === "later" && scheduledAt) body.scheduledAt = new Date(scheduledAt).toISOString();
      await axios.post(`${API}/api/campaigns`, body);
      onCreated();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Create failed", type: "error" });
    } finally { setCreating(false); }
  };

  const writeWithAI = async () => {
    if (!botId) return;
    setAILoading(true);
    try {
      // Allow empty prompt — AI will generate a sensible default for the segment + industry
      const promptToUse = aiPrompt.trim() ||
        `Write a friendly, generic promotional message for this audience. Make it engaging and warm without naming a specific offer.`;
      const { data } = await axios.post(`${API}/api/campaigns/ai-write`, {
        botId, prompt: promptToUse, industry, segmentType: segment,
      });
      setMessage(data.message || "");
      setShowAI(false);
      setAIPrompt("");
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "AI write failed", type: "error" });
    } finally { setAILoading(false); }
  };

  const selectedSegment = SEGMENT_OPTIONS.find((s) => s.value === segment);
  const charCount = message.length;
  const charWarn = charCount > 160;
  const estimatedMinutes = previewCount != null ? Math.ceil(previewCount / 20) : null;

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-5xl">
      <button className="text-[13px] text-slate-500 hover:text-slate-800 mb-4" onClick={onCancel}>← Cancel</button>
      <div className="mb-8">
        <div className="page-breadcrumb">📢 New Campaign</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Create Campaign</h1>
      </div>

      {/* Step 1 */}
      <div className="card mb-6">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">1. Campaign Details</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Campaign Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Eid Sale Announcement" />
          </div>
          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="form-label !mb-0">Message</label>
              <button className="text-[12px] font-semibold text-[#1D9E75] hover:underline" onClick={() => setShowAI(!showAI)}>
                ✨ Write with AI
              </button>
            </div>
            {showAI && (
              <div className="mb-3 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                <input className="form-input mb-2" placeholder="Describe the campaign — or leave blank for a generic message"
                  value={aiPrompt} onChange={(e) => setAIPrompt(e.target.value)} />
                <div className="flex gap-2">
                  <button className="btn-primary text-[12px]" onClick={writeWithAI} disabled={aiLoading}>
                    {aiLoading ? "Writing..." : aiPrompt.trim() ? "Generate Message" : "Generate Generic Message"}
                  </button>
                  <button className="text-[12px] text-slate-500 px-2" onClick={() => setShowAI(false)}>Cancel</button>
                </div>
                <div className="text-[11px] text-slate-500 mt-2">💡 Tip: a specific prompt (e.g. "Eid sale, 20% off, 3 days only") gives much better results than blank.</div>
              </div>
            )}
            <textarea className="form-input" rows={5} maxLength={4096}
              value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Assalam o Alaikum! 🎉 Hamare naye products check karein — sirf aaj special offer hai. Reply karein DEAL likhein!" />
            <div className="text-[11px] mt-1 flex justify-between">
              <span className={charWarn ? "text-amber-700" : "text-slate-500"}>
                {charCount} / 4096 chars {charWarn && "(under 160 = best open rates)"}
              </span>
              <span className="text-slate-400">💡 Keep messages under 160 chars for best engagement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2 — segment */}
      <div className="card mb-6">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">2. Select Audience</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {SEGMENT_OPTIONS.map((opt) => {
            const active = segment === opt.value;
            return (
              <div key={opt.value}
                onClick={() => { setSegment(opt.value); setPreviewCount(null); }}
                className="rounded-xl p-3 cursor-pointer transition-all"
                style={{
                  background: active ? "rgba(29,158,117,0.08)" : "#f8fafc",
                  border: `2px solid ${active ? "#1D9E75" : "#e5e7eb"}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-[24px] shrink-0">{opt.emoji}</div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-slate-800">{opt.label}</div>
                    <div className="text-[11px] text-slate-500">{opt.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedSegment?.needsDays === "active" && (
          <div className="mb-4">
            <label className="form-label">Active in last {days} day{days === 1 ? "" : "s"}</label>
            <input type="range" min={7} max={90} step={1} value={days} onChange={(e) => { setDays(parseInt(e.target.value)); setPreviewCount(null); }} className="w-full" />
            <div className="flex justify-between text-[10px] text-slate-400"><span>7d</span><span>90d</span></div>
          </div>
        )}
        {selectedSegment?.needsDays === "inactive" && (
          <div className="mb-4">
            <label className="form-label">Haven't messaged in {inactiveDays} days</label>
            <input type="range" min={14} max={180} step={1} value={inactiveDays} onChange={(e) => { setInactiveDays(parseInt(e.target.value)); setPreviewCount(null); }} className="w-full" />
            <div className="flex justify-between text-[10px] text-slate-400"><span>14d</span><span>180d</span></div>
          </div>
        )}

        <div className="mb-4">
          <label className="form-label">Max Recipients (optional cap)</label>
          <input type="number" className="form-input" placeholder="Leave blank for all"
            value={maxRecipients} onChange={(e) => { setMaxRecipients(e.target.value ? parseInt(e.target.value) : ""); setPreviewCount(null); }} />
        </div>

        <button className="btn-secondary text-[13px]" onClick={preview} disabled={previewLoading}>
          {previewLoading ? "Counting..." : "👁 Preview Audience"}
        </button>

        {previewCount != null && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: previewCount > 0 ? "#ecfdf5" : "#fef2f2", border: `1px solid ${previewCount > 0 ? "#a7f3d0" : "#fecaca"}` }}>
            <div className="text-[14px] font-bold" style={{ color: previewCount > 0 ? "#065f46" : "#991b1b" }}>
              {previewCount > 0 ? `✓ ${previewCount} recipient${previewCount === 1 ? "" : "s"} will receive this` : "No recipients match this segment"}
            </div>
            {previewSample.length > 0 && (
              <div className="text-[11px] text-slate-500 mt-1 font-mono">Sample: {previewSample.join(", ")}</div>
            )}
          </div>
        )}
      </div>

      {/* Step 3 — schedule */}
      <div className="card mb-6">
        <h2 className="text-[16px] font-bold text-slate-800 mb-4">3. Schedule</h2>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={scheduleMode === "now"} onChange={() => setScheduleMode("now")} />
            <span className="text-[13px]">Send Now</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" checked={scheduleMode === "later"} onChange={() => setScheduleMode("later")} />
            <span className="text-[13px]">Schedule for later</span>
          </label>
        </div>
        {scheduleMode === "later" && (
          <input type="datetime-local" className="form-input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        )}
      </div>

      {/* Step 4 — review */}
      {previewCount != null && previewCount > 0 && (
        <div className="card mb-6">
          <h2 className="text-[16px] font-bold text-slate-800 mb-4">4. Review</h2>
          <div className="rounded-xl p-4 mb-4 text-[13px] text-slate-800 whitespace-pre-wrap" style={{ background: "#dcf8c6", maxWidth: 480 }}>
            {message || "<your message preview will appear here>"}
          </div>
          <div className="text-[12px] text-slate-600 space-y-1">
            <div>📤 Recipients: <b>{previewCount}</b></div>
            <div>🎯 Segment: <b>{selectedSegment?.label}</b></div>
            <div>⏰ Send time: <b>{scheduleMode === "now" ? "Immediately" : (scheduledAt ? new Date(scheduledAt).toLocaleString("en-PK") : "Not scheduled")}</b></div>
            <div>⏱ Estimated time: <b>~{estimatedMinutes} minute{estimatedMinutes === 1 ? "" : "s"}</b> at 20 msg/min</div>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button className="btn-primary" onClick={create} disabled={creating || !name || !message || previewCount == null || previewCount === 0}>
          {creating ? "Creating..." : (scheduleMode === "now" ? "🚀 Launch Campaign" : "⏰ Schedule Campaign")}
        </button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card !py-4">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[22px] font-bold" style={{ color: color || "#0f172a" }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
