import { createPublicKey, verify, type KeyObject } from "node:crypto";

// Discord hands out the application key as 32 raw bytes, but node only builds a KeyObject
// from DER. This is the SPKI header for Ed25519; the raw key is appended to it verbatim.
const SPKI_ED25519_HEADER = Buffer.from("302a300506032b6570032100", "hex");

const KEY_BYTES = 32;
const SIGNATURE_HEX = /^[0-9a-f]{128}$/i;

/** Discord signs each interaction once, so without a window a captured request replays forever. */
export const MAX_SIGNATURE_AGE_MS = 5 * 60_000;

export function discordPublicKey(hex: string): KeyObject {
  const raw = Buffer.from(hex.trim(), "hex");
  if (raw.length !== KEY_BYTES) {
    throw new Error("DISCORD_PUBLIC_KEY must be the 64-character hex key from the Discord application page.");
  }
  return createPublicKey({
    key: Buffer.concat([SPKI_ED25519_HEADER, raw]),
    format: "der",
    type: "spki",
  });
}

export interface SignedRequest {
  signature: string | undefined;
  timestamp: string | undefined;
  body: string;
}

export function isFromDiscord(key: KeyObject, req: SignedRequest, now: Date): boolean {
  const { signature, timestamp, body } = req;
  if (!signature || !timestamp || !SIGNATURE_HEX.test(signature)) return false;

  const signedAt = Number(timestamp) * 1000;
  if (!Number.isFinite(signedAt) || Math.abs(now.getTime() - signedAt) > MAX_SIGNATURE_AGE_MS) return false;

  return verify(null, Buffer.from(timestamp + body, "utf8"), key, Buffer.from(signature, "hex"));
}
