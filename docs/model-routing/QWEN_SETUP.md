# Controlled Qwen sidecar setup

## Observed workstation

The audit on 2026-07-26 found:

- Windows 11 Pro 64-bit (`10.0.26200`).
- AMD Ryzen 5 7500F, 6 cores / 12 logical processors.
- 33,150,608 KiB visible RAM (about 31.6 GiB); 18,805,228 KiB free (about 17.9 GiB) at audit time.
- NVIDIA GeForce RTX 4070 Ti SUPER. Windows reported 4,293,918,720 bytes through WMI; do not infer usable VRAM from this value without a driver-level check.
- C: 999,194,357,760 bytes total / 419,115,991,040 free (about 390.3 GiB free).
- E: 1,000,186,310,656 bytes total / 664,390,262,784 free (about 618.7 GiB free).

## Runtime and model result

No `ollama`, `lms`/LM Studio, `llama-server`, `vllm`, or `llamafile` executable was detected. No local Qwen model identifier or Qwen model file was found in the audited common model directories. No model was selected and no download was attempted.

This is intentional: the repository must not guess an exact model identifier or download alternatives. A suitable Qwen model around the requested 27B class cannot be selected until an approved runtime and its hardware-aware model catalog are available. The sidecar remains blocked and shadow-only.

## Installation decision gate

Before installing one model, the owner must select and record:

1. An approved local runtime and exact version (`ollama`, LM Studio, or another reviewed runtime).
2. The exact Qwen model identifier and quantization, verified against that runtime's catalog.
3. A storage estimate that fits the selected drive with a safety margin; current free-space observations are recorded above, not reserved.
4. A local-only/no-egress test and PII-redaction test.

Once approved, install exactly one runtime using its official installer, then re-run `npm run local-ai:health`. For Ollama, verify the catalog with the installed `ollama list` command; for LM Studio, verify the catalog with the installed `lms ls` command. Only after recording the exact returned model ID and quantization may an owner perform one model download through that runtime's documented command. This repository intentionally does not embed a pull/download command or model identifier.

Do not delete existing models. Do not download multiple alternatives. Do not copy credentials into runtime configuration or the repository.

## Removal instructions

No installation was made by this task, so there is nothing to remove. Future removal must use the selected runtime's documented, model-specific uninstall command after recording the exact model ID and verifying that no active task references it. Never remove by wildcard or delete another user's model directory.

Run the read-only audit with `npm run local-ai:health`. Its JSON output is observational and unverified.
