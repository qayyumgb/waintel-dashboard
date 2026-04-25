"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Lead {
  id: string;
  bot_id: string;
  bot_name: string;
  customer_phone: string;
  industry: string;
  qualification_data: any;
  lead_score: number;
  lead_label: "hot" | "warm" | "cold";
  score_reasoning: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  owner_notified: boolean;
  sheets_exported: boolean;
  qualified_at: string | null;
  updated_at: string;
  re_budget_min: string | null;
  re_area: string | null;
  re_property_type: string | null;
  re_timeline: string | null;
  re_purpose: string | null;
  edu_course_interest: string | null;
  edu_qualification: string | null;
  edu_budget: string | null;
  edu_timeline: string | null;
  edu_location: string | null;
  eco_product_interest: string | null;
  eco_budget: string | null;
  eco_size: string | null;
  hc_symptoms: string | null;
  hc_urgency: string | null;
  hc_preferred_doctor: string | null;
  hc_insurance: string | null;
}

interface Stats {
  total: number;
  hot: number;
  warm: number;
  cold: number;
  avg_score: number;
  notified: number;
  exported: number;
}

interface Settings {
  lead_qualification_enabled: boolean;
  lead_hot_threshold: number;
  lead_warm_threshold: number;
  lead_owner_alert_phone: string | null;
  lead_auto_export: boolean;
}

const LABEL_STYLES = {
  hot:  { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", accent: "#ef4444", icon: "🔥", label: "Hot" },
  warm: { bg: "#fef3c7", border: "#fde68a", text: "#92400e", accent: "#f59e0b", icon: "⚡", label: "Warm" },
  cold: { bg: "#dbeafe", border: "#bfdbfe", text: "#1e40af", accent: "#3b82f6", icon: "❄️", label: "Cold" },
};

const STATUS_OPTIONS = ["new", "contacted", "qualified", "converted", "lost"];

function maskPhone(p: string): string {
  if (!p) return "";
  if (p.startsWith("92") && p.length >= 12) return `0${p.slice(2, 5)}-XXX-${p.slice(-4)}`;
  if (p.length >= 8) return `${p.slice(0, 4)}-XXX-${p.slice(-4)}`;
  return p;
}

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function leadKeyData(lead: Lead): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const push = (l: string, v: any) => { if (v) out.push({ label: l, value: String(v) }); };
  // Real estate
  push("Area", lead.re_area);
  if (lead.re_budget_min) push("Budget", `Rs. ${Number(lead.re_budget_min).toLocaleString("en-PK")}+`);
  push("Type", lead.re_property_type);
  push("Timeline", lead.re_timeline);
  // Education
  push("Course", lead.edu_course_interest);
  push("Qualification", lead.edu_qualification);
  // Ecommerce
  push("Product", lead.eco_product_interest);
  push("Size", lead.eco_size);
  // Healthcare
  push("Symptoms", lead.hc_symptoms);
  push("Urgency", lead.hc_urgency);
  return out.slice(0, 3);
}

