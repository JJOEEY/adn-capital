// On-device AI background removal (M4). Will load a BiRefNet ONNX model (MIT
// license — safe for commercial use) via `ort` (ONNX Runtime), running on the GPU
// through CoreML (macOS) / DirectML (Windows) / CUDA, falling back to CPU.
//
// IMPORTANT (licensing): only ship MIT/Apache models here. Do NOT use BRIA RMBG
// (non-commercial) in a commercial build.
//
// Stubbed until M4.

#[allow(dead_code)]
pub struct Matte {
    pub width: u32,
    pub height: u32,
    /// Single-channel alpha matte, 0..255.
    pub alpha: Vec<u8>,
}

#[allow(dead_code)]
pub fn remove_background(_rgba: &[u8], _w: u32, _h: u32) -> Result<Matte, String> {
    Err("AI background removal arrives in M4 (on-device BiRefNet).".into())
}
