> *Site to be published by September 2026*

# CubClubs

Anonymous reviews of student organizations at Columbia and Barnard — CULPA, but
for clubs. Every review rates four things and can attach tags describing what
the club is actually like.

Next.js (App Router) · Postgres via Prisma · Tailwind.

---

## Running it locally

You need Node 20+ and a Postgres database. If you don't have Postgres installed,
Prisma ships a local one that needs no Docker.

```bash
npm install
```

Start the local database in its own terminal and leave it running:

```bash
npx prisma dev --name cubclubs
```

Then, in your main terminal:

```bash
cp .env.example .env
npm run db:url          # fills DATABASE_URL from the running local database
npx prisma migrate dev  # creates the tables
npm run seed:demo       # clubs + categories + tags + example reviews
npm run dev
```

Open http://localhost:3000.

Before going anywhere near production, replace the two secrets in `.env`:

```bash
openssl rand -hex 32
```

`REVIEW_HMAC_SECRET` keys the IP hashes used for rate limiting — rotating it
just resets those counters, nothing more. `ADMIN_TOKEN` guards `/admin`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run seed` | Categories, tags, and clubs from `data/clubs.json` |
| `npm run seed:demo` | The above plus example reviews (refuses to run with `NODE_ENV=production`) |
| `npm run scrape` | Re-scrape Columbia's directory into `data/clubs.json` |
| `npm run classify:report` | Dry-run category assignment; add a slug (e.g. `-- cs`) to audit one interest area |
| `npm run db:url` | Sync `DATABASE_URL` from the running `prisma dev` server |
| `python3 scripts/make-icons.py` | Rebuild the favicon set from `assets/logo.png` |

---

## About the club data

Clubs come from Columbia's [undergraduate student group
directory](https://undergrad.admissions.columbia.edu/life/here/clubs/listings):

- **476 clubs**, on a single page with no pagination.
- **Already grouped under 14 category headings**, so a club's primary category
  is read from the source rather than guessed.
- Each row links to a `/studentgroup/<slug>` profile, which gives us a
  **description (434 of 476), a website (284), and a contact email (351)**.

The directory is undergraduate-focused, so graduate and professional-school
organizations mostly aren't in it.

Barnard's [student organizations page](https://barnard.edu/student-organizations)
is scraped too, but it's a much thinner source: ~80 clubs on one static page,
grouped under its own 7 headings (mapped onto the closest Columbia category —
see `BARNARD_HEADING_TO_SLUG` in `scripts/classify.ts` — rather than given
separate categories, so "Browse by category" stays one 14-tile grid), and no
per-club detail page at all: the listing's one link per club (almost always a
mailto, sometimes a social profile) is the entire dataset, classified into
contact/website/social by `classifyBarnardHref` in `scripts/scrape.ts`.

Barnard's list deliberately includes clubs that are jointly Columbia-Barnard
(Bach Society, Philolexian Society — Barnard students can join Columbia clubs
and vice versa), not just Barnard-exclusive ones. `npm run seed` treats an
exact name match against an already-seeded club as the same real club rather
than a second page for it, since there's no shared id between the two
directories to detect this with otherwise — Columbia clubs seed first, so a
same-named Barnard entry reaching the loop later is recognized and skipped.
`Club.school` (`COLUMBIA` | `BARNARD`) records which directory a club actually
came from; Barnard-sourced clubs get a small badge on their card and page.

### Two layers of category

**Source categories** are Columbia's own 14 headings. Authoritative, exhaustive,
one per club, not inferred. If the directory renames a heading, seeding fails
loudly rather than silently dropping those clubs.

**Interest areas** (CS, Engineering, Finance, Law, Health, Environment) are
*ours*. Columbia files every tech and finance club under "Academic" or
"Pre-Professional" next to debate societies and pre-law groups, which is useless
if what you want is the CS clubs. These are inferred from name + description by
the rules in `scripts/classify.ts`, corrected by `data/overrides.json`, and
displayed separately in the UI so nobody mistakes them for the university's own
classification.

Audit them before trusting them:

```bash
npm run classify:report
```

```bash
npm run classify:report -- cs
```

The second form lists a category's members **with the pattern and the exact word
that matched**, which exists because matching against real prose fails in
non-obvious ways. The instructive case: a bare `/programming/` pattern put a
radio station, three religious communities and a heritage month into Computer
Science, because in university writing "programming" means events. Similarly
"Columbia Engineering" is the *school's name*, so it appeared in descriptions of
the yearbook and a Catholic ministry — institutional names are now stripped
before matching. Neither was visible from counts alone.

### Scraping notes

Columbia's host doesn't rate-limit the way `www.columbia.edu` does (a burst of
requests returns 200s), but the scraper is still polite and resumable: requests
are delayed, detail pages already fetched are skipped on re-runs, and
`data/fixtures/` holds a committed copy of both listing pages so seeding never
needs the network. Barnard has no detail-page phase to resume — one request
gets the whole thing — so it's just re-fetched every run.

```bash
npm run scrape                  # both schools' listings + any missing Columbia detail pages
npm run scrape -- --offline     # parse the committed fixtures, no requests
npm run scrape -- --no-details  # listings only, no Columbia detail pages
npm run scrape -- --limit 25    # fetch at most 25 Columbia detail pages this run
npm run scrape -- --refresh     # refetch every detail page
```

A full run is ~476 requests and takes about two minutes.

### Re-seeding after a source change

`npm run seed` is idempotent and keyed on the source slug. Four rules worth
knowing:

- **Categories no longer in `CATEGORIES` are deleted.** Club↔category links are
  fully derived, so this is safe — and without it a renamed category lingers
  forever showing a count of zero.
- **Clubs no longer in the directory are left alone** unless you pass
  `--prune`. A club vanishing from the source is usually a directory edit, not
  grounds for destroying the reviews people wrote about it. The seed prints how
  many reviews would be lost before you decide.
- **Community clubs are never pruned**, whatever flags you pass. They aren't in
  `clubs.json` by definition, so a naive prune would delete every one of them.
- **Fields with approved community edits are never overwritten.** See below.

Tags are never auto-pruned: reviewers attach them to reviews, so removing one
would take real review content with it.

---

## Community contributions

Two moderator-gated flows let students improve the data:

- **`/clubs/<slug>/suggest`** — prefilled with the club's current values. Only
  fields that actually differ are sent, so the moderator sees a small diff
  rather than a wall of unchanged text.
- **`/clubs/new`** — for clubs that aren't in Columbia's directory: new groups,
  ones still going through recognition, and ones that never got listed.

Both appear in `/admin`. Approving an edit applies it; approving a submission
creates the club.

### Why no email verification here

Same reasoning as reviews (see "How anonymity works" below): a human approves
every contribution before it's visible, so the content is already gated, and
demanding a verified student address on top of that would be friction with
nothing behind it. Abuse is handled by IP rate limits (`LIMITS.suggestEdit`,
`LIMITS.submitClub`) instead.

The optional submitter email **is** stored in the clear here, unlike anything
on a review — being able to reply to "the site moved, here's the new one" is
the entire point, and there's no anonymity promise to keep for a factual
correction.

### How approved edits survive a re-scrape

This is the part that would otherwise be a silent bug. `npm run seed` rewrites
club fields from `data/clubs.json` and replaces categories wholesale, so an
approved correction would be reverted by the next import — and nobody would
notice until the third time someone fixed the same broken URL.

So approving an edit records the affected field names in `Club.editedFields`
(e.g. `["websiteUrl", "socialLinks", "categories"]`), and the seed skips those
fields for that club. Community clubs are created with every field pinned, since
none of their data came from the directory.

To hand a field back to the directory, clear it from `editedFields`; the next
seed will overwrite it again.

### Community clubs are labelled as such

Clubs added this way carry `origin: COMMUNITY`, which drives a badge on the club
page and in listings. They're reviewable like any other club, but the site never
implies Columbia recognizes them — that distinction matters both to students
reading and to the university.

---

## How anonymity works

The promise to reviewers is simpler than it used to be: we never ask who you
are in the first place. No account, no email, nothing in the database that
could identify you even with full access to it.

The tradeoff is the thing that promise costs: we can't verify you're actually
a Columbia or Barnard student, and nothing stops the same person from
reviewing a club twice. A moderator reading every submission before it goes
live (see "Moderation" below) is the entire safeguard, deliberately, in place
of identity checks that would mean storing something about you.

What this does **not** protect against: a review whose text identifies its
author. That's why the form and the guidelines push against naming people.

---

## Moderation

Every review sits as `PENDING` until a moderator approves it in `/admin` —
approving publishes it for the first time, rejecting deletes the row outright
(there's nothing identifying to keep a record of). Once live, anyone can
report a review; at three reports it's automatically hidden (`FLAGGED`) and
reappears in the same queue, where a moderator keeps or removes it — that
decision (`REJECTED`) does keep the row, since unlike a fresh submission it
was actually live and the takedown is worth a record of. Either direction
recomputes the club's averages, since it changes what counts towards them.

`/admin` is gated by a single shared token in `ADMIN_TOKEN`, exchanged for an
httpOnly cookie. That's deliberate for a site with one or two moderators; the
cost is no per-moderator audit trail, which is the thing to replace if the team
grows.

---

## Design decisions worth knowing

**Difficulty to get in is not a score.** A brutally selective club is not a
badly rated one. It's stored and displayed alongside the other three ratings but
is never averaged into the overall number, renders with a neutral bar rather
than the accent colour, and is labelled with words ("Just show up" →
"Brutally selective") rather than a value out of five.

**Rating inputs are buttons, not radios.** React 19 resets a form after its
action completes — including on failure — and radio `checked` then desyncs from
React state, which silently wiped all four ratings on a failed submission. Every
field in the review form is controlled, and the ratings and tags carry their
values in hidden inputs.

**Aggregates are denormalized onto `Club`.** Recomputed on publish and on
moderation. Clubs are read constantly and reviewed rarely, so paying on write
keeps every list page to one query.

**Rate limiting is a Postgres table**, not an in-memory counter — serverless
instances don't share memory, so an in-process map would reset on cold start.

**The page background is baby blue; the homepage hero adds a grainy gradient.**
`.hero-canvas` in `globals.css` layers a white bloom over the text column, two
blue blooms pushed into the right and bottom-right corners, and an inline-SVG
noise tile. Grain strength is one variable, `--grain-opacity`.

The noise is mapped to *alpha* — dark speckle on a clear field — rather than
painted as grey pixels or blended with `overlay`. Both alternatives were tried
and are worse on a pale background: flat grey just desaturates the gradient, and
`overlay` moves colours this light by roughly ±3%, so turning its opacity up
barely registers. `numOctaves` is 1; more octaves add low-frequency detail that
reads as fog rather than grain.

Contrast was the constraint throughout. The blooms are capped and kept off the
text column, the gradient stops sit lighter than the flat background to offset
the ~10% the speckle darkens everything, and `--text-muted` was deepened to
`#47596b`. Body copy ends up at 5.7:1 on the flat background and ~4.9:1 over the
hero where text actually sits. The deep-blue corners are decorative only — if
you move content into them, re-check it. `prefers-contrast: more` drops the wash
entirely.

