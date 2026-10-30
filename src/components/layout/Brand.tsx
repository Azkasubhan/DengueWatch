import Link from "next/link";

export function Brand() {
  return (
    <Link
      className="inline-flex items-baseline gap-1.5 font-bold tracking-[-0.025em]"
      href="/"
    >
      <span className="text-xl text-[var(--foreground)]">Dengue</span>
      <span className="text-xl text-[var(--primary)]">Watch</span>
    </Link>
  );
}
