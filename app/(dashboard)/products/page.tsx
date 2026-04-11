"use client";

import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function ProductsPage() {
  const { botId } = useAuth();
  const BOT_ID = botId || "";
  const [industry, setIndustry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!BOT_ID) return;
    axios.get(`${API}/api/bots/${BOT_ID}`)
      .then((res) => setIndustry((res.data.industry || "").toLowerCase()))
      .catch(() => setIndustry(""))
      .finally(() => setLoading(false));
  }, [BOT_ID]);

  if (loading) {
    return (
      <div className="p-8 animate-fade-in">
        <div className="text-center py-20 text-slate-400">Loading...</div>
      </div>
    );
  }

  const isEcommerce = industry === "e-commerce" || industry === "ecommerce";

  if (!isEcommerce) {
    return (
      <div className="p-8 animate-fade-in max-w-4xl">
        <div className="card text-center py-16">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(29,158,117,0.08)" }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-slate-800 mb-2">Products are for E-commerce bots only</h2>
          <p className="text-[13px] text-slate-500 mb-5">
            Switch your bot's industry to <b>E-commerce</b> in Bot Setup to manage a product catalog and size charts.
          </p>
          <a href="/bot-setup" className="btn-primary text-[13px] inline-block">Go to Bot Setup</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in max-w-6xl">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
          </svg>
          Products
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Product Catalog</h1>
        <p className="text-[16px] text-slate-500">Manage your store's products and size charts. Import from Shopify, WooCommerce, a website URL, or your knowledge base.</p>
      </div>

      <ProductCatalog botId={BOT_ID} />
      <SizeChartsPanel botId={BOT_ID} />
    </div>
  );
}

