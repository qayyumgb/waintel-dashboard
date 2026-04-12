"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ConversationRow {
  id: string;
  customer_phone: string;
  status: string;
  last_message_at: string;
  messagecount: number;
}

interface UsageWidget {
  totalConversations: number;
  totalCostPkr: number;
  metaPkr: number;
  metaPct: string;
}

export default function DashboardPage() {
  const { botId } = useAuth();
  const [stats, setStats] = useState({ totalConversations: 0, today: 0, thisWeek: 0 });
  const [messagesToday, setMessagesToday] = useState(0);
  const [knowledgeChunks, setKnowledgeChunks] = useState(0);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [usage, setUsage] = useState<UsageWidget | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!botId) return;
    async function fetchData() {
      try {
        const [convRes, msgRes, knowledgeRes, convListRes, usageRes] = await Promise.allSettled([
          axios.get(`${API}/api/stats/conversations?botId=${botId}`),
          axios.get(`${API}/api/stats/messages-today?botId=${botId}`),
          axios.get(`${API}/api/knowledge/${botId}/status`),
          axios.get(`${API}/api/conversations?botId=${botId}&limit=5`),
          axios.get(`${API}/api/pricing/usage?botId=${botId}`),
        ]);

        if (convRes.status === "fulfilled") {
          setStats({
            totalConversations: convRes.value.data.total,
            today: convRes.value.data.today,
            thisWeek: convRes.value.data.thisWeek,
          });
        }
        if (msgRes.status === "fulfilled") setMessagesToday(msgRes.value.data.count);
        if (knowledgeRes.status === "fulfilled") setKnowledgeChunks(knowledgeRes.value.data.totalChunks);
        if (convListRes.status === "fulfilled") setConversations(convListRes.value.data.conversations || []);
        if (usageRes.status === "fulfilled") {
          const u = usageRes.value.data;
          setUsage({
            totalConversations: u.summary.totalConversations,
            totalCostPkr: u.summary.totalCostPkr,
            metaPkr: u.metaCost.totalPkr,
            metaPct: u.summary.metaAsPercentage,
          });
        }
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [botId]);

  const statCards = [
    { label: "Total Conversations", value: stats.totalConversations, icon: ChatIcon, accent: "#1D9E75" },
    { label: "Messages Today", value: messagesToday, icon: MessageIcon, accent: "#0ea5e9" },
    { label: "Knowledge Chunks", value: knowledgeChunks, icon: BookIcon, accent: "#8b5cf6" },
    { label: "Bot Status", value: "Active", icon: BotIcon, accent: "#10b981", isBadge: true },
  ];

  return (
    <div className="p-3 md:p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" />
          </svg>
          Dashboard
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Welcome back</h1>
        <p className="text-[16px] text-slate-500 max-w-xl">
          Monitor your WhatsApp AI agent performance and manage your business bot.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className="card flex items-start gap-4">
            <div
              className="w-[48px] h-[48px] rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${card.accent}12` }}
            >
              <card.icon color={card.accent} />
            </div>
            <div>
              <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {card.label}
              </div>
              {card.isBadge ? (
                <span className="badge-active">{card.value}</span>
              ) : (
                <div className="text-[24px] font-bold text-slate-900">
                  {loading ? "..." : card.value}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* This Month usage widget */}
      {usage && (
        <div className="card mb-8" style={{ background: "linear-gradient(135deg, rgba(29,158,117,0.04), rgba(15,110,86,0.08))", border: "1px solid rgba(29,158,117,0.15)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#047857" }}>💰 This Month</div>
              <div className="text-[20px] font-bold text-slate-900">
                {usage.totalConversations.toLocaleString()} conversations · Rs. {usage.totalCostPkr.toLocaleString("en-PK")} total cost
              </div>
              <div className="text-[12px] text-slate-500 mt-1">
                Meta API: Rs. {usage.metaPkr.toLocaleString("en-PK")} ({usage.metaPct}) · rest is Waintel subscription
              </div>
            </div>
            <Link
              href="/usage"
              className="shrink-0 text-[12px] font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
              style={{ background: "#1D9E75", color: "#fff" }}
            >
              View Details →
            </Link>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-bold text-slate-900">Recent Conversations</h2>
          <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Last 5</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(29,158,117,0.08)" }}>
              <ChatIcon color="#1D9E75" />
            </div>
            <p className="text-slate-500 text-[14px]">No conversations yet. Send a WhatsApp message to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Customer Phone</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Messages</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Last Activity</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => (
                  <tr key={conv.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 text-[14px] font-medium text-slate-700">{conv.customer_phone}</td>
                    <td className="py-3 px-4 text-[14px] text-slate-500">{conv.messagecount}</td>
                    <td className="py-3 px-4 text-[13px] text-slate-400">{new Date(conv.last_message_at).toLocaleString()}</td>
                    <td className="py-3 px-4"><span className="badge-active">{conv.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatIcon({ color = "#1D9E75" }: { color?: string }) {
  return (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>);
}
function MessageIcon({ color = "#0ea5e9" }: { color?: string }) {
  return (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>);
}
function BookIcon({ color = "#8b5cf6" }: { color?: string }) {
  return (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>);
}
function BotIcon({ color = "#10b981" }: { color?: string }) {
  return (<svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>);
}
