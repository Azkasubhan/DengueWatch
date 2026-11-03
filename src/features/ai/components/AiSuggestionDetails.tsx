import { reportCategoryLabels } from "@/features/reports/validation";
import type { ReportCategory } from "@/features/reports/validation";

// One presentation of an AI suggestion, shared by the resident form and the cadre review page.
export function AiSuggestionDetails({
  category,
  visibleObjects,
  draftDescription,
  precaution,
  limitations,
}: {
  category: ReportCategory;
  visibleObjects: string[];
  draftDescription: string;
  precaution: string;
  limitations: string;
}) {
  return (
    <dl className="grid gap-3 text-sm">
      <div>
        <dt className="font-semibold">Kategori usulan</dt>
        <dd className="mt-0.5">{reportCategoryLabels[category]}</dd>
      </div>
      <div>
        <dt className="font-semibold">Yang tampak pada foto</dt>
        <dd className="mt-1 flex flex-wrap gap-1.5">
          {visibleObjects.map((object, index) => (
            <span
              className="rounded-full bg-[var(--sand)] px-2.5 py-0.5"
              key={`${index}-${object}`}
            >
              {object}
            </span>
          ))}
        </dd>
      </div>
      <div>
        <dt className="font-semibold">Deskripsi usulan</dt>
        <dd className="mt-0.5 break-words whitespace-pre-wrap">
          {draftDescription}
        </dd>
      </div>
      <div>
        <dt className="font-semibold">Saran pencegahan</dt>
        <dd className="mt-0.5 break-words whitespace-pre-wrap">{precaution}</dd>
      </div>
      <div>
        <dt className="font-semibold">Batasan</dt>
        <dd className="mt-0.5 break-words whitespace-pre-wrap text-[var(--muted-foreground)]">
          {limitations}
        </dd>
      </div>
    </dl>
  );
}
