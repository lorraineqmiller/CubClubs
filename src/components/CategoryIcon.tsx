import Image from "next/image";
import { CATEGORY_ICONS } from "@/lib/category-icons";

/**
 * The icon that replaced each category/interest's emoji. A fixed-size box
 * around the `<Image>` (not just the image itself) for the same reason the
 * emoji span it replaces used one — sizing the box, not the glyph, is what
 * keeps it centered next to text whose own line-height doesn't match the
 * asset's intrinsic metrics. Renders nothing for an unrecognized slug rather
 * than a broken image, though every seeded category has a match — see
 * CATEGORY_ICONS.
 */
export function CategoryIcon({
  slug,
  size = 16,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  const icon = CATEGORY_ICONS[slug];
  if (!icon) return null;
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex shrink-0 items-center justify-center leading-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
    >
      <Image
        src={icon}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
