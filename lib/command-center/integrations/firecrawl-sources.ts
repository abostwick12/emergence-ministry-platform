// Starter curated source list for the Firecrawl-backed daily resource feed.
//
// Intentionally small and manually curated -- there is no auto-discovery or
// crawl beyond these named pages. Andrew can add, remove, or swap entries
// here; the refresh itself only ever runs when he explicitly triggers it
// (see refreshDailyBriefing in lib/command-center/repository.ts).

import type { BriefingCategory } from "@/lib/command-center/types";

export type BriefingSource = {
  url: string;
  source: string;
  category: BriefingCategory;
};

export const BRIEFING_SOURCES: BriefingSource[] = [
  {
    url: "https://www.hiringourheroes.org/programs-events/",
    source: "Hiring Our Heroes",
    category: "military_transition"
  },
  {
    url: "https://www.dol.gov/agencies/vets/programs/tap",
    source: "DOL Transition Assistance Program",
    category: "military_transition"
  },
  {
    url: "https://www.bls.gov/news.release/empsit.nr0.htm",
    source: "U.S. Bureau of Labor Statistics",
    category: "job_market"
  },
  {
    url: "https://hbr.org/topic/subject/leadership-development",
    source: "Harvard Business Review",
    category: "leadership"
  }
];
