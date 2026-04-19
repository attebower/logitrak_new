/**
 * Generate a Set Snapshot PDF.
 *
 * GET /api/sets/snapshot?projectSetId=...
 *
 * Combines:
 *   - Project + set metadata
 *   - Equipment currently on this set (with serials, status, check history)
 *   - Photos uploaded for this set
 *   - Lighting layouts (images embedded; PDFs listed as attachments)
 *   - Damage reports for equipment that has touched this set
 *
 * Output: application/pdf stream with Content-Disposition attachment
 *         so browsers download it as "<project> — <set>.pdf".
 *
 * Auth: user must be an active member of the ProjectSet's workspace.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { renderSetSnapshotPdf } from "@/lib/pdf/SetSnapshotPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectSetId = searchParams.get("projectSetId");
    if (!projectSetId) return NextResponse.json({ error: "Missing projectSetId" }, { status: 400 });

    // Fetch the ProjectSet + project context
    const ps = await prisma.projectSet.findUnique({
      where: { id: projectSetId },
      include: {
        project:    { include: { studio: { select: { name: true } } } },
        set:        { select: { id: true, name: true, description: true } },
        stage:      { select: { name: true, studio: { select: { name: true } } } },
        onLocation: { select: { name: true, description: true, address: true } },
      },
    });
    if (!ps) return NextResponse.json({ error: "Project set not found" }, { status: 404 });

    const membership = await prisma.workspaceUser.findFirst({
      where: { userId: user.id, workspaceId: ps.workspaceId, isActive: true },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { displayName: true, email: true },
    });

    // Equipment currently checked out to this set (within this project)
    const equipment = await prisma.equipment.findMany({
      where: {
        workspaceId: ps.workspaceId,
        status: "checked_out",
        checkEvents: {
          some: {
            setId:          ps.setId,
            productionName: ps.project.name,
            eventType:      "check_out",
          },
        },
      },
      include: {
        category: { select: { name: true, groupName: true } },
        checkEvents: {
          where: { setId: ps.setId, eventType: "check_out" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { user: { select: { displayName: true, email: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const photos  = await prisma.setPhoto.findMany({
      where: { projectSetId, workspaceId: ps.workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const layouts = await prisma.setLightingLayout.findMany({
      where: { projectSetId, workspaceId: ps.workspaceId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const damage  = await prisma.damageReport.findMany({
      where: {
        workspaceId: ps.workspaceId,
        equipment: {
          checkEvents: {
            some: { setId: ps.setId, productionName: ps.project.name },
          },
        },
      },
      orderBy: { reportedAt: "desc" },
      include: {
        equipment:  { select: { serial: true, name: true } },
        reporter:   { select: { displayName: true, email: true } },
        repairLogs: {
          orderBy: { repairedAt: "desc" },
          take: 1,
          select: { description: true, repairedByName: true, repairedAt: true },
        },
      },
    });

    // Pre-sign URLs so @react-pdf can fetch image buffers server-side
    const admin = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const sign = async (bucket: string, paths: string[]): Promise<Record<string, string>> => {
      if (paths.length === 0) return {};
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, 600);
      if (error) { console.warn("[snapshot] signUrls error", error.message); return {}; }
      const out: Record<string, string> = {};
      for (const row of data ?? []) { if (row.path && row.signedUrl) out[row.path] = row.signedUrl; }
      return out;
    };

    const photoUrls  = await sign("set-photos",  photos.map((p) => p.storagePath));
    const layoutUrls = await sign("set-layouts", layouts.map((l) => l.storagePath));

    // Fetch image bytes for embedding in the PDF
    const fetchBytes = async (url: string): Promise<Buffer | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        return Buffer.from(await res.arrayBuffer());
      } catch { return null; }
    };

    const photoAssets = await Promise.all(
      photos.map(async (p) => {
        const url = photoUrls[p.storagePath];
        const buf = url ? await fetchBytes(url) : null;
        const dataUrl = buf ? `data:${p.mimeType};base64,${buf.toString("base64")}` : null;
        return { ...p, dataUrl };
      }),
    );

    const layoutAssets = await Promise.all(
      layouts.map(async (l) => {
        // Only embed image layouts; list PDFs without embedding
        const isImage = l.mimeType.startsWith("image/");
        const url = isImage ? layoutUrls[l.storagePath] : null;
        const buf = url ? await fetchBytes(url) : null;
        const dataUrl = buf ? `data:${l.mimeType};base64,${buf.toString("base64")}` : null;
        return { ...l, dataUrl };
      }),
    );

    const buffer = await renderSetSnapshotPdf({
      project: {
        name: ps.project.name,
        industryType: ps.project.industryType,
        studioName: ps.project.studio?.name ?? null,
        eventLocation: ps.project.eventLocation ?? null,
      },
      set: {
        name:       ps.set.name,
        // When on-location, these stage/studio fields still get used as
        // the "context" fallback; the dedicated onLocation block below
        // is what the PDF actually prefers when present.
        stageName:  ps.stage?.name          ?? ps.onLocation?.name    ?? "",
        studioName: ps.stage?.studio.name   ?? "On Location",
        notes:      ps.notes ?? null,
        onLocation: ps.onLocation ? {
          name:        ps.onLocation.name,
          address:     ps.onLocation.address     ?? null,
          description: ps.onLocation.description ?? null,
        } : null,
      },
      generatedBy: profile?.displayName ?? profile?.email ?? "Unknown",
      generatedAt: new Date(),
      equipment: equipment.map((e) => ({
        serial:       e.serial,
        name:         e.name,
        category:     e.category?.name ?? null,
        status:       e.status,
        damageStatus: e.damageStatus,
        issuedTo:     e.checkEvents[0]?.user?.displayName ?? e.checkEvents[0]?.user?.email ?? null,
        issuedAt:     e.checkEvents[0]?.createdAt ?? null,
      })),
      photos:  photoAssets.map((p) => ({
        dataUrl: p.dataUrl,
        caption: p.caption ?? null,
        filename: p.filename,
      })),
      layouts: layoutAssets.map((l) => ({
        dataUrl:     l.dataUrl,
        title:       l.title ?? null,
        description: l.description ?? null,
        filename:    l.filename,
        isPdf:       l.mimeType === "application/pdf",
      })),
      damage: damage.map((d) => ({
        equipmentSerial: d.equipment.serial,
        equipmentName:   d.equipment.name,
        description:     d.description,
        damageLocation:  d.damageLocation ?? null,
        itemLocation:    d.itemLocation ?? null,
        reportedBy:      d.reporter?.displayName ?? d.reporter?.email ?? "Unknown",
        reportedAt:      d.reportedAt,
        repair:          d.repairLogs[0] ? {
          description:    d.repairLogs[0].description ?? "",
          repairedByName: d.repairLogs[0].repairedByName ?? "Unknown",
          repairedAt:     d.repairLogs[0].repairedAt ?? null,
        } : null,
      })),
    });

    // Headers must be ASCII. Build an ASCII-only filename + a
    // UTF-8 filename* per RFC 5987 so browsers still show the nice
    // Unicode name on download.
    const unicodeName = `${ps.project.name} — ${ps.set.name} snapshot.pdf`
      .replace(/[/\\?%*:|"<>]/g, "-");
    const asciiName = unicodeName
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "-")
      .replace(/-+/g, "-")
      .trim() || "snapshot.pdf";

    const disposition =
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(unicodeName)}`;

    return new Response(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    console.error("[sets/snapshot] error", e);
    const msg = e instanceof Error ? e.message : "Snapshot failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
