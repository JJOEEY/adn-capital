# Releasing Lumen (commercial)

This covers packaging, code-signing, auto-update, on-device AI, and licensing — the
M6 commercial concerns. Several steps need accounts/certs only you can provide;
they're called out as **[needs you]**.

## 1. Versioning

Bump the version in `package.json`, `src-tauri/Cargo.toml`, and
`src-tauri/tauri.conf.json` (keep them in sync), commit, then tag:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

The release workflow (`ci/release.yml` → move to `.github/workflows/`) builds signed
installers for macOS (Intel + Apple Silicon), Windows, and Linux, and publishes a
draft GitHub Release with auto-updater artifacts.

## 2. Auto-update signing

```bash
npm run tauri signer generate -- -w ~/.lumen/updater.key
```

- Put the **public** key in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
- Add the **private** key + password as the `TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` repo secrets.
- Point `plugins.updater.endpoints` at where you host `latest.json` + artifacts.

## 3. Code-signing **[needs you]**

- **macOS**: Apple Developer ID cert + notarization. Provide `APPLE_CERTIFICATE`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`,
  `APPLE_PASSWORD` (app-specific), `APPLE_TEAM_ID` as secrets.
- **Windows**: an OV/EV code-signing certificate. Wire it into the Windows job
  (e.g. Azure Trusted Signing or a PFX) so SmartScreen trusts the installer.

Unsigned builds run but show OS security warnings.

## 4. On-device AI model

The matting model is **not** committed (large, and to keep the default build light).
For an AI-enabled release:

1. Download a **BiRefNet** ONNX (MIT — commercial-safe; **never** ship BRIA RMBG).
2. Place it at `src-tauri/resources/models/birefnet.onnx`.
3. Build with the `ai` feature: append `--features ai` to the tauri build args.

`ort` downloads the ONNX Runtime automatically at build time. See
`src-tauri/resources/models/README.md` and `THIRD-PARTY-NOTICES.md`.

## 5. Licensing **[needs you]**

Lumen verifies Pro license keys **offline** with ECDSA P-256 (`src/lib/license.ts`).

1. Generate an issuer keypair (P-256). Embed the **public** key (SPKI base64) in
   `LUMEN_PUBLIC_KEY` (`src/lib/license.ts`).
2. Keep the **private** key in an offline issuer tool. A key is
   `base64url(payloadJSON).base64url(ECDSA_P256_SHA256_signature)` where payload is
   `{ "name": "...", "tier": "pro", "exp"?: <epoch ms> }`.
3. Free tier exports a watermark; a valid Pro key removes it
   (`renderToBlob(..., watermark)`).

Verification is unit-tested (`src/lib/license.test.ts`). Until you set
`LUMEN_PUBLIC_KEY`, every install runs as Free.

## 6. Pre-release checklist

- `npm test` (color-math + license) and `cargo test -p raw-core -p ai-core` green.
- App icons generated: `npm run tauri icon path/to/logo.png`.
- Smoke-test `npm run tauri:build` locally on at least one OS.
