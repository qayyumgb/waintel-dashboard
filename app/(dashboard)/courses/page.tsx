"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Course = {
  id: string; name: string; code: string | null; category: string | null;
  duration: string | null; fee: string | null; admission_fee: string | null;
  seats_total: number | null; seats_available: number | null;
  eligibility: string | null; schedule: string | null; is_active: boolean;
};

type ImportedCourse = {
  name: string; category?: string | null; duration?: string | null;
  fee?: number | null; eligibility?: string | null; schedule?: string | null;
};

export default function CoursesPage() {
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

  if (loading) return <div className="p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  if (industry !== "education") {
    return (
      <div className="p-8 max-w-4xl"><div className="card text-center py-16">
        <h2 className="text-[18px] font-bold text-slate-800 mb-2">Courses page is for Education industry only</h2>
        <p className="text-[13px] text-slate-500 mb-5">Switch your bot&apos;s industry to <b>Education</b> in Bot Setup.</p>
        <a href="/bot-setup" className="btn-primary text-[13px] inline-block">Go to Bot Setup</a>
      </div></div>
    );
  }

  return (
    <div className="p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">📚 Courses</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Course Management</h1>
        <p className="text-[16px] text-slate-500">Manage your courses and programs. Import from a website or knowledge base.</p>
      </div>
      <CourseCatalog botId={BOT_ID} />
    </div>
  );
}

