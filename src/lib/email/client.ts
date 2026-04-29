/**
 * Email client — thin wrapper around Resend.
 *
 * Reads RESEND_API_KEY and EMAIL_FROM from the environment. If RESEND_API_KEY
 * is unset (e.g. local dev without a Resend account), `sendEmail` becomes a
 * no-op that logs the intended send. This keeps the rest of the app
 * functional during development; the invite token is still in the DB and the
 * console output shows what would have been sent.
 *
 * Server-only — never import this from a client component.
 */

import { Resend } from "resend";
import type { ReactElement } from "react";

const apiKey = process.env.RESEND_API_KEY;
const from   = process.env.EMAIL_FROM ?? "LogiTrak <onboarding@resend.dev>";

const client = apiKey ? new Resend(apiKey) : null;

export interface SendEmailParams {
  to:      string | string[];
  subject: string;
  react:   ReactElement;
  /** Optional plain-text fallback. If omitted, Resend derives one from the React tree. */
  text?:   string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ skipped: boolean }> {
  if (!client) {
    // eslint-disable-next-line no-console
    console.warn(
      `[email] RESEND_API_KEY not set — skipping send. ` +
      `to=${Array.isArray(params.to) ? params.to.join(",") : params.to} subject="${params.subject}"`
    );
    return { skipped: true };
  }

  const { error } = await client.emails.send({
    from,
    to:      params.to,
    subject: params.subject,
    react:   params.react,
    ...(params.text ? { text: params.text } : {}),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message ?? "unknown error"}`);
  }

  return { skipped: false };
}

/** True if email sending is wired up in this environment. UI can use this to show a banner. */
export function isEmailEnabled(): boolean {
  return client != null;
}
