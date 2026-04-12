"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

type Enrollment = {
  id: string; customer_phone: string; student_name: string;
  father_name: string | null; cnic_or_bform: string | null;
  qualification: string | null; course_name: string;
  city: string | null; email: string | null;
  payment_status: string; enrollment_status: string;
  created_at: string; institution_name: string;
};

const statusBadge: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: "#fffde7", color: "#f57f17", label: "Pending" },
  confirmed: { bg: "#e8f5e9", color: "#1b5e20", label: "Confirmed" },
  rejected:  { bg: "#fef2f2", color: "#b91c1c", label: "Rejected" },
};

const payBadge: Record<string, { bg: string; color: string; label: string }> = {
  unpaid: { bg: "#fef2f2", color: "#b91c1c", label: "Unpaid" },
  paid:   { bg: "#e8f5e9", color: "#1b5e20", label: "Paid" },
  partial:{ bg: "#fffde7", color: "#f57f17", label: "Partial" },
};

function formatPhone(p: string): string {
  if (p?.startsWith("92") && p.length >= 12) return `0${p.slice(2, 5)}-${p.slice(5)}`;
  return p || "";
}

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function EnrollmentsPage() {
  const { tenantId } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const r = await axios.get(`${API}/api/education/enrollments?tenantId=${tenantId}&status=${filter}`);
      setEnrollments(r.data.enrollments || []);
    } catch {} finally { setLoading(false); }
  }, [tenantId, filter]);

  useEffect(() => { load(); }, [load]);

  const updateEnrollment = async (id: string, updates: Record<string, string>) => {
    try {
      await axios.patch(`${API}/api/education/enrollments/${id}`, updates);
      setToast({ message: "Updated", type: "success" }); load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">🎓 Enrollments</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Student Enrollments</h1>
        <p className="text-[16px] text-slate-500">Manage enrollment applications received via WhatsApp.</p>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {["all", "pending", "confirmed", "rejected"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all capitalize" style={{
            background: filter === f ? "#1D9E75" : "#f8fafc",
            color: filter === f ? "#fff" : "#64748b",
            border: filter === f ? "1px solid #1D9E75" : "1px solid #e2e8f0",
          }}>{f}</button>
        ))}
      </div>

      <div className="card !p-0 overflow-hidden">
        {loading ? <div className="text-center py-16 text-slate-400">Loading...</div>
        : enrollments.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[14px] text-slate-500 font-medium">No enrollments yet</p>
            <p className="text-[12px] text-slate-400 mt-1">Students can enroll by typing ENROLL on WhatsApp.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {["Student", "Father", "Course", "City", "Payment", "Status", "Time", "Actions"].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody>{enrollments.map((e) => {
                const sb = statusBadge[e.enrollment_status] || { bg: "#f5f5f5", color: "#616161", label: e.enrollment_status };
                const pb = payBadge[e.payment_status] || { bg: "#f5f5f5", color: "#616161", label: e.payment_status };
                return (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="text-[13px] font-medium text-slate-800">{e.student_name}</div>
                      <div className="text-[11px] text-slate-400">{formatPhone(e.customer_phone)}</div>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-slate-500">{e.father_name || "—"}</td>
                    <td className="py-3 px-4 text-[12px] text-slate-700 font-medium">{e.course_name}</td>
                    <td className="py-3 px-4 text-[12px] text-slate-500">{e.city || "—"}</td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: pb.bg, color: pb.color }}>{pb.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>{sb.label}</span>
                    </td>
                    <td className="py-3 px-4 text-[12px] text-slate-400">{timeAgo(e.created_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        {e.enrollment_status === "pending" && (
                          <>
                            <button className="text-[11px] font-semibold px-3 py-1 rounded-lg" style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }} onClick={() => updateEnrollment(e.id, { enrollmentStatus: "confirmed" })}>Confirm</button>
                            <button className="text-[11px] font-semibold px-3 py-1 rounded-lg" style={{ background: "rgba(239,68,68,0.08)", color: "#b91c1c" }} onClick={() => updateEnrollment(e.id, { enrollmentStatus: "rejected" })}>Reject</button>
                          </>
                        )}
                        {e.payment_status === "unpaid" && (
                          <button className="text-[11px] font-semibold px-3 py-1 rounded-lg" style={{ background: "rgba(59,130,246,0.08)", color: "#1d4ed8" }} onClick={() => updateEnrollment(e.id, { paymentStatus: "paid" })}>Mark Paid</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
