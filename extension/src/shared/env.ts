export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") ?? "";
export const DISCORD_CLIENT_ID = (import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined) ?? "";
export const BOARD_NAME = (import.meta.env.VITE_BOARD_NAME as string | undefined)?.trim() || "Bảng Xếp Hạng";
export const TOKEN_KEY = "ranking.token";
