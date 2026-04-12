"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Medicine = {
  id: string; name: string; generic_name: string | null;
  category: string | null; price: string | null;
  requires_prescription: boolean; in_stock: boolean;
  stock_quantity: number; manufacturer: string | null;
};

type ImportedMedicine = {
  name: string; generic_name?: string | null; category?: string | null;
  price?: number | null; requires_prescription?: boolean | null;
  stock_quantity?: number | null; manufacturer?: string | null;
};

type Reminder = {
  id: string; customer_phone: string; patient_name: string | null;
  medication_name: string; dosage: string | null; frequency: string | null;
  end_date: string | null;
};

export default function MedicinesPage() {
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
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">Medicines page is for Health industry only</h2>
          <p className="text-[13px] text-slate-500 mb-5">Switch your bot&apos;s industry to <b>Health</b> in Bot Setup.</p>
          <a href="/bot-setup" className="btn-primary text-[13px] inline-block">Go to Bot Setup</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">💊 Medicines</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Medicine Inventory</h1>
        <p className="text-[16px] text-slate-500">Manage your pharmacy&apos;s medicine catalog. Import from a website or your knowledge base.</p>
      </div>
      <MedicineCatalog botId={BOT_ID} />
      <RemindersSection botId={BOT_ID} />
    </div>
  );
}

