import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createUserClient } from "@/integrations/supabase/server";
import { requireSupabasePublicConfig } from "@/integrations/supabase/config";
import {
  jakartaDayStart,
  type ReportCategory,
  type ReportListFilters,
  type ReportStatus,
} from "@/features/reports/validation";

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

type ReportRow = {
  id: string;
  public_reference: string;
  area_id: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  submitted_at: string;
  is_demo: boolean;
};

type ReportDetailRow = ReportRow & {
  visible_objects: string | null;
  prevention_advice: string | null;
  latitude: number | null;
  longitude: number | null;
  location_note: string | null;
  duplicate_of_report_id: string | null;
  created_at: string;
  version: number;
};

type ReportEventRow = {
  id: string;
  event_type: string;
  old_status: ReportStatus | null;
  new_status: ReportStatus;
  reason: string | null;
  created_at: string;
};

const summaryColumns =
  "id,public_reference,area_id,category,description,status,submitted_at,is_demo";

// API JSON is camelCase; the database stays snake_case.
function toReportSummary(row: ReportRow) {
  return {
    id: row.id,
    publicReference: row.public_reference,
    areaId: row.area_id,
    category: row.category,
    description: row.description,
    status: row.status,
    submittedAt: row.submitted_at,
    isDemo: row.is_demo,
  };
}

function toReportEvent(row: ReportEventRow) {
  return {
    id: row.id,
    eventType: row.event_type,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export type ReportSummary = ReturnType<typeof toReportSummary>;
export type ReportEvent = ReturnType<typeof toReportEvent>;

// RLS limits rows to the caller's own reports or verified role areas.
export async function listReports(
  page: number,
  limit: number,
  filters: ReportListFilters = {},
) {
  const client = await createUserClient();
  let query = client
    .from("reports")
    .select(summaryColumns, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.in("status", filters.status);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.submittedFrom)
    query = query.gte("submitted_at", jakartaDayStart(filters.submittedFrom));
  if (filters.submittedTo)
    query = query.lt("submitted_at", jakartaDayStart(filters.submittedTo, 1));
  const result = await query.overrideTypes<ReportRow[], { merge: false }>();
  return {
    data: result.data?.map(toReportSummary) ?? null,
    count: result.count,
    error: result.error,
  };
}

// Mirrors the review_report duplicate rule; the RPC remains authoritative.
export async function listDuplicateCandidates(report: {
  id: string;
  areaId: string;
  submittedAt: string;
}) {
  const client = await createUserClient();
  const result = await client
    .from("reports")
    .select(summaryColumns)
    .eq("area_id", report.areaId)
    .neq("id", report.id)
    .not("status", "in", "(rejected,duplicate)")
    .lt("submitted_at", report.submittedAt)
    .order("submitted_at", { ascending: false })
    .limit(20)
    .overrideTypes<ReportRow[], { merge: false }>();
  return {
    data: result.data?.map(toReportSummary) ?? null,
    error: result.error,
  };
}

export async function getReportAiSuggestions(id: string) {
  const client = await createUserClient();
  return client.rpc("get_report_ai_suggestions", { p_report_id: id });
}

export async function getReportDetail(id: string) {
  const client = await createUserClient();
  const report = await client
    .from("reports")
    .select(
      "id,public_reference,area_id,category,description,visible_objects,prevention_advice,status,latitude,longitude,location_note,is_demo,duplicate_of_report_id,submitted_at,created_at,version",
    )
    .eq("id", id)
    .maybeSingle<ReportDetailRow>();
  if (report.error || !report.data)
    return {
      report: { data: null, error: report.error },
      images: null,
      events: null,
    };
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
      .order("created_at")
      .overrideTypes<ReportEventRow[], { merge: false }>(),
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
  const row = report.data;
  return {
    report: {
      data: {
        ...toReportSummary(row),
        visibleObjects: row.visible_objects,
        preventionAdvice: row.prevention_advice,
        latitude: row.latitude,
        longitude: row.longitude,
        locationNote: row.location_note,
        duplicateOfReportId: row.duplicate_of_report_id,
        createdAt: row.created_at,
        version: row.version,
      },
      error: null,
    },
    images: { data: withUrls, error: null },
    events: { data: (events.data ?? []).map(toReportEvent), error: null },
  };
}

export type ReportDetail = NonNullable<
  Awaited<ReturnType<typeof getReportDetail>>["report"]["data"]
>;
export type ReportImage = NonNullable<
  Awaited<ReturnType<typeof getReportDetail>>["images"]
>["data"][number];
