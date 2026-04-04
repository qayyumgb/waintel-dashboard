"use client";

import { useEffect, useState } from "react";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Analytics {
  dailyMessages: Array<{ date: string; count: number }>;
  topQuestions: Array<{ content: string; count: number }>;
  voiceMessages: number;
  textMessages: number;
  avgResponseSeconds: number;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/stats/analytics`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxDaily = Math.max(...(data?.dailyMessages.map((d) => d.count) || [1]));
  const totalMsgs = (data?.voiceMessages || 0) + (data?.textMessages || 0);
  const voicePct = totalMsgs > 0 ? Math.round(((data?.voiceMessages || 0) / totalMsgs) * 100) : 0;

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2z" />
          </svg>
          Analytics
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Analytics</h1>
        <p className="text-[16px] text-slate-500 max-w-xl">
          Insights into your WhatsApp AI agent performance over the last 7 days.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading analytics...</div>
      ) : !data ? (
        <div className="text-center py-20 text-slate-400">Failed to load analytics</div>
      ) : (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="card">
              <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Avg Response Time</div>
              <div className="text-[28px] font-bold text-slate-900">{data.avgResponseSeconds}s</div>
              <div className="text-[12px] text-slate-400 mt-1">Time from customer message to AI reply</div>
            </div>
            <div className="card">
              <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Text Messages</div>
              <div className="text-[28px] font-bold text-slate-900">{data.textMessages}</div>
              <div className="text-[12px] text-slate-400 mt-1">{100 - voicePct}% of total</div>
            </div>
            <div className="card">
              <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Voice Notes</div>
              <div className="text-[28px] font-bold text-slate-900">{data.voiceMessages}</div>
              <div className="text-[12px] text-slate-400 mt-1">{voicePct}% of total</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Messages Per Day */}
            <div className="card">
              <h3 className="text-[15px] font-bold text-slate-800 mb-5">Messages Per Day (Last 7 Days)</h3>
              {data.dailyMessages.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-[13px]">No data yet</div>
              ) : (
                <div className="space-y-3">
                  {data.dailyMessages.map((day) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <span className="text-[12px] text-slate-500 w-[80px] shrink-0">
                        {new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <div className="flex-1 h-[28px] rounded-lg overflow-hidden" style={{ background: "#f1f5f9" }}>
                        <div
                          className="h-full rounded-lg flex items-center px-3 text-[11px] font-bold text-white transition-all duration-500"
                          style={{
                            width: `${Math.max((day.count / maxDaily) * 100, 8)}%`,
                            background: "linear-gradient(135deg, #1D9E75, #0F6E56)",
                          }}
                        >
                          {day.count}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Questions */}
            <div className="card">
              <h3 className="text-[15px] font-bold text-slate-800 mb-5">Top Customer Questions</h3>
              {data.topQuestions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-[13px]">No data yet</div>
              ) : (
                <div className="space-y-3">
                  {data.topQuestions.map((q, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                        style={{ background: "#1D9E75" }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-slate-700 truncate">{q.content}</div>
                      </div>
                      <span
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0"
                        style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}
                      >
                        {q.count}x
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
