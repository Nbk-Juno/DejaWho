import type { NextFunction, Request, Response } from "express";

type LogFields = Record<string, unknown>;

function writeLog(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function serializeError(error: unknown): LogFields {
  if (!(error instanceof Error)) {
    return { errorType: typeof error };
  }

  const errorWithCode = error as Error & {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };

  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCode: errorWithCode.code,
    errorStatus: errorWithCode.status ?? errorWithCode.statusCode,
  };
}

export function logInfo(event: string, fields?: LogFields) {
  writeLog("info", event, fields);
}

export function logWarn(event: string, fields?: LogFields) {
  writeLog("warn", event, fields);
}

export function logError(event: string, error: unknown, fields: LogFields = {}) {
  writeLog("error", event, {
    ...fields,
    ...serializeError(error),
  });
}

export function apiRequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    if (!req.path.startsWith("/api")) return;

    logInfo("api_request", {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id,
    });
  });

  next();
}
