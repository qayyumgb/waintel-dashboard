"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Doctor = {
  id: string; name: string; specialization: string | null;
  qualification: string | null; experience_years: number | null;
  consultation_fee: string | null; available_days: string | null;
  available_times: string | null; is_available: boolean;
};

type ImportedDoctor = {
  name: string; specialization?: string | null; qualification?: string | null;
  experience_years?: number | null; consultation_fee?: number | null;
  available_days?: string | null; available_times?: string | null;
};

export default function DoctorsPage() {
  const { botId } = useAuth();
  const BOT_ID = botId || "";
  const [industry, setIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!BOT_ID) return;
    axios.get(`${API}/api/bots/${BOT_ID}`)
      .then((r) => setIndustry((r.data.industry || "").toLowerCase()))
      .catch(() => setIndustry(""))
      .finally(() => setLoading(false));
  }, [BOT_ID]);

  if (loading) return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;

  const isHealth = industry === "health" || industry === "clinic" || industry === "healthcare";
  if (!isHealth) {
    return (
      <div className="p-3 md:p-8 max-w-4xl">
        <div className="card text-center py-16">
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">Doctors page is for Health industry only</h2>
          <p className="text-[13px] text-slate-500 mb-5">Switch your bot&apos;s industry to <b>Health</b> in Bot Setup.</p>
          <a href="/bot-setup" className="btn-primary text-[13px] inline-block">Go to Bot Setup</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">👨‍⚕️ Doctors</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Doctor Management</h1>
        <p className="text-[16px] text-slate-500">Manage your clinic&apos;s doctors. Import from a website URL or your knowledge base.</p>
      </div>
      <DoctorsCatalog botId={BOT_ID} />
    </div>
  );
}

