#!/usr/bin/env node
// Lumen license issuer (offline). ECDSA P-256 (SHA-256) — matches src/lib/license.ts.
//
// One-time setup:
//   node scripts/issue-license.mjs keygen
//     → generates a keypair, saves the PRIVATE key to scripts/.lumen-issuer-key.json
//       (gitignored — keep it secret!), and prints the PUBLIC key to paste into
//       LUMEN_PUBLIC_KEY in src/lib/license.ts.
//
// Mint a license key for a customer:
//   node scripts/issue-license.mjs --name "Acme Studio" --tier pro
//   node scripts/issue-license.mjs --name "Trial User" --tier trial --days 14
//
// The printed key is what the customer pastes into the app's License panel.

import { webcrypto as crypto } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEY_FILE = join(HERE, ".lumen-issuer-key.json");

const b64 = (buf) => Buffer.from(buf).toString("base64");
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function keygen() {
  if (existsSync(KEY_FILE)) {
    console.error(`Refusing to overwrite existing ${KEY_FILE}. Delete it first to regenerate.`);
    process.exit(1);
  }
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const priv = b64(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const pub = b64(await crypto.subtle.exportKey("spki", kp.publicKey));
  writeFileSync(KEY_FILE, JSON.stringify({ privateKey: priv, publicKey: pub }, null, 2));
  console.log(`\n✓ Saved private key to ${KEY_FILE} (gitignored — keep it SECRET).`);
  console.log(`\nPaste this into LUMEN_PUBLIC_KEY in src/lib/license.ts:\n\n  export const LUMEN_PUBLIC_KEY = "${pub}";\n`);
}

async function issue(args) {
  if (!existsSync(KEY_FILE)) {
    console.error("No issuer key found. Run `node scripts/issue-license.mjs keygen` first.");
    process.exit(1);
  }
  const { name, tier, days } = args;
  if (!name || (tier !== "pro" && tier !== "trial")) {
    console.error('Usage: --name "Customer" --tier pro|trial [--days N]');
    process.exit(1);
  }
  const { privateKey } = JSON.parse(readFileSync(KEY_FILE, "utf8"));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(privateKey, "base64"),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  const payload = { name, tier };
  if (days) payload.exp = Date.now() + Number(days) * 86400000;
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bytes));
  console.log(`\nLicense key for ${name} (${tier}${days ? `, ${days}d` : ""}):\n\n  ${b64url(bytes)}.${b64url(sig)}\n`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name") out.name = argv[++i];
    else if (argv[i] === "--tier") out.tier = argv[++i];
    else if (argv[i] === "--days") out.days = argv[++i];
  }
  return out;
}

const cmd = process.argv[2];
if (cmd === "keygen") await keygen();
else await issue(parseArgs(process.argv.slice(2)));
