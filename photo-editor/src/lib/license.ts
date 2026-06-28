// Offline license verification. A license key is `base64url(payloadJSON).base64url(sig)`
// where `sig` is an ECDSA P-256 (SHA-256) signature over the payload bytes, produced
// by the vendor's private key. The app embeds only the PUBLIC key, so keys can be
// validated fully offline and cannot be forged without the private key.
//
// To issue keys, generate a P-256 keypair, embed the SPKI public key below, and sign
// payloads with the private key in an offline issuer tool. See RELEASE.md.

export interface License {
  name: string;
  tier: "pro" | "trial";
  exp?: number; // epoch ms; omit for perpetual
}

// PLACEHOLDER — replace with your issuer's SPKI public key (base64). Empty = no
// valid licenses (everything runs as Free) until you set this.
export const LUMEN_PUBLIC_KEY = "";

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function bytesToB64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function b64urlToBytes(s: string): Uint8Array {
  return b64ToBytes(s.replace(/-/g, "+").replace(/_/g, "/"));
}

/// Verify a license key against the embedded (or supplied) public key. Returns the
/// decoded License if the signature is valid and unexpired, else null.
export async function verifyLicense(
  key: string,
  publicKeyB64: string = LUMEN_PUBLIC_KEY
): Promise<License | null> {
  try {
    if (!publicKeyB64) return null;
    const [payloadB64, sigB64] = key.trim().split(".");
    if (!payloadB64 || !sigB64) return null;
    const payload = b64urlToBytes(payloadB64);
    const sig = b64urlToBytes(sigB64);
    const pub = await crypto.subtle.importKey(
      "spki",
      b64ToBytes(publicKeyB64) as BufferSource,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pub,
      sig as BufferSource,
      payload as BufferSource
    );
    if (!ok) return null;
    const lic = JSON.parse(new TextDecoder().decode(payload)) as License;
    if (lic.exp && Date.now() > lic.exp) return null;
    if (lic.tier !== "pro" && lic.tier !== "trial") return null;
    return lic;
  } catch {
    return null;
  }
}
