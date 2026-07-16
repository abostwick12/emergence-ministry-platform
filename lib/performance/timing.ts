const SAFE_OPERATION = /^[a-z0-9_.-]{1,80}$/;

export async function measureServerOperation<T>(operation: string, work: () => Promise<T>): Promise<T> {
  if (!SAFE_OPERATION.test(operation)) throw new Error("Performance operation names must be static, lowercase identifiers.");
  if (!isServerTimingEnabled()) return work();

  const startedAt = performance.now();
  try {
    const result = await work();
    writeTiming("ok", operation, startedAt);
    return result;
  } catch (error) {
    writeTiming("error", operation, startedAt, error instanceof Error ? error.name : "UnknownError");
    throw error;
  }
}

export function isServerTimingEnabled() {
  return process.env.PERFORMANCE_TIMING_ENABLED === "true" || process.env.VERCEL === "1";
}

function writeTiming(outcome: "ok" | "error", operation: string, startedAt: number, errorType?: string) {
  console.info(JSON.stringify({
    event: "server_timing",
    operation,
    outcome,
    durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
    runtimeRegion: process.env.VERCEL_REGION ?? "local",
    ...(errorType ? { errorType } : {})
  }));
}
