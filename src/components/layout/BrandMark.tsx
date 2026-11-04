import Image from "next/image";
import logoMark from "@/assets/brand/logo-mark.png";
import logoMarkInverse from "@/assets/brand/logo-mark-inverse.png";

// DengueWatch mark: loop with mosquito larva inside ("Temukan. Tindak. Tuntaskan.").
export function BrandMark({
  inverse = false,
  className = "size-7",
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={`${className} object-contain`}
      height={32}
      priority
      src={inverse ? logoMarkInverse : logoMark}
      width={32}
    />
  );
}
