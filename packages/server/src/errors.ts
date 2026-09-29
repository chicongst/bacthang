export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "SELF_MATCH"
  | "OPPONENT_NOT_FOUND"
  | "DAILY_LIMIT_REACHED"
  | "DISCORD_AUTH_FAILED"
  | "WORKSPACE_NOT_FOUND"
  | "NOT_MEMBER"
  | "PENDING_APPROVAL"
  | "OWNER_CANNOT_LEAVE"
  | "RATE_LIMITED"
  | "TOO_MANY_STREAMS"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
