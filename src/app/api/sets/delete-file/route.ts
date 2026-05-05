/**
 * Delete a file from Supabase Storage after its DB row has been removed.
 *
 * POST /api/sets/delete-file
 *   JSON body: { bucket: "set-photos" | "set-layouts", storagePath: string }
 *
 * Only callable by authenticated users; path is validated to start with
 * one of the caller's active workspace ids so they can't delete other
 * tenants' files.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const bucket      = body?.bucket as string | undefined;
    const storagePath = body?.storagePath as string | undefined;

    if (bucket !== "set-photos" && bucket !== "set-layouts") {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }
    if (!storagePath) return NextResponse.json({ error: "Missing storagePath" }, { status: 400 });

    const memberships = await prisma.workspaceUser.findMany({
      where: { userId: user.id, isActive: true },
      select: { workspaceId: true },
    });
    const ok = memberships.some((m) => storagePath.startsWith(`${m.workspaceId}/`));
    if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const admin = createAdminSupabase(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { error } = await admin.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.warn("[sets/delete-file] storage error", error.message);
      return NextResponse.json({ ok: true, warning: error.message });
    }
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.error("[sets/delete-file] error", e);
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
