"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  WhiteLabelConfig,
  DEFAULT_CONFIG,
  detectAgencySlug,
  applyWhiteLabel,
} from "@/lib/whitelabel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const WhiteLabelContext = createContext<WhiteLabelConfig>(DEFAULT_CONFIG);

export function WhiteLabelProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<WhiteLabelConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const slug = detectAgencySlug();
    if (!slug || slug === "waintel") return;

    fetch(`${API}/api/agency/whitelabel/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.config) {
          const merged = { ...DEFAULT_CONFIG, ...data.config };
          setConfig(merged);
          applyWhiteLabel(merged);
        }
      })
      .catch(() => { /* fall back to default */ });
  }, []);

  return <WhiteLabelContext.Provider value={config}>{children}</WhiteLabelContext.Provider>;
}

export const useWhiteLabel = () => useContext(WhiteLabelContext);
