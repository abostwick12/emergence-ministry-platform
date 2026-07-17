export const DEFAULT_AZURE_OPENAI_API_VERSION = "2024-10-21";

export function normalizeAzureResponsesBaseUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.toLowerCase().includes("/api/projects/")) {
      return `${parsed.origin}/openai/v1/`;
    }
  } catch {
    // Leave malformed values intact so the provider can return its normal,
    // redacted configuration error to the caller.
  }

  if (trimmed.endsWith("/openai/v1")) return `${trimmed}/`;
  if (trimmed.endsWith("/openai")) return `${trimmed}/v1/`;
  return `${trimmed}/openai/v1/`;
}

export function azureResponsesUrl(endpoint: string): string {
  return `${normalizeAzureResponsesBaseUrl(endpoint)}responses`;
}
