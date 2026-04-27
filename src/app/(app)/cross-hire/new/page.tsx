"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/shared/AppTopbar";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import Link from "next/link";
import { Search, X, Plus, AlertTriangle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface HireCustomerResult {
  id:             string;
  productionName: string;
  vatNumber:      string | null;
  contactName:    string | null;
  contactEmail:   string | null;
  contactPhone:   string | null;
  addressLine1:   string | null;
  addressLine2:   string | null;
  city:           string | null;
  county:         string | null;
  postcode:       string | null;
  country:        string | null;
}

interface BatchItem {
  equipmentId: string;
  serial:      string;
  name:        string;
  category:    string;
}

interface RateGroup {
  name:              string;
  dailyRate:         string;
  weeklyDiscount:    string;
  notes:             string;
  saveAsDefault:     boolean;
  originalDailyRate: string;
}

type TermUnit = "days" | "weeks" | "months";

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 border border-grey-mid rounded-btn text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20";

const UNIT_TO_DAYS: Record<TermUnit, number> = { days: 1, weeks: 7, months: 30 };

function unitToDays(value: number, unit: TermUnit): number {
  return Math.max(1, Math.round(value * UNIT_TO_DAYS[unit]));
}

const STATUS_DISPLAY: Record<string, string> = {
  available: "Available",
  cross_hired: "On Hire",
  checked_out: "Checked Out",
  damaged: "Damaged",
  archived: "Archived",
};

function getStatusDisplay(status: string): string {
  return STATUS_DISPLAY[status] || status;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NewCrossHirePage() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const utils  = trpc.useUtils();

  // Customer state
  const [customerSearch, setCustomerSearch]           = useState("");
  const [selectedCustomer, setSelectedCustomer]       = useState<HireCustomerResult | null>(null);
  const [showDropdown, setShowDropdown]               = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    productionName: "", vatNumber: "", contactName: "", contactEmail: "", contactPhone: "",
    addressLine1: "", addressLine2: "", city: "", county: "", country: "", postcode: "",
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Terms state
  const [startDate, setStartDate]   = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate,   setEndDate]     = useState("");
  const [termValue, setTermValue]   = useState<string>("");
  const [termUnit,  setTermUnit]    = useState<TermUnit>("days");
  const [notes,     setNotes]       = useState("");

  // Batch state — items and per-product-name rates
  const [batch,      setBatch]      = useState<BatchItem[]>([]);
  const [rateGroups, setRateGroups] = useState<Record<string, RateGroup>>({});
  const [scanInput,  setScanInput]  = useState("");
  const [scanError,  setScanError]  = useState<string | null>(null);
  const [scanning,   setScanning]   = useState(false);
  const scanRef = useRef<HTMLInputElement>(null);

  // Submit state
  const [submitError, setSubmitError] = useState<string | null>(null);

  // tRPC
  const searchCustomers = trpc.crossHire["hireCustomer.search"].useQuery(
    { workspaceId, query: customerSearch },
    { enabled: customerSearch.length >= 1 }
  );
  const upsertCustomer = trpc.crossHire["hireCustomer.upsert"].useMutation();
  const createEvent    = trpc.crossHire["crossHire.create"].useMutation({
    onSuccess: (data) => router.push(`/cross-hire/${data.id}`),
    onError:   (err)  => setSubmitError(err.message),
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Serial scan — auto-fires at 5 digits ─────────────────────────────────

  const handleScan = useCallback(async (serial: string) => {
    const s = serial.trim().toUpperCase();
    if (!/^\d{5}$/.test(s)) return;
    setScanError(null);
    setScanning(true);

    if (batch.some((b) => b.serial === s)) {
      setScanError(`${s} is already in the batch.`);
      setScanInput("");
      setScanning(false);
      return;
    }

    try {
      const result = await utils.equipment.list.fetch({ workspaceId, search: s, limit: 1 });
      const match  = result?.items?.find((i: { serial: string }) => i.serial === s);

      if (!match) {
        setScanError(`${s} not found in this workspace.`);
        setScanInput("");
        setScanning(false);
        return;
      }
      if (match.status !== "available") {
        setScanError(`${s} — ${match.name} is not available (${getStatusDisplay(match.status)}).`);
        setScanInput("");
        setScanning(false);
        return;
      }

      const name = match.name as string;
      setBatch((prev) => [...prev, {
        equipmentId: match.id as string,
        serial:      s,
        name,
        category:    (match.category as { name: string } | null)?.name ?? "Uncategorised",
      }]);

      // Ensure a rate group exists for this product name
      setRateGroups((prev) => {
        if (prev[name]) return prev;
        const daily = match.product?.defaultDailyHireRate ? String(match.product.defaultDailyHireRate) : "";
        const weekly = match.product?.defaultWeeklyHireRate ? String(match.product.defaultWeeklyHireRate) : "";
        return { ...prev, [name]: { name, dailyRate: daily, weeklyDiscount: weekly, notes: "", saveAsDefault: false, originalDailyRate: daily } };
      });
    } catch {
      setScanError("Error looking up serial. Please try again.");
    }

    setScanInput("");
    setScanning(false);
    scanRef.current?.focus();
  }, [batch, workspaceId, utils.equipment.list]);

  function handleScanInputChange(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 5);
    setScanInput(digits);
    if (digits.length === 5) void handleScan(digits);
  }

  // Remove item — clean up rate group if no more items with that name
  function removeItem(serial: string) {
    setBatch((prev) => {
      const next = prev.filter((b) => b.serial !== serial);
      const removed = prev.find((b) => b.serial === serial);
      if (removed && !next.some((b) => b.name === removed.name)) {
        setRateGroups((rg) => {
          const updated = { ...rg };
          delete updated[removed.name];
          return updated;
        });
      }
      return next;
    });
  }

  // ── Save new customer ─────────────────────────────────────────────────────

  async function handleSaveNewCustomer() {
    if (!newCustomer.productionName.trim()) return;
    setSavingCustomer(true);
    try {
      const created = await upsertCustomer.mutateAsync({
        workspaceId,
        productionName: newCustomer.productionName,
        vatNumber:      newCustomer.vatNumber      || undefined,
        contactName:    newCustomer.contactName    || undefined,
        contactEmail:   newCustomer.contactEmail   || undefined,
        contactPhone:   newCustomer.contactPhone   || undefined,
        addressLine1:   newCustomer.addressLine1   || undefined,
        addressLine2:   newCustomer.addressLine2   || undefined,
        city:           newCustomer.city           || undefined,
        county:         newCustomer.county         || undefined,
        country:        newCustomer.country        || undefined,
        postcode:       newCustomer.postcode       || undefined,
      });
      setSelectedCustomer(created as HireCustomerResult);
      setShowNewCustomerForm(false);
      setCustomerSearch("");
      setNewCustomer({
        productionName: "", vatNumber: "", contactName: "", contactEmail: "", contactPhone: "",
        addressLine1: "", addressLine2: "", city: "", county: "", country: "", postcode: "",
      });
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setSavingCustomer(false);
    }
  }

  // ── Derived: total days and per-group totals ─────────────────────────────

  const totalDays = useMemo<number | null>(() => {
    if (endDate && startDate) {
      const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
      if (ms <= 0) return null;
      return Math.max(1, Math.ceil(ms / 86400000));
    }
    const n = parseInt(termValue, 10);
    if (!Number.isFinite(n) || n <= 0) return null;
    return unitToDays(n, termUnit);
  }, [startDate, endDate, termValue, termUnit]);

  const termsLabel = useMemo<string>(() => {
    if (endDate) return `${totalDays ?? 0} day${totalDays === 1 ? "" : "s"}`;
    const n = parseInt(termValue, 10);
    if (!Number.isFinite(n) || n <= 0) return "";
    const unitLabel = n === 1 ? termUnit.replace(/s$/, "") : termUnit;
    return `${n} ${unitLabel}`;
  }, [startDate, endDate, termValue, termUnit, totalDays]);

  const productGroups = Array.from(new Set(batch.map((b) => b.name)));

  function subtotalForGroup(name: string): number {
    const group = rateGroups[name];
    if (!group || !totalDays) return 0;
    const daily = parseFloat(group.dailyRate);
    if (!Number.isFinite(daily)) return 0;
    const count = batch.filter((b) => b.name === name).length;
    let subtotal = count * daily * totalDays;
    if (totalDays >= 7 && group.weeklyDiscount) {
      const discount = parseFloat(group.weeklyDiscount);
      if (Number.isFinite(discount) && discount > 0) {
        subtotal = subtotal * (1 - discount / 100);
      }
    }
    return subtotal;
  }

  const grandTotal = productGroups.reduce((sum, name) => sum + subtotalForGroup(name), 0);

  // ── Submit ────────────────────────────────────────────────────────────────

  function handleSubmit() {
    setSubmitError(null);
    if (!selectedCustomer)  return setSubmitError("Please select or create a customer.");
    if (batch.length === 0) return setSubmitError("Please add at least one item.");
    if (!totalDays)         return setSubmitError("Enter an end date or a duration.");

    const missingRate = Object.values(rateGroups).find((g) => !g.dailyRate || isNaN(parseFloat(g.dailyRate)));
    if (missingRate) return setSubmitError(`Missing daily rate for: ${missingRate.name}`);

    const usingEndDate = !!endDate;
    const parsedTermValue = parseInt(termValue, 10);

    createEvent.mutate({
      workspaceId,
      hireCustomerId: selectedCustomer.id,
      termsOfHire:    termsLabel || `${totalDays} days`,
      termValue:      !usingEndDate && Number.isFinite(parsedTermValue) ? parsedTermValue : undefined,
      termUnit:       !usingEndDate ? termUnit : undefined,
      totalDays,
      startDate,
      endDate: endDate || undefined,
      notes:   notes   || undefined,
      equipmentItems: batch.map((item) => {
        const group = rateGroups[item.name]!;
        const weeklyDiscountNum = group.weeklyDiscount ? parseFloat(group.weeklyDiscount) : undefined;
        return {
          equipmentId:       item.equipmentId,
          dailyRate:         group.dailyRate,
          weeklyDiscount:    Number.isFinite(weeklyDiscountNum) ? weeklyDiscountNum : undefined,
          notes:             group.notes      || undefined,
          saveAsDefaultRate: group.saveAsDefault || undefined,
        };
      }),
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AppTopbar
        title="New Cross Hire"
        actions={
          <Link href="/cross-hire">
            <Button size="sm">
              All Cross Hires
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {/* ── 1. Customer ─────────────────────────────────────────── */}
          <section className="bg-white rounded-card border border-grey-mid p-6 space-y-4">
            <h2 className="text-[14px] font-semibold text-surface-dark">1. Customer</h2>

            {selectedCustomer ? (
              <div className="flex items-start justify-between gap-4 border border-grey-mid rounded-btn px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-surface-dark">{selectedCustomer.productionName}</p>
                  {selectedCustomer.vatNumber    && <p className="text-[11px] text-grey mt-0.5">VAT: {selectedCustomer.vatNumber}</p>}
                  {selectedCustomer.contactName  && <p className="text-[12px] text-grey mt-0.5">{selectedCustomer.contactName}</p>}
                  {selectedCustomer.contactEmail && <p className="text-[12px] text-grey">{selectedCustomer.contactEmail}</p>}
                  {selectedCustomer.contactPhone && <p className="text-[12px] text-grey">{selectedCustomer.contactPhone}</p>}
                  {(selectedCustomer.addressLine1 || selectedCustomer.city || selectedCustomer.postcode) && (
                    <p className="text-[12px] text-grey mt-0.5">
                      {[
                        selectedCustomer.addressLine1,
                        selectedCustomer.addressLine2,
                        selectedCustomer.city,
                        selectedCustomer.county,
                        selectedCustomer.postcode,
                        selectedCustomer.country,
                      ].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
                <button onClick={() => setSelectedCustomer(null)} className="text-grey hover:text-status-red flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {!showNewCustomerForm && (
                  <div className="relative" ref={dropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-grey" />
                      <input
                        type="text"
                        placeholder="Search production or company name…"
                        value={customerSearch}
                        onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true); }}
                        onFocus={() => customerSearch.length >= 1 && setShowDropdown(true)}
                        className="w-full pl-9 pr-4 py-2 border border-grey-mid rounded-btn text-[13px] focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                      />
                    </div>
                    {showDropdown && customerSearch.length >= 1 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-grey-mid rounded-lg shadow-lg overflow-hidden">
                        {searchCustomers.isLoading ? (
                          <div className="p-3 text-[13px] text-grey text-center">Searching…</div>
                        ) : !searchCustomers.data || searchCustomers.data.length === 0 ? (
                          <div className="p-3 text-[13px] text-grey text-center">No results.</div>
                        ) : (
                          searchCustomers.data.map((c) => (
                            <button key={c.id}
                              className="w-full text-left px-4 py-2.5 hover:bg-grey-light/50 border-b border-grey-mid last:border-0"
                              onClick={() => { setSelectedCustomer(c as HireCustomerResult); setCustomerSearch(""); setShowDropdown(false); }}
                            >
                              <p className="text-[13px] font-medium text-surface-dark">{c.productionName}</p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowNewCustomerForm((v) => !v)}
                  className="flex items-center gap-1.5 text-[12px] text-brand-blue hover:text-brand-dark font-medium"
                >
                  {showNewCustomerForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {showNewCustomerForm ? "Cancel" : "Add new customer"}
                </button>

                {showNewCustomerForm && (
                  <div className="border border-grey-mid rounded-lg p-4 space-y-3">
                    <p className="text-[12px] font-semibold text-surface-dark">New Customer</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-grey mb-1">Production / Company Name <span className="text-status-red">*</span></label>
                        <input type="text" value={newCustomer.productionName}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, productionName: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-grey mb-1">VAT Number</label>
                        <input type="text" value={newCustomer.vatNumber}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, vatNumber: e.target.value }))}
                          placeholder="e.g. GB123456789"
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-grey mb-1">Contact Name</label>
                        <input type="text" value={newCustomer.contactName}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, contactName: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-grey mb-1">Contact Phone</label>
                        <input type="tel" value={newCustomer.contactPhone}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, contactPhone: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-grey mb-1">Contact Email</label>
                        <input type="email" value={newCustomer.contactEmail}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, contactEmail: e.target.value }))}
                          className={inputCls} />
                      </div>

                      {/* Address — all optional */}
                      <div className="col-span-2 pt-1">
                        <p className="text-[11px] font-semibold text-grey uppercase tracking-wider">Address (optional)</p>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-grey mb-1">Address Line 1</label>
                        <input type="text" value={newCustomer.addressLine1}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, addressLine1: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[11px] font-medium text-grey mb-1">Address Line 2</label>
                        <input type="text" value={newCustomer.addressLine2}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, addressLine2: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-grey mb-1">Town / City</label>
                        <input type="text" value={newCustomer.city}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, city: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-grey mb-1">County</label>
                        <input type="text" value={newCustomer.county}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, county: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-grey mb-1">Country</label>
                        <input type="text" value={newCustomer.country}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, country: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-grey mb-1">Postcode</label>
                        <input type="text" value={newCustomer.postcode}
                          onChange={(e) => setNewCustomer((p) => ({ ...p, postcode: e.target.value }))}
                          className={inputCls} />
                      </div>
                    </div>
                    <Button size="sm" disabled={!newCustomer.productionName.trim() || savingCustomer}
                      onClick={() => void handleSaveNewCustomer()}>
                      {savingCustomer ? "Saving…" : "Save Customer"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── 2. Hire Terms ───────────────────────────────────────── */}
          <section className="bg-white rounded-card border border-grey-mid p-6 space-y-4">
            <h2 className="text-[14px] font-semibold text-surface-dark">2. Hire Terms</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-grey mb-1">Start Date <span className="text-status-red">*</span></label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-grey mb-1">End Date (optional)</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
              </div>

              {/* Manual duration — only when no end date */}
              {!endDate && (
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-grey mb-1">
                    Duration <span className="text-status-red">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={termValue}
                      onChange={(e) => setTermValue(e.target.value.replace(/\D/g, ""))}
                      placeholder="e.g. 7"
                      className={`${inputCls} flex-1 min-w-0`}
                    />
                    <select
                      value={termUnit}
                      onChange={(e) => setTermUnit(e.target.value as TermUnit)}
                      className={`${inputCls} !w-32 flex-shrink-0`}
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>
                  <p className="text-[11px] text-grey mt-1">Weeks count as 7 days, months as 30 days.</p>
                </div>
              )}

              {/* Total Days — read-only summary */}
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-grey mb-1">Total Days</label>
                <div className={`${inputCls} bg-grey-light/40 cursor-default flex items-center justify-between`}>
                  <span className={totalDays ? "text-surface-dark font-semibold" : "text-grey"}>
                    {totalDays ? `${totalDays} day${totalDays === 1 ? "" : "s"}` : "—"}
                  </span>
                  {termsLabel && <span className="text-[11px] text-grey">{termsLabel}</span>}
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-grey mb-1">Internal Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                  placeholder="Not shown on hire agreement or invoice"
                  className={`${inputCls} resize-none`} />
              </div>
            </div>
          </section>

          {/* ── 3. Equipment ────────────────────────────────────────── */}
          <section className="bg-white rounded-card border border-grey-mid p-6 space-y-4">
            <h2 className="text-[14px] font-semibold text-surface-dark">3. Equipment</h2>

            {/* Scan input */}
            <div>
              <label className="block text-[11px] font-medium text-grey uppercase tracking-wider mb-1.5">Enter Serial</label>
              <div className="relative">
                <input
                  ref={scanRef}
                  type="text"
                  inputMode="numeric"
                  placeholder="Type or scan serial (5 digits)…"
                  value={scanInput}
                  onChange={(e) => handleScanInputChange(e.target.value)}
                  disabled={scanning}
                  className="w-full border border-grey-mid rounded-btn px-3 py-2 text-[13px] text-surface-dark focus:outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                />
                {scanInput.length > 0 && scanInput.length < 5 && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-grey">
                    {5 - scanInput.length} more
                  </span>
                )}
                {scanning && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-grey">Looking up…</span>
                )}
              </div>
            </div>

            {scanError && (
              <div className="flex items-center gap-2 text-[12px] text-status-red bg-red-50 border border-red-200 rounded-md px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{scanError}
              </div>
            )}

            {/* Scanned items list */}
            {batch.length === 0 ? (
              <div className="text-center py-8 text-[13px] text-grey border-2 border-dashed border-grey-mid rounded-lg">
                No items yet — scan or type a serial above.
              </div>
            ) : (
              <div className="divide-y divide-grey-mid border border-grey-mid rounded-lg overflow-hidden">
                {batch.map((item) => (
                  <div key={item.equipmentId} className="flex items-center gap-3 px-4 py-3">
                    <span className="font-mono text-[13px] font-semibold text-surface-dark w-16 flex-shrink-0">{item.serial}</span>
                    <span className="text-[13px] text-surface-dark flex-1">{item.name}</span>
                    <span className="text-[11px] bg-grey-light px-2 py-0.5 rounded-full text-grey font-medium flex-shrink-0">{item.category}</span>
                    <button onClick={() => removeItem(item.serial)} className="text-grey hover:text-status-red flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Rate groups — one per unique product name */}
            {productGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-grey uppercase tracking-wider">Hire Rates</p>
                <p className="text-[11px] text-grey -mt-2">Set the rate once per item type — applies to all items with that name.</p>
                {productGroups.map((name) => {
                  const group = rateGroups[name]!;
                  const count = batch.filter((b) => b.name === name).length;
                  const dailyNum    = parseFloat(group.dailyRate);
                  const dailyValid  = Number.isFinite(dailyNum) && dailyNum > 0;
                  const rateChanged = group.dailyRate !== group.originalDailyRate;
                  const subtotal    = subtotalForGroup(name);
                  return (
                    <div key={name} className="border border-grey-mid rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold text-surface-dark">{name}</p>
                        <span className="text-[11px] text-grey">{count} item{count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-grey mb-1">Daily Rate (£) <span className="text-status-red">*</span></label>
                          <input type="number" min="0" step="0.01" value={group.dailyRate}
                            onChange={(e) => setRateGroups((rg) => ({ ...rg, [name]: { ...rg[name]!, dailyRate: e.target.value } }))}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-grey mb-1">Weekly Discount (%)</label>
                          <input type="number" min="0" max="100" step="0.01" value={group.weeklyDiscount}
                            onChange={(e) => setRateGroups((rg) => ({ ...rg, [name]: { ...rg[name]!, weeklyDiscount: e.target.value } }))}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-grey mb-1">Notes</label>
                          <input type="text" value={group.notes}
                            onChange={(e) => setRateGroups((rg) => ({ ...rg, [name]: { ...rg[name]!, notes: e.target.value } }))}
                            className={inputCls} />
                        </div>
                      </div>

                      {/* Save-as-default prompt — only if rate was changed from saved value */}
                      {dailyValid && rateChanged && (
                        <label className="flex items-start gap-2 text-[12px] text-surface-dark cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={group.saveAsDefault}
                            onChange={(e) => setRateGroups((rg) => ({ ...rg, [name]: { ...rg[name]!, saveAsDefault: e.target.checked } }))}
                            className="mt-0.5"
                          />
                          <span>
                            Save this as the rental rate for <span className="font-semibold">{name}</span>.
                            <span className="text-grey"> You can change this anytime in Rental Rates.</span>
                          </span>
                        </label>
                      )}

                      {/* Subtotal */}
                      <div className="space-y-1.5 pt-2 border-t border-grey-mid/60">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-grey">
                            {dailyValid && totalDays
                              ? `${count} × £${dailyNum.toFixed(2)}/day × ${totalDays} day${totalDays === 1 ? "" : "s"}`
                              : "Enter a daily rate and duration to see the subtotal"}
                          </span>
                          <span className={`text-[13px] font-semibold ${subtotal > 0 ? "text-surface-dark" : "text-grey"}`}>
                            £{subtotal.toFixed(2)}
                          </span>
                        </div>
                        {totalDays && totalDays >= 7 && group.weeklyDiscount && Number(group.weeklyDiscount) > 0 && (
                          <div className="text-[10px] text-status-green font-medium">
                            7+ day hire — {Number(group.weeklyDiscount).toFixed(1)}% weekly discount applied
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ── Sticky bottom bar ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-[240px] bg-white border-t border-grey-mid px-6 py-4 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-medium text-surface-dark">{batch.length} item{batch.length !== 1 ? "s" : ""}</span>
            {batch.length > 0 && (
              <span className="text-[13px] text-grey">
                {totalDays
                  ? <>Grand total <span className="font-semibold text-surface-dark">£{grandTotal.toFixed(2)}</span> ({totalDays} day{totalDays === 1 ? "" : "s"})</>
                  : "Set a duration to see total"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {submitError && <p className="text-[12px] text-status-red max-w-xs truncate">{submitError}</p>}
            <Button variant="secondary" size="sm" onClick={() => {
              setBatch([]); setRateGroups({}); setSelectedCustomer(null);
              setNotes(""); setEndDate(""); setTermValue(""); setTermUnit("days");
              setStartDate(new Date().toISOString().slice(0, 10));
            }}>Clear</Button>
            <Button size="sm" disabled={createEvent.isPending} onClick={handleSubmit}>
              {createEvent.isPending ? "Creating…" : "Create Cross Hire"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
