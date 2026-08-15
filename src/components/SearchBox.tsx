"use client";

import { useSearchParams } from "next/navigation";

/**
 * Search box that submits to /clubs as a plain GET form.
 *
 * No controlled state and no effect syncing the input to the URL: the `key`
 * remounts the field whenever the query changes, so navigation (back button, a
 * filter link that clears the search) is reflected for free. It also means
 * search works with JavaScript disabled.
 */
export function SearchBox({ compact = false }: { compact?: boolean }) {
  const params = useSearchParams();
  const query = params.get("q") ?? "";
  const inputId = compact ? "search-nav" : "search-hero";

  return (
    <form key={query} role="search" action="/clubs" method="get" className="relative">
      <label htmlFor={inputId} className="sr-only">
        Search clubs
      </label>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint ${
          compact ? "size-4" : "size-5"
        }`}
      >
        <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="m13.5 13.5 3.5 3.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
      <input
        id={inputId}
        name="q"
        type="search"
        defaultValue={query}
        // Search covers descriptions as well as names, so "hackathon" or
        // "a cappella" works even when no club is called that.
        placeholder={compact ? "Search clubs" : "Search clubs, e.g. a cappella…"}
        autoComplete="off"
        className={`w-full rounded-lg border border-line bg-surface text-text placeholder:text-faint focus:border-accent-ring ${
          compact ? "py-1 pl-9 pr-3 text-sm" : "py-2 pl-11 pr-4 text-base"
        }`}
      />
    </form>
  );
}
