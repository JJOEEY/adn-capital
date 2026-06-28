# AI models (downloaded, not committed)

The on-device background-removal model is **not** committed to git (large binary).
Place the ONNX file here before building the desktop app with the `ai` feature.

## Recommended model — commercial-safe

- **BiRefNet** — license **MIT** → free for commercial use.
  - Repo: https://github.com/ZhengPeng7/BiRefNet
  - Export / download an ONNX build and save it here as `birefnet.onnx`.
- Fallback: **U²-Net** — license **Apache-2.0** (also commercial-safe).

## ⚠️ Do NOT use for a commercial product

- **BRIA RMBG-1.4 / RMBG-2.0** — non-commercial license; requires a paid agreement
  with BRIA. Excluded on purpose.

See `../../THIRD-PARTY-NOTICES.md` for attribution requirements.
