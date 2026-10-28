export type ServiceErrorCode =
  | "validation"
  | "not_found"
  | "forbidden"
  | "network"
  | "conflict"
  | "workflow"
  | "storage"
  | "simulated"
  | "auth";

/** Errors thrown by services always carry an officer-friendly message. */
export class ServiceError extends Error {
  code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

/** Never surface raw JavaScript errors to officers. */
export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ServiceError) return e.message;
  if (e instanceof Error && (e.name === "WorkflowError" || e.message.startsWith("The application could not"))) return e.message;
  return fallback;
}
