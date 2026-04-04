"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const INDUSTRIES = ["Restaurant", "Pharmacy", "Real Estate", "Hotel", "E-commerce", "Education", "Other"];
const TONES = ["Friendly", "Professional", "Formal"];
const LANGUAGES = ["Auto-detect", "Urdu", "English", "Arabic"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DEFAULT_HOURS = Object.fromEntries(DAYS.map((d) => [d, { enabled: true, open: "09:00", close: "22:00" }]));

function detectTone(prompt: string): string {
  if (/professional|structured/i.test(prompt)) return "Professional";
  if (/formal|respectful/i.test(prompt)) return "Formal";
  return "Friendly";
}

function detectIndustry(prompt: string): string {
  for (const ind of INDUSTRIES) {
    if (prompt.toLowerCase().includes(ind.toLowerCase())) return ind;
  }
  return "Other";
}

function extractDescription(prompt: string): string {
  // Strip the boilerplate wrapper, keep the business-specific part
  return prompt
    .replace(/^You are a helpful WhatsApp assistant for [^.]*\.\s*/i, "")
    .replace(/\s*Be (warm|professional|formal)[^.]*\.\s*/gi, "")
    .replace(/\s*Reply in the same language[^.]*\.\s*/gi, "")
    .replace(/\s*Keep replies concise\.?\s*/gi, "")
    .replace(/\s*Be concise[^.]*\.?\s*/gi, "")
    .trim();
}

export default function BotSetupPage() {
  const { botId } = useAuth();
  const BOT_ID = botId || "";
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    displayName: "",
    industry: "Other",
    businessDescription: "",
    tone: "Friendly",
    language: "Auto-detect",
    responseLength: "Medium",
    businessHours: DEFAULT_HOURS as Record<string, { enabled: boolean; open: string; close: string }>,
    outsideHoursMessage: "",
    escalationNumber: "",
    escalationKeywords: ["complaint", "refund", "manager", "urgent", "shikayat"],
    alertOnEscalation: true,
    phoneNumberId: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Fetch current bot config on mount
  useEffect(() => {
    if (!BOT_ID) return;
    async function fetchBot() {
      try {
        const res = await axios.get(`${API}/api/bots/${BOT_ID}`);
        const bot = res.data;

        const lang = bot.language === "auto" ? "Auto-detect"
          : bot.language ? bot.language.charAt(0).toUpperCase() + bot.language.slice(1)
          : "Auto-detect";

        const hours = (bot.business_hours && Object.keys(bot.business_hours).length > 0)
          ? bot.business_hours
          : DEFAULT_HOURS;

        setForm((f) => ({
          ...f,
          displayName: bot.display_name || "",
          industry: bot.system_prompt ? detectIndustry(bot.system_prompt) : "Other",
          businessDescription: bot.system_prompt ? extractDescription(bot.system_prompt) : "",
          tone: bot.system_prompt ? detectTone(bot.system_prompt) : "Friendly",
          language: lang,
          businessHours: hours,
          escalationNumber: bot.escalation_number || "+92",
          phoneNumberId: bot.phone_number_id || "",
        }));
      } catch {
        setToast({ message: "Failed to load bot config", type: "error" });
      } finally {
        setLoading(false);
      }
    }
    fetchBot();
  }, [BOT_ID]);

  const updateField = (field: string, value: unknown) => setForm((f) => ({ ...f, [field]: value }));

  const toggleDay = (day: string) => {
    setForm((f) => ({
      ...f,
      businessHours: {
        ...f.businessHours,
        [day]: { ...f.businessHours[day], enabled: !f.businessHours[day].enabled },
      },
    }));
  };

  const updateHour = (day: string, field: "open" | "close", val: string) => {
    setForm((f) => ({
      ...f,
      businessHours: {
        ...f.businessHours,
        [day]: { ...f.businessHours[day], [field]: val },
      },
    }));
  };

  const addKeyword = (kw: string) => {
    if (kw && !form.escalationKeywords.includes(kw)) {
      updateField("escalationKeywords", [...form.escalationKeywords, kw]);
    }
  };

  const removeKeyword = (kw: string) => {
    updateField("escalationKeywords", form.escalationKeywords.filter((k) => k !== kw));
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const tonePrompt =
        form.tone === "Professional" ? " Be professional and structured." :
        form.tone === "Formal" ? " Be formal and respectful." :
        " Be warm, friendly, and conversational.";

      const systemPrompt =
        `You are a helpful WhatsApp assistant for ${form.displayName}, a ${form.industry.toLowerCase()} business. ${form.businessDescription}${tonePrompt} Reply in the same language the customer uses. Keep replies concise.`;

      await axios.patch(`${API}/api/bots/${BOT_ID}`, {
        display_name: form.displayName,
        system_prompt: systemPrompt,
        language: form.language === "Auto-detect" ? "auto" : form.language.toLowerCase(),
        escalation_number: form.escalationNumber,
        business_hours: form.businessHours,
      });
      setToast({ message: "Bot configuration saved!", type: "success" });
    } catch {
      setToast({ message: "Failed to save configuration", type: "error" });
    } finally {
      setSaving(false);
    }
  }, [form]);

  if (loading) {
    return (
      <div className="p-8 animate-fade-in max-w-4xl">
        <div className="text-center py-20 text-slate-400">Loading bot configuration...</div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in max-w-4xl">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35" />
          </svg>
          Bot Setup
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Configure Your AI Agent</h1>
        <p className="text-[16px] text-slate-500 max-w-xl">
          Set up your WhatsApp bot personality, business hours, and escalation rules.
        </p>
      </div>

      {/* Section 1 — Business Identity */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>1</span>
          Business Identity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="form-label">Bot Display Name</label>
            <input className="form-input" value={form.displayName} onChange={(e) => updateField("displayName", e.target.value)} placeholder="Your business name" />
          </div>
          <div>
            <label className="form-label">Industry</label>
            <select className="form-input" value={form.industry} onChange={(e) => updateField("industry", e.target.value)}>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="form-label">Business Description</label>
          <textarea className="form-input" rows={3} value={form.businessDescription} onChange={(e) => updateField("businessDescription", e.target.value)} placeholder="Describe your business, products, and services. This powers your AI agent's responses..." />
        </div>
      </div>

      {/* Section 2 — AI Personality */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>2</span>
          AI Personality
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className="form-label">Tone</label>
            <div className="flex gap-2 mt-1">
              {TONES.map((t) => (
                <button key={t} onClick={() => updateField("tone", t)} className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all" style={{
                  background: form.tone === t ? "#1D9E75" : "#f8fafc",
                  color: form.tone === t ? "#fff" : "#64748b",
                  border: form.tone === t ? "1px solid #1D9E75" : "1px solid #e2e8f0",
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">Language</label>
            <select className="form-input" value={form.language} onChange={(e) => updateField("language", e.target.value)}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Response Length</label>
            <div className="flex gap-2 mt-1">
              {["Short", "Medium", "Long"].map((l) => (
                <button key={l} onClick={() => updateField("responseLength", l)} className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all" style={{
                  background: form.responseLength === l ? "#1D9E75" : "#f8fafc",
                  color: form.responseLength === l ? "#fff" : "#64748b",
                  border: form.responseLength === l ? "1px solid #1D9E75" : "1px solid #e2e8f0",
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 — Business Hours */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>3</span>
          Business Hours
        </h2>
        <div className="space-y-3 mb-4">
          {DAYS.map((day) => {
            const h = form.businessHours[day] || { enabled: true, open: "09:00", close: "22:00" };
            return (
              <div key={day} className="flex items-center gap-4">
                <button onClick={() => toggleDay(day)} className="w-[100px] text-[13px] font-medium text-left" style={{ color: h.enabled ? "#1e293b" : "#94a3b8" }}>
                  {day.slice(0, 3)}
                </button>
                <button onClick={() => toggleDay(day)} className="w-10 h-5 rounded-full relative transition-all" style={{ background: h.enabled ? "#1D9E75" : "#cbd5e1" }}>
                  <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: h.enabled ? "20px" : "2px" }} />
                </button>
                {h.enabled ? (
                  <div className="flex items-center gap-2">
                    <input type="time" className="form-input !w-auto !py-1.5 !px-3 text-[13px]" value={h.open} onChange={(e) => updateHour(day, "open", e.target.value)} />
                    <span className="text-slate-400 text-[12px]">to</span>
                    <input type="time" className="form-input !w-auto !py-1.5 !px-3 text-[13px]" value={h.close} onChange={(e) => updateHour(day, "close", e.target.value)} />
                  </div>
                ) : (
                  <span className="text-[13px] text-slate-400">Closed</span>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <label className="form-label">Outside Hours Message</label>
          <textarea className="form-input" rows={2} value={form.outsideHoursMessage} onChange={(e) => updateField("outsideHoursMessage", e.target.value)} />
        </div>
      </div>

      {/* Section 4 — Escalation */}
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>4</span>
          Escalation Settings
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
          <div>
            <label className="form-label">Escalation Phone Number</label>
            <input className="form-input" value={form.escalationNumber} onChange={(e) => updateField("escalationNumber", e.target.value)} placeholder="+923001234567" />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <button onClick={() => updateField("alertOnEscalation", !form.alertOnEscalation)} className="w-10 h-5 rounded-full relative transition-all" style={{ background: form.alertOnEscalation ? "#1D9E75" : "#cbd5e1" }}>
              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.alertOnEscalation ? "20px" : "2px" }} />
            </button>
            <span className="text-[13px] text-slate-600 font-medium">Alert owner on escalation</span>
          </div>
        </div>
        <div>
          <label className="form-label">Escalation Keywords</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {form.escalationKeywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium" style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} className="ml-1 text-[16px] leading-none hover:text-red-500">&times;</button>
              </span>
            ))}
          </div>
          <input className="form-input" placeholder="Type keyword and press Enter" onKeyDown={(e) => {
            if (e.key === "Enter") { addKeyword((e.target as HTMLInputElement).value.trim()); (e.target as HTMLInputElement).value = ""; }
          }} />
        </div>
      </div>

      {/* Section 5 — WhatsApp Connection */}
      <div className="card mb-8">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>5</span>
          WhatsApp Connection
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="form-label">Phone Number ID</label>
            <input className="form-input !bg-slate-100 !text-slate-500" value={form.phoneNumberId} readOnly />
          </div>
          <div>
            <label className="form-label">Connection Status</label>
            <div className="mt-2"><span className="badge-active">Connected</span></div>
          </div>
        </div>
      </div>

      <button className="btn-primary text-[15px] px-8 py-3" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Configuration"}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
