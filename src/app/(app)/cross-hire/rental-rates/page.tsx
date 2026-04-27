"use client";

import { useState } from "react";
import Link from "next/link";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import { ArrowLeft, History, Pencil, Trash2, X } from "lucide-react";

const inputCls = "w-full px-3 py-2 border border-grey-mid rounded-btn text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

function formatRate(v: string | null): string {
  if (!v) return "—";
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return "—";
  return `£${n.toFixed(2)}`;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

interface EditState {
  productId:     string;
  name:          string;
  dailyRate:     string;
  weeklyDiscount: string;
}

export default function RentalRatesPage() {
  const { workspaceId } = useWorkspace();
  const utils = trpc.useUtils();

  const [historyProductId, setHistoryProductId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [confirmClearId, setConfirmClearId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: rows, isLoading } = trpc.product.listRates.useQuery({ workspaceId });

  const setRates = trpc.product.setRates.useMutation({
    onSuccess: () => {
      void utils.product.listRates.invalidate();
      if (historyProductId) void utils.product.rateHistory.invalidate();
      setEditing(null);
      setError(null);
    },
    onError: (err) => setError(err.message),
  });

  const clearRates = trpc.product.clearRates.useMutation({
    onSuccess: () => {
      void utils.product.listRates.invalidate();
      setConfirmClearId(null);
    },
    onError: (err) => setError(err.message),
  });

  const history = trpc.product.rateHistory.useQuery(
    { workspaceId, productId: historyProductId ?? "" },
    { enabled: !!historyProductId },
  );

  function startEdit(row: { id: string; name: string; defaultDailyHireRate: string | null; defaultWeeklyDiscountPercentage: string | null }) {
    setEditing({
      productId:      row.id,
      name:           row.name,
      dailyRate:      row.defaultDailyHireRate ?? "",
      weeklyDiscount: row.defaultWeeklyDiscountPercentage ?? "",
    });
    setError(null);
  }

  function saveEdit() {
    if (!editing) return;
    if (!editing.dailyRate || !/^\d+(\.\d{1,2})?$/.test(editing.dailyRate)) {
      setError("Daily rate is required (e.g. 50 or 50.00).");
      return;
    }
    if (editing.weeklyDiscount && !/^\d+(\.\d{1,2})?$/.test(editing.weeklyDiscount)) {
      setError("Invalid weekly discount (0-100%).");
      return;
    }
    const discount = editing.weeklyDiscount ? parseFloat(editing.weeklyDiscount) : null;
    if (discount !== null && (discount < 0 || discount > 100)) {
      setError("Weekly discount must be between 0 and 100.");
      return;
    }
    setRates.mutate({
      workspaceId,
      productId:      editing.productId,
      dailyRate:      editing.dailyRate,
      weeklyDiscount: discount,
    });
  }

  return (
    <>
      <AppTopbar
        title="Rental Rates"
        actions={
          <Link href="/cross-hire">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Cross Hire
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="bg-white rounded-card border border-grey-mid p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[14px] font-semibold text-surface-dark">Saved Rental Rates</h2>
              <p className="text-[12px] text-grey mt-0.5">
                Defaults applied when adding equipment to a cross hire. Edit or clear at any time.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-[13px] text-grey">Loading…</div>
          ) : !rows || rows.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-[14px] font-medium text-surface-dark mb-1">No products yet</p>
              <p className="text-[12px] text-grey">Add equipment first, or save a rate during a cross hire to populate this list.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-grey-mid bg-grey-light/50">
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Product</th>
                    <th className="text-left  px-4 py-3 font-semibold text-surface-dark">Category</th>
                    <th className="text-right px-4 py-3 font-semibold text-surface-dark">Daily Rate</th>
                    <th className="text-right px-4 py-3 font-semibold text-surface-dark">Weekly Discount</th>
                    <th className="text-right px-4 py-3 font-semibold text-surface-dark">Items</th>
                    <th className="text-right px-4 py-3 font-semibold text-surface-dark">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-grey-mid">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-grey-light/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-surface-dark">{row.name}</td>
                      <td className="px-4 py-3 text-grey">{row.categoryName ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-surface-dark">{formatRate(row.defaultDailyHireRate)}</td>
                      <td className="px-4 py-3 text-right text-surface-dark">{row.defaultWeeklyDiscountPercentage ? `${Number(row.defaultWeeklyDiscountPercentage).toFixed(1)}%` : "—"}</td>
                      <td className="px-4 py-3 text-right text-grey">{row.equipmentCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]"
                            onClick={() => setHistoryProductId(row.id)}>
                            <History className="h-3.5 w-3.5 mr-1" />
                            History ({row.rateHistoryCount})
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px]"
                            onClick={() => startEdit(row)}>
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                          {row.defaultDailyHireRate && (
                            <Button variant="ghost" size="sm"
                              className="h-7 px-2 text-[12px] text-status-red hover:bg-red-50"
                              onClick={() => setConfirmClearId(row.id)}>
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Clear
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit modal ──────────────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-card border border-grey-mid shadow-lg w-full max-w-md p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-surface-dark">Edit Rental Rate</h3>
                <p className="text-[12px] text-grey mt-0.5">{editing.name}</p>
              </div>
              <button onClick={() => { setEditing(null); setError(null); }} className="text-grey hover:text-status-red">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-grey mb-1">Daily Rate (£) <span className="text-status-red">*</span></label>
                <input type="number" min="0" step="0.01" value={editing.dailyRate}
                  onChange={(e) => setEditing((s) => s ? { ...s, dailyRate: e.target.value } : s)}
                  className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-grey mb-1">Weekly Discount (%)</label>
                <input type="number" min="0" max="100" step="0.01" value={editing.weeklyDiscount}
                  onChange={(e) => setEditing((s) => s ? { ...s, weeklyDiscount: e.target.value } : s)}
                  className={inputCls} />
              </div>
            </div>
            {error && <p className="text-[12px] text-status-red">{error}</p>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => { setEditing(null); setError(null); }}>
                Cancel
              </Button>
              <Button size="sm" disabled={setRates.isPending} onClick={saveEdit}>
                {setRates.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History drawer ──────────────────────────────────────────────── */}
      {historyProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-card border border-grey-mid shadow-lg w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-[14px] font-semibold text-surface-dark">Rate History</h3>
              <button onClick={() => setHistoryProductId(null)} className="text-grey hover:text-status-red">
                <X className="h-4 w-4" />
              </button>
            </div>
            {history.isLoading ? (
              <div className="p-8 text-center text-[13px] text-grey">Loading…</div>
            ) : !history.data || history.data.length === 0 ? (
              <p className="text-[13px] text-grey py-4">No history recorded for this product yet.</p>
            ) : (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-grey-mid bg-grey-light/50">
                      <th className="text-left  px-3 py-2 font-semibold text-surface-dark">Recorded</th>
                      <th className="text-right px-3 py-2 font-semibold text-surface-dark">Daily</th>
                      <th className="text-right px-3 py-2 font-semibold text-surface-dark">Weekly Discount</th>
                      <th className="text-left  px-3 py-2 font-semibold text-surface-dark">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-mid">
                    {history.data.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 text-grey">{formatDate(row.recordedAt)}</td>
                        <td className="px-3 py-2 text-right text-surface-dark">£{Number(row.dailyRate).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right text-surface-dark">{row.weeklyDiscount ? `${Number(row.weeklyDiscount).toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-2 text-grey">
                          {row.source === "cross_hire" ? "Cross hire" : "Manual"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Clear confirm ───────────────────────────────────────────────── */}
      {confirmClearId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-card border border-grey-mid shadow-lg w-full max-w-md p-6 space-y-4">
            <h3 className="text-[14px] font-semibold text-surface-dark">Clear rental rate?</h3>
            <p className="text-[13px] text-grey">
              The default rate will be removed but the rate history is kept.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmClearId(null)}>Cancel</Button>
              <Button size="sm" disabled={clearRates.isPending}
                onClick={() => clearRates.mutate({ workspaceId, productId: confirmClearId })}>
                {clearRates.isPending ? "Clearing…" : "Clear rate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
