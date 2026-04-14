"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Tab = "email" | "magic";

export default function SignInPage() {
  const [tab, setTab] = useState<Tab>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    await new Promise((r) => setTimeout(r, 800));
    setMessage("Sign in stubbed — Supabase not yet configured.");
    setLoading(false);
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    await new Promise((r) => setTimeout(r, 800));
    setMessage("Magic link stubbed — check your email once Supabase is configured.");
    setLoading(false);
  }

  return (
    <div className="bg-surface-dark2 rounded-panel border border-white/[0.06] p-6">
      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-surface-dark3/50 rounded-btn p-0.5">
        {(["email", "magic"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setMessage(""); }}
            className={`flex-1 text-[12px] font-semibold py-1.5 rounded transition-all ${
              tab === t
                ? "bg-brand-blue text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t === "email" ? "Email & Password" : "Magic Link"}
          </button>
        ))}
      </div>

      {tab === "email" ? (
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="w-full bg-surface-dark3 border border-white/[0.08] rounded-btn px-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-surface-dark3 border border-white/[0.08] rounded-btn px-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>
          {message && (
            <p className="text-[12px] text-slate-400 bg-surface-dark3 rounded px-3 py-2">{message}</p>
          )}
          <Button variant="primary" size="lg" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              className="w-full bg-surface-dark3 border border-white/[0.08] rounded-btn px-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
            />
          </div>
          {message && (
            <p className="text-[12px] text-slate-400 bg-surface-dark3 rounded px-3 py-2">{message}</p>
          )}
          <Button variant="primary" size="lg" className="w-full" disabled={loading}>
            {loading ? "Sending…" : "Send Magic Link"}
          </Button>
        </form>
      )}

      <p className="text-center text-[12px] text-slate-500 mt-4">
        No account?{" "}
        <Link href="/sign-up" className="text-brand-blue hover:underline font-medium">
          Sign up
        </Link>
      </p>
    </div>
  );
}
