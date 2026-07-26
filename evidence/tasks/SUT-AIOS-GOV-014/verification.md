# GOV-014 implementation handoff

## Scope implemented

- Added exactly one `verify:task` mapping for `node tests/compatibility/validate-finalized-platform-contracts.mjs`.
- The mapping launches `node` with `shell: false` through the shared runner and fixes the sole argument to the approved validator path.
- Added self-test coverage for the exact mapping and representative whitespace, argument, alternate-path, and shell-operator rejections.

## Boundary preserved

No generic `node tests/...` command is admitted. The immutable compatibility snapshot and application paths were not changed.

## Implementer checks

Run the packet-authorized self-test, full packet validation, fast verification, and diff check before independent verification. This record is an implementation handoff, not independent verification evidence.
