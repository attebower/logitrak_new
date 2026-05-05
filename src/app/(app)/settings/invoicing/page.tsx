"use client";

/**
 * Settings → Invoicing.
 *
 * Per-workspace invoicing settings:
 *   - Numbering prefix (year-prefixed sequence, e.g. MCC-2026-0001)
 *   - VAT rate
 *   - Payment terms (days + free-text override)
 *   - Footer (printed below totals on every invoice)
 *   - Template variant (Modern / Classic / Minimal) — drives CrossHireInvoicePdf
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SettingsPageShell, SettingsSection, SettingsField,
} from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import type { InvoiceTemplate } from "@prisma/client";

interface FormState {
  invoicePrefix:    string;
  invoiceTemplate:  InvoiceTemplate;
  vatRatePct:       string; // % string (e.g. "20" or "20.00") — stored as 0–1 decimal server-side
  paymentTermsDays: string;
  paymentTermsText: string;
  invoiceFooter:    string;
}

const EMPTY: FormState = {
  invoicePrefix:    "",
  invoiceTemplate:  "modern",
  vatRatePct:       "20",
  paymentTermsDays: "30",
  paymentTermsText: "",
  invoiceFooter:    "",
};

const inputCls = "w-full px-3 py-2 border border-grey-mid rounded-btn text-[13px] text-surface-dark bg-white focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

const TEMPLATES: Array<{ value: InvoiceTemplate; label: string; description: string }> = [
  { value: "modern",  label: "Modern",  description: "Brand colour bar, clean Helvetica, tight spacing. Default." },
  { value: "classic", label: "Classic", description: "Times Roman serif, formal centred header, ruled tables." },
  { value: "minimal", label: "Minimal", description: "Smaller type, tight spacing, no brand colour. Best for plain printing." },
];

export default function SettingsInvoicingPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.workspace.getInvoiceSettings.useQuery({ workspaceId });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      invoicePrefix:    data.invoicePrefix,
      invoiceTemplate:  data.invoiceTemplate,
      vatRatePct:       (parseFloat(data.vatRate) * 100).toString(),
      paymentTermsDays: String(data.paymentTermsDays),
      paymentTermsText: data.paymentTermsText ?? "",
      invoiceFooter:    data.invoiceFooter ?? "",
    });
    setDirty(false);
  }, [data]);

  const updateMut = trpc.workspace.updateInvoiceSettings.useMutation({
    onSuccess: () => {
      setDirty(false);
      setSaveError(null);
      void utils.workspace.getInvoiceSettings.invalidate();
    },
    onError: (err) => setSaveError(err.message),
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  // Live preview: compute what the next invoice would look like with the
  // *current form* prefix (not yet saved). Server returns the canonical preview
  // based on persisted state, but the user expects to see typed-in changes.
  const previewWithCurrentForm = (() => {
    if (!data) return "—";
    const year = new Date().getFullYear();
    const nextSeq = (data.invoicePreview.match(/-(\d+)$/)?.[1]) ?? "0001";
    const prefix = (form.invoicePrefix || data.invoicePrefix).toUpperCase();
    return `${prefix}-${year}-${nextSeq}`;
  })();

  function handleSave() {
    const vatPct = parseFloat(form.vatRatePct);
    if (Number.isNaN(vatPct) || vatPct < 0 || vatPct > 100) {
      setSaveError("VAT rate must be between 0 and 100.");
      return;
    }
    const termsDays = parseInt(form.paymentTermsDays, 10);
    if (Number.isNaN(termsDays) || termsDays < 0 || termsDays > 365) {
      setSaveError("Payment terms must be between 0 and 365 days.");
      return;
    }
    if (!/^[A-Z0-9_-]+$/i.test(form.invoicePrefix) || form.invoicePrefix.length === 0) {
      setSaveError("Invoice prefix: use letters, numbers, dash or underscore only.");
      return;
    }
    setSaveError(null);
    updateMut.mutate({
      workspaceId,
      invoicePrefix:    form.invoicePrefix,
      invoiceTemplate:  form.invoiceTemplate,
      vatRate:          vatPct / 100,
      paymentTermsDays: termsDays,
      paymentTermsText: form.paymentTermsText,
      invoiceFooter:    form.invoiceFooter,
    });
  }

  return (
    <SettingsPageShell
      title="Invoicing"
      description="Numbering, tax and template settings used when generating cross hire invoices."
    >
      <SettingsSection
        title="Numbering"
        description="Invoices are numbered automatically with a year-prefixed sequence that resets each January."
      >
        <SettingsField label="Prefix">
          <input
            className={inputCls}
            value={form.invoicePrefix}
            onChange={(e) => set("invoicePrefix", e.target.value.toUpperCase())}
            placeholder="MCC"
            maxLength={16}
            disabled={isLoading}
          />
          <p className="text-[11px] text-grey mt-1">
            Letters, numbers, dash or underscore. Stored uppercase.
          </p>
        </SettingsField>
        <div className="bg-grey-light/50 rounded-btn px-3 py-2 border border-grey-mid">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-grey mb-0.5">Next invoice number</div>
          <div className="text-[14px] font-mono font-semibold text-surface-dark">{previewWithCurrentForm}</div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Tax"
        description="Applied to all invoiced totals. Set to 0 to omit the VAT line entirely."
      >
        <SettingsField label="VAT rate (%)">
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={inputCls}
            value={form.vatRatePct}
            onChange={(e) => set("vatRatePct", e.target.value)}
            placeholder="20"
            disabled={isLoading}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Payment terms"
        description="Shown on every invoice. The free-text override replaces the default 'Net X days' wording when filled in."
      >
        <SettingsField label="Default term (days)">
          <input
            type="number"
            min="0"
            max="365"
            className={inputCls}
            value={form.paymentTermsDays}
            onChange={(e) => set("paymentTermsDays", e.target.value)}
            disabled={isLoading}
          />
        </SettingsField>
        <SettingsField label="Override text (optional)">
          <input
            className={inputCls}
            value={form.paymentTermsText}
            onChange={(e) => set("paymentTermsText", e.target.value)}
            placeholder="Net 30 from invoice date"
            disabled={isLoading}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Footer"
        description="Printed below the totals on every invoice. Useful for a thank-you note, late fee policy, or company registration line."
      >
        <SettingsField label="Footer text">
          <textarea
            className={`${inputCls} resize-none font-mono`}
            rows={4}
            value={form.invoiceFooter}
            onChange={(e) => set("invoiceFooter", e.target.value)}
            placeholder={"Thank you for your business.\nLate payments incur 2.5% per month."}
            disabled={isLoading}
          />
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="Template"
        description="The visual style used by the invoice PDF."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const selected = form.invoiceTemplate === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => set("invoiceTemplate", t.value)}
                disabled={isLoading}
                className={cn(
                  "text-left rounded-card border p-4 transition-colors",
                  selected
                    ? "border-brand-blue bg-brand-blue/5 ring-2 ring-brand-blue/20"
                    : "border-grey-mid hover:border-brand-blue/40 bg-white",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[13px] font-semibold text-surface-dark">{t.label}</span>
                  {selected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-1.5 py-0.5 rounded">Selected</span>
                  )}
                </div>
                <p className="text-[12px] text-grey leading-snug">{t.description}</p>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-white border-t border-grey-mid flex items-center justify-end gap-3">
        {saveError && <p className="text-[12px] text-status-red mr-auto">{saveError}</p>}
        {dirty && !saveError && (
          <p className="text-[12px] text-grey mr-auto">Unsaved changes</p>
        )}
        <Button size="sm" disabled={!dirty || updateMut.isPending} onClick={handleSave}>
          {updateMut.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </SettingsPageShell>
  );
}
