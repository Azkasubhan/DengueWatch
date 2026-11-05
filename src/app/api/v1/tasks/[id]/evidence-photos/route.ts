import { NextResponse } from "next/server";
import { z } from "zod";
import { reportBucket } from "@/features/reports/data";
import { createClient } from "@/integrations/supabase/server";

const idSchema = z.string().uuid();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Tugas tidak ditemukan." } },
      { status: 404 },
    );
  }

  const url = new URL(request.url);
  const mineOnly = url.searchParams.get("mine") === "1";
  const evidenceId = url.searchParams.get("evidenceId");
  if (evidenceId && !idSchema.safeParse(evidenceId).success) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Bukti tidak ditemukan." } },
      { status: 404 },
    );
  }

  const client = await createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Silakan masuk terlebih dahulu.",
        },
      },
      { status: 401 },
    );
  }

  // RLS ensures only assigned cadre or area manager can read the task
  const taskResult = await client
    .from("action_tasks")
    .select("id,title,evidence_round")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (taskResult.error || !taskResult.data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Tugas tidak ditemukan." } },
      { status: 404 },
    );
  }

  let evidenceQuery = client
    .from("task_evidence")
    .select(
      "id,storage_path,width,height,description,evidence_round,created_at",
    )
    .eq("task_id", parsedId.data)
    .order("created_at", { ascending: true });

  if (evidenceId) {
    evidenceQuery = evidenceQuery.eq("id", evidenceId);
  } else if (mineOnly) {
    evidenceQuery = evidenceQuery
      .eq("submitted_by", user.id)
      .eq("evidence_round", taskResult.data.evidence_round);
  }

  const evidenceResult = await evidenceQuery;
  if (evidenceResult.error) {
    return NextResponse.json(
      {
        error: {
          code: "UNAVAILABLE",
          message: "Foto bukti belum dapat dimuat.",
        },
      },
      { status: 503 },
    );
  }

  const taskTitle = taskResult.data.title;
  const rows = evidenceResult.data ?? [];
  if (rows.length === 0) {
    return NextResponse.json(
      { data: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const signedResults = await Promise.all(
    rows.map(async (row, index) => {
      const signed = await client.storage
        .from(reportBucket)
        .createSignedUrl(row.storage_path, 120);
      if (signed.error || !signed.data?.signedUrl) {
        return null;
      }
      return {
        id: row.id,
        url: signed.data.signedUrl,
        width: row.width,
        height: row.height,
        alt: `Foto bukti ${taskTitle} (${index + 1})`,
        caption: row.description,
      };
    }),
  );

  if (signedResults.some((item) => item === null)) {
    return NextResponse.json(
      {
        error: {
          code: "SIGNED_URL_UNAVAILABLE",
          message: "Tautan foto bukti gagal dibuat. Silakan coba lagi.",
        },
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { data: signedResults },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