function DoctorsCatalog({ botId }: { botId: string }) {
  const { tenantId } = useAuth();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", specialization: "", qualification: "", experienceYears: "", consultationFee: "", availableDays: "Mon, Tue, Wed, Thu, Fri, Sat", availableTimes: "9:00am - 1:00pm, 5:00pm - 8:00pm" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedDoctor[] | null>(null);
  const [importSource, setImportSource] = useState("");
  const [urlPromptOpen, setUrlPromptOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/clinic/doctors?botId=${botId}`); setDoctors(r.data.doctors || []); } catch {} finally { setLoading(false); }
  }, [botId]);
  useEffect(() => { load(); }, [load]);

  const startImport = async (source: "kb") => {
    setImportMenuOpen(false); setImporting(source);
    try {
      const r = await axios.post(`${API}/api/clinic/doctors/import/${source}/preview`, { botId });
      if (!r.data.preview?.length) { setToast({ message: "No doctors found", type: "error" }); return; }
      setImportSource(source); setImportPreview(r.data.preview);
    } catch (err: any) { setToast({ message: err.response?.data?.error || "Import failed", type: "error" }); }
    finally { setImporting(null); }
  };

  const startUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlPromptOpen(false); setImporting("url");
    try {
      const r = await axios.post(`${API}/api/clinic/doctors/import/url/preview`, { url: urlInput });
      if (!r.data.preview?.length) { setToast({ message: "No doctors found on this page", type: "error" }); return; }
      setImportSource("url"); setImportPreview(r.data.preview);
    } catch (err: any) { setToast({ message: err.response?.data?.error || "Scrape failed", type: "error" }); }
    finally { setImporting(null); setUrlInput(""); }
  };

  const confirmImport = async (selected: ImportedDoctor[]) => {
    try {
      const r = await axios.post(`${API}/api/clinic/doctors/bulk`, { botId, tenantId, doctors: selected });
      setToast({ message: `Imported ${r.data.imported} doctors`, type: "success" });
      setImportPreview(null); load();
    } catch { setToast({ message: "Import failed", type: "error" }); }
  };

  const addDoctor = async () => {
    if (!draft.name.trim()) { setToast({ message: "Name required", type: "error" }); return; }
    try {
      await axios.post(`${API}/api/clinic/doctors`, { botId, tenantId, name: draft.name, specialization: draft.specialization || null, qualification: draft.qualification || null, experienceYears: parseInt(draft.experienceYears) || null, consultationFee: parseFloat(draft.consultationFee) || null, availableDays: draft.availableDays, availableTimes: draft.availableTimes });
      setShowForm(false); setDraft({ name: "", specialization: "", qualification: "", experienceYears: "", consultationFee: "", availableDays: "Mon, Tue, Wed, Thu, Fri, Sat", availableTimes: "9:00am - 1:00pm, 5:00pm - 8:00pm" });
      setToast({ message: "Doctor added", type: "success" }); load();
    } catch { setToast({ message: "Failed to add", type: "error" }); }
  };

  const toggleAvailable = async (id: string, cur: boolean) => { try { await axios.patch(`${API}/api/clinic/doctors/${id}`, { isAvailable: !cur }); load(); } catch {} };
  const deleteDoctor = async (id: string) => { if (!confirm("Delete this doctor?")) return; try { await axios.delete(`${API}/api/clinic/doctors/${id}`); load(); } catch {} };

  return (
    <div className="card mb-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-slate-800">Doctors ({doctors.length})</h2>
        <div className="flex items-center gap-2 relative">
          <button className="btn-secondary text-[12px]" onClick={() => setImportMenuOpen(!importMenuOpen)} disabled={!!importing}>
            {importing ? `Importing from ${importing}...` : "Import Doctors ▾"}
          </button>
          <button className="btn-secondary text-[12px]" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add Manually"}</button>
          {importMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
              <button className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2" onClick={() => { setImportMenuOpen(false); setUrlPromptOpen(true); }}>
                <span>🌐</span> From Website URL
              </button>
              <button className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100" onClick={() => startImport("kb")}>
                <span>📄</span> From Knowledge Base
              </button>
            </div>
          )}
        </div>
      </div>

      {urlPromptOpen && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <label className="form-label">Website URL (e.g. clinic&apos;s &quot;Our Doctors&quot; page)</label>
          <div className="flex gap-2">
            <input className="form-input flex-1" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://myclinic.com/doctors" onKeyDown={(e) => e.key === "Enter" && startUrlImport()} />
            <button className="btn-primary text-[12px]" onClick={startUrlImport} disabled={!urlInput.trim()}>Scrape</button>
            <button className="btn-secondary text-[12px]" onClick={() => { setUrlPromptOpen(false); setUrlInput(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div><label className="form-label">Full Name</label><input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ahmed Khan" /></div>
            <div><label className="form-label">Specialization</label><input className="form-input" value={draft.specialization} onChange={(e) => setDraft({ ...draft, specialization: e.target.value })} placeholder="Cardiologist" /></div>
            <div><label className="form-label">Qualification</label><input className="form-input" value={draft.qualification} onChange={(e) => setDraft({ ...draft, qualification: e.target.value })} placeholder="MBBS, FCPS" /></div>
            <div><label className="form-label">Experience (years)</label><input type="number" className="form-input" value={draft.experienceYears} onChange={(e) => setDraft({ ...draft, experienceYears: e.target.value })} /></div>
            <div><label className="form-label">Consultation Fee (Rs.)</label><input type="number" className="form-input" value={draft.consultationFee} onChange={(e) => setDraft({ ...draft, consultationFee: e.target.value })} /></div>
            <div><label className="form-label">Available Days</label><input className="form-input" value={draft.availableDays} onChange={(e) => setDraft({ ...draft, availableDays: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="form-label">Available Times</label><input className="form-input" value={draft.availableTimes} onChange={(e) => setDraft({ ...draft, availableTimes: e.target.value })} /></div>
          </div>
          <button className="btn-primary text-[13px]" onClick={addDoctor}>Save Doctor</button>
        </div>
      )}

      {loading ? <div className="text-center py-6 text-slate-400 text-[13px]">Loading...</div>
      : doctors.length === 0 ? <div className="text-center py-6 text-slate-400 text-[13px]">No doctors yet. Import or add manually.</div>
      : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Specialization</th><th className="py-2 pr-3">Fee</th><th className="py-2 pr-3">Days</th><th className="py-2 pr-3">Available</th><th className="py-2"></th>
            </tr></thead>
            <tbody>{doctors.map((d) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">Dr. {d.name}</td>
                <td className="py-2 pr-3 text-slate-500">{d.specialization || "—"}</td>
                <td className="py-2 pr-3">Rs. {d.consultation_fee || "—"}</td>
                <td className="py-2 pr-3 text-slate-500 text-[11px]">{d.available_days || "—"}</td>
                <td className="py-2 pr-3">
                  <button onClick={() => toggleAvailable(d.id, d.is_available)} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: d.is_available ? "#e8f5e9" : "#fef2f2", color: d.is_available ? "#1b5e20" : "#b91c1c" }}>
                    {d.is_available ? "✓ Yes" : "✗ No"}
                  </button>
                </td>
                <td className="py-2 text-right"><button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => deleteDoctor(d.id)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {importPreview && (
        <DoctorReviewModal source={importSource} initial={importPreview} onCancel={() => setImportPreview(null)} onConfirm={confirmImport} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function DoctorReviewModal({ source, initial, onCancel, onConfirm }: { source: string; initial: ImportedDoctor[]; onCancel: () => void; onConfirm: (s: ImportedDoctor[]) => void }) {
  const [rows, setRows] = useState(initial.map((d, i) => ({ ...d, _idx: i, _selected: true })));
  const selectedCount = rows.filter((r) => r._selected).length;
  const isAi = source === "url" || source === "kb";
  const update = (idx: number, f: string, v: any) => setRows(rows.map((r) => r._idx === idx ? { ...r, [f]: v } : r));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-800">Review Doctors Import</h3>
            <p className="text-[12px] text-slate-500">{rows.length} found · {selectedCount} selected</p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel}>✕</button>
        </div>
        {isAi && <div className="mx-6 mt-4 p-3 rounded-xl text-[12px]" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>⚠️ Extracted by AI — review carefully before importing.</div>}
        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white"><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2 w-8"><input type="checkbox" checked={rows.every((r) => r._selected)} onChange={(e) => setRows(rows.map((r) => ({ ...r, _selected: e.target.checked })))} /></th>
              <th className="py-2 pr-2">Name</th><th className="py-2 pr-2">Specialization</th><th className="py-2 pr-2">Qualification</th><th className="py-2 pr-2">Fee</th><th className="py-2 pr-2">Days</th><th className="py-2 w-8"></th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r._idx} className={`border-b border-slate-100 ${!r._selected && "opacity-40"}`}>
                <td className="py-1 pr-2"><input type="checkbox" checked={r._selected} onChange={() => setRows(rows.map((x) => x._idx === r._idx ? { ...x, _selected: !x._selected } : x))} /></td>
                <td className="py-1 pr-2"><input className={`form-input !py-1 !text-[12px] ${!r.name && "bg-yellow-50"}`} value={r.name||""} onChange={(e) => update(r._idx, "name", e.target.value)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px]" value={r.specialization||""} onChange={(e) => update(r._idx, "specialization", e.target.value)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px]" value={r.qualification||""} onChange={(e) => update(r._idx, "qualification", e.target.value)} /></td>
                <td className="py-1 pr-2"><input type="number" className="form-input !py-1 !text-[12px] w-24" value={r.consultation_fee??""} onChange={(e) => update(r._idx, "consultation_fee", e.target.value ? parseFloat(e.target.value) : null)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px] w-40" value={r.available_days||""} onChange={(e) => update(r._idx, "available_days", e.target.value)} /></td>
                <td className="py-1"><button className="text-red-500 text-[14px]" onClick={() => setRows(rows.filter((x) => x._idx !== r._idx))}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button className="btn-secondary text-[13px]" onClick={onCancel}>Cancel</button>
          <button className="btn-primary text-[13px]" onClick={() => onConfirm(rows.filter((r) => r._selected).map(({ _idx, _selected, ...rest }) => rest))} disabled={selectedCount === 0}>
            Import {selectedCount} doctor{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
