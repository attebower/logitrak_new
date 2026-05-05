"use client";

/**
 * Settings → Documents.
 *
 * Single template selector that drives all internal PDFs:
 *   - Equipment List PDF (cross hire detail page)
 *   - Reports PDF (Reports page export)
 *   - Set Snapshot PDF (project set snapshot API)
 *
 * Invoice template is set separately in /settings/invoicing because
 * invoices have additional fields (VAT rate, footer, etc).
 */

import { Button } from "@/components/ui/button";
import { useState } from "react";
import {
  SettingsPageShell, SettingsSection,
} from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { DocumentTemplate } from "@prisma/client";
import { Check } from "lucide-react";

const TEMPLATES: Array<{ value: DocumentTemplate; label: string; description: string; preview: string }> = [
  {
    value: "modern",
    label: "Modern",
    description: "Brand colour bar, clean Helvetica, generous spacing. Default.",
    preview: "Bold blue accent stripe at the top, Helvetica throughout, light grey table headers. Best on screen.",
  },
  {
    value: "classic",
    label: "Classic",
    description: "Times Roman serif, formal centred header, ruled tables.",
    preview: "Centred serif heading, no colour bar, ruled cells. Looks at home in a printed handover folder.",
  },
  {
    value: "minimal",
    label: "Minimal",
    description: "Smaller type, tight spacing, no brand colour. Best for plain printing.",
    preview: "Small Helvetica, tight margins, monochrome. Saves paper on long equipment lists.",
  },
];

export default function SettingsDocumentsPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.workspace.getDocumentTemplate.useQuery({ workspaceId });

  const [pending, setPending] = useState<DocumentTemplate | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateMut = trpc.workspace.updateDocumentTemplate.useMutation({
    onSuccess: () => {
      setPending(null);
      setSaveError(null);
      void utils.workspace.getDocumentTemplate.invalidate();
    },
    onError: (err) => {
      setSaveError(err.message);
      setPending(null);
    },
  });

  const current = pending ?? data?.documentTemplate ?? "modern";

  function pick(t: DocumentTemplate) {
    if (t === data?.documentTemplate) return;
    setPending(t);
    setSaveError(null);
    updateMut.mutate({ workspaceId, documentTemplate: t });
  }

  return (
    <SettingsPageShell
      title="Documents"
      description="Pick a visual style for the Equipment List, Reports, and Set Snapshot PDFs. The change applies the next time any of these documents is generated."
    >
      <SettingsSection
        title="Template"
        description="One template drives every internal PDF. Invoice styling is set separately in Invoicing."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const selected = current === t.value;
            const isPending = updateMut.isPending && pending === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => pick(t.value)}
                disabled={isLoading || updateMut.isPending}
                className={cn(
                  "text-left rounded-card border p-4 transition-colors flex flex-col",
                  selected
                    ? "border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/20"
                    : "border-grey-mid hover:border-brand-blue/40 bg-white",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-surface-dark">{t.label}</span>
                  {selected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                      <Check className="h-3 w-3" /> Active
                    </span>
                  )}
                  {isPending && (
                    <span className="text-[10px] font-medium text-grey">Saving…</span>
                  )}
                </div>
                <p className="text-[12px] text-grey leading-snug mb-2">{t.description}</p>
                <p className="text-[11px] text-grey/80 leading-snug italic mt-auto">{t.preview}</p>
              </button>
            );
          })}
        </div>
        {saveError && <p className="text-[12px] text-status-red mt-3">{saveError}</p>}
      </SettingsSection>

      <SettingsSection
        title="Where this is used"
        description="The selected template flows through every PDF generator in the app."
      >
        <ul className="text-[13px] text-surface-dark space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-brand-blue mt-0.5">·</span>
            <span><strong>Equipment List PDF</strong> — generated from a cross hire detail page.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-blue mt-0.5">·</span>
            <span><strong>Reports PDF</strong> — Reports page → Export PDF on any tab.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-blue mt-0.5">·</span>
            <span><strong>Set Snapshot PDF</strong> — project set snapshot from a project page.</span>
          </li>
          <li className="flex items-start gap-2 text-grey">
            <span className="text-grey mt-0.5">·</span>
            <span>Cross hire <strong>Invoice</strong> uses its own template, picked in <a className="text-brand-blue hover:underline" href="/settings/invoicing">Invoicing</a> (because invoices have extra settings — VAT, footer, etc.).</span>
          </li>
        </ul>
      </SettingsSection>
    </SettingsPageShell>
  );
}
