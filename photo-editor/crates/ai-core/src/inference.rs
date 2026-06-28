//! On-device matting inference via ONNX Runtime (`ort`). Behind the `inference`
//! feature. Loads a BiRefNet ONNX model (MIT) and runs it on the GPU where available
//! (CoreML / DirectML / CUDA), falling back to CPU.

use ort::execution_providers::{
    CPUExecutionProvider, CUDAExecutionProvider, CoreMLExecutionProvider,
    DirectMLExecutionProvider,
};
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;

use crate::{postprocess, preprocess, MODEL_SIZE};

/// A loaded matting model. Reuse across calls to avoid reloading the network.
pub struct BgRemover {
    session: Session,
}

impl BgRemover {
    /// Load a BiRefNet ONNX model from disk, preferring a GPU execution provider.
    pub fn load(model_path: &str) -> Result<Self, String> {
        let session = Session::builder()
            .map_err(err)?
            .with_execution_providers([
                CoreMLExecutionProvider::default().build(),
                DirectMLExecutionProvider::default().build(),
                CUDAExecutionProvider::default().build(),
                CPUExecutionProvider::default().build(),
            ])
            .map_err(err)?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(err)?
            .commit_from_file(model_path)
            .map_err(err)?;
        Ok(Self { session })
    }

    /// Run matting on an interleaved RGBA8 image, returning an 8-bit alpha matte of
    /// the same dimensions (255 = foreground).
    pub fn matte(&mut self, rgba: &[u8], w: usize, h: usize) -> Result<Vec<u8>, String> {
        let input = preprocess(rgba, w, h);
        let tensor = Tensor::from_array((
            [1usize, 3, MODEL_SIZE, MODEL_SIZE],
            input.into_boxed_slice(),
        ))
        .map_err(err)?;

        let input_name = self.session.inputs[0].name.clone();
        // BiRefNet exports may emit several side maps; the final one is the
        // full-resolution result. Capture the output count from session metadata.
        let last = self.session.outputs.len() - 1;
        let outputs = self
            .session
            .run(ort::inputs![input_name.as_str() => tensor])
            .map_err(err)?;
        let (_shape, data) = outputs[last].try_extract_tensor::<f32>().map_err(err)?;
        let map = &data[..MODEL_SIZE * MODEL_SIZE];
        Ok(postprocess(map, w, h, true))
    }
}

/// One-shot convenience: load the model and matte a single image.
pub fn remove_background(
    rgba: &[u8],
    w: usize,
    h: usize,
    model_path: &str,
) -> Result<Vec<u8>, String> {
    BgRemover::load(model_path)?.matte(rgba, w, h)
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}
