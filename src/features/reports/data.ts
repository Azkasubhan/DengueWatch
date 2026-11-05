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

type RichReportRow = ReportRow & {
  location_note: string | null;
  latitude: number | null;
  longitude: number | null;
  action_tasks?: { id: string; status: string; is_mandatory: boolean }[];
};

export type ReportListRow = ReportSummary & {
  locationNote: string | null;
  hasCoordinates: boolean;
  thumbnailUrl: string | null;
  needsMandatoryTask: boolean;
};

async function fetchBatchThumbnails(
  client: Awaited<ReturnType<typeof createUserClient>>,
  reportIds: string[],
) {
  const map = new Map<string, string>();
  if (!reportIds.length) return map;
  const images = await client
    .from("report_images")
    .select("report_id,storage_path,created_at")
    .in("report_id", reportIds)
    .order("created_at", { ascending: true });
  if (images.error || !images.data?.length) return map;

  const firstPathByReport = new Map<string, string>();
  for (const row of images.data) {
    if (!firstPathByReport.has(row.report_id)) {
      firstPathByReport.set(row.report_id, row.storage_path);
    }
  }
  const paths = Array.from(firstPathByReport.values());
  if (!paths.length) return map;

  const signed = await client.storage
    .from(reportBucket)
    .createSignedUrls(paths, 60);
  if (signed.error || !signed.data) return map;

  const urlByPath = new Map<string, string>();
  for (const item of signed.data) {
    if (item.path && item.signedUrl) {
      urlByPath.set(item.path, item.signedUrl);
    }
  }
  for (const [reportId, path] of firstPathByReport.entries()) {
    const url = urlByPath.get(path);
    if (url) map.set(reportId, url);
  }
  return map;
}

export async function listReportRows(
  page: number,
  limit: number,
  filters: ReportListFilters = {},
) {
  const client = await createUserClient();
  const ascending =
    filters.sort === "oldest" || filters.sort === "waiting_longest";

  let query = client
    .from("reports")
    .select(
      `${summaryColumns},location_note,latitude,longitude,action_tasks(id,status,is_mandatory)`,
      { count: "exact" },
    );

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.submittedFrom)
    query = query.gte("submitted_at", jakartaDayStart(filters.submittedFrom));
  if (filters.submittedTo)
    query = query.lt("submitted_at", jakartaDayStart(filters.submittedTo, 1));

  if (filters.q) {
    const escaped = filters.q.replace(/[%_,()]/g, "").trim();
    if (escaped) {
      query = query.or(
        `public_reference.ilike.%${escaped}%,description.ilike.%${escaped}%,location_note.ilike.%${escaped}%`,
      );
    }
  }

  if (filters.tab === "needs_task") {
    // Reports that are verified or in_action but have no active mandatory task
    query = query.in("status", ["verified", "in_action"]);
    const allResult = await query
      .order("submitted_at", { ascending })
      .order("id", { ascending })
      .overrideTypes<RichReportRow[], { merge: false }>();
    if (allResult.error || !allResult.data) {
      return { data: null, count: 0, error: allResult.error };
    }
    const needingTask = allResult.data.filter(
      (row) =>
        !(row.action_tasks ?? []).some(
          (task) => task.is_mandatory && task.status !== "cancelled",
        ),
    );
    const paged = needingTask.slice((page - 1) * limit, page * limit);
    const thumbnails = await fetchBatchThumbnails(
      client,
      paged.map((r) => r.id),
    );
    return {
      data: paged.map((row): ReportListRow => ({
        ...toReportSummary(row),
        locationNote: row.location_note,
        hasCoordinates: row.latitude !== null && row.longitude !== null,
        thumbnailUrl: thumbnails.get(row.id) ?? null,
        needsMandatoryTask: true,
      })),
      count: needingTask.length,
      error: null,
    };
  }

  if (filters.status) query = query.in("status", filters.status);

  const result = await query
    .order("submitted_at", { ascending })
    .order("id", { ascending })
    .range((page - 1) * limit, page * limit - 1)
    .overrideTypes<RichReportRow[], { merge: false }>();

  if (result.error || !result.data) {
    return { data: null, count: result.count, error: result.error };
  }

  const thumbnails = await fetchBatchThumbnails(
    client,
    result.data.map((r) => r.id),
  );

  return {
    data: result.data.map((row): ReportListRow => ({
      ...toReportSummary(row),
      locationNote: row.location_note,
      hasCoordinates: row.latitude !== null && row.longitude !== null,
      thumbnailUrl: thumbnails.get(row.id) ?? null,
      needsMandatoryTask:
        ["verified", "in_action"].includes(row.status) &&
        !(row.action_tasks ?? []).some(
          (task) => task.is_mandatory && task.status !== "cancelled",
        ),
    })),
    count: result.count,
    error: null,
  };
}

