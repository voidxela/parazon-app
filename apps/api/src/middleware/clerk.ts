import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { type HonoVariables } from "../types.js";

/**
 * Validates the Clerk-issued JWT in the Authorization header.
 *
 * Clerk's JWT is a standard RS256 token. We verify it against Clerk's
 * JWKS endpoint derived from the publishable key's embedded issuer URL.
 *
 * On success, the decoded payload is stored in `c.set("clerkUserId", ...)`.
 */

interface ClerkJwtPayload {
  sub: string;
  exp: number;
  iat: number;
}

function parseJwtPayload(token: string): ClerkJwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) {
    throw new Error("Malformed JWT");
  }
  const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(padded, "base64").toString("utf-8");
  return JSON.parse(json) as ClerkJwtPayload;
}

async function fetchJwks(issuer: string): Promise<JsonWebKeySet> {
  const url = `${issuer}/.well-known/jwks.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch JWKS from ${url}: ${res.status.toString()}`);
  return res.json() as Promise<JsonWebKeySet>;
}

/** JsonWebKey extended with the `kid` field used for key lookup. */
interface JwkWithKid extends JsonWebKey {
  kid?: string;
}

interface JsonWebKeySet {
  keys: JwkWithKid[];
}

async function verifyClerkJwt(token: string): Promise<string> {
  const payload = parseJwtPayload(token);

  // Validate expiry
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  // Derive issuer from the publishable key (format: pk_<env>_<base64-issuer>)
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY ?? "";
  const parts = publishableKey.split("_");
  const encoded = parts[2];
  if (!encoded) throw new Error("Invalid CLERK_PUBLISHABLE_KEY format");

  const issuer = Buffer.from(encoded, "base64").toString("utf-8").replace(/\$+$/, "");

  // Verify signature via Web Crypto against Clerk's JWKS
  const jwks = await fetchJwks(issuer);
  const header = JSON.parse(
    Buffer.from(token.split(".")[0] ?? "", "base64url").toString("utf-8"),
  ) as { kid?: string };

  const jwk = jwks.keys.find((k) => k.kid === header.kid) ?? jwks.keys[0];
  if (!jwk) throw new Error("No matching JWK found");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const tokenParts = token.split(".");
  const signingInput = new TextEncoder().encode(`${tokenParts[0]}.${tokenParts[1]}`);
  const signature = Buffer.from(tokenParts[2] ?? "", "base64url");

  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", cryptoKey, signature, signingInput);
  if (!valid) throw new Error("Invalid JWT signature");

  return payload.sub;
}

export const clerkMiddleware = createMiddleware<{ Variables: HonoVariables }>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or malformed Authorization header" });
  }

  const token = authHeader.slice(7);
  try {
    const userId = await verifyClerkJwt(token);
    c.set("clerkUserId", userId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unauthorized";
    throw new HTTPException(401, { message });
  }

  await next();
});
