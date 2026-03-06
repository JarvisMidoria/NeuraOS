export function perfNow() {
  return Date.now();
}

export function perfLog(label: string, startedAt: number, warnMs = 500) {
  const elapsedMs = Date.now() - startedAt;
  const forceLog = process.env.PERF_LOG === "1";

  if (elapsedMs >= warnMs) {
    console.warn(`[perf] ${label} took ${elapsedMs}ms`);
    return elapsedMs;
  }

  if (forceLog) {
    console.info(`[perf] ${label} took ${elapsedMs}ms`);
  }

  return elapsedMs;
}
