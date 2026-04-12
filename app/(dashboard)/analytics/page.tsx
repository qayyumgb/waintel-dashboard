"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Analytics {
  dailyMessages: Array<{ date: string; count: number }>;
  topQuestions: Array<{ content: string; count: number }>;
  voiceMessages: number;
  textMessages: number;
  avgResponseSeconds: number;
  followUpStats?: {
    totalScheduled: number;
    totalSent: number;
    totalCancelled: number;
    recoveryRate: string;
  };
}

interface HotelStats {
  totalBookings: number;
  confirmedBookings: number;
  monthRevenue: number;
  occupancyRate: string;
  avgNights: number;
  checkInsToday: number;
  checkOutsToday: number;
  upcomingCheckIns: number;
  popularRoomType: string;
}

interface WeeklyStats {
  days: Array<{
    report_date: string;
    total_conversations: number;
    orders_placed: number;
    revenue: string;
  }>;
  totalRevenue: number;
  totalOrders: number;
  totalConversations: number;
  avgDailyConversations: number;
  avgDailyRevenue: number;
  bestDay: { date: string; revenue: number; orders: number } | null;
  topQuestionOverall: string | null;
}

export default function AnalyticsPage() {
  const { botId } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [hotelStats, setHotelStats] = useState<HotelStats | null>(null);
  const [weekly, setWeekly] = useState<WeeklyStats | null>(null);
  const [industry, setIndustry] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!botId) return;
    Promise.all([
      axios.get(`${API}/api/stats/analytics?botId=${botId}`).then((r) => setData(r.data)).catch(() => {}),
      axios.get(`${API}/api/bots/${botId}`).then((r) => setIndustry((r.data.industry || "").toLowerCase())).catch(() => {}),
      axios.get(`${API}/api/reports/stats?botId=${botId}&days=7`).then((r) => setWeekly(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [botId]);

  useEffect(() => {
    if (!botId || industry !== "hotel") return;
    axios.get(`${API}/api/hotels/stats?botId=${botId}`)
      .then((r) => setHotelStats(r.data))
      .catch(() => {});
  }, [botId, industry]);

  const maxDaily = Math.max(...(data?.dailyMessages.map((d) => d.count) || [1]));
  const totalMsgs = (data?.voiceMessages || 0) + (data?.textMessages || 0);
  const voicePct = totalMsgs > 0 ? Math.round(((data?.voiceMessages || 0) / totalMsgs) * 100) : 0;

  return (
    <div className="p-3 md:p-8 animate-fade-in">
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
          {/* Hotel Metrics — shown when industry = hotel */}
          {industry === "hotel" && hotelStats && (
            <div className="mb-8">
              <h2 className="text-[16px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                🏨 Hotel Performance — This Month
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-4">
                {[
                  { label: "Total Bookings",    value: hotelStats.totalBookings,    sub: "all time" },
                  { label: "Confirmed",         value: hotelStats.confirmedBookings, sub: "active bookings" },
                  { label: "Month Revenue",     value: `Rs. ${hotelStats.monthRevenue.toLocaleString()}`, sub: "this month" },
                  { label: "Occupancy Rate",    value: hotelStats.occupancyRate,     sub: "confirmed / rooms" },
                  { label: "Avg Stay",          value: `${hotelStats.avgNights} nights`, sub: "per booking" },
                ].map((s) => (
                  <div key={s.label} className="card !py-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{s.label}</div>
                    <div className="text-[20px] font-bold text-slate-900">{s.value}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Check-ins Today",     value: hotelStats.checkInsToday,    color: "#e8f5e9", text: "#1b5e20" },
                  { label: "Check-outs Today",    value: hotelStats.checkOutsToday,   color: "#fef3c7", text: "#92400e" },
                  { label: "Upcoming (7 days)",   value: hotelStats.upcomingCheckIns, color: "#eff6ff", text: "#1d4ed8" },
                  { label: "Popular Room",        value: hotelStats.popularRoomType,  color: "rgba(29,158,117,0.08)", text: "#047857" },
                ].map((s) => (
                  <div key={s.label} className="p-4 rounded-xl" style={{ background: s.color }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: s.text, opacity: 0.7 }}>{s.label}</div>
                    <div className="text-[18px] font-bold" style={{ color: s.text }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Weekly Performance (Business Pulse) */}
          {weekly && weekly.days.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[16px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                📊 Weekly Performance — Last 7 Days
              </h2>

              <div className="card mb-4">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Daily Breakdown</div>
                {(() => {
                  const maxRev = Math.max(...weekly.days.map((d) => Number(d.revenue || 0)), 1);
                  return (
                    <div className="space-y-2.5">
                      {weekly.days.map((d) => {
                        const rev = Number(d.revenue || 0);
                        const dateLabel = new Date(d.report_date).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" });
                        return (
                          <div key={d.report_date} className="flex items-center gap-3">
                            <span className="text-[11px] text-slate-500 w-[90px] shrink-0">{dateLabel}</span>
                            <div className="flex-1 h-[26px] rounded-lg overflow-hidden" style={{ background: "#f1f5f9" }}>
                              <div
                                className="h-full rounded-lg flex items-center px-3 text-[11px] font-bold text-white transition-all duration-500"
                                style={{
                                  width: `${Math.max((rev / maxRev) * 100, 10)}%`,
                                  background: "linear-gradient(135deg, #1D9E75, #0F6E56)",
                                }}
                              >
                                Rs. {rev.toLocaleString("en-PK")}
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400 w-[80px] text-right shrink-0">
                              {d.orders_placed} orders
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl" style={{ background: "#e8f5e9" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#1b5e20" }}>Best Day</div>
                  <div className="text-[16px] font-bold" style={{ color: "#1b5e20" }}>
                    {weekly.bestDay
                      ? new Date(weekly.bestDay.date).toLocaleDateString("en-PK", { weekday: "long" })
                      : "—"}
                  </div>
                  <div className="text-[12px]" style={{ color: "#1b5e20", opacity: 0.8 }}>
                    {weekly.bestDay ? `Rs. ${weekly.bestDay.revenue.toLocaleString("en-PK")}` : ""}
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "#eff6ff" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#1d4ed8" }}>Total Orders</div>
                  <div className="text-[16px] font-bold" style={{ color: "#1d4ed8" }}>{weekly.totalOrders} this week</div>
                  <div className="text-[12px]" style={{ color: "#1d4ed8", opacity: 0.8 }}>
                    avg {Math.round(weekly.totalOrders / Math.max(weekly.days.length, 1))}/day
                  </div>
                </div>
                <div className="p-4 rounded-xl" style={{ background: "rgba(29,158,117,0.08)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#047857" }}>Total Revenue</div>
                  <div className="text-[16px] font-bold" style={{ color: "#047857" }}>Rs. {weekly.totalRevenue.toLocaleString("en-PK")}</div>
                  <div className="text-[12px]" style={{ color: "#047857", opacity: 0.8 }}>
                    avg Rs. {weekly.avgDailyRevenue.toLocaleString("en-PK")}/day
                  </div>
                </div>
              </div>

              {weekly.topQuestionOverall && (
                <div className="mt-3 p-3 rounded-xl text-[12px]" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
                  💡 Most common customer question this week: <b>{weekly.topQuestionOverall}</b>
                </div>
              )}
            </div>
          )}

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

          {/* Cart Recovery */}
          {data.followUpStats && (
            <div className="card mt-6">
              <h3 className="text-[15px] font-bold text-slate-800 mb-5 flex items-center gap-2">
                <span>{"\uD83C\uDFAF"}</span> Cart Recovery Engine
              </h3>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <div className="text-center p-3 rounded-xl" style={{ background: "#f0fdf4" }}>
                  <div className="text-[22px] font-bold text-slate-900">{data.followUpStats.totalScheduled}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Scheduled</div>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background: "#eff6ff" }}>
                  <div className="text-[22px] font-bold text-slate-900">{data.followUpStats.totalSent}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Sent</div>
                </div>
                <div className="text-center p-3 rounded-xl" style={{ background: "#fef3c7" }}>
                  <div className="text-[22px] font-bold text-slate-900">{data.followUpStats.totalCancelled}</div>
                  <div className="text-[11px] text-slate-500 font-medium">Recovered</div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-semibold text-slate-500">Recovery Rate</span>
                  <span className="text-[12px] font-bold" style={{
                    color: parseInt(data.followUpStats.recoveryRate) > 20 ? "#047857" : parseInt(data.followUpStats.recoveryRate) > 10 ? "#92400e" : "#b91c1c"
                  }}>{data.followUpStats.recoveryRate}</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width: data.followUpStats.recoveryRate,
                    background: parseInt(data.followUpStats.recoveryRate) > 20 ? "linear-gradient(135deg, #1D9E75, #0F6E56)" : parseInt(data.followUpStats.recoveryRate) > 10 ? "#f59e0b" : "#ef4444",
                  }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