export default function LeadsPage() {
  const { tenantId, botId } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [editDraft, setEditDraft] = useState<{ status: string; assignedTo: string; notes: string }>({ status: "new", assignedTo: "", notes: "" });
  const [savingDraft, setSavingDraft] = useState(false);
  const [requalifying, setRequalifying] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [l, s] = await Promise.all([
        axios.get(`${API}/api/leads?tenantId=${tenantId}&limit=200`),
        axios.get(`${API}/api/leads/stats?tenantId=${tenantId}&days=30`),
      ]);
      setLeads(l.data.leads || []);
      setStats(s.data.stats || null);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadSettings = useCallback(async () => {
    if (!botId) return;
    try {
      const { data } = await axios.get(`${API}/api/bots/${botId}`);
      setSettings({
        lead_qualification_enabled: !!data.lead_qualification_enabled,
        lead_hot_threshold: data.lead_hot_threshold ?? 8,
        lead_warm_threshold: data.lead_warm_threshold ?? 5,
        lead_owner_alert_phone: data.lead_owner_alert_phone || "",
        lead_auto_export: data.lead_auto_export ?? true,
      });
    } catch { /* silent */ }
  }, [botId]);

  useEffect(() => { load(); loadSettings(); }, [load, loadSettings]);

  const openLead = (lead: Lead) => {
    setSelected(lead);
    setEditDraft({
      status: lead.status || "new",
      assignedTo: lead.assigned_to || "",
      notes: lead.notes || "",
    });
  };

  const saveLead = async () => {
    if (!selected) return;
    setSavingDraft(true);
    try {
      await axios.patch(`${API}/api/leads/${selected.id}`, editDraft);
      setToast({ message: "Lead updated", type: "success" });
      load();
    } catch { setToast({ message: "Save failed", type: "error" }); }
    finally { setSavingDraft(false); }
  };

  const requalify = async () => {
    if (!selected) return;
    setRequalifying(true);
    try {
      const { data } = await axios.post(`${API}/api/leads/${selected.id}/requalify`);
      const newScore = data?.result?.leadScore;
      const newLabel = data?.result?.leadLabel;
      setToast({
        message: newScore != null
          ? `Re-qualified: ${newScore}/10 (${newLabel})`
          : "Re-qualified by AI",
        type: "success",
      });
      load();
      setSelected(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || "Re-qualify failed";
      setToast({ message: `Re-qualify failed: ${msg}`, type: "error" });
      console.error("Re-qualify error:", err);
    } finally { setRequalifying(false); }
  };

  const saveSettings = async (next: Partial<Settings>) => {
    if (!botId || !settings) return;
    const updated = { ...settings, ...next };
    setSettings(updated);
    setSavingSettings(true);
    try {
      await axios.patch(`${API}/api/leads/settings`, {
        botId,
        leadQualificationEnabled: updated.lead_qualification_enabled,
        leadHotThreshold: updated.lead_hot_threshold,
        leadWarmThreshold: updated.lead_warm_threshold,
        leadOwnerAlertPhone: updated.lead_owner_alert_phone,
        leadAutoExport: updated.lead_auto_export,
      });
      setToast({ message: "Settings saved", type: "success" });
    } catch { setToast({ message: "Save failed", type: "error" }); }
    finally { setSavingSettings(false); }
  };

  if (loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  const hotLeads = leads.filter((l) => l.lead_label === "hot");
  const warmLeads = leads.filter((l) => l.lead_label === "warm");
  const coldLeads = leads.filter((l) => l.lead_label === "cold");

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-7xl">
      <div className="mb-8">
        <div className="page-breadcrumb">🎯 Lead Qualification</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Leads Pipeline</h1>
        <p className="text-[16px] text-slate-500">AI scores every conversation 1-10 and labels customers Hot, Warm, or Cold. Hot leads auto-alert you and export to your CRM.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPI label="🔥 Hot Leads" value={String(stats?.hot ?? 0)} color="#dc2626" />
        <KPI label="⚡ Warm Leads" value={String(stats?.warm ?? 0)} color="#d97706" />
        <KPI label="❄️ Cold Leads" value={String(stats?.cold ?? 0)} color="#2563eb" />
        <KPI label="📊 Avg Score" value={`${stats?.avg_score ?? 0}/10`} color={stats && stats.avg_score >= 7 ? "#047857" : "#0f172a"} />
      </div>

      {/* Pipeline kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Column title="Hot" emoji="🔥" leads={hotLeads} onOpen={openLead} accent="#ef4444" empty="No hot leads yet. They auto-appear when AI scores ≥ 8." />
        <Column title="Warm" emoji="⚡" leads={warmLeads} onOpen={openLead} accent="#f59e0b" empty="No warm leads. AI marks score 5-7 as warm." />
        <Column title="Cold" emoji="❄️" leads={coldLeads} onOpen={openLead} accent="#3b82f6" empty="No cold leads (score < 5)." />
      </div>

      {/* Settings */}
      {settings && (
        <div className="card">
          <h2 className="text-[18px] font-bold text-slate-800 mb-4">⚙️ Lead Qualification Settings</h2>

          <label className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid #e5e7eb" }}>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Enable Lead Qualification</div>
              <div className="text-[11px] text-slate-500">AI scores every conversation and tracks lead quality</div>
            </div>
            <input type="checkbox" className="sr-only peer"
              checked={settings.lead_qualification_enabled}
              onChange={(e) => saveSettings({ lead_qualification_enabled: e.target.checked })}
              disabled={savingSettings} />
            <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.lead_qualification_enabled ? "translate-x-5" : ""}`} />
            </div>
          </label>

          {settings.lead_qualification_enabled && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="form-label">🔥 Hot Lead Threshold (score ≥)</label>
                  <input type="range" min="6" max="10" value={settings.lead_hot_threshold}
                    onChange={(e) => setSettings({ ...settings, lead_hot_threshold: parseInt(e.target.value) })}
                    onMouseUp={() => saveSettings({ lead_hot_threshold: settings.lead_hot_threshold })}
                    className="w-full" />
                  <div className="text-[12px] text-slate-600 mt-1">Score ≥ <b>{settings.lead_hot_threshold}</b> = hot (owner alerted, auto-exported)</div>
                </div>
                <div>
                  <label className="form-label">⚡ Warm Lead Threshold (score ≥)</label>
                  <input type="range" min="3" max="7" value={settings.lead_warm_threshold}
                    onChange={(e) => setSettings({ ...settings, lead_warm_threshold: parseInt(e.target.value) })}
                    onMouseUp={() => saveSettings({ lead_warm_threshold: settings.lead_warm_threshold })}
                    className="w-full" />
                  <div className="text-[12px] text-slate-600 mt-1">Score ≥ <b>{settings.lead_warm_threshold}</b> = warm</div>
                </div>
              </div>

              <div>
                <label className="form-label">📞 Owner Alert Phone (WhatsApp)</label>
                <input className="form-input"
                  placeholder="923001234567 (international format, no +)"
                  value={settings.lead_owner_alert_phone || ""}
                  onChange={(e) => setSettings({ ...settings, lead_owner_alert_phone: e.target.value })}
                  onBlur={() => saveSettings({ lead_owner_alert_phone: settings.lead_owner_alert_phone })}
                />
                <div className="text-[11px] text-slate-500 mt-1">Get an instant WhatsApp message every time a hot lead is captured. Leave blank to disable alerts.</div>
              </div>

              <label className="flex items-center justify-between p-3 rounded-xl cursor-pointer" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                <div>
                  <div className="text-[13px] font-semibold text-slate-800">Auto-export hot leads to CRM</div>
                  <div className="text-[11px] text-slate-500">Push hot leads to Google Sheets / Zapier instantly (requires CRM integration enabled)</div>
                </div>
                <input type="checkbox" className="sr-only peer"
                  checked={settings.lead_auto_export}
                  onChange={(e) => saveSettings({ lead_auto_export: e.target.checked })} />
                <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.lead_auto_export ? "translate-x-5" : ""}`} />
                </div>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Lead detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[20px]">{LABEL_STYLES[selected.lead_label].icon}</span>
                    <span className="text-[12px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                      style={{ background: LABEL_STYLES[selected.lead_label].bg, color: LABEL_STYLES[selected.lead_label].text }}>
                      {LABEL_STYLES[selected.lead_label].label} Lead
                    </span>
                    {selected.owner_notified && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Owner notified</span>}
                    {selected.sheets_exported && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">✓ Exported</span>}
                  </div>
                  <h2 className="text-[22px] font-bold text-slate-900">{selected.customer_phone}</h2>
                  <div className="text-[13px] text-slate-500 mt-1">{selected.bot_name} · {selected.industry || "general"}</div>
                </div>
                <button className="text-slate-400 hover:text-slate-700 text-[24px] leading-none" onClick={() => setSelected(null)}>×</button>
              </div>

              <div className="mt-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-[12px] font-semibold text-slate-500 uppercase">Score</div>
                  <div className="text-[28px] font-bold" style={{ color: LABEL_STYLES[selected.lead_label].accent }}>{selected.lead_score}/10</div>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${selected.lead_score * 10}%`, background: LABEL_STYLES[selected.lead_label].accent }} />
                </div>
              </div>

              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500 uppercase mb-1">AI Reasoning</div>
                <div className="text-[13px] text-slate-700">{selected.score_reasoning || "No reasoning provided"}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Left — qualification data */}
              <div>
                <h3 className="text-[14px] font-bold text-slate-800 mb-3">📋 Qualification Data</h3>
                <div className="space-y-2 text-[13px]">
                  {leadKeyData(selected).length === 0 ? (
                    <div className="text-slate-400 italic">No structured fields extracted yet.</div>
                  ) : (
                    leadKeyData(selected).map((kv) => (
                      <div key={kv.label} className="flex justify-between gap-3 p-2 rounded bg-slate-50">
                        <span className="text-slate-500 font-medium">{kv.label}</span>
                        <span className="text-slate-800 text-right max-w-[200px]">{kv.value}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right — manage */}
              <div>
                <h3 className="text-[14px] font-bold text-slate-800 mb-3">📝 Manage</h3>
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-input"
                      value={editDraft.status}
                      onChange={(e) => setEditDraft({ ...editDraft, status: e.target.value })}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Assigned To</label>
                    <input className="form-input" placeholder="Sales rep name"
                      value={editDraft.assignedTo}
                      onChange={(e) => setEditDraft({ ...editDraft, assignedTo: e.target.value })} />
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={3} placeholder="Internal notes..."
                      value={editDraft.notes}
                      onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex flex-wrap gap-3 justify-between">
              <div className="flex gap-2 flex-wrap">
                <button className="btn-secondary text-[13px]" onClick={requalify} disabled={requalifying}>
                  {requalifying ? "Re-scoring..." : "🔄 Re-qualify with AI"}
                </button>
                <a className="btn-secondary text-[13px]" href={`https://wa.me/${selected.customer_phone}`} target="_blank" rel="noreferrer">
                  📱 Open WhatsApp
                </a>
              </div>
              <button className="btn-primary text-[13px]" onClick={saveLead} disabled={savingDraft}>
                {savingDraft ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card !py-4">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[24px] font-bold" style={{ color: color || "#0f172a" }}>{value}</div>
    </div>
  );
}

function Column({ title, emoji, leads, onOpen, accent, empty }: { title: string; emoji: string; leads: Lead[]; onOpen: (l: Lead) => void; accent: string; empty: string }) {
  return (
    <div className="card !p-4 flex flex-col" style={{ minHeight: 200 }}>
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
        <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
          <span>{emoji}</span> {title}
        </h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: accent + "20", color: accent }}>
          {leads.length}
        </span>
      </div>
      {leads.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-[12px] italic flex-1 flex items-center justify-center">{empty}</div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: 600 }}>
          {leads.map((lead) => {
            const style = LABEL_STYLES[lead.lead_label];
            const data = leadKeyData(lead);
            return (
              <div key={lead.id}
                className="rounded-lg p-3 cursor-pointer transition-all hover:shadow-md"
                style={{ background: style.bg, border: `1px solid ${style.border}` }}
                onClick={() => onOpen(lead)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-[12px]" style={{ color: style.text }}>{maskPhone(lead.customer_phone)}</span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: style.accent, color: "#fff" }}>
                    {lead.lead_score}/10
                  </span>
                </div>
                {data.length > 0 && (
                  <div className="text-[11px] mb-1.5" style={{ color: style.text }}>
                    {data.map((kv) => `${kv.label}: ${kv.value}`).join(" · ")}
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] opacity-70" style={{ color: style.text }}>
                  <span>{lead.industry || "general"}</span>
                  <span>{timeAgo(lead.updated_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