// ── Medicine Catalog ───────────────────────────────────────────────────────
function MedicineCatalog({ botId }: { botId: string }) {
  const { tenantId } = useAuth();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", genericName: "", category: "Painkiller", price: "", requiresPrescription: false, inStock: true, stockQuantity: "0", manufacturer: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedMedicine[] | null>(null);
  const [importSource, setImportSource] = useState("");
  const [urlPromptOpen, setUrlPromptOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/clinic/medicines?botId=${botId}`); setMedicines(r.data.medicines || []); } catch {} finally { setLoading(false); }
  }, [botId]);
  useEffect(() => { load(); }, [load]);

  const startImport = async (source: "kb") => {
    setImportMenuOpen(false); setImporting(source);
    try {
      const r = await axios.post(`${API}/api/clinic/medicines/import/${source}/preview`, { botId });
      if (!r.data.preview?.length) { setToast({ message: "No medicines found", type: "error" }); return; }
      setImportSource(source); setImportPreview(r.data.preview);
    } catch (err: any) { setToast({ message: err.response?.data?.error || "Import failed", type: "error" }); }
    finally { setImporting(null); }
  };

  const startUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlPromptOpen(false); setImporting("url");
    try {
      const r = await axios.post(`${API}/api/clinic/medicines/import/url/preview`, { url: urlInput });
      if (!r.data.preview?.length) { setToast({ message: "No medicines found on this page", type: "error" }); return; }
      setImportSource("url"); setImportPreview(r.data.preview);
    } catch (err: any) { setToast({ message: err.response?.data?.error || "Scrape failed", type: "error" }); }
    finally { setImporting(null); setUrlInput(""); }
  };

  const confirmImport = async (selected: ImportedMedicine[]) => {
    try {
      const r = await axios.post(`${API}/api/clinic/medicines/bulk`, { botId, tenantId, medicines: selected });
      setToast({ message: `Imported ${r.data.imported} medicines`, type: "success" });
      setImportPreview(null); load();
    } catch { setToast({ message: "Import failed", type: "error" }); }
  };

  const addMedicine = async () => {
    if (!draft.name.trim()) { setToast({ message: "Name required", type: "error" }); return; }
    try {
      await axios.post(`${API}/api/clinic/medicines`, {
        botId, tenantId, name: draft.name, genericName: draft.genericName || null,
        category: draft.category, price: parseFloat(draft.price) || 0,
        requiresPrescription: draft.requiresPrescription, inStock: draft.inStock,
        stockQuantity: parseInt(draft.stockQuantity) || 0, manufacturer: draft.manufacturer || null,
      });
      setShowForm(false);
      setDraft({ name: "", genericName: "", category: "Painkiller", price: "", requiresPrescription: false, inStock: true, stockQuantity: "0", manufacturer: "" });
      setToast({ message: "Medicine added", type: "success" }); load();
    } catch { setToast({ message: "Failed to add", type: "error" }); }
  };

  const deleteMedicine = async (id: string) => { if (!confirm("Delete?")) return; try { await axios.delete(`${API}/api/clinic/medicines/${id}`); load(); } catch {} };

  return (
    <div className="card mb-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-slate-800">Catalog ({medicines.length})</h2>
        <div className="flex items-center gap-2 relative">
          <button className="btn-secondary text-[12px]" onClick={() => setImportMenuOpen(!importMenuOpen)} disabled={!!importing}>
            {importing ? `Importing...` : "Import Medicines ▾"}
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
          <label className="form-label">Pharmacy or medicine catalog URL</label>
          <div className="flex gap-2">
            <input className="form-input flex-1" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://pharmacy.com/medicines" onKeyDown={(e) => e.key === "Enter" && startUrlImport()} />
            <button className="btn-primary text-[12px]" onClick={startUrlImport} disabled={!urlInput.trim()}>Scrape</button>
            <button className="btn-secondary text-[12px]" onClick={() => { setUrlPromptOpen(false); setUrlInput(""); }}>Cancel</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div><label className="form-label">Medicine Name</label><input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Panadol" /></div>
            <div><label className="form-label">Generic Name</label><input className="form-input" value={draft.genericName} onChange={(e) => setDraft({ ...draft, genericName: e.target.value })} placeholder="Paracetamol" /></div>
            <div><label className="form-label">Category</label>
              <select className="form-input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option>Antibiotic</option><option>Painkiller</option><option>Antacid</option><option>Vitamin</option><option>Cardiovascular</option><option>Other</option>
              </select>
            </div>
            <div><label className="form-label">Price (Rs.)</label><input type="number" className="form-input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></div>
            <div><label className="form-label">Stock Quantity</label><input type="number" className="form-input" value={draft.stockQuantity} onChange={(e) => setDraft({ ...draft, stockQuantity: e.target.value })} /></div>
            <div><label className="form-label">Manufacturer</label><input className="form-input" value={draft.manufacturer} onChange={(e) => setDraft({ ...draft, manufacturer: e.target.value })} placeholder="GSK" /></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={draft.requiresPrescription} onChange={(e) => setDraft({ ...draft, requiresPrescription: e.target.checked })} /><label className="text-[13px] text-slate-700">Requires prescription</label></div>
            <div className="flex items-center gap-2"><input type="checkbox" checked={draft.inStock} onChange={(e) => setDraft({ ...draft, inStock: e.target.checked })} /><label className="text-[13px] text-slate-700">In stock</label></div>
          </div>
          <button className="btn-primary text-[13px]" onClick={addMedicine}>Save Medicine</button>
        </div>
      )}

      {loading ? <div className="text-center py-6 text-slate-400 text-[13px]">Loading...</div>
      : medicines.length === 0 ? <div className="text-center py-6 text-slate-400 text-[13px]">No medicines yet. Import or add manually.</div>
      : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Generic</th><th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Price</th><th className="py-2 pr-3">Stock</th><th className="py-2 pr-3">Rx</th><th className="py-2"></th>
            </tr></thead>
            <tbody>{medicines.map((m) => (
              <tr key={m.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">{m.name}</td>
                <td className="py-2 pr-3 text-slate-500">{m.generic_name || "—"}</td>
                <td className="py-2 pr-3 text-slate-500">{m.category || "—"}</td>
                <td className="py-2 pr-3">Rs. {m.price || "—"}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${!m.in_stock ? "bg-red-50 text-red-700" : m.stock_quantity < 10 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{m.stock_quantity}</span>
                </td>
                <td className="py-2 pr-3">{m.requires_prescription ? "⚠️" : "—"}</td>
                <td className="py-2 text-right"><button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => deleteMedicine(m.id)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {importPreview && (
        <MedicineReviewModal source={importSource} initial={importPreview} onCancel={() => setImportPreview(null)} onConfirm={confirmImport} />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Medicine Review Modal ──────────────────────────────────────────────────
function MedicineReviewModal({ source, initial, onCancel, onConfirm }: { source: string; initial: ImportedMedicine[]; onCancel: () => void; onConfirm: (s: ImportedMedicine[]) => void }) {
  const [rows, setRows] = useState(initial.map((m, i) => ({ ...m, _idx: i, _selected: true })));
  const selectedCount = rows.filter((r) => r._selected).length;
  const isAi = source === "url" || source === "kb";
  const update = (idx: number, f: string, v: any) => setRows(rows.map((r) => r._idx === idx ? { ...r, [f]: v } : r));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-800">Review Medicines Import</h3>
            <p className="text-[12px] text-slate-500">{rows.length} found · {selectedCount} selected</p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel}>✕</button>
        </div>
        {isAi && <div className="mx-6 mt-4 p-3 rounded-xl text-[12px]" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>⚠️ Extracted by AI — review carefully before importing.</div>}
        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white"><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-2 w-8"><input type="checkbox" checked={rows.every((r) => r._selected)} onChange={(e) => setRows(rows.map((r) => ({ ...r, _selected: e.target.checked })))} /></th>
              <th className="py-2 pr-2">Name</th><th className="py-2 pr-2">Generic</th><th className="py-2 pr-2">Category</th>
              <th className="py-2 pr-2">Price</th><th className="py-2 pr-2">Rx</th><th className="py-2 pr-2">Manufacturer</th><th className="py-2 w-8"></th>
            </tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r._idx} className={`border-b border-slate-100 ${!r._selected && "opacity-40"}`}>
                <td className="py-1 pr-2"><input type="checkbox" checked={r._selected} onChange={() => setRows(rows.map((x) => x._idx === r._idx ? { ...x, _selected: !x._selected } : x))} /></td>
                <td className="py-1 pr-2"><input className={`form-input !py-1 !text-[12px] ${!r.name && "bg-yellow-50"}`} value={r.name||""} onChange={(e) => update(r._idx, "name", e.target.value)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px]" value={r.generic_name||""} onChange={(e) => update(r._idx, "generic_name", e.target.value)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px] w-28" value={r.category||""} onChange={(e) => update(r._idx, "category", e.target.value)} /></td>
                <td className="py-1 pr-2"><input type="number" className="form-input !py-1 !text-[12px] w-20" value={r.price??""} onChange={(e) => update(r._idx, "price", e.target.value ? parseFloat(e.target.value) : null)} /></td>
                <td className="py-1 pr-2"><input type="checkbox" checked={!!r.requires_prescription} onChange={(e) => update(r._idx, "requires_prescription", e.target.checked)} /></td>
                <td className="py-1 pr-2"><input className="form-input !py-1 !text-[12px] w-28" value={r.manufacturer||""} onChange={(e) => update(r._idx, "manufacturer", e.target.value)} /></td>
                <td className="py-1"><button className="text-red-500 text-[14px]" onClick={() => setRows(rows.filter((x) => x._idx !== r._idx))}>✕</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button className="btn-secondary text-[13px]" onClick={onCancel}>Cancel</button>
          <button className="btn-primary text-[13px]" onClick={() => onConfirm(rows.filter((r) => r._selected).map(({ _idx, _selected, ...rest }) => rest))} disabled={selectedCount === 0}>
            Import {selectedCount} medicine{selectedCount !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Active Medication Reminders ────────────────────────────────────────────
function RemindersSection({ botId }: { botId: string }) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try { const r = await axios.get(`${API}/api/clinic/reminders?botId=${botId}`); setReminders(r.data.reminders || []); } catch {} finally { setLoading(false); }
  }, [botId]);
  useEffect(() => { load(); }, [load]);

  const stopReminder = async (id: string) => {
    if (!confirm("Stop this reminder?")) return;
    try { await axios.patch(`${API}/api/clinic/reminders/${id}`); setToast({ message: "Stopped", type: "success" }); load(); }
    catch { setToast({ message: "Failed", type: "error" }); }
  };

  return (
    <div className="card mb-5">
      <h2 className="text-[16px] font-bold text-slate-800 mb-5">🔔 Active Medication Reminders ({reminders.length})</h2>

      {loading ? <div className="text-center py-6 text-slate-400 text-[13px]">Loading...</div>
      : reminders.length === 0 ? <div className="text-center py-6 text-slate-400 text-[13px]">No active reminders. Patients set these up via WhatsApp chat.</div>
      : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="py-2 pr-3">Patient</th><th className="py-2 pr-3">Medicine</th><th className="py-2 pr-3">Dosage</th>
              <th className="py-2 pr-3">Frequency</th><th className="py-2 pr-3">Until</th><th className="py-2"></th>
            </tr></thead>
            <tbody>{reminders.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-medium text-slate-800">{r.patient_name || r.customer_phone}</td>
                <td className="py-2 pr-3">{r.medication_name}</td>
                <td className="py-2 pr-3 text-slate-500">{r.dosage || "—"}</td>
                <td className="py-2 pr-3 text-slate-500">{r.frequency || "—"}</td>
                <td className="py-2 pr-3 text-slate-400 text-[11px]">{r.end_date ? new Date(r.end_date).toLocaleDateString("en-PK") : "—"}</td>
                <td className="py-2 text-right"><button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => stopReminder(r.id)}>Stop</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
