import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      className="inline-flex items-center gap-2 font-bold tracking-[-0.025em]"
      href="/"
    >
      <BrandMark inverse={inverse} />
      <span className="inline-flex items-baseline gap-1.5">
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
