import type { MeridianSource, MeridianSourceKind } from "@/lib/meridian/knowledge/types";

export const andrewAuthoredSourceKinds = ["academic_paper", "curriculum_material", "sermon"] as const;

export type AndrewAuthoredSourceKind = (typeof andrewAuthoredSourceKinds)[number];

const nuancePriority: Record<AndrewAuthoredSourceKind, number> = {
  academic_paper: 3,
  curriculum_material: 2,
  sermon: 1
};

export function isAndrewAuthoredSourceKind(kind: MeridianSourceKind): kind is AndrewAuthoredSourceKind {
  return andrewAuthoredSourceKinds.includes(kind as AndrewAuthoredSourceKind);
}

export function authoredCorpusDefaults(kind: AndrewAuthoredSourceKind) {
  return {
    kind,
    corpusFamily: "andrew_authored_ministry" as const,
    authorityClass: "none" as const,
    approvalStatus: "unreviewed" as const,
    externalVisibility: "private" as const,
    quotePolicy: "never" as const,
    generationPolicy: "discovery_only" as const,
    sensitivity: "internal" as const,
    originMode: "direct" as const
  };
}

export function rankApprovedAuthoredSources(sources: MeridianSource[], query: string) {
  const queryTokens = tokens(query);
  return sources
    .filter((source) =>
      source.corpusFamily === "andrew_authored_ministry" &&
      isAndrewAuthoredSourceKind(source.kind) &&
      source.approvalStatus === "approved" &&
      source.generationPolicy === "approved_generation" &&
      source.authorityClass !== "none" &&
      source.sensitivity !== "pastoral" &&
      source.sensitivity !== "person_specific"
    )
    .map((source) => {
      const searchable = tokens(`${source.title} ${source.attribution ?? ""}`);
      const lexicalMatches = Array.from(queryTokens).filter((token) => searchable.has(token)).length;
      return {
        source,
        score: lexicalMatches * 10 + nuancePriority[source.kind as AndrewAuthoredSourceKind]
      };
    })
    .sort((left, right) => right.score - left.score || left.source.title.localeCompare(right.source.title));
}

function tokens(value: string) {
  return new Set(
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}
