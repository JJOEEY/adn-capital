// RAW decode bridge. The heavy lifting (decode + demosaic + color management) lives
// in the pure-Rust `raw-core` workspace crate so it can be unit-tested headless;
// this thin layer adapts its output into the Tauri-facing `DecodedImage`.

use crate::{AppError, DecodedImage};

pub fn decode_raw(path: &str) -> Result<DecodedImage, AppError> {
    let decoded = raw_core::decode_raw(path).map_err(|e| AppError::Other(e.to_string()))?;
    Ok(DecodedImage {
        width: decoded.width,
        height: decoded.height,
        rgba: decoded.rgba,
    })
}
