// DengueWatch symbol: a water drop with a check mark ("Temukan. Tindak. Tuntaskan.").
export function BrandMark({
  inverse = false,
  className = "size-7",
}: {
  inverse?: boolean;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 32 32"
    >
      <path
        d="M16 2.5C16 2.5 5.5 13.6 5.5 19.8a10.5 10.5 0 0 0 21 0C26.5 13.6 16 2.5 16 2.5Z"
        fill={inverse ? "#9fe0d3" : "#0f766e"}
      />
      <path
        d="M11.2 19.6l3.4 3.4 6.4-6.6"
        stroke={inverse ? "#13241b" : "#ffffff"}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.6"
      />
    </svg>
  );
}
