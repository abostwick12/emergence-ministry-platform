export type PrivateDiscoveryNote = {
  id: string;
  title: string;
  relativePath: string;
  tags: string[];
  rawText: string;
  contentHash: string;
  candidateMetadata: Record<string, unknown>;
};

export function buildPrivateDiscoveryIndex(
  roots: string[],
  options?: { scopeKey?: string; requireFrontmatter?: boolean }
): Promise<PrivateDiscoveryNote[]>;
export function searchPrivateDiscovery(
  notes: PrivateDiscoveryNote[],
  query: string,
  limit?: number
): Array<{ id: string; title: string; relativePath: string; tags: string[]; contentHash: string; excerpt: string; score: number }>;
export function getPrivateDiscoveryNote(
  notes: PrivateDiscoveryNote[],
  id: string
): PrivateDiscoveryNote & { authority: "none"; quotePermission: "never"; storage: "local_only" };
export function preparePrivateDiscoveryCheck(
  notes: PrivateDiscoveryNote[],
  ids: string[]
): {
  privateDiscovery: Array<{ sourceReference: string; contentHash: string; rawText: string }>;
  handling: string;
};
