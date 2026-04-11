"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Booking {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  hotel_name: string;
  room_type: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  guests: number;
  total_amount: string;
  payment_method: string | null;
  payment_status: string;
  status: string;
  special_requests: string | null;
  created_at: string;
}

function formatPhone(phone: string): string {
  if (phone?.startsWith("92") && phone.length >= 12) return `0${phone.slice(2, 5)}-${phone.slice(5)}`;
  return phone || "";
}

function formatDate(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const statusColors: Record<string, { bg: string; color: string }> = {
  pending:   { bg: "#fffde7", color: "#f57f17" },
  confirmed: { bg: "#e8f5e9", color: "#1b5e20" },
  cancelled: { bg: "#fef2f2", color: "#b91c1c" },
  completed: { bg: "#f5f5f5", color: "#616161" },
};

const payStatusColors: Record<string, { bg: string; color: string }> = {
  unpaid:  { bg: "#fef2f2", color: "#b91c1c" },
  partial: { bg: "#fffde7", color: "#f57f17" },
  paid:    { bg: "#e8f5e9", color: "#1b5e20" },
};

export default function BookingsPage() {
  const { tenantId } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await axios.get(`${API}/api/hotels/bookings?tenantId=${tenantId}`);
      setBookings(res.data.bookings || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const updateBooking = async (id: string, updates: Record<string, string>) => {
    try {
      await axios.patch(`${API}/api/hotels/bookings/${id}`, updates);
      setToast({ message: "Booking updated", type: "success" });
      fetchBookings();
    } catch {
      setToast({ message: "Failed to update booking", type: "error" });
    }
  };

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Bookings
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Hotel Bookings</h1>
        <p className="text-[16px] text-slate-500">Manage guest bookings from all your hotel bots.</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {["all", "pending", "confirmed", "cancelled"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all capitalize" style={{
            background: filter === f ? "#1D9E75" : "#f8fafc",
            color: filter === f ? "#fff" : "#64748b",
            border: filter === f ? "1px solid #1D9E75" : "1px solid #e2e8f0",
          }}>
            {f === "all" ? `All (${bookings.length})` : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading bookings...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(29,158,117,0.08)" }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[14px] text-slate-500 font-medium">No bookings yet</p>
            <p className="text-[12px] text-slate-400 mt-1">Hotel bookings made through your bot will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Booking ID", "Guest", "Hotel", "Room", "Check-in", "Check-out", "Nights", "Amount", "Payment", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left py-3 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const sc  = statusColors[b.status]    || { bg: "#f5f5f5", color: "#616161" };
                  const psc = payStatusColors[b.payment_status] || { bg: "#f5f5f5", color: "#616161" };
                  return (
                    <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 text-[11px] font-mono font-medium text-slate-600">{b.id}</td>
                      <td className="py-3 px-3">
                        <div className="text-[13px] font-medium text-slate-800">{b.customer_name || "—"}</div>
                        <div className="text-[11px] text-slate-400">{formatPhone(b.customer_phone)}</div>
                      </td>
                      <td className="py-3 px-3 text-[12px] text-slate-600 max-w-[100px] truncate">{b.hotel_name}</td>
                      <td className="py-3 px-3 text-[12px] text-slate-600">{b.room_type}</td>
                      <td className="py-3 px-3 text-[12px] text-slate-600 whitespace-nowrap">{formatDate(b.check_in_date)}</td>
                      <td className="py-3 px-3 text-[12px] text-slate-600 whitespace-nowrap">{formatDate(b.check_out_date)}</td>
                      <td className="py-3 px-3 text-[12px] text-center text-slate-600">{b.nights}</td>
                      <td className="py-3 px-3 text-[13px] font-semibold whitespace-nowrap" style={{ color: "#1D9E75" }}>
                        Rs. {Number(b.total_amount || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold capitalize" style={{ background: psc.bg, color: psc.color }}>
                          {b.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold capitalize" style={{ background: sc.bg, color: sc.color }}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1.5">
                          {b.status === "pending" && (
                            <button
                              onClick={() => updateBooking(b.id, { status: "confirmed" })}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
                              style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}
                            >
                              Confirm
                            </button>
                          )}
                          {b.status !== "cancelled" && (
                            <button
                              onClick={() => updateBooking(b.id, { status: "cancelled" })}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap"
                              style={{ background: "#fef2f2", color: "#b91c1c" }}
                            >
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
