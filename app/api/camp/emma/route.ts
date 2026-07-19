import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getDefaultCampAccessScope } from "@/lib/camp/access";
import { buildCampEmmaAnswer, buildMedicalCommandBlocks, restrictedNeedles, type CampEmmaAccess, type CampEmmaMode } from "@/lib/camp/emma";
import { answerCampEmmaConversation, isCampEmmaConversationalAccess } from "@/lib/camp/emma-conversation";
import { canAccessCampMedicalCommand } from "@/lib/camp/permissions";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { getCampOverview, getRestrictedCampMedicationPayload } from "@/lib/camp/repository";
import { shouldUseMedicalCommandContext } from "@/lib/camp/emma-medical-context";
import { checkAndRecordAiUsage } from "@/lib/platform/ai-access";

type CampEmmaRequestBody = {
  query?: string;
  mode?: CampEmmaMode;
  selectedDay?: string;
  medicalCommandActive?: boolean;
};

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const campAccess = await requireCampAccessForRequest(session, request);
  if (!campAccess.allowed) return campAccess.response;
  const context = campAccess.context;
  const vehicleId = getDefaultCampAccessScope(context.effectiveRole).vehicleId;

  let body: CampEmmaRequestBody = {};
  try {
    body = (await request.json()) as CampEmmaRequestBody;
  } catch {
    body = {};
  }

  const requestedMode = body.mode ?? "finder";
  if (requestedMode !== "finder" && !context.canAccessRestricted) {
    return NextResponse.json({ error: "Camp EMMA is limited to approved restricted staff." }, { status: 403 });
  }
  if (requestedMode !== "finder" && context.restrictedActor !== "Andrew" && context.restrictedActor !== "Jaci") {
    return NextResponse.json({ error: "Camp EMMA Smart Search and Ask EMMA are limited to Andrew and Jaci." }, { status: 403 });
  }
  const mode = normalizeMode(requestedMode, context.canAccessRestricted);

  const query = body.query ?? "";
  const overview = await getCampOverview(session, context, vehicleId ? { vehicleId } : {});
  const medicalCommandActive = body.medicalCommandActive === true && shouldUseMedicalCommandContext(canAccessCampMedicalCommand(context), query);
  const access = resolveEmmaAccess(context.restrictedActor, medicalCommandActive);
  let medicalBlocks;

  if (medicalCommandActive) {
    const payload = await getRestrictedCampMedicationPayload(session, context);
    if (!payload.allowed) {
      return NextResponse.json({ error: payload.error }, { status: payload.status });
    }
    const intakeRecordIds = new Set(payload.intakeHistory.map((item) => item.medicationRecordId).filter(isString));
    const loggedScheduleIds = new Set(
      payload.administrationLog
        .filter((log) => log.status === "Logged" && log.scheduleItemId)
        .map((log) => log.scheduleItemId as string)
    );
    medicalBlocks = buildMedicalCommandBlocks({
      schedule: payload.schedule,
      intakeRecordIds,
      loggedScheduleIds,
      selectedDay: body.selectedDay
    });
  }

  const conversationalAllowed = isCampEmmaConversationalAccess(access);
  const conversationalAttempted = !medicalCommandActive && Boolean(query.trim()) && conversationalAllowed && !isRestrictedTopicQuestion(query);
  let conversationDiagnostic = {
    providerSelected: "none" as "azure" | "openai" | "none",
    azureEndpointPresent: Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()),
    azureDeploymentPresent: Boolean(process.env.AZURE_OPENAI_DEPLOYMENT?.trim()),
    azureApiVersionPresent: Boolean(process.env.AZURE_OPENAI_API_VERSION?.trim()),
    providerFailureReason: undefined as string | undefined,
    providerErrorStatus: undefined as number | undefined,
    providerErrorCode: undefined as string | undefined
  };
  let answer = buildCampEmmaAnswer({
    overview,
    query,
    mode,
    selectedDay: body.selectedDay,
    access,
    medicalBlocks
  });

  // Conversational AI for Andrew and Jaci: ground the configured model in the
  // operational overview for free-form questions, falling back to the
  // deterministic answer above if the provider is unavailable. Medical command
  // queries stay on the deterministic medical path and never reach the model.
  if (conversationalAttempted) {
    const aiAccess = await checkAndRecordAiUsage(session, "camp_emma");
    if (!aiAccess.allowed) {
      return NextResponse.json({ error: aiAccess.error }, { status: aiAccess.status });
    }
    const conversational = await answerCampEmmaConversation({
      question: query,
      overview,
      access,
      selectedDay: body.selectedDay,
      onDiagnostic: (diagnostic) => {
        conversationDiagnostic = {
          providerSelected: diagnostic.providerSelected,
          azureEndpointPresent: diagnostic.azureEndpointPresent,
          azureDeploymentPresent: diagnostic.azureDeploymentPresent,
          azureApiVersionPresent: diagnostic.azureApiVersionPresent,
          providerFailureReason: diagnostic.providerFailureReason,
          providerErrorStatus: diagnostic.providerErrorStatus,
          providerErrorCode: diagnostic.providerErrorCode
        };
      }
    });
    if (conversational) answer = conversational;
  }

  logCampEmmaDiagnostic({
    requestedMode,
    normalizedMode: mode,
    restrictedActor: context.restrictedActor ?? "none",
    resolvedAccess: access,
    medicalCommandActive,
    conversationalAccess: conversationalAllowed,
    queryPresent: Boolean(query.trim()),
    ...conversationDiagnostic
  });

  return NextResponse.json({
    ok: true,
    mode,
    access,
    answer,
    providerDiagnostic: conversationalAttempted
      ? {
          providerSelected: conversationDiagnostic.providerSelected,
          providerFailureReason: conversationDiagnostic.providerFailureReason,
          providerErrorStatus: conversationDiagnostic.providerErrorStatus,
          providerErrorCode: conversationDiagnostic.providerErrorCode,
          azureEndpointPresent: conversationDiagnostic.azureEndpointPresent,
          azureDeploymentPresent: conversationDiagnostic.azureDeploymentPresent,
          azureApiVersionPresent: conversationDiagnostic.azureApiVersionPresent
        }
      : undefined
  });
}

