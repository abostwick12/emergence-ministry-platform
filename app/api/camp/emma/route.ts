import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { getDefaultCampAccessScope } from "@/lib/camp/access";
import { buildCampEmmaAnswer, buildMedicalCommandBlocks, type CampEmmaAccess, type CampEmmaMode } from "@/lib/camp/emma";
import { answerCampEmmaConversation, isCampEmmaConversationalAccess } from "@/lib/camp/emma-conversation";
import { canAccessCampMedicalCommand } from "@/lib/camp/permissions";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { getCampOverview, getRestrictedCampMedicationPayload } from "@/lib/camp/repository";

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

  const overview = await getCampOverview(session, context, vehicleId ? { vehicleId } : {});
  const medicalCommandActive = body.medicalCommandActive === true && canAccessCampMedicalCommand(context);
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

  const query = body.query ?? "";
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
  if (!medicalCommandActive && query.trim() && isCampEmmaConversationalAccess(access)) {
    const conversational = await answerCampEmmaConversation({
      question: query,
      overview,
      access,
      selectedDay: body.selectedDay
    });
    if (conversational) answer = conversational;
  }

  return NextResponse.json({
    ok: true,
    mode,
    access,
    answer
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
