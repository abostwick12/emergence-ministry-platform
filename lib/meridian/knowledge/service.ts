import type { AuthSession } from "@/lib/auth/server";
import { buildMeridianEvidencePack, formatApprovedEvidencePackForGeneration } from "@/lib/meridian/knowledge/evidence-pack";
import { compileMeridianEvidenceMap } from "@/lib/meridian/knowledge/evidence-map";
import { buildMeridianClaimAttributionBridge } from "@/lib/meridian/knowledge/claim-attribution";
import { inspectPrivateFragmentLeakage, type PrivateDiscoveryFragment } from "@/lib/meridian/knowledge/leakage-firewall";
import type { MeridianGenerationRepository } from "@/lib/meridian/knowledge/repository";
import { abstainingResponse, validateMeridianResponseContract } from "@/lib/meridian/knowledge/response-contract";
import type { MeridianAnswerContract, MeridianEvidencePack, MeridianTaskContext } from "@/lib/meridian/knowledge/types";

export async function prepareMeridianGeneration(
  repository: MeridianGenerationRepository,
  session: AuthSession,
  task: MeridianTaskContext
) {
  const evidence = await repository.loadApprovedEvidence(session, task);
  const pack = buildMeridianEvidencePack({ task, ...evidence });
  const evidenceMap = compileMeridianEvidenceMap({ pack, relationships: evidence.relationships });
  const attributionBridge = buildMeridianClaimAttributionBridge(pack, evidenceMap);
  return {
    pack,
    evidenceMap,
    attributionBridge,
    decision: pack.abstain ? "abstain" as const : pack.requiresReview ? "generate_for_review" as const : "generate" as const,
    providerContext: pack.abstain ? undefined : formatApprovedEvidencePackForGeneration(pack),
    response: pack.abstain ? abstainingResponse(pack) : undefined
  };
}

export async function finalizeMeridianGeneration(input: {
  response: MeridianAnswerContract;
  pack: MeridianEvidencePack;
  privateDiscoveryFragments?: PrivateDiscoveryFragment[];
}) {
  const validation = validateMeridianResponseContract(input.response, input.pack);
  if (!validation.ok) {
    return {
      ok: false as const,
      action: "block_and_require_review" as const,
      reason: validation.reason,
      detail: validation.detail
    };
  }

  const output = contractText(input.response);
  const leakage = await inspectPrivateFragmentLeakage(output, input.privateDiscoveryFragments ?? []);
  if (!leakage.ok) {
    return {
      ok: false as const,
      action: leakage.action,
      reason: "private_fragment_overlap" as const,
      findings: leakage.findings
    };
  }
  return { ok: true as const, response: input.response, leakageCheck: "passed" as const };
}

function contractText(response: MeridianAnswerContract) {
  return [
    ...response.observations,
    ...response.scripture.map((item) => item.text),
    ...response.interpretation,
    ...response.recommendations,
    ...response.uncertainty,
    ...response.questionsForLeader,
    response.abstentionReason ?? ""
  ].join("\n");
}
