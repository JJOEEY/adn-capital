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

/// Decode a standard image (JPEG/PNG/WebP/TIFF) to RGBA. RAW extensions are routed
/// to `decode_raw` (M2); until that lands they return a clear error.
#[tauri::command]
fn load_image(path: String) -> Result<DecodedImage, AppErrorWire> {
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    const RAW_EXTS: &[&str] = &["nef", "cr3", "cr2", "arw", "dng", "raf", "rw2", "orf"];
    if RAW_EXTS.contains(&ext.as_str()) {
        return raw::decode_raw(&path).map_err(Into::into);
    }

    let img = image::open(&path).map_err(AppError::from)?;
    let rgba = img.to_rgba8();
    Ok(DecodedImage {
        width: rgba.width(),
        height: rgba.height(),
        rgba: rgba.into_raw(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![load_image])
        .run(tauri::generate_context!())
        .expect("error while running Lumen");
}
