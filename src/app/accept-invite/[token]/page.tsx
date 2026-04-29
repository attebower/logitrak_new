"use client";

/**
 * Accept-invite landing page.
 *
 * Public route (no auth gate). Reads the token from the URL, fetches invite
 * metadata via team.getInviteByToken, and renders one of:
 *   - Invalid / expired / already-accepted: friendly error
 *   - Unauthed:                            sign-in CTA returning here
 *   - Authed (matching email):             "Accept" button → team.acceptInvite
 *   - Authed (mismatched email):           explainer + sign-out option
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, AlertCircle } from "lucide-react";

function fmtRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const { data, isLoading, error } = trpc.team.getInviteByToken.useQuery({ token });

  const [authedEmail, setAuthedEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  // Pull the current Supabase session so we can compare emails.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthedEmail(user?.email ?? null);
      setAuthChecked(true);
    });
  }, []);

  const acceptMut = trpc.team.acceptInvite.useMutation({
    onSuccess: () => router.push("/dashboard"),
    onError:   (err) => setAcceptError(err.message),
  });

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAuthedEmail(null);
  }

  // ── Render ────────────────────────────────────────────────────────────

  if (isLoading || !authChecked) {
    return <Shell><p className="text-[13px] text-grey">Loading invitation…</p></Shell>;
  }

  if (error) {
    return (
      <Shell>
        <ErrorBlock title="Invitation not found" body="We couldn't find this invitation. It may have been revoked or the link may be malformed." />
      </Shell>
    );
  }

  if (!data || !data.found) {
    return (
      <Shell>
        <ErrorBlock title="Invitation not found" body="We couldn't find this invitation. It may have been revoked or the link may be malformed." />
      </Shell>
    );
  }

  if (data.expired) {
    return (
      <Shell logoUrl={data.workspaceLogoUrl} workspaceName={data.workspaceName}>
        <ErrorBlock
          title="This invitation has expired"
          body={`Ask ${data.inviterName} to send a fresh invitation from the team page.`}
        />
      </Shell>
    );
  }

  if (data.alreadyAccepted) {
    return (
      <Shell logoUrl={data.workspaceLogoUrl} workspaceName={data.workspaceName}>
        <SuccessBlock
          title="Invitation already accepted"
          body={`You've already joined ${data.workspaceName}. Sign in to continue.`}
          cta={<Link href="/dashboard"><Button size="sm">Go to dashboard</Button></Link>}
        />
      </Shell>
    );
  }

  // Live invitation — branch on auth state
  const inviteEmail = data.email.toLowerCase();
  const userEmail   = authedEmail?.toLowerCase() ?? null;

  // Unauthed → send to sign-in / sign-up with returnTo
  if (!userEmail) {
    const returnTo = encodeURIComponent(`/accept-invite/${token}`);
    return (
      <Shell logoUrl={data.workspaceLogoUrl} workspaceName={data.workspaceName}>
        <Heading>{data.inviterName} invited you to {data.workspaceName}</Heading>
        <Meta data={data} />
        <p className="text-[13px] text-grey leading-relaxed">
          Sign in or create an account with <strong className="text-surface-dark">{data.email}</strong> to accept this invitation.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Link href={`/sign-in?email=${encodeURIComponent(data.email)}&returnTo=${returnTo}`}>
            <Button size="sm">Sign in</Button>
          </Link>
          <Link href={`/sign-up?email=${encodeURIComponent(data.email)}&returnTo=${returnTo}`}>
            <Button size="sm" variant="secondary">Create account</Button>
          </Link>
        </div>
      </Shell>
    );
  }

  // Authed but with the wrong email
  if (userEmail !== inviteEmail) {
    return (
      <Shell logoUrl={data.workspaceLogoUrl} workspaceName={data.workspaceName}>
        <Heading>Wrong account</Heading>
        <p className="text-[13px] text-grey leading-relaxed">
          You&apos;re signed in as <strong className="text-surface-dark">{authedEmail}</strong>, but this invitation was sent to <strong className="text-surface-dark">{data.email}</strong>. Sign out and sign back in with the right address to accept.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" onClick={signOut}>Sign out</Button>
          <Link href="/dashboard"><Button size="sm" variant="secondary">Cancel</Button></Link>
        </div>
      </Shell>
    );
  }

  // Authed with the right email — show Accept
  return (
    <Shell logoUrl={data.workspaceLogoUrl} workspaceName={data.workspaceName}>
      <Heading>{data.inviterName} invited you to {data.workspaceName}</Heading>
      <Meta data={data} />
      <p className="text-[13px] text-grey leading-relaxed">
        Click below to join as a <strong className="text-surface-dark">{fmtRole(data.role)}</strong>.
      </p>
      {acceptError && (
        <div className="bg-red-50 border border-red-100 rounded-btn px-3 py-2 text-[12px] text-status-red">
          {acceptError}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2">
        <Button
          size="sm"
          disabled={acceptMut.isPending}
          onClick={() => acceptMut.mutate({ token })}
        >
          {acceptMut.isPending ? "Joining…" : `Accept and join ${data.workspaceName}`}
        </Button>
        <Link href="/dashboard"><Button size="sm" variant="secondary">Cancel</Button></Link>
      </div>
    </Shell>
  );
}

// ── Layout pieces ─────────────────────────────────────────────────────────

function Shell({
  children, logoUrl, workspaceName,
}: {
  children: React.ReactNode;
  logoUrl?: string | null;
  workspaceName?: string;
}) {
  return (
    <div className="min-h-screen bg-grey-light flex items-center justify-center px-4 py-12">
      <div className="bg-white rounded-card border border-grey-mid shadow-card max-w-md w-full overflow-hidden">
        <div className="h-1 bg-brand-blue" />
        <div className="p-6 space-y-4">
          {logoUrl ? (
            <Image src={logoUrl} alt={workspaceName ?? ""} width={120} height={32} unoptimized className="object-contain max-h-8" />
          ) : (
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-blue">LogiTrak</p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <h1 className="text-[20px] font-semibold text-surface-dark leading-tight">{children}</h1>;
}

function Meta({ data }: { data: { role: string; expiresAt: Date | string } }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-grey">
      <span>Role: <strong className="text-surface-dark">{fmtRole(data.role)}</strong></span>
      <span>Expires: <strong className="text-surface-dark">{fmtDate(data.expiresAt)}</strong></span>
    </div>
  );
}

function ErrorBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-status-red flex-shrink-0 mt-0.5" />
        <div>
          <h1 className="text-[16px] font-semibold text-surface-dark">{title}</h1>
          <p className="text-[13px] text-grey mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
      <Link href="/sign-in" className="inline-block"><Button size="sm" variant="secondary">Sign in</Button></Link>
    </div>
  );
}

function SuccessBlock({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-status-green flex-shrink-0 mt-0.5" />
        <div>
          <h1 className="text-[16px] font-semibold text-surface-dark">{title}</h1>
          <p className="text-[13px] text-grey mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
      {cta}
    </div>
  );
}
