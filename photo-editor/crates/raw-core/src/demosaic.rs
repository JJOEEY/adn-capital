//! Bayer demosaicing. Pure functions over a normalized CFA plane — no RAW-decoder
//! dependency, so the interpolation is unit-testable in isolation.

/// The four Bayer color-filter arrangements, named by their top-left 2x2 quad.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BayerPattern {
    Rggb,
    Bggr,
    Grbg,
    Gbrg,
}

impl BayerPattern {
    /// Color index carried by the photosite at (row, col): 0 = R, 1 = G, 2 = B.
    pub fn color_at(self, row: usize, col: usize) -> usize {
        let quad = match self {
            BayerPattern::Rggb => [[0, 1], [1, 2]],
            BayerPattern::Bggr => [[2, 1], [1, 0]],
            BayerPattern::Grbg => [[1, 0], [2, 1]],
            BayerPattern::Gbrg => [[1, 2], [0, 1]],
        };
        quad[row & 1][col & 1]
    }
}

/// Bilinear demosaic: for every pixel, each missing channel is the average of the
/// same-colored samples in the 3x3 neighborhood (the channel present at the site is
/// taken directly). This is the classic, fast Bayer interpolation — good enough for
/// an interactive preview; higher-quality kernels (AHD/AMaZE) can replace it later.
///
/// `cfa` is a single-channel plane of length `width * height`. Returns one `[r,g,b]`
/// per pixel in the same linear space as the input.
pub fn demosaic_bilinear(
    cfa: &[f32],
    width: usize,
    height: usize,
    pattern: BayerPattern,
) -> Vec<[f32; 3]> {
    assert_eq!(cfa.len(), width * height, "cfa length must be width*height");
    let at = |r: i64, c: i64| -> f32 {
        let r = r.clamp(0, height as i64 - 1) as usize;
        let c = c.clamp(0, width as i64 - 1) as usize;
        cfa[r * width + c]
    };

    let mut out = vec![[0f32; 3]; width * height];
    for r in 0..height {
        for c in 0..width {
            let center = pattern.color_at(r, c);
            let mut rgb = [0f32; 3];
            for color in 0..3 {
                if color == center {
                    rgb[color] = cfa[r * width + c];
                    continue;
                }
                let mut sum = 0.0;
                let mut n = 0.0;
                for dr in -1..=1i64 {
                    for dc in -1..=1i64 {
                        // Match on the neighbor's true parity-based color; sample the
                        // clamped value so edges stay well-defined.
                        if cfa_color_at_abs(pattern, r as i64 + dr, c as i64 + dc) == color {
                            sum += at(r as i64 + dr, c as i64 + dc);
                            n += 1.0;
                        }
                    }
                }
                rgb[color] = if n > 0.0 { sum / n } else { 0.0 };
            }
            out[r * width + c] = rgb;
        }
    }
    out
}

// Color index at an absolute (possibly out-of-range) coordinate, using parity. The
// CFA pattern is periodic so clamping for *sampling* but using true parity for
// *color identity* keeps edges consistent.
fn cfa_color_at_abs(pattern: BayerPattern, row: i64, col: i64) -> usize {
    let r = row.rem_euclid(2) as usize;
    let c = col.rem_euclid(2) as usize;
    pattern.color_at(r, c)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn color_at_rggb() {
        let p = BayerPattern::Rggb;
        assert_eq!(p.color_at(0, 0), 0); // R
        assert_eq!(p.color_at(0, 1), 1); // G
        assert_eq!(p.color_at(1, 0), 1); // G
        assert_eq!(p.color_at(1, 1), 2); // B
    }

    #[test]
    fn demosaic_flat_field_is_preserved() {
        // A perfectly flat scene: every channel should reconstruct to the same value.
        let (w, h) = (4, 4);
        let cfa = vec![0.5f32; w * h];
        let rgb = demosaic_bilinear(&cfa, w, h, BayerPattern::Rggb);
        for px in rgb {
            for ch in px {
                assert!((ch - 0.5).abs() < 1e-6, "flat field should stay 0.5, got {ch}");
            }
        }
    }

    #[test]
    fn demosaic_recovers_known_neighbors() {
        // RGGB 4x4. Put red=1.0 at all R sites, others 0. At a B site (1,1) the
        // interpolated R is the average of the 4 diagonal R neighbors (all 1.0).
        let (w, h) = (4, 4);
        let mut cfa = vec![0f32; w * h];
        let pattern = BayerPattern::Rggb;
        for r in 0..h {
            for c in 0..w {
                if pattern.color_at(r, c) == 0 {
                    cfa[r * w + c] = 1.0;
                }
            }
        }
        let rgb = demosaic_bilinear(&cfa, w, h, pattern);
        // Blue site at (1,1): R channel interpolated from diagonal reds => 1.0
        assert!((rgb[1 * w + 1][0] - 1.0).abs() < 1e-6);
        // Its own blue channel is 0 (we set only reds).
        assert!(rgb[1 * w + 1][2].abs() < 1e-6);
        // A red site keeps R=1 exactly.
        assert!((rgb[0][0] - 1.0).abs() < 1e-6);
    }
}
