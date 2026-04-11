"use client";

import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const HOTEL_REGIONS = [
  "Gilgit-Baltistan",
  "Khyber Pakhtunkhwa",
  "Punjab",
  "Azad Kashmir",
  "Other",
];

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
    jazzcashEnabled: false,
    jazzcashNumber: "",
    easypaisaEnabled: false,
    easypaisaNumber: "",
    codEnabled: false,
    codDeliveryAreas: "",
    codDeliveryCharge: 100,
    codFreeAbove: 1500,
    codMinOrder: 300,
    hasToken: false,
    connectionType: "official",
    connectionStatus: "pending",
    accessToken: "",
    // Hotel fields
    hotelName: "",
    hotelCancellationPolicy: "",
    hotelMapsUrl: "",
    hotelLocation: "",
    hotelRegion: "Gilgit-Baltistan",
    hotelCheckinTime: "2:00 PM",
    hotelCheckoutTime: "12:00 PM",
    hotelAddress: "",
    hotelWifiName: "",
    hotelWifiPassword: "",
    hotelParkingInfo: "",
    hotelAmenities: "",
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
          industry: INDUSTRIES.find((i) => i.toLowerCase() === (bot.industry || "").toLowerCase()) || (bot.system_prompt ? detectIndustry(bot.system_prompt) : "Other"),
          businessDescription: bot.system_prompt ? extractDescription(bot.system_prompt) : "",
          tone: bot.tone ? bot.tone.charAt(0).toUpperCase() + bot.tone.slice(1) : (bot.system_prompt ? detectTone(bot.system_prompt) : "Friendly"),
          responseLength: bot.response_length ? bot.response_length.charAt(0).toUpperCase() + bot.response_length.slice(1) : "Medium",
          language: lang,
          businessHours: hours,
          escalationNumber: bot.escalation_number || "+92",
          phoneNumberId: bot.phone_number_id || "",
          jazzcashEnabled: bot.jazzcash_enabled || false,
          jazzcashNumber: bot.jazzcash_number || "",
          easypaisaEnabled: bot.easypaisa_enabled || false,
          easypaisaNumber: bot.easypaisa_number || "",
          codEnabled: bot.cod_enabled || false,
          codDeliveryAreas: bot.cod_delivery_areas || "",
          codDeliveryCharge: bot.cod_delivery_charge || 100,
          codFreeAbove: bot.cod_free_above || 1500,
          codMinOrder: bot.cod_min_order || 300,
          hasToken: bot.hasToken || false,
          connectionType: bot.connection_type || "official",
          connectionStatus: bot.connection_status || "pending",
          hotelName:        bot.hotel_name        || "",
          hotelCancellationPolicy: bot.hotel_cancellation_policy || "",
          hotelMapsUrl:     bot.hotel_maps_url    || "",
          hotelLocation:    bot.hotel_location    || "",
          hotelRegion:      bot.hotel_region      || "Gilgit-Baltistan",
          hotelCheckinTime: bot.hotel_checkin_time  || "2:00 PM",
          hotelCheckoutTime: bot.hotel_checkout_time || "12:00 PM",
          hotelAddress:     bot.hotel_address     || "",
          hotelWifiName:    bot.hotel_wifi_name    || "",
          hotelWifiPassword: bot.hotel_wifi_password || "",
          hotelParkingInfo: bot.hotel_parking_info || "",
          hotelAmenities:   bot.hotel_amenities   || "",
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
        jazzcash_enabled: form.jazzcashEnabled,
        jazzcash_number: form.jazzcashNumber,
        easypaisa_enabled: form.easypaisaEnabled,
        easypaisa_number: form.easypaisaNumber,
        cod_enabled: form.codEnabled,
        cod_delivery_areas: form.codDeliveryAreas,
        cod_delivery_charge: form.codDeliveryCharge,
        cod_free_above: form.codFreeAbove,
        cod_min_order: form.codMinOrder,
        industry: form.industry.toLowerCase(),
        tone: form.tone.toLowerCase(),
        response_length: form.responseLength.toLowerCase(),
        connection_type: form.connectionType,
        ...(form.accessToken ? { meta_access_token: form.accessToken } : {}),
        // Hotel fields (only sent if hotel industry)
        ...(form.industry.toLowerCase() === "hotel" ? {
          hotel_name:         form.hotelName,
          hotel_cancellation_policy: form.hotelCancellationPolicy,
          hotel_maps_url:     form.hotelMapsUrl,
          hotel_location:     form.hotelLocation,
          hotel_region:       form.hotelRegion,
          hotel_checkin_time:  form.hotelCheckinTime,
          hotel_checkout_time: form.hotelCheckoutTime,
          hotel_address:      form.hotelAddress,
          hotel_wifi_name:    form.hotelWifiName,
          hotel_wifi_password: form.hotelWifiPassword,
          hotel_parking_info: form.hotelParkingInfo,
          hotel_amenities:    form.hotelAmenities,
        } : {}),
      });
      setToast({ message: "Bot configuration saved!", type: "success" });
      window.dispatchEvent(new CustomEvent("botIndustryChanged", { detail: { industry: form.industry.toLowerCase() } }));
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
      <div className="card mb-5">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>5</span>
          WhatsApp Connection
        </h2>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => updateField("connectionType", "official")} className="flex-1 py-3 rounded-xl text-[13px] font-medium transition-all" style={{ background: form.connectionType === "official" ? "#1D9E75" : "#f8fafc", color: form.connectionType === "official" ? "#fff" : "#64748b", border: form.connectionType === "official" ? "1px solid #1D9E75" : "1px solid #e2e8f0" }}>
            Official API
          </button>
          <button onClick={() => updateField("connectionType", "quickconnect")} className="flex-1 py-3 rounded-xl text-[13px] font-medium transition-all" style={{ background: form.connectionType === "quickconnect" ? "#1D9E75" : "#f8fafc", color: form.connectionType === "quickconnect" ? "#fff" : "#64748b", border: form.connectionType === "quickconnect" ? "1px solid #1D9E75" : "1px solid #e2e8f0" }}>
            Quick Connect
          </button>
        </div>

        {form.connectionType === "official" ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Phone Number ID</label>
                <input className="form-input !bg-slate-100 !text-slate-500" value={form.phoneNumberId} readOnly />
              </div>
              <div>
                <label className="form-label">Connection Status</label>
                <div className="mt-2">
                  {form.connectionStatus === "connected" ? (
                    <span className="badge-active">Connected</span>
                  ) : form.connectionStatus === "pending" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "#fef3c7", color: "#92400e" }}>
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> Pending setup
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: "#fef2f2", color: "#b91c1c" }}>
                      <span className="w-2 h-2 rounded-full bg-red-400" /> Disconnected
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Access Token</label>
              <div className="relative">
                <input type="password" className="form-input !pr-20" value={form.accessToken} onChange={(e) => updateField("accessToken", e.target.value)} placeholder="Paste your Meta permanent access token" />
                {form.hasToken && !form.accessToken && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: "#ecfdf5", color: "#047857" }}>Token saved {"\u2713"}</span>
                )}
              </div>
            </div>
            <div className="p-3 rounded-xl text-[12px]" style={{ background: "#f0fdf4", border: "1px solid #a7f3d0", color: "#047857" }}>
              Need help? We can set up your WhatsApp connection for Rs. 2,000 one-time fee. Contact: support@waintel.ai
            </div>
          </div>
        ) : (
          <QuickConnectPanel botId={BOT_ID} />
        )}
      </div>

      {/* Section 6 — Payment Settings */}
      <div className="card mb-8">
        <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>6</span>
          Payment Settings
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* JazzCash */}
          <div className="p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-slate-800">{"\uD83D\uDFE0"} JazzCash</span>
              <button onClick={() => updateField("jazzcashEnabled", !form.jazzcashEnabled)} className="w-10 h-5 rounded-full relative transition-all" style={{ background: form.jazzcashEnabled ? "#e65100" : "#cbd5e1" }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.jazzcashEnabled ? "20px" : "2px" }} />
              </button>
            </div>
            {form.jazzcashEnabled && (
              <div>
                <label className="form-label">Merchant Number</label>
                <input className="form-input" value={form.jazzcashNumber} onChange={(e) => updateField("jazzcashNumber", e.target.value)} placeholder="03001234567" />
              </div>
            )}
          </div>

          {/* Easypaisa */}
          <div className="p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-slate-800">{"\uD83D\uDC9A"} Easypaisa</span>
              <button onClick={() => updateField("easypaisaEnabled", !form.easypaisaEnabled)} className="w-10 h-5 rounded-full relative transition-all" style={{ background: form.easypaisaEnabled ? "#1b5e20" : "#cbd5e1" }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.easypaisaEnabled ? "20px" : "2px" }} />
              </button>
            </div>
            {form.easypaisaEnabled && (
              <div>
                <label className="form-label">Merchant Number</label>
                <input className="form-input" value={form.easypaisaNumber} onChange={(e) => updateField("easypaisaNumber", e.target.value)} placeholder="03331234567" />
              </div>
            )}
          </div>

          {/* COD */}
          <div className="p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-slate-800">{"\uD83D\uDEF5"} Cash on Delivery</span>
              <button onClick={() => updateField("codEnabled", !form.codEnabled)} className="w-10 h-5 rounded-full relative transition-all" style={{ background: form.codEnabled ? "#0d47a1" : "#cbd5e1" }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.codEnabled ? "20px" : "2px" }} />
              </button>
            </div>
            {form.codEnabled && (
              <div className="space-y-3">
                <div>
                  <label className="form-label">Delivery Areas</label>
                  <input className="form-input" value={form.codDeliveryAreas} onChange={(e) => updateField("codDeliveryAreas", e.target.value)} placeholder="Gulshan, PECHS, Defence" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="form-label">Delivery Rs.</label>
                    <input type="number" className="form-input" value={form.codDeliveryCharge} onChange={(e) => updateField("codDeliveryCharge", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="form-label">Free Above Rs.</label>
                    <input type="number" className="form-input" value={form.codFreeAbove} onChange={(e) => updateField("codFreeAbove", parseInt(e.target.value) || 0)} />
                  </div>
                  <div>
                    <label className="form-label">Min Order Rs.</label>
                    <input type="number" className="form-input" value={form.codMinOrder} onChange={(e) => updateField("codMinOrder", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stripe — coming soon */}
          <div className="p-4 rounded-xl border border-slate-200 opacity-60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[14px] font-semibold text-slate-800">{"\uD83D\uDCB3"} Stripe</span>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-500">COMING SOON</span>
            </div>
            <p className="text-[12px] text-slate-400">International card payments. Available in Phase 3.</p>
          </div>
        </div>
      </div>

      {/* Section 7 — Hotel Configuration (hotel industry only) */}
      {form.industry.toLowerCase() === "hotel" && (
        <div className="card mb-5">
          <h2 className="text-[16px] font-bold text-slate-800 mb-5 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "#1D9E75" }}>7</span>
            Hotel Configuration
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
            <div>
              <label className="form-label">Hotel Name</label>
              <input className="form-input" value={form.hotelName} onChange={(e) => updateField("hotelName", e.target.value)} placeholder="Mountain View Guest House" />
            </div>
            <div>
              <label className="form-label">Google Maps Link</label>
              <input className="form-input" value={form.hotelMapsUrl} onChange={(e) => updateField("hotelMapsUrl", e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Cancellation Policy</label>
            <textarea className="form-input" rows={2} value={form.hotelCancellationPolicy} onChange={(e) => updateField("hotelCancellationPolicy", e.target.value)} placeholder="Free cancellation 48 hours before check-in. No refund after that." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
            <div>
              <label className="form-label">Hotel Location</label>
              <input className="form-input" value={form.hotelLocation} onChange={(e) => updateField("hotelLocation", e.target.value)} placeholder="Karimabad, Hunza, Gilgit-Baltistan" />
            </div>
            <div>
              <label className="form-label">Region</label>
              <select className="form-input" value={form.hotelRegion} onChange={(e) => updateField("hotelRegion", e.target.value)}>
                {HOTEL_REGIONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Check-in Time</label>
              <input className="form-input" value={form.hotelCheckinTime} onChange={(e) => updateField("hotelCheckinTime", e.target.value)} placeholder="2:00 PM" />
            </div>
            <div>
              <label className="form-label">Check-out Time</label>
              <input className="form-input" value={form.hotelCheckoutTime} onChange={(e) => updateField("hotelCheckoutTime", e.target.value)} placeholder="12:00 PM" />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Hotel Address</label>
            <textarea className="form-input" rows={2} value={form.hotelAddress} onChange={(e) => updateField("hotelAddress", e.target.value)} placeholder="Full address for guest directions" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-4">
            <div>
              <label className="form-label">WiFi Name</label>
              <input className="form-input" value={form.hotelWifiName} onChange={(e) => updateField("hotelWifiName", e.target.value)} placeholder="HotelGuest_5G" />
            </div>
            <div>
              <label className="form-label">WiFi Password</label>
              <input className="form-input" value={form.hotelWifiPassword} onChange={(e) => updateField("hotelWifiPassword", e.target.value)} placeholder="wifi password" />
            </div>
          </div>

          <div className="mb-4">
            <label className="form-label">Parking Info</label>
            <input className="form-input" value={form.hotelParkingInfo} onChange={(e) => updateField("hotelParkingInfo", e.target.value)} placeholder="Free parking available / Street parking only" />
          </div>

          <div>
            <label className="form-label">Amenities</label>
            <textarea className="form-input" rows={2} value={form.hotelAmenities} onChange={(e) => updateField("hotelAmenities", e.target.value)} placeholder="Free WiFi, Breakfast included, Hot water, Mountain view, Restaurant, Laundry" />
          </div>
        </div>
      )}

      <button className="btn-primary text-[15px] px-8 py-3" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Configuration"}
      </button>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// Quick Connect QR Panel
function QuickConnectPanel({ botId }: { botId: string }) {
  const [qcStatus, setQcStatus] = useState<string>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const startConnect = async () => {
    setPolling(false);
    setQrCode(null);
    setQcStatus("connecting");
    try {
      await axios.post(`${API}/api/bots/${botId}/quickconnect/start`);
      setPolling(true);
    } catch (err: any) {
      console.error("Quick connect start failed:", err.response?.data || err.message);
      setQcStatus("error");
    }
  };

  const disconnect = async () => {
    try {
      await axios.post(`${API}/api/bots/${botId}/quickconnect/disconnect`);
      setQcStatus("idle");
      setQrCode(null);
      setPhone(null);
    } catch { /* silent */ }
  };

  // Poll for QR/status (timeout after 45 seconds)
  useEffect(() => {
    if (!polling || !botId) return;
    const timeout = setTimeout(() => {
      setPolling(false);
      setQcStatus((s) => s === "connecting" ? "error" : s);
    }, 45000);
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/api/bots/${botId}/quickconnect/qr`);
        if (res.data.status === "qr_ready" && res.data.qrCode) {
          setQcStatus("qr_ready");
          setQrCode(res.data.qrCode);
        } else if (res.data.status === "connected") {
          setQcStatus("connected");
          setPhone(res.data.phone);
          setQrCode(null);
          setPolling(false);
        } else if (res.data.status === "connecting") {
          setQcStatus("connecting");
        }
      } catch (err: any) {
        // 404 = session never started (backend error) — stop polling and surface the error
        if (err.response?.status === 404) {
          setPolling(false);
          setQcStatus("error");
        }
        // other errors (network blip) — keep polling silently
      }
    }, 3000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [polling, botId]);

  if (qcStatus === "connected") {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(16,185,129,0.1)" }}>
          <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-[16px] font-bold text-slate-800 mb-1">WhatsApp Connected!</p>
        {phone && <p className="text-[13px] text-slate-500 mb-1">Number: +{phone}</p>}
        <p className="text-[12px] text-slate-400 mb-4">Your bot is live on your existing WhatsApp number.</p>
        <button onClick={disconnect} className="btn-danger text-[12px] !py-1.5 !px-4">Disconnect</button>
      </div>
    );
  }

  if (qcStatus === "qr_ready" && qrCode) {
    return (
      <div className="text-center py-4">
        <p className="text-[14px] font-bold text-slate-800 mb-3">Scan with WhatsApp</p>
        <img src={qrCode} alt="QR Code" className="mx-auto mb-4 rounded-xl" style={{ width: 220, height: 220 }} />
        <div className="text-[12px] text-slate-500 space-y-1 mb-4">
          <p>1. Open WhatsApp on your phone</p>
          <p>2. Settings → Linked Devices</p>
          <p>3. Link a Device → scan this code</p>
        </div>
        <button onClick={startConnect} className="btn-secondary text-[12px]">Refresh QR</button>
      </div>
    );
  }

  if (qcStatus === "connecting") {
    return (
      <div className="text-center py-8">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-[#1D9E75] rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[14px] text-slate-500">Generating QR code...</p>
        <p className="text-[12px] text-slate-400 mt-1">This can take up to 30 seconds</p>
      </div>
    );
  }

  // idle / error
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(29,158,117,0.08)" }}>
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-[15px] font-bold text-slate-800 mb-2">Connect your existing WhatsApp</p>
      <p className="text-[12px] text-slate-400 mb-1">Your number stays the same. No Meta registration needed.</p>
      <p className="text-[12px] text-slate-400 mb-5">Setup takes 2 minutes.</p>
      {qcStatus === "error" && (
        <div className="mb-3 p-3 rounded-xl text-[12px]" style={{ background: "#fef2f2", color: "#b91c1c" }}>
          Could not start session. Make sure the backend server is running, then try again.
        </div>
      )}
      <button onClick={startConnect} className="btn-primary">
        {qcStatus === "error" ? "Try Again →" : "Start Quick Connect →"}
      </button>
    </div>
  );
}
