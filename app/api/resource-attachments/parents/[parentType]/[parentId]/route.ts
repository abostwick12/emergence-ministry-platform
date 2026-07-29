import { NextResponse } from "next/server";

import { getServerSession, unauthorizedResponse } from "@/lib/auth/server";
import {
  canManageResourceAttachments,
  createResourceAttachment,
  listResourceAttachments,
  resourceAttachmentErrorResponse,
  resourceStorageReady
} from "@/lib/resources/repository";

export async function GET(request: Request, { params }: { params: { parentType: string; parentId: string } }) {
  const session = await getServerSession();
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("includeArchived") === "true" && canManageResourceAttachments(session, params.parentType);

  try {
    const resources = await listResourceAttachments(session, {
      parentId: params.parentId,
      parentType: params.parentType,
      includeArchived
    });
    return NextResponse.json({
      canManage: canManageResourceAttachments(session, params.parentType),
      resources,
      storageReady: resourceStorageReady(session)
    });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}
export async function POST(request: Request, { params }: { params: { parentType: string; parentId: string } }) {
  const session = await getServerSession();
  if (!session) return unauthorizedResponse();

  try {
    const contentType = request.headers.get("content-type") ?? "";
    const input = contentType.includes("multipart/form-data")
      ? await inputFromFormData(request)
      : inputFromJson(await request.json().catch(() => ({})));
    const resource = await createResourceAttachment(session, {
      ...input,
      parentId: params.parentId,
      parentType: params.parentType
    });
    return NextResponse.json({ ok: true, resource }, { status: 201 });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}

async function inputFromFormData(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  return {
    description: stringField(formData, "description"),
    externalUrl: stringField(formData, "externalUrl"),
    file: file instanceof File ? file : undefined,
    isDownloadable: booleanField(formData, "isDownloadable"),
    isFeatured: booleanField(formData, "isFeatured"),
    notificationIntent: stringField(formData, "notificationIntent"),
    opensInNewTab: booleanField(formData, "opensInNewTab"),
    resourceType: stringField(formData, "resourceType"),
    title: stringField(formData, "title"),
    visibility: stringField(formData, "visibility")
  };
}

function inputFromJson(body: unknown) {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return {
    description: typeof value.description === "string" ? value.description : undefined,
    externalUrl: typeof value.externalUrl === "string" ? value.externalUrl : undefined,
    isDownloadable: typeof value.isDownloadable === "boolean" ? value.isDownloadable : undefined,
    isFeatured: typeof value.isFeatured === "boolean" ? value.isFeatured : undefined,
    notificationIntent: typeof value.notificationIntent === "string" ? value.notificationIntent : undefined,
    opensInNewTab: typeof value.opensInNewTab === "boolean" ? value.opensInNewTab : undefined,
    resourceType: typeof value.resourceType === "string" ? value.resourceType : undefined,
    title: typeof value.title === "string" ? value.title : undefined,
    visibility: typeof value.visibility === "string" ? value.visibility : undefined
  };
}

function stringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function booleanField(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function resourceErrorResponse(error: unknown) {
  const payload = resourceAttachmentErrorResponse(error);
  return NextResponse.json({ error: payload.error, code: payload.code }, { status: payload.status });
}
