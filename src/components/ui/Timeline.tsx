import { cardClass } from "@/components/ui/Card";

export type TimelineItem = {
  id: string;
  label: string;
  reason?: string | null;
  time: string;
};

// Append-only history (report or task events), newest last as stored.
export function Timeline({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: TimelineItem[];
}) {
  return (
    <section aria-labelledby={id} className={cardClass}>
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      <ol className="mt-4 grid gap-4 pl-5">
        {items.map((item, index) => (
          // The connector runs from this dot to the next one, so the latest entry ends the line.
          // Its -bottom offset is gap-4 (1rem) + the dot's top-1.5 (0.375rem); keep them in sync.
          <li
            className="relative before:absolute before:top-1.5 before:-bottom-[1.375rem] before:-left-5 before:w-px before:bg-[var(--border)] last:before:hidden"
            key={item.id}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-[var(--surface)] ${index === items.length - 1 ? "bg-[var(--primary)]" : "bg-[var(--control-border)]"}`}
            />
            <p className="font-semibold">{item.label}</p>
            {item.reason ? (
              <p className="mt-1 whitespace-pre-wrap break-words">
                {item.reason}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {item.time}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
