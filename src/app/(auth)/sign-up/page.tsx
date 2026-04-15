"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createBrowserClient } from "@supabase/ssr";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      setMessage("Check your email for a confirmation link to complete sign up.");
    }

    setLoading(false);
  }

  return (
    <div className="bg-surface-dark2 rounded-panel border border-white/[0.06] p-6">
      <h2 className="text-[15px] font-semibold text-white mb-5">Create your account</h2>
      <form onSubmit={handleSignUp} className="space-y-4">
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 8 characters"
            className="w-full bg-surface-dark3 border border-white/[0.08] rounded-btn px-3 py-2 text-[13px] text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-blue"
          />
        </div>
        {error && (
          <p className="text-[12px] text-red-400 bg-red-400/10 rounded px-3 py-2">{error}</p>
        )}
        {message && (
          <p className="text-[12px] text-green-400 bg-green-400/10 rounded px-3 py-2">{message}</p>
        )}
        <Button variant="primary" size="lg" className="w-full" disabled={loading}>
          {loading ? "Creating account…" : "Create Account"}
        </Button>
      </form>

      <p className="text-center text-[12px] text-slate-500 mt-4">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-brand-blue hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
