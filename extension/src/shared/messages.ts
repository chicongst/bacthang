export type LoginMessage = { type: "login" };
export type LoginResponse = { ok: true } | { ok: false; message: string };
