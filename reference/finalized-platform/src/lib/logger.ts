export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export function getCorrelationId(request?: Request): string {
  if (!request) return crypto.randomUUID();

  return (
    request.headers.get("x-correlation-id") ||
    request.headers.get("x-request-id") ||
    request.headers.get("cf-ray") ||
    crypto.randomUUID()
  );
}

export function logStructured(level: LogLevel, message: string, context: LogContext = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    environment: process.env.NODE_ENV || "development",
    ...context,
  };

  const formattedJson = JSON.stringify(logEntry);

  switch (level) {
    case "error":
      console.error(formattedJson);
      break;
    case "warn":
      console.warn(formattedJson);
      break;
    case "info":
      console.info(formattedJson);
      break;
    case "debug":
      console.debug(formattedJson);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => logStructured("debug", message, context),
  info: (message: string, context?: LogContext) => logStructured("info", message, context),
  warn: (message: string, context?: LogContext) => logStructured("warn", message, context),
  error: (message: string, context?: LogContext) => logStructured("error", message, context),
};
