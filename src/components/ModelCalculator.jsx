import { useMemo, useState } from "react";

/* ============================================================
   PRESETS
============================================================ */
import presets from "../data/presets.json";

const GPU_PRESETS = presets.GPU_PRESETS;
const MODEL_PRESETS = presets.MODEL_PRESETS;

/* ============================================================
   CONSTANTS
============================================================ */
const GB = 1e9;
const TFLOP = 1e12;

const PRECISIONS = {
  FP32: 4,
  FP16: 2,
  BF16: 2,
  INT8: 1,
  INT4: 0.5,
};

/* ============================================================
   UX HELPERS
============================================================ */
function humanExperience(tps) {
  if (tps < 3) return "Painfully slow (noticeable lag)";
  if (tps < 7) return "Slow streaming (acceptable)";
  if (tps < 12) return "Comfortable chat speed";
  if (tps < 20) return "Fast / responsive assistant";
  return "Instant-like streaming";
}

function secondsPer100Tokens(tps) {
  return tps > 0 ? 100 / tps : 0;
}

function formatBytesGB(bytes) {
  return bytes / GB;
}

/* ============================================================
   COMPONENT
============================================================ */
export default function TransformerPerformanceCalculator() {
  const [mode, setMode] = useState("basic");

  /* ----------------------------------------------------------
     BASIC MODE
  ---------------------------------------------------------- */
  const [gpuName, setGpuName] = useState("RTX 4090");
  const [modelName, setModelName] = useState("Llama 3 8B");
  const [precision, setPrecision] = useState("FP16");

  /* ----------------------------------------------------------
     ADVANCED MODE
  ---------------------------------------------------------- */
  const [customVram, setCustomVram] = useState(24);
  const [customBandwidth, setCustomBandwidth] = useState(1008);
  const [customCompute, setCustomCompute] = useState(82.6);

  const [customParams, setCustomParams] = useState(7);
  const [customLayers, setCustomLayers] = useState(32);
  const [customHeads, setCustomHeads] = useState(32);
  const [customHeadDim, setCustomHeadDim] = useState(128);

  const [promptTokens, setPromptTokens] = useState(2048);
  const [generatedTokens, setGeneratedTokens] = useState(256);

  /* ----------------------------------------------------------
     SELECTED PRESETS
  ---------------------------------------------------------- */
  const selectedGpu = GPU_PRESETS[gpuName];
  const selectedModel = MODEL_PRESETS[modelName];

  /* ----------------------------------------------------------
     HARDWARE
  ---------------------------------------------------------- */
  const gpu = useMemo(() => {
    if (mode === "basic") {
      return {
        name: gpuName,
        vram_gb: selectedGpu.vram,
        bandwidth_gbs: selectedGpu.bandwidth,
        compute_tflops: selectedGpu.compute,
      };
    }

    return {
      name: "Custom GPU",
      vram_gb: customVram,
      bandwidth_gbs: customBandwidth,
      compute_tflops: customCompute,
    };
  }, [
    mode,
    gpuName,
    selectedGpu,
    customVram,
    customBandwidth,
    customCompute,
  ]);

  /* ----------------------------------------------------------
     MODEL
  ---------------------------------------------------------- */
  const model = useMemo(() => {
    if (mode === "basic") {
      return {
        name: modelName,
        params: selectedModel.params * 1e9,
        layers: selectedModel.layers,
        heads: selectedModel.heads,
        d_head: selectedModel.d_head,
      };
    }

    return {
      name: "Custom Model",
      params: customParams * 1e9,
      layers: customLayers,
      heads: customHeads,
      d_head: customHeadDim,
    };
  }, [
    mode,
    modelName,
    selectedModel,
    customParams,
    customLayers,
    customHeads,
    customHeadDim,
  ]);

  /* ----------------------------------------------------------
     COMPUTATION
  ---------------------------------------------------------- */
  const result = useMemo(() => {
    const bytesPerParam = PRECISIONS[precision];

    const dModel =
      model.heads * model.d_head;

    /* -----------------------------
       Weight memory
    ------------------------------ */
    const weightMemoryBytes =
      model.params * bytesPerParam;

    const weightMemoryGB =
      formatBytesGB(weightMemoryBytes);

    /* -----------------------------
       KV cache
    ------------------------------ */
    const kvCacheBytesPerToken =
      2 *
      model.layers *
      dModel *
      bytesPerParam;

    const kvCacheKB =
      kvCacheBytesPerToken / 1024;

    /* -----------------------------
       Context limit
    ------------------------------ */
    const availableVramBytes =
      gpu.vram_gb * GB * 0.9;

    const remainingBytes =
      availableVramBytes -
      weightMemoryBytes;

    const maxContext =
      remainingBytes > 0
        ? Math.floor(
            remainingBytes /
              kvCacheBytesPerToken
          )
        : 0;

    /* -----------------------------
       Decode latency
    ------------------------------ */
    const decodeLatency =
      weightMemoryBytes /
      (gpu.bandwidth_gbs * GB);

    const tps =
      decodeLatency > 0
        ? 1 / decodeLatency
        : 0;

    /* -----------------------------
       Prefill
    ------------------------------ */
    const prefillFlops =
      2 *
      model.params *
      promptTokens;

    const prefillTime =
      prefillFlops /
      (gpu.compute_tflops * TFLOP);

    /* -----------------------------
       Total generation
    ------------------------------ */
    const totalGeneration =
      prefillTime +
      decodeLatency *
        generatedTokens;

    /* -----------------------------
       Roofline
    ------------------------------ */
    const roofline =
      (gpu.compute_tflops * TFLOP) /
      (gpu.bandwidth_gbs * GB);

    const decodeArithmeticIntensity =
      1.0;

    const memoryBound =
      decodeArithmeticIntensity <
      roofline;

    return {
      weightMemoryGB,
      kvCacheKB,
      maxContext,
      decodeLatencyMs:
        decodeLatency * 1000,
      tps,
      prefillTime,
      totalGeneration,
      memoryBound,
      sp100:
        secondsPer100Tokens(tps),
      fits:
        weightMemoryGB <=
        gpu.vram_gb,
    };
  }, [
    gpu,
    model,
    precision,
    promptTokens,
    generatedTokens,
  ]);

  /* ============================================================
     UI
  ============================================================ */
  return (
    <div className="w-full text-[#1a1a1a]">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">
          Transformer Performance Calculator
        </h2>

        <p className="text-sm text-[#555]">
          Estimate VRAM usage, KV cache,
          latency and throughput
        </p>

        {/* MODE SWITCH */}
        <div className="mt-4 flex gap-2">
          {["basic", "advanced"].map(
            (m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-lg border text-sm transition
                  ${
                    mode === m
                      ? "bg-cyan-100 border-cyan-400"
                      : "bg-white border-cyan-200 hover:bg-cyan-50"
                  }`}
              >
                {m.toUpperCase()}
              </button>
            )
          )}
        </div>
      </div>

      {/* BASIC MODE */}
      {mode === "basic" && (
        <div className="grid gap-4 md:grid-cols-2">

          <Select
            label="GPU"
            value={gpuName}
            onChange={setGpuName}
            options={Object.keys(
              GPU_PRESETS
            )}
          />

          <Select
            label="Model"
            value={modelName}
            onChange={setModelName}
            options={Object.keys(
              MODEL_PRESETS
            )}
          />

          <Select
            label="Precision"
            value={precision}
            onChange={setPrecision}
            options={Object.keys(
              PRECISIONS
            )}
          />

        </div>
      )}

      {/* ADVANCED MODE */}
      {mode === "advanced" && (
        <div className="grid gap-4 md:grid-cols-2">

          <Input
            label="VRAM (GB)"
            value={customVram}
            onChange={setCustomVram}
          />

          <Input
            label="Bandwidth (GB/s)"
            value={customBandwidth}
            onChange={setCustomBandwidth}
          />

          <Input
            label="Compute (TFLOPs)"
            value={customCompute}
            onChange={setCustomCompute}
          />

          <Input
            label="Parameters (B)"
            value={customParams}
            onChange={setCustomParams}
          />

          <Input
            label="Layers"
            value={customLayers}
            onChange={setCustomLayers}
          />

          <Input
            label="Attention Heads"
            value={customHeads}
            onChange={setCustomHeads}
          />

          <Input
            label="Head Dimension"
            value={customHeadDim}
            onChange={setCustomHeadDim}
          />

          <Select
            label="Precision"
            value={precision}
            onChange={setPrecision}
            options={Object.keys(
              PRECISIONS
            )}
          />

        </div>
      )}

      {/* WORKLOAD */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">

        <Input
          label="Prompt Tokens"
          value={promptTokens}
          onChange={setPromptTokens}
        />

        <Input
          label="Generated Tokens"
          value={generatedTokens}
          onChange={setGeneratedTokens}
        />

      </div>

      {/* RESULTS */}
      <div className="mt-8 rounded-2xl border border-cyan-200 bg-white p-5">

        <h3 className="text-lg font-semibold mb-4">
          Output
        </h3>

        <div className="grid gap-4 md:grid-cols-3">

          <Metric
            label="Fits in VRAM"
            value={
              result.fits
                ? "Yes"
                : "No"
            }
          />

          <Metric
            label="Model Memory"
            value={`${result.weightMemoryGB.toFixed(
              2
            )} GB`}
          />

          <Metric
            label="KV Cache / Token"
            value={`${result.kvCacheKB.toFixed(
              2
            )} KB`}
          />

          <Metric
            label="Max Context"
            value={`${result.maxContext.toLocaleString()} tokens`}
          />

          <Metric
            label="Decode Latency"
            value={`${result.decodeLatencyMs.toFixed(
              2
            )} ms/token`}
          />

          <Metric
            label="Tokens / sec"
            value={result.tps.toFixed(
              1
            )}
          />

          <Metric
            label="Prefill Time"
            value={`${result.prefillTime.toFixed(
              2
            )} s`}
          />

          <Metric
            label="Total Generation"
            value={`${result.totalGeneration.toFixed(
              2
            )} s`}
          />

          <Metric
            label="Seconds / 100 Tokens"
            value={`${result.sp100.toFixed(
              2
            )} s`}
          />

        </div>

        <div className="mt-4 p-4 rounded-lg bg-[#f7f3e8] border border-cyan-100">

          <p className="text-sm">
            Perceived speed:{" "}
            <span className="font-bold">
              {humanExperience(
                result.tps
              )}
            </span>
          </p>

          <p className="text-sm mt-2">
            Decode regime:{" "}
            <span className="font-bold">
              {result.memoryBound
                ? "Memory-bound"
                : "Compute-bound"}
            </span>
          </p>

        </div>

      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
============================================================ */

function Select({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="text-sm">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full mt-1 p-2 border border-cyan-200 rounded-lg"
      >
        {options.map((o) => (
          <option key={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}) {
  return (
    <div>
      <label className="text-sm">
        {label}
      </label>

      <input
        type="number"
        value={value}
        onChange={(e) =>
          onChange(Number(e.target.value))
        }
        className="w-full mt-1 p-2 border border-cyan-200 rounded-lg"
      />
    </div>
  );
}

function Metric({
  label,
  value,
}) {
  return (
    <div className="p-3 rounded-lg bg-[#f7f3e8] border border-cyan-100">

      <p className="text-xs text-[#555]">
        {label}
      </p>

      <p className="text-lg font-bold">
        {value}
      </p>

    </div>
  );
}