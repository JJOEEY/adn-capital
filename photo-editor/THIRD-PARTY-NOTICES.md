# Third-Party Notices

Lumen bundles or depends on the following third-party components. Their licenses
are reproduced/attributed here as required.

## AI models (bundled at build time)

- **BiRefNet** — MIT License. © ZhengPeng7 and contributors.
  https://github.com/ZhengPeng7/BiRefNet
  Used for on-device foreground/background segmentation.

> Commercial-use note: only MIT/Apache-licensed models are shipped. BRIA RMBG
> models are intentionally **not** used (non-commercial license).

## Notable runtime dependencies

- **Tauri** (MIT / Apache-2.0)
- **ONNX Runtime** via `ort` (MIT)
- **rawler** — RAW decoding (LGPL-2.1; used as a library/dependency)
- **image** crate (MIT / Apache-2.0)
- **React**, **Zustand**, **Vite** (MIT)

This file must be kept up to date as dependencies change, and included in
distributed builds.
