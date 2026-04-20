import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getEncryptionKey() {
  const raw = process.env.DNSE_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new Error("DNSE_TOKEN_ENCRYPTION_KEY is missing");
  }
  return createHash("sha256").update(raw).digest();
}

export function encryptDnseToken(plainText: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptDnseToken(cipherText: string) {
  const key = getEncryptionKey();
  const [ivRaw, tagRaw, encryptedRaw] = cipherText.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid DNSE token payload");
  }
  const iv = Buffer.from(ivRaw, "base64url");
  const tag = Buffer.from(tagRaw, "base64url");
  const encrypted = Buffer.from(encryptedRaw, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}
