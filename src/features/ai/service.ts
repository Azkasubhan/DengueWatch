import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { createClient } from "@/integrations/supabase/server";
import { createStorageAdmin, reportBucket } from "@/features/reports/data";
import {
  maxImageBytes,
  maxImagePixels,
  sniffImageType,
} from "@/features/reports/image";
import { AiOutputError, parseAiSuggestion } from "@/features/ai/schema";
import {
  AiProviderError,
  geminiAdapter,
  type AiAdapter,
} from "@/features/ai/gemini";
import { localTestAdapter } from "@/features/ai/test-adapter";
import { AiRequestError, aiConfiguration } from "@/features/ai/config";

export async function analyzeReportPhoto(input: {
  userId: string;
  areaId: string;
  uploadId: string;
  adapter?: AiAdapter;
  signal?: AbortSignal;
}) {
  const { model, timeoutMs } = aiConfiguration(
    Boolean(input.adapter ?? localTestAdapter()),
  );
  const admin = createStorageAdmin();
  const userClient = await createClient();
  const reserved = await userClient.rpc("reserve_ai_analysis", {
    p_area_id: input.areaId,
    p_upload_id: input.uploadId,
    p_model_id: model,
  });
  if (reserved.error) {
    const code = reserved.error.code;
    if (code === "P0403") throw new AiRequestError(403, "FORBIDDEN");
    if (code === "P0404") throw new AiRequestError(404, "NOT_FOUND");
    if (code === "P0409") throw new AiRequestError(409, "CONCURRENT_REQUEST");
    throw new AiRequestError(503, "AI_UNAVAILABLE");
  }
  const analysisId = reserved.data as string;
  const started = Date.now();
  let status: "success" | "rejected" | "timeout" | "error" = "error";
  let errorCode: string | null = "UNAVAILABLE";
  let resultJson: ReturnType<typeof parseAiSuggestion> | null = null;
  let inputHash: string | null = null;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  try {
    const upload = await admin
      .from("report_uploads")
      .select(
        "storage_path,mime_type,byte_size,width,height,uploaded_at,consumed_at,expires_at",
      )
      .eq("id", input.uploadId)
      .eq("created_by", input.userId)
      .maybeSingle();
    if (
      upload.error ||
      !upload.data ||
      upload.data.mime_type !== "image/webp" ||
      !upload.data.uploaded_at ||
      upload.data.consumed_at ||
      new Date(upload.data.expires_at).getTime() <= Date.now()
    )
      throw new AiRequestError(404, "NOT_FOUND");
    const downloaded = await admin.storage
      .from(reportBucket)
      .download(upload.data.storage_path);
    if (downloaded.error || !downloaded.data)
      throw new AiRequestError(503, "AI_UNAVAILABLE");
    const bytes = Buffer.from(await downloaded.data.arrayBuffer());
    if (
      !bytes.length ||
      bytes.length > maxImageBytes ||
      bytes.length !== upload.data.byte_size ||
      sniffImageType(bytes) !== "image/webp"
    )
      throw new AiRequestError(422, "INVALID_IMAGE");
    let metadata;
    try {
      metadata = await sharp(bytes, {
        failOn: "error",
        limitInputPixels: maxImagePixels,
        animated: false,
      }).metadata();
    } catch {
      throw new AiRequestError(422, "INVALID_IMAGE");
    }
    if (
      metadata.format !== "webp" ||
      metadata.width !== upload.data.width ||
      metadata.height !== upload.data.height ||
      metadata.exif ||
      metadata.xmp ||
      metadata.icc ||
      (metadata.pages ?? 1) > 1
    )
      throw new AiRequestError(422, "INVALID_IMAGE");
    inputHash = createHash("sha256").update(bytes).digest("hex");
    const response = await (
      input.adapter ??
      localTestAdapter() ??
      geminiAdapter
    ).analyze(bytes, model, timeoutMs, input.signal);
    inputTokens = response.inputTokens ?? null;
    outputTokens = response.outputTokens ?? null;
    resultJson = parseAiSuggestion(response.text);
    status = "success";
    errorCode = null;
  } catch (error) {
    if (error instanceof AiOutputError) {
      status = "rejected";
      errorCode = error.code;
    } else if (error instanceof AiProviderError) {
      status =
        error.code === "TIMEOUT"
          ? "timeout"
          : error.code === "REJECTED"
            ? "rejected"
            : "error";
      errorCode = error.code;
    } else if (error instanceof AiRequestError) {
      status = "rejected";
      errorCode = error.code;
    } else {
      status = "error";
      errorCode = "UNAVAILABLE";
    }
  }
  const saved = await admin
    .from("ai_analyses")
    .update({
      status,
      result_json: resultJson,
      input_hash: inputHash,
      completed_at: new Date().toISOString(),
      duration_ms: Math.min(Date.now() - started, 120000),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      error_code: errorCode,
    })
    .eq("id", analysisId)
    .eq("request_user_id", input.userId)
    .eq("status", "processing")
    .select("id");
  if (saved.error || saved.data?.length !== 1)
    throw new AiRequestError(503, "AI_UNAVAILABLE");
  if (status === "success" && resultJson)
    return { analysisId, suggestion: resultJson };
  if (errorCode === "RATE_LIMIT") throw new AiRequestError(429, "RATE_LIMIT");
  if (errorCode === "TIMEOUT") throw new AiRequestError(503, "AI_TIMEOUT");
  if (status === "rejected") throw new AiRequestError(502, "AI_INVALID_OUTPUT");
  throw new AiRequestError(503, "AI_UNAVAILABLE");
}
