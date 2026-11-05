import Image from "next/image";
import Link from "next/link";
import { BrandMark } from "@/components/layout/BrandMark";
import logo from "@/assets/brand/logo.png";
import logoInverse from "@/assets/brand/logo-inverse.png";

const sizeClasses = {
  sm: "h-6 w-auto sm:h-7",
  md: "h-7 w-auto sm:h-8",
  lg: "h-10 w-auto sm:h-12",
};

const markSizeClasses = {
  sm: "size-6",
  md: "size-7",
  lg: "size-10",
};

// `compact` keeps only the mark visible on very narrow screens (<380px);
// the full horizontal logo stays visible on standard screens.
export function Brand({
  inverse = false,
  compact = false,
  size = "md",
  className = "",
  href = "/",
}: {
  inverse?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  href?: string;
}) {
  const currentLogo = inverse ? logoInverse : logo;

  return (
    <Link
      aria-label="DengueWatch"
      className={`inline-flex items-center gap-2 rounded-lg font-bold tracking-[-0.025em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] ${className}`}
      href={href}
    >
      {compact ? (
        <>
          <span className="hidden min-[380px]:inline-flex items-center">
            <Image
              alt="DengueWatch"
              className={`${sizeClasses[size]} object-contain`}
              priority
              src={currentLogo}
            />
          </span>
          <span className="inline-flex min-[380px]:hidden items-center">
            <BrandMark className={markSizeClasses[size]} inverse={inverse} />
            <span className="sr-only">DengueWatch</span>
          </span>
        </>
      ) : (
        <Image
          alt="DengueWatch"
          className={`${sizeClasses[size]} object-contain`}
          priority
          src={currentLogo}
        />
      )}
    </Link>
  );
}
