"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface CRMConfig {
  crmEnabled: boolean;
  sheets: { connected: boolean; spreadsheetId: string | null };
  zapier: { connected: boolean; webhookUrl: string | null };
  triggers: string[];
}

interface ExportLog {
  id: string;
  event_type: string;
  status: string;
  error_message: string | null;
  exported_at: string | null;
  created_at: string;
}

const ALL_TRIGGERS = [
  { key: "lead", label: "Leads captured" },
  { key: "order", label: "Orders placed" },
  { key: "appointment", label: "Appointments booked" },
  { key: "enrollment", label: "Enrollments submitted" },
  { key: "booking", label: "Hotel bookings" },
  { key: "followup", label: "Follow-up conversions" },
  { key: "hot", label: "Hot leads (score ≥ 8)" },
];

const statusBadge: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#f1f5f9", color: "#475569", label: "Pending" },
  exported: { bg: "#dcfce7", color: "#166534", label: "Exported ✅" },
  failed:   { bg: "#fef2f2", color: "#b91c1c", label: "Failed" },
};

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function CRMPage() {
  const { botId } = useAuth();
  const [config, setConfig] = useState<CRMConfig | null>(null);
  const [exports, setExports] = useState<ExportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Sheets form
  const [sheetsDraft, setSheetsDraft] = useState({ spreadsheetId: "", credentials: "" });
  const [savingSheets, setSavingSheets] = useState(false);

  // Zapier form
  const [zapierUrl, setZapierUrl] = useState("");
  const [savingZapier, setSavingZapier] = useState(false);

  // Triggers
  const [triggersDraft, setTriggersDraft] = useState<string[]>([]);
  const [savingTriggers, setSavingTriggers] = useState(false);

  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    if (!botId) return;
    try {
      const [cfg, logs] = await Promise.all([
        axios.get(`${API}/api/crm/config?botId=${botId}`),
        axios.get(`${API}/api/crm/exports?botId=${botId}&limit=50`),
      ]);
      setConfig(cfg.data);
      setExports(logs.data.exports || []);
      setTriggersDraft(cfg.data.triggers || []);
      setZapierUrl(cfg.data.zapier?.webhookUrl || "");
      setSheetsDraft({ spreadsheetId: cfg.data.sheets?.spreadsheetId || "", credentials: "" });
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  const connectSheets = async () => {
    if (!botId || !sheetsDraft.spreadsheetId || !sheetsDraft.credentials) {
      setToast({ message: "Spreadsheet ID and credentials required", type: "error" });
      return;
    }
    setSavingSheets(true);
    try {
      let creds: any;
      try { creds = JSON.parse(sheetsDraft.credentials); }
      catch { setToast({ message: "Invalid JSON credentials", type: "error" }); setSavingSheets(false); return; }

      await axios.post(`${API}/api/crm/sheets/connect`, {
        botId, spreadsheetId: sheetsDraft.spreadsheetId, credentials: creds,
      });
      setToast({ message: "Google Sheets connected", type: "success" });
      setSheetsDraft({ spreadsheetId: sheetsDraft.spreadsheetId, credentials: "" });
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Connection failed", type: "error" });
    } finally { setSavingSheets(false); }
  };

  const disconnectSheets = async () => {
    if (!botId || !confirm("Disconnect Google Sheets?")) return;
    try {
      await axios.delete(`${API}/api/crm/sheets/disconnect`, { data: { botId } });
      setToast({ message: "Disconnected", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const testSheets = async () => {
    if (!botId) return;
    try {
      const { data } = await axios.post(`${API}/api/crm/sheets/test`, { botId });
      setToast({
        message: data.success ? `Connected to: ${data.title || "sheet"}` : (data.error || "Test failed"),
        type: data.success ? "success" : "error",
      });
    } catch { setToast({ message: "Test failed", type: "error" }); }
  };

  const connectZapier = async () => {
    if (!botId || !zapierUrl) return;
    setSavingZapier(true);
    try {
      await axios.post(`${API}/api/crm/zapier/connect`, { botId, webhookUrl: zapierUrl });
      setToast({ message: "Zapier connected", type: "success" }); load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed", type: "error" });
    } finally { setSavingZapier(false); }
  };

  const disconnectZapier = async () => {
    if (!botId || !confirm("Disconnect Zapier webhook?")) return;
    try {
      await axios.delete(`${API}/api/crm/zapier/disconnect`, { data: { botId } });
      setToast({ message: "Disconnected", type: "success" });
      setZapierUrl("");
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const toggleTrigger = (key: string) => {
    setTriggersDraft((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const saveTriggers = async () => {
    if (!botId) return;
    setSavingTriggers(true);
    try {
      await axios.patch(`${API}/api/crm/triggers`, { botId, triggers: triggersDraft });
      setToast({ message: "Triggers saved", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
    finally { setSavingTriggers(false); }
  };

  const toggleCRM = async (enabled: boolean) => {
    if (!botId) return;
    try {
      await axios.patch(`${API}/api/crm/toggle`, { botId, enabled });
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const runTestExport = async () => {
    if (!botId) return;
    setTesting(true);
    try {
      await axios.post(`${API}/api/crm/test-export`, { botId });
      setToast({ message: "Test export dispatched — check your sheet/Zap", type: "success" });
      setTimeout(load, 1500);
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed", type: "error" });
    } finally { setTesting(false); }
  };

  if (loading) {
    return <div className="p-3 md:p-8 animate-fade-in"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">📤 CRM & Exports</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">CRM Integration</h1>
        <p className="text-[16px] text-slate-500">Auto-export leads, orders, appointments, enrollments, and bookings to Google Sheets or Zapier.</p>
      </div>

      {/* Master toggle */}
      <div className="card mb-8 flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-slate-800">Enable CRM exports</div>
          <div className="text-[12px] text-slate-500">Turn off to stop all exports without removing credentials</div>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={!!config?.crmEnabled}
            onChange={(e) => toggleCRM(e.target.checked)}
          />
          <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config?.crmEnabled ? "translate-x-5" : ""}`} />
          </div>
        </label>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <StatusCard
          title="Google Sheets"
          connected={!!config?.sheets.connected}
          subtitle={config?.sheets.spreadsheetId ? `Sheet: ${config.sheets.spreadsheetId.slice(0, 14)}…` : "Not configured"}
          icon="📊"
        />
        <StatusCard
          title="Zapier"
          connected={!!config?.zapier.connected}
          subtitle={config?.zapier.connected ? "Webhook active" : "Not configured"}
          icon="⚡"
        />
      </div>

      {/* Google Sheets form */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-1">📊 Google Sheets</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Share the spreadsheet with your service account's <b>client_email</b>.
          Get credentials from Google Cloud Console → IAM → Service Accounts → Keys → Add JSON key.
        </p>

        <div className="space-y-4">
          <div>
            <label className="form-label">Spreadsheet ID</label>
            <input
              type="text"
              className="form-input font-mono text-[12px]"
              placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              value={sheetsDraft.spreadsheetId}
              onChange={(e) => setSheetsDraft({ ...sheetsDraft, spreadsheetId: e.target.value })}
            />
            <div className="text-[11px] text-slate-400 mt-1">
              Find it in your sheet URL: /spreadsheets/d/<b>SPREADSHEET_ID</b>/edit
            </div>
          </div>

          <div>
            <label className="form-label">
              Service Account JSON {config?.sheets.connected && <span className="text-green-600">(connected — paste again to update)</span>}
            </label>
            <textarea
              className="form-input font-mono text-[11px]"
              rows={6}
              placeholder='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'
              value={sheetsDraft.credentials}
              onChange={(e) => setSheetsDraft({ ...sheetsDraft, credentials: e.target.value })}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary text-[13px]" onClick={connectSheets} disabled={savingSheets}>
              {savingSheets ? "Connecting..." : config?.sheets.connected ? "Update" : "Connect"}
            </button>
            {config?.sheets.connected && (
              <>
                <button className="btn-secondary text-[13px]" onClick={testSheets}>Test Connection</button>
                <button className="text-[13px] text-red-600 hover:text-red-700 px-3" onClick={disconnectSheets}>Disconnect</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Zapier form */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-1">⚡ Zapier Webhook</h2>
        <p className="text-[12px] text-slate-500 mb-4">
          Create a Zap with "Webhooks by Zapier" trigger → Catch Hook. Paste the webhook URL below.
        </p>

        <div className="space-y-4">
          <div>
            <label className="form-label">Webhook URL</label>
            <input
              type="text"
              className="form-input font-mono text-[12px]"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={zapierUrl}
              onChange={(e) => setZapierUrl(e.target.value)}
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            <button className="btn-primary text-[13px]" onClick={connectZapier} disabled={savingZapier || !zapierUrl}>
              {savingZapier ? "Connecting..." : config?.zapier.connected ? "Update" : "Connect"}
            </button>
            {config?.zapier.connected && (
              <button className="text-[13px] text-red-600 hover:text-red-700 px-3" onClick={disconnectZapier}>Disconnect</button>
            )}
          </div>
        </div>
      </div>

      {/* Triggers */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-1">🎯 Export Triggers</h2>
        <p className="text-[12px] text-slate-500 mb-4">Choose which events export to your CRM.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
          {ALL_TRIGGERS.map((t) => {
            const checked = triggersDraft.includes(t.key);
            return (
              <label key={t.key}
                className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors"
                style={{
                  background: checked ? "rgba(29,158,117,0.08)" : "#f8fafc",
                  border: `1px solid ${checked ? "rgba(29,158,117,0.3)" : "#e5e7eb"}`,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleTrigger(t.key)}
                  className="w-4 h-4"
                />
                <span className="text-[13px] font-medium text-slate-700">{t.label}</span>
              </label>
            );
          })}
        </div>

        <button className="btn-primary text-[13px]" onClick={saveTriggers} disabled={savingTriggers}>
          {savingTriggers ? "Saving..." : "Save Triggers"}
        </button>
      </div>

      {/* Recent exports */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-slate-800">📜 Recent Exports</h2>
          <button
            className="btn-secondary text-[12px]"
            onClick={runTestExport}
            disabled={testing || (!config?.sheets.connected && !config?.zapier.connected)}
          >
            {testing ? "Running..." : "Run Test Export"}
          </button>
        </div>

        {exports.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">
            No exports yet. They'll appear here as your bot captures leads, orders, and bookings.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Error</th>
                  <th className="py-2 pr-3">When</th>
                </tr>
              </thead>
              <tbody>
                {exports.map((log) => {
                  const sb = statusBadge[log.status] || { bg: "#f1f5f9", color: "#475569", label: log.status };
                  return (
                    <tr key={log.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-700">{log.event_type}</td>
                      <td className="py-2 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>
                      </td>
                      <td className="py-2 pr-3 text-red-600 max-w-[320px] truncate text-[11px]">{log.error_message || ""}</td>
                      <td className="py-2 pr-3 text-slate-500 text-[11px]">
                        {timeAgo(log.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function StatusCard({ title, connected, subtitle, icon }: { title: string; connected: boolean; subtitle: string; icon: string }) {
  return (
    <div className="card !py-4">
      <div className="flex items-start gap-3">
        <div className="text-[28px]">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-[15px] font-bold text-slate-800">{title}</div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: connected ? "#dcfce7" : "#f1f5f9",
                color: connected ? "#166534" : "#475569",
              }}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <div className="text-[12px] text-slate-500 truncate">{subtitle}</div>
        </div>
      </div>
    </div>
  );
}
