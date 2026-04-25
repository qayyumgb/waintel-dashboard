"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  permissions: string[];
  rate_limit: number;
  usage_count: number;
  usage_this_month: number;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  bot_id: string | null;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_triggered_at: string | null;
  created_at: string;
  bot_id: string | null;
}

interface UsageDay {
  date: string;
  requests: number;
  successful: number;
  errors: number;
  avg_duration_ms: number;
}

interface UsageEndpoint {
  endpoint: string;
  requests: number;
  errors: number;
  avg_duration_ms: number;
}

interface Delivery {
  id: string;
  event_type: string;
  status: string;
  response_code: number | null;
  duration_ms: number | null;
  attempt_count: number;
  delivered_at: string | null;
  created_at: string;
}

interface Bot { id: string; display_name: string; }

const ALL_EVENTS = [
  "message.received", "message.sent",
  "order.created", "order.paid",
  "lead.qualified", "lead.hot",
  "appointment.booked", "enrollment.submitted",
  "campaign.completed", "payment.verified",
  "bot.connected", "bot.disconnected",
];

function timeAgo(d: string | null): string {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function DeveloperPage() {
  const { tenantId, botId } = useAuth();
  const [planAllowed, setPlanAllowed] = useState<boolean | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [usageDays, setUsageDays] = useState<UsageDay[]>([]);
  const [usageEndpoints, setUsageEndpoints] = useState<UsageEndpoint[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [createdKeyValue, setCreatedKeyValue] = useState<string | null>(null);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<Webhook | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);

  // Code example tab
  const [codeTab, setCodeTab] = useState<"curl" | "node" | "python">("curl");

  // Plan gate
  useEffect(() => {
    if (!tenantId) return;
    axios.get(`${API}/api/billing/status/${tenantId}`).then((r) => {
      setPlanAllowed(r.data.plan === 'agency');
    }).catch(() => setPlanAllowed(false));
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [k, w, u, b] = await Promise.all([
        axios.get(`${API}/api/developer/keys?tenantId=${tenantId}`),
        axios.get(`${API}/api/developer/webhooks?tenantId=${tenantId}`),
        axios.get(`${API}/api/developer/usage?tenantId=${tenantId}&days=30`),
        botId ? axios.get(`${API}/api/bots/${botId}`).then(r => ({ data: { bots: [r.data] }})) : Promise.resolve({ data: { bots: [] }}),
      ]);
      setKeys(k.data.keys || []);
      setWebhooks(w.data.webhooks || []);
      setUsageDays(u.data.by_day || []);
      setUsageEndpoints(u.data.by_endpoint || []);
      // Quick bot list (just current bot for now; could expand to fetch all tenant bots)
      const botList: Bot[] = b.data.bots ? b.data.bots.map((bot: any) => ({ id: bot.id, display_name: bot.display_name })) : [];
      setBots(botList);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [tenantId, botId]);

  useEffect(() => { if (planAllowed) load(); }, [planAllowed, load]);

  // ── Key creation ──────────────────────────────────────────────────
  const [keyDraft, setKeyDraft] = useState({
    name: "", botId: "", read: true, write: true, rateLimit: 1000, expiresAt: "",
  });
  const createKey = async () => {
    if (!tenantId || !keyDraft.name) {
      setToast({ message: "Key name required", type: "error" });
      return;
    }
    try {
      const perms = [keyDraft.read && "read", keyDraft.write && "write"].filter(Boolean);
      const { data } = await axios.post(`${API}/api/developer/keys`, {
        tenantId,
        botId: keyDraft.botId || null,
        name: keyDraft.name,
        permissions: perms,
        rateLimit: keyDraft.rateLimit,
        expiresAt: keyDraft.expiresAt || null,
      });
      setCreatedKeyValue(data.api_key);
      setKeyDraft({ name: "", botId: "", read: true, write: true, rateLimit: 1000, expiresAt: "" });
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Create failed", type: "error" });
    }
  };

  const revokeKey = async (id: string, name: string) => {
    if (!confirm(`Revoke "${name}"? It will stop working immediately.`)) return;
    try {
      await axios.delete(`${API}/api/developer/keys/${id}`);
      setToast({ message: "Key revoked", type: "success" });
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  // ── Webhook creation ──────────────────────────────────────────────
  const [whDraft, setWhDraft] = useState({
    name: "", url: "", botId: "", events: ["message.received"] as string[],
  });
  const toggleEvent = (e: string) => {
    setWhDraft((d) => ({
      ...d,
      events: d.events.includes(e) ? d.events.filter((x) => x !== e) : [...d.events, e],
    }));
  };
  const createWebhook = async () => {
    if (!tenantId || !whDraft.name || !whDraft.url) {
      setToast({ message: "Name and URL required", type: "error" });
      return;
    }
    if (whDraft.events.length === 0) {
      setToast({ message: "Select at least one event", type: "error" });
      return;
    }
    try {
      const { data } = await axios.post(`${API}/api/developer/webhooks`, {
        tenantId,
        botId: whDraft.botId || null,
        name: whDraft.name,
        url: whDraft.url,
        events: whDraft.events,
      });
      setCreatedSecret(data.secret);
      setWhDraft({ name: "", url: "", botId: "", events: ["message.received"] });
      load();
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Create failed", type: "error" });
    }
  };

  const testWebhook = async (id: string) => {
    try {
      await axios.post(`${API}/api/developer/webhooks/${id}/test`);
      setToast({ message: "Test sent — check Deliveries", type: "success" });
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const toggleWebhook = async (id: string, current: boolean) => {
    try {
      await axios.patch(`${API}/api/developer/webhooks/${id}`, { isActive: !current });
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const deleteWebhook = async (id: string, name: string) => {
    if (!confirm(`Delete webhook "${name}"?`)) return;
    try {
      await axios.delete(`${API}/api/developer/webhooks/${id}`);
      setToast({ message: "Deleted", type: "success" });
      load();
    } catch { setToast({ message: "Failed", type: "error" }); }
  };

  const openDeliveries = async (wh: Webhook) => {
    setDeliveriesFor(wh);
    try {
      const { data } = await axios.get(`${API}/api/developer/webhooks/${wh.id}/deliveries`);
      setDeliveries(data.deliveries || []);
    } catch { setDeliveries([]); }
  };

  // ── Loading / gate ───────────────────────────────────────────────
  if (planAllowed === null) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }
  if (!planAllowed) {
    return (
      <div className="p-3 md:p-8 max-w-3xl">
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-[24px] font-bold text-slate-900 mb-2">Developer API is an Agency-tier feature</h1>
          <p className="text-slate-500 mb-6">Upgrade to the Agency plan to create API keys, configure webhooks, and integrate Waintel with your own systems.</p>
          <a href="/pricing" className="btn-primary">View Plans</a>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-3 md:p-8"><div className="text-center py-20 text-slate-400">Loading...</div></div>;
  }

  const totalRequests = usageDays.reduce((s, d) => s + d.requests, 0);
  const totalErrors = usageDays.reduce((s, d) => s + d.errors, 0);
  const errorRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 100) : 0;
  const maxDay = Math.max(1, ...usageDays.map((d) => d.requests));

  return (
    <div className="p-3 md:p-8 animate-fade-in max-w-7xl">
      <div className="mb-8">
        <div className="page-breadcrumb">{"</> Developer"}</div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Developer API & Webhooks</h1>
        <p className="text-[16px] text-slate-500">Build integrations on top of Waintel. REST API to send messages, query data, and trigger actions. Webhooks to receive real-time events.</p>
      </div>

      {/* ── API Keys ───────────────────────────────────────────── */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-slate-800">🔑 API Keys</h2>
          <button className="btn-primary text-[13px]" onClick={() => setShowCreateKey(true)}>+ Create API Key</button>
        </div>
        {keys.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No API keys yet. Create one to start integrating with Waintel from your apps.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Key</th>
                  <th className="py-2 pr-3">Permissions</th>
                  <th className="py-2 pr-3">Rate Limit</th>
                  <th className="py-2 pr-3">Used (mo.)</th>
                  <th className="py-2 pr-3">Last Used</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{k.name}</td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-slate-500">{k.key_preview}</td>
                    <td className="py-2 pr-3">{(k.permissions || []).map((p) => (
                      <span key={p} className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 mr-1">{p}</span>
                    ))}</td>
                    <td className="py-2 pr-3 text-slate-700">{k.rate_limit}/hr</td>
                    <td className="py-2 pr-3 text-slate-700">{k.usage_this_month}</td>
                    <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(k.last_used_at)}</td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: k.is_active ? "#dcfce7" : "#fee2e2",
                        color: k.is_active ? "#166534" : "#b91c1c",
                      }}>{k.is_active ? "Active" : "Revoked"}</span>
                    </td>
                    <td className="py-2 text-right">
                      {k.is_active && <button className="text-[11px] text-red-500 hover:underline" onClick={() => revokeKey(k.id, k.name)}>Revoke</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Webhooks ──────────────────────────────────────────── */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-[18px] font-bold text-slate-800">🔔 Webhooks</h2>
          <button className="btn-primary text-[13px]" onClick={() => setShowCreateWebhook(true)}>+ Add Webhook</button>
        </div>
        {webhooks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No webhooks. Add one to receive real-time events from Waintel — message.received, order.paid, lead.hot, etc.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">URL</th>
                  <th className="py-2 pr-3">Events</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Success / Fail</th>
                  <th className="py-2 pr-3">Last Triggered</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{w.name}</td>
                    <td className="py-2 pr-3 font-mono text-[10px] text-slate-500 max-w-[260px] truncate">{w.url}</td>
                    <td className="py-2 pr-3"><span className="text-[10px] text-slate-500">{(w.events || []).length} events</span></td>
                    <td className="py-2 pr-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                        background: w.is_active ? "#dcfce7" : "#f1f5f9",
                        color: w.is_active ? "#166534" : "#475569",
                      }}>{w.is_active ? "Active" : "Disabled"}</span>
                    </td>
                    <td className="py-2 pr-3 text-[11px]">
                      <span className="text-green-700">{w.success_count}</span>
                      {" / "}
                      <span className="text-red-600">{w.failure_count}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(w.last_triggered_at)}</td>
                    <td className="py-2 text-right">
                      <div className="flex gap-2 justify-end">
                        <button className="text-[11px] text-blue-700 hover:underline" onClick={() => testWebhook(w.id)}>Test</button>
                        <button className="text-[11px] text-slate-600 hover:underline" onClick={() => openDeliveries(w)}>Log</button>
                        <button className="text-[11px] text-amber-700 hover:underline" onClick={() => toggleWebhook(w.id, w.is_active)}>
                          {w.is_active ? "Disable" : "Enable"}
                        </button>
                        <button className="text-[11px] text-red-500 hover:underline" onClick={() => deleteWebhook(w.id, w.name)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Usage Chart ───────────────────────────────────────── */}
      <div className="card mb-8">
        <h2 className="text-[18px] font-bold text-slate-800 mb-1">📊 API Usage — Last 30 Days</h2>
        <p className="text-[12px] text-slate-500 mb-4">{totalRequests.toLocaleString()} total requests · {errorRate}% error rate</p>
        {usageDays.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-[13px]">No API requests yet. Make your first call to see analytics here.</div>
        ) : (
          <>
            <div className="flex items-end gap-1 h-32 border-b border-slate-200 mb-4">
              {usageDays.map((d) => {
                const succ = (d.successful / Math.max(1, maxDay)) * 100;
                const err = (d.errors / Math.max(1, maxDay)) * 100;
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-0" title={`${d.date}: ${d.requests} req (${d.errors} err)`}>
                    {d.errors > 0 && <div className="w-full" style={{ height: `${err}%`, background: "#ef4444" }} />}
                    <div className="w-full" style={{ height: `${succ}%`, background: "#10b981" }} />
                  </div>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-3">Endpoint</th>
                    <th className="py-2 pr-3 text-right">Requests</th>
                    <th className="py-2 pr-3 text-right">Errors</th>
                    <th className="py-2 pr-3 text-right">Avg Time</th>
                  </tr>
                </thead>
                <tbody>
                  {usageEndpoints.slice(0, 10).map((e) => (
                    <tr key={e.endpoint} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-[11px] text-slate-700">{e.endpoint}</td>
                      <td className="py-2 pr-3 text-right">{e.requests}</td>
                      <td className="py-2 pr-3 text-right text-red-600">{e.errors}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{e.avg_duration_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Quick Start ───────────────────────────────────────── */}
      <div className="card">
        <h2 className="text-[18px] font-bold text-slate-800 mb-3">🚀 Quick Start</h2>
        <div className="flex gap-2 mb-3 border-b border-slate-200">
          {(["curl", "node", "python"] as const).map((t) => (
            <button key={t} className={`px-3 py-2 text-[13px] font-semibold border-b-2 -mb-px ${codeTab === t ? "border-[#1D9E75] text-[#1D9E75]" : "border-transparent text-slate-500"}`} onClick={() => setCodeTab(t)}>
              {t === "curl" ? "cURL" : t === "node" ? "Node.js" : "Python"}
            </button>
          ))}
        </div>
        <div className="rounded-lg p-4 bg-slate-900 text-slate-100 text-[12px] font-mono whitespace-pre overflow-x-auto">
{codeTab === "curl" && `curl -X POST ${API}/v1/messages/send \\
  -H "X-Api-Key: wnt_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "bot_id": "your-bot-id",
    "customer_phone": "923001234567",
    "message": "Hello from Waintel API!"
  }'`}
{codeTab === "node" && `const res = await fetch('${API}/v1/messages/send', {
  method: 'POST',
  headers: {
    'X-Api-Key': 'wnt_your_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    bot_id: 'your-bot-id',
    customer_phone: '923001234567',
    message: 'Hello from Waintel API!'
  })
});
const data = await res.json();`}
{codeTab === "python" && `import requests

res = requests.post(
    '${API}/v1/messages/send',
    headers={'X-Api-Key': 'wnt_your_key_here'},
    json={
        'bot_id': 'your-bot-id',
        'customer_phone': '923001234567',
        'message': 'Hello from Waintel API!'
    }
)
print(res.json())`}
        </div>

        <h3 className="text-[14px] font-bold text-slate-800 mt-6 mb-2">Verifying webhook signatures (Node.js)</h3>
        <div className="rounded-lg p-4 bg-slate-900 text-slate-100 text-[12px] font-mono whitespace-pre overflow-x-auto">
{`const crypto = require('crypto');

function verifyWebhook(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return signatureHeader === \`sha256=\${expected}\`;
}

// In your Express handler:
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const ok = verifyWebhook(
    req.body.toString(),
    req.headers['x-waintel-signature'],
    'YOUR_WEBHOOK_SECRET'
  );
  if (!ok) return res.status(401).send('Invalid signature');
  const payload = JSON.parse(req.body.toString());
  console.log(payload.event, payload.data);
  res.json({ ok: true });
});`}
        </div>
      </div>

      {/* ── Create Key Modal ──────────────────────────────────── */}
      {showCreateKey && !createdKeyValue && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreateKey(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">Create API Key</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Key Name</label>
                <input className="form-input" placeholder="My Integration" value={keyDraft.name} onChange={(e) => setKeyDraft({ ...keyDraft, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Bot (optional — leave blank for all bots)</label>
                <select className="form-input" value={keyDraft.botId} onChange={(e) => setKeyDraft({ ...keyDraft, botId: e.target.value })}>
                  <option value="">All bots in tenant</option>
                  {bots.map((b) => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Permissions</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={keyDraft.read} onChange={(e) => setKeyDraft({ ...keyDraft, read: e.target.checked })} />
                    Read (GET)
                  </label>
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={keyDraft.write} onChange={(e) => setKeyDraft({ ...keyDraft, write: e.target.checked })} />
                    Write (POST/PATCH)
                  </label>
                </div>
              </div>
              <div>
                <label className="form-label">Rate Limit</label>
                <select className="form-input" value={keyDraft.rateLimit} onChange={(e) => setKeyDraft({ ...keyDraft, rateLimit: parseInt(e.target.value) })}>
                  <option value={100}>100 / hour</option>
                  <option value={1000}>1,000 / hour</option>
                  <option value={10000}>10,000 / hour</option>
                </select>
              </div>
              <div>
                <label className="form-label">Expiry (optional)</label>
                <input type="date" className="form-input" value={keyDraft.expiresAt} onChange={(e) => setKeyDraft({ ...keyDraft, expiresAt: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1" onClick={createKey}>Create Key</button>
              <button className="btn-secondary" onClick={() => setShowCreateKey(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Show Key Once Modal ───────────────────────────────── */}
      {createdKeyValue && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔑</div>
              <h2 className="text-[20px] font-bold text-slate-900">Your API Key</h2>
              <p className="text-[12px] text-slate-500">Copy it now — it will <b>not be shown again</b>.</p>
            </div>
            <div className="rounded-lg p-3 bg-slate-100 font-mono text-[12px] text-slate-800 break-all mb-3 select-all">
              {createdKeyValue}
            </div>
            <div className="flex gap-2 mb-4">
              <button className="btn-primary flex-1 text-[13px]" onClick={() => { navigator.clipboard.writeText(createdKeyValue); setToast({ message: "Copied to clipboard", type: "success" }); }}>📋 Copy</button>
            </div>
            <div className="rounded-lg p-3 bg-amber-50 border border-amber-200 text-[12px] text-amber-900 mb-4">
              ⚠️ Treat this key like a password. Store it in your app's environment variables. Never commit it to git or share it publicly.
            </div>
            <button className="btn-secondary w-full" onClick={() => { setCreatedKeyValue(null); setShowCreateKey(false); }}>I've saved it — close</button>
          </div>
        </div>
      )}

      {/* ── Create Webhook Modal ──────────────────────────────── */}
      {showCreateWebhook && !createdSecret && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCreateWebhook(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-[18px] font-bold text-slate-900 mb-4">Add Webhook</h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Name</label>
                <input className="form-input" placeholder="My CRM Webhook" value={whDraft.name} onChange={(e) => setWhDraft({ ...whDraft, name: e.target.value })} />
              </div>
              <div>
                <label className="form-label">URL</label>
                <input className="form-input font-mono text-[12px]" placeholder="https://your-app.com/webhook" value={whDraft.url} onChange={(e) => setWhDraft({ ...whDraft, url: e.target.value })} />
              </div>
              <div>
                <label className="form-label">Events</label>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {ALL_EVENTS.map((e) => (
                    <label key={e} className="flex items-center gap-2 text-[12px] cursor-pointer p-1 rounded hover:bg-slate-50">
                      <input type="checkbox" checked={whDraft.events.includes(e)} onChange={() => toggleEvent(e)} />
                      <span className="font-mono">{e}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-primary flex-1" onClick={createWebhook}>Add Webhook</button>
              <button className="btn-secondary" onClick={() => setShowCreateWebhook(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Show Secret Once Modal ────────────────────────────── */}
      {createdSecret && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">🔐</div>
              <h2 className="text-[20px] font-bold text-slate-900">Webhook Secret</h2>
              <p className="text-[12px] text-slate-500">Use this secret to verify webhook signatures. <b>Saved here only once.</b></p>
            </div>
            <div className="rounded-lg p-3 bg-slate-100 font-mono text-[11px] text-slate-800 break-all mb-3 select-all">
              {createdSecret}
            </div>
            <button className="btn-primary w-full text-[13px] mb-3" onClick={() => { navigator.clipboard.writeText(createdSecret); setToast({ message: "Copied", type: "success" }); }}>📋 Copy Secret</button>
            <button className="btn-secondary w-full" onClick={() => { setCreatedSecret(null); setShowCreateWebhook(false); }}>I've saved it — close</button>
          </div>
        </div>
      )}

      {/* ── Deliveries Modal ──────────────────────────────────── */}
      {deliveriesFor && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDeliveriesFor(null)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-[18px] font-bold text-slate-900">{deliveriesFor.name}</h2>
                <p className="text-[12px] text-slate-500 font-mono">{deliveriesFor.url}</p>
              </div>
              <button className="text-slate-400 hover:text-slate-700 text-[24px] leading-none" onClick={() => setDeliveriesFor(null)}>×</button>
            </div>
            {deliveries.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-[13px]">No deliveries yet. Click "Test" on the webhook list to send a test event.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-3">Event</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">HTTP</th>
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Attempt</th>
                      <th className="py-2 pr-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((d) => (
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono text-[11px]">{d.event_type}</td>
                        <td className="py-2 pr-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{
                            background: d.status === "delivered" ? "#dcfce7" : "#fee2e2",
                            color: d.status === "delivered" ? "#166534" : "#b91c1c",
                          }}>{d.status}</span>
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{d.response_code || "—"}</td>
                        <td className="py-2 pr-3 text-slate-500">{d.duration_ms || 0}ms</td>
                        <td className="py-2 pr-3 text-slate-500">#{d.attempt_count}</td>
                        <td className="py-2 pr-3 text-slate-500 text-[11px]">{timeAgo(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
