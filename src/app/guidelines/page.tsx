import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Review guidelines",
  description:
    "What makes a useful review, and what gets removed.",
};

const DO = [
  "Constructive criticism",
  "Specificity about the club's activities",
  "Why you would/wouldn't recommend this club to a friend",
];

const DONT = [
  "Naming individual students",
  "Lies about a club",
  "Excessive disrespect",
];

export default function GuidelinesPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Review guidelines
      </h1>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"> What makes a good review
        </h2>
        <ul className="mt-4 space-y-2.5">
          {DO.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">What gets removed
        </h2>
        <ul className="mt-4 space-y-2.5">
          {DONT.map((item) => (
            <li
              key={item}
              className="rounded-lg border border-line bg-surface px-4 py-3 text-sm leading-relaxed"
            >
              {item}
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
        Want to report something? Use the <strong>Report</strong> link on the review
        itself.
      </p>
    </div>
  );
}
