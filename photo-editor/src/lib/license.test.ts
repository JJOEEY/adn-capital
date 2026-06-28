import { describe, expect, it } from "vitest";
import { bytesToB64, bytesToB64url, verifyLicense, License } from "./license";

// Issue a key with a throwaway P-256 keypair, then verify against the matching
// public key — and confirm tampering / wrong-key / expiry are rejected.
async function issue(payload: License, privateKey: CryptoKey): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, bytes)
  );
  return `${bytesToB64url(bytes)}.${bytesToB64url(sig)}`;
}

describe("license verification", () => {
  it("accepts a validly signed license and rejects tampering", async () => {
    const kp = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
    const pubB64 = bytesToB64(new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey)));

    const key = await issue({ name: "Acme Studio", tier: "pro" }, kp.privateKey);
    const lic = await verifyLicense(key, pubB64);
    expect(lic?.tier).toBe("pro");
    expect(lic?.name).toBe("Acme Studio");

    // Swap the payload but keep the old signature → must fail.
    const forgedPayload = bytesToB64url(
      new TextEncoder().encode(JSON.stringify({ name: "Pirate", tier: "pro" }))
    );
    const sig = key.split(".")[1];
    expect(await verifyLicense(`${forgedPayload}.${sig}`, pubB64)).toBeNull();
  });

  it("rejects a key verified against a different public key", async () => {
    const a = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const b = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const bPub = bytesToB64(new Uint8Array(await crypto.subtle.exportKey("spki", b.publicKey)));
    const key = await issue({ name: "X", tier: "pro" }, a.privateKey);
    expect(await verifyLicense(key, bPub)).toBeNull();
  });

  it("rejects an expired license", async () => {
    const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const pubB64 = bytesToB64(new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey)));
    const key = await issue({ name: "Trial", tier: "trial", exp: 1 }, kp.privateKey); // 1970
    expect(await verifyLicense(key, pubB64)).toBeNull();
  });

  it("returns null for malformed keys / empty embedded key", async () => {
    expect(await verifyLicense("garbage", "")).toBeNull();
    expect(await verifyLicense("a.b", "not-base64")).toBeNull();
  });
});