function isString(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

function normalizeMode(mode: CampEmmaRequestBody["mode"], restricted: boolean): CampEmmaMode {
  if (mode === "ask_emma" || mode === "smart_search") return restricted ? mode : "finder";
  return "finder";
}

function resolveEmmaAccess(actor: string | undefined, medicalCommandActive: boolean): CampEmmaAccess {
  if (actor === "Andrew") return medicalCommandActive ? "andrew_medical" : "andrew_operations";
  if (actor === "Jaci") return "jaci";
  return "leader";
}

function isRestrictedTopicQuestion(query: string) {
  const normalized = query.toLowerCase();
  return restrictedNeedles.some((needle) => normalized.includes(needle));
}

function logCampEmmaDiagnostic(details: {
  requestedMode: CampEmmaMode;
  normalizedMode: CampEmmaMode;
  restrictedActor: string;
  resolvedAccess: CampEmmaAccess;
  medicalCommandActive: boolean;
  conversationalAccess: boolean;
  queryPresent: boolean;
  providerSelected: "azure" | "openai" | "none";
  providerFailureReason?: string;
  providerErrorStatus?: number;
  providerErrorCode?: string;
  azureEndpointPresent: boolean;
  azureDeploymentPresent: boolean;
  azureApiVersionPresent: boolean;
}) {
  console.warn("[camp-emma] request diagnostics", {
    timestamp: new Date().toISOString(),
    route: "/api/camp/emma",
    requestedMode: details.requestedMode,
    normalizedMode: details.normalizedMode,
    restrictedActor: details.restrictedActor,
    resolvedAccess: details.resolvedAccess,
    medicalCommandActive: details.medicalCommandActive,
    conversationalAccess: details.conversationalAccess,
    queryPresent: details.queryPresent,
    providerSelected: details.providerSelected,
    providerFailureReason: details.providerFailureReason,
    providerErrorStatus: details.providerErrorStatus,
    providerErrorCode: details.providerErrorCode,
    azureEndpointPresent: details.azureEndpointPresent,
    azureDeploymentPresent: details.azureDeploymentPresent,
    azureApiVersionPresent: details.azureApiVersionPresent
  });
}
