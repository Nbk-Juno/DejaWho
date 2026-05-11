import pino from "pino";
import pinoHttp from "pino-http";
import type { NextFunction, Request, Response } from "express";

type LogFields = Record<string, unknown>;

const defaultOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["req.body", "req.headers.authorization", "res.headers"],
    remove: true,
  },
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
};

export function createLogger(destination?: pino.DestinationStream, level?: string): pino.Logger {
  const opts = { ...defaultOptions, ...(level && { level }) };
  if (destination) {
    return pino({ ...opts, transport: undefined }, destination);
  }
  return pino(opts);
}

export function createRequestLogger(logger: pino.Logger) {
  const httpLogger = pinoHttp({
    logger,
    autoLogging: {
      ignore(req) {
        return !req.url?.startsWith("/api");
      },
    },
    customProps(req) {
      return { userId: (req as Request & { user?: { id: string } }).user?.id };
    },
    serializers: {
      req(req) {
        return { method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  });
  return httpLogger;
}

const logger = createLogger();

export function logInfo(event: string, fields?: LogFields) {
  logger.info({ event, ...fields });
}

export function logWarn(event: string, fields?: LogFields) {
  logger.warn({ event, ...fields });
}

export function logError(event: string, error: unknown, fields: LogFields = {}) {
  const errFields = serializeError(error);
  logger.error({ event, ...fields, ...errFields });
}

function serializeError(error: unknown): LogFields {
  if (!(error instanceof Error)) {
    return { errorType: typeof error };
  }
  const e = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
  return {
    errorName: error.name,
    errorMessage: error.message,
    errorCode: e.code,
    errorStatus: e.status ?? e.statusCode,
  };
}

export const apiRequestLogger = createRequestLogger(logger);

export { logger };
