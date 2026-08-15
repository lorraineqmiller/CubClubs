import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Report a bug or leave a suggestion for CubClubs.",
  robots: { index: false },
};

export default function FeedbackPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>
        <span aria-hidden="true" className="mx-2 text-faint">
          /
        </span>
        <span>Feedback</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight">Feedback</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          CubClubs is still in the early stages of development and we would greatly appreciate any suggestions for improvement
        </p>
      </header>

      <div className="mt-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
