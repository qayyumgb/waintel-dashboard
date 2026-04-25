"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface KnowledgeGap {
  id: string;
  question: string;
  frequency: number;
  status: string;
  priority: string;
  suggested_kb_content: string | null;
  last_asked_at: string | null;
}

interface SentimentSummary {
  avg_score: number;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

interface CompetitorRow {
  competitor_name: string;
  mentions: number;
  common_sentiment: string;
  has_threat: boolean;
}

interface InsightRow {
  insight_type: string;
  insight_data: any;
  summary: string | null;
  analysis_date: string;
}

interface SentimentTrendPoint {
  conversation_date: string;
  avg_score: number;
  positive: number;
  negative: number;
  total: number;
}

interface CompetitorMention {
  competitor_name: string;
  mention_context: string | null;
  customer_phone: string;
  sentiment: string;
  is_threat: boolean;
  recommendation: string | null;
  mentioned_at: string;
}

interface Settings {
  intelligence_enabled: boolean;
  intelligence_competitors: string;
  weekly_digest_enabled: boolean;
  weekly_digest_phone: string;
  intelligence_last_run: string | null;
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; emoji: string }> = {
  high:   { bg: "#fee2e2", text: "#b91c1c", emoji: "🔴" },
  medium: { bg: "#fef3c7", text: "#92400e", emoji: "🟡" },
  low:    { bg: "#f1f5f9", text: "#475569", emoji: "⚫" },
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

export default function IntelligencePage() {
  const { tenantId, botId } = useAuth();
  const [gaps, setGaps] = useState<KnowledgeGap[]>([]);
  const [sentiment, setSentiment] = useState<SentimentSummary | null>(null);
  const [sentimentTrend, setSentimentTrend] = useState<SentimentTrendPoint[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [competitorMentions, setCompetitorMentions] = useState<CompetitorMention[]>([]);
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeGap, setActiveGap] = useState<KnowledgeGap | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!botId) return;
    try {
      const [overview, trend, mentions] = await Promise.all([
        axios.get(`${API}/api/intelligence/overview?botId=${botId}&days=30`),
        axios.get(`${API}/api/intelligence/sentiment?botId=${botId}&days=30`),
        axios.get(`${API}/api/intelligence/competitors?botId=${botId}&days=30`),
      ]);
      setGaps(overview.data.knowledgeGaps || []);
      setSentiment(overview.data.sentiment || null);
      setCompetitors(overview.data.competitors || []);
      setInsights(overview.data.recentInsights || []);
      setSentimentTrend(trend.data.trend || []);
      setCompetitorMentions(mentions.data.mentions || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [botId]);

  const loadSettings = useCallback(async () => {
    if (!botId) return;
    try {
      const { data } = await axios.get(`${API}/api/bots/${botId}`);
      setSettings({
        intelligence_enabled: data.intelligence_enabled ?? true,
        intelligence_competitors: data.intelligence_competitors || "",
        weekly_digest_enabled: data.weekly_digest_enabled ?? true,
        weekly_digest_phone: data.weekly_digest_phone || "",
        intelligence_last_run: data.intelligence_last_run || null,
      });
    } catch { /* silent */ }
  }, [botId]);

  useEffect(() => { load(); loadSettings(); }, [load, loadSettings]);

  const runNow = async (which: "today" | "yesterday" = "today") => {
    if (!botId || !tenantId) return;
    setRunning(true);
    const dateMsg = which === "today" ? "today's" : "yesterday's";
    setToast({ message: `Analyzing ${dateMsg} conversations... ~30 sec`, type: "success" });
    try {
      const body: any = { botId, tenantId };
      if (which === "yesterday") {
        const y = new Date(Date.now() - 86400000);
        body.date = y.toISOString().split('T')[0];
      }
      // omitting `date` defaults to today on the backend
      await axios.post(`${API}/api/intelligence/run`, body);
      setTimeout(async () => {
        await load();
        await loadSettings();
        setRunning(false);
        setToast({ message: `Analysis complete for ${dateMsg} data!`, type: "success" });
      }, 30000);
    } catch (err: any) {
      setRunning(false);
      setToast({ message: err.response?.data?.error || "Run failed", type: "error" });
    }
  };

  const resolveGap = async (markStatus: "resolved" | "dismissed") => {
    if (!activeGap) return;
    try {
      await axios.patch(`${API}/api/intelligence/gaps/${activeGap.id}`, {
        status: markStatus,
        resolution: resolutionNote,
      });
      setToast({ message: `Marked as ${markStatus}`, type: "success" });
      setActiveGap(null);
      setResolutionNote("");
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const saveSettings = async (next: Partial<Settings>) => {
    if (!botId || !settings) return;
    const updated = { ...settings, ...next };
    setSettings(updated);
    try {
      await axios.patch(`${API}/api/intelligence/settings`, {
        botId,
        intelligenceEnabled: updated.intelligence_enabled,
        intelligenceCompetitors: updated.intelligence_competitors,
        weeklyDigestEnabled: updated.weekly_digest_enabled,
        weeklyDigestPhone: updated.weekly_digest_phone,
      });
      setToast({ message: "Settings saved", type: "success" });
    } catch { setToast({ message: "Save failed", type: "error" }); }
  };

  if (loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  // ── Compute KPIs ───────────────────────────────────────────────────────
  const openGaps = gaps.filter((g) => g.status === "open").length;
  const sentimentPercent = sentiment && sentiment.total > 0
    ? Math.round(((sentiment.avg_score + 1) / 2) * 100) // -1..+1 → 0..100
    : null;
  const sentimentScore10 = sentiment && sentiment.total > 0
    ? ((sentiment.avg_score + 1) * 5).toFixed(1) // -1..+1 → 0..10
    : "—";
  const totalCompetitorMentions = competitors.reduce((s, c) => s + c.mentions, 0);

  // Find peak hour from latest peak_patterns insight
  const peakInsight = insights.find((i) => i.insight_type === "peak_patterns");
  const peakHour = peakInsight?.insight_data?.peak_hour;
  const peakLabel = typeof peakHour === "number"
    ? `${peakHour}:00 - ${(peakHour + 1) % 24}:00`
    : "—";
  const topTopics: { topic: string; frequency: number }[] = peakInsight?.insight_data?.top_topics || [];
  const hourlyDist: { hour: number; message_count: number }[] = peakInsight?.insight_data?.hourly_distribution || [];
  const maxHourCount = Math.max(1, ...hourlyDist.map((h) => h.message_count));

  // Sentiment trend chart bounds
  const trendMin = -1;
  const trendMax = 1;
  const trendPoints = sentimentTrend.map((p, i) => {
    const x = sentimentTrend.length > 1 ? (i / (sentimentTrend.length - 1)) * 100 : 50;
    const y = 100 - ((p.avg_score - trendMin) / (trendMax - trendMin)) * 100;
    return { x, y, score: p.avg_score, date: p.conversation_date };
  });

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-7xl">
      <div className="mb-8 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="page-breadcrumb">🧠 Conversation Intelligence</div>
          <h1 className="text-[28px] font-bold text-slate-900 mb-2">Conversation Intelligence</h1>
          <p className="text-[16px] text-slate-500">AI analyzes every conversation for knowledge gaps, sentiment, competitor mentions, and peak patterns.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-primary text-[13px]" onClick={() => runNow("today")} disabled={running}>
            {running ? "Analyzing..." : "🔄 Analyze Today"}
          </button>
          <button className="btn-secondary text-[13px]" onClick={() => runNow("yesterday")} disabled={running}>
            Analyze Yesterday
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPI label="🧠 Knowledge Gaps" value={String(openGaps)} sub={`${gaps.length - openGaps} resolved`} color={openGaps > 5 ? "#b91c1c" : "#0f172a"} />
        <KPI label="😊 Avg Sentiment" value={`${sentimentScore10}/10`} sub={sentiment?.total ? `${sentiment.total} convs` : "no data"}
             color={sentimentPercent != null ? (sentimentPercent >= 70 ? "#047857" : sentimentPercent >= 50 ? "#92400e" : "#b91c1c") : "#0f172a"} />
        <KPI label="🕵️ Competitor Mentions" value={String(totalCompetitorMentions)} sub={`${competitors.length} unique competitors`} />
        <KPI label="⏰ Peak Hour" value={peakLabel} sub={peakHour != null ? "based on latest analysis" : "no data"} />
      </div>

      {/* Section 2 — Knowledge Gaps */}
      <div className="card mb-8">
        <div className="mb-4">
          <h2 className="text-[18px] font-bold text-slate-800">🧠 Questions Your Bot Couldn't Answer</h2>
          <p className="text-[13px] text-slate-500">Fix these to recover missed sales. AI extracts patterns from real conversations.</p>
        </div>
        {gaps.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No knowledge gaps detected yet. Run analysis after collecting some conversations.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Question</th>
                  <th className="py-2 pr-3">Asked</th>
                  <th className="py-2 pr-3">Last Asked</th>
                  <th className="py-2 pr-3">Priority</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => {
                  const ps = PRIORITY_STYLES[g.priority] || PRIORITY_STYLES.medium;
                  return (
                    <tr key={g.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-800 max-w-[420px]">{g.question}</td>
                      <td className="py-2 pr-3 text-slate-700 font-bold">{g.frequency}x</td>
                      <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(g.last_asked_at)}</td>
                      <td className="py-2 pr-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: ps.bg, color: ps.text }}>
                          {ps.emoji} {g.priority}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-500 text-[11px]">{g.status}</td>
                      <td className="py-2 text-right">
                        <button className="text-[11px] text-emerald-700 hover:underline" onClick={() => { setActiveGap(g); setResolutionNote(g.suggested_kb_content || ""); }}>
                          Fix This →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3 — Sentiment Trend */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-1">😊 Customer Satisfaction Over Time</h2>
        <p className="text-[12px] text-slate-500 mb-4">Daily sentiment score (-1.0 negative ↔ +1.0 positive)</p>
        {sentimentTrend.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">Not enough sentiment data yet. Needs ~3 days of conversations to build a trend.</div>
        ) : (
          <>
            <div className="relative h-48 mb-4 border-l border-b border-slate-200" style={{ minHeight: 192 }}>
              {/* Zero line */}
              <div className="absolute left-0 right-0 border-t border-dashed border-slate-300" style={{ top: "50%" }} />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                <polyline
                  points={trendPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke="#1D9E75"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {trendPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={p.score >= 0 ? "#10b981" : "#ef4444"} vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
              <div className="absolute -top-2 -left-1 text-[10px] text-slate-400">+1</div>
              <div className="absolute bottom-0 -left-1 text-[10px] text-slate-400">-1</div>
            </div>
            {sentiment && sentiment.total > 0 && (
              <div className="flex flex-wrap gap-3">
                <SentimentBadge label="😊 Positive" count={sentiment.positive} total={sentiment.total} color="#10b981" />
                <SentimentBadge label="😐 Neutral" count={sentiment.neutral} total={sentiment.total} color="#94a3b8" />
                <SentimentBadge label="😞 Negative" count={sentiment.negative} total={sentiment.total} color="#ef4444" />
              </div>
            )}
          </>
        )}
      </div>

      {/* Section 4 — Competitor Intelligence */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">🕵️ What Customers Say About Competitors</h2>
        {competitorMentions.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No competitor mentions detected this month — good sign! 🎉</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Competitor</th>
                  <th className="py-2 pr-3">Customer</th>
                  <th className="py-2 pr-3">Context</th>
                  <th className="py-2 pr-3">Sentiment</th>
                  <th className="py-2 pr-3">When</th>
                </tr>
              </thead>
              <tbody>
                {competitorMentions.slice(0, 20).map((m, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {m.competitor_name}
                      {m.is_threat && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">⚠ Churn risk</span>}
                    </td>
                    <td className="py-2 pr-3 text-slate-500 font-mono text-[11px]">{maskPhone(m.customer_phone)}</td>
                    <td className="py-2 pr-3 text-slate-700 max-w-[320px]">{m.mention_context || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: m.sentiment === "positive" ? "#fee2e2" : m.sentiment === "negative" ? "#dcfce7" : "#f1f5f9",
                        color:      m.sentiment === "positive" ? "#b91c1c" : m.sentiment === "negative" ? "#166534" : "#475569",
                      }}>
                        {/* "Positive toward competitor" = bad for us, "negative" = good */}
                        {m.sentiment === "positive" ? "⚠️ Pro-competitor" : m.sentiment === "negative" ? "✅ Pro-us" : "Neutral"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(m.mentioned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 5 — Peak Intelligence */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">⏰ When & What Customers Ask</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-[13px] font-bold text-slate-700 mb-3">Hourly Activity</h3>
            {hourlyDist.length === 0 ? (
              <div className="text-slate-400 text-[12px] italic">Run analysis to see hourly distribution.</div>
            ) : (
              <div className="flex items-end gap-1 h-32 border-b border-slate-200">
                {Array.from({ length: 24 }, (_, h) => {
                  const bar = hourlyDist.find((d) => d.hour === h);
                  const count = bar?.message_count || 0;
                  const height = (count / maxHourCount) * 100;
                  const isPeak = h === peakHour;
                  return (
                    <div key={h} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${h}:00 — ${count} messages`}>
                      <div className="w-full rounded-t" style={{ height: `${Math.max(height, 2)}%`, background: isPeak ? "#1D9E75" : "#cbd5e1" }} />
                      {h % 4 === 0 && <span className="text-[9px] text-slate-400">{h}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-[13px] font-bold text-slate-700 mb-3">Top Topics</h3>
            {topTopics.length === 0 ? (
              <div className="text-slate-400 text-[12px] italic">No topics extracted yet.</div>
            ) : (
              <div className="space-y-2">
                {topTopics.slice(0, 5).map((t, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-50">
                    <span className="text-[13px] text-slate-700"><b>{i + 1}.</b> {t.topic}</span>
                    <span className="text-[11px] text-slate-500 font-bold">{t.frequency}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 6 — Settings */}
      {settings && (
        <div className="card">
          <h2 className="text-[18px] font-bold text-slate-800 mb-4">⚙️ Intelligence Settings</h2>

          <label className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid #e5e7eb" }}>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Enable Conversation Intelligence</div>
              <div className="text-[11px] text-slate-500">Nightly AI analysis of conversations · last run: {timeAgo(settings.intelligence_last_run)}</div>
            </div>
            <input type="checkbox" className="sr-only peer" checked={settings.intelligence_enabled}
              onChange={(e) => saveSettings({ intelligence_enabled: e.target.checked })} />
            <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.intelligence_enabled ? "translate-x-5" : ""}`} />
            </div>
          </label>

          <div className="space-y-4 mb-5">
            <div>
              <label className="form-label">🕵️ Competitors to Track (comma-separated)</label>
              <input className="form-input"
                placeholder="daraz, telemart, naheed"
                value={settings.intelligence_competitors}
                onChange={(e) => setSettings({ ...settings, intelligence_competitors: e.target.value })}
                onBlur={() => saveSettings({ intelligence_competitors: settings.intelligence_competitors })} />
              <div className="text-[11px] text-slate-500 mt-1">We'll detect when customers mention these brands. Industry defaults are also checked.</div>
            </div>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl mb-4 cursor-pointer" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Weekly Digest</div>
              <div className="text-[11px] text-slate-500">Get a smart weekly intelligence summary on WhatsApp every Monday morning</div>
            </div>
            <input type="checkbox" className="sr-only peer" checked={settings.weekly_digest_enabled}
              onChange={(e) => saveSettings({ weekly_digest_enabled: e.target.checked })} />
            <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.weekly_digest_enabled ? "translate-x-5" : ""}`} />
            </div>
          </label>

          {settings.weekly_digest_enabled && (
            <div>
              <label className="form-label">📞 Digest Phone Number</label>
              <input className="form-input"
                placeholder="923001234567 (international format, no +)"
                value={settings.weekly_digest_phone}
                onChange={(e) => setSettings({ ...settings, weekly_digest_phone: e.target.value })}
                onBlur={() => saveSettings({ weekly_digest_phone: settings.weekly_digest_phone })} />
            </div>
          )}
        </div>
      )}

      {/* Knowledge Gap detail panel */}
      {activeGap && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setActiveGap(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-200 flex justify-between items-start gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-slate-500 mb-1">Knowledge Gap</div>
                <h2 className="text-[18px] font-bold text-slate-900">{activeGap.question}</h2>
                <div className="text-[12px] text-slate-500 mt-1">Asked {activeGap.frequency}x · {activeGap.priority} priority</div>
              </div>
              <button className="text-slate-400 hover:text-slate-700 text-[24px] leading-none" onClick={() => setActiveGap(null)}>×</button>
            </div>
            <div className="p-6 space-y-4">
              {activeGap.suggested_kb_content && (
                <div>
                  <div className="text-[12px] font-semibold text-slate-700 mb-2">💡 AI-suggested answer for your knowledge base:</div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[13px] text-slate-800 whitespace-pre-wrap">
                    {activeGap.suggested_kb_content}
                  </div>
                </div>
              )}
              <div>
                <label className="form-label">Resolution / Notes</label>
                <textarea className="form-input" rows={4} value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="What did you do to fix this gap? (e.g. added FAQ, updated knowledge base, trained team)" />
              </div>
              <div className="text-[12px] text-slate-500 p-3 rounded-lg bg-blue-50 border border-blue-100">
                💡 <b>Tip:</b> To actually fix this, paste the suggested answer into your <a href="/knowledge" className="underline">Knowledge Base</a> so the bot can reference it next time.
              </div>
            </div>
            <div className="p-6 border-t border-slate-200 flex flex-wrap gap-3 justify-between">
              <button className="text-[12px] text-slate-500 hover:text-slate-700" onClick={() => resolveGap("dismissed")}>
                Dismiss (not a real issue)
              </button>
              <button className="btn-primary text-[13px]" onClick={() => resolveGap("resolved")}>
                ✓ Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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

function SentimentBadge({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: color + "15", border: `1px solid ${color}40` }}>
      <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{label}</div>
      <div className="text-[18px] font-bold" style={{ color }}>{pct}%</div>
      <div className="text-[10px] text-slate-500">{count} of {total}</div>
    </div>
  );
}
