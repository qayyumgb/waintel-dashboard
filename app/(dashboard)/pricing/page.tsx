"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Toast from "@/components/Toast";
import { useAuth } from "@/lib/useAuth";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Plan {
  name: string;
  tier: number;
  price: string;
  features: string[];
  featured?: boolean;
  badge?: string;
  cta: string;
}

const plans: Plan[] = [
  {
    name: "Starter",
    tier: 1,
    price: "$29",
    features: [
      "1 WhatsApp number",
      "500 AI conversations/month",
      "1 knowledge file",
      "Voice note support",
      "Email support",
    ],
    cta: "Get Started",
  },
  {
    name: "Business",
    tier: 2,
    price: "$79",
    features: [
      "3 WhatsApp numbers",
      "5,000 conversations/month",
      "Unlimited knowledge files",
      "Voice note support",
      "Human handoff",
      "Live inbox",
      "Priority support",
    ],
    featured: true,
    badge: "Most Popular",
    cta: "Get Started",
  },
  {
    name: "Agency",
    tier: 3,
    price: "$199",
    features: [
      "Unlimited numbers",
      "Unlimited conversations",
      "🏢 White-label branding (your logo, colors, domain)",
      "👥 Resell to your own clients",
      "💰 Set your own client pricing & keep the margin",
      "📊 Multi-client dashboard & revenue tracking",
      "API access",
      "Dedicated support",
    ],
    cta: "Upgrade to Agency",
  },
];

