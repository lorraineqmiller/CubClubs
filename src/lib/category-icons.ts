import type { StaticImageData } from "next/image";

// One PNG per category, replacing the emoji that used to sit next to its
// name. Sourced from the label-icons/ folder at the repo root — kept there
// rather than moved under src/ since that's where they were provided and
// nothing else needs them relocated for Next's static-import bundling to
// work.
import academic from "../../label-icons/microscope-2.png";
import athletics from "../../label-icons/gold-medal.png";
import cultural from "../../label-icons/planet-earth.png";
import greek from "../../label-icons/greek-temple.png";
import identity from "../../label-icons/handshake.png";
import media from "../../label-icons/newspaper.png";
import musical from "../../label-icons/music-note.png";
import performingArts from "../../label-icons/theater-mask.png";
import politics from "../../label-icons/megaphone.png";
import preProfessional from "../../label-icons/briefcase-3.png";
import religious from "../../label-icons/stones.png";
import service from "../../label-icons/service.png";
import specialInterest from "../../label-icons/poker-cards.png";
import studentGovernment from "../../label-icons/voting-box.png";

import cs from "../../label-icons/programming.png";
import engineering from "../../label-icons/engineering.png";
import finance from "../../label-icons/financial-profit.png";
import law from "../../label-icons/justice-scale.png";
import health from "../../label-icons/cardiogram.png";
import environment from "../../label-icons/recycle.png";
import art from "../../label-icons/palette.png";

/**
 * Icon per category, keyed by `Category.slug` — the same slugs authored in
 * scripts/classify.ts (SOURCE_CATEGORIES + INTEREST_CATEGORIES), so this map
 * stays in sync with the seed without needing its own migration. Not read
 * from `Category.emoji`/the DB at all; the emoji column is left alone as the
 * seed's own concern.
 */
export const CATEGORY_ICONS: Record<string, StaticImageData> = {
  // SOURCE
  academic,
  athletics,
  cultural,
  greek,
  identity,
  media,
  musical,
  "performing-arts": performingArts,
  politics,
  "pre-professional": preProfessional,
  religious,
  service,
  "special-interest": specialInterest,
  "student-government": studentGovernment,

  // INTEREST
  cs,
  engineering,
  finance,
  law,
  health,
  environment,
  art,
};
