# Local-model benchmark

The benchmark harness records four bounded preprocessing tasks for Qwen local, Luna, and Terra: repository summarization, log classification, schema comparison, and diff summarization. Each record contains model, correctness, duration, and verification-success fields.

Run:

```text
npm run local-ai:benchmark
```

On 2026-07-26, the benchmark correctly recorded all 12 comparisons as `blocked` / `not_run`: no Qwen runtime or exact model identifier was installed, and the hosted Codex CLI was not available for direct Luna/Terra execution. Duration was recorded as the local harness duration, correctness was not claimed, and verification success was `false` for every blocked run. Blocked is not a quality result.

Future runs must use the exact selected model ID/version and prompt version, fixed fixtures, deterministic validators, and a separate verifier. Do not compare a Qwen result with Luna/Terra unless all three ran on the same fixture and the output was independently verified.
