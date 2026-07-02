//! Camera metadata extracted from a RAW file, surfaced to the UI (info panel).

#[derive(Debug, Clone, Default, PartialEq)]
pub struct RawMeta {
    pub make: String,
    pub model: String,
    pub iso: Option<u32>,
    /// Exposure time in seconds (e.g. 1/250 = 0.004).
    pub shutter: Option<f32>,
    pub aperture: Option<f32>,
    pub focal_len: Option<f32>,
    pub lens: Option<String>,
}
