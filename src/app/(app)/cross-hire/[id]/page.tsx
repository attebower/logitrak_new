"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { downloadCrossHireInvoicePdf } from "@/lib/pdf/CrossHireInvoicePdf";
import { downloadCrossHireEquipmentListPdf } from "@/lib/pdf/CrossHireEquipmentListPdf";
import { toast } from "sonner";
import {
  ArrowLeft, XCircle, AlertTriangle,
  User, Phone, Mail, MapPin, FileText, ListChecks, Calendar, PoundSterling,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatMoney(n: number): string {
  return `£${n.toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  active:    "bg-violet-100 text-violet-700",
  returned:  "bg-green-100  text-green-700",
  cancelled: "bg-gray-100   text-gray-600",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function CrossHireDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { workspaceId, workspaceName } = useWorkspace();

  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: event, isLoading, error } = trpc.crossHire["crossHire.getById"].useQuery({
    workspaceId,
    id,
  });

  // Pull the workspace business profile so PDFs can populate From / header.
  const { data: business } = trpc.workspace.getBusinessProfile.useQuery({ workspaceId });
  const { data: invoiceSettings } = trpc.workspace.getInvoiceSettings.useQuery({ workspaceId });
  const { data: documentTemplate } = trpc.workspace.getDocumentTemplate.useQuery({ workspaceId });

  const cancelMut = trpc.crossHire["crossHire.cancel"].useMutation({
    onSuccess: () => {
      // The event has been deleted server-side. Drop it from the list cache
      // and route back to the index — there's nothing left to view.
      void utils.crossHire["crossHire.list"].invalidate();
      void utils.equipment.list.invalidate();
      void utils.dashboard.stats.invalidate();
      toast.success("Cross hire deleted, items returned to stock");
      router.push("/cross-hire");
    },
    onError: (err) => toast.error("Couldn't cancel hire", { description: err.message }),
  });

  if (isLoading) {
    return (
      <>
        <AppTopbar title="Cross Hire" />
        <div className="flex-1 flex items-center justify-center text-grey text-[13px]">Loading…</div>
      </>
    );
  }

  if (error || !event) {
    return (
      <>
        <AppTopbar title="Cross Hire" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[14px] font-medium text-surface-dark mb-2">Event not found</p>
            <Link href="/cross-hire">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  // ── Derived data ──────────────────────────────────────────────────────

  const now     = Date.now();
  const startMs = new Date(event.startDate).getTime();

  // Resolve end date — prefer the stored value, otherwise derive from totalDays.
  // (Older rows created before the auto-derive on save may have endDate=null.)
  const resolvedEndDate: Date | null =
    event.endDate
      ? new Date(event.endDate)
      : event.totalDays
        ? new Date(startMs + event.totalDays * 86400000)
        : null;
  const endMs = resolvedEndDate ? resolvedEndDate.getTime() : null;

  const isOverdue   = event.status === "active" && !!endMs && endMs < now;
  const daysOverdue = isOverdue && endMs ? Math.floor((now - endMs) / 86400000) : 0;
  const daysLeft    = !isOverdue && endMs ? Math.max(0, Math.ceil((endMs - now) / 86400000)) : 0;

  const totalItems    = event.equipmentItems.length;
  const returnedItems = event.equipmentItems.filter((i) => i.returnedAt).length;
  const outstanding   = totalItems - returnedItems;
  const pctReturned   = totalItems === 0 ? 0 : Math.round((returnedItems / totalItems) * 100);

  const totalDailyRate = event.equipmentItems.reduce((sum, i) => sum + Number(i.dailyRate), 0);
  const days           = event.totalDays ?? (endMs ? Math.max(1, Math.ceil((endMs - startMs) / 86400000)) : null);

  // Period total — apply weekly discount per-item when hire is 7+ days.
  // Discount is stored as a percentage (0-100) on CrossHireItem.weeklyRate.
  const periodTotal: number | null = days != null
    ? event.equipmentItems.reduce((sum, i) => {
        const daily = Number(i.dailyRate);
        const lineGross = daily * days;
        const discountPct = i.weeklyRate != null ? Number(i.weeklyRate) : 0;
        const applyDiscount = days >= 7 && discountPct > 0;
        return sum + (applyDiscount ? lineGross * (1 - discountPct / 100) : lineGross);
      }, 0)
    : null;
  const periodTotalGross: number | null = days != null ? totalDailyRate * days : null;
  const discountAmount: number = periodTotalGross != null && periodTotal != null
    ? periodTotalGross - periodTotal
    : 0;

  const invoiceNo = event.invoiceNumber ?? event.id.slice(-8).toUpperCase();

  // Address one-liner for the customer
  const customerAddress = [
    event.hireCustomer.addressLine1, event.hireCustomer.addressLine2,
    event.hireCustomer.city, event.hireCustomer.county,
    event.hireCustomer.postcode, event.hireCustomer.country,
  ].filter((s): s is string => !!s && s.trim().length > 0).join(", ");

  const owner = business
    ? {
        businessName:  business.businessName  ?? undefined,
        addressLine1:  business.addressLine1,
        addressLine2:  business.addressLine2,
        city:          business.city,
        county:        business.county,
        postcode:      business.postcode,
        country:       business.country,
        vatNumber:     business.vatNumber,
        contactEmail:  business.businessEmail,
        contactPhone:  business.businessPhone,
        bankDetails:   business.bankDetails,
        logoUrl:       business.logoUrl,
      }
    : undefined;

  function downloadInvoice() {
    if (!event) return;
    void downloadCrossHireInvoicePdf(
      {
        workspaceName,
        owner,
        event,
        template:         invoiceSettings?.invoiceTemplate,
        vatRate:          invoiceSettings ? parseFloat(invoiceSettings.vatRate) : undefined,
        paymentTermsDays: invoiceSettings?.paymentTermsDays,
        paymentTermsText: invoiceSettings?.paymentTermsText,
        invoiceFooter:    invoiceSettings?.invoiceFooter,
      },
      `Invoice-${event.invoiceNumber ?? event.id.slice(-8)}.pdf`,
    );
  }
  function downloadEquipmentList() {
    if (!event) return;
    void downloadCrossHireEquipmentListPdf(
      { workspaceName, event, template: documentTemplate?.documentTemplate },
      `Equipment-List-${event.hireCustomer.productionName.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
    );
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title={event.hireCustomer.productionName}
        actions={
          <Link href="/cross-hire">
            <Button size="sm">
              All Cross Hires
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto w-full px-6 py-6 space-y-6">

          {/* ── Document hero ─────────────────────────────────────────── */}
          <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
            <div className="px-6 py-5 flex items-start justify-between gap-6 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-4 mb-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold tracking-wider text-grey uppercase">Cross Hire</span>
                  <span className="text-[11px] font-semibold tracking-wider text-grey uppercase">#{invoiceNo}</span>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold tracking-wider uppercase",
                    STATUS_STYLES[event.status] ?? "bg-grey-mid text-surface-dark"
                  )}>
                    {event.status}
                  </span>
                  {isOverdue && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded">
                      <AlertTriangle className="h-3 w-3" />
                      {daysOverdue}d overdue
                    </span>
                  )}
                </div>
                <h1 className="text-[26px] font-bold text-surface-dark leading-tight truncate">
                  {event.hireCustomer.productionName}
                </h1>
                <p className="text-[13px] text-grey mt-1">
                  {formatDate(event.startDate)}
                  {resolvedEndDate && <> – {formatDate(resolvedEndDate)}</>}
                  {days != null && <> · {days} day{days === 1 ? "" : "s"}</>}
                  <> · created {formatDate(event.createdAt)}</>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <Button variant="primary" size="sm" onClick={downloadInvoice}>
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Create Invoice
                </Button>
                <Button variant="secondary" size="sm" onClick={downloadEquipmentList}>
                  <ListChecks className="h-3.5 w-3.5 mr-1.5" />
                  Create Equipment List
                </Button>
              </div>
            </div>

            {/* Progress strip */}
            {event.status === "active" && (
              <div className="px-6 pb-5">
                <div className="flex items-center justify-between text-[11px] text-grey mb-1.5">
                  <span className="uppercase tracking-wide font-semibold">Returned</span>
                  <span><span className="font-semibold text-surface-dark">{returnedItems}</span> / {totalItems} items · {pctReturned}%</span>
                </div>
                <div className="w-full h-1.5 bg-grey-light rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all",
                      pctReturned === 100 ? "bg-status-green" : "bg-violet-500"
                    )}
                    style={{ width: `${pctReturned}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Summary tiles ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryTile
              label="Items on hire"
              value={`${outstanding}`}
              hint={`of ${totalItems}`}
              tone={outstanding > 0 && isOverdue ? "red" : "default"}
            />
            <SummaryTile
              label={isOverdue ? "Days overdue" : event.returnedAt ? "Returned" : "Days left"}
              value={
                isOverdue
                  ? `${daysOverdue}d`
                  : event.returnedAt
                    ? formatDate(event.returnedAt)
                    : endMs ? `${daysLeft}d` : "—"
              }
              hint={endMs ? `due ${formatDate(resolvedEndDate)}` : undefined}
              tone={isOverdue ? "red" : "default"}
            />
            <SummaryTile
              label="Daily rate"
              value={totalDailyRate.toFixed(2)}
              hint="across all items"
            />
            <SummaryTile
              label="Period total"
              value={periodTotal != null ? periodTotal.toFixed(2) : "—"}
              hint={days != null ? `${days} day${days === 1 ? "" : "s"}` : "no end date"}
            />
          </div>

          {/* ── Customer + Terms ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <SectionCard title="Customer">
              <div className="space-y-2.5">
                <div>
                  <p className="text-[15px] font-semibold text-surface-dark leading-tight">
                    {event.hireCustomer.productionName}
                  </p>
                  {event.hireCustomer.vatNumber && (
                    <p className="text-[12px] text-grey mt-0.5">VAT: {event.hireCustomer.vatNumber}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  {event.hireCustomer.contactName && (
                    <ContactRow icon={<User className="h-3.5 w-3.5" />} value={event.hireCustomer.contactName} />
                  )}
                  {event.hireCustomer.contactPhone && (
                    <ContactRow icon={<Phone className="h-3.5 w-3.5" />} value={event.hireCustomer.contactPhone} />
                  )}
                  {event.hireCustomer.contactEmail && (
                    <ContactRow
                      icon={<Mail className="h-3.5 w-3.5" />}
                      value={
                        <a href={`mailto:${event.hireCustomer.contactEmail}`} className="hover:text-brand-blue">
                          {event.hireCustomer.contactEmail}
                        </a>
                      }
                    />
                  )}
                  {customerAddress && (
                    <ContactRow icon={<MapPin className="h-3.5 w-3.5 mt-0.5" />} value={customerAddress} multiline />
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Hire Terms">
              <dl className="divide-y divide-grey-mid -mx-5">
                <TermRow label="Terms" value={event.termsOfHire.replace(/\s*\([^)]*\)$/, "")} />
                <TermRow label="Start" value={formatDate(event.startDate)} />
                <TermRow label="Due back" value={formatDate(resolvedEndDate)} tone={isOverdue ? "red" : "default"} />
                {event.returnedAt && <TermRow label="Returned" value={formatDate(event.returnedAt)} />}
                {days != null && <TermRow label="Total days" value={`${days}`} />}
                {event.notes && <TermRow label="Notes" value={event.notes} multiline />}
              </dl>
            </SectionCard>
          </div>

          {/* ── Items ───────────────────────────────────────────────────── */}
          <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-grey-mid flex items-center justify-between">
              <h2 className="text-[12px] font-semibold text-surface-dark uppercase tracking-wider">
                Equipment Items
              </h2>
              <span className="text-[11px] text-grey">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-grey-light/50 border-b border-grey-mid">
                    <th className="text-left  px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Serial</th>
                    <th className="text-left  px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Name</th>
                    <th className="text-left  px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Category</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Daily</th>
                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Weekly disc.</th>
                    <th className="text-left  px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Notes</th>
                    <th className="text-left  px-5 py-2 text-[10px] font-semibold text-grey uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-mid">
                  {event.equipmentItems.map((item) => {
                    const isReturned = !!item.returnedAt;
                    return (
                      <tr key={item.id} className={cn("transition-colors", isReturned ? "bg-grey-light/20" : "hover:bg-brand-blue/[0.04]")}>
                        <td className="px-5 py-2.5 font-mono font-semibold text-surface-dark">{item.equipment.serial}</td>
                        <td className="px-5 py-2.5 text-surface-dark">{item.equipment.name}</td>
                        <td className="px-5 py-2.5 text-grey">{item.equipment.category?.name ?? "—"}</td>
                        <td className="px-5 py-2.5 text-right font-medium text-surface-dark">£{Number(item.dailyRate).toFixed(2)}</td>
                        <td className="px-5 py-2.5 text-right text-grey">{item.weeklyRate ? `${Number(item.weeklyRate).toFixed(1)}%` : "—"}</td>
                        <td className="px-5 py-2.5 text-grey max-w-[180px] truncate">{item.notes ?? "—"}</td>
                        <td className="px-5 py-2.5">
                          {isReturned ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-green-100 text-green-700">
                              Returned {formatDate(item.returnedAt)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase bg-violet-100 text-violet-700">
                              On Hire
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-3 border-t border-grey-mid bg-grey-light/30 flex items-center justify-between gap-6 flex-wrap">
              <span className="text-[11px] text-grey uppercase tracking-wide font-semibold">Totals</span>
              <div className="flex items-center gap-6 text-[12px] flex-wrap">
                <span className="text-grey">
                  Daily rate <span className="font-semibold text-surface-dark">{formatMoney(totalDailyRate)}</span>
                </span>
                {periodTotalGross != null && discountAmount > 0 && (
                  <>
                    <span className="text-grey">
                      Subtotal <span className="font-semibold text-surface-dark">{formatMoney(periodTotalGross)}</span>
                    </span>
                    <span className="text-grey">
                      Weekly discount <span className="font-semibold text-status-green">−{formatMoney(discountAmount)}</span>
                    </span>
                  </>
                )}
                {periodTotal != null && (
                  <span className="text-grey">
                    Period total <span className="font-semibold text-surface-dark">{formatMoney(periodTotal)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── Danger zone ─────────────────────────────────────────── */}
          {event.status === "active" && (
            <div className="bg-white rounded-card border border-grey-mid shadow-card px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[13px] font-semibold text-surface-dark">Cancel this cross hire</p>
                <p className="text-[12px] text-grey">Permanently deletes the order. All items return to stock.</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setConfirmCancelOpen(true)}>
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                Cancel Hire
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm cancel modal ──────────────────────────────────────── */}
      {confirmCancelOpen && event.status === "active" && (
        <ConfirmCancelModal
          productionName={event.hireCustomer.productionName}
          itemCount={event.equipmentItems.filter((i) => !i.returnedAt).length}
          isPending={cancelMut.isPending}
          onConfirm={() => cancelMut.mutate({ workspaceId, eventId: event.id })}
          onClose={() => { if (!cancelMut.isPending) setConfirmCancelOpen(false); }}
        />
      )}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ConfirmCancelModal({
  productionName, itemCount, isPending, onConfirm, onClose,
}: {
  productionName: string;
  itemCount: number;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-hire-title"
      >
        <div className="bg-white rounded-card shadow-device max-w-md w-full overflow-hidden">
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-status-red" />
              </div>
              <div className="min-w-0">
                <h2 id="cancel-hire-title" className="text-[16px] font-semibold text-surface-dark">
                  Cancel this cross hire?
                </h2>
                <p className="text-[12px] text-grey mt-0.5 truncate">{productionName}</p>
              </div>
            </div>
            <div className="mt-4 text-[13px] text-surface-dark space-y-2">
              <p>This will <span className="font-semibold">permanently delete</span> this cross hire order. It cannot be undone.</p>
              {itemCount > 0 && (
                <p>
                  <span className="font-semibold">{itemCount}</span> item{itemCount === 1 ? "" : "s"} currently on hire will be returned to stock.
                </p>
              )}
            </div>
          </div>
          <div className="px-6 py-3 bg-grey-light/40 border-t border-grey-mid flex items-center justify-end gap-2">
            <Button variant="secondary" size="sm" disabled={isPending} onClick={onClose}>
              Keep hire
            </Button>
            <Button variant="destructive" size="sm" disabled={isPending} onClick={onConfirm}>
              {isPending ? "Deleting…" : "Yes, delete"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryTile({
  label, value, hint, tone = "default", icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "red";
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-card border border-grey-mid shadow-card px-4 py-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-grey">{label}</span>
        {icon && <span className="text-grey">{icon}</span>}
      </div>
      <p className={cn("text-[20px] font-bold leading-tight",
        tone === "red" ? "text-status-red" : "text-surface-dark"
      )}>
        {value}
      </p>
      {hint && <p className="text-[11px] text-grey mt-0.5">{hint}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-card border border-grey-mid shadow-card overflow-hidden">
      <div className="px-4 py-2 border-b border-grey-mid">
        <h2 className="text-[12px] font-semibold text-surface-dark uppercase tracking-wider">{title}</h2>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function ContactRow({
  icon, value, multiline,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className={cn("flex gap-2 text-[12px] text-grey", multiline ? "items-start" : "items-center")}>
      <span className="text-grey shrink-0 mt-px">{icon}</span>
      <span className="min-w-0">{value}</span>
    </div>
  );
}

function TermRow({
  label, value, multiline, tone = "default",
}: {
  label: string;
  value: string;
  multiline?: boolean;
  tone?: "default" | "red";
}) {
  return (
    <div className="px-5 py-2 flex items-start gap-4">
      <dt className="text-[11px] font-semibold text-grey uppercase tracking-wide w-24 shrink-0 mt-0.5">{label}</dt>
      <dd className={cn(
        "text-[13px] flex-1",
        tone === "red" ? "text-status-red font-medium" : "text-surface-dark",
        multiline ? "whitespace-pre-wrap" : ""
      )}>
        {value}
      </dd>
    </div>
  );
}