export default function PricingPage() {
  const { tenantId: TENANT_ID } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [hasStripeCustomer, setHasStripeCustomer] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Fetch live plan from backend (session value may be stale).
  // Uses functional setState so a transient fetch failure doesn't clear the
  // previous value, which caused the "Current Plan" highlight to flicker.
  const fetchCurrentPlan = async () => {
    if (!TENANT_ID) return null;
    try {
      const { data } = await axios.get(`${API}/api/billing/status/${TENANT_ID}`);
      if (data.plan) setCurrentPlan(data.plan);
      setHasStripeCustomer(!!data.stripe_customer_id);
      return data.plan;
    } catch { return null; }
  };

  // Self-heal: on mount, reconcile DB plan with actual Stripe subscription state.
  // Fixes the "DB says starter but Stripe says agency" drift from past webhook misses.
  const syncFromStripe = async () => {
    if (!TENANT_ID) return;
    try {
      const { data } = await axios.post(`${API}/api/billing/sync`, { tenantId: TENANT_ID });
      if (data.plan) setCurrentPlan(data.plan);
      if (data.synced) {
        window.dispatchEvent(new CustomEvent("agencyProfileChanged"));
      }
    } catch { /* silent — non-critical */ }
  };

  useEffect(() => {
    if (!TENANT_ID) return;
    // Show cached plan first for instant UI, then sync from Stripe in background
    fetchCurrentPlan().then(() => syncFromStripe());
  }, [TENANT_ID]);

  // Auto-detect ?success=true from Stripe redirect → poll until plan updates → refresh sidebar
  useEffect(() => {
    if (!TENANT_ID) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") !== "true") return;

    // Clean the URL so a browser back/forward doesn't re-trigger this
    window.history.replaceState({}, "", window.location.pathname);

    setUpgrading(true);
    setToast({ message: "Payment received — activating your plan...", type: "success" });

    let attempts = 0;
    const startingPlan = currentPlan;
    const interval = setInterval(async () => {
      attempts++;
      const plan = await fetchCurrentPlan();
      if ((plan && plan !== startingPlan) || attempts >= 20) {
        clearInterval(interval);
        setUpgrading(false);
        if (plan && plan !== startingPlan) {
          setToast({
            message: `Upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!`,
            type: "success",
          });
          window.dispatchEvent(new CustomEvent("agencyProfileChanged"));
        } else {
          setToast({
            message: "Payment succeeded but plan update is delayed. Refresh in a moment.",
            type: "error",
          });
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [TENANT_ID]);

  const openBillingPortal = async () => {
    if (!TENANT_ID) return;
    setOpeningPortal(true);
    try {
      const { data } = await axios.get(`${API}/api/billing/portal?tenantId=${TENANT_ID}`);
      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        setToast({ message: "Could not open billing portal", type: "error" });
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Portal failed to open";
      setToast({ message: msg || "Portal failed to open", type: "error" });
    } finally { setOpeningPortal(false); }
  };

  const handleCheckout = async (planName: string) => {
    if (!TENANT_ID) {
      setToast({ message: "Please log in first", type: "error" });
      return;
    }

    setLoading(planName);
    try {
      const res = await axios.post(`${API}/api/billing/create-checkout`, {
        tenantId: TENANT_ID,
        plan: planName.toLowerCase(),
        successUrl: `${window.location.origin}/pricing?success=true`,
        cancelUrl: `${window.location.origin}/pricing`,
      });

      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
      } else {
        setToast({ message: "Stripe not configured yet. Add STRIPE_SECRET_KEY to backend .env", type: "error" });
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Checkout failed";
      setToast({ message: msg || "Checkout failed", type: "error" });
    } finally {
      setLoading(null);
    }
  };

  const currentTier = plans.find((p) => p.name.toLowerCase() === currentPlan)?.tier || 0;

  return (
    <div className="p-3 md:p-8 animate-fade-in">
      <div className="mb-8 text-center">
        <div className="page-breadcrumb mx-auto">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Billing
        </div>
        <h1 className="text-[32px] font-bold text-slate-900 mb-3">Choose Your Plan</h1>
        <p className="text-[16px] text-slate-500 max-w-lg mx-auto">
          {currentPlan === "trial"
            ? <>You're on the <b>Free Trial</b>. Upgrade anytime to keep your bot running after the trial ends.</>
            : currentPlan
              ? <>You're currently on the <b>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</b> plan. Upgrade anytime — no hidden fees.</>
              : <>Start with a free trial. Upgrade anytime. No hidden fees.</>}
        </p>
        {upgrading && (
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[13px]">
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Activating your plan...
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrent = plan.name.toLowerCase() === currentPlan;
          const isDowngrade = currentTier > 0 && plan.tier < currentTier;
          const isUpgrade = currentTier > 0 && plan.tier > currentTier;

          const ctaText = isCurrent
            ? "✓ Your Current Plan"
            : isDowngrade
              ? `Downgrade to ${plan.name}`
              : isUpgrade
                ? `Upgrade to ${plan.name}`
                : plan.cta;

          return (
            <div
              key={plan.name}
              className="card relative flex flex-col"
              style={{
                borderColor: isCurrent ? "#1D9E75" : plan.featured ? "#1D9E75" : "#e2e8f0",
                borderWidth: (isCurrent || plan.featured) ? "2px" : "1px",
                background: isCurrent ? "linear-gradient(180deg, #ecfdf5 0%, #ffffff 40%)" : undefined,
              }}
            >
              {isCurrent ? (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}
                >
                  ✓ Current Plan
                </div>
              ) : plan.badge ? (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}
                >
                  {plan.badge}
                </div>
              ) : null}

              <div className="mb-6">
                <h3 className="text-[18px] font-bold text-slate-800 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-[36px] font-bold text-slate-900">{plan.price}</span>
                  <span className="text-[14px] text-slate-400">/month</span>
                </div>
              </div>

              <ul className="flex-1 space-y-3 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] text-slate-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth={2.5} className="shrink-0 mt-0.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                className={`w-full justify-center !py-3 ${
                  isCurrent
                    ? "btn-secondary !cursor-default !text-emerald-700 !bg-emerald-50 !border-emerald-300"
                    : plan.featured || isUpgrade
                      ? "btn-primary"
                      : "btn-secondary"
                }`}
                onClick={() => !isCurrent && handleCheckout(plan.name)}
                disabled={loading === plan.name || isCurrent}
              >
                {loading === plan.name ? "Redirecting..." : ctaText}
              </button>
            </div>
          );
        })}
      </div>

      {hasStripeCustomer && (
        <div className="max-w-5xl mx-auto mt-10 card text-center">
          <h3 className="text-[16px] font-bold text-slate-800 mb-1">Manage your subscription</h3>
          <p className="text-[13px] text-slate-500 mb-4">
            Cancel, change plans, update payment method, or download invoices — all from Stripe's secure billing portal.
          </p>
          <button
            className="btn-secondary text-[13px]"
            onClick={openBillingPortal}
            disabled={openingPortal}
          >
            {openingPortal ? "Opening..." : "Manage Subscription →"}
          </button>
          <div className="text-[11px] text-slate-400 mt-3">
            Cancellations take effect at the end of your current billing period. No refunds for partial months.
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
