export type ActivityStatus = "ACTIVE" | "INACTIVE" | "AWAITING_VERIFICATION";

const STATUS_META: Record<
  ActivityStatus,
  { label: string; textClass: string; borderClass: string; bgClass: string }
> = {
  ACTIVE: {
    label: "Active",
    textClass: "text-positive",
    borderClass: "border-positive/40",
    bgClass: "bg-positive/5",
  },
  INACTIVE: {
    label: "Inactive",
    textClass: "text-danger",
    borderClass: "border-danger/40",
    bgClass: "bg-danger/5",
  },
  AWAITING_VERIFICATION: {
    label: "Awaiting verification",
    textClass: "text-faint",
    borderClass: "border-line",
    bgClass: "bg-surface-2",
  },
};

function formatVerifiedDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/**
 * Whether a club is still meeting — set by a moderator (see
 * `setClubActivityStatus`), never scraped or inferred. The hover title is
 * the entire "as of" affordance; no JS tooltip library needed, same as the
 * community/Barnard badges elsewhere in this app.
 *
 * `size="sm"` matches the compensated bracket-value text sizes used inside
 * ClubCard; the default matches the plain `text-xs` pills already used in
 * the club detail page's header.
 */
export function ActivityBadge({
  status,
  verifiedAt,
  size = "default",
}: {
  status: ActivityStatus;
  verifiedAt: Date | null;
  size?: "default" | "sm";
}) {
  const meta = STATUS_META[status];
  const title = verifiedAt
    ? `As of ${formatVerifiedDate(verifiedAt)}`
    : "Not yet verified by a moderator";

  return (
    <span
      title={title}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        meta.borderClass,
        meta.bgClass,
        meta.textClass,
        size === "sm" ? "px-2 py-0.5 text-[17px]" : "px-2.5 py-1 text-xs",
      ].join(" ")}
    >
      <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}