function CourseCatalog({ botId }: { botId: string }) {
  const { tenantId } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", code: "", category: "IT", duration: "", fee: "", admissionFee: "", seatsTotal: "", seatsAvailable: "", eligibility: "", schedule: "", description: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedCourse[] | null>(null);
  const [importSource, setImportSource] = useState("");
  const [urlPromptOpen, setUrlPromptOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/education/courses?botId=${botId}`); setCourses(r.data.courses || []); } catch {} finally { setLoading(false); }
  }, [botId]);
  useEffect(() => { load(); }, [load]);

  const startUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlPromptOpen(false); setImporting("url");
    try {
      const r = await axios.post(`${API}/api/education/courses/import/url/preview`, { url: urlInput });
      if (!r.data.preview?.length) { setToast({ message: "No courses found", type: "error" }); return; }
      setImportSource("url"); setImportPreview(r.data.preview);
    } catch (err: any) { setToast({ message: err.response?.data?.error || "Scrape failed", type: "error" }); }
    finally { setImporting(null); setUrlInput(""); }
  };

  const startKbImport = async () => {
    setImportMenuOpen(false); setImporting("kb");
    try {
      const r = await axios.post(`${API}/api/education/courses/import/kb/preview`, { botId });
      if (!r.data.preview?.length) { setToast({ message: "No courses found in KB", type: "error" }); return; }
      setImportSource("kb"); setImportPreview(r.data.preview);
    } catch (err: any) { setToast({ message: err.response?.data?.error || "Extract failed", type: "error" }); }
    finally { setImporting(null); }
  };

  const confirmImport = async (selected: ImportedCourse[]) => {
    try {
      const r = await axios.post(`${API}/api/education/courses/bulk`, { botId, tenantId, courses: selected });
      setToast({ message: `Imported ${r.data.imported} courses`, type: "success" });
      setImportPreview(null); load();
    } catch { setToast({ message: "Import failed", type: "error" }); }
  };

  const addCourse = async () => {
    if (!draft.name.trim()) { setToast({ message: "Name required", type: "error" }); return; }
    try {
      await axios.post(`${API}/api/education/courses`, {
        botId, tenantId, name: draft.name, code: draft.code || null, category: draft.category,
        duration: draft.duration || null, fee: parseFloat(draft.fee) || null,
        admissionFee: parseFloat(draft.admissionFee) || null,
        seatsTotal: parseInt(draft.seatsTotal) || null, seatsAvailable: parseInt(draft.seatsAvailable) || null,
        eligibility: draft.eligibility || null, schedule: draft.schedule || null, description: draft.description || null,
      });
      setShowForm(false);
      setDraft({ name: "", code: "", category: "IT", duration: "", fee: "", admissionFee: "", seatsTotal: "", seatsAvailable: "", eligibility: "", schedule: "", description: "" });
      setToast({ message: "Course added", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const toggleActive = async (id: string, cur: boolean) => { try { await axios.patch(`${API}/api/education/courses/${id}`, { isActive: !cur }); load(); } catch {} };
  const deleteCourse = async (id: string) => { if (!confirm("Delete?")) return; try { await axios.delete(`${API}/api/education/courses/${id}`); load(); } catch {} };

  return (
    <div className="card mb-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-slate-800">Courses ({courses.length})</h2>
        <div className="flex items-center gap-2 relative">
          <button className="btn-secondary text-[12px]" onClick={() => setImportMenuOpen(!importMenuOpen)} disabled={!!importing}>
            {importing ? "Importing..." : "Import Courses ▾"}
          </button>
          <button className="btn-secondary text-[12px]" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add Manually"}</button>
          {importMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
              <button className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2" onClick={() => { setImportMenuOpen(false); setUrlPromptOpen(true); }}>🌐 From Website URL</button>
              <button className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100" onClick={startKbImport}>📄 From Knowledge Base</button>
            </div>
          )}
        </div>
      </div>

      {urlPromptOpen && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <label className="form-label">Institution website URL (courses page)</label>
          <div className="flex gap-2">
            <input className="form-input flex-1" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://academy.com/courses" onKeyDown={(e) => e.key === "Enter" && startUrlImport()} />
            <button className="btn-primary text-[12px]" onClick={startUrlImport} disabled={!urlInput.trim()}>Scrape</button>
            <button className="btn-secondary text-[12px]" onClick={() => { setUrlPromptOpen(false); setUrlInput(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div><label className="form-label">Course Name</label><input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Web Development" /></div>
            <div><label className="form-label">Code</label><input className="form-input" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="CS-101" /></div>
            <div><label className="form-label">Category</label>
              <select className="form-input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option>Science</option><option>Arts</option><option>Commerce</option><option>IT</option><option>Languages</option><option>Professional</option><option>Other</option>
              </select>
            </div>
            <div><label className="form-label">Duration</label><input className="form-input" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="6 months" /></div>
            <div><label className="form-label">Monthly Fee (Rs.)</label><input type="number" className="form-input" value={draft.fee} onChange={(e) => setDraft({ ...draft, fee: e.target.value })} /></div>
            <div><label className="form-label">Admission Fee (Rs.)</label><input type="number" className="form-input" value={draft.admissionFee} onChange={(e) => setDraft({ ...draft, admissionFee: e.target.value })} /></div>
            <div><label className="form-label">Total Seats</label><input type="number" className="form-input" value={draft.seatsTotal} onChange={(e) => setDraft({ ...draft, seatsTotal: e.target.value })} /></div>
            <div><label className="form-label">Available Seats</label><input type="number" className="form-input" value={draft.seatsAvailable} onChange={(e) => setDraft({ ...draft, seatsAvailable: e.target.value })} /></div>
            <div><label className="form-label">Eligibility</label><input className="form-input" value={draft.eligibility} onChange={(e) => setDraft({ ...draft, eligibility: e.target.value })} placeholder="Matric pass, min 50%" /></div>
            <div><label className="form-label">Schedule</label><input className="form-input" value={draft.schedule} onChange={(e) => setDraft({ ...draft, schedule: e.target.value })} placeholder="Mon-Fri 5pm-8pm" /></div>
          </div>
          <button className="btn-primary text-[13px]" onClick={addCourse}>Save Course</button>
        </div>
      )}

      {loading ? <div className="text-center py-6 text-slate-400 text-[13px]">Loading...</div>
      : courses.length === 0 ? <div className="text-center py-6 text-slate-400 text-[13px]">No courses yet. Import or add manually.</div>
      : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Category</th><th className="py-2 pr-3">Duration</th>
              <th className="py-2 pr-3">Fee</th><th className="py-2 pr-3">Seats</th><th className="py-2 pr-3">Active</th><th className="py-2"></th>
            </tr></thead>
            <tbody>{courses.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">{c.name}{c.code ? ` [${c.code}]` : ""}</td>
                <td className="py-2 pr-3 text-slate-500">{c.category || "—"}</td>
                <td className="py-2 pr-3 text-slate-500">{c.duration || "—"}</td>
                <td className="py-2 pr-3">Rs. {c.fee || "—"}</td>
                <td className="py-2 pr-3">
                  {c.seats_available != null ? (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${c.seats_available < 10 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                      {c.seats_available}{c.seats_total ? `/${c.seats_total}` : ""}
                    </span>
                  ) : "—"}
                </td>
                <td className="py-2 pr-3">
                  <button onClick={() => toggleActive(c.id, c.is_active)} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: c.is_active ? "#e8f5e9" : "#fef2f2", color: c.is_active ? "#1b5e20" : "#b91c1c" }}>
                    {c.is_active ? "✓ Open" : "✗ Closed"}
                  </button>
                </td>
                <td className="py-2 text-right"><button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => deleteCourse(c.id)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {importPreview && <CourseReviewModal source={importSource} initial={importPreview} onCancel={() => setImportPreview(null)} onConfirm={confirmImport} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function CourseReviewModal({ source, initial, onCancel, onConfirm }: { source: string; initial: ImportedCourse[]; onCancel: () => void; onConfirm: (s: ImportedCourse[]) => void }) {
  const [rows, setRows] = useState(initial.map((c, i) => ({ ...c, _idx: i, _selected: true })));
  const selectedCount = rows.filter((r) => r._selected).length;
  const isAi = source === "url" || source === "kb";
  const update = (idx: number, f: string, v: any) => setRows(rows.map((r) => r._idx === idx ? { ...r, [f]: v } : r));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div><h3 className="text-[18px] font-bold text-slate-800">Review Courses Import</h3><p className="text-[12px] text-slate-500">{rows.length} found · {selectedCount} selected</p></div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel}>✕</button>
        </div>
        {isAi && <div className="mx-6 mt-4 p-3 rounded-xl text-[12px]" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>⚠️ Extracted by AI — review carefully.</div>}
        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white"><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2 w-8"><input type="checkbox" checked={rows.every((r) => r._selected)} onChange={(e) => setRows(rows.map((r) => ({ ...r, _selected: e.target.checked })))} /></th>
              <th className="py-2 pr-2">Name</th><th className="py-2 pr-2">Category</th><th className="py-2 pr-2">Duration</th>
              <th className="py-2 pr-2">Fee</th><th className="py-2 pr-2">Eligibility</th><th className="py-2 w-8"></th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r._idx} className={`border-b border-slate-100 ${!r._selected && "opacity-40"}`}>
                <td className="py-1 pr-2"><input type="checkbox" checked={r._selected} onChange={() => setRows(rows.map((x) => x._idx === r._idx ? { ...x, _selected: !x._selected } : x))} /></td>
                <td className="py-1 pr-2"><input className={`form-input !py-1 !text-[12px] ${!r.name && "bg-yellow-50"}`} value={r.name || ""} onChange={(e) => update(r._idx, "name", e.target.value)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px] w-24" value={r.category || ""} onChange={(e) => update(r._idx, "category", e.target.value)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px] w-24" value={r.duration || ""} onChange={(e) => update(r._idx, "duration", e.target.value)} /></td>
                <td className="py-1 pr-2"><input type="number" className="form-input !py-1 !text-[12px] w-24" value={r.fee ?? ""} onChange={(e) => update(r._idx, "fee", e.target.value ? parseFloat(e.target.value) : null)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px] w-40" value={r.eligibility || ""} onChange={(e) => update(r._idx, "eligibility", e.target.value)} /></td>
                <td className="py-1"><button className="text-red-500 text-[14px]" onClick={() => setRows(rows.filter((x) => x._idx !== r._idx))}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button className="btn-secondary text-[13px]" onClick={onCancel}>Cancel</button>
          <button className="btn-primary text-[13px]" onClick={() => onConfirm(rows.filter((r) => r._selected).map(({ _idx, _selected, ...rest }) => rest))} disabled={selectedCount === 0}>
            Import {selectedCount} course{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
