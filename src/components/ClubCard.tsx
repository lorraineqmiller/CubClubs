import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ActivityBadge, type ActivityStatus } from "@/components/ActivityBadge";
import { CategoryIcon } from "@/components/CategoryIcon";
import briefcaseIcon from "@/app/briefcase.png";
import happyFriendsIcon from "@/app/happy-friends.png";

export type ClubCardData = {
  slug: string;
  name: string;
  origin: "DIRECTORY" | "COMMUNITY";
  school: "COLUMBIA" | "BARNARD";
  activityStatus: ActivityStatus;
  activityVerifiedAt: Date | null;
  description: string | null;
  reviewCount: number;
  avgProfessional: number | null;
  avgSocial: number | null;
  categories: Array<{ name: string; slug: string; isPrimary: boolean }>;
  tags: Array<{ label: string; slug: string }>;
};

/**
 * Static swatch fill — the same shade regardless of rating (previously this
 * mixed toward --accent as the value rose; now it's pinned to what that
 * scale used to render at a 1.0, i.e. pure --accent-soft). The icon + number
 * carry the actual signal now, not the background color.
 */
function ratingTintStyle(value: number | null): CSSProperties {
  if (value == null) return { backgroundColor: "var(--surface-2)" };
  return { backgroundColor: "var(--accent-soft)" };
}

/**
 * One labeled color swatch in the card's left rail. The label sits at the
 * bottom rather than centered — with two stacked unequal-feeling boxes, a
 * bottom-anchored label reads more like a chart axis than a centered caption.
 * The icon + numeric average sit above it, on top of the same color fill —
 * the icon says which dimension at a glance, the number gives the precision
 * the color alone can't.
 */
function RatingSwatch({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: typeof briefcaseIcon;
}) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-end gap-1 px-1 pb-2 pt-3 text-center"
      style={ratingTintStyle(value)}
      title={value == null ? `${label}: no data` : `${label}: ${value.toFixed(1)} / 5`}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <Image
          src={icon}
          alt=""
          width={24}
          height={24}
          className="dark:invert"
        />
        <span className="tnum text-sm font-bold leading-none text-text">
          {value == null ? "—" : value.toFixed(1)}
        </span>
      </div>
      <span className="text-xs font-medium leading-tight text-text">{label}</span>
    </div>
  );
}

export function ClubCard({ club }: { club: ClubCardData }) {
  const primary =
    club.categories.find((c) => c.isPrimary) ?? club.categories[0];
  const others = club.categories.filter((c) => c !== primary);
  const hasReviews = club.reviewCount > 0;

  return (
    <li className="group relative flex overflow-hidden rounded-xl border border-line bg-surface shadow-card transition-colors hover:border-accent-ring">
      {hasReviews ? (
        <div className="flex w-20 shrink-0 flex-col border-r border-line">
          <RatingSwatch label="Fun" value={club.avgSocial} icon={happyFriendsIcon} />
          <RatingSwatch
            label="Career"
            value={club.avgProfessional}
            icon={briefcaseIcon}
          />
        </div>
      ) : (
        <div className="flex w-20 shrink-0 flex-col items-center justify-center border-r border-dashed border-line text-center text-xs leading-snug text-faint">
          <span>No</span>
          <span>reviews</span>
        </div>
      )}

      <div className="min-w-0 flex-1 p-4">
        <h3 className="text-[26px] font-semibold leading-snug">
          <Link
            href={`/clubs/${club.slug}`}
            className="text-text group-hover:text-accent"
          >
            {/* Stretched link so the whole card is clickable without nesting
                interactive elements. */}
            <span className="absolute inset-0" aria-hidden="true" />
            {club.name}
          </Link>
        </h3>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {primary && (
            <span className="inline-flex items-center gap-1.5">
              <CategoryIcon slug={primary.slug} />
              {primary.name}
            </span>
          )}
          {others.length > 0 && (
            <span className="text-faint">+{others.length} more</span>
          )}
          <ActivityBadge
            status={club.activityStatus}
            verifiedAt={club.activityVerifiedAt}
            size="sm"
          />
          <span aria-hidden="true" className="text-faint">
            ·
          </span>
          <span>
            {club.reviewCount === 0
              ? "Be the first to review"
              : `${club.reviewCount} review${club.reviewCount === 1 ? "" : "s"}`}
          </span>
        </p>

        {club.description && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
            {club.description}
          </p>
        )}

        {club.tags.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {club.tags.slice(0, 3).map((tag) => (
              <li
                key={tag.slug}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-sm text-muted"
              >
                {tag.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}
