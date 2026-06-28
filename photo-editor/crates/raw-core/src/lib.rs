//! raw-core — pure-Rust RAW decode + demosaic + color management for Lumen.
//!
//! The `decode`/color/demosaic math is independent of any RAW library so it can be
//! unit-tested headless. The optional `decode` feature wires up `rawler` to read
//! real camera files and feed this pipeline.

pub mod color;
pub mod demosaic;
pub mod meta;

pub use demosaic::BayerPattern;
pub use meta::RawMeta;

/// Final output of the RAW pipeline: an sRGB, gamma-encoded RGBA8 image plus the
/// camera metadata. RGBA8 slots straight into the existing WebGL upload path.
#[derive(Debug, Clone)]
pub struct DecodedRaw {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
    pub meta: RawMeta,
}

#[derive(Debug, thiserror::Error)]
pub enum RawError {
    #[error("raw decode error: {0}")]
    Decode(String),
    #[error("unsupported raw: {0}")]
    Unsupported(String),
}

/// A decoded-but-not-developed RAW scene: the mosaiced photosite plane plus the
/// camera parameters needed to develop it. This is the seam between the RAW reader
/// (rawler) and the pure development pipeline.
pub struct RawScene {
    /// Raw photosite values (pre-normalization), row-major, length width*height.
    pub cfa: Vec<f32>,
    pub width: usize,
    pub height: usize,
    pub pattern: BayerPattern,
    pub black: f32,
    pub white: f32,
    /// As-shot white-balance multipliers (R, G, B); normalized to green internally.
    pub wb: [f32; 3],
    /// DNG-style XYZ(D65) → camera matrix.
    pub xyz_to_cam: [[f32; 3]; 3],
}

/// Develop a mosaiced scene into an sRGB RGBA8 image. Pure — no I/O, fully tested.
pub fn render_to_rgba(scene: &RawScene, meta: RawMeta) -> DecodedRaw {
    let n = scene.width * scene.height;
    // 1. Normalize photosites to 0..1 using black/white levels.
    let norm: Vec<f32> = scene
        .cfa
        .iter()
        .map(|&v| color::normalize(v, scene.black, scene.white))
        .collect();
    // 2. Demosaic to linear camera RGB (Malvar — sharper than bilinear, same cost).
    let rgb = demosaic::demosaic_malvar(&norm, scene.width, scene.height, scene.pattern);
    // 3. White balance + camera→sRGB matrix, then gamma encode.
    let wb = color::normalize_wb(scene.wb);
    let m = color::cam_to_srgb(&scene.xyz_to_cam);
    let mut rgba = Vec::with_capacity(n * 4);
    for px in rgb {
        let s = color::apply_wb_and_matrix(px, wb, &m);
        rgba.push(color::linear_to_srgb_u8(s[0]));
        rgba.push(color::linear_to_srgb_u8(s[1]));
        rgba.push(color::linear_to_srgb_u8(s[2]));
        rgba.push(255);
    }
    DecodedRaw {
        width: scene.width as u32,
        height: scene.height as u32,
        rgba,
        meta,
    }
}

#[cfg(feature = "decode")]
mod decode;
#[cfg(feature = "decode")]
pub use decode::decode_raw;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_flat_gray_scene() {
        // A flat mid-level RGGB scene with identity color should render as neutral.
        let (w, h) = (4, 4);
        let scene = RawScene {
            cfa: vec![2048.0; w * h],
            width: w,
            height: h,
            pattern: BayerPattern::Rggb,
            black: 0.0,
            white: 4095.0,
            wb: [1.0, 1.0, 1.0],
            xyz_to_cam: [[0.6, 0.2, 0.1], [0.2, 0.7, 0.1], [0.1, 0.2, 0.8]],
        };
        let out = render_to_rgba(&scene, RawMeta::default());
        assert_eq!(out.width, 4);
        assert_eq!(out.rgba.len(), w * h * 4);
        // Neutral in, neutral out: R==G==B at the first pixel, alpha opaque.
        assert_eq!(out.rgba[0], out.rgba[1]);
        assert_eq!(out.rgba[1], out.rgba[2]);
        assert_eq!(out.rgba[3], 255);
    }
}
