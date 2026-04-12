"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Department = {
  id: string; name: string; floor_location: string | null;
  opd_timings: string | null; head_doctor: string | null;
  contact_extension: string | null; is_active: boolean;
};

export default function DepartmentsPage() {
  const { botId, tenantId } = useAuth();
  const BOT_ID = botId || "";
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: "", floorLocation: "", opdTimings: "", headDoctor: "", contactExtension: "" });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  const [healthcareType, setHealthcareType] = useState<string>("");

  useEffect(() => {
    if (!BOT_ID) return;
    axios.get(`${API}/api/bots/${BOT_ID}`)
      .then((r) => {
        setIndustry((r.data.industry || "").toLowerCase());
        setHealthcareType((r.data.healthcare_type || "").toLowerCase());
      })
      .catch(() => setIndustry(""))
      .finally(() => setLoading(false));
  }, [BOT_ID]);

  const load = useCallback(async () => {
    if (!BOT_ID) return;
    try { const r = await axios.get(`${API}/api/clinic/departments?botId=${BOT_ID}`); setDepartments(r.data.departments || []); } catch {} finally { setLoading(false); }
  }, [BOT_ID]);

  useEffect(() => { load(); }, [load]);

  const isHealth = industry === "health" || industry === "clinic" || industry === "healthcare";
  if (industry !== null && (!isHealth || healthcareType !== "hospital")) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="card text-center py-16">
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">Departments are for Hospitals only</h2>
          <p className="text-[13px] text-slate-500 mb-5">Set industry to <b>Health</b> and type to <b>Hospital</b> in Bot Setup.</p>
          <a href="/bot-setup" className="btn-primary text-[13px] inline-block">Go to Bot Setup</a>
        </div>
      </div>
    );
  }

  const addDept = async () => {
    if (!draft.name.trim()) { setToast({ message: "Name required", type: "error" }); return; }
    try {
      await axios.post(`${API}/api/clinic/departments`, {
        botId: BOT_ID, tenantId, name: draft.name,
        floorLocation: draft.floorLocation || null, opdTimings: draft.opdTimings || null,
        headDoctor: draft.headDoctor || null, contactExtension: draft.contactExtension || null,
      });
      setShowForm(false);
      setDraft({ name: "", floorLocation: "", opdTimings: "", headDoctor: "", contactExtension: "" });
      setToast({ message: "Department added", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const deleteDept = async (id: string) => {
    if (!confirm("Delete this department?")) return;
    try { await axios.delete(`${API}/api/clinic/departments/${id}`); load(); } catch {}
  };

  const toggleActive = async (id: string, cur: boolean) => {
    try { await axios.patch(`${API}/api/clinic/departments/${id}`, { isActive: !cur }); load(); } catch {}
  };

  return (
    <div className="p-8 animate-fade-in max-w-5xl">
      <div className="mb-8">
        <div className="page-breadcrumb">🏨 Departments</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Hospital Departments</h1>
        <p className="text-[16px] text-slate-500">Manage departments so the bot can route patients to the right place.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-slate-800">Departments ({departments.length})</h2>
          <button className="btn-secondary text-[12px]" onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "+ Add Department"}</button>
        </div>

        {showForm && (
          <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div><label className="form-label">Department Name</label><input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Cardiology" /></div>
              <div><label className="form-label">Floor / Location</label><input className="form-input" value={draft.floorLocation} onChange={(e) => setDraft({ ...draft, floorLocation: e.target.value })} placeholder="2nd Floor, Block A" /></div>
              <div><label className="form-label">OPD Timings</label><input className="form-input" value={draft.opdTimings} onChange={(e) => setDraft({ ...draft, opdTimings: e.target.value })} placeholder="Mon-Fri 9am-1pm" /></div>
              <div><label className="form-label">Head Doctor</label><input className="form-input" value={draft.headDoctor} onChange={(e) => setDraft({ ...draft, headDoctor: e.target.value })} placeholder="Dr. Sara Malik" /></div>
              <div><label className="form-label">Contact Extension</label><input className="form-input" value={draft.contactExtension} onChange={(e) => setDraft({ ...draft, contactExtension: e.target.value })} placeholder="201" /></div>
            </div>
            <button className="btn-primary text-[13px]" onClick={addDept}>Save Department</button>
          </div>
        )}

        {loading ? <div className="text-center py-6 text-slate-400 text-[13px]">Loading...</div>
        : departments.length === 0 ? <div className="text-center py-6 text-slate-400 text-[13px]">No departments yet. Add your hospital departments so the bot can route patients.</div>
        : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Department</th><th className="py-2 pr-3">Floor</th><th className="py-2 pr-3">OPD Timings</th>
                <th className="py-2 pr-3">Head Doctor</th><th className="py-2 pr-3">Active</th><th className="py-2"></th>
              </tr></thead>
              <tbody>{departments.map((d) => (
                <tr key={d.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-800">{d.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{d.floor_location || "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{d.opd_timings || "—"}</td>
                  <td className="py-2 pr-3 text-slate-500">{d.head_doctor || "—"}</td>
                  <td className="py-2 pr-3">
                    <button onClick={() => toggleActive(d.id, d.is_active)} className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: d.is_active ? "#e8f5e9" : "#fef2f2", color: d.is_active ? "#1b5e20" : "#b91c1c" }}>
                      {d.is_active ? "✓ Yes" : "✗ No"}
                    </button>
                  </td>
                  <td className="py-2 text-right"><button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => deleteDept(d.id)}>Delete</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
