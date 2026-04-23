"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Client {
  id: string;
  client_name: string;
  business_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  plan: string;
  monthly_fee: string | null;
  status: string;
  added_at: string;
  bot_count: number;
  active_bots: number;
  client_tenant_id: string;
}

interface Analytics {
  clients: { total_clients: number; active_clients: number; churned_clients: number; total_mrr: number };
  bots: { total_bots: number; active_bots: number };
  revenue: { gross_revenue: number; waintel_cost: number; net_profit: number };
  conversations: { total_conversations: number };
}

interface AgencyBot {
  id: string;
  display_name: string;
  industry: string | null;
  is_active: boolean;
  client_name: string;
  business_name: string | null;
  messages_today: number;
}

interface RevenueRow {
  id: string;
  client_name: string;
  plan: string;
  amount: string;
  waintel_cost: string;
  agency_profit: string;
  month: string;
}

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "business", label: "Business" },
];

export default function AgencyOverviewPage() {
  const router = useRouter();
  const { tenantId, loading: authLoading } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [bots, setBots] = useState<AgencyBot[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAgency, setNotAgency] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [draft, setDraft] = useState({
    clientName: "", businessName: "", clientEmail: "", clientPhone: "",
    plan: "starter", monthlyFee: "", notes: "",
  });
  const [profitPreview, setProfitPreview] = useState<{ waintelCost: number; profit: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [a, c, b, r] = await Promise.all([
        axios.get(`${API}/api/agency/analytics?tenantId=${tenantId}`),
        axios.get(`${API}/api/agency/clients?tenantId=${tenantId}`),
        axios.get(`${API}/api/agency/all-bots?tenantId=${tenantId}`),
        axios.get(`${API}/api/agency/revenue?tenantId=${tenantId}&months=1`),
      ]);
      setAnalytics(a.data.analytics);
      setClients(c.data.clients || []);
      setBots(b.data.bots || []);
      setRevenue(r.data.revenue || []);
    } catch (err: any) {
      if (err.response?.status === 403) setNotAgency(true);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  // Live profit preview as fee/plan changes
  useEffect(() => {
    const fee = parseFloat(draft.monthlyFee);
    if (!fee || fee <= 0) { setProfitPreview(null); return; }
    axios.get(`${API}/api/agency/profit-preview?plan=${draft.plan}&fee=${fee}`)
      .then((res) => setProfitPreview(res.data))
      .catch(() => setProfitPreview(null));
  }, [draft.plan, draft.monthlyFee]);

  const addClient = async () => {
    if (!tenantId || !draft.clientName) {
      setToast({ message: "Client name required", type: "error" });
      return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/api/agency/clients`, { tenantId, ...draft });
      setToast({ message: "Client added", type: "success" });
      setDraft({ clientName: "", businessName: "", clientEmail: "", clientPhone: "", plan: "starter", monthlyFee: "", notes: "" });
      setShowAddForm(false);
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed", type: "error" });
    } finally { setSaving(false); }
  };

  const removeClient = async (id: string, name: string) => {
    if (!confirm(`Mark ${name} as churned?`)) return;
    try {
      await axios.delete(`${API}/api/agency/clients/${id}`);
      setToast({ message: "Marked as churned", type: "success" });
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  if (authLoading || loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  if (notAgency) {
    return (
      <div className="p-3 md:p-8 max-w-3xl">
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🏢</div>
          <h1 className="text-[24px] font-bold text-slate-900 mb-2">Agency mode not enabled</h1>
          <p className="text-slate-500 mb-6">This account isn't set up as an agency yet. Configure your white-label profile to get started.</p>
          <button className="btn-primary" onClick={() => router.push("/agency/setup")}>
            Set Up Agency Profile
          </button>
        </div>
      </div>
    );
  }

  const totalProfit = revenue.reduce((sum, r) => sum + parseFloat(r.agency_profit || "0"), 0);
  const totalRevenue = revenue.reduce((sum, r) => sum + parseFloat(r.amount || "0"), 0);
  const totalCost = revenue.reduce((sum, r) => sum + parseFloat(r.waintel_cost || "0"), 0);

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-7xl">
      <div className="mb-8">
        <div className="page-breadcrumb">🏢 Agency Overview</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Your Agency Dashboard</h1>
        <p className="text-[16px] text-slate-500">Manage your white-label clients, monitor their bots, and track recurring revenue.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPI label="Total Clients" value={String(analytics?.clients.total_clients ?? 0)} sub={`${analytics?.clients.active_clients ?? 0} active`} />
        <KPI label="Active Bots" value={String(analytics?.bots.active_bots ?? 0)} sub={`${analytics?.bots.total_bots ?? 0} total`} />
        <KPI label="Monthly Revenue" value={`Rs. ${(analytics?.revenue.gross_revenue ?? 0).toLocaleString("en-PK")}`} />
        <KPI label="Net Profit" value={`Rs. ${(analytics?.revenue.net_profit ?? 0).toLocaleString("en-PK")}`} color="#047857" />
      </div>

      {/* Clients Section */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-slate-800">👥 Clients</h2>
          <button className="btn-primary text-[13px]" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? "Cancel" : "+ Add Client"}
          </button>
        </div>

        {showAddForm && (
          <div className="rounded-xl p-4 mb-5" style={{ background: "rgba(29,158,117,0.04)", border: "1px solid rgba(29,158,117,0.2)" }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Client Name *</label>
                <input className="form-input" value={draft.clientName} onChange={(e) => setDraft({ ...draft, clientName: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Business Name</label>
                <input className="form-input" value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={draft.clientEmail} onChange={(e) => setDraft({ ...draft, clientEmail: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={draft.clientPhone} onChange={(e) => setDraft({ ...draft, clientPhone: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Plan</label>
                <select className="form-input" value={draft.plan} onChange={(e) => setDraft({ ...draft, plan: e.target.value })}>
                  {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Monthly Fee (Rs.) — what you charge them</label>
                <input className="form-input" type="number" value={draft.monthlyFee} onChange={(e) => setDraft({ ...draft, monthlyFee: e.target.value })} />
                {profitPreview && (
                  <div className="mt-1 text-[11px]">
                    Waintel cost: Rs. {profitPreview.waintelCost.toLocaleString("en-PK")}
                    {" • "}
                    <span className={profitPreview.profit >= 0 ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                      Your profit: Rs. {profitPreview.profit.toLocaleString("en-PK")}
                    </span>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Notes</label>
                <textarea className="form-input" rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-4">
              <button className="btn-primary text-[13px]" onClick={addClient} disabled={saving}>
                {saving ? "Saving..." : "Save Client"}
              </button>
            </div>
          </div>
        )}

        {clients.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No clients yet. Add your first client to start earning recurring revenue.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Business</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3">Bots</th>
                  <th className="py-2 pr-3">MRR</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Added</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      <div>{c.business_name || c.client_name}</div>
                      {c.client_email && <div className="text-[10px] text-slate-400">{c.client_email}</div>}
                    </td>
                    <td className="py-2 pr-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{c.plan}</span></td>
                    <td className="py-2 pr-3 text-slate-700">{c.active_bots}/{c.bot_count}</td>
                    <td className="py-2 pr-3 text-slate-700">Rs. {Number(c.monthly_fee || 0).toLocaleString("en-PK")}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: c.status === "active" ? "#dcfce7" : "#fee2e2",
                        color: c.status === "active" ? "#166534" : "#b91c1c",
                      }}>{c.status}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500 text-[11px]">{new Date(c.added_at).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="py-2 text-right">
                      {c.status === "active" && (
                        <button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => removeClient(c.id, c.client_name)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All Bots Section */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">🤖 All Client Bots</h2>
        {bots.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No bots yet. Clients need to onboard their bots through their own dashboards.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Bot</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Industry</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Today</th>
                </tr>
              </thead>
              <tbody>
                {bots.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{b.display_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{b.business_name || b.client_name}</td>
                    <td className="py-2 pr-3 text-slate-500">{b.industry || "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: b.is_active ? "#dcfce7" : "#f1f5f9",
                        color: b.is_active ? "#166534" : "#475569",
                      }}>{b.is_active ? "Active" : "Inactive"}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-700 font-semibold">{b.messages_today}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Revenue Section */}
      <div className="card" id="revenue">
        <h2 className="text-[18px] font-bold text-slate-800 mb-4">💰 Revenue This Month</h2>
        {revenue.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No revenue records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Plan</th>
                  <th className="py-2 pr-3 text-right">You Charge</th>
                  <th className="py-2 pr-3 text-right">Waintel Cost</th>
                  <th className="py-2 pr-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{r.client_name}</td>
                    <td className="py-2 pr-3">{r.plan}</td>
                    <td className="py-2 pr-3 text-right text-slate-700">Rs. {Number(r.amount).toLocaleString("en-PK")}</td>
                    <td className="py-2 pr-3 text-right text-slate-500">Rs. {Number(r.waintel_cost).toLocaleString("en-PK")}</td>
                    <td className="py-2 pr-3 text-right text-green-700 font-semibold">Rs. {Number(r.agency_profit).toLocaleString("en-PK")}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="py-3 pr-3 text-slate-900" colSpan={2}>Total</td>
                  <td className="py-3 pr-3 text-right">Rs. {totalRevenue.toLocaleString("en-PK")}</td>
                  <td className="py-3 pr-3 text-right">Rs. {totalCost.toLocaleString("en-PK")}</td>
                  <td className="py-3 pr-3 text-right text-green-700">Rs. {totalProfit.toLocaleString("en-PK")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="card !py-4">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[22px] font-bold" style={{ color: color || "#0f172a" }}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
