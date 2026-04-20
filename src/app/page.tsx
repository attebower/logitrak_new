"use client";

import { useState } from "react";
import Link from "next/link";
import {
  QrCode,
  MapPin,
  FileWarning,
  BarChart3,
  Camera,
  Users,
  Check,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: QrCode,
    title: "Scan in under 10 seconds",
    description:
      "Check out 50 items in under 5 minutes. Batch scan an entire truck before the morning call. Audio confirmation on every scan — no second-guessing.",
    color: "text-brand-blue",
    bg: "bg-brand-blue/10",
  },
  {
    icon: MapPin,
    title: "Know exactly where it is",
    description:
      "Studio → Stage → Set → Position. Every item tracked to exactly where it was left. No more radio calls asking which stage the Technocrane is on.",
    color: "text-status-teal",
    bg: "bg-status-teal/10",
  },
  {
    icon: FileWarning,
    title: "Full damage history",
    description:
      "Every scratch, every repair, every production — logged and searchable. Know exactly what happened to item #00432 three shoots ago, without digging through a spreadsheet.",
    color: "text-status-amber",
    bg: "bg-status-amber/10",
  },
  {
    icon: BarChart3,
    title: "Wrap-day reports in one tap",
    description:
      "Close production day in two minutes — not an afternoon. Available, checked out, damaged, by location. Export to CSV or PDF for your production coordinator. Done.",
    color: "text-status-green",
    bg: "bg-status-green/10",
  },
  {
    icon: Camera,
    title: "Set Snapshots",
    description:
      "Freeze the exact state of a set at any moment. Come back to it months later. Invaluable for continuity and reconciliation.",
    color: "text-brand-blue",
    bg: "bg-brand-blue/10",
  },
  {
    icon: Users,
    title: "Every crew member, the right access",
    description:
      "Five role levels from Owner to Read-Only. Your HOD has full control. Your dailies see only what they need — and can't accidentally delete anything.",
    color: "text-status-teal",
    bg: "bg-status-teal/10",
  },
];

const steps = [
  {
    number: "01",
    title: "Register your kit",
    description:
      "Import via CSV or add items one by one. Print QR labels. Done in an afternoon.",
  },
  {
    number: "02",
    title: "Scan in, scan out",
    description:
      "Open LogiTrak, point camera at the QR code, confirm location. Under 10 seconds per item.",
  },
  {
    number: "03",
    title: "Know everything",
    description:
      "Real-time dashboard. Live location for every item. Damage reports. Activity history. Reports at a click.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "£29",
    description: "For single departments on smaller productions",
    badge: null,
    highlighted: false,
    cta: "Start Free Trial",
    ctaHref: "/sign-up",
    features: [
      "5 users",
      "500 assets",
      "QR check in/out",
      "Damage tracking",
      "Standard reports",
    ],
  },
  {
    name: "Professional",
    price: "£89",
    description: "For HODs running multiple stages and larger kits",
    badge: "Most Popular",
    highlighted: true,
    cta: "Start Free Trial",
    ctaHref: "/sign-up",
    features: [
      "20 users",
      "10,000 assets",
      "Everything in Starter",
      "CSV/PDF export",
      "QR label printing",
      "Advanced analytics",
    ],
  },
  {
    name: "Enterprise",
    price: "£249",
    description: "For large studios and touring productions",
    badge: null,
    highlighted: false,
    cta: "Talk to Sales",
    ctaHref: "/contact",
    features: [
      "Unlimited users & assets",
      "Everything in Pro",
      "Full audit log",
      "REST API",
      "Priority support",
      "Custom onboarding",
    ],
  },
];


// ─── Hero Dashboard Mockup ────────────────────────────────────────────────────

