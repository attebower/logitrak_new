/**
 * Workspace invitation email — rendered server-side by Resend.
 *
 * Uses @react-email/components for cross-client compatibility.
 * Subject + plain-text fallback are owned by the caller.
 */

import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Link, Preview, Section, Text,
} from "@react-email/components";

export interface InviteEmailProps {
  workspaceName:   string;
  workspaceLogoUrl?: string | null;
  inviterName:     string;
  inviteeRole:     string;       // "owner" | "admin" | "manager" | "operator" | "read_only"
  acceptUrl:       string;
  expiresAt:       Date | string;
}

const BRAND       = "#2563EB";
const SURFACE_DARK = "#0F172A";
const GREY        = "#64748B";
const GREY_LIGHT  = "#F1F5F9";

function fmtRole(role: string): string {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

export function InviteEmail({
  workspaceName, workspaceLogoUrl, inviterName, inviteeRole, acceptUrl, expiresAt,
}: InviteEmailProps) {
  const previewText = `${inviterName} invited you to join ${workspaceName} on LogiTrak`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ backgroundColor: GREY_LIGHT, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ backgroundColor: "#FFFFFF", maxWidth: 560, margin: "32px auto", borderRadius: 8, overflow: "hidden", border: `1px solid ${GREY_LIGHT}` }}>
          {/* Brand bar */}
          <div style={{ height: 4, backgroundColor: BRAND }} />

          <Section style={{ padding: "32px 32px 16px" }}>
            {workspaceLogoUrl ? (
              <Img src={workspaceLogoUrl} alt={workspaceName} height={36} style={{ maxWidth: 180, objectFit: "contain", marginBottom: 16 }} />
            ) : (
              <Text style={{ fontSize: 12, fontWeight: 700, color: BRAND, letterSpacing: 1.5, margin: 0, marginBottom: 12, textTransform: "uppercase" }}>
                LogiTrak
              </Text>
            )}

            <Heading as="h1" style={{ fontSize: 22, color: SURFACE_DARK, margin: 0, marginBottom: 8 }}>
              You&apos;re invited to {workspaceName}
            </Heading>
            <Text style={{ fontSize: 14, color: GREY, margin: 0, marginBottom: 24, lineHeight: 1.5 }}>
              {inviterName} added you as a <strong style={{ color: SURFACE_DARK }}>{fmtRole(inviteeRole)}</strong>. Click below to accept your invitation and start using LogiTrak.
            </Text>

            <Button
              href={acceptUrl}
              style={{
                backgroundColor: BRAND, color: "#FFFFFF",
                fontSize: 14, fontWeight: 600,
                padding: "12px 24px", borderRadius: 6,
                textDecoration: "none", display: "inline-block",
              }}
            >
              Accept invitation
            </Button>

            <Text style={{ fontSize: 12, color: GREY, marginTop: 24, marginBottom: 0, lineHeight: 1.5 }}>
              Or copy this link into your browser:<br />
              <Link href={acceptUrl} style={{ color: BRAND, wordBreak: "break-all" }}>{acceptUrl}</Link>
            </Text>
          </Section>

          <Hr style={{ borderColor: GREY_LIGHT, margin: 0 }} />

          <Section style={{ padding: "16px 32px 32px" }}>
            <Text style={{ fontSize: 11, color: GREY, margin: 0, lineHeight: 1.5 }}>
              This invitation expires on <strong>{fmtDate(expiresAt)}</strong>. If you weren&apos;t expecting this email, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default InviteEmail;
