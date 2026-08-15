import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "./globals.css";
import { SearchBox } from "@/components/SearchBox";

import { Geist_Mono, DynaPuff, Dongle } from "next/font/google";

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const dynaPuff = DynaPuff({ variable: "--font-dynapuff", subsets: ["latin"] });

// Dongle is not a variable font — the weights have to be listed. The UI uses
// font-medium (500) and font-semibold (600), which have no Dongle cut; CSS font
// matching resolves 500 down to 400 and 600 up to 700, so "semibold" text comes
// out bold. That's the intended look here rather than a fallback.
const dongle = Dongle({
  variable: "--font-dongle",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "CubClubs",
    template: "%s · CubClubs",
  },
  description:
    "Honest, anonymous reviews of Columbia and Barnard student organizations — how hard they are to get into, what you get out of them, and what they're actually like.",
};

/**
 * The wordmark keeps DynaPuff while everything else is Dongle. `optical-reset`
 * divides out the Dongle size multiplier — DynaPuff has normal metrics and
 * would otherwise render 70% too large.
 */
function Wordmark() {
  return (
    <Link
      href="/"
      className="group text-2xl font-semibold tracking-wide"
    >
      {/* optical-reset has to live on a child, not this Link: its `calc(1em /
          1.7)` resolves against the *inherited* font-size, so putting it on
          the same element as text-2xl would just discard text-2xl outright
          rather than scaling it down. */}
      <span
        className="optical-reset flex items-baseline"
        style={{ fontFamily: "var(--font-dynapuff)" }}
      >
        <span className="text-accent group-hover:text-accent-hover">Cu</span>
        <span className="text-accent-muted">bClubs</span>
      </span>
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${dongle.variable} ${geistMono.variable} ${dynaPuff.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:text-on-accent"
        >
          Skip to content
        </a>

        <header className="site-header sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Wordmark />
            <nav className="order-3 flex items-center gap-5 text-sm text-muted sm:order-2">
              <Link href="/clubs" className="hover:text-accent">
                browse
              </Link>
              <Link href="/about" className="hover:text-accent">
                about
              </Link>
            </nav>
            <div className="order-2 ml-auto w-full sm:order-3 sm:w-72">
              {/* SearchBox reads the URL query, which opts any page containing
                  it out of static prerendering unless it sits behind Suspense.
                  The fallback matches the input's height so the header doesn't
                  jump as it hydrates. */}
              <Suspense fallback={<div className="h-[30px]" />}>
                <SearchBox compact />
              </Suspense>
            </div>
          </div>
        </header>

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="mt-20 border-t border-line bg-surface">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
            <div className="space-y-2">
              <Wordmark />
              <p className="max-w-xs text-muted"> <br></br>
                admin@cubclubs.com
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                Feedback
              </h3>
              <ul className="space-y-1.5 text-muted">
                <li>
                  <Link href="/feedback" className="hover:text-accent">
                    Report a bug / make a suggestion
                  </Link>
                </li>
                <li>
                  <Link href="/clubs/new" className="hover:text-accent">
                    Add a club
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                Information
              </h3>
              <ul className="space-y-1.5 text-muted">
                <li>
                  <Link href="/about" className="hover:text-accent">
                    About CubClubs
                  </Link>
                </li>
                <li>
                  <Link href="/guidelines" className="hover:text-accent">
                    Review Guidelines
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-line">
            <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-faint sm:px-6">
              CubClubs is an independent student project. It is not affiliated with,
              endorsed by, or operated by Columbia University or Barnard College.
              Club listings are derived from Columbia&apos;s and Barnard&apos;s public
              student organizations directories; reviews are the opinions of their authors.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
