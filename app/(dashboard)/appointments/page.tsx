"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Appointment {
  id: string;
  customer_phone: string;
  patient_name: string | null;
  doctor_name: string;
  appointment_date: string;
  appointment_time: string;
  reason: string | null;
  status: string;
  created_at: string;
  clinic_name: string;
}

const statusBadge: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: "#fffde7", color: "#f57f17", label: "Pending" },
  confirmed: { bg: "#e8f5e9", color: "#1b5e20", label: "Confirmed" },
  completed: { bg: "#eff6ff", color: "#1d4ed8", label: "Completed" },
  cancelled: { bg: "#fef2f2", color: "#b91c1c", label: "Cancelled" },
};

function formatPhone(phone: string): string {
  if (phone?.startsWith("92") && phone.length >= 12) return `0${phone.slice(2, 5)}-${phone.slice(5)}`;
  return phone || "";
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export default function AppointmentsPage() {
  const { tenantId, botId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [industry, setIndustry] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!botId) return;
    axios.get(`${API}/api/bots/${botId}`)
      .then((r) => setIndustry((r.data.industry || "").toLowerCase()))
      .catch(() => setIndustry(""));
  }, [botId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const r = await axios.get(
        `${API}/api/clinic/appointments?tenantId=${tenantId}&date=${selectedDate}`
      );
      setAppointments(r.data.appointments || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [tenantId, selectedDate]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await axios.patch(`${API}/api/clinic/appointments/${id}`, { status });
      setToast({ message: `Marked ${status}`, type: "success" });
      load();
    } catch {
      setToast({ message: "Failed to update", type: "error" });
    }
  };

  // Show gatekeeper if not healthcare industry
  const isHealth = industry === "clinic" || industry === "health" || industry === "healthcare";
  if (industry !== null && !isHealth) {
    return (
      <div className="p-8 animate-fade-in max-w-4xl">
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(29,158,117,0.08)" }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v9a4 4 0 008 0V3M5 3h2m10 0h2" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">Appointments are for Healthcare bots only</h2>
          <p className="text-[13px] text-slate-500 mb-5">
            Switch your bot&apos;s industry to <b>Health</b> in Bot Setup to manage appointments.
          </p>
          <a href="/bot-setup" className="btn-primary text-[13px] inline-block">Go to Bot Setup</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">📅 Appointments</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Patient Appointments</h1>
        <p className="text-[16px] text-slate-500">Manage appointments booked via the WhatsApp bot.</p>
      </div>

      {/* Date picker + quick actions */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          className="form-input max-w-[200px]"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <button
          className="btn-secondary text-[12px]"
          onClick={() => setSelectedDate(todayStr())}
        >
          Today
        </button>
        <button
          className="btn-secondary text-[12px]"
          onClick={() => {
            const t = new Date();
            t.setDate(t.getDate() + 1);
            setSelectedDate(t.toISOString().split("T")[0]);
          }}
        >
          Tomorrow
        </button>
        <div className="ml-auto text-[13px] text-slate-500">
          {appointments.length} appointment{appointments.length !== 1 ? "s" : ""} on {new Date(selectedDate).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(29,158,117,0.08)" }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[14px] text-slate-500 font-medium">No appointments on this date</p>
            <p className="text-[12px] text-slate-400 mt-1">Patients can book via WhatsApp — they&apos;ll appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Time", "Patient", "Doctor", "Reason", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => {
                  const sb = statusBadge[apt.status] || { bg: "#f5f5f5", color: "#616161", label: apt.status };
                  return (
                    <tr key={apt.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-[13px] font-mono font-medium text-slate-700">{apt.appointment_time}</td>
                      <td className="py-3 px-4">
                        <div className="text-[13px] font-medium text-slate-800">{apt.patient_name || "—"}</div>
                        <div className="text-[11px] text-slate-400">{formatPhone(apt.customer_phone)}</div>
                      </td>
                      <td className="py-3 px-4 text-[13px] text-slate-600">Dr. {apt.doctor_name}</td>
                      <td className="py-3 px-4 text-[12px] text-slate-500 max-w-[200px] truncate">{apt.reason || "—"}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>
                          {sb.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {apt.status === "pending" && (
                            <button className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }} onClick={() => updateStatus(apt.id, "confirmed")}>
                              Confirm
                            </button>
                          )}
                          {apt.status === "confirmed" && (
                            <button className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", color: "#1d4ed8" }} onClick={() => updateStatus(apt.id, "completed")}>
                              Complete
                            </button>
                          )}
                          {apt.status !== "cancelled" && apt.status !== "completed" && (
                            <button className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c" }} onClick={() => updateStatus(apt.id, "cancelled")}>
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
