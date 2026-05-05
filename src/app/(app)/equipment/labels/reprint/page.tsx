"use client";

/**
 * QR Label Print page — Sprint 4
 *
 * Route: /equipment/labels?ids=id1,id2,id3
 *
 * Generates a print-optimised grid of QR sticker labels.
 * Each label: QR code (encoding the serial), serial number, equipment name.
 * Print CSS: 4-up per A4 page, no browser headers/footers.
 *
 * Equipment fetched via trpc.equipment.get for each ID.
 * QR codes generated client-side with the `qrcode` package.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/lib/workspace-context";
import QRCode from "qrcode";

// ── Label data shape ──────────────────────────────────────────────────────

interface LabelData {
  id:     string;
  serial: string;
  name:   string;
  qrUrl:  string; // data URL from qrcode
}

// ── QR generation ─────────────────────────────────────────────────────────

async function generateQR(serial: string): Promise<string> {
  return QRCode.toDataURL(serial, {
    width:         200,
    margin:        1,
    color: {
      dark:  "#0F172A",
      light: "#FFFFFF",
    },
  });
}

// ── Component ─────────────────────────────────────────────────────────────

export default function LabelsPage() {
  const { workspaceId } = useWorkspace();
  const searchParams   = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);

  const [labels,  setLabels]  = useState<LabelData[]>([]);
  const [loading, setLoading] = useState(true);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (ids.length === 0) { setLoading(false); return; }

    async function buildLabels() {
      const results: LabelData[] = [];
      for (const id of ids) {
        try {
          const eq = await utils.equipment.get.fetch({ workspaceId, equipmentId: id });
          const qrUrl = await generateQR(eq.serial);
          results.push({ id: eq.id, serial: eq.serial, name: eq.name, qrUrl });
        } catch {
          // skip items that can't be fetched
        }
      }
      setLabels(results);
      setLoading(false);
    }

    void buildLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-grey">
        Generating labels…
      </div>
    );
  }

  if (labels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 text-grey">
        <p>No equipment found for the provided IDs.</p>
        <Button variant="secondary" size="sm" onClick={() => window.history.back()}>← Back</Button>
      </div>
    );
  }

  return (
    <>
      {/* Print action bar — hidden when printing */}
      <div className="print:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-grey-mid px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-surface-dark">QR Labels</h1>
          <p className="text-[12px] text-grey">{labels.length} label{labels.length !== 1 ? "s" : ""} — 4 per A4 page</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => window.history.back()}>← Back</Button>
          <Button variant="primary" size="sm" onClick={() => window.print()}>🖨 Print</Button>
        </div>
      </div>

      {/* Print styles — injected inline */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          .label-grid { padding-top: 0 !important; }
        }
      `}</style>

      {/* Label grid */}
      <div className="label-grid pt-16 print:pt-0 p-8 print:p-0">
        <div className="grid grid-cols-2 print:grid-cols-2 gap-4 print:gap-[6mm]">
          {labels.map((label) => (
            <QRLabel key={label.id} label={label} />
          ))}
        </div>
      </div>
    </>
  );
}

// ── QR label card ─────────────────────────────────────────────────────────

function QRLabel({ label }: { label: LabelData }) {
  return (
    <div
      className="bg-white border-2 border-surface-dark rounded-[8px] p-4 flex flex-col items-center text-center print:break-inside-avoid"
      style={{ minHeight: "140px" }}
    >
      {/* QR code */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={label.qrUrl}
        alt={`QR code for ${label.serial}`}
        className="w-24 h-24 print:w-[50mm] print:h-[50mm]"
      />

      {/* Serial */}
      <p className="text-serial text-surface-dark text-[16px] mt-2 tracking-[0.2em]">
        {label.serial}
      </p>

      {/* Equipment name — truncated */}
      <p className="text-[11px] text-grey mt-0.5 leading-tight line-clamp-2 max-w-[160px]">
        {label.name}
      </p>

      {/* LogiTrak watermark */}
      <p className="text-[9px] text-grey/50 mt-2 tracking-wide">
        LogiTrak
      </p>
    </div>
  );
}
