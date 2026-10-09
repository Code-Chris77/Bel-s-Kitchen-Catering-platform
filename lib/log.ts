/** Structured one-line JSON logs, picked up by Workers Logs. */
export function logError(event: string, error: unknown, extra: Record<string, unknown> = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      event,
      message: error instanceof Error ? error.message : String(error),
      ...extra,
    }),
  );
}
