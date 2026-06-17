import { emmaErrors, EmmaError } from "@/lib/emma/errors";
import type { EmmaProviderErrorCode } from "./types";

const RETRYABLE: ReadonlySet<EmmaProviderErrorCode> = new Set<EmmaProviderErrorCode>([
  "timeout",
  "rate_limited",
  "provider_unavailable",
  "payment_required"
]);

export class EmmaProviderError extends Error {
  readonly code: EmmaProviderErrorCode;
  readonly httpStatus: number | null;

  constructor(code: EmmaProviderErrorCode, message = "AI provider request failed safely.", httpStatus?: number | null) {
    super(message);
    this.name = "EmmaProviderError";
    this.code = code;
    this.httpStatus = httpStatus ?? null;
    Object.setPrototypeOf(this, EmmaProviderError.prototype);
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }

  toEmmaError(): EmmaError {
    return emmaErrors.provider("AI provider request failed safely.");
  }
}

export function providerError(code: EmmaProviderErrorCode, httpStatus?: number | null): EmmaProviderError {
  return new EmmaProviderError(code, "AI provider request failed safely.", httpStatus);
}

export function normalizeProviderError(error: unknown): EmmaProviderError {
  if (error instanceof EmmaProviderError) return error;

  if (error instanceof DOMException && error.name === "AbortError") {
    return providerError("timeout");
  }

  return providerError("unknown");
}

export function providerErrorFromHttpStatus(status: number): EmmaProviderError {
  if (status === 400) return providerError("bad_request", status);
  if (status === 401) return providerError("authentication", status);
  if (status === 402) return providerError("payment_required", status);
  if (status === 403) return providerError("forbidden", status);
  if (status === 408 || status === 504) return providerError("timeout", status);
  if (status === 429) return providerError("rate_limited", status);
  if (status >= 500) return providerError("provider_unavailable", status);
  return providerError("unknown", status);
}

export function sanitizeProviderError(error: unknown): { code: EmmaProviderErrorCode; httpStatus: number | null } {
  const normalized = normalizeProviderError(error);
  return { code: normalized.code, httpStatus: normalized.httpStatus };
}