**Icons are generated, not hand-exported.** `assets/logo.png` is the source;
`python3 scripts/make-icons.py` writes `src/app/icon.png`, `favicon.ico` and
`apple-icon.png`, which Next picks up by filename with no wiring in
`layout.tsx`. It handles either kind of source. If the logo is already cut out it keeps that
alpha untouched — round-tripping it through flatten-and-unmix visibly roughens
every antialiased edge. If the logo sits on solid white it knocks the background
out by solving, per pixel, for the alpha that would have produced it from the
detected flat inks. The obvious shortcut — alpha from pixel darkness — silently
ruins this logo: the light blue letters come back near-black at ~34% alpha,
identical on white and wrong on a dark tab bar. Either way it crops the source's
wide margins, without which the letters are an unreadable smudge at 16px.

**Form inputs are filled with `surface-2`, never `--bg`.** They sit inside white
cards and want to look recessed; tying them to the page background turned every
input baby blue, which reads as disabled rather than editable.

**Contact emails render as text, not `mailto:` links.** They're club inboxes the
university already publishes, but turning 351 of them into harvestable links is
a favour to scrapers rather than to students. Anyone who wants one can copy it.

**A–Z sorts on a stripped name.** 84 of the 476 clubs begin with "Columbia", so
sorting on the raw name piles a fifth of the directory under C. `Club.sortName`
drops that prefix and any leading article; `name` is untouched for display.

