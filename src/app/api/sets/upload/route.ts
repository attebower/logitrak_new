/**
 * Upload handler for ProjectSet photos and lighting layouts.
 *
 * POST /api/sets/upload
 *   FormData fields:
 *     - file          (File)
 *     - bucket        ("set-photos" | "set-layouts")
 *     - projectSetId  (string)
 *     - caption       (optional, for photos)
 *     - title         (optional, for layouts)
 *     - description   (optional, for layouts)
 *
 * The route:
 *   1. Validates the user's session (Supabase cookie auth)
 *   2. Confirms the ProjectSet belongs to one of the user's workspaces
 *   3. Uploads the file to the correct Supabase Storage bucket under
 *      <workspaceId>/<projectSetId>/<uuid>.<ext>
 *   4. Inserts a matching row in the set_photos / set_lighting_layouts table
 *   5. Returns the new record
 *
 * Returns 401 / 403 / 404 / 413 with JSON { error } on failures.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES  = 15 * 1024 * 1024;
const MAX_LAYOUT_BYTES = 25 * 1024 * 1024;

const PHOTO_MIMES  = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"]);
const LAYOUT_MIMES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function extForMime(mime: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "image/jpeg":      "jpg",
    "image/png":       "png",
    "image/webp":      "webp",
    "image/heic":      "heic",
    "image/gif":       "gif",
    "application/pdf": "pdf",
  };
  return map[mime] ?? fallback;
}

export async function POST(req: Request) {
  try {
    // 1. Auth
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // 2. Form data
    const form = await req.formData();
    const file         = form.get("file");
    const bucket       = String(form.get("bucket") ?? "");
    const projectSetId = String(form.get("projectSetId") ?? "");
    const caption      = form.get("caption");
    const title        = form.get("title");
    const description  = form.get("description");

    if (!(file instanceof File))                            return NextResponse.json({ error: "Missing file" }, { status: 400 });
    if (bucket !== "set-photos" && bucket !== "set-layouts") return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    if (!projectSetId)                                       return NextResponse.json({ error: "Missing projectSetId" }, { status: 400 });

    const maxBytes     = bucket === "set-photos" ? MAX_PHOTO_BYTES : MAX_LAYOUT_BYTES;
    const allowedMimes = bucket === "set-photos" ? PHOTO_MIMES     : LAYOUT_MIMES;

    if (file.size > maxBytes) {
      return NextResponse.json({ error: `File too large (max ${Math.round(maxBytes / 1024 / 1024)}MB)` }, { status: 413 });
    }
    if (!allowedMimes.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }

    // 3. Verify ProjectSet → workspace → user has access
    const ps = await prisma.projectSet.findUnique({
      where: { id: projectSetId },
      select: { id: true, workspaceId: true },
    });
    if (!ps) return NextResponse.json({ error: "Project set not found" }, { status: 404 });

    const membership = await prisma.workspaceUser.findFirst({
      where: { userId: user.id, workspaceId: ps.workspaceId, isActive: true },
      select: { id: true },
    });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // 4. Upload to storage (service-role client, since bucket is private)
    const admin = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const ext         = extForMime(file.type, file.name.split(".").pop() ?? "bin");
    const storagePath = `${ps.workspaceId}/${projectSetId}/${randomUUID()}.${ext}`;
    const buffer      = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    // 5. Insert DB row
    const common = {
      workspaceId:  ps.workspaceId,
      projectSetId,
      uploadedById: user.id,
      storagePath,
      filename:     file.name,
      mimeType:     file.type,
      sizeBytes:    file.size,
    };

    if (bucket === "set-photos") {
      const record = await prisma.setPhoto.create({
        data: {
          ...common,
          caption: typeof caption === "string" && caption.trim() ? caption.trim() : undefined,
        },
      });
      return NextResponse.json({ record }, { status: 201 });
    } else {
      const record = await prisma.setLightingLayout.create({
        data: {
          ...common,
          title:       typeof title       === "string" && title.trim()       ? title.trim()       : undefined,
          description: typeof description === "string" && description.trim() ? description.trim() : undefined,
        },
      });
      return NextResponse.json({ record }, { status: 201 });
    }
  } catch (e: unknown) {
    console.error("[sets/upload] error", e);
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
