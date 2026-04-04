"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Source {
  filename: string;
  chunkCount: number;
  addedAt: string;
}

interface Chunk {
  id: string;
  content: string;
  chunk_index: number;
  created_at: string;
}

export default function KnowledgePage() {
  const { botId } = useAuth();
  const BOT_ID = botId || "";
  const [sources, setSources] = useState<Source[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [previewSource, setPreviewSource] = useState<string | null>(null);
  const [previewChunks, setPreviewChunks] = useState<Chunk[]>([]);
  const [uploading, setUploading] = useState(false);
  const [textContent, setTextContent] = useState("");
  const [textName, setTextName] = useState("");
  const [url, setUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPreview = async (filename: string) => {
    setPreviewSource(filename);
    try {
      const res = await axios.get(`${API}/api/knowledge/${BOT_ID}/chunks?source=${encodeURIComponent(filename)}`);
      setPreviewChunks(res.data.chunks || []);
    } catch {
      setPreviewChunks([]);
    }
  };

  const fetchStatus = useCallback(async () => {
    if (!BOT_ID) return;
    try {
      const res = await axios.get(`${API}/api/knowledge/${BOT_ID}/status`);
      setSources(res.data.sources || []);
      setTotalChunks(res.data.totalChunks || 0);
    } catch {
      console.error("Failed to load knowledge status");
    } finally {
      setLoading(false);
    }
  }, [BOT_ID]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("botId", BOT_ID);
      formData.append("file", file);
      const res = await axios.post(`${API}/api/knowledge/upload`, formData);
      setToast({ message: `Uploaded ${res.data.filename} (${res.data.chunksCreated} chunks)`, type: "success" });
      fetchStatus();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Upload failed";
      setToast({ message: msg || "Upload failed", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textContent.trim()) return;
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/knowledge/text`, {
        botId: BOT_ID,
        content: textContent,
        sourceName: textName || "manual-input",
      });
      setToast({ message: `Added ${res.data.chunksCreated} chunks`, type: "success" });
      setTextContent("");
      setTextName("");
      fetchStatus();
    } catch {
      setToast({ message: "Failed to add text", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) return;
    setUploading(true);
    try {
      const res = await axios.post(`${API}/api/knowledge/url`, {
        botId: BOT_ID,
        url,
        sourceName: url,
      });
      setToast({ message: `Scraped URL (${res.data.chunksCreated} chunks)`, type: "success" });
      setUrl("");
      fetchStatus();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Failed to scrape URL";
      setToast({ message: msg || "Failed to scrape URL", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("Delete all knowledge base data? This cannot be undone.")) return;
    try {
      await axios.delete(`${API}/api/knowledge/${BOT_ID}`);
      setToast({ message: "Knowledge base cleared", type: "success" });
      fetchStatus();
    } catch {
      setToast({ message: "Failed to clear knowledge base", type: "error" });
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8">
        <div className="page-breadcrumb">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" />
          </svg>
          Knowledge Base
        </div>
        <h1 className="text-[28px] font-bold text-slate-900 mb-2">Knowledge Base Manager</h1>
        <p className="text-[16px] text-slate-500 max-w-xl">
          Upload your business documents, product info, and FAQs. Your AI agent uses this to answer customer questions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Upload */}
        <div className="space-y-5">
          {/* File upload */}
          <div className="card">
            <h3 className="text-[15px] font-bold text-slate-800 mb-4">Upload File</h3>
            <div
              className="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
              style={{
                borderColor: dragOver ? "#1D9E75" : "#e2e8f0",
                background: dragOver ? "rgba(29,158,117,0.04)" : "#fafbfc",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(29,158,117,0.08)" }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-slate-600 mb-1">
                {uploading ? "Uploading..." : "Drop files here or click to browse"}
              </p>
              <p className="text-[12px] text-slate-400">PDF, DOCX, or TXT (max 10MB)</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }} />
          </div>

          {/* Text input */}
          <div className="card">
            <h3 className="text-[15px] font-bold text-slate-800 mb-4">Paste Text</h3>
            <input className="form-input mb-3" value={textName} onChange={(e) => setTextName(e.target.value)} placeholder="Source name (e.g. menu-info)" />
            <textarea className="form-input mb-3" rows={4} value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Paste your business info, FAQ, product details..." />
            <button className="btn-primary w-full justify-center" onClick={handleTextSubmit} disabled={uploading || !textContent.trim()}>
              Add to Knowledge Base
            </button>
          </div>

          {/* URL scrape */}
          <div className="card">
            <h3 className="text-[15px] font-bold text-slate-800 mb-4">Scrape URL</h3>
            <div className="flex gap-3">
              <input className="form-input flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://yourbusiness.com/about" />
              <button className="btn-primary shrink-0" onClick={handleUrlSubmit} disabled={uploading || !url.trim()}>
                Scrape
              </button>
            </div>
          </div>
        </div>

        {/* Right — Current knowledge */}
        <div>
          <div className="card">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800">Current Knowledge Base</h3>
                <p className="text-[13px] text-slate-400 mt-1">{totalChunks} total chunks</p>
              </div>
              {sources.length > 0 && (
                <button className="btn-danger text-[12px] !py-1.5 !px-3" onClick={clearAll}>Clear All</button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-12 text-slate-400">Loading...</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(29,158,117,0.08)" }}>
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-[14px] text-slate-500 mb-1 font-medium">No knowledge uploaded yet</p>
                <p className="text-[12px] text-slate-400">Upload files or paste text to train your AI agent</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => (
                  <button
                    key={source.filename}
                    onClick={() => openPreview(source.filename)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left"
                    style={{ background: previewSource === source.filename ? "#f0fdf4" : "transparent" }}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(29,158,117,0.08)" }}>
                      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-slate-700 truncate">{source.filename}</div>
                      <div className="text-[11px] text-slate-400">
                        {source.chunkCount} chunks &middot; {new Date(source.addedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold" style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}>
                      {source.chunkCount}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Chunk Preview Panel */}
            {previewSource && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-bold text-slate-700">Preview: {previewSource}</h4>
                  <button onClick={() => setPreviewSource(null)} className="text-[12px] text-slate-400 hover:text-slate-600">&times; Close</button>
                </div>
                {previewChunks.length === 0 ? (
                  <div className="text-[12px] text-slate-400 py-4 text-center">No chunks found</div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {previewChunks.map((chunk) => (
                      <div key={chunk.id} className="p-3 rounded-lg text-[12px] text-slate-600 leading-relaxed" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Chunk {chunk.chunk_index + 1}</div>
                        {chunk.content.substring(0, 300)}{chunk.content.length > 300 ? "..." : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
