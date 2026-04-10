const encoder = new TextEncoder();

export const ADMIN_COOKIE_NAME = "apexplay_admin_auth";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

interface AdminSessionPayload {
  exp: number;
  iat: number;
}

function toBase64Url(input: string) {
  return btoa(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return atob(normalized + padding);
}

function bytesToBinary(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

function binaryToBytes(binary: string) {
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.NEXTAUTH_SECRET || process.env.ADMIN_PASSWORD || "";
}

async function getSigningKey() {
  const secret = getAdminSessionSecret();
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET, NEXTAUTH_SECRET, or ADMIN_PASSWORD");
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function signPayload(payload: string) {
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(bytesToBinary(new Uint8Array(signature)));
}

export async function createAdminSessionToken() {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    iat: now,
    exp: now + ADMIN_SESSION_MAX_AGE_SECONDS,
  };
  const serializedPayload = JSON.stringify(payload);
  const signature = await signPayload(serializedPayload);

  return `${toBase64Url(serializedPayload)}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined | null) {
  if (!token) {
    return false;
  }

  const [payloadSegment, signatureSegment] = token.split(".");
  if (!payloadSegment || !signatureSegment) {
    return false;
  }

  try {
    const payloadBinary = fromBase64Url(payloadSegment);
    const payload = JSON.parse(payloadBinary) as AdminSessionPayload;
    const key = await getSigningKey();
    const isValidSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      binaryToBytes(fromBase64Url(signatureSegment)),
      encoder.encode(payloadBinary)
    );

    if (!isValidSignature) {
      return false;
    }

    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
