"use client";

import { useState, useRef } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const INDUSTRIES = ["Restaurant", "Pharmacy", "Real Estate", "Hotel", "E-commerce", "Education", "Other"];

interface Errors {
  businessName?: string;
  description?: string;
  escalationNumber?: string;
}

export default function OnboardingPage() {
  const { botId } = useAuth();
  const BOT_ID = botId || "";
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<Errors>({});

  // Step 2
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("Restaurant");
  const [description, setDescription] = useState("");

  // Step 3
  const [uploadMode, setUploadMode] = useState<"text" | "file" | "url">("text");
  const [kbText, setKbText] = useState("");
  const [kbUrl, setKbUrl] = useState("");
  const [kbChunks, setKbChunks] = useState(0);
  const [kbUploading, setKbUploading] = useState(false);

  // Step 4
  const [language, setLanguage] = useState("Auto-detect");
  const [escalationNumber, setEscalationNumber] = useState("+92");
  const [outsideMsg, setOutsideMsg] = useState("Hamari timing abhi khatam ho gayi hai. Kal subah message karein!");
  const [testQuestion, setTestQuestion] = useState("");
  const [testReply, setTestReply] = useState("");
  const [testLoading, setTestLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const prev = () => setStep((s) => Math.max(s - 1, 1));

  // --- Validation ---
  const validateStep2 = (): boolean => {
    const errs: Errors = {};
    if (!businessName.trim()) errs.businessName = "Business name is required";
    else if (businessName.trim().length < 2) errs.businessName = "Name must be at least 2 characters";
    if (!description.trim()) errs.description = "Please describe your business so the AI knows what you do";
    else if (description.trim().length < 20) errs.description = "Description too short — add more detail (at least 20 chars)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep4 = (): boolean => {
    const errs: Errors = {};
    if (escalationNumber && escalationNumber !== "+92" && !/^\+92\d{10}$/.test(escalationNumber)) {
      errs.escalationNumber = "Enter a valid PK number: +92XXXXXXXXXX";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goToStep3 = () => {
    if (validateStep2()) setStep(3);
  };

  const goToStep5 = () => {
    if (validateStep4()) {
      saveBotConfig();
      setStep(5);
    }
  };

  // --- Knowledge upload ---
  const handleKbText = async () => {
    if (!kbText.trim()) { setToast({ message: "Paste some text first", type: "error" }); return; }
    setKbUploading(true);
    try {
      const res = await axios.post(`${API}/api/knowledge/text`, {
        botId: BOT_ID,
        content: kbText,
        sourceName: `${businessName || "business"}-info`,
      });
      setKbChunks(res.data.chunksCreated);
      setToast({ message: `Knowledge base ready (${res.data.chunksCreated} chunks)`, type: "success" });
      setStep(4);
    } catch {
      setToast({ message: "Failed to upload knowledge", type: "error" });
    } finally {
      setKbUploading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setKbUploading(true);
    try {
      const fd = new FormData();
      fd.append("botId", BOT_ID);
      fd.append("file", file);
      const res = await axios.post(`${API}/api/knowledge/upload`, fd);
      setKbChunks(res.data.chunksCreated);
      setToast({ message: `Uploaded ${res.data.filename} (${res.data.chunksCreated} chunks)`, type: "success" });
      setStep(4);
    } catch {
      setToast({ message: "File upload failed", type: "error" });
    } finally {
      setKbUploading(false);
    }
  };

  const handleKbUrl = async () => {
    if (!kbUrl.trim()) { setToast({ message: "Enter a URL first", type: "error" }); return; }
    if (!/^https?:\/\/.+/.test(kbUrl)) { setToast({ message: "Enter a valid URL starting with http:// or https://", type: "error" }); return; }
    setKbUploading(true);
    try {
      const res = await axios.post(`${API}/api/knowledge/url`, {
        botId: BOT_ID,
        url: kbUrl,
        sourceName: kbUrl,
      });
      setKbChunks(res.data.chunksCreated);
      setToast({ message: `Scraped website (${res.data.chunksCreated} chunks)`, type: "success" });
      setStep(4);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to scrape URL";
      setToast({ message: msg || "Failed to scrape URL", type: "error" });
    } finally {
      setKbUploading(false);
    }
  };

  const handleKbSubmit = () => {
    if (uploadMode === "text") handleKbText();
    else if (uploadMode === "url") handleKbUrl();
    else fileRef.current?.click();
  };

  const isKbDisabled = () => {
    if (kbUploading) return true;
    if (uploadMode === "text") return !kbText.trim();
    if (uploadMode === "url") return !kbUrl.trim();
    return false;
  };

  // --- Bot config ---
  const saveBotConfig = async () => {
    try {
      const tone = " Be warm, friendly, and conversational.";
      const systemPrompt = `You are a helpful WhatsApp assistant for ${businessName}, a ${industry.toLowerCase()} business. ${description}${tone} Reply in the same language the customer uses. Keep replies concise.`;
      await axios.patch(`${API}/api/bots/${BOT_ID}`, {
        display_name: businessName,
        system_prompt: systemPrompt,
        language: language === "Auto-detect" ? "auto" : language.toLowerCase(),
        escalation_number: escalationNumber,
      });
    } catch { /* best-effort */ }
  };

  const testBot = async () => {
    if (!testQuestion.trim()) return;
    setTestLoading(true);
    setTestReply("");
    try {
      await saveBotConfig();
      const res = await axios.post(`${API}/api/test-bot`, { botId: BOT_ID, question: testQuestion });
      setTestReply(res.data.reply);
    } catch {
      setTestReply("Test failed — check backend connection.");
    } finally {
      setTestLoading(false);
    }
  };

  const modeBtn = (mode: "text" | "file" | "url", label: string) => (
    <button
      onClick={() => setUploadMode(mode)}
      className="flex-1 py-3 rounded-xl text-[13px] font-medium transition-all"
      style={{
        background: uploadMode === mode ? "#1D9E75" : "#f8fafc",
        color: uploadMode === mode ? "#fff" : "#64748b",
        border: uploadMode === mode ? "1px solid #1D9E75" : "1px solid #e2e8f0",
      }}
    >
      {label}
    </button>
  );

  const fieldError = (msg?: string) =>
    msg ? <p className="text-[12px] text-red-500 mt-1">{msg}</p> : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-8 animate-fade-in">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">Step {step} of 5</span>
            <span className="text-[12px] text-slate-400">{Math.round((step / 5) * 100)}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(step / 5) * 100}%`, background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}
            />
          </div>
        </div>

        <div className="card">
          {/* Step 1 — Welcome */}
          {step === 1 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl font-bold text-white" style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}>
                W
              </div>
              <h1 className="text-[28px] font-bold text-slate-900 mb-3">Welcome to Waintel.ai!</h1>
              <p className="text-[16px] text-slate-500 max-w-md mx-auto mb-8">
                Let&apos;s set up your WhatsApp AI agent in under 10 minutes. Your bot will handle customer messages 24/7.
              </p>
              <button className="btn-primary !py-3 !px-8 text-[15px]" onClick={() => setStep(2)}>
                Let&apos;s Get Started
              </button>
            </div>
          )}

          {/* Step 2 — Business Info */}
          {step === 2 && (
            <div>
              <h2 className="text-[22px] font-bold text-slate-900 mb-2">Tell us about your business</h2>
              <p className="text-[14px] text-slate-500 mb-6">This helps your AI agent understand your business context.</p>

              <div className="space-y-4">
                <div>
                  <label className="form-label">Business Name <span className="text-red-400">*</span></label>
                  <input
                    className="form-input"
                    value={businessName}
                    onChange={(e) => { setBusinessName(e.target.value); setErrors((p) => ({ ...p, businessName: undefined })); }}
                    placeholder="e.g. Al-Noor Restaurant"
                    style={errors.businessName ? { borderColor: "#ef4444" } : {}}
                  />
                  {fieldError(errors.businessName)}
                </div>
                <div>
                  <label className="form-label">Industry <span className="text-red-400">*</span></label>
                  <select className="form-input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                    {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Business Description <span className="text-red-400">*</span></label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: undefined })); }}
                    placeholder="What does your business do? What products/services do you offer? Where are you located?"
                    style={errors.description ? { borderColor: "#ef4444" } : {}}
                  />
                  {fieldError(errors.description)}
                  <p className="text-[11px] text-slate-400 mt-1">{description.length}/500 characters</p>
                </div>
              </div>

              <div className="flex justify-between mt-8">
                <button className="btn-secondary" onClick={prev}>Back</button>
                <button className="btn-primary" onClick={goToStep3}>Next</button>
              </div>
            </div>
          )}

          {/* Step 3 — Knowledge Base */}
          {step === 3 && (
            <div>
              <h2 className="text-[22px] font-bold text-slate-900 mb-2">Add your knowledge base</h2>
              <p className="text-[14px] text-slate-500 mb-6">
                Your AI agent uses this to answer customer questions. Choose one method below.
              </p>

              <div className="flex gap-2 mb-5">
                {modeBtn("text", "Paste Text")}
                {modeBtn("file", "Upload File")}
                {modeBtn("url", "Scrape Website")}
              </div>

              {uploadMode === "text" && (
                <textarea
                  className="form-input mb-4"
                  rows={6}
                  value={kbText}
                  onChange={(e) => setKbText(e.target.value)}
                  placeholder="Paste your menu, services, FAQ, pricing, hours, location, delivery info..."
                />
              )}

              {uploadMode === "file" && (
                <div
                  className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center mb-4 cursor-pointer hover:border-[#1D9E75] transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(29,158,117,0.08)" }}>
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-medium text-slate-600 mb-1">Click to upload PDF, DOCX, or TXT</p>
                  <p className="text-[12px] text-slate-400">Max 10MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                </div>
              )}

              {uploadMode === "url" && (
                <div className="mb-4">
                  <input
                    className="form-input"
                    value={kbUrl}
                    onChange={(e) => setKbUrl(e.target.value)}
                    placeholder="https://yourbusiness.com/about"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    We&apos;ll scrape the page content and add it to your knowledge base.
                  </p>
                </div>
              )}

              {kbUploading && (
                <div className="flex items-center gap-3 p-3 rounded-xl mb-4" style={{ background: "#f0fdf4", border: "1px solid #a7f3d0" }}>
                  <div className="w-5 h-5 border-2 border-slate-200 border-t-[#1D9E75] rounded-full animate-spin" />
                  <span className="text-[13px] text-slate-600">Processing your knowledge base...</span>
                </div>
              )}

              <div className="flex justify-between mt-4">
                <button className="btn-secondary" onClick={prev}>Back</button>
                <div className="flex gap-2">
                  <button className="btn-secondary" onClick={() => setStep(4)}>Skip for now</button>
                  <button className="btn-primary" onClick={handleKbSubmit} disabled={isKbDisabled()}>
                    {kbUploading ? "Processing..." : uploadMode === "url" ? "Scrape & Continue" : "Upload & Continue"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Configure AI */}
          {step === 4 && (
            <div>
              <h2 className="text-[22px] font-bold text-slate-900 mb-2">Configure your AI</h2>
              <p className="text-[14px] text-slate-500 mb-6">Set preferences and test your bot before going live.</p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="form-label">Response Language</label>
                  <select className="form-input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                    {["Auto-detect", "Urdu", "English", "Arabic"].map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Escalation Phone Number</label>
                  <input
                    className="form-input"
                    value={escalationNumber}
                    onChange={(e) => { setEscalationNumber(e.target.value); setErrors((p) => ({ ...p, escalationNumber: undefined })); }}
                    placeholder="+923001234567"
                    style={errors.escalationNumber ? { borderColor: "#ef4444" } : {}}
                  />
                  {fieldError(errors.escalationNumber)}
                  <p className="text-[11px] text-slate-400 mt-1">Customers get transferred here when they ask for a human</p>
                </div>
                <div>
                  <label className="form-label">Outside Hours Message</label>
                  <textarea className="form-input" rows={2} value={outsideMsg} onChange={(e) => setOutsideMsg(e.target.value)} />
                </div>
              </div>

              {/* Test bot */}
              <div className="p-4 rounded-xl mb-6" style={{ background: "#f0fdf4", border: "1px solid #a7f3d0" }}>
                <h3 className="text-[14px] font-bold text-slate-800 mb-3">Test Your Bot</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    className="form-input flex-1"
                    value={testQuestion}
                    onChange={(e) => setTestQuestion(e.target.value)}
                    placeholder="Ask your bot a question..."
                    onKeyDown={(e) => { if (e.key === "Enter") testBot(); }}
                  />
                  <button className="btn-primary shrink-0" onClick={testBot} disabled={testLoading || !testQuestion.trim()}>
                    {testLoading ? "..." : "Ask"}
                  </button>
                </div>
                {testReply && (
                  <div className="p-3 rounded-lg text-[13px] text-slate-700 leading-relaxed" style={{ background: "white", border: "1px solid #e2e8f0" }}>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">AI Reply:</span>
                    <div className="mt-1 whitespace-pre-line">{testReply}</div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button className="btn-secondary" onClick={prev}>Back</button>
                <button className="btn-primary" onClick={goToStep5}>Next</button>
              </div>
            </div>
          )}

          {/* Step 5 — Go Live */}
          {step === 5 && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(16,185,129,0.1)" }}>
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#10b981" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-[24px] font-bold text-slate-900 mb-2">You&apos;re Ready to Go Live!</h2>
              <p className="text-[14px] text-slate-500 mb-8 max-w-md mx-auto">
                Your AI agent is configured and ready to handle WhatsApp messages.
              </p>

              <div className="card text-left mb-6">
                <h3 className="text-[14px] font-bold text-slate-800 mb-4">Setup Summary</h3>
                <div className="space-y-3 text-[13px]">
                  <div className="flex justify-between"><span className="text-slate-500">Business</span><span className="font-medium text-slate-800">{businessName}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Industry</span><span className="font-medium text-slate-800">{industry}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Knowledge</span><span className="font-medium text-slate-800">{kbChunks} chunks loaded</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Language</span><span className="font-medium text-slate-800">{language}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Escalation</span><span className="font-medium text-slate-800">{escalationNumber}</span></div>
                </div>
              </div>

              <div className="card text-left mb-8">
                <h3 className="text-[14px] font-bold text-slate-800 mb-4">WhatsApp Connection</h3>
                <div className="space-y-3 text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Bot Number</span>
                    <span className="font-mono font-medium text-slate-800">+1 555 151 1085</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Webhook URL</span>
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] bg-slate-100 px-2 py-1 rounded">{API}/webhook</code>
                      <button className="text-[11px] text-[#1D9E75] font-semibold hover:underline" onClick={() => { navigator.clipboard.writeText(`${API}/webhook`); setToast({ message: "Copied!", type: "success" }); }}>Copy</button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Status</span>
                    <span className="badge-active">Ready to receive</span>
                  </div>
                </div>
              </div>

              <a href="/" className="btn-primary !py-3 !px-8 text-[15px] inline-flex">
                Open Dashboard
              </a>
            </div>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
