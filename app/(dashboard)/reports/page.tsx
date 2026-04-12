"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface DailyReport {
  id: string;
  report_date: string;
  total_conversations: number;
  new_conversations: number;
  total_messages: number;
  orders_placed: number;
  revenue: string;
  top_questions: string[];
  busiest_hour: number | null;
  follow_ups_sent: number;
  follow_ups_recovered: number;
  ai_insight: string | null;
  report_sent_at: string | null;
  created_at: string;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-PK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(d: string | null): string {
  if (!d) return "Not sent";
  return new Date(d).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" });
}

export default function ReportsPage() {
  const { botId } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [rangeModal, setRangeModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    try {
      const r = await axios.get(`${API}/api/reports?botId=${botId}&limit=30`);
      setReports(r.data.reports || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  const sendNow = async () => {
    if (!botId) return;
    setSending(true);
    try {
      const r = await axios.post(`${API}/api/reports/send-now`, { botId });
      setToast({ message: r.data.message || "Report sent!", type: "success" });
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed to send report", type: "error" });
    } finally {
      setSending(false);
    }
  };

  const generateRange = async (fromDate: string, toDate: string) => {
    if (!botId) return;
    setSending(true);
    try {
      const r = await axios.post(`${API}/api/reports/send-now`, { botId, fromDate, toDate });
      setToast({ message: r.data.message || "Reports generated", type: "success" });
      setRangeModal(false);
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed to generate reports", type: "error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-4xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="page-breadcrumb">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Reports
          </div>
          <h1 className="text-[28px] font-bold text-slate-900 mb-2">Business Reports</h1>
          <p className="text-[16px] text-slate-500">Daily snapshots of your WhatsApp bot's performance with AI-generated insights.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-[13px]"
            onClick={() => setRangeModal(true)}
            disabled={sending || !botId}
          >
            Generate Range
          </button>
          <button
            className="btn-primary text-[13px]"
            onClick={sendNow}
            disabled={sending || !botId}
          >
            {sending ? "Sending..." : "Send Now"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-16 text-slate-400">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(29,158,117,0.08)" }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
            </svg>
          </div>
          <p className="text-[14px] text-slate-500 font-medium">No reports yet</p>
          <p className="text-[12px] text-slate-400 mt-1">Enable daily reports in Bot Setup or click "Send Now" to generate one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <div key={r.id} className="card !p-0 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-800">{formatDate(r.report_date)}</h3>
                      <div className="text-[12px] text-slate-500 mt-1">
                        💬 {r.total_conversations} conversations · 🛒 {r.orders_placed} orders · 💰 Rs. {Number(r.revenue || 0).toLocaleString("en-PK")}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        {r.report_sent_at ? `✅ Sent ${formatTime(r.report_sent_at)}` : "⏳ Not sent"}
                      </div>
                    </div>
                    <button
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
                      style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}
                      onClick={() => setExpanded(isOpen ? null : r.id)}
                    >
                      {isOpen ? "Hide" : "View Full Report ▾"}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <Stat label="New customers" value={String(r.new_conversations)} />
                        <Stat label="Messages" value={String(r.total_messages)} />
                        <Stat label="Busiest hour" value={r.busiest_hour !== null ? `${r.busiest_hour}:00` : "—"} />
                        <Stat label="Follow-ups" value={`${r.follow_ups_sent} sent · ${r.follow_ups_recovered} recovered`} />
                      </div>

                      {r.top_questions && r.top_questions.length > 0 && (
                        <div className="mb-4">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Top customer questions</div>
                          <ul className="text-[13px] text-slate-700 space-y-1 list-decimal pl-5">
                            {r.top_questions.map((q, i) => <li key={i}>{q}</li>)}
                          </ul>
                        </div>
                      )}

                      {r.ai_insight && (
                        <div className="p-3 rounded-xl" style={{ background: "rgba(29,158,117,0.06)", border: "1px solid rgba(29,158,117,0.2)" }}>
                          <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#047857" }}>💡 AI Insight</div>
                          <p className="text-[13px] text-slate-700 leading-relaxed">{r.ai_insight}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rangeModal && (
        <DateRangeModal
          onCancel={() => setRangeModal(false)}
          onConfirm={generateRange}
          sending={sending}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Date Range Modal ───────────────────────────────────────────────────────
function DateRangeModal({
  onCancel,
  onConfirm,
  sending,
}: {
  onCancel: () => void;
  onConfirm: (fromDate: string, toDate: string) => void;
  sending: boolean;
}) {
  // Default: last 7 days ending yesterday (Pakistan time)
  const toYmd = (d: Date) => d.toISOString().split("T")[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [fromDate, setFromDate] = useState(toYmd(sevenDaysAgo));
  const [toDate, setToDate] = useState(toYmd(yesterday));

  const spanDays = Math.max(
    1,
    Math.round((new Date(toDate).getTime() - new Date(fromDate).getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
  const valid = !!fromDate && !!toDate && new Date(fromDate) <= new Date(toDate) && spanDays <= 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-800">Generate Reports for Date Range</h3>
            <p className="text-[11px] text-slate-400">Backfill history without delivering WhatsApp/email</p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel} disabled={sending}>✕</button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 p-3 rounded-xl text-[12px]" style={{ background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>
            ℹ️ Range mode <b>does not send WhatsApp or email notifications</b>. Reports are saved to the Reports history so you can review them here. Max 90 days.
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">From</label>
              <input
                type="date"
                className="form-input"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">To</label>
              <input
                type="date"
                className="form-input"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          <div className="text-[12px] text-slate-500">
            {valid ? (
              <>Will generate <b>{spanDays}</b> report{spanDays !== 1 ? "s" : ""} ({fromDate} → {toDate})</>
            ) : (
              <span className="text-red-600">
                {spanDays > 90 ? "Range exceeds 90 days" : "Invalid date range"}
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button className="btn-secondary text-[13px]" onClick={onCancel} disabled={sending}>Cancel</button>
          <button
            className="btn-primary text-[13px] inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={() => onConfirm(fromDate, toDate)}
            disabled={!valid || sending}
          >
            {sending && <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />}
            {sending ? "Generating…" : `Generate ${spanDays} report${spanDays !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[14px] font-bold text-slate-800">{value}</div>
    </div>
  );
}
