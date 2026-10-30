import type { ComponentPropsWithoutRef } from "react";

type ContainerProps = ComponentPropsWithoutRef<"div"> & {
  size?: "page" | "form";
};

export function Container({
  className = "",
  size = "page",
  ...props
}: ContainerProps) {
  const width =
    size === "form" ? "max-w-[var(--form-max)]" : "max-w-[var(--page-max)]";

  return (
    <div
      className={`mx-auto w-full ${width} px-4 sm:px-6 lg:px-8 ${className}`}
      {...props}
    />
  );
}