function DashboardMockup() {
  const stats = [
    { label: "Total Assets", value: "847", valueColor: "text-white" },
    { label: "Available", value: "412", valueColor: "text-[#16A34A]" },
    { label: "Checked Out", value: "414", valueColor: "text-[#1B4FD8]" },
    { label: "Damaged", value: "21", valueColor: "text-[#DC2626]" },
  ];

  const activity = [
    {
      dot: "bg-[#1B4FD8]",
      text: "ARRI Alexa LF #003 checked out → Stage 4",
      time: "2m ago",
    },
    {
      dot: "bg-[#16A34A]",
      text: "50mm Zeiss Prime #012 returned to store",
      time: "11m ago",
    },
    {
      dot: "bg-[#DC2626]",
      text: "Matthews C-Stand #041 — damage report filed",
      time: "34m ago",
    },
  ];

  return (
    <div
      className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-[14px]"
      style={{
        boxShadow:
          "0 32px 80px rgba(0,0,0,0.7), 0 0 80px rgba(27,79,216,0.15), 0 0 0 1px rgba(255,255,255,0.07)",
      }}
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#1E293B] px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[#DC2626]/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#D97706]/50" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#16A34A]/50" />
        <div className="ml-3 flex-1 rounded bg-[#0F172A]/80 px-3 py-1 text-left text-[11px] text-white/20">
          app.logitrak.io/dashboard
        </div>
      </div>

      {/* App shell */}
      <div className="bg-[#0F172A]">
        {/* App topbar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-[#1E293B] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold tracking-tight text-white">
              Logi
            </span>
            <span className="-ml-2.5 text-sm font-extrabold tracking-tight text-[#1B4FD8]">
              Trak
            </span>
            <span className="ml-1 text-xs text-white/25">/ Dashboard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" />
            <span className="text-[11px] text-white/30">
              Spring Shoots 2026
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Section label */}
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-white/25">
            Overview
          </p>

          {/* Stat cards 4-up */}
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-[10px] border border-white/[0.06] bg-[#1E293B] p-3"
              >
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/35">
                  {s.label}
                </p>
                <p className={`text-2xl font-extrabold leading-none ${s.valueColor}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          <div className="rounded-[10px] border border-white/[0.06] bg-[#1E293B] p-4">
            <p className="mb-3 text-[9px] font-bold uppercase tracking-widest text-white/25">
              Recent Activity
            </p>
            <div className="space-y-2.5">
              {activity.map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${item.dot}`}
                  />
                  <span className="flex-1 truncate text-[11px] text-white/45">
                    {item.text}
                  </span>
                  <span className="flex-shrink-0 text-[10px] text-white/20">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-[#0F172A] text-white antialiased"
      style={{ scrollBehavior: "smooth" }}
    >
      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 z-50 w-full border-b border-white/[0.06] backdrop-blur-xl"
        style={{ backgroundColor: "rgba(15,23,42,0.85)" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl font-extrabold tracking-tight text-white">
              Logi
            </span>
            <span className="text-xl font-extrabold tracking-tight text-[#1B4FD8]">
              Trak
            </span>
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Pricing
            </a>
            <Link
              href="/sign-in"
              className="text-sm text-white/50 transition-colors hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="rounded-[7px] bg-[#1B4FD8] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1741B3]"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="flex items-center md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5 text-white/60" />
            ) : (
              <Menu className="h-5 w-5 text-white/60" />
            )}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="border-t border-white/[0.06] px-6 py-5 md:hidden">
            <div className="flex flex-col gap-5">
              <a
                href="#features"
                className="text-sm text-white/60"
                onClick={() => setMobileOpen(false)}
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-sm text-white/60"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </a>
              <Link href="/sign-in" className="text-sm text-white/60">
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="rounded-[7px] bg-[#1B4FD8] py-2.5 text-center text-sm font-semibold text-white"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-32 text-center"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(27,79,216,0.28) 0%, transparent 65%)",
        }}
      >
        {/* Subtle dot grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Glow orb behind mockup */}
        <div
          className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2"
          style={{
            width: "640px",
            height: "320px",
            background:
              "radial-gradient(ellipse at center, rgba(27,79,216,0.18) 0%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />

        <div className="relative z-10 mx-auto w-full max-w-4xl">
          {/* Eyebrow badge */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#1B4FD8]/25 bg-[#1B4FD8]/10 px-4 py-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-[#1B4FD8]" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1B4FD8]">
              Film & TV Equipment Tracking
            </span>
          </div>

          {/* Headline */}
          <h1 className="mb-6 text-5xl font-extrabold leading-[1.06] tracking-[-0.04em] text-white sm:text-6xl lg:text-[5rem]">
            Know where every
            <br />
            <span
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #4B7BF5 0%, #1B4FD8 50%, #0D9488 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              piece of kit
            </span>{" "}
            is.
            <br />
            Always.
          </h1>

          {/* Subheadline */}
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/50 sm:text-xl">
            Purpose-built for Gaffers, Prop Masters, and Camera HODs. Scan kit
            out in seconds, know exactly where it is, and close production day{" "}
            <span className="text-white/75">
              without a spreadsheet — or a single radio call.
            </span>
          </p>

          {/* CTAs */}
          <div className="mb-5 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/sign-up"
              className="group flex items-center gap-2 rounded-[7px] bg-[#1B4FD8] px-7 py-3.5 text-[15px] font-bold text-white shadow-[0_0_0_1px_rgba(27,79,216,0.3)] transition-all hover:bg-[#1741B3] hover:shadow-[0_0_35px_rgba(27,79,216,0.45)]"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 rounded-[7px] border border-white/[0.10] px-7 py-3.5 text-[15px] font-semibold text-white/65 transition-all hover:border-white/20 hover:text-white"
            >
              See how it works
            </a>
          </div>

          {/* Trust line */}
          <p className="mb-16 text-[13px] text-white/25">
            7-day free trial · No credit card required · Set up in under 10
            minutes
          </p>

          {/* Dashboard mockup */}
          <DashboardMockup />
        </div>
      </section>

      {/* ── SOCIAL PROOF ─────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.05] py-12">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-[13px] text-white/30">
            Built for the people who run UK productions —{" "}
            <span className="text-white/50">
              lighting, camera, props, and grip departments.
            </span>
          </p>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" className="px-6 py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#1B4FD8]">
              Features
            </p>
            <h2 className="text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-5xl">
              What&apos;s in LogiTrak
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-[14px] border border-white/[0.06] bg-[#1E293B] p-6 transition-all duration-200 hover:border-white/[0.11] hover:bg-[#1E293B]/70"
                >
                  <div
                    className={`mb-5 inline-flex rounded-[10px] p-2.5 ${f.bg}`}
                  >
                    <Icon className={`h-5 w-5 ${f.color}`} />
                  </div>
                  <h3 className="mb-2 text-[15px] font-bold text-white">
                    {f.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-white/45">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-white/[0.05] px-6 py-28">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(13,148,136,0.06) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#0D9488]">
              How it works
            </p>
            <h2 className="text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-5xl">
              Up and running in an afternoon.
            </h2>
          </div>

          <div className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {/* Connector */}
            <div
              className="absolute left-16 right-16 top-8 hidden border-t border-dashed border-white/[0.07] md:block"
              aria-hidden
            />

            {steps.map((step) => (
              <div key={step.number} className="relative flex flex-col">
                {/* Number circle */}
                <div className="relative z-10 mb-7 flex h-16 w-16 items-center justify-center rounded-full border border-[#1B4FD8]/20 bg-[#1E293B]">
                  <span className="text-xl font-extrabold tracking-tight text-[#1B4FD8]">
                    {step.number}
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">
                  {step.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-white/45">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[#1B4FD8]">
              Pricing
            </p>
            <h2 className="mb-3 text-4xl font-extrabold tracking-[-0.03em] text-white sm:text-5xl">
              Per-department subscriptions.
            </h2>
            <p className="text-[15px] text-white/35">
              Each department gets their own LogiTrak workspace. Simple.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-[14px] p-7 ${
                  plan.highlighted
                    ? "border border-[#1B4FD8]/50 bg-[#1E293B]"
                    : "border border-white/[0.06] bg-[#1E293B]"
                }`}
                style={
                  plan.highlighted
                    ? {
                        boxShadow:
                          "0 0 0 1px rgba(27,79,216,0.3), 0 0 60px rgba(27,79,216,0.15)",
                      }
                    : undefined
                }
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-brand-blue px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(27,79,216,0.5)]">
                      {plan.badge}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="mb-7">
                  <h3 className="mb-1 text-[17px] font-bold text-white">
                    {plan.name}
                  </h3>
                  <p className="mb-5 text-[13px] text-white/35">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[42px] font-extrabold leading-none tracking-tight text-white">
                      {plan.price}
                    </span>
                    <span className="text-[13px] text-white/35">/mo</span>
                  </div>
                </div>

                {/* Features */}
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#16A34A]" />
                      <span className="text-[13px] leading-snug text-white/65">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.ctaHref}
                  className={`block rounded-[7px] py-3 text-center text-[13px] font-bold transition-all ${
                    plan.highlighted
                      ? "bg-[#1B4FD8] text-white hover:bg-[#1741B3] hover:shadow-[0_0_20px_rgba(27,79,216,0.4)]"
                      : "border border-white/[0.10] text-white/60 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-36 text-center">
        {/* Backgrounds */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 70% at 50% 50%, rgba(27,79,216,0.22) 0%, transparent 65%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 border-y border-white/[0.05] bg-[#1E293B]/15" />

        <div className="relative z-10 mx-auto max-w-2xl">
          <h2 className="mb-5 text-5xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-6xl">
            Stop losing kit.
            <br />
            <span
              style={{
                backgroundImage:
                  "linear-gradient(135deg, #4B7BF5 0%, #1B4FD8 60%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Start your free trial.
            </span>
          </h2>
          <p className="mb-10 text-[17px] text-white/40">
            7 days free on the Professional plan. No credit card required.
          </p>
          <Link
            href="/sign-up"
            className="group inline-flex items-center gap-2.5 rounded-[7px] bg-[#1B4FD8] px-9 py-4 text-[17px] font-bold text-white shadow-[0_0_0_1px_rgba(27,79,216,0.4)] transition-all hover:bg-[#1741B3] hover:shadow-[0_0_50px_rgba(27,79,216,0.5)]"
          >
            Get started for free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.05] px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
            {/* Brand */}
            <div>
              <div className="mb-1.5 flex items-center">
                <span className="text-[17px] font-extrabold tracking-tight text-white">
                  Logi
                </span>
                <span className="text-[17px] font-extrabold tracking-tight text-[#1B4FD8]">
                  Trak
                </span>
              </div>
              <p className="text-[13px] text-white/25">
                Professional equipment tracking for Film & TV
              </p>
            </div>

            {/* Links */}
            <nav className="flex flex-wrap items-center justify-center gap-6 md:gap-8">
              <a
                href="#features"
                className="text-[13px] text-white/35 transition-colors hover:text-white/65"
              >
                Features
              </a>
              <a
                href="#pricing"
                className="text-[13px] text-white/35 transition-colors hover:text-white/65"
              >
                Pricing
              </a>
              <Link
                href="/sign-in"
                className="text-[13px] text-white/35 transition-colors hover:text-white/65"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="text-[13px] text-white/35 transition-colors hover:text-white/65"
              >
                Sign Up
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-[13px] text-white/20">© 2026 LogiTrak</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
