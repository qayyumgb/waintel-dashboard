"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Conversation {
  id: string;
  customer_phone: string;
  status: string;
  last_message_at: string;
  messagecount: number;
}

interface Message {
  id: string;
  role: string;
  content: string;
  voice_transcription: boolean;
  detected_language: string | null;
  created_at: string;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatPhone(phone: string): string {
  if (phone.startsWith("92") && phone.length >= 12) {
    return `0${phone.slice(2, 5)}-${phone.slice(5)}`;
  }
  return phone;
}

export default function ConversationsPage() {
  const { botId } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Fetch conversation list
  const fetchConversations = useCallback(async () => {
    if (!botId) return;
    try {
      const res = await axios.get(`${API}/api/conversations?botId=${botId}&limit=50`);
      setConversations(res.data.conversations || []);
    } catch { /* silent */ }
  }, [botId]);

  useEffect(() => {
    if (!botId) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Fetch messages for active conversation
  const fetchMessages = useCallback(async (convId: string) => {
    try {
      const res = await axios.get(`${API}/api/conversations/${convId}/messages`);
      setMessages(res.data.messages || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (activeId) fetchMessages(activeId);
  }, [activeId, fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // SSE connection
  useEffect(() => {
    if (!botId) return;
    const eventSource = new EventSource(`${API}/api/conversations/stream?botId=${botId}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message") {
          // If it's for the active conversation, append message
          if (data.conversationId === activeIdRef.current) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.content === data.content && m.role === data.role && Date.now() - new Date(m.created_at).getTime() < 5000)) {
                return prev;
              }
              return [...prev, {
                id: `sse-${Date.now()}`,
                role: data.role,
                content: data.content,
                voice_transcription: false,
                detected_language: null,
                created_at: data.timestamp,
              }];
            });
          } else {
            // Toast for messages in other conversations
            setToast({ message: `New message from ${formatPhone(data.customerPhone)}`, type: "success" });
          }
          // Refresh list
          fetchConversations();
        }
      } catch { /* ignore parse errors */ }
    };

    return () => eventSource.close();
  }, [botId, fetchConversations]);

  // Send reply
  const sendReply = async () => {
    if (!replyText.trim() || !activeId) return;
    setSending(true);
    try {
      await axios.post(`${API}/api/conversations/${activeId}/reply`, {
        message: replyText,
      });
      setReplyText("");
    } catch {
      setToast({ message: "Failed to send reply", type: "error" });
    } finally {
      setSending(false);
    }
  };

  // Toggle manual/active mode
  const activeConv = conversations.find((c) => c.id === activeId);
  const toggleMode = async () => {
    if (!activeId || !activeConv) return;
    const newStatus = activeConv.status === "manual" ? "active" : "manual";
    try {
      await axios.patch(`${API}/api/conversations/${activeId}/status`, { status: newStatus });
      fetchConversations();
      setToast({ message: newStatus === "manual" ? "You took over — AI paused" : "AI is handling again", type: "success" });
    } catch {
      setToast({ message: "Failed to update status", type: "error" });
    }
  };

  const filtered = conversations.filter((c) =>
    c.customer_phone.includes(search) || formatPhone(c.customer_phone).includes(search)
  );

  const bubbleColor = (role: string) => {
    if (role === "customer") return { bg: "#f1f5f9", text: "#334155", align: "items-start" };
    if (role === "owner") return { bg: "#dbeafe", text: "#1e40af", align: "items-end" };
    return { bg: "#ecfdf5", text: "#047857", align: "items-end" }; // assistant
  };

  return (
    <div className="flex h-screen animate-fade-in" style={{ marginLeft: 0 }}>
      {/* LEFT — Conversation List */}
      <div className="w-[340px] border-r border-slate-200 flex flex-col bg-white shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-[16px] font-bold text-slate-800 mb-3">Conversations</h2>
          <input
            className="form-input !py-2 text-[13px]"
            placeholder="Search by phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-[13px]">No conversations</div>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveId(conv.id)}
                className="w-full text-left px-4 py-3 border-b border-slate-50 transition-colors hover:bg-slate-50"
                style={{ background: activeId === conv.id ? "#f0fdf4" : "transparent" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[14px] font-semibold text-slate-800">
                    {formatPhone(conv.customer_phone)}
                  </span>
                  <span className="text-[11px] text-slate-400">{timeAgo(conv.last_message_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-slate-500 truncate max-w-[200px]">
                    {conv.messagecount} messages
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: conv.status === "manual" ? "#dbeafe" : conv.status === "escalated" ? "#fef3c7" : "rgba(16,185,129,0.1)",
                      color: conv.status === "manual" ? "#1e40af" : conv.status === "escalated" ? "#92400e" : "#047857",
                    }}
                  >
                    {conv.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT — Active Conversation */}
      <div className="flex-1 flex flex-col bg-[#f8fafc]">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(29,158,117,0.08)" }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-[15px] font-medium text-slate-500">Select a conversation</p>
              <p className="text-[12px] text-slate-400 mt-1">Choose from the list on the left</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[16px] font-bold text-slate-800">{formatPhone(activeConv?.customer_phone || "")}</div>
                <div className="text-[12px] text-slate-400">{activeConv?.messagecount} messages &middot; {activeConv?.status}</div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[11px] font-bold px-3 py-1.5 rounded-full"
                  style={{
                    background: activeConv?.status === "manual" ? "#dbeafe" : "rgba(16,185,129,0.1)",
                    color: activeConv?.status === "manual" ? "#1e40af" : "#047857",
                  }}
                >
                  {activeConv?.status === "manual" ? "Manual Mode" : "AI Handling"}
                </span>
                <button className="btn-secondary !py-2 !px-4 text-[12px]" onClick={toggleMode}>
                  {activeConv?.status === "manual" ? "Hand Back to AI" : "Take Over"}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {messages.map((msg) => {
                const style = bubbleColor(msg.role);
                return (
                  <div key={msg.id} className={`flex flex-col ${style.align}`}>
                    <div
                      className="max-w-[70%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed"
                      style={{ background: style.bg, color: style.text }}
                    >
                      {msg.voice_transcription && <span className="mr-1">&#x1F3A4;</span>}
                      {msg.voice_transcription ? <em>{msg.content}</em> : msg.content}
                    </div>
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <span className="text-[10px] text-slate-400">
                        {msg.role === "customer" ? "Customer" : msg.role === "owner" ? "You" : "AI"}
                      </span>
                      <span className="text-[10px] text-slate-300">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Input */}
            <div className="px-6 py-4 bg-white border-t border-slate-200">
              <div className="flex gap-3">
                <textarea
                  className="form-input flex-1 !py-3 resize-none text-[14px]"
                  rows={1}
                  placeholder="Type a reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                  }}
                />
                <button className="btn-primary shrink-0 !py-3" onClick={sendReply} disabled={sending || !replyText.trim()}>
                  {sending ? "..." : "Send"}
                </button>
              </div>
              <div className="text-right mt-1 text-[11px] text-slate-400">{replyText.length}/500</div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
