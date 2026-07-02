// Tauri application core. Registers the command handlers the frontend invokes.
//
// Current commands:
//   load_image   — decode a standard image file to RGBA bytes (RAW handled in M2)
//   decode_raw   — (M2) RAW decode + demosaic via `rawler`
//   remove_background — (M4) on-device BiRefNet via `ort`

mod ai;
mod raw;

use serde::Serialize;

#[derive(Serialize)]
pub struct DecodedImage {
    pub width: u32,
    pub height: u32,
    /// Tightly packed RGBA8 pixels (row-major, top-down).
    pub rgba: Vec<u8>,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("image decode error: {0}")]
    Image(#[from] image::ImageError),
    #[error("{0}")]
    Other(String),
}

// Tauri commands must return a serializable error.
impl Serialize for AppErrorWire {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.0)
    }
}
pub struct AppErrorWire(String);
impl From<AppError> for AppErrorWire {
    fn from(e: AppError) -> Self {
        AppErrorWire(e.to_string())
    }
}

/// Decode any supported image (standard formats + RAW) to RGBA8.
fn decode_path(path: &str) -> Result<DecodedImage, AppError> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    const RAW_EXTS: &[&str] = &["nef", "cr3", "cr2", "arw", "dng", "raf", "rw2", "orf"];
    if RAW_EXTS.contains(&ext.as_str()) {
        return raw::decode_raw(path);
    }

    let img = image::open(path).map_err(AppError::from)?;
    let rgba = img.to_rgba8();
    Ok(DecodedImage {
        width: rgba.width(),
        height: rgba.height(),
        rgba: rgba.into_raw(),
    })
}

#[tauri::command]
fn load_image(path: String) -> Result<DecodedImage, AppErrorWire> {
    decode_path(&path).map_err(Into::into)
}

/// A foreground alpha matte at the source image resolution (255 = foreground).
#[derive(Serialize)]
pub struct MaskResult {
    pub width: u32,
    pub height: u32,
    pub alpha: Vec<u8>,
}

/// On-device background removal. Decodes the source, runs the matting model, and
/// returns an alpha matte. Requires the `ai` feature + a model in resources/models/.
#[tauri::command]
fn remove_background(app: tauri::AppHandle, path: String) -> Result<MaskResult, AppErrorWire> {
    use tauri::Manager;
    let img = decode_path(&path)?;
    let model = app
        .path()
        .resolve("resources/models/birefnet.onnx", tauri::path::BaseDirectory::Resource)
        .map_err(|e| AppError::Other(e.to_string()))?;
    let alpha = ai::remove_background(
        &img.rgba,
        img.width as usize,
        img.height as usize,
        &model.to_string_lossy(),
    )
    .map_err(AppError::Other)?;
    Ok(MaskResult {
        width: img.width,
        height: img.height,
        alpha,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init());

    // Auto-update is desktop-only.
    #[cfg(desktop)]
    {
        builder = builder
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![load_image, remove_background])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}
