//! ai-core — pure pre/post-processing for on-device background removal.
//!
//! The matting model (BiRefNet, MIT license — commercial-safe) is an ONNX network
//! that takes a normalized 1024×1024 RGB tensor (NCHW) and returns a single-channel
//! foreground map. The ONNX session itself lives in the Tauri crate behind its `ai`
//! feature; everything here is pure math so it can be unit-tested headless.

#[cfg(feature = "inference")]
mod inference;
#[cfg(feature = "inference")]
pub use inference::{remove_background, BgRemover};

/// BiRefNet's expected square input size.
pub const MODEL_SIZE: usize = 1024;

// ImageNet normalization used by BiRefNet.
const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
const STD: [f32; 3] = [0.229, 0.224, 0.225];

/// Bilinear-sample a single channel of an interleaved RGBA8 image at normalized
/// coordinates (u, v) in [0,1]. Returns 0..1.
fn sample_channel(rgba: &[u8], w: usize, h: usize, ch: usize, u: f32, v: f32) -> f32 {
    let fx = (u * (w as f32 - 1.0)).clamp(0.0, w as f32 - 1.0);
    let fy = (v * (h as f32 - 1.0)).clamp(0.0, h as f32 - 1.0);
    let x0 = fx.floor() as usize;
    let y0 = fy.floor() as usize;
    let x1 = (x0 + 1).min(w - 1);
    let y1 = (y0 + 1).min(h - 1);
    let tx = fx - x0 as f32;
    let ty = fy - y0 as f32;
    let at = |x: usize, y: usize| rgba[(y * w + x) * 4 + ch] as f32 / 255.0;
    let top = at(x0, y0) * (1.0 - tx) + at(x1, y0) * tx;
    let bot = at(x0, y1) * (1.0 - tx) + at(x1, y1) * tx;
    top * (1.0 - ty) + bot * ty
}

/// Resize an interleaved RGBA8 image to MODEL_SIZE² and produce a normalized NCHW
/// f32 tensor (planar R, then G, then B), length 3·MODEL_SIZE².
pub fn preprocess(rgba: &[u8], w: usize, h: usize) -> Vec<f32> {
    assert_eq!(rgba.len(), w * h * 4, "rgba must be w*h*4");
    let n = MODEL_SIZE * MODEL_SIZE;
    let mut out = vec![0f32; 3 * n];
    for ch in 0..3 {
        for y in 0..MODEL_SIZE {
            let v = (y as f32 + 0.5) / MODEL_SIZE as f32;
            for x in 0..MODEL_SIZE {
                let u = (x as f32 + 0.5) / MODEL_SIZE as f32;
                let s = sample_channel(rgba, w, h, ch, u, v);
                out[ch * n + y * MODEL_SIZE + x] = (s - MEAN[ch]) / STD[ch];
            }
        }
    }
    out
}

#[inline]
fn sigmoid(x: f32) -> f32 {
    1.0 / (1.0 + (-x).exp())
}

/// Convert a model output map (MODEL_SIZE², row-major; logits or already 0..1) to an
/// 8-bit alpha matte resized back to the original image dimensions.
///
/// `apply_sigmoid` should be true when the model emits logits (BiRefNet does).
pub fn postprocess(
    map: &[f32],
    out_w: usize,
    out_h: usize,
    apply_sigmoid: bool,
) -> Vec<u8> {
    assert_eq!(map.len(), MODEL_SIZE * MODEL_SIZE, "map must be MODEL_SIZE²");
    let mut alpha = vec![0u8; out_w * out_h];
    for y in 0..out_h {
        let fy = ((y as f32 + 0.5) / out_h as f32 * MODEL_SIZE as f32 - 0.5)
            .clamp(0.0, MODEL_SIZE as f32 - 1.0);
        let y0 = fy.floor() as usize;
        let y1 = (y0 + 1).min(MODEL_SIZE - 1);
        let ty = fy - y0 as f32;
        for x in 0..out_w {
            let fx = ((x as f32 + 0.5) / out_w as f32 * MODEL_SIZE as f32 - 0.5)
                .clamp(0.0, MODEL_SIZE as f32 - 1.0);
            let x0 = fx.floor() as usize;
            let x1 = (x0 + 1).min(MODEL_SIZE - 1);
            let tx = fx - x0 as f32;
            let at = |x: usize, y: usize| map[y * MODEL_SIZE + x];
            let top = at(x0, y0) * (1.0 - tx) + at(x1, y0) * tx;
            let bot = at(x0, y1) * (1.0 - tx) + at(x1, y1) * tx;
            let mut m = top * (1.0 - ty) + bot * ty;
            if apply_sigmoid {
                m = sigmoid(m);
            }
            alpha[y * out_w + x] = (m.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
        }
    }
    alpha
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid(w: usize, h: usize, rgb: [u8; 3]) -> Vec<u8> {
        let mut v = vec![0u8; w * h * 4];
        for i in 0..w * h {
            v[i * 4] = rgb[0];
            v[i * 4 + 1] = rgb[1];
            v[i * 4 + 2] = rgb[2];
            v[i * 4 + 3] = 255;
        }
        v
    }

    #[test]
    fn preprocess_shape_and_normalization() {
        let img = solid(8, 8, [124, 116, 104]); // ≈ ImageNet mean*255
        let t = preprocess(&img, 8, 8);
        assert_eq!(t.len(), 3 * MODEL_SIZE * MODEL_SIZE);
        // A pixel near the mean normalizes to near 0.
        assert!(t[0].abs() < 0.05, "R near mean should be ~0, got {}", t[0]);
    }

    #[test]
    fn sigmoid_endpoints() {
        assert!(sigmoid(0.0) == 0.5);
        assert!(sigmoid(20.0) > 0.99);
        assert!(sigmoid(-20.0) < 0.01);
    }

    #[test]
    fn postprocess_resizes_and_thresholds() {
        // A map that's all large-positive → sigmoid≈1 → alpha 255 at the target size.
        let map = vec![20.0f32; MODEL_SIZE * MODEL_SIZE];
        let a = postprocess(&map, 16, 9, true);
        assert_eq!(a.len(), 16 * 9);
        assert!(a.iter().all(|&v| v == 255));
        // All large-negative → alpha 0.
        let map2 = vec![-20.0f32; MODEL_SIZE * MODEL_SIZE];
        let a2 = postprocess(&map2, 4, 4, true);
        assert!(a2.iter().all(|&v| v == 0));
    }

    #[test]
    fn postprocess_without_sigmoid_passes_through() {
        let map = vec![1.0f32; MODEL_SIZE * MODEL_SIZE];
        let a = postprocess(&map, 4, 4, false);
        assert!(a.iter().all(|&v| v == 255));
    }
}
