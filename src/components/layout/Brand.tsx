import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";

// `compact` keeps only the mark visible on very narrow screens; the name stays readable to
// screen readers.
export function Brand({
  inverse = false,
  compact = false,
}: {
  inverse?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      className="inline-flex items-center gap-2 font-bold tracking-[-0.025em]"
      href="/"
    >
      <BrandMark inverse={inverse} />
      <span
        className={`inline-flex items-baseline gap-1.5 ${compact ? "max-[379px]:sr-only" : ""}`}
      >
        <span
          className={`text-xl ${inverse ? "text-white" : "text-[var(--foreground)]"}`}
        >
          Dengue
        </span>
        <span
          className={`text-xl ${inverse ? "text-[var(--mint)]" : "text-[var(--primary)]"}`}
        >
          Watch
        </span>
      </span>
    </Link>
  );
}
