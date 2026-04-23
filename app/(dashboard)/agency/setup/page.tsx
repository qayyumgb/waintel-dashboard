"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface AgencyDraft {
  name: string;
  slug: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  customDomain: string;
  dashboardTitle: string;
  supportEmail: string;
  supportPhone: string;
  hideWaintelBranding: boolean;
  customCss: string;
}

const EMPTY: AgencyDraft = {
  name: "", slug: "", logoUrl: "", faviconUrl: "",
  primaryColor: "#0D9488", secondaryColor: "#134E4A",
  customDomain: "", dashboardTitle: "",
  supportEmail: "", supportPhone: "",
  hideWaintelBranding: true, customCss: "",
};

export default function AgencySetupPage() {
  const { tenantId, loading: authLoading } = useAuth();
  const [draft, setDraft] = useState<AgencyDraft>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await axios.get(`${API}/api/agency/profile?tenantId=${tenantId}`);
      if (data.agency) {
        setDraft({
          name: data.agency.name || "",
          slug: data.agency.slug || "",
          logoUrl: data.agency.logo_url || "",
          faviconUrl: data.agency.favicon_url || "",
          primaryColor: data.agency.primary_color || "#0D9488",
          secondaryColor: data.agency.secondary_color || "#134E4A",
          customDomain: data.agency.custom_domain || "",
          dashboardTitle: data.agency.dashboard_title || "",
          supportEmail: data.agency.support_email || "",
          supportPhone: data.agency.support_phone || "",
          hideWaintelBranding: data.agency.hide_waintel_branding ?? true,
          customCss: data.agency.custom_css || "",
        });
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!tenantId) return;
    if (!draft.name || !draft.slug) {
      setToast({ message: "Name and slug required", type: "error" });
      return;
    }
    if (!/^[a-z0-9-]{2,40}$/.test(draft.slug)) {
      setToast({ message: "Slug: 2-40 lowercase letters/numbers/hyphens only", type: "error" });
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/api/agency/profile`, { tenantId, ...draft });
      setToast({ message: "Saved — preview opens in new tab", type: "success" });
      window.dispatchEvent(new CustomEvent("agencyProfileChanged"));
      const url = `${window.location.origin}/?agency=${draft.slug}`;
      setPreviewUrl(url);
      window.open(url, "_blank");
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  if (authLoading || loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  const slugUrl = draft.slug ? `${draft.slug}.waintel.ai/dashboard` : "<slug>.waintel.ai/dashboard";

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-7xl">
      <div className="mb-8">
        <div className="page-breadcrumb">⚙️ White-Label Setup</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">White-Label Configuration</h1>
        <p className="text-[16px] text-slate-500">Brand the dashboard your clients see — logo, colors, domain, and support contact.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Brand identity */}
          <div className="card">
            <h2 className="text-[16px] font-bold text-slate-800 mb-4">🎨 Brand Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Agency Name *</label>
                <input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="TechSolutions Agency" />
              </div>
              <div>
                <label className="form-label">Slug *</label>
                <input className="form-input" value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  placeholder="techsolutions" />
                <div className="text-[11px] text-slate-500 mt-1">Your clients access: <span className="font-mono text-slate-700">{slugUrl}</span></div>
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Dashboard Title</label>
                <input className="form-input" value={draft.dashboardTitle} onChange={(e) => setDraft({ ...draft, dashboardTitle: e.target.value })} placeholder="TechSolutions Client Portal" />
                <div className="text-[11px] text-slate-500 mt-1">Shown in browser tab title</div>
              </div>
              <div>
                <label className="form-label">Logo URL</label>
                <input className="form-input" value={draft.logoUrl} onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })} placeholder="https://yoursite.com/logo.png" />
                <div className="text-[11px] text-slate-500 mt-1">Square image, ~128×128px recommended</div>
              </div>
              <div>
                <label className="form-label">Favicon URL</label>
                <input className="form-input" value={draft.faviconUrl} onChange={(e) => setDraft({ ...draft, faviconUrl: e.target.value })} placeholder="https://yoursite.com/favicon.ico" />
              </div>
            </div>
          </div>

          {/* Brand colors */}
          <div className="card">
            <h2 className="text-[16px] font-bold text-slate-800 mb-4">🎨 Brand Colors</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })}
                    className="w-12 h-10 rounded border border-slate-300 cursor-pointer" />
                  <input className="form-input flex-1 font-mono" value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="form-label">Secondary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })}
                    className="w-12 h-10 rounded border border-slate-300 cursor-pointer" />
                  <input className="form-input flex-1 font-mono" value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Contact info */}
          <div className="card">
            <h2 className="text-[16px] font-bold text-slate-800 mb-4">📞 Contact & Branding</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Support Email</label>
                <input className="form-input" type="email" value={draft.supportEmail} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} placeholder="support@youragency.com" />
              </div>
              <div>
                <label className="form-label">Support Phone</label>
                <input className="form-input" value={draft.supportPhone} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} placeholder="03001234567" />
              </div>
            </div>
            <label className="flex items-center justify-between p-3 mt-4 rounded-xl cursor-pointer" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid #e5e7eb" }}>
              <div>
                <div className="text-[13px] font-semibold text-slate-800">Hide "Powered by Waintel" branding</div>
                <div className="text-[11px] text-slate-500">Recommended ON for full white-label</div>
              </div>
              <input type="checkbox" checked={draft.hideWaintelBranding} onChange={(e) => setDraft({ ...draft, hideWaintelBranding: e.target.checked })} className="sr-only peer" />
              <div className="relative w-11 h-6 bg-slate-200 peer-checked:bg-[#1D9E75] rounded-full transition-colors">
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft.hideWaintelBranding ? "translate-x-5" : ""}`} />
              </div>
            </label>
          </div>

          {/* Custom domain */}
          <div className="card">
            <h2 className="text-[16px] font-bold text-slate-800 mb-4">🌐 Custom Domain (Advanced)</h2>
            <input className="form-input font-mono text-[13px]" value={draft.customDomain} onChange={(e) => setDraft({ ...draft, customDomain: e.target.value })} placeholder="dashboard.youragency.com" />
            <div className="text-[11px] text-slate-500 mt-2">
              Add a CNAME record pointing to: <span className="font-mono text-slate-700">waintel-dashboard.vercel.app</span>
            </div>
          </div>

          {/* Custom CSS */}
          <div className="card">
            <h2 className="text-[16px] font-bold text-slate-800 mb-4">💅 Custom CSS (Advanced)</h2>
            <textarea className="form-input font-mono text-[11px]" rows={6}
              value={draft.customCss} onChange={(e) => setDraft({ ...draft, customCss: e.target.value })}
              placeholder=".my-class { color: red; }" />
          </div>

          <div className="flex gap-3">
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : "Save & Preview"}</button>
            {previewUrl && (
              <a href={previewUrl} target="_blank" rel="noreferrer" className="btn-secondary">Open preview ↗</a>
            )}
          </div>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-1">
          <div className="sticky top-3">
            <div className="text-[12px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Live Preview</div>
            <div className="rounded-xl overflow-hidden shadow-lg" style={{ height: 320, background: `linear-gradient(180deg, ${draft.primaryColor} 0%, ${draft.secondaryColor} 100%)` }}>
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
                  {draft.logoUrl
                    ? <img src={draft.logoUrl} alt="" className="w-full h-full object-cover" />
                    : (draft.name || "W").charAt(0).toUpperCase()}
                </div>
                <div className="text-white text-[13px] font-bold truncate">{draft.name || "Your Agency"}</div>
              </div>
              <div className="px-4 space-y-1.5 mt-2">
                {["Dashboard", "Conversations", "Reports", "Clients"].map((label, i) => (
                  <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] text-white"
                    style={{ background: i === 0 ? "rgba(255,255,255,0.15)" : "transparent" }}>
                    <div className="w-5 h-5 rounded bg-white/20" />
                    {label}
                  </div>
                ))}
              </div>
              {!draft.hideWaintelBranding && (
                <div className="absolute bottom-2 left-0 right-0 text-center text-white/40 text-[10px]">Powered by Waintel</div>
              )}
            </div>
            <div className="mt-3 text-[11px] text-slate-500">
              Open <span className="font-mono">/?agency={draft.slug || "<slug>"}</span> in a new tab to test.
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
