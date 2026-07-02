//! Color management: raw-level normalization, white balance, the camera-native →
//! sRGB matrix, and sRGB gamma encoding. All pure math, unit-testable.

/// Standard XYZ (D65) → linear sRGB matrix (Bradford-adapted, sRGB primaries).
pub const XYZ_TO_SRGB: [[f32; 3]; 3] = [
    [3.2406, -1.5372, -0.4986],
    [-0.9689, 1.8758, 0.0415],
    [0.0557, -0.2040, 1.0570],
];

/// Normalize a raw photosite value to 0..1 using the camera's black/white levels.
#[inline]
pub fn normalize(raw: f32, black: f32, white: f32) -> f32 {
    if white <= black {
        return 0.0;
    }
    ((raw - black) / (white - black)).clamp(0.0, 1.0)
}

/// Multiply a 3x3 matrix by a 3-vector.
#[inline]
pub fn mul3(m: &[[f32; 3]; 3], v: [f32; 3]) -> [f32; 3] {
    [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ]
}

/// Multiply two 3x3 matrices (a * b).
pub fn matmul3(a: &[[f32; 3]; 3], b: &[[f32; 3]; 3]) -> [[f32; 3]; 3] {
    let mut out = [[0f32; 3]; 3];
    for i in 0..3 {
        for j in 0..3 {
            out[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
        }
    }
    out
}

/// Invert a 3x3 matrix. Returns None if singular.
pub fn invert3(m: &[[f32; 3]; 3]) -> Option<[[f32; 3]; 3]> {
    let det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
        - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
        + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    if det.abs() < 1e-12 {
        return None;
    }
    let inv_det = 1.0 / det;
    let mut out = [[0f32; 3]; 3];
    out[0][0] = (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * inv_det;
    out[0][1] = (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * inv_det;
    out[0][2] = (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * inv_det;
    out[1][0] = (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * inv_det;
    out[1][1] = (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * inv_det;
    out[1][2] = (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * inv_det;
    out[2][0] = (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * inv_det;
    out[2][1] = (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * inv_det;
    out[2][2] = (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * inv_det;
    Some(out)
}

/// Build the camera-native → linear sRGB matrix from the DNG-style `xyz_to_cam`
/// matrix (XYZ → camera). We invert to get camera → XYZ, then compose with
/// XYZ → sRGB, and row-normalize so neutral raw (after WB) maps to neutral sRGB.
pub fn cam_to_srgb(xyz_to_cam: &[[f32; 3]; 3]) -> [[f32; 3]; 3] {
    let cam_to_xyz = invert3(xyz_to_cam).unwrap_or([
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
    ]);
    let mut m = matmul3(&XYZ_TO_SRGB, &cam_to_xyz);
    // Row-normalize: each output channel of a neutral (1,1,1) camera color = 1.
    for row in m.iter_mut() {
        let s = row[0] + row[1] + row[2];
        if s.abs() > 1e-9 {
            for v in row.iter_mut() {
                *v /= s;
            }
        }
    }
    m
}

/// Apply white balance (per-channel multipliers) then the camera→sRGB matrix.
#[inline]
pub fn apply_wb_and_matrix(linear_cam: [f32; 3], wb: [f32; 3], cam_to_srgb: &[[f32; 3]; 3]) -> [f32; 3] {
    let balanced = [linear_cam[0] * wb[0], linear_cam[1] * wb[1], linear_cam[2] * wb[2]];
    mul3(cam_to_srgb, balanced)
}

/// Encode a linear value to an 8-bit sRGB sample.
#[inline]
pub fn linear_to_srgb_u8(v: f32) -> u8 {
    let v = v.clamp(0.0, 1.0);
    let s = if v <= 0.0031308 {
        v * 12.92
    } else {
        1.055 * v.powf(1.0 / 2.4) - 0.055
    };
    (s * 255.0 + 0.5).clamp(0.0, 255.0) as u8
}

/// Normalize white-balance coefficients so the green multiplier is 1.0.
pub fn normalize_wb(wb_coeffs: [f32; 3]) -> [f32; 3] {
    let g = if wb_coeffs[1].abs() > 1e-9 { wb_coeffs[1] } else { 1.0 };
    [wb_coeffs[0] / g, 1.0, wb_coeffs[2] / g]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_clamps_to_range() {
        assert_eq!(normalize(0.0, 0.0, 100.0), 0.0);
        assert_eq!(normalize(100.0, 0.0, 100.0), 1.0);
        assert!((normalize(50.0, 0.0, 100.0) - 0.5).abs() < 1e-6);
        // Below black clamps to 0, above white clamps to 1.
        assert_eq!(normalize(-10.0, 0.0, 100.0), 0.0);
        assert_eq!(normalize(150.0, 0.0, 100.0), 1.0);
    }

    #[test]
    fn invert_identity() {
        let id = [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];
        let inv = invert3(&id).unwrap();
        assert_eq!(inv, id);
    }

    #[test]
    fn invert_roundtrip() {
        let m = [[2.0, 0.0, 1.0], [1.0, 3.0, 0.0], [0.0, 1.0, 4.0]];
        let inv = invert3(&m).unwrap();
        let prod = matmul3(&m, &inv);
        for i in 0..3 {
            for j in 0..3 {
                let expect = if i == j { 1.0 } else { 0.0 };
                assert!((prod[i][j] - expect).abs() < 1e-5, "not identity at {i},{j}");
            }
        }
    }

    #[test]
    fn neutral_camera_color_stays_neutral() {
        // With any reasonable xyz_to_cam, a neutral camera RGB (1,1,1) after WB and
        // the row-normalized matrix must map to neutral sRGB (all channels equal).
        let xyz_to_cam = [
            [0.6, 0.2, 0.1],
            [0.2, 0.7, 0.1],
            [0.1, 0.2, 0.8],
        ];
        let m = cam_to_srgb(&xyz_to_cam);
        let out = apply_wb_and_matrix([1.0, 1.0, 1.0], [1.0, 1.0, 1.0], &m);
        assert!((out[0] - out[1]).abs() < 1e-5);
        assert!((out[1] - out[2]).abs() < 1e-5);
        assert!((out[0] - 1.0).abs() < 1e-5, "neutral should be ~1.0, got {}", out[0]);
    }

    #[test]
    fn srgb_encode_endpoints() {
        assert_eq!(linear_to_srgb_u8(0.0), 0);
        assert_eq!(linear_to_srgb_u8(1.0), 255);
    }

    #[test]
    fn wb_normalized_to_green() {
        let wb = normalize_wb([2.0, 4.0, 3.0]);
        assert!((wb[0] - 0.5).abs() < 1e-6);
        assert_eq!(wb[1], 1.0);
        assert!((wb[2] - 0.75).abs() < 1e-6);
    }
}
