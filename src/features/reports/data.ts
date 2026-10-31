import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/integrations/supabase/server";
import { requireSupabasePublicConfig } from "@/integrations/supabase/config";

export const reportBucket = "report-photos";

export function createStorageAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key || /replace|placeholder/i.test(key))
    throw new Error("STORAGE_CONFIGURATION_MISSING");
  const { url } = requireSupabasePublicConfig();
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listReports(
  page: number,
  limit: number,
  category?: string,
) {
  const client = await createUserClient();
  let query = client
    .from("reports")
    .select(
      "id,public_reference,category,description,status,submitted_at,is_demo",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (category) query = query.eq("category", category);
  return query;
}

export async function getReportDetail(id: string) {
  const client = await createUserClient();
  const report = await client
    .from("reports")
    .select(
      "id,public_reference,area_id,category,description,status,latitude,longitude,location_note,is_demo,submitted_at,created_at,version",
    )
    .eq("id", id)
    .maybeSingle();
  if (report.error || !report.data)
    return { report, images: null, events: null };
  const [images, events] = await Promise.all([
    client
      .from("report_images")
      .select("id,storage_path,width,height")
      .eq("report_id", id)
      .order("created_at"),
    client
      .from("report_events")
      .select("id,event_type,old_status,new_status,reason,created_at")
      .eq("report_id", id)
      .order("created_at"),
  ]);
  if (images.error || events.error)
    throw new Error("REPORT_DETAIL_UNAVAILABLE");
  const withUrls = await Promise.all(
    (images.data ?? []).map(async (image) => {
      const signed = await client.storage
        .from(reportBucket)
        .createSignedUrl(image.storage_path, 60);
      if (signed.error || !signed.data)
        throw new Error("SIGNED_URL_UNAVAILABLE");
      return {
        id: image.id,
        width: image.width,
        height: image.height,
        url: signed.data.signedUrl,
      };
    }),
  );
  return { report, images: { data: withUrls, error: null }, events };
}
