/**
 * Bootstrap Supabase Storage buckets for set attachments.
 *
 * Run: cd logitrak-app && npx tsx scripts/setup-storage-buckets.ts
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Creates two private buckets:
 *   - set-photos   (images: jpeg, png, webp, heic, gif)
 *   - set-layouts  (pdf + images for lighting plans)
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const BUCKETS = [
  {
    id: "set-photos",
    public: false,
    fileSizeLimit: 15 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/gif"],
  },
  {
    id: "set-layouts",
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
];

async function main() {
  const { data: existing, error: listErr } = await supabase.storage.listBuckets();
  if (listErr) {
    console.error("listBuckets failed:", listErr.message);
    process.exit(1);
  }
  const existingIds = new Set((existing ?? []).map((b) => b.id));

  for (const b of BUCKETS) {
    if (existingIds.has(b.id)) {
      console.log(`✓ bucket "${b.id}" already exists — skipping`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(b.id, {
      public: b.public,
      fileSizeLimit: b.fileSizeLimit,
      allowedMimeTypes: b.allowedMimeTypes,
    });
    if (error) {
      console.error(`✗ failed to create "${b.id}": ${error.message}`);
    } else {
      console.log(`✓ created bucket "${b.id}"`);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => { console.error(e); process.exit(1); });
