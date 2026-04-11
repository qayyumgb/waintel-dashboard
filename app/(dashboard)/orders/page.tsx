"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Order {
  id: string;
  order_reference: string;
  customer_phone: string;
  items: any[];
  subtotal: string;
  delivery_charge: string;
  total_amount: string;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  delivery_address: string | null;
  tracking_number: string | null;
  courier: string | null;
  shipped_at: string | null;
  created_at: string;
}

const COURIERS: { value: string; label: string }[] = [
  { value: "tcs",         label: "TCS" },
  { value: "leopards",    label: "Leopards Courier" },
  { value: "mp",          label: "M&P Express" },
  { value: "bluex",       label: "BlueEx" },
  { value: "callcourier", label: "Call Courier" },
  { value: "trax",        label: "Trax" },
  { value: "rider",       label: "Rider" },
  { value: "other",       label: "Other" },
];

const COURIER_LABEL: Record<string, string> = Object.fromEntries(COURIERS.map((c) => [c.value, c.label]));

interface Stats {
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  monthRevenue: number;
}

function formatPhone(phone: string): string {
  if (phone?.startsWith("92") && phone.length >= 12) return `0${phone.slice(2, 5)}-${phone.slice(5)}`;
  return phone || "";
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const paymentBadge: Record<string, { bg: string; color: string }> = {
  jazzcash: { bg: "#fff3e0", color: "#e65100" },
  easypaisa: { bg: "#e8f5e9", color: "#1b5e20" },
  cod: { bg: "#e3f2fd", color: "#0d47a1" },
};

const statusBadge: Record<string, { bg: string; color: string; label: string }> = {
  pending:     { bg: "#fffde7", color: "#f57f17", label: "Pending" },
  confirmed:   { bg: "#e8f5e9", color: "#1b5e20", label: "Confirmed" },
  paid:        { bg: "#e8f5e9", color: "#1b5e20", label: "Paid" },
  cod_pending: { bg: "#e3f2fd", color: "#0d47a1", label: "COD Pending" },
  shipped:     { bg: "#eef2ff", color: "#3730a3", label: "Shipped" },
  delivered:   { bg: "#f5f5f5", color: "#616161", label: "Delivered" },
  cancelled:   { bg: "#fef2f2", color: "#b91c1c", label: "Cancelled" },
};

export default function OrdersPage() {
  const { botId } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({ todayOrders: 0, todayRevenue: 0, pendingOrders: 0, monthRevenue: 0 });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [shipModal, setShipModal] = useState<Order | null>(null);

  const fetchData = useCallback(async () => {
    if (!botId) return;
    try {
      const [ordersRes, statsRes] = await Promise.all([
        axios.get(`${API}/api/orders?botId=${botId}&status=${filter}&limit=50`),
        axios.get(`${API}/api/orders/stats?botId=${botId}`),
      ]);
      setOrders(ordersRes.data.orders || []);
      setStats(statsRes.data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [botId, filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const markDelivered = async (orderId: string) => {
    if (!confirm("Mark this order as delivered? The customer will get a WhatsApp confirmation.")) return;
    try {
      await axios.post(`${API}/api/orders/${orderId}/mark-delivered`);
      setToast({ message: "Delivered — customer notified on WhatsApp", type: "success" });
      fetchData();
    } catch {
      setToast({ message: "Failed to update order", type: "error" });
    }
  };

  const markShipped = async (orderId: string, trackingNumber: string, courier: string) => {
    try {
      await axios.post(`${API}/api/orders/${orderId}/mark-shipped`, { trackingNumber, courier });
      setToast({ message: "Shipped — customer notified on WhatsApp", type: "success" });
      setShipModal(null);
      fetchData();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed to mark shipped", type: "error" });
    }
  };

  const statCards = [
    { label: "Today's Orders", value: stats.todayOrders },
    { label: "Today's Revenue", value: `Rs. ${stats.todayRevenue}` },
    { label: "Pending Orders", value: stats.pendingOrders },
    { label: "Month Revenue", value: `Rs. ${stats.monthRevenue}` },
  ];

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          Orders
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Orders</h1>
        <p className="text-[16px] text-slate-500">Track and manage customer orders.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((c) => (
          <div key={c.label} className="card !py-4">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{c.label}</div>
            <div className="text-[22px] font-bold text-slate-900">{loading ? "..." : c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {["all", "pending", "confirmed", "cod_pending", "shipped", "delivered"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className="px-4 py-2 rounded-lg text-[12px] font-medium transition-all capitalize" style={{
            background: filter === f ? "#1D9E75" : "#f8fafc",
            color: filter === f ? "#fff" : "#64748b",
            border: filter === f ? "1px solid #1D9E75" : "1px solid #e2e8f0",
          }}>
            {f === "cod_pending" ? "COD Pending" : f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(29,158,117,0.08)" }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="text-[14px] text-slate-500 font-medium">No orders yet</p>
            <p className="text-[12px] text-slate-400 mt-1">When customers place orders they will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Order ID", "Customer", "Items", "Amount", "Payment", "Status", "Time", "Actions"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const pb = paymentBadge[order.payment_method] || { bg: "#f5f5f5", color: "#616161" };
                  const sb = statusBadge[order.payment_status] || { bg: "#f5f5f5", color: "#616161", label: order.payment_status };
                  const items = Array.isArray(order.items) ? order.items.map((i: any) => `${i.qty}x ${i.name}`).join(", ") : "";
                  const isShipped = order.payment_status === "shipped" || order.delivery_status === "shipped";
                  const isDelivered = order.payment_status === "delivered" || order.delivery_status === "delivered";
                  const canShip = !isShipped && !isDelivered && (order.payment_status === "confirmed" || order.payment_status === "cod_pending" || order.payment_status === "paid");
                  return (
                    <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-[12px] font-mono font-medium text-slate-700">
                        {order.order_reference}
                        {order.tracking_number && (
                          <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                            {COURIER_LABEL[order.courier || ""] || order.courier} · {order.tracking_number}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[13px] text-slate-600">{formatPhone(order.customer_phone)}</td>
                      <td className="py-3 px-4 text-[12px] text-slate-500 max-w-[150px] truncate">{items}</td>
                      <td className="py-3 px-4 text-[13px] font-semibold" style={{ color: "#1D9E75" }}>Rs. {order.total_amount}</td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase" style={{ background: pb.bg, color: pb.color }}>
                          {order.payment_method || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold" style={{ background: sb.bg, color: sb.color }}>
                          {sb.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[12px] text-slate-400">{timeAgo(order.created_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1.5 items-start">
                          {canShip && (
                            <button onClick={() => setShipModal(order)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap" style={{ background: "rgba(59,130,246,0.08)", color: "#1d4ed8" }}>
                              Mark Shipped
                            </button>
                          )}
                          {isShipped && !isDelivered && (
                            <button onClick={() => markDelivered(order.id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all whitespace-nowrap" style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}>
                              Mark Delivered
                            </button>
                          )}
                          {isDelivered && (
                            <span className="text-[11px] text-slate-400">✓ Complete</span>
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

      {shipModal && (
        <MarkShippedModal
          order={shipModal}
          onCancel={() => setShipModal(null)}
          onConfirm={(tn, courier) => markShipped(shipModal.id, tn, courier)}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Mark Shipped Modal ─────────────────────────────────────────────────────
function MarkShippedModal({
  order,
  onCancel,
  onConfirm,
}: {
  order: Order;
  onCancel: () => void;
  onConfirm: (trackingNumber: string, courier: string) => void;
}) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [courier, setCourier] = useState("tcs");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!trackingNumber.trim()) return;
    setSaving(true);
    await onConfirm(trackingNumber.trim(), courier);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-800">Mark as Shipped</h3>
            <p className="text-[11px] text-slate-400 font-mono">{order.order_reference}</p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel}>✕</button>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 p-3 rounded-xl text-[12px]" style={{ background: "#eff6ff", color: "#1e40af" }}>
            📱 The customer will receive a WhatsApp message with the tracking number and a live tracking link.
          </div>

          <div className="mb-4">
            <label className="form-label">Courier</label>
            <select className="form-input" value={courier} onChange={(e) => setCourier(e.target.value)}>
              {COURIERS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">Tracking Number / AWB</label>
            <input
              className="form-input"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="e.g. 8123456789"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && trackingNumber.trim() && submit()}
            />
            <p className="text-[11px] text-slate-400 mt-1.5">
              From the courier&apos;s waybill. The customer gets a live tracking link built from this.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button className="btn-secondary text-[13px]" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary text-[13px]" onClick={submit} disabled={saving || !trackingNumber.trim()}>
            {saving ? "Sending..." : "Mark Shipped & Notify"}
          </button>
        </div>
      </div>
    </div>
  );
}
