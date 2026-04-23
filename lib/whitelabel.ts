export interface WhiteLabelConfig {
  agencyId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  dashboardTitle: string;
  supportEmail: string | null;
  supportPhone: string | null;
  hideWaintelBranding: boolean;
  customCss: string;
}

export const DEFAULT_CONFIG: WhiteLabelConfig = {
  agencyId: "",
  name: "Waintel.ai",
  slug: "waintel",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#1D9E75",
  secondaryColor: "#0F6E56",
  dashboardTitle: "Waintel.ai — WhatsApp AI Agent",
  supportEmail: "support@waintel.ai",
  supportPhone: null,
  hideWaintelBranding: false,
  customCss: "",
};

// Detect agency slug from URL or subdomain
// Order: ?agency=xxx (testing) → custom subdomain → null (default Waintel)
export function detectAgencySlug(): string | null {
  if (typeof window === "undefined") return null;

  const urlParams = new URLSearchParams(window.location.search);
  const paramSlug = urlParams.get("agency");
  if (paramSlug) {
    sessionStorage.setItem("agencySlug", paramSlug);
    return paramSlug;
  }

  const stored = sessionStorage.getItem("agencySlug");
  if (stored) return stored;

  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  // matches: <slug>.waintel.ai
  if (parts.length >= 3 && parts[parts.length - 2] === "waintel" && parts[parts.length - 1] === "ai") {
    if (parts[0] !== "www" && parts[0] !== "dashboard") return parts[0];
  }
  return null;
}

export function clearAgencySlug() {
  if (typeof window !== "undefined") sessionStorage.removeItem("agencySlug");
}

export function applyWhiteLabel(config: WhiteLabelConfig): void {
  if (typeof document === "undefined") return;

  document.documentElement.style.setProperty("--wl-primary", config.primaryColor);
  document.documentElement.style.setProperty("--wl-secondary", config.secondaryColor);

  document.title = config.dashboardTitle;

  if (config.faviconUrl) {
    let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = config.faviconUrl;
  }

  if (config.customCss) {
    let style = document.getElementById("wl-custom-css") as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = "wl-custom-css";
      document.head.appendChild(style);
    }
    style.textContent = config.customCss;
  }
}
