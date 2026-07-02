//! rawler-backed RAW reader. Adapts a decoded `rawler` image into a `RawScene` and
//! develops it through the pure pipeline in `lib.rs`.

use rawler::cfa::CFA;
use rawler::RawImageData;

use crate::{render_to_rgba, BayerPattern, DecodedRaw, RawError, RawMeta, RawScene};

/// Decode a camera RAW file to a developed, color-managed sRGB RGBA8 image.
pub fn decode_raw(path: &str) -> Result<DecodedRaw, RawError> {
    let raw = rawler::decode_file(path).map_err(|e| RawError::Decode(e.to_string()))?;

    // We currently develop classic 2x2 Bayer mosaics only. Non-CFA (cpp != 1) and
    // X-Trans/4-color sensors fall through with a clear message (refinement later).
    if raw.cpp != 1 {
        return Err(RawError::Unsupported(format!(
            "{} {} is not a single-channel CFA image (cpp={})",
            raw.clean_make, raw.clean_model, raw.cpp
        )));
    }
    let pattern = bayer_from_cfa(&raw.camera.cfa).ok_or_else(|| {
        RawError::Unsupported(format!(
            "CFA pattern '{}' unsupported (only RGGB/BGGR/GRBG/GBRG for now)",
            raw.camera.cfa.name
        ))
    })?;

    let width = raw.width;
    let height = raw.height;
    let n = width * height;

    // Photosite values as f32 (most formats are u16; some DNGs are already f32).
    let data: Vec<f32> = match &raw.data {
        RawImageData::Integer(v) => v.iter().map(|&x| x as f32).collect(),
        RawImageData::Float(v) => v.clone(),
    };
    if data.len() < n {
        return Err(RawError::Decode(format!(
            "pixel data ({}) smaller than {}x{}",
            data.len(),
            width,
            height
        )));
    }

    // Black / white levels — use the first channel as a representative scalar.
    let black = raw
        .blacklevel
        .levels
        .first()
        .map(|r| r.as_f32())
        .unwrap_or(0.0);
    let white = raw
        .whitelevel
        .0
        .first()
        .copied()
        .unwrap_or(u16::MAX as u32) as f32;

    // As-shot white balance (RGBE → RGB) and the XYZ→cam matrix (4 rows → first 3).
    let wb = sanitize_wb([raw.wb_coeffs[0], raw.wb_coeffs[1], raw.wb_coeffs[2]]);
    let x = raw.xyz_to_cam;
    let xyz_to_cam = [x[0], x[1], x[2]];

    let scene = RawScene {
        cfa: data[..n].to_vec(),
        width,
        height,
        pattern,
        black,
        white,
        wb,
        xyz_to_cam,
    };

    let meta = RawMeta {
        make: raw.clean_make.clone(),
        model: raw.clean_model.clone(),
        ..Default::default()
    };

    Ok(render_to_rgba(&scene, meta))
}

/// Map a rawler CFA (color codes R=0,G=1,B=2) to our Bayer enum. Only 2x2 mosaics.
fn bayer_from_cfa(cfa: &CFA) -> Option<BayerPattern> {
    if cfa.width != 2 || cfa.height != 2 {
        return None;
    }
    match cfa.name.as_str() {
        "RGGB" => Some(BayerPattern::Rggb),
        "BGGR" => Some(BayerPattern::Bggr),
        "GRBG" => Some(BayerPattern::Grbg),
        "GBRG" => Some(BayerPattern::Gbrg),
        _ => None,
    }
}

/// Replace non-finite / non-positive white-balance multipliers with 1.0.
fn sanitize_wb(wb: [f32; 3]) -> [f32; 3] {
    let fix = |v: f32| if v.is_finite() && v > 0.0 { v } else { 1.0 };
    [fix(wb[0]), fix(wb[1]), fix(wb[2])]
}
