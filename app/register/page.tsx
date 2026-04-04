"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Business name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/register`, { name, email, password });

      if (res.data.success) {
        // Auto sign in after registration
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.ok) {
          window.location.href = "/onboarding";
        } else {
          window.location.href = "/login";
        }
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : "Registration failed";
      setError(msg || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white"
            style={{ background: "linear-gradient(135deg, #1D9E75, #0F6E56)" }}
          >
            W
          </div>
          <h1 className="text-[24px] font-bold text-slate-900">Create your account</h1>
          <p className="text-[14px] text-slate-500 mt-1">Start your WhatsApp AI agent in minutes</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg text-[13px] font-medium" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
                {error}
              </div>
            )}

            <div>
              <label className="form-label">Business Name</label>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Al-Noor Restaurant"
              />
            </div>

            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="btn-primary w-full justify-center !py-3" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-[13px] text-slate-500 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold" style={{ color: "#1D9E75" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
