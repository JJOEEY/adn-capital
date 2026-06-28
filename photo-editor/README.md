# Lumen — Photo Editor

A desktop-first photo editor (a focused Lightroom alternative) with **on-device AI
background removal**. Non-destructive editing, GPU-accelerated preview, RAW support,
and a customizable color-grading system. Built to run on one codebase across desktop
(Windows / macOS / Linux) and, later, mobile (iOS / Android) via **Tauri 2**.

> Status: **M0 + M1 + M2.** The web frontend (WebGL2 editor) runs today, and RAW
> decode + color management is implemented in the pure-Rust `raw-core` crate
> (unit-tested headless; wired into the desktop build). Color grading (M3), AI
> background removal (M4), catalog/export (M5), and commercial packaging (M6)
> follow the milestones in the project plan.

## Stack

| Layer | Choice |
|-------|--------|
| App shell | Tauri 2 (Rust core + system webview) |
| Frontend | React + TypeScript + Vite |
| Editor engine | WebGL2 shader pipeline (non-destructive) |
| RAW | Rust `rawler` (decode + demosaic) — *M2* |
| AI background removal | `ort` + ONNX, **BiRefNet (MIT)** — *M4* |
| Catalog | SQLite — *M5* |
| State | Zustand |

## Run

### Web (works in any browser — no Rust needed)

```bash
cd photo-editor
npm install
npm run dev      # http://localhost:1420 — Open an image and drag the sliders
npm run build    # type-check + production build
```

### Desktop (Tauri)

Requires the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/)
(Rust toolchain + platform webview libs — e.g. `webkit2gtk` on Linux).

```bash
cd photo-editor
npm install
# One-time: generate app icons (referenced by tauri.conf.json) from any square PNG:
npm run tauri icon path/to/logo.png
npm run tauri:dev     # launches the native desktop window
npm run tauri:build   # produces installers (.dmg / .msi / .AppImage …)
```

## What works now (M1)

- Open standard images (JPEG/PNG/WebP/TIFF).
- Real-time, non-destructive adjustments on the GPU: exposure, contrast,
  highlights/shadows, whites/blacks, white balance (temp/tint), vibrance,
  saturation, clarity.
- Undo / redo (Ctrl/Cmd+Z, +Shift to redo), reset, hold-to-compare before/after.
- Live RGB histogram.

Every edit is a field in a serializable **recipe** (`src/editor/recipe.ts`); the
source pixels are never mutated.

## RAW support (M2)

Opening a `.NEF/.CR3/.CR2/.ARW/.DNG/.RAF/.RW2/.ORF` in the **desktop** build routes
to `raw-core`, which decodes (via `rawler`), demosaics (bilinear Bayer), applies the
camera white balance + camera→sRGB color matrix, and returns a color-managed sRGB
image that flows through the same editor pipeline. The RAW pipeline is pure Rust and
unit-tested headless:

```bash
cd photo-editor
cargo test -p raw-core      # demosaic + color-management unit tests (no webview needed)
```

## Project layout

```
photo-editor/
├─ Cargo.toml           # Rust workspace (src-tauri + crates/raw-core)
├─ src/                 # React frontend
│  ├─ editor/           # recipe model + WebGL2 pipeline + shaders + color/ (M3)
│  ├─ store/            # Zustand editor store (recipe, undo/redo)
│  ├─ components/       # Canvas, AdjustPanel, Histogram, Toolbar
│  └─ lib/platform.ts   # Tauri ↔ web file abstraction
├─ crates/raw-core/     # ⭐ pure-Rust RAW decode + demosaic + color (unit-tested)
└─ src-tauri/           # Rust core (Tauri app)
   ├─ src/lib.rs        # Tauri commands (load_image routes RAW → raw-core)
   ├─ src/raw/          # thin bridge to raw-core (M2)
   ├─ src/ai/           # BiRefNet background removal (M4)
   └─ resources/models/ # ONNX weights (downloaded, not committed)
```

## Licensing note (commercial)

Only **MIT/Apache** AI models are shipped (BiRefNet). BRIA RMBG models are
intentionally avoided (non-commercial). See `THIRD-PARTY-NOTICES.md`.

## Extracting to its own repository

This project currently lives in the `photo-editor/` subdirectory of another repo
for environment reasons. To split it into a standalone repo with history:

```bash
git subtree split -P photo-editor -b lumen-standalone
# then push the lumen-standalone branch to a new repo, or:
pip install git-filter-repo
git filter-repo --path photo-editor --path-rename photo-editor/:
```

Or simply copy the `photo-editor/` directory into a fresh repo. The `ci/` folder
holds a GitHub Actions workflow to move to `.github/workflows/` once standalone.
