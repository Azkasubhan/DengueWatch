import { NextResponse } from "next/server";
import { z } from "zod";
import { reportBucket } from "@/features/reports/data";
import { createClient } from "@/integrations/supabase/server";

const idSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Laporan tidak ditemukan." } },
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

  // RLS ensures only report owner, area manager, or assigned cadre can read the report
  const reportResult = await client
    .from("reports")
    .select("id,public_reference")
    .eq("id", parsedId.data)
    .maybeSingle();

  if (reportResult.error || !reportResult.data) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Laporan tidak ditemukan." } },
      { status: 404 },
    );
  }

  const imagesResult = await client
    .from("report_images")
    .select("id,storage_path,width,height,created_at")
    .eq("report_id", parsedId.data)
    .order("created_at", { ascending: true });

  if (imagesResult.error) {
    return NextResponse.json(
      { error: { code: "UNAVAILABLE", message: "Foto belum dapat dimuat." } },
      { status: 503 },
    );
  }

  const reportRef = reportResult.data.public_reference;
  const rows = imagesResult.data ?? [];
  if (rows.length === 0) {
    return NextResponse.json(
      { data: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const signedResults = await Promise.all(
    rows.map(async (img, index) => {
      const signed = await client.storage
        .from(reportBucket)
        .createSignedUrl(img.storage_path, 120);
      if (signed.error || !signed.data?.signedUrl) {
        return null;
      }
      return {
        id: img.id,
        url: signed.data.signedUrl,
        width: img.width,
        height: img.height,
        alt: `Foto laporan ${reportRef} (${index + 1})`,
      };
    }),
  );

  if (signedResults.some((item) => item === null)) {
    return NextResponse.json(
      {
        error: {
          code: "SIGNED_URL_UNAVAILABLE",
          message: "Tautan foto sementara gagal dibuat. Silakan coba lagi.",
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
