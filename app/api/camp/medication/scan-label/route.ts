import { NextResponse } from "next/server";
import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import { requireCampAccessForRequest } from "@/lib/camp/api-guard";
import { scanMedicationLabelFrame, type MedicationLabelScanResponse } from "@/lib/camp/medication-label-vision";
import { CAMP_MEDICATION_SCAN_DISABLED_MESSAGE, isCampMedicationScanEnabled } from "@/lib/camp/medication-scan-config";
import { assertCampRestrictedAccess } from "@/lib/camp/permissions";

const SCAN_UNCONFIGURED_MESSAGE = "Medication label scanning is not configured yet.";
const SCAN_UNAVAILABLE_MESSAGE = "Medication label scanning is temporarily unavailable. Continue with manual entry.";
const MAX_SCAN_FRAME_BYTES = 4 * 1024 * 1024;
const SUPPORTED_SCAN_FRAME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  const access = await requireCampAccessForRequest(session, request);
  if (!access.allowed) return access.response;
  const restrictedAccess = assertCampRestrictedAccess(access.context);
  if (!restrictedAccess.allowed) {
    return NextResponse.json({ error: restrictedAccess.error }, { status: restrictedAccess.status });
  }

  if (!isCampMedicationScanEnabled()) {
    const response: MedicationLabelScanResponse & { error: string; processingPath: string } = {
      error: CAMP_MEDICATION_SCAN_DISABLED_MESSAGE,
      confidence: "low",
      warnings: [CAMP_MEDICATION_SCAN_DISABLED_MESSAGE],
      processingPath: "server-side transient frame processing, no permanent image storage"
    };
    return NextResponse.json(response, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Medication label scan requires a temporary image upload." }, { status: 400 });
  }

  const frame = formData.get("frame") ?? formData.get("image") ?? formData.get("photo");
  if (!(frame instanceof File)) {
    return NextResponse.json({ error: "A temporary prescription label image is required." }, { status: 400 });
  }
  if (!SUPPORTED_SCAN_FRAME_TYPES.has(frame.type)) {
    return NextResponse.json({ error: "Prescription label scan must be a JPEG, PNG, or WebP image." }, { status: 400 });
  }
  if (frame.size > MAX_SCAN_FRAME_BYTES) {
    return NextResponse.json({ error: "Prescription label scan image must be 4 MB or smaller." }, { status: 413 });
  }

  const dataUrl = await fileToDataUrl(frame);
  const result = await scanMedicationLabelFrame({ dataUrl });

  if (!result.ok) {
    const unconfigured = result.reason === "unavailable";
    const error = unconfigured ? SCAN_UNCONFIGURED_MESSAGE : SCAN_UNAVAILABLE_MESSAGE;
    const response: MedicationLabelScanResponse & { error: string; processingPath: string } = {
      error,
      confidence: "low",
      warnings: [error],
      processingPath: "server-side transient frame processing, no permanent image storage"
    };
    return NextResponse.json(response, { status: unconfigured ? 503 : 502 });
  }

  return NextResponse.json({
    ...result.scan,
    warnings: [
      ...result.scan.warnings,
      "AI/OCR may misread medication labels. Verify every field against the original bottle before saving."
    ],
    processingPath: "server-side transient frame processing, no permanent image storage"
  });
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString("base64")}`;
}