// ── Product Catalog Panel ────────────────────────────────────────────────────
function ProductCatalog({ botId }: { botId: string }) {
  const { tenantId } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState({
    name: "", category: "Tops", price: "", salePrice: "",
    sku: "", sizesAvailable: "", colorsAvailable: "",
    stockQuantity: "0", description: "",
  });
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedProduct[] | null>(null);
  const [importSource, setImportSource] = useState<string>("");
  const [urlPromptOpen, setUrlPromptOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [botMeta, setBotMeta] = useState<{
    shopifyConfigured: boolean;
    wooConfigured: boolean;
    lastShopifySync: string | null;
    lastWooSync: string | null;
  }>({ shopifyConfigured: false, wooConfigured: false, lastShopifySync: null, lastWooSync: null });

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/ecommerce/products?botId=${botId}`);
      setProducts(r.data.products || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [botId]);

  const loadBotMeta = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/bots/${botId}`);
      setBotMeta({
        shopifyConfigured: !!(r.data.shopify_domain && r.data.shopify_access_token),
        wooConfigured: !!(r.data.woocommerce_url && r.data.woocommerce_key && r.data.woocommerce_secret),
        lastShopifySync: r.data.last_shopify_sync || null,
        lastWooSync: r.data.last_woocommerce_sync || null,
      });
    } catch { /* silent */ }
  }, [botId]);

  useEffect(() => { load(); loadBotMeta(); }, [load, loadBotMeta]);

  const startImport = async (source: "shopify" | "woocommerce" | "kb") => {
    setImportMenuOpen(false);
    setImporting(source);
    try {
      const r = await axios.post(`${API}/api/ecommerce/import/${source}/preview`, { botId });
      if (!r.data.preview?.length) {
        setToast({ message: `No products found from ${source}`, type: "error" });
        return;
      }
      setImportSource(source);
      setImportPreview(r.data.preview);
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || `Failed to import from ${source}`, type: "error" });
    } finally {
      setImporting(null);
    }
  };

  const startUrlImport = async () => {
    if (!urlInput.trim()) return;
    setUrlPromptOpen(false);
    setImporting("url");
    try {
      const r = await axios.post(`${API}/api/ecommerce/import/url/preview`, { botId, url: urlInput });
      if (!r.data.preview?.length) {
        setToast({ message: "No products found on this page. Site may use JavaScript rendering.", type: "error" });
        return;
      }
      setImportSource("url");
      setImportPreview(r.data.preview);
    } catch (err: any) {
      setToast({ message: err.response?.data?.error || "Failed to scrape URL", type: "error" });
    } finally {
      setImporting(null);
      setUrlInput("");
    }
  };

  const confirmImport = async (selected: ImportedProduct[]) => {
    try {
      const r = await axios.post(`${API}/api/ecommerce/products/bulk`, {
        botId, tenantId, products: selected, source: importSource,
      });
      setToast({ message: `Imported ${r.data.imported} products`, type: "success" });
      setImportPreview(null);
      load();
      loadBotMeta();
    } catch {
      setToast({ message: "Failed to import products", type: "error" });
    }
  };

  const addProduct = async () => {
    if (!draft.name.trim()) { setToast({ message: "Product name required", type: "error" }); return; }
    try {
      await axios.post(`${API}/api/ecommerce/products`, {
        botId, tenantId,
        name: draft.name,
        category: draft.category,
        price: parseFloat(draft.price) || 0,
        salePrice: draft.salePrice ? parseFloat(draft.salePrice) : null,
        sku: draft.sku || null,
        sizesAvailable: draft.sizesAvailable,
        colorsAvailable: draft.colorsAvailable,
        stockQuantity: parseInt(draft.stockQuantity) || 0,
        description: draft.description,
      });
      setShowForm(false);
      setDraft({ name: "", category: "Tops", price: "", salePrice: "", sku: "", sizesAvailable: "", colorsAvailable: "", stockQuantity: "0", description: "" });
      setToast({ message: "Product added", type: "success" });
      load();
    } catch {
      setToast({ message: "Failed to add product", type: "error" });
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await axios.delete(`${API}/api/ecommerce/products/${id}`);
      setToast({ message: "Product deleted", type: "success" });
      load();
    } catch {
      setToast({ message: "Failed to delete", type: "error" });
    }
  };

  return (
    <div className="card mb-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-slate-800">Catalog ({products.length})</h2>
        <div className="flex items-center gap-2 relative">
          <button
            className="btn-secondary text-[12px]"
            onClick={() => setImportMenuOpen(!importMenuOpen)}
            disabled={!!importing}
          >
            {importing ? `Importing from ${importing}...` : "Import Products ▾"}
          </button>
          <button className="btn-secondary text-[12px]" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Manually"}
          </button>
          {importMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-20 overflow-hidden">
              <button
                className={`w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2 ${!botMeta.shopifyConfigured && "opacity-50 cursor-not-allowed"}`}
                disabled={!botMeta.shopifyConfigured}
                onClick={() => startImport("shopify")}
              >
                <span>🛒</span> From Shopify
                {!botMeta.shopifyConfigured && <span className="ml-auto text-[10px] text-slate-400">Not configured</span>}
              </button>
              <button
                className={`w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100 ${!botMeta.wooConfigured && "opacity-50 cursor-not-allowed"}`}
                disabled={!botMeta.wooConfigured}
                onClick={() => startImport("woocommerce")}
              >
                <span>🛍️</span> From WooCommerce
                {!botMeta.wooConfigured && <span className="ml-auto text-[10px] text-slate-400">Not configured</span>}
              </button>
              <button
                className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                onClick={() => { setImportMenuOpen(false); setUrlPromptOpen(true); }}
              >
                <span>🌐</span> From Website URL
              </button>
              <button
                className="w-full text-left px-4 py-3 text-[13px] hover:bg-slate-50 flex items-center gap-2 border-t border-slate-100"
                onClick={() => startImport("kb")}
              >
                <span>📄</span> From Knowledge Base
              </button>
            </div>
          )}
        </div>
      </div>

      {(botMeta.lastShopifySync || botMeta.lastWooSync) && (
        <div className="mb-4 p-3 rounded-xl flex items-center justify-between" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
          <div className="text-[12px] text-amber-900">
            {botMeta.lastShopifySync && <>🛒 Last Shopify sync: <b>{timeAgo(botMeta.lastShopifySync)}</b>. </>}
            {botMeta.lastWooSync && <>🛍️ Last WooCommerce sync: <b>{timeAgo(botMeta.lastWooSync)}</b>. </>}
            Stock may be outdated — sync regularly for accuracy.
          </div>
          {botMeta.shopifyConfigured && (
            <button className="btn-secondary text-[11px] !py-1" onClick={() => startImport("shopify")} disabled={!!importing}>
              🔄 Sync Now
            </button>
          )}
        </div>
      )}

      {urlPromptOpen && (
        <div className="mb-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <label className="form-label">Website URL</label>
          <div className="flex gap-2">
            <input
              className="form-input flex-1"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://mystore.com/products"
              onKeyDown={(e) => e.key === "Enter" && startUrlImport()}
            />
            <button className="btn-primary text-[12px]" onClick={startUrlImport} disabled={!urlInput.trim()}>Scrape</button>
            <button className="btn-secondary text-[12px]" onClick={() => { setUrlPromptOpen(false); setUrlInput(""); }}>Cancel</button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">We'll fetch the page and ask AI to extract products. Works best on simple product listing pages.</p>
        </div>
      )}

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Product Name</label>
              <input className="form-input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Lawn Printed Shirt" />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select className="form-input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                <option>Tops</option>
                <option>Bottoms</option>
                <option>Suits</option>
                <option>Shoes</option>
                <option>Accessories</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="form-label">Price (Rs.)</label>
              <input type="number" className="form-input" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="1200" />
            </div>
            <div>
              <label className="form-label">Sale Price (Rs.) <span className="text-slate-400">optional</span></label>
              <input type="number" className="form-input" value={draft.salePrice} onChange={(e) => setDraft({ ...draft, salePrice: e.target.value })} placeholder="999" />
            </div>
            <div>
              <label className="form-label">SKU <span className="text-slate-400">optional</span></label>
              <input className="form-input" value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} placeholder="SKU-001" />
            </div>
            <div>
              <label className="form-label">Stock Quantity</label>
              <input type="number" className="form-input" value={draft.stockQuantity} onChange={(e) => setDraft({ ...draft, stockQuantity: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Sizes Available</label>
              <input className="form-input" value={draft.sizesAvailable} onChange={(e) => setDraft({ ...draft, sizesAvailable: e.target.value })} placeholder="S, M, L, XL" />
            </div>
            <div>
              <label className="form-label">Colors Available</label>
              <input className="form-input" value={draft.colorsAvailable} onChange={(e) => setDraft({ ...draft, colorsAvailable: e.target.value })} placeholder="Black, White, Navy" />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label">Description</label>
            <textarea className="form-input" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Soft lawn fabric, printed design..." />
          </div>
          <button className="btn-primary text-[13px]" onClick={addProduct}>Save Product</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-[13px]">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-[13px]">No products yet. Click &quot;Import Products&quot; or &quot;Add Manually&quot; to start.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Price</th>
                <th className="py-2 pr-3">Sale</th>
                <th className="py-2 pr-3">Stock</th>
                <th className="py-2 pr-3">Sizes</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-800">{p.name}</td>
                  <td className="py-2 pr-3 text-slate-500">{p.category || "—"}</td>
                  <td className="py-2 pr-3">Rs. {p.price}</td>
                  <td className="py-2 pr-3">{p.sale_price ? `Rs. ${p.sale_price}` : "—"}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${p.stock_quantity <= 0 ? "bg-red-50 text-red-700" : p.stock_quantity < 5 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{p.sizes_available || "—"}</td>
                  <td className="py-2 text-right">
                    <button
                      className="text-[#1D9E75] hover:text-[#0F6E56] text-[11px] font-medium mr-3"
                      onClick={() => setEditing(p)}
                    >
                      Edit
                    </button>
                    <button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => deleteProduct(p.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {importPreview && (
        <ImportReviewModal
          source={importSource}
          initialProducts={importPreview}
          onCancel={() => setImportPreview(null)}
          onConfirm={confirmImport}
        />
      )}

      {editing && (
        <ProductEditModal
          product={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setToast({ message: "Product updated", type: "success" });
            load();
          }}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Product Edit Modal ─────────────────────────────────────────────────────
function ProductEditModal({
  product,
  onCancel,
  onSaved,
}: {
  product: Product;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name || "",
    category: product.category || "",
    price: product.price ?? "",
    salePrice: product.sale_price ?? "",
    sku: product.sku || "",
    sizesAvailable: product.sizes_available || "",
    colorsAvailable: product.colors_available || "",
    stockQuantity: String(product.stock_quantity ?? 0),
    description: product.description || "",
    isAvailable: product.is_available,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError(null);
    try {
      await axios.patch(`${API}/api/ecommerce/products/${product.id}`, {
        name: form.name,
        category: form.category || null,
        price: form.price === "" ? null : parseFloat(String(form.price)),
        salePrice: form.salePrice === "" || form.salePrice === null ? null : parseFloat(String(form.salePrice)),
        sku: form.sku || null,
        sizesAvailable: form.sizesAvailable || null,
        colorsAvailable: form.colorsAvailable || null,
        stockQuantity: parseInt(form.stockQuantity) || 0,
        description: form.description || null,
        isAvailable: form.isAvailable,
      });
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-800">Edit Product</h3>
            <p className="text-[11px] text-slate-400">ID: {product.id.slice(0, 8)}</p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel}>✕</button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5">
          {error && (
            <div className="mb-4 p-3 rounded-xl text-[12px]" style={{ background: "#fef2f2", color: "#b91c1c" }}>
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="form-label">Product Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Category</label>
              <input
                className="form-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Tops, Bottoms..."
              />
            </div>
            <div>
              <label className="form-label">SKU</label>
              <input
                className="form-input"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Price (Rs.)</label>
              <input
                type="number"
                className="form-input"
                value={form.price ?? ""}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Sale Price (Rs.)</label>
              <input
                type="number"
                className="form-input"
                value={form.salePrice ?? ""}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div>
              <label className="form-label">Stock Quantity</label>
              <input
                type="number"
                className="form-input"
                value={form.stockQuantity}
                onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Availability</label>
              <select
                className="form-input"
                value={form.isAvailable ? "yes" : "no"}
                onChange={(e) => setForm({ ...form, isAvailable: e.target.value === "yes" })}
              >
                <option value="yes">In Stock</option>
                <option value="no">Hidden / Out of Stock</option>
              </select>
            </div>
            <div>
              <label className="form-label">Sizes Available</label>
              <input
                className="form-input"
                value={form.sizesAvailable}
                onChange={(e) => setForm({ ...form, sizesAvailable: e.target.value })}
                placeholder="S, M, L, XL"
              />
            </div>
            <div>
              <label className="form-label">Colors Available</label>
              <input
                className="form-input"
                value={form.colorsAvailable}
                onChange={(e) => setForm({ ...form, colorsAvailable: e.target.value })}
                placeholder="Black, White, Navy"
              />
            </div>
          </div>

          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button className="btn-secondary text-[13px]" onClick={onCancel} disabled={saving}>Cancel</button>
          <button className="btn-primary text-[13px]" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

type Product = {
  id: string;
  name: string;
  category: string | null;
  price: string | null;
  sale_price: string | null;
  stock_quantity: number;
  sizes_available: string | null;
  colors_available: string | null;
  description: string | null;
  sku: string | null;
  image_url: string | null;
  is_available: boolean;
};

type ImportedProduct = {
  name: string;
  description?: string | null;
  price?: number | null;
  sale_price?: number | null;
  category?: string | null;
  sizes_available?: string | null;
  colors_available?: string | null;
  stock_quantity?: number | null;
  sku?: string | null;
  image_url?: string | null;
  external_id?: string | null;
  external_source?: string | null;
};

function ImportReviewModal({
  source,
  initialProducts,
  onCancel,
  onConfirm,
}: {
  source: string;
  initialProducts: ImportedProduct[];
  onCancel: () => void;
  onConfirm: (selected: ImportedProduct[]) => void;
}) {
  const [rows, setRows] = useState(
    initialProducts.map((p, i) => ({ ...p, _idx: i, _selected: true }))
  );

  const isAiSource = source === "url" || source === "kb";
  const selectedCount = rows.filter((r) => r._selected).length;

  const updateRow = (idx: number, field: string, value: any) => {
    setRows(rows.map((r) => (r._idx === idx ? { ...r, [field]: value } : r)));
  };
  const toggleRow = (idx: number) => {
    setRows(rows.map((r) => (r._idx === idx ? { ...r, _selected: !r._selected } : r)));
  };
  const deleteRow = (idx: number) => {
    setRows(rows.filter((r) => r._idx !== idx));
  };
  const toggleAll = (checked: boolean) => {
    setRows(rows.map((r) => ({ ...r, _selected: checked })));
  };

  const handleConfirm = () => {
    const selected = rows
      .filter((r) => r._selected)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .map(({ _idx, _selected, ...rest }) => rest);
    onConfirm(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15, 23, 42, 0.5)" }}>
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-[18px] font-bold text-slate-800">Review Import</h3>
            <p className="text-[12px] text-slate-500">
              {rows.length} products found from {source} · {selectedCount} selected
            </p>
          </div>
          <button className="text-slate-400 hover:text-slate-700" onClick={onCancel}>✕</button>
        </div>

        {isAiSource && (
          <div className="mx-6 mt-4 p-3 rounded-xl text-[12px]" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
            ⚠️ These products were extracted by AI. <b>Please review carefully</b> — prices and details may be inaccurate or invented. Uncheck rows you don&apos;t want to import.
          </div>
        )}

        <div className="flex-1 overflow-auto px-6 py-4">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-2 w-8">
                  <input
                    type="checkbox"
                    checked={rows.length > 0 && rows.every((r) => r._selected)}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                </th>
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Category</th>
                <th className="py-2 pr-2">Price</th>
                <th className="py-2 pr-2">Sale</th>
                <th className="py-2 pr-2">Sizes</th>
                <th className="py-2 pr-2">Colors</th>
                <th className="py-2 pr-2">Stock</th>
                <th className="py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const missing = !r.name || r.price == null;
                return (
                  <tr key={r._idx} className={`border-b border-slate-100 ${!r._selected && "opacity-40"}`}>
                    <td className="py-1 pr-2">
                      <input type="checkbox" checked={r._selected} onChange={() => toggleRow(r._idx)} />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className={`form-input !py-1 !text-[12px] ${!r.name && "bg-yellow-50"}`}
                        value={r.name || ""}
                        onChange={(e) => updateRow(r._idx, "name", e.target.value)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="form-input !py-1 !text-[12px]"
                        value={r.category || ""}
                        onChange={(e) => updateRow(r._idx, "category", e.target.value)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        className={`form-input !py-1 !text-[12px] w-24 ${r.price == null && "bg-yellow-50"}`}
                        value={r.price ?? ""}
                        onChange={(e) => updateRow(r._idx, "price", e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        className="form-input !py-1 !text-[12px] w-24"
                        value={r.sale_price ?? ""}
                        onChange={(e) => updateRow(r._idx, "sale_price", e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="form-input !py-1 !text-[12px] w-32"
                        value={r.sizes_available || ""}
                        onChange={(e) => updateRow(r._idx, "sizes_available", e.target.value)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className="form-input !py-1 !text-[12px] w-32"
                        value={r.colors_available || ""}
                        onChange={(e) => updateRow(r._idx, "colors_available", e.target.value)}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        className="form-input !py-1 !text-[12px] w-20"
                        value={r.stock_quantity ?? 0}
                        onChange={(e) => updateRow(r._idx, "stock_quantity", parseInt(e.target.value) || 0)}
                      />
                    </td>
                    <td className="py-1 text-right">
                      <button
                        className="text-red-500 hover:text-red-700 text-[14px]"
                        onClick={() => deleteRow(r._idx)}
                        title={missing ? "Missing fields" : "Delete row"}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Yellow fields are missing data you may want to fill in.</p>
          <div className="flex gap-2">
            <button className="btn-secondary text-[13px]" onClick={onCancel}>Cancel</button>
            <button
              className="btn-primary text-[13px]"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
            >
              Import {selectedCount} product{selectedCount !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Size Charts Panel ────────────────────────────────────────────────────────
function SizeChartsPanel({ botId }: { botId: string }) {
  const { tenantId } = useAuth();
  type Chart = { id: string; category: string; unit: string; chart_data: any };
  const [charts, setCharts] = useState<Chart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("Tops");
  const [unit, setUnit] = useState("cm");
  const [chartJson, setChartJson] = useState(`{
  "S":  {"chest": "81-86", "waist": "66-71"},
  "M":  {"chest": "86-91", "waist": "71-76"},
  "L":  {"chest": "91-96", "waist": "76-81"},
  "XL": {"chest": "96-101","waist": "81-86"}
}`);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/api/ecommerce/sizecharts?botId=${botId}`);
      setCharts(r.data.sizeCharts || []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [botId]);

  useEffect(() => { load(); }, [load]);

  const addChart = async () => {
    let parsed: any;
    try { parsed = JSON.parse(chartJson); }
    catch { setToast({ message: "Invalid JSON in size chart", type: "error" }); return; }

    try {
      await axios.post(`${API}/api/ecommerce/sizecharts`, {
        botId, tenantId, category, chartData: parsed, unit,
      });
      setShowForm(false);
      setToast({ message: "Size chart added", type: "success" });
      load();
    } catch {
      setToast({ message: "Failed to add size chart", type: "error" });
    }
  };

  const deleteChart = async (id: string) => {
    if (!confirm("Delete this size chart?")) return;
    try {
      await axios.delete(`${API}/api/ecommerce/sizecharts/${id}`);
      setToast({ message: "Size chart deleted", type: "success" });
      load();
    } catch {
      setToast({ message: "Failed to delete", type: "error" });
    }
  };

  return (
    <div className="card mb-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-slate-800">Size Charts ({charts.length})</h2>
        <button className="btn-secondary text-[12px]" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Size Chart"}
        </button>
      </div>

      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-slate-200 bg-slate-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label">Category</label>
              <input className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Tops, Men Shirts, Women Bottoms..." />
            </div>
            <div>
              <label className="form-label">Unit</label>
              <select className="form-input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="cm">Centimeters (cm)</option>
                <option value="inches">Inches</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label">Size Data (JSON)</label>
            <textarea
              className="form-input font-mono text-[11px]"
              rows={9}
              value={chartJson}
              onChange={(e) => setChartJson(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">Measurements in {unit}. Example keys: chest, waist, hips, shoulder.</p>
          </div>
          <button className="btn-primary text-[13px]" onClick={addChart}>Save Size Chart</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-[13px]">Loading size charts...</div>
      ) : charts.length === 0 ? (
        <div className="text-center py-6 text-slate-400 text-[13px]">No size charts yet. Add one so the bot can recommend sizes.</div>
      ) : (
        <div className="space-y-3">
          {charts.map((c) => (
            <div key={c.id} className="p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[14px] font-semibold text-slate-800">{c.category}</span>
                  <span className="ml-2 text-[11px] text-slate-400">({c.unit})</span>
                </div>
                <button className="text-red-500 hover:text-red-700 text-[11px]" onClick={() => deleteChart(c.id)}>Delete</button>
              </div>
              <pre className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded overflow-x-auto">{JSON.stringify(c.chart_data, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
