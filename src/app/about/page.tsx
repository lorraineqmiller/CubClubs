import type { Metadata } from "next";
import Link from "next/link";
import { RATING_DIMENSIONS } from "@/lib/ratings";

export const metadata: Metadata = {
  title: "About",
  description:
    "What CubClubs is.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">About us</h1>

      <div className="mt-8 space-y-10 text-sm leading-relaxed">
        <section className="space-y-3">
          <p>
            CubClubs is an anonymous platform for rating and reviewing student organizations 
            at Columbia University and Barnard College.
          </p>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Where club information comes from
          </h2>
          <p>
            Clubs, descriptions, and contact details are imported from{" "}
            <a
              href="https://undergrad.admissions.columbia.edu/life/here/clubs/listings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              Columbia&apos;s undergraduate student group directory
            </a>{" "}
            and{" "}
            <a
              href="https://barnard.edu/student-organizations"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline"
            >
              Barnard&apos;s student organizations directory
            </a>
          </p>
          <p>
            The interest area tags (Computer Science, Finance, Engineering, etc.) are inferred from names and descriptions.
            You may report inaccurate information by going to a club's review page and clicking 
            the &quot;Suggest an edit&quot; button.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Adding clubs
          </h2>
          <p>
            If an active club isn&apos;t listed at all —{" "}
            <Link href="/clubs/new" className="text-accent underline">
              add it
            </Link>
            . This includes new groups and existing ones that are not officially Columbia-affiliated.
          </p>
        </section>

        <section id="moderation" className="scroll-mt-20 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">Moderation</h2>
          <p>
            Every review sits unpublished until a moderator approves it to ensure 
            there is no spam or harmful content. Anyone can report a review after it's live.
          </p>
          <p>
            We remove reviews that identify individual students, harass someone,
            or aren&apos;t about the club. We will never remove reviews for simply being
            negative.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold tracking-tight">
            Attributions
          </h2>
          <p className="text-xs text-muted">
            <a href="https://www.flaticon.com/free-icons/microscope" title="microscope icons">Microscope icons created by Magnific - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/medal" title="medal icons">Medal icons created by Pixel Buddha - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/globe" title="globe icons">Globe icons created by IconsNova - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/greek-temple" title="greek temple icons">Greek temple icons created by Flat Icons - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/agreement" title="agreement icons">Agreement icons created by Magnific - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/newspaper" title="newspaper icons">Newspaper icons created by smalllikeart - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/music" title="music icons">Music icons created by Magnific - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/mask" title="mask icons">Mask icons created by Hilmy Abiyyu A. - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/megaphone" title="megaphone icons">Megaphone icons created by Magnific - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/briefcase" title="briefcase icons">Briefcase icons created by juicy_fish - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/stones" title="stones icons">Stones icons created by Magnific - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/outreach" title="outreach icons">Outreach icons created by gravisio - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/playing-cards" title="playing cards icons">Playing cards icons created by Vectorslab - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/elections" title="elections icons">Elections icons created by juicy_fish - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/code" title="code icons">Code icons created by juicy_fish - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/finance" title="finance icons">Finance icons created by Smashicons - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/medical" title="medical icons">Medical icons created by Magnific - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/recycle" title="recycle icons">Recycle icons created by Pixel perfect - Flaticon</a>
            <a href="https://www.flaticon.com/free-icons/palette" title="palette icons">Palette icons created by Magnific - Flaticon</a>
          </p>
        </section>
      </div>
    </div>
  );
}
