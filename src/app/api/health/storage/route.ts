import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { storageBuckets } from "@/lib/supabase/storage";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.listBuckets();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const bucketIds = new Set((data ?? []).map((bucket) => bucket.id));

  return NextResponse.json({
    ok: true,
    imageBucket: storageBuckets.images,
    imageBucketExists: bucketIds.has(storageBuckets.images),
    audioBucket: storageBuckets.audio,
    audioBucketExists: bucketIds.has(storageBuckets.audio),
  });
}
