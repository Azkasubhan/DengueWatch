import "server-only";

import { AiProviderError, type AiAdapter } from "@/features/ai/gemini";

// Explicit local-only adapter for deterministic browser tests. Never active in production.
export function localTestAdapter(scenario?: string | null): AiAdapter | null {
  if (
    process.env.AI_TEST_ADAPTER !== "deterministic" ||
    process.env.NODE_ENV === "production"
  )
    return null;
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return null;
  } catch {
    return null;
  }
  return {
    async analyze() {
      if (scenario === "unavailable") throw new AiProviderError("UNAVAILABLE");
      if (scenario === "timeout") throw new AiProviderError("TIMEOUT");
      return {
        text: JSON.stringify({
          visibleObjects: ["wadah air terbuka", "air terlihat di dalam wadah"],
          suggestedCategory: "water_container",
          draftDescription:
            "Foto tampak menunjukkan wadah terbuka yang berisi air dan perlu diperiksa lebih lanjut.",
          suggestedPrecaution:
            "Periksa dan kosongkan genangan jika aman dilakukan.",
          requiresHumanVerification: true,
          limitations:
            "Foto tidak dapat memastikan adanya jentik atau spesies nyamuk.",
        }),
        inputTokens: 1,
        outputTokens: 1,
      };
    },
  };
}