**Approving a name change doesn't change the slug.** The slug is in every shared
link and every review URL. Renaming a club isn't worth breaking those, so
`name` and `slug` diverge and that's fine.

**`/clubs/new` shadows `/clubs/[slug]`.** Next resolves the static segment
first, so a club whose slug was `new` would be permanently unreachable — it'd
silently render the wrong page. `RESERVED_SLUGS` in `src/lib/slug.ts` prevents
that; add to it if you add more static routes under `/clubs/`.

**Interpolated text needs an explicit `{" "}`.** JSX drops the space between an
expression and a text run that wraps to the next line, which shipped
"Archery Clubis published" and "Collectiveis real" before being caught. Every
mid-sentence interpolation uses `{" "}` or puts the space inside the expression.

---

## Deploying

Any Node host works; Vercel is the path of least resistance. Point
`DATABASE_URL` at hosted Postgres (Neon, Supabase, RDS), set
`REVIEW_HMAC_SECRET` and `ADMIN_TOKEN`, then:

```bash
npx prisma migrate deploy && npm run seed
```

Run `npm run seed`, not `seed:demo` — the demo reviews are fabricated and have
no business on a live review site.

---

CubClubs is a student project. It is not affiliated with, endorsed by, or
operated by Columbia University or Barnard College.
