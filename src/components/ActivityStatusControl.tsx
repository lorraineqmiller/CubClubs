"use client";

import { useTransition } from "react";
import {
  setClubActivityStatus,
  type ActivityStatusValue,
} from "@/app/admin/actions";

const OPTIONS: Array<{ value: ActivityStatusValue; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "AWAITING_VERIFICATION", label: "Awaiting verification" },
];

/**
 * Inline on the club's own page rather than a separate admin screen — this
 * is exactly where an admin already is when they'd naturally decide to
 * verify a club, and only ever renders when `isAdmin()` is true (checked by
 * the server component that renders this).
 */
export function ActivityStatusControl({
  clubId,
  currentStatus,
}: {
  clubId: string;
  currentStatus: ActivityStatusValue;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-line bg-surface-2 p-2.5">
      <span className="text-xs font-medium text-faint">
        Moderator: set activity status
      </span>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={pending || currentStatus === option.value}
          onClick={() =>
            startTransition(() => void setClubActivityStatus(clubId, option.value))
          }
          className={[
            "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-default",
            currentStatus === option.value
              ? "border-accent bg-accent-soft text-accent"
              : "border-line text-muted hover:border-accent-ring hover:text-accent",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
