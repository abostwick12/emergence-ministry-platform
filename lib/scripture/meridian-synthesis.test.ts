import { describe, expect, it } from "vitest";

import {
  buildMeridianProvenance,
  buildMeridianSynthesisBrief,
  formatMeridianSynthesisBriefForAi,
  validateMeridianArtifact
} from "@/lib/scripture/meridian-synthesis";

describe("Meridian synthesis", () => {
  it("builds a structured ministry brief with safe source provenance", () => {
    const brief = buildMeridianSynthesisBrief({
      taskType: "journey_journal",
      request: "What is the gospel?",
      audience: "students using Journey Journal",
      knowledgeMatches: [
        {
          id: "context-map-gospel",
          label: "Because you asked about the gospel",
          title: "Gospel context map",
          description: "Steer gospel questions through Scripture's announcement about Jesus before reducing it to advice.",
          href: "/student/scripture/resources",
          scriptureReferences: ["Mark 1:14-15", "1 Corinthians 15:1-8"],
          topicTags: ["gospel", "good_news", "kingdom"],
          digQuestions: ["What good news is announced, and who is at the center?"]
        }
      ],
      internalGroundingContext: [
        "Teach slowly from Scripture, then invite practice in trusted community.",
        "Provider diagnostics: stack trace bearer token should never be included."
      ].join("\n\n")
    });

    expect(brief).toMatchObject({
      taskType: "journey_journal",
      normalizedRequest: "What is the gospel?",
      sourceIds: expect.arrayContaining(["context-map-gospel", "internal-grounding:1"]),
      sourceTypes: expect.arrayContaining(["ministry_context_map", "internal_grounding"])
    });
    expect(brief.ministryIdentity.length).toBeGreaterThan(0);
    expect(brief.theologicalGuardrails.join(" ")).toMatch(/Do not quote, cite, reveal/i);
    expect(brief.excludedInformation.join(" ")).toMatch(/Provider diagnostics/i);
    expect(JSON.stringify(brief.summarizedSources)).not.toMatch(/bearer token|stack trace|Provider diagnostics/i);

    const formatted = formatMeridianSynthesisBriefForAi(brief);
    expect(formatted).toContain('"ministryUnderstanding"');
    expect(formatted).toContain('"synthesizedSources"');
    expect(formatted).not.toMatch(/bearer token|stack trace/i);
  });

  it("records fallback, validation, and context categories internally", () => {
    const brief = buildMeridianSynthesisBrief({
      taskType: "leader_guide",
      request: "John 13 leader guide",
      sermon: {
        title: "When the King Kneels",
        passage: "John 13:1-17",
        bigIdea: "Real authority stoops.",
        excerpt: "Jesus kneels to wash feet before the cross."
      }
    });
    const validation = validateMeridianArtifact({
      taskType: "leader_guide",
      title: "When the King Kneels - Leader Guide",
      summary: "A leader guide for John 13.",
      content: [
        "## Lesson Summary",
        "A long enough guide for validation that prepares volunteer leaders to connect John 13 with formation.",
        "## Likely Student Misunderstandings",
        "Students may confuse service with earning approval.",
        "## Leader Guidance",
        "Read slowly and listen for resistance to receiving grace.",
        "## Discussion Strategy",
        "Notice, interpret, wrestle, practice, and community.",
        "## Pastoral Considerations",
        "Escalate care concerns to trusted leaders.",
        "## Practical Application",
        "Name one ordinary act of love."
      ].join("\n")
    });

    const provenance = buildMeridianProvenance({
      brief,
      provider: "deterministic",
      model: "meridian-test",
      fallbackUsed: true,
      fallbackReason: "mocked provider failure",
      validation
    });

    expect(provenance).toMatchObject({
      meridianRan: true,
      selectedSourceTypes: expect.arrayContaining(["current_sermon_draft", "lesson_big_idea"]),
      fallbackUsed: true,
      fallbackReason: "mocked provider failure",
      validationResult: "validated"
    });
    expect(provenance.contextCategories).toEqual(expect.arrayContaining(["theological_guardrails", "formation_goals"]));
  });
});
