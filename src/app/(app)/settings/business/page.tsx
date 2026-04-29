"use client";

/**
 * Settings → Business profile.
 *
 * The owner's company details — used as the "From" block on cross hire
 * invoices, the equipment-list PDF header, and (optionally) the printed
 * label header. Logo is uploaded to Supabase Storage; the public URL is
 * stored on Workspace.logoUrl.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  SettingsPageShell, SettingsSection, SettingsField,
} from "@/components/shared/SettingsLayout";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, Trash2 } from "lucide-react";

const LOGO_BUCKET = "workspace-logos";

interface FormState {
  businessName:  string;
  addressLine1:  string;
  addressLine2:  string;
  city:          string;
  county:        string;
  postcode:      string;
  country:       string;
  vatNumber:     string;
  businessEmail: string;
  businessPhone: string;
  bankDetails:   string;
  logoUrl:       string;
}

const EMPTY: FormState = {
  businessName: "", addressLine1: "", addressLine2: "",
  city: "", county: "", postcode: "", country: "",
  vatNumber: "", businessEmail: "", businessPhone: "",
  bankDetails: "", logoUrl: "",
};

const inputCls = "w-full px-3 py-2 border border-grey-mid rounded-btn text-[13px] text-surface-dark bg-white focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

export default function SettingsBusinessPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.workspace.getBusinessProfile.useQuery({ workspaceId });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Hydrate the form from the server response (only when the data first
  // arrives or when the workspace changes — never overwrite local edits).
  useEffect(() => {
    if (!data) return;
    setForm({
      businessName:  data.businessName  ?? "",
      addressLine1:  data.addressLine1  ?? "",
      addressLine2:  data.addressLine2  ?? "",
      city:          data.city          ?? "",
      county:        data.county        ?? "",
      postcode:      data.postcode      ?? "",
      country:       data.country       ?? "",
      vatNumber:     data.vatNumber     ?? "",
      businessEmail: data.businessEmail ?? "",
      businessPhone: data.businessPhone ?? "",
      bankDetails:   data.bankDetails   ?? "",
      logoUrl:       data.logoUrl       ?? "",
    });
    setDirty(false);
  }, [data]);

  const updateMut = trpc.workspace.updateBusinessProfile.useMutation({
    onSuccess: () => {
      setDirty(false);
      setSaveError(null);
      void utils.workspace.getBusinessProfile.invalidate();
    },
    onError: (err) => setSaveError(err.message),
  });

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Please pick an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Image too large — keep it under 2 MB.");
      return;
    }
    setLogoError(null);
    setLogoUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${workspaceId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
      set("logoUrl", pub.publicUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      setLogoError(msg.includes("Bucket not found")
        ? `Supabase bucket "${LOGO_BUCKET}" doesn't exist yet. Create it (public read) in your Supabase dashboard.`
        : msg);
    } finally {
      setLogoUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleRemoveLogo() {
    set("logoUrl", "");
  }

  function handleSave() {
    updateMut.mutate({ workspaceId, ...form });
  }

  return (
    <SettingsPageShell
      title="Business profile"
      description="Used as the From block on cross hire invoices and the header of equipment list PDFs."
    >
      <SettingsSection
        title="Logo"
        description="Square or wide PNG/JPG/SVG. Max 2 MB. Stored in your Supabase project."
      >
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-card border border-grey-mid bg-grey-light/40 overflow-hidden flex items-center justify-center">
            {form.logoUrl ? (
              <Image
                src={form.logoUrl}
                alt="Business logo"
                width={80}
                height={80}
                className="object-contain h-full w-full"
                unoptimized
              />
            ) : (
              <ImagePlus className="h-6 w-6 text-grey" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button size="sm" disabled={logoUploading} onClick={() => fileRef.current?.click()}>
                {logoUploading ? "Uploading…" : form.logoUrl ? "Replace" : "Upload"}
              </Button>
              {form.logoUrl && (
                <Button size="sm" variant="secondary" onClick={handleRemoveLogo}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Remove
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
            {logoError && <p className="text-[12px] text-status-red">{logoError}</p>}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Company"
        description="Legal name, registered address, VAT and contact details."
      >
        <SettingsField label="Trading / Legal Name">
          <input
            className={inputCls}
            value={form.businessName}
            onChange={(e) => set("businessName", e.target.value)}
            placeholder={isLoading ? "" : "e.g. MCC Lighting Ltd"}
            disabled={isLoading}
          />
        </SettingsField>
        <SettingsField label="Address line 1">
          <input className={inputCls} value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} disabled={isLoading} />
        </SettingsField>
        <SettingsField label="Address line 2">
          <input className={inputCls} value={form.addressLine2} onChange={(e) => set("addressLine2", e.target.value)} disabled={isLoading} />
        </SettingsField>
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="City">
            <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} disabled={isLoading} />
          </SettingsField>
          <SettingsField label="County / State">
            <input className={inputCls} value={form.county} onChange={(e) => set("county", e.target.value)} disabled={isLoading} />
          </SettingsField>
          <SettingsField label="Postcode / ZIP">
            <input className={inputCls} value={form.postcode} onChange={(e) => set("postcode", e.target.value)} disabled={isLoading} />
          </SettingsField>
          <SettingsField label="Country">
            <input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="United Kingdom" disabled={isLoading} />
          </SettingsField>
        </div>
        <SettingsField label="VAT number">
          <input className={inputCls} value={form.vatNumber} onChange={(e) => set("vatNumber", e.target.value)} placeholder="GB123456789" disabled={isLoading} />
        </SettingsField>
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Business email">
            <input type="email" className={inputCls} value={form.businessEmail} onChange={(e) => set("businessEmail", e.target.value)} disabled={isLoading} />
          </SettingsField>
          <SettingsField label="Business phone">
            <input type="tel" className={inputCls} value={form.businessPhone} onChange={(e) => set("businessPhone", e.target.value)} disabled={isLoading} />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Bank details"
        description="Optional — printed at the bottom of cross hire invoices for payment."
      >
        <SettingsField label="Account info / payment instructions">
          <textarea
            className={`${inputCls} resize-none`}
            rows={4}
            value={form.bankDetails}
            onChange={(e) => set("bankDetails", e.target.value)}
            placeholder={"Bank: Barclays\nAccount: 12345678\nSort code: 12-34-56\nReference: invoice number"}
            disabled={isLoading}
          />
        </SettingsField>
      </SettingsSection>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-8 px-8 py-4 bg-white border-t border-grey-mid flex items-center justify-end gap-3">
        {saveError && <p className="text-[12px] text-status-red mr-auto">{saveError}</p>}
        <Button
          size="sm"
          disabled={!dirty || updateMut.isPending}
          onClick={handleSave}
        >
          {updateMut.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </SettingsPageShell>
  );
}
