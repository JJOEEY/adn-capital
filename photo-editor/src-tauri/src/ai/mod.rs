// On-device background removal bridge. The matting math + ONNX session live in the
// pure `ai-core` crate; the `ai` Cargo feature enables the inference path. Without
// it the command returns a clear, actionable error so default builds stay light.

#[cfg(feature = "ai")]
pub fn remove_background(rgba: &[u8], w: usize, h: usize, model_path: &str) -> Result<Vec<u8>, String> {
    ai_core::remove_background(rgba, w, h, model_path)
}

#[cfg(not(feature = "ai"))]
pub fn remove_background(_rgba: &[u8], _w: usize, _h: usize, _model: &str) -> Result<Vec<u8>, String> {
    Err(
        "AI background removal isn't built into this binary. Rebuild with \
         `--features ai` and place a BiRefNet model at resources/models/birefnet.onnx."
            .into(),
    )
}
