import Image from "next/image";

/**
 * Official Loutakis "LOUTAKIS" wordmark, extracted from the brand asset
 * LOGO/LOUTAKISnoRE.svg and rendered as a transparent PNG.
 * variant: "black" for light backgrounds, "white" for dark backgrounds.
 */
export default function Logo({
  height = 22,
  variant = "black",
  className,
}: {
  height?: number;
  variant?: "black" | "white";
  className?: string;
}) {
  const src = `/brand/loutakis-wordmark-${variant}.png`;
  // intrinsic artwork ratio 487 × 43
  const width = Math.round((487 / 43) * height);
  return (
    <Image
      className={className}
      src={src}
      alt="Loutakis Real Estate"
      width={width}
      height={height}
      priority
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
