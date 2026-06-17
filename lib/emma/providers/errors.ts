import { emmaErrors, EmmaError } from "@/lib/emma/errors";
import type { EmmaProviderErrorCode } from "./types";

export interface EmmaProviderDiagnostic {
  googleErrorCode?: number;
  googleErrorStatus?: string;
  googleErrorMessage?: string;
  invalidFieldPaths?: string[];
}

const RETRYABLE: ReadonlySet<EmmaProviderErrorCode> = new Set<EmmaProviderErrorCode>([
  "timeout",
  "rate_limited",
  "provider_unavailable",
  "payment_required"
]);

export class EmmaProviderError extends Error {
  readonly code: EmmaProviderErrorCode;
  readonly httpStatus: number | null;
  readonly diagnostic: EmmaProviderDiagnostic | null;

  constructor(
    code: EmmaProviderErrorCode,
    message = "AI provider request failed safely.",
    httpStatus?: number | null,
    diagnostic?: EmmaProviderDiagnostic | null
  ) {
    super(message);
    this.name = "EmmaProviderError";
    this.code = code;
    this.httpStatus = httpStatus ?? null;
    this.diagnostic = diagnostic ?? null;
    Object.setPrototypeOf(this, EmmaProviderError.prototype);
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }

  toEmmaError(): EmmaError {
    return emmaErrors.provider("AI provider request failed safely.");
  }
}

export function providerError(
  code: EmmaProviderErrorCode,
  httpStatus?: number | null,
  diagnostic?: EmmaProviderDiagnostic | null
): EmmaProviderError {
  return new EmmaProviderError(code, "AI provider request failed safely.", httpStatus, diagnostic);
}

export function normalizeProviderError(error: unknown): EmmaProviderError {
  if (error instanceof EmmaProviderError) return error;

  if (error instanceof DOMException && error.name === "AbortError") {
    return providerError("timeout");
  }

  return providerError("unknown");
}

export function providerErrorFromHttpStatus(status: number, diagnostic?: EmmaProviderDiagnostic | null): EmmaProviderError {
  if (status === 400) return providerError("bad_request", status, diagnostic);
  if (status === 401) return providerError("authentication", status, diagnostic);
  if (status === 402) return providerError("payment_required", status, diagnostic);
  if (status === 403) return providerError("forbidden", status, diagnostic);
  if (status === 408 || status === 504) return providerError("timeout", status, diagnostic);
  if (status === 429) return providerError("rate_limited", status, diagnostic);
  if (status >= 500) return providerError("provider_unavailable", status, diagnostic);
  return providerError("unknown", status, diagnostic);
}

export function sanitizeProviderError(error: unknown): { code: EmmaProviderErrorCode; httpStatus: number | null } {
  const normalized = normalizeProviderError(error);
  return { code: normalized.code, httpStatus: normalized.httpStatus };
}
