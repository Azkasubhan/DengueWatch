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
  const withUrls = (
    await Promise.all(
      (images.data ?? []).map(async (image) => {
        try {
          const signed = await client.storage
            .from(reportBucket)
            .createSignedUrl(image.storage_path, 60);
          if (signed.error || !signed.data?.signedUrl) {
            return null;
          }
          return {
            id: image.id,
            width: image.width,
            height: image.height,
            url: signed.data.signedUrl,
          };
        } catch {
          return null;
        }
      }),
    )
  ).filter((item): item is NonNullable<typeof item> => item !== null);
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
  photoCount: number;
  needsMandatoryTask: boolean;
};

async function fetchBatchPhotoCounts(
  client: Awaited<ReturnType<typeof createUserClient>>,
  reportIds: string[],
) {
  const counts = new Map<string, number>();
  if (!reportIds.length) return counts;
  const images = await client
    .from("report_images")
    .select("report_id")
    .in("report_id", reportIds);
  if (images.error || !images.data?.length) return counts;

  for (const row of images.data) {
    counts.set(row.report_id, (counts.get(row.report_id) ?? 0) + 1);
  }
  return counts;
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
    const photoCounts = await fetchBatchPhotoCounts(
      client,
      paged.map((r) => r.id),
    );
    return {
      data: paged.map((row): ReportListRow => ({
        ...toReportSummary(row),
        locationNote: row.location_note,
        hasCoordinates: row.latitude !== null && row.longitude !== null,
        photoCount: photoCounts.get(row.id) ?? 0,
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

  const photoCounts = await fetchBatchPhotoCounts(
    client,
    result.data.map((r) => r.id),
  );

  return {
    data: result.data.map((row): ReportListRow => ({
      ...toReportSummary(row),
      locationNote: row.location_note,
      hasCoordinates: row.latitude !== null && row.longitude !== null,
      photoCount: photoCounts.get(row.id) ?? 0,
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

export type ResidentRecentEvent = {
  id: string;
  reportId: string;
  publicReference: string;
  category: ReportCategory;
  reportStatus: ReportStatus;
  eventType: string;
  reason: string | null;
  createdAt: string;
};

export async function getResidentReportSummary() {
  const client = await createUserClient();
  const [result, eventsResult] = await Promise.all([
    client
      .from("reports")
      .select(
        "id,public_reference,area_id,category,description,status,submitted_at,is_demo,location_note",
      )
      .order("submitted_at", { ascending: false })
      .overrideTypes<
        (ReportRow & { location_note: string | null })[],
        { merge: false }
      >(),
    client
      .from("report_events")
      .select(
        "id,report_id,event_type,reason,created_at,reports!inner(id,public_reference,category,status)",
      )
      .order("created_at", { ascending: false })
      .limit(25)
      .overrideTypes<
        {
          id: string;
          report_id: string;
          event_type: string;
          reason: string | null;
          created_at: string;
          reports: {
            id: string;
            public_reference: string;
            category: ReportCategory;
            status: ReportStatus;
          };
        }[],
        { merge: false }
      >(),
  ]);

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const latestRequestReasonByReport = new Map<string, string>();
  for (const ev of eventsResult.data ?? []) {
    if (
      ev.event_type === "report_information_requested" &&
      ev.reason &&
      !latestRequestReasonByReport.has(ev.report_id)
    ) {
      latestRequestReasonByReport.set(ev.report_id, ev.reason);
    }
  }

  let awaitingReview = 0;
  let needsInformationCount = 0;
  let inAction = 0;
  let resolved = 0;
  const needsInformationReports: (ReportSummary & {
    locationNote: string | null;
    requestReason: string | null;
  })[] = [];

  for (const row of result.data) {
    if (row.status === "pending_verification") awaitingReview += 1;
    else if (row.status === "needs_information") {
      needsInformationCount += 1;
      needsInformationReports.push({
        ...toReportSummary(row),
        locationNote: row.location_note,
        requestReason: latestRequestReasonByReport.get(row.id) ?? null,
      });
    } else if (row.status === "verified" || row.status === "in_action") {
      inAction += 1;
    } else if (row.status === "resolved") {
      resolved += 1;
    }
  }

  // Exclude needs_information reports already shown in the "Perlu tanggapan Anda" section
  const shownNeedsInfoIds = new Set(
    needsInformationReports.slice(0, 2).map((item) => item.id),
  );

  const recentEvents: ResidentRecentEvent[] = [];
  for (const ev of eventsResult.data ?? []) {
    if (
      ev.event_type === "report_information_requested" &&
      (shownNeedsInfoIds.has(ev.report_id) ||
        ev.reports.status === "needs_information")
    ) {
      continue;
    }
    recentEvents.push({
      id: ev.id,
      reportId: ev.report_id,
      publicReference: ev.reports.public_reference,
      category: ev.reports.category,
      reportStatus: ev.reports.status,
      eventType: ev.event_type,
      reason: ev.reason,
      createdAt: ev.created_at,
    });
    if (recentEvents.length >= 3) break;
  }

  return {
    data: {
      total: result.data.length,
      awaitingReview,
      needsInformationCount,
      inAction,
      resolved,
      needsInformationReports,
      recentEvents,
    },
    error: null,
  };
}

export async function getResidentStatusCounts(q?: string) {
  const client = await createUserClient();
  let query = client.from("reports").select("id,status");
  if (q) {
    const escaped = q.replace(/[%_,()]/g, "").trim();
    if (escaped) {
      query = query.or(
        `public_reference.ilike.%${escaped}%,description.ilike.%${escaped}%,location_note.ilike.%${escaped}%`,
      );
    }
  }
  const result = await query.overrideTypes<
    { id: string; status: ReportStatus }[],
    { merge: false }
  >();
  const counts: Record<ReportStatus | "all", number> = {
    all: 0,
    pending_verification: 0,
    needs_information: 0,
    verified: 0,
    in_action: 0,
    resolved: 0,
    rejected: 0,
    duplicate: 0,
  };
  if (result.error || !result.data) return counts;
  counts.all = result.data.length;
  for (const row of result.data) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
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

export const MAP_POINTS_LIMIT = 300;

export async function listMapReports(filters: {
  areaId?: string | null;
  category?: ReportCategory;
  status?: ReportStatus[];
  from?: string;
  to?: string;
}) {
  const client = await createUserClient();

  let pointsQuery = client
    .from("reports")
    .select(
      "id,public_reference,area_id,category,description,status,submitted_at,is_demo,latitude,longitude,location_note,action_tasks(id,title,status)",
      { count: "exact" },
    )
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(MAP_POINTS_LIMIT);

  let missingQuery = client
    .from("reports")
    .select("id", { count: "exact", head: true })
    .or("latitude.is.null,longitude.is.null");

  if (filters.areaId) {
    pointsQuery = pointsQuery.eq("area_id", filters.areaId);
    missingQuery = missingQuery.eq("area_id", filters.areaId);
  }
  if (filters.category) {
    pointsQuery = pointsQuery.eq("category", filters.category);
    missingQuery = missingQuery.eq("category", filters.category);
  }
  if (filters.status?.length) {
    pointsQuery = pointsQuery.in("status", filters.status);
    missingQuery = missingQuery.in("status", filters.status);
  }
  if (filters.from) {
    const start = jakartaDayStart(filters.from);
    pointsQuery = pointsQuery.gte("submitted_at", start);
    missingQuery = missingQuery.gte("submitted_at", start);
  }
  if (filters.to) {
    const end = jakartaDayStart(filters.to, 1);
    pointsQuery = pointsQuery.lt("submitted_at", end);
    missingQuery = missingQuery.lt("submitted_at", end);
  }

  const [result, missingRes] = await Promise.all([
    pointsQuery.overrideTypes<
      (ReportRow & {
        latitude: number | null;
        longitude: number | null;
        location_note: string | null;
        action_tasks?: { id: string; title: string; status: string }[];
      })[],
      { merge: false }
    >(),
    missingQuery,
  ]);

  if (result.error || !result.data || missingRes.error) {
    return { data: null, error: result.error ?? missingRes.error };
  }

  const withCoords = result.data.filter(
    (row): row is typeof row & { latitude: number; longitude: number } =>
      row.latitude !== null &&
      row.longitude !== null &&
      Number.isFinite(row.latitude) &&
      Number.isFinite(row.longitude),
  );

  const withCoordinatesTotal = result.count ?? withCoords.length;
  const missingCoordinatesCount = missingRes.count ?? 0;
  const totalMatching = withCoordinatesTotal + missingCoordinatesCount;

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
    thumbnailUrl: null,
    tasks: (row.action_tasks ?? []).filter((t) => t.status !== "cancelled"),
  }));

  return {
    data: {
      points,
      totalMatching,
      withCoordinatesCount: points.length,
      withCoordinatesTotal,
      missingCoordinatesCount,
      isTruncated: withCoordinatesTotal > points.length,
      pointLimit: MAP_POINTS_LIMIT,
    },
    error: null,
  };
}
