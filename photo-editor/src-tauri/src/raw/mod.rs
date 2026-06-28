// RAW decode (M2). Will use `rawler` (pure Rust) to decode + demosaic camera RAW
// files (NEF/CR3/ARW/DNG/RAF…), then apply the camera color matrix + white balance
// to produce a color-managed linear image.
//
// Stubbed until M2 so the desktop build links and standard formats work today.

use crate::{AppError, DecodedImage};

pub fn decode_raw(_path: &str) -> Result<DecodedImage, AppError> {
    Err(AppError::Other(
        "RAW decoding arrives in M2 (rawler). For now, open a JPEG/PNG/TIFF.".into(),
    ))
}