export async function getResidentReportSummary() {
  const client = await createUserClient();
  const result = await client
    .from("reports")
    .select(
      "id,public_reference,area_id,category,description,status,submitted_at,is_demo,location_note",
    )
    .order("submitted_at", { ascending: false })
    .overrideTypes<
      (ReportRow & { location_note: string | null })[],
      { merge: false }
    >();

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  let awaitingReview = 0;
  let needsInformationCount = 0;
  let inAction = 0;
  let resolved = 0;
  const needsInformationReports: (ReportSummary & {
    locationNote: string | null;
  })[] = [];

  for (const row of result.data) {
    if (row.status === "pending_verification") awaitingReview += 1;
    else if (row.status === "needs_information") {
      needsInformationCount += 1;
      needsInformationReports.push({
        ...toReportSummary(row),
        locationNote: row.location_note,
      });
    } else if (row.status === "verified" || row.status === "in_action") {
      inAction += 1;
    } else if (row.status === "resolved") {
      resolved += 1;
    }
  }

  return {
    data: {
      total: result.data.length,
      awaitingReview,
      needsInformationCount,
      inAction,
      resolved,
      needsInformationReports,
    },
    error: null,
  };
}

export async function getVerificationQueueCounts(areaId?: string) {
  const client = await createUserClient();
  let query = client
    .from("reports")
    .select("id,status,action_tasks(id,status,is_mandatory)");
  if (areaId) query = query.eq("area_id", areaId);
  const result = await query.overrideTypes<
    {
      id: string;
      status: ReportStatus;
      action_tasks?: { id: string; status: string; is_mandatory: boolean }[];
    }[],
    { merge: false }
  >();
  if (result.error || !result.data) {
    return {
      pendingVerification: 0,
      needsInformation: 0,
      needsTask: 0,
      total: 0,
    };
  }
  let pendingVerification = 0;
  let needsInformation = 0;
  let needsTask = 0;
  for (const row of result.data) {
    if (row.status === "pending_verification") pendingVerification += 1;
    else if (row.status === "needs_information") needsInformation += 1;
    if (
      (row.status === "verified" || row.status === "in_action") &&
      !(row.action_tasks ?? []).some(
        (t) => t.is_mandatory && t.status !== "cancelled",
      )
    ) {
      needsTask += 1;
    }
  }
  return {
    pendingVerification,
    needsInformation,
    needsTask,
    total: result.data.length,
  };
}

export type MapReportPoint = {
  id: string;
  publicReference: string;
  areaId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  submittedAt: string;
  latitude: number;
  longitude: number;
  locationNote: string | null;
  thumbnailUrl: string | null;
  tasks: { id: string; title: string; status: string }[];
};

export async function listMapReports(filters: {
  areaId?: string | null;
  category?: ReportCategory;
  status?: ReportStatus[];
  from?: string;
  to?: string;
}) {
  const client = await createUserClient();
  let query = client
    .from("reports")
    .select(
      "id,public_reference,area_id,category,description,status,submitted_at,is_demo,latitude,longitude,location_note,action_tasks(id,title,status)",
    )
    .order("submitted_at", { ascending: false })
    .limit(300);

  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status?.length) query = query.in("status", filters.status);
  if (filters.from)
    query = query.gte("submitted_at", jakartaDayStart(filters.from));
  if (filters.to)
    query = query.lt("submitted_at", jakartaDayStart(filters.to, 1));

  const result = await query.overrideTypes<
    (ReportRow & {
      latitude: number | null;
      longitude: number | null;
      location_note: string | null;
      action_tasks?: { id: string; title: string; status: string }[];
    })[],
    { merge: false }
  >();

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const withCoords = result.data.filter(
    (row): row is typeof row & { latitude: number; longitude: number } =>
      row.latitude !== null &&
      row.longitude !== null &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude),
  );
  const missingCoordinatesCount = result.data.length - withCoords.length;

  const thumbnails = await fetchBatchThumbnails(
    client,
    withCoords.slice(0, 80).map((r) => r.id),
  );

  const points: MapReportPoint[] = withCoords.map((row) => ({
    id: row.id,
    publicReference: row.public_reference,
    areaId: row.area_id,
    category: row.category,
    description: row.description,
    status: row.status,
    submittedAt: row.submitted_at,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locationNote: row.location_note,
    thumbnailUrl: thumbnails.get(row.id) ?? null,
    tasks: (row.action_tasks ?? []).filter((t) => t.status !== "cancelled"),
  }));

  return {
    data: {
      points,
      totalMatching: result.data.length,
      withCoordinatesCount: points.length,
      missingCoordinatesCount,
    },
    error: null,
  };
}
