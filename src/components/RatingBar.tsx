import { DIMENSION_BY_KEY, scaleWord, type RatingKey } from "@/lib/ratings";

/**
 * One rating dimension as a labelled bar, however many points its scale has
 * (Organization is 3, the rest are 5 — see RATING_DIMENSIONS).
 *
 * Commitment is styled differently on purpose: it's descriptive, not a score,
 * so it gets a neutral track and no "/N" — a demanding club isn't a badly
 * rated one, and colouring it like the evaluative dimensions would imply it is.
 */
export function RatingBar({
  dimension,
  value,
  size = "default",
}: {
  dimension: RatingKey;
  value: number | null;
  size?: "default" | "compact";
}) {
  const dim = DIMENSION_BY_KEY[dimension];
  const max = dim.scale.length;
  const word = scaleWord(dimension, value);
  const pct = value == null ? 0 : ((value - 1) / (max - 1)) * 100;
  const compact = size === "compact";

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`font-medium ${compact ? "text-xs" : "text-sm"} text-text`}
        >
          {dim.label}
        </span>
        {value == null ? (
          <span className={`${compact ? "text-xs" : "text-sm"} text-faint`}>
            No ratings yet
          </span>
        ) : (
          <span className={`${compact ? "text-xs" : "text-sm"} text-muted`}>
            <span className="tnum font-semibold text-text">
              {value.toFixed(1)}
            </span>
            {dim.evaluative && <span className="text-faint">/{max}</span>}
            <span className="ml-2 text-muted">{word}</span>
          </span>
        )}
      </div>
      <div
        className={`overflow-hidden rounded-full bg-surface-2 ${
          compact ? "h-1.5" : "h-2"
        }`}
        role="img"
        aria-label={
          value == null
            ? `${dim.label}: no ratings yet`
            : `${dim.label}: ${value.toFixed(1)} out of ${max} — ${word}`
        }
      >
        <div
          className={`h-full rounded-full ${
            dim.evaluative ? "bg-accent" : "bg-line-strong"
          }`}
          style={{ width: `${Math.max(value == null ? 0 : 4, pct)}%` }}
        />
      </div>
    </div>
  );
}

/** Compact pip row, for review cards where a full bar would dominate. */
export function RatingPips({
  dimension,
  value,
}: {
  dimension: RatingKey;
  value: number;
}) {
  const dim = DIMENSION_BY_KEY[dimension];
  const steps = Array.from({ length: dim.scale.length }, (_, i) => i + 1);
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">{dim.label}</span>
      <span
        className="flex items-center gap-0.5"
        role="img"
        aria-label={`${value} out of ${steps.length} — ${scaleWord(dimension, value)}`}
      >
        {steps.map((step) => (
          <span
            key={step}
            className={`size-1.5 rounded-full ${
              step <= value
                ? dim.evaluative
                  ? "bg-accent"
                  : "bg-line-strong"
                : "bg-surface-2"
            }`}
          />
        ))}
      </span>
      <span className="tnum text-xs font-medium text-text">{value}</span>
    </div>
  );
}
