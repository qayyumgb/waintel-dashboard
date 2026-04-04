"use client";

import { useState } from "react";
import axios from "axios";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const TENANT_ID = "2556563a-748a-401c-8985-88676f18b694";

const plans = [
  {
    name: "Starter",
    price: "$29",
    priceEnv: "STRIPE_STARTER_PRICE_ID",
    features: [
      "1 WhatsApp number",
      "500 AI conversations/month",
      "1 knowledge file",
      "Voice note support",
      "Email support",
    ],
    featured: false,
    cta: "Get Started",
  },
  {
    name: "Business",
    price: "$79",
    priceEnv: "STRIPE_BUSINESS_PRICE_ID",
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
    cta: "Get Started",
    badge: "Most Popular",
  },
  {
    name: "Agency",
    price: "$199",
    priceEnv: "STRIPE_AGENCY_PRICE_ID",
    features: [
      "Unlimited numbers",
      "Unlimited conversations",
      "White-label branding",
      "Client sub-accounts",
      "API access",
      "Dedicated support",
    ],
    featured: false,
    cta: "Contact Sales",
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const handleCheckout = async (planName: string) => {
    if (planName === "Agency") {
      setToast({ message: "Contact sales at hello@waintel.ai for Agency plan", type: "success" });
      return;
    }

    setLoading(planName);
    try {
      const res = await axios.post(`${API}/api/billing/create-checkout`, {
        tenantId: TENANT_ID,
        priceId: planName === "Starter" ? process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE || "" : process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE || "",
        successUrl: `${window.location.origin}?success=true`,
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

  return (
    <div className="p-8 animate-fade-in">
      <div className="mb-8 text-center">
        <div className="page-breadcrumb mx-auto">
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          Billing
        </div>
        <h1 className="text-[32px] font-bold text-slate-900 mb-3">Choose Your Plan</h1>
        <p className="text-[16px] text-slate-500 max-w-lg mx-auto">
          Start with a free trial. Upgrade anytime. No hidden fees.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className="card relative flex flex-col"
            style={{
              borderColor: plan.featured ? "#1D9E75" : "#e2e8f0",
              borderWidth: plan.featured ? "2px" : "1px",
            }}
          >
            {plan.badge && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}
              >
                {plan.badge}
              </div>
            )}

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
              className={plan.featured ? "btn-primary w-full justify-center !py-3" : "btn-secondary w-full justify-center !py-3"}
              onClick={() => handleCheckout(plan.name)}
              disabled={loading === plan.name}
            >
              {loading === plan.name ? "Redirecting..." : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
