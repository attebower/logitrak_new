/**
 * POST /api/labels/generate
 *
 * Body: { batchId: string }
 *
 * Looks up the reserved batch, generates the correct file format, returns
 * a binary download (PDF, ZPL, or ZIP depending on printer + output choice).
 *
 * The client has already called `labels.reserveBatch` which burnt the
 * serials. This route is pure generation — never reserves.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import { generateLabelPdf } from "@/lib/labels/pdf";
import { buildDymoLabel, buildSerialsCsv, buildDymoReadme } from "@/lib/labels/dymo";
import { buildBrotherLbx, buildBrotherReadme } from "@/lib/labels/brother";
import { buildZpl } from "@/lib/labels/zpl";
import { getPrinter, getLabelSize, type PrinterType, type LabelDesign, type CodeType } from "@/lib/labels/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asciiFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, "_");
}

function contentDispositionHeader(filename: string): string {
  const ascii = asciiFilename(filename);
  const utf8 = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // 2. Parse body
    const body = (await req.json()) as { batchId?: string; outputFormat?: "native" | "pdf" };
    const { batchId, outputFormat = "native" } = body;
    if (!batchId) return NextResponse.json({ error: "batchId required" }, { status: 400 });

    // 3. Lookup batch + verify workspace membership
    const batch = await prisma.labelBatch.findUnique({
      where: { id: batchId },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!batch) return NextResponse.json({ error: "batch not found" }, { status: 404 });

    const membership = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId: batch.workspaceId, userId: user.id } },
      select: { isActive: true },
    });
    if (!membership?.isActive) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    // 4. Resolve printer + size
    const printer = getPrinter(batch.printerType as PrinterType);
    const size = getLabelSize(batch.printerType as PrinterType, batch.labelSize);
    if (!printer || !size) return NextResponse.json({ error: "invalid printer config" }, { status: 400 });

    const commonArgs = {
      serialStart: batch.serialStart,
      serialEnd: batch.serialEnd,
      design: batch.design as LabelDesign,
      codeType: batch.codeType as CodeType,
      orgName: batch.workspace.name,
      size,
    };

    // 5. Honour the output choice. "pdf" always wins when asked.
    if (outputFormat === "pdf") {
      const pdfBytes = await generateLabelPdf(commonArgs);
      const filename = `logitrak-labels-${pad(batch.serialStart)}-${pad(batch.serialEnd)}.pdf`;
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": contentDispositionHeader(filename),
        },
      });
    }

    // 6. Native output per printer family
    if (printer.outputFormat === "zpl") {
      const zpl = buildZpl(commonArgs);
      const filename = `logitrak-labels-${pad(batch.serialStart)}-${pad(batch.serialEnd)}.zpl`;
      return new NextResponse(zpl, {
        headers: {
          "Content-Type": "application/zpl",
          "Content-Disposition": contentDispositionHeader(filename),
        },
      });
    }

    if (printer.outputFormat === "dymo_xml") {
      const zip = new JSZip();
      zip.file("labels.dymo", buildDymoLabel(commonArgs));
      zip.file("serials.csv", buildSerialsCsv({
        serialStart: batch.serialStart,
        serialEnd: batch.serialEnd,
        orgName: batch.workspace.name,
      }));
      zip.file("README.txt", buildDymoReadme(batch.id, batch.serialStart, batch.serialEnd));
      const buf = await zip.generateAsync({ type: "uint8array" });
      const filename = `logitrak-dymo-${pad(batch.serialStart)}-${pad(batch.serialEnd)}.zip`;
      return new NextResponse(Buffer.from(buf), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": contentDispositionHeader(filename),
        },
      });
    }

    if (batch.printerType === "brother_ql" || batch.printerType === "brother_pt") {
      const lbx = await buildBrotherLbx(commonArgs);
      const zip = new JSZip();
      zip.file("labels.lbx", lbx);
      zip.file("serials.csv", buildSerialsCsv({
        serialStart: batch.serialStart,
        serialEnd: batch.serialEnd,
        orgName: batch.workspace.name,
      }));
      zip.file("README.txt", buildBrotherReadme(batch.id));
      const buf = await zip.generateAsync({ type: "uint8array" });
      const filename = `logitrak-brother-${pad(batch.serialStart)}-${pad(batch.serialEnd)}.zip`;
      return new NextResponse(Buffer.from(buf), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": contentDispositionHeader(filename),
        },
      });
    }

    // Default: PDF
    const pdfBytes = await generateLabelPdf(commonArgs);
    const filename = `logitrak-labels-${pad(batch.serialStart)}-${pad(batch.serialEnd)}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDispositionHeader(filename),
      },
    });
  } catch (err) {
    console.error("[labels/generate] error", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: "generation failed", detail: message }, { status: 500 });
  }
}

function pad(n: number): string {
  return n.toString().padStart(5, "0");
}
