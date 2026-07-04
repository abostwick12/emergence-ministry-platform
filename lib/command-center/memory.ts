// SAGE persistent memory.
//
// Backs the "SAGE Persistent Memory" capability: facts, preferences, and
// context Andrew shares in one conversation should be recallable in a later
// one. Phase 1 relevance is a simple keyword match against domain/content —
// semantic search is a deferred improvement, not required for the feature to
// be useful.

import type { AuthSession } from "@/lib/auth/server";
import * as repository from "@/lib/command-center/repository";
import type { SageMemory, SageMemoryType } from "@/lib/command-center/types";

export async function saveMemory(
  session: AuthSession,
  input: { memoryType: SageMemoryType; content: string; domain?: string }
): Promise<SageMemory> {
  return repository.saveMemoryRecord(session, input);
}

export async function getRelevantMemories(session: AuthSession, topic: string, limit = 5): Promise<SageMemory[]> {
  const all = await repository.listMemoryRecords(session);
  if (all.length === 0) return [];

  const topicWords = topic
    .toLowerCase()
    .split(/\W+/)
    .filter((word) => word.length > 2);

  if (topicWords.length === 0) return all.slice(0, limit);

  const scored = all
    .map((memory) => {
      const haystack = `${memory.domain ?? ""} ${memory.content}`.toLowerCase();
      const score = topicWords.reduce((count, word) => (haystack.includes(word) ? count + 1 : count), 0);
      return { memory, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return all.slice(0, limit);
  return scored.slice(0, limit).map((entry) => entry.memory);
}
