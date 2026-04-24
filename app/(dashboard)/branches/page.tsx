"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Branch {
  id: string;
  name: string;
  branch_code: string | null;
  city: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  manager_name: string | null;
  timings: string | null;
  is_open_24h: boolean;
  days_open: string;
  is_active: boolean;
  services: string | null;
  routes_this_week: number;
}

interface Knowledge {
  id: string;
  topic: string | null;
  content: string;
}

interface RoutingStat {
  branch: string;
  city: string;
  total_routes: number;
  fallbacks: number;
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
}

interface BotSettings {
  multi_location_enabled: boolean;
  location_detection_mode: string;
  default_branch_id: string | null;
  routing_fallback_message: string | null;
}

const BRANCH_DRAFT_EMPTY = {
  name: "", branchCode: "", city: "", area: "",
  address: "", phone: "", whatsapp: "", managerName: "",
  timings: "", isOpen24h: false, daysOpen: "Mon-Sun", services: "",
};

export default function BranchesPage() {
  const { botId, tenantId } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState<RoutingStat[]>([]);
  const [settings, setSettings] = useState<BotSettings>({
    multi_location_enabled: false,
    location_detection_mode: "ai",
    default_branch_id: null,
    routing_fallback_message: "",
  });
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState(BRANCH_DRAFT_EMPTY);
  const [saving, setSaving] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [knowledgeMap, setKnowledgeMap] = useState<Record<string, Knowledge[]>>({});
  const [knowledgeDraft, setKnowledgeDraft] = useState<{ topic: string; content: string }>({ topic: "", content: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    try {
      const [b, s, bot] = await Promise.all([
        axios.get(`${API}/api/branches?botId=${botId}`),
        axios.get(`${API}/api/branches/routing-stats?botId=${botId}&days=30`),
        axios.get(`${API}/api/bots/${botId}`),
      ]);
      setBranches(b.data.branches || []);
      setStats(s.data.stats || []);
      setSettings({
        multi_location_enabled: !!bot.data.multi_location_enabled,
        location_detection_mode: bot.data.location_detection_mode || "ai",
        default_branch_id: bot.data.default_branch_id || null,
        routing_fallback_message: bot.data.routing_fallback_message || "",
      });
    } catch (err) { /* silent */ } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async (next: Partial<BotSettings>) => {
    if (!botId) return;
    setSavingSettings(true);
    const updated = { ...settings, ...next };
    setSettings(updated);
    try {
      await axios.patch(`${API}/api/branches/settings`, {
        botId,
        multiLocationEnabled: updated.multi_location_enabled,
        locationDetectionMode: updated.location_detection_mode,
        defaultBranchId: updated.default_branch_id,
        routingFallbackMessage: updated.routing_fallback_message,
      });
      setToast({ message: "Settings saved", type: "success" });
    } catch {
      setToast({ message: "Save failed", type: "error" });
    } finally { setSavingSettings(false); }
  };

  const addBranch = async () => {
    if (!botId || !tenantId || !draft.name || !draft.city) {
      setToast({ message: "Name and city required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/api/branches`, { botId, tenantId, ...draft });
      setToast({ message: "Branch added", type: "success" });
      setDraft(BRANCH_DRAFT_EMPTY);
      setShowAdd(false);
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      await axios.patch(`${API}/api/branches/${id}`, { isActive: !current });
      load();
    } catch { setToast({ message: "Toggle failed", type: "error" }); }
  };

  const removeBranch = async (id: string, name: string) => {
    if (!confirm(`Deactivate ${name}?`)) return;
    try {
      await axios.delete(`${API}/api/branches/${id}`);
      setToast({ message: "Deactivated", type: "success" });
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const expandBranch = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setKnowledgeDraft({ topic: "", content: "" });
    if (!knowledgeMap[id]) {
      try {
        const { data } = await axios.get(`${API}/api/branches/${id}/knowledge`);
        setKnowledgeMap((prev) => ({ ...prev, [id]: data.knowledge || [] }));
      } catch { /* silent */ }
    }
  };

  const addKnowledge = async (branchId: string) => {
    if (!botId || !tenantId || !knowledgeDraft.content) {
      setToast({ message: "Content required", type: "error" });
      return;
    }
    try {
      const { data } = await axios.post(`${API}/api/branches/${branchId}/knowledge`, {
        botId, tenantId, ...knowledgeDraft,
      });
      setKnowledgeMap((prev) => ({
        ...prev,
        [branchId]: [...(prev[branchId] || []), data.knowledge],
      }));
      setKnowledgeDraft({ topic: "", content: "" });
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const removeKnowledge = async (branchId: string, knowledgeId: string) => {
    try {
      await axios.delete(`${API}/api/branches/${branchId}/knowledge/${knowledgeId}`);
      setKnowledgeMap((prev) => ({
        ...prev,
        [branchId]: (prev[branchId] || []).filter((k) => k.id !== knowledgeId),
      }));
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  if (loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">📍 Multi-Location</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Branches & Routing</h1>
        <p className="text-[16px] text-slate-500">One WhatsApp number, multiple branches. AI detects customer location and routes to the nearest branch.</p>
      </div>

      {/* Settings */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">⚙️ Settings</h2>

        <label className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid #e5e7eb" }}>
          <div>
            <div className="text-[13px] font-semibold text-slate-800">Enable Multi-Location Routing</div>
            <div className="text-[11px] text-slate-500">Turn this ON if your business has multiple branches</div>
          </div>
          <input type="checkbox" className="sr-only peer"
            checked={settings.multi_location_enabled}
            onChange={(e) => saveSettings({ multi_location_enabled: e.target.checked })}
            disabled={savingSettings}
          />
          <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.multi_location_enabled ? "translate-x-5" : ""}`} />
          </div>
        </label>

        {settings.multi_location_enabled && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Location Detection Mode</label>
              <select className="form-input"
                value={settings.location_detection_mode}
                onChange={(e) => saveSettings({ location_detection_mode: e.target.value })}>
                <option value="ai">AI (recommended) — handles indirect mentions</option>
                <option value="keyword">Keywords only — faster, less accurate</option>
              </select>
            </div>
            <div>
              <label className="form-label">Default Branch (when location unknown)</label>
              <select className="form-input"
                value={settings.default_branch_id || ""}
                onChange={(e) => saveSettings({ default_branch_id: e.target.value || null })}>
                <option value="">First branch alphabetically</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Fallback Message (when no branch matches)</label>
              <textarea className="form-input" rows={2}
                value={settings.routing_fallback_message || ""}
                placeholder="Apna area batayein aur hum nearest branch se connect karenge"
                onChange={(e) => setSettings({ ...settings, routing_fallback_message: e.target.value })}
                onBlur={() => saveSettings({ routing_fallback_message: settings.routing_fallback_message })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Branch list */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-slate-800">🏪 Branches ({branches.length})</h2>
          <button className="btn-primary text-[13px]" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? "Cancel" : "+ Add Branch"}
          </button>
        </div>

        {showAdd && (
          <div className="rounded-xl p-4 mb-5" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid rgba(29,158,117,0.2)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="form-label">Branch Name *</label><input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="DHA Branch" /></div>
              <div><label className="form-label">Branch Code</label><input className="form-input" value={draft.branchCode} onChange={(e) => setDraft({ ...draft, branchCode: e.target.value })} placeholder="KHI-DHA-01" /></div>
              <div><label className="form-label">City *</label><input className="form-input" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="Karachi" /></div>
              <div><label className="form-label">Area / Neighborhood</label><input className="form-input" value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} placeholder="DHA Phase 5" /></div>
              <div className="md:col-span-2"><label className="form-label">Full Address</label><input className="form-input" value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Shop 12, Bukhari Commercial DHA Phase 5" /></div>
              <div><label className="form-label">Phone</label><input className="form-input" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="021-35244001" /></div>
              <div><label className="form-label">WhatsApp (optional)</label><input className="form-input" value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} /></div>
              <div><label className="form-label">Manager Name</label><input className="form-input" value={draft.managerName} onChange={(e) => setDraft({ ...draft, managerName: e.target.value })} /></div>
              <div><label className="form-label">Timings</label><input className="form-input" value={draft.timings} onChange={(e) => setDraft({ ...draft, timings: e.target.value })} placeholder="9am-11pm" /></div>
              <div><label className="form-label">Days Open</label><input className="form-input" value={draft.daysOpen} onChange={(e) => setDraft({ ...draft, daysOpen: e.target.value })} placeholder="Mon-Sun" /></div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draft.isOpen24h} onChange={(e) => setDraft({ ...draft, isOpen24h: e.target.checked })} />
                  <span className="text-[13px] text-slate-700">Open 24 Hours</span>
                </label>
              </div>
              <div className="md:col-span-2"><label className="form-label">Services</label><textarea className="form-input" rows={2} value={draft.services} onChange={(e) => setDraft({ ...draft, services: e.target.value })} placeholder="Pharmacy, Lab tests, Home delivery" /></div>
            </div>
            <div className="mt-4">
              <button className="btn-primary text-[13px]" onClick={addBranch} disabled={saving}>
                {saving ? "Saving..." : "Save Branch"}
              </button>
            </div>
          </div>
        )}

        {branches.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No branches yet. Add your first branch to enable multi-location routing.</div>
        ) : (
          <div className="space-y-2">
            {branches.map((b) => {
              const expanded = expandedId === b.id;
              return (
                <div key={b.id} className="rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50" onClick={() => expandBranch(b.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 text-[14px]">{b.name}</span>
                        {b.is_open_24h && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">24/7</span>}
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{b.city}</span>
                        {!b.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">Inactive</span>}
                      </div>
                      <div className="text-[12px] text-slate-500 truncate">{b.area} · {b.address}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[18px] font-bold text-slate-700">{b.routes_this_week}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">routes/wk</div>
                    </div>
                    <button className="text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); expandBranch(b.id); }}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {expanded && (
                    <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
                        <div><span className="text-slate-400">Phone:</span> <span className="text-slate-700">{b.phone || "—"}</span></div>
                        <div><span className="text-slate-400">WhatsApp:</span> <span className="text-slate-700">{b.whatsapp || "—"}</span></div>
                        <div><span className="text-slate-400">Manager:</span> <span className="text-slate-700">{b.manager_name || "—"}</span></div>
                        <div><span className="text-slate-400">Hours:</span> <span className="text-slate-700">{b.timings || "—"}</span></div>
                        <div><span className="text-slate-400">Days:</span> <span className="text-slate-700">{b.days_open}</span></div>
                        <div><span className="text-slate-400">Services:</span> <span className="text-slate-700">{b.services || "—"}</span></div>
                      </div>

                      <div className="border-t border-slate-200 pt-3">
                        <div className="font-semibold text-slate-700 text-[13px] mb-2">📚 Branch-specific knowledge</div>
                        {(knowledgeMap[b.id] || []).length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic mb-3">No knowledge added. Use this for branch-specific info (parking, special offers, contact people, etc.)</div>
                        ) : (
                          <div className="space-y-1 mb-3">
                            {(knowledgeMap[b.id] || []).map((k) => (
                              <div key={k.id} className="flex items-start gap-2 text-[12px] p-2 rounded bg-white border border-slate-200">
                                <div className="flex-1">
                                  {k.topic && <span className="font-semibold text-slate-700">{k.topic}: </span>}
                                  <span className="text-slate-600">{k.content}</span>
                                </div>
                                <button className="text-red-500 text-[11px]" onClick={() => removeKnowledge(b.id, k.id)}>×</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <input className="form-input text-[12px] flex-1 min-w-[100px]" placeholder="Topic (e.g. Parking)"
                            value={knowledgeDraft.topic} onChange={(e) => setKnowledgeDraft({ ...knowledgeDraft, topic: e.target.value })} />
                          <input className="form-input text-[12px] flex-[2] min-w-[200px]" placeholder="Free parking behind the building"
                            value={knowledgeDraft.content} onChange={(e) => setKnowledgeDraft({ ...knowledgeDraft, content: e.target.value })} />
                          <button className="btn-secondary text-[12px]" onClick={() => addKnowledge(b.id)}>Add</button>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-3 flex gap-3 justify-end">
                        <button className="text-[11px] text-slate-500 hover:text-slate-700" onClick={() => toggleActive(b.id, b.is_active)}>
                          {b.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button className="text-[11px] text-red-500 hover:text-red-700" onClick={() => removeBranch(b.id, b.name)}>Remove</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Routing analytics */}
      <div className="card">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">📊 Routing Analytics — Last 30 Days</h2>
        {stats.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No routing data yet. Once customers message your bot with location keywords, you'll see routing analytics here.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Detected City</th>
                  <th className="py-2 pr-3 text-right">Total Routes</th>
                  <th className="py-2 pr-3 text-right">Fallbacks</th>
                  <th className="py-2 pr-3 text-right">Confidence (H/M/L)</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-700">{s.branch}</td>
                    <td className="py-2 pr-3 text-slate-500">{s.city || "—"}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-slate-700">{s.total_routes}</td>
                    <td className="py-2 pr-3 text-right text-orange-600">{s.fallbacks}</td>
                    <td className="py-2 pr-3 text-right text-[11px]">
                      <span className="text-green-700 font-bold">{s.high_confidence}</span>
                      {" / "}
                      <span className="text-amber-700">{s.medium_confidence}</span>
                      {" / "}
                      <span className="text-slate-400">{s.low_confidence}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
