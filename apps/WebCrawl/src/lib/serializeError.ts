export function serializeError(
  error: unknown,
  options?: { includeStack?: boolean },
) {
  if (error instanceof Error) {
    const out: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    const anyErr = error as any;
    if (anyErr.code !== undefined) out.code = anyErr.code;
    if (options?.includeStack === true && anyErr.stack) out.stack = anyErr.stack;
    if (anyErr.cause !== undefined) out.cause = anyErr.cause;

    for (const key of Object.getOwnPropertyNames(error)) {
      if (key in out) continue;
      try {
        out[key] = (error as any)[key];
      } catch {
        // ignore
      }
    }

    return out;
  }

  if (error && typeof error === "object") {
    try {
      return JSON.parse(JSON.stringify(error));
    } catch {
      return { value: String(error) };
    }
  }

  return { value: error };
}
